#!/usr/bin/env node
/**
 * HET CLI - Main Entry Point
 */

import { Command } from 'commander';
import { evaluateCommand } from './commands/evaluate';
import { testCommand, quickTestCommand } from './commands/test';
import { explainCommand } from './commands/explain';
import { statusCommand } from './commands/status';
import { logsCommand } from './commands/logs';
import { daemonCommand } from './commands/daemon';
import { installCommand, uninstallCommand } from './commands/install';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('het')
  .description('HET - Hook Evaluation Tool for AI Coding Assistants')
  .version(VERSION);

// Evaluate command (called by hooks)
program
  .command('evaluate')
  .description('Evaluate a tool invocation from stdin (called by hooks)')
  .option('--cli <type>', 'CLI type: claude-code or copilot')
  .action(async () => {
    await evaluateCommand();
  });

// Test command
program
  .command('test <input>')
  .description('Test evaluation of a tool invocation without blocking')
  .option('-j, --json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose output')
  .action(async (input: string, options) => {
    await testCommand(input, options);
  });

// Quick test for specific tool types
program
  .command('test-bash <command>')
  .description('Test evaluation of a bash command')
  .option('-j, --json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose output')
  .action(async (command: string, options) => {
    await quickTestCommand('bash', command, options);
  });

program
  .command('test-write <path>')
  .description('Test evaluation of a file write operation')
  .option('-j, --json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose output')
  .action(async (filePath: string, options) => {
    await quickTestCommand('write', filePath, options);
  });

// Explain command
program
  .command('explain <command>')
  .description('Show detailed security analysis for a command')
  .action(async (command: string) => {
    await explainCommand(command);
  });

// Status command
program
  .command('status')
  .description('Check HET daemon health and status')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    await statusCommand(options);
  });

// Logs command
program
  .command('logs')
  .description('View recent evaluation audit log entries')
  .option('-n, --limit <number>', 'Number of entries to show', '20')
  .option('-j, --json', 'Output as JSON')
  .option('-s, --stats', 'Show statistics instead of entries')
  .option('-t, --tool <tool>', 'Filter by tool type')
  .option('-d, --decision <decision>', 'Filter by decision (allow/deny/ask)')
  .action(async (options) => {
    await logsCommand({
      ...options,
      limit: parseInt(options.limit, 10),
    });
  });

// Daemon command
program
  .command('daemon')
  .description('Start the HET evaluation daemon')
  .option('-p, --port <port>', 'Port to listen on', '7483')
  .option('-H, --host <host>', 'Host to bind to', '127.0.0.1')
  .option('-f, --foreground', 'Run in foreground (default)')
  .action(async (options) => {
    await daemonCommand({
      ...options,
      port: parseInt(options.port, 10),
    });
  });

// Install command
program
  .command('install')
  .description('Install HET hooks for Claude Code and/or Copilot CLI')
  .option('--force', 'Overwrite existing hook configurations')
  .option('--claude', 'Install only Claude Code hooks')
  .option('--copilot', 'Install only Copilot hooks')
  .action(async (options) => {
    await installCommand(options);
  });

// Uninstall command
program
  .command('uninstall')
  .description('Remove HET hooks from Claude Code and/or Copilot CLI')
  .option('--claude', 'Remove only Claude Code hooks')
  .option('--copilot', 'Remove only Copilot hooks')
  .action(async (options) => {
    await uninstallCommand(options);
  });

// Parse and execute
program.parse();
