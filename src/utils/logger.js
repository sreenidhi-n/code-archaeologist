/**
 * Simple structured logging utility for Code Archaeologist
 * Provides consistent log formatting and levels
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

class Logger {
  constructor(options = {}) {
    this.level = this.parseLevel(options.level || process.env.LOG_LEVEL || 'INFO');
    this.context = options.context || 'CodeArchaeologist';
  }

  parseLevel(level) {
    const upperLevel = String(level).toUpperCase();
    return LOG_LEVELS[upperLevel] !== undefined ? LOG_LEVELS[upperLevel] : LOG_LEVELS.INFO;
  }

  shouldLog(level) {
    return level <= this.level;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    
    const logEntry = {
      timestamp,
      level: levelName,
      context: this.context,
      message
    };

    // Add metadata if provided
    if (Object.keys(meta).length > 0) {
      logEntry.meta = meta;
    }

    return JSON.stringify(logEntry);
  }

  error(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatMessage(LOG_LEVELS.ERROR, message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatMessage(LOG_LEVELS.WARN, message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.log(this.formatMessage(LOG_LEVELS.INFO, message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(this.formatMessage(LOG_LEVELS.DEBUG, message, meta));
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context) {
    return new Logger({
      level: this.level,
      context: `${this.context}:${context}`
    });
  }

  /**
   * Log tool execution start
   */
  toolStart(toolName, args) {
    this.info(`Tool execution started: ${toolName}`, {
      tool: toolName,
      args: this.sanitizeArgs(args)
    });
  }

  /**
   * Log tool execution success
   */
  toolSuccess(toolName, duration) {
    this.info(`Tool execution completed: ${toolName}`, {
      tool: toolName,
      duration: `${duration}ms`,
      status: 'success'
    });
  }

  /**
   * Log tool execution error
   */
  toolError(toolName, error, duration) {
    this.error(`Tool execution failed: ${toolName}`, {
      tool: toolName,
      duration: `${duration}ms`,
      status: 'error',
      error: error.message,
      errorType: error.constructor.name
    });
  }

  /**
   * Sanitize arguments to remove sensitive data
   */
  sanitizeArgs(args) {
    const sanitized = { ...args };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['apiKey', 'token', 'password', 'secret'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

// Create default logger instance
const logger = new Logger();

export { Logger, logger };

// Made with Bob
