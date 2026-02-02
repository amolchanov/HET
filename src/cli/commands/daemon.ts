/**
 * Daemon Command - Start the HET daemon
 */

import chalk from 'chalk';
import { HETServer } from '../../daemon/server';
import { DEFAULT_CONFIG } from '../../config';

interface DaemonOptions {
  port?: number;
  host?: string;
  foreground?: boolean;
}

/**
 * Daemon command - start the HET daemon
 */
export async function daemonCommand(options: DaemonOptions): Promise<void> {
  const port = options.port || DEFAULT_CONFIG.port;
  const host = options.host || DEFAULT_CONFIG.host;

  console.log();
  console.log(chalk.bold.blue('HET - Hook Evaluation Tool'));
  console.log('─'.repeat(40));
  console.log();

  const server = new HETServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log();
    console.log(chalk.yellow('Shutting down...'));
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start(port, host);
    console.log(chalk.green('✓') + ` Daemon started on ${chalk.cyan(`http://${host}:${port}`)}`);
    console.log();
    console.log(chalk.dim('Press Ctrl+C to stop'));
    console.log();

    // Keep running
    if (options.foreground) {
      // Already running in foreground
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'EADDRINUSE') {
      console.log(chalk.red('✗') + ` Port ${port} is already in use`);
      console.log();
      console.log(chalk.dim('Is another HET daemon already running?'));
      console.log(chalk.dim(`Check with: het status`));
    } else {
      console.log(chalk.red('✗') + ' Failed to start daemon');
      console.error(error);
    }
    process.exit(1);
  }
}
