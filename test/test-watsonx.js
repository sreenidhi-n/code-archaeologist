#!/usr/bin/env node
// Quick WatsonX connectivity test — run once to verify credentials work.
// Run: node test/test-watsonx.js

import 'dotenv/config';
import { generateText, DEFAULT_MODEL } from '../src/utils/watsonx.js';

console.log('WatsonX Connectivity Test');
console.log('─────────────────────────');
console.log(`Model:      ${DEFAULT_MODEL}`);
console.log(`URL:        ${process.env.WATSONX_URL}`);
console.log(`Project ID: ${process.env.WATSONX_PROJECT_ID}`);
console.log(`API Key:    ${process.env.WATSONX_API_KEY ? '✅ set' : '❌ missing'}`);
console.log('');

const result = await generateText(
  'In one sentence, what is Apache Struts 1?',
  { maxTokens: 100 }
).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

if (result === null) {
  console.error('❌ generateText returned null — check that WATSONX_API_KEY and WATSONX_PROJECT_ID are set in .env');
  process.exit(1);
}

console.log('Response:', result.trim());
console.log('');
console.log('✅ WatsonX connection confirmed.');
