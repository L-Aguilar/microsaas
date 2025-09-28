import winston from 'winston';

// Create logger configuration for production
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bizflow-crm' },
  transports: [
    // Write all logs to console in development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Security audit logger for sensitive operations
export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security-audit.log' })
  ]
});

// Helper functions for secure logging
export const secureLog = {
  info: (message: string, meta?: any) => {
    logger.info(message, sanitizeMeta(meta));
  },
  
  error: (message: string, error?: Error, meta?: any) => {
    logger.error(message, { error: error?.message, stack: error?.stack, ...sanitizeMeta(meta) });
  },
  
  warn: (message: string, meta?: any) => {
    logger.warn(message, sanitizeMeta(meta));
  },
  
  // For security-related events
  audit: (event: string, userId?: string, details?: any) => {
    auditLogger.info('Security Event', {
      event,
      userId,
      timestamp: new Date().toISOString(),
      details: sanitizeMeta(details)
    });
  }
};

// Sanitize metadata to remove sensitive information
function sanitizeMeta(meta: any): any {
  if (!meta) return {};
  
  const sanitized = { ...meta };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
  
  const removeSensitiveData = (obj: any, path = '') => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (const key in obj) {
      const fullPath = path ? `${path}.${key}` : key;
      
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        obj[key] = removeSensitiveData(obj[key], fullPath);
      }
    }
    
    return obj;
  };
  
  return removeSensitiveData(sanitized);
}

export default logger;