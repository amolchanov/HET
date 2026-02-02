/**
 * Audit Logging
 */

import * as fs from 'fs';
import * as path from 'path';
import { AuditLogEntry } from '../types';
import { HET_DIR } from '../config';
import { redactObjectSecrets } from './secrets';

const AUDIT_LOG_PATH = path.join(HET_DIR, 'audit.log');
const MAX_AUDIT_SIZE = 50 * 1024 * 1024; // 50MB

// Ensure HET directory exists
if (!fs.existsSync(HET_DIR)) {
  fs.mkdirSync(HET_DIR, { recursive: true });
}

/**
 * Write an audit log entry
 */
export function writeAuditLog(entry: AuditLogEntry): void {
  // Redact secrets from tool input before logging
  const { redacted } = redactObjectSecrets(entry.toolInput);
  const sanitizedEntry = {
    ...entry,
    toolInput: redacted,
  };

  const logLine = JSON.stringify(sanitizedEntry) + '\n';

  // Rotate log if too large
  try {
    if (fs.existsSync(AUDIT_LOG_PATH)) {
      const stats = fs.statSync(AUDIT_LOG_PATH);
      if (stats.size > MAX_AUDIT_SIZE) {
        const backupPath = `${AUDIT_LOG_PATH}.${Date.now()}.bak`;
        fs.renameSync(AUDIT_LOG_PATH, backupPath);
      }
    }
    fs.appendFileSync(AUDIT_LOG_PATH, logLine);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Read recent audit log entries
 */
export function readAuditLog(limit: number = 100): AuditLogEntry[] {
  if (!fs.existsSync(AUDIT_LOG_PATH)) {
    return [];
  }

  try {
    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries: AuditLogEntry[] = [];

    // Read from end for most recent entries
    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      try {
        entries.push(JSON.parse(lines[i]));
      } catch {
        // Skip malformed lines
      }
    }

    return entries;
  } catch (error) {
    console.error('Failed to read audit log:', error);
    return [];
  }
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  totalEvaluations: number;
  allowedCount: number;
  deniedCount: number;
  askCount: number;
  byTool: Record<string, number>;
} {
  const entries = readAuditLog(10000);

  const stats = {
    totalEvaluations: entries.length,
    allowedCount: 0,
    deniedCount: 0,
    askCount: 0,
    byTool: {} as Record<string, number>,
  };

  for (const entry of entries) {
    switch (entry.decision) {
      case 'allow':
        stats.allowedCount++;
        break;
      case 'deny':
        stats.deniedCount++;
        break;
      case 'ask':
        stats.askCount++;
        break;
    }

    stats.byTool[entry.toolName] = (stats.byTool[entry.toolName] || 0) + 1;
  }

  return stats;
}
