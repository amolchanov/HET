#!/usr/bin/env node
/**
 * HET Daemon Entry Point
 */

import { HETServer } from './server';
import { DEFAULT_CONFIG } from '../config';
import { logger } from '../utils/logger';

const server = new HETServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  await server.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

// Start the server
const port = parseInt(process.env.HET_PORT || '') || DEFAULT_CONFIG.port;
const host = process.env.HET_HOST || DEFAULT_CONFIG.host;

server
  .start(port, host)
  .then(() => {
    logger.info('HET daemon ready');
  })
  .catch((error) => {
    logger.error('Failed to start HET daemon', { error: error.message });
    console.error('Failed to start HET daemon:', error.message);
    process.exit(1);
  });
