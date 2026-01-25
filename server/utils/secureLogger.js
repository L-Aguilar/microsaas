"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureLogLegacy = exports.auditLogger = void 0;
exports.secureLog = secureLog;
var winston_1 = __importDefault(require("winston"));
// Create logger configuration for production
var logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'bizflow-crm' },
    transports: [
        // Write all logs to console in development
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        // Write all logs with importance level of `error` or less to `error.log`
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston_1.default.transports.File({ filename: 'logs/combined.log' })
    ]
});
// Security audit logger for sensitive operations
exports.auditLogger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.File({ filename: 'logs/security-audit.log' })
    ]
});
// Helper functions for secure logging
exports.secureLogLegacy = {
    info: function (message, meta) {
        logger.info(message, sanitizeMeta(meta));
    },
    error: function (message, error, meta) {
        logger.error(message, __assign({ error: error === null || error === void 0 ? void 0 : error.message, stack: error === null || error === void 0 ? void 0 : error.stack }, sanitizeMeta(meta)));
    },
    warn: function (message, meta) {
        logger.warn(message, sanitizeMeta(meta));
    },
    debug: function (message, meta) {
        logger.debug(message, sanitizeMeta(meta));
    },
    // Enhanced security audit function
    audit: function (event) {
        var sanitizedEvent = __assign(__assign({}, event), { timestamp: new Date().toISOString(), details: sanitizeMeta(event.details) });
        // Log to both regular log and security audit log
        logger[event.level]("SECURITY_EVENT: ".concat(event.action), sanitizedEvent);
        exports.auditLogger.info('Security Audit', sanitizedEvent);
    }
};
// Main secure logging function with enhanced security event interface
function secureLog(event) {
    var sanitizedEvent = __assign(__assign({}, event), { timestamp: new Date().toISOString(), details: sanitizeMeta(event.details) });
    // Log to both regular log and security audit log
    logger[event.level]("SECURITY_EVENT: ".concat(event.action), sanitizedEvent);
    exports.auditLogger.info('Security Audit', sanitizedEvent);
}
// Sanitize metadata to remove sensitive information
function sanitizeMeta(meta) {
    if (!meta)
        return {};
    var sanitized = __assign({}, meta);
    // Remove sensitive fields
    var sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    var removeSensitiveData = function (obj, path) {
        if (path === void 0) { path = ''; }
        if (typeof obj !== 'object' || obj === null)
            return obj;
        var _loop_1 = function (key) {
            var fullPath = path ? "".concat(path, ".").concat(key) : key;
            if (sensitiveFields.some(function (field) { return key.toLowerCase().includes(field); })) {
                obj[key] = '[REDACTED]';
            }
            else if (typeof obj[key] === 'object') {
                obj[key] = removeSensitiveData(obj[key], fullPath);
            }
        };
        for (var key in obj) {
            _loop_1(key);
        }
        return obj;
    };
    return removeSensitiveData(sanitized);
}
exports.default = logger;
