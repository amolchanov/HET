/**
 * Logs Command - View recent audit log entries
 */

import chalk from 'chalk';
import { readAuditLog, getAuditStats } from '../../utils/audit';
import { AuditLogEntry } from '../../types';

interface LogsOptions {
  limit?: number;
  json?: boolean;
  stats?: boolean;
  tool?: string;
  decision?: string;
}

/**
 * Format a timestamp as relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const seconds = Math.floor((now - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format a log entry for display
 */
function formatEntry(entry: AuditLogEntry): string {
  const decisionIcon = {
    allow: chalk.green('✓'),
    deny: chalk.red('✗'),
    ask: chalk.yellow('?'),
  };

  const time = formatRelativeTime(entry.timestamp);
  const icon = decisionIcon[entry.decision];
  const tool = chalk.blue(entry.toolName.padEnd(10));

  // Get a preview of the tool input
  let preview = '';
  if (entry.toolName === 'Bash' && entry.toolInput.command) {
    preview = String(entry.toolInput.command).substring(0, 50);
  } else if (entry.toolInput.file_path) {
    preview = String(entry.toolInput.file_path).substring(0, 50);
  } else if (entry.toolInput.url) {
    preview = String(entry.toolInput.url).substring(0, 50);
  } else {
    preview = JSON.stringify(entry.toolInput).substring(0, 50);
  }

  if (preview.length === 50) preview += '...';

  return `${chalk.dim(time.padEnd(10))} ${icon} ${tool} ${chalk.dim(preview)}`;
}

/**
 * Logs command
 */
export async function logsCommand(options: LogsOptions): Promise<void> {
  const limit = options.limit || 20;

  if (options.stats) {
    const stats = getAuditStats();

    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log();
    console.log(chalk.bold('HET Audit Statistics'));
    console.log('─'.repeat(40));
    console.log(`${chalk.bold('Total Evaluations:')} ${stats.totalEvaluations}`);
    console.log(
      `${chalk.bold('Allowed:')} ${chalk.green(stats.allowedCount)} (${(
        (stats.allowedCount / stats.totalEvaluations) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `${chalk.bold('Denied:')} ${chalk.red(stats.deniedCount)} (${(
        (stats.deniedCount / stats.totalEvaluations) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `${chalk.bold('Asked:')} ${chalk.yellow(stats.askCount)} (${(
        (stats.askCount / stats.totalEvaluations) *
        100
      ).toFixed(1)}%)`
    );
    console.log();
    console.log(chalk.bold('By Tool:'));
    for (const [tool, count] of Object.entries(stats.byTool).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  ${tool.padEnd(12)} ${count}`);
    }
    console.log();
    return;
  }

  let entries = readAuditLog(limit * 2); // Read extra to account for filtering

  // Apply filters
  if (options.tool) {
    entries = entries.filter(
      (e) => e.toolName.toLowerCase() === options.tool?.toLowerCase()
    );
  }

  if (options.decision) {
    entries = entries.filter(
      (e) => e.decision.toLowerCase() === options.decision?.toLowerCase()
    );
  }

  // Limit after filtering
  entries = entries.slice(0, limit);

  if (options.json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log();
    console.log(chalk.dim('No audit log entries found'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold('Recent Evaluations'));
  console.log('─'.repeat(70));

  for (const entry of entries) {
    console.log(formatEntry(entry));
  }

  console.log('─'.repeat(70));
  console.log(chalk.dim(`Showing ${entries.length} entries. Use --limit N to show more.`));
  console.log();
}
