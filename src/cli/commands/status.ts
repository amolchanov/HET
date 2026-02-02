/**
 * Status Command - Check daemon health and status
 */

import chalk from 'chalk';
import * as http from 'http';
import { DEFAULT_CONFIG } from '../../config';
import { HealthCheckResponse } from '../../types';

interface StatusOptions {
  json?: boolean;
}

/**
 * Check if daemon is running
 */
async function checkDaemon(): Promise<HealthCheckResponse | null> {
  return new Promise((resolve) => {
    const options = {
      hostname: DEFAULT_CONFIG.host,
      port: DEFAULT_CONFIG.port,
      path: '/health',
      method: 'GET',
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * Format uptime as human-readable string
 */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

/**
 * Status command
 */
export async function statusCommand(options: StatusOptions): Promise<void> {
  const health = await checkDaemon();

  if (options.json) {
    if (health) {
      console.log(JSON.stringify({ running: true, ...health }, null, 2));
    } else {
      console.log(JSON.stringify({ running: false }, null, 2));
    }
    return;
  }

  console.log();
  console.log(chalk.bold('HET Daemon Status'));
  console.log('─'.repeat(40));

  if (!health) {
    console.log(
      `${chalk.bold('Status:')} ${chalk.red('●')} ${chalk.red('Not running')}`
    );
    console.log();
    console.log(chalk.dim('Start the daemon with: het daemon'));
    console.log();
    process.exit(1);
  }

  const statusColor = {
    healthy: chalk.green,
    degraded: chalk.yellow,
    unhealthy: chalk.red,
  };

  console.log(
    `${chalk.bold('Status:')} ${statusColor[health.status]('●')} ${statusColor[health.status](
      health.status.charAt(0).toUpperCase() + health.status.slice(1)
    )}`
  );
  console.log(`${chalk.bold('Version:')} ${health.version}`);
  console.log(`${chalk.bold('Uptime:')} ${formatUptime(health.uptime)}`);
  console.log(`${chalk.bold('Rules Loaded:')} ${health.rulesLoaded}`);
  console.log(`${chalk.bold('Total Evaluations:')} ${health.evaluationsCount}`);

  if (health.lastEvaluation) {
    const lastEval = new Date(health.lastEvaluation);
    const ago = Math.floor((Date.now() - lastEval.getTime()) / 1000);
    console.log(`${chalk.bold('Last Evaluation:')} ${formatUptime(ago)} ago`);
  }

  console.log();
  console.log(chalk.dim(`Listening on http://${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}`));
  console.log();
}
