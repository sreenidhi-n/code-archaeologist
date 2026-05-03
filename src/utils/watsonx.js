import 'dotenv/config';
import { logger } from './logger.js';

// All WatsonX calls must use this constant — never hardcode model IDs at call sites.
const DEFAULT_MODEL = process.env.WATSONX_MODEL || 'ibm/granite-3-8b-instruct';

// BANNED models — do not use these, they will hurt judging:
// - llama-3-405b-instruct
// - mistral-medium-2505
// - mistral-small-3-1-24b-instruct-2503

const MAX_RETRIES = parseInt(process.env.WATSONX_MAX_RETRIES || '3');
const REQUEST_TIMEOUT = parseInt(process.env.WATSONX_TIMEOUT || '30000');
const INITIAL_RETRY_DELAY = 1000;

let cachedToken = null;
let tokenExpiresAt = 0;
let tokenFetchPromise = null; // race condition fix: deduplicate concurrent IAM requests

let requestCount = 0;
let requestWindowStart = Date.now();
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.WATSONX_RATE_LIMIT || '60');

function validateEnvConfig() {
  if (process.env.WATSONX_URL) {
    try { new URL(process.env.WATSONX_URL); }
    catch { throw new Error('WATSONX_URL must be a valid URL'); }
  }
  const numericEnvs = {
    WATSONX_MAX_RETRIES: { min: 0,    max: 10 },
    WATSONX_TIMEOUT:     { min: 1000, max: 300000 },
    WATSONX_RATE_LIMIT:  { min: 1,    max: 1000 }
  };
  for (const [key, { min, max }] of Object.entries(numericEnvs)) {
    if (process.env[key] !== undefined) {
      const val = parseInt(process.env[key]);
      if (isNaN(val) || val < min || val > max) {
        throw new Error(`${key} must be a number between ${min} and ${max}`);
      }
    }
  }
}
validateEnvConfig();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkRateLimit() {
  const now = Date.now();
  if (now - requestWindowStart >= RATE_LIMIT_WINDOW) {
    requestCount = 0;
    requestWindowStart = now;
  }
  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    const waitTime = RATE_LIMIT_WINDOW - (now - requestWindowStart);
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }
  requestCount++;
}

// Separated from getIAMToken to allow clean promise-based deduplication
async function fetchIAMToken(apiKey, retryCount = 0) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: apiKey
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`IAM token request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (55 * 60 * 1000);
    logger.debug('IAM token refreshed successfully');
    return cachedToken;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(`IAM token request timed out after ${REQUEST_TIMEOUT}ms`);
    }

    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      logger.warn(`IAM token request failed, retrying in ${delay}ms`, {
        attempt: retryCount + 1,
        maxRetries: MAX_RETRIES,
        error: error.message
      });
      await sleep(delay);
      return fetchIAMToken(apiKey, retryCount + 1);
    }

    logger.error('IAM token request failed after all retries', {
      attempts: retryCount + 1,
      error: error.message
    });
    throw error;
  }
}

// Returns cached token or fetches a new one.
// Concurrent callers wait on the same in-flight promise instead of making duplicate requests.
async function getIAMToken(apiKey) {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }
  tokenFetchPromise = fetchIAMToken(apiKey).finally(() => {
    // Use setImmediate so all awaiting callers receive the token before we clear the promise.
    setImmediate(() => { tokenFetchPromise = null; });
  });
  return tokenFetchPromise;
}

/**
 * Wrap a plain prompt in Granite instruct chat format.
 * Prevents the model from echoing instruction fragments into its output.
 * Format: <|system|>\n{role}\n<|user|>\n{task}\n<|assistant|>\n
 */
function wrapGraniteInstruct(prompt, systemRole = 'You are a helpful expert assistant. Answer directly and concisely without repeating instructions.') {
  return `<|system|>\n${systemRole}\n<|user|>\n${prompt}\n<|assistant|>\n`;
}

/**
 * Generate text using WatsonX Granite.
 * Returns null if no API key is configured — callers fall back to templates.
 */
export async function generateText(prompt, options = {}, retryCount = 0) {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const baseUrl = process.env.WATSONX_GATEWAY_URL
    || process.env.WATSONX_URL
    || 'https://us-south.ml.cloud.ibm.com';

  if (!apiKey || !projectId) {
    logger.warn('WatsonX credentials not configured, returning null');
    return null;
  }

  try {
    checkRateLimit();
  } catch (error) {
    logger.error('Rate limit exceeded', { error: error.message });
    throw error;
  }

  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 500;
  const temperature = options.temperature ?? 0.7;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const token = await getIAMToken(apiKey);

    logger.debug('Sending WatsonX generation request', { model, maxTokens, promptLength: prompt.length });

    const response = await fetch(`${baseUrl}/ml/v1/text/generation?version=2023-05-29`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model_id: model,
        input: wrapGraniteInstruct(prompt),
        parameters: { max_new_tokens: maxTokens, temperature, repetition_penalty: 1.1 },
        project_id: projectId
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WatsonX API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    const text = data?.results?.[0]?.generated_text ?? null;
    const tokens = data?.results?.[0]?.generated_token_count ?? 0;

    logger.info('WatsonX generation successful', { model, tokensGenerated: tokens, outputLength: text?.length || 0 });
    return text;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(`WatsonX request timed out after ${REQUEST_TIMEOUT}ms`);
    }

    const isRetryable = error.message.includes('503') ||
                        error.message.includes('429') ||
                        error.message.includes('timeout') ||
                        error.message.includes('ECONNRESET');

    if (isRetryable && retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      logger.warn(`WatsonX request failed, retrying in ${delay}ms`, {
        attempt: retryCount + 1,
        error: error.message
      });
      await sleep(delay);
      return generateText(prompt, options, retryCount + 1);
    }

    logger.error('WatsonX generation failed', { attempts: retryCount + 1, error: error.message, model });
    throw error;
  }
}

export { DEFAULT_MODEL };
