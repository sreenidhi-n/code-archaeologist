import fs from 'fs';
import path from 'path';

/**
 * Validates that a repository path is valid and safe to use.
 * @param {string} repoPath - The path to validate
 * @throws {Error} If the path is invalid or unsafe
 * @returns {string} The normalized absolute path
 */
export function validateRepoPath(repoPath) {
  // Check if path is provided
  if (!repoPath || typeof repoPath !== 'string') {
    throw new Error('repoPath must be a non-empty string');
  }

  // Trim whitespace
  const trimmedPath = repoPath.trim();
  if (trimmedPath.length === 0) {
    throw new Error('repoPath cannot be empty or whitespace');
  }

  // Length limit — prevents DoS via pathologically long strings
  if (trimmedPath.length > 4096) {
    throw new Error('repoPath exceeds maximum allowed length (4096 chars)');
  }

  // Check raw input for null bytes and newlines before any processing
  if (trimmedPath.includes('\0') || trimmedPath.includes('\n')) {
    throw new Error('Invalid characters in repoPath');
  }

  // Resolve to absolute path (this normalizes away any ".." components)
  const absolutePath = path.resolve(trimmedPath);

  // Check if path exists
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Repository path does not exist');
  }

  // Check if it's a directory
  const stats = fs.statSync(absolutePath);
  if (!stats.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  // Check if it's a git repository
  const gitPath = path.join(absolutePath, '.git');
  if (!fs.existsSync(gitPath)) {
    throw new Error('Not a git repository (no .git directory found)');
  }

  return absolutePath;
}

/**
 * Validates an optional build file path.
 * @param {string} repoPath - The repository path
 * @param {string} buildFilePath - The build file path (optional)
 * @returns {string|null} The validated build file path or null
 */
export function validateBuildFilePath(repoPath, buildFilePath) {
  if (!buildFilePath) {
    return null;
  }

  if (typeof buildFilePath !== 'string') {
    throw new Error('buildFilePath must be a string');
  }

  // Resolve relative to repo path
  const absolutePath = path.isAbsolute(buildFilePath) 
    ? buildFilePath 
    : path.join(repoPath, buildFilePath);

  // Check for path traversal
  if (!absolutePath.startsWith(repoPath)) {
    throw new Error('buildFilePath must be within the repository directory');
  }

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Build file does not exist');
  }

  // Check if it's a file
  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    throw new Error('Build file path is not a file');
  }

  return absolutePath;
}

/**
 * Validates tool arguments based on the tool name.
 * @param {string} toolName - The name of the tool
 * @param {object} args - The arguments to validate
 * @returns {object} The validated arguments
 */
export function validateToolArguments(toolName, args) {
  if (!args || typeof args !== 'object') {
    throw new Error('Tool arguments must be an object');
  }

  const allowedProps = {
    excavate_repo:       ['repoPath'],
    git_historian:       ['repoPath'],
    dependency_grapher:  ['repoPath', 'buildFilePath'],
    docs_generator:      ['repoPath', 'gitHistorianResult', 'dependencyGrapherResult', 'reconResult']
  };
  const allowed = allowedProps[toolName];
  if (allowed) {
    const unexpected = Object.keys(args).filter(p => !allowed.includes(p));
    if (unexpected.length > 0) {
      throw new Error(`Unexpected arguments for ${toolName}: ${unexpected.join(', ')}`);
    }
  }

  const validated = {};

  switch (toolName) {
    case 'excavate_repo':
    case 'git_historian':
      validated.repoPath = validateRepoPath(args.repoPath);
      break;

    case 'dependency_grapher':
      validated.repoPath = validateRepoPath(args.repoPath);
      validated.buildFilePath = validateBuildFilePath(
        validated.repoPath, 
        args.buildFilePath
      );
      break;

    case 'docs_generator':
      validated.repoPath = validateRepoPath(args.repoPath);
      
      // Validate optional result objects
      if (args.gitHistorianResult !== undefined) {
        if (typeof args.gitHistorianResult !== 'object') {
          throw new Error('gitHistorianResult must be an object');
        }
        validated.gitHistorianResult = args.gitHistorianResult;
      }
      
      if (args.dependencyGrapherResult !== undefined) {
        if (typeof args.dependencyGrapherResult !== 'object') {
          throw new Error('dependencyGrapherResult must be an object');
        }
        validated.dependencyGrapherResult = args.dependencyGrapherResult;
      }
      break;

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  return validated;
}

function sanitizeErrorMessage(message) {
  // Redact absolute paths — replace with just the last path component
  let sanitized = message.replace(/\/[^\s"'`,]+/g, (match) => {
    const parts = match.split('/');
    return `.../${parts[parts.length - 1]}`;
  });
  // Redact long alphanumeric strings that may be tokens or API keys
  sanitized = sanitized.replace(/\b[a-zA-Z0-9_-]{40,}\b/g, '***REDACTED***');
  return sanitized;
}

/**
 * Creates a standardized error response.
 * @param {Error} error - The error object
 * @param {string} toolName - The name of the tool that errored
 * @returns {object} Standardized error response
 */
export function createErrorResponse(error, toolName) {
  return {
    success: false,
    tool: toolName,
    error: {
      message: sanitizeErrorMessage(error.message),
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Creates a standardized success response.
 * @param {any} data - The response data
 * @param {string} toolName - The name of the tool
 * @returns {object} Standardized success response
 */
export function createSuccessResponse(data, toolName) {
  return {
    success: true,
    tool: toolName,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  };
}

// Made with Bob
