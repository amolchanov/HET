/**
 * Logging Utilities
 */

import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { HET_DIR } from '../config';

// Ensure HET directory exists
if (!fs.existsSync(HET_DIR)) {
  fs.mkdirSync(HET_DIR, { recursive: true });
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.HET_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'het' },
  transports: [
    // Write all logs to het.log
    new winston.transports.File({
      filename: path.join(HET_DIR, 'het.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(HET_DIR, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

// Add console output when not in production
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

/**
 * Set log level dynamically
 */
export function setLogLevel(level: string): void {
  logger.level = level;
}
