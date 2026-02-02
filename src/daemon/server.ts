/**
 * HET Daemon Server - HTTP server for hook evaluation
 */

import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { Rule, HealthCheckResponse, HookInput } from '../types';
import { parseHookInput } from '../hooks';
import { formatResponse, getExitCode } from '../hooks/response';
import { evaluate, getEvaluatorStats, initializeEvaluator, clearCache } from '../evaluator';
import { loadRulesFile, findRepoRulesFile, mergeRules } from '../rules';
import { logger } from '../utils/logger';
import { getAuditStats, readAuditLog } from '../utils/audit';
import { DEFAULT_CONFIG, GLOBAL_RULES_PATH } from '../config';

const VERSION = '1.0.0';

export class HETServer {
  private app: express.Application;
  private server: Server | null = null;
  private globalRules: Rule[] = [];
  private startTime: Date;

  constructor() {
    this.app = express();
    this.startTime = new Date();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '1mb' }));

    // Parse text bodies (for stdin-like input)
    this.app.use(express.text({ type: 'text/plain', limit: '1mb' }));

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug(`${req.method} ${req.path}`, {
        contentType: req.get('content-type'),
        bodyLength: typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body).length,
      });
      next();
    });

    // Error handling
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Request error', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      const stats = getEvaluatorStats();
      const auditStats = getAuditStats();

      const response: HealthCheckResponse = {
        status: 'healthy',
        uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
        version: VERSION,
        rulesLoaded: this.globalRules.length,
        evaluationsCount: auditStats.totalEvaluations,
        lastEvaluation: stats.lastEvaluation ?? undefined,
      };

      res.json(response);
    });

    // Main evaluation endpoint
    this.app.post('/evaluate', async (req: Request, res: Response) => {
      try {
        const startTime = Date.now();

        // Parse input (handle both JSON and text bodies)
        let rawInput: string;
        if (typeof req.body === 'string') {
          rawInput = req.body;
        } else {
          rawInput = JSON.stringify(req.body);
        }

        const input = parseHookInput(rawInput);
        if (!input) {
          logger.warn('Failed to parse hook input', { rawInput: rawInput.substring(0, 200) });
          res.status(400).json({ error: 'Invalid hook input format' });
          return;
        }

        // Load repo-specific rules if working directory is provided
        const rules = this.getRulesForContext(input);

        // Evaluate with timeout
        const timeoutMs = DEFAULT_CONFIG.timeoutMs;
        const result = await Promise.race([
          evaluate(input, rules),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Evaluation timeout')), timeoutMs)
          ),
        ]).catch((error) => {
          logger.warn('Evaluation timeout or error', { error: error.message });
          return {
            decision: DEFAULT_CONFIG.defaultOnTimeout as 'allow' | 'deny' | 'ask',
            reason: 'Evaluation timed out, using default decision',
            confidence: 0.3,
          };
        });

        const evaluationTimeMs = Date.now() - startTime;
        logger.info('Evaluation completed', {
          toolName: input.toolName,
          decision: result.decision,
          timeMs: evaluationTimeMs,
        });

        // Format response based on source
        const responseBody = formatResponse(result, input.source);

        // Set appropriate headers
        res.set('X-HET-Decision', result.decision);
        res.set('X-HET-Confidence', String(result.confidence));
        res.set('X-HET-Time-Ms', String(evaluationTimeMs));

        if (result.decision === 'deny') {
          res.status(200); // Still return 200, decision is in body
        }

        if (responseBody) {
          res.json(JSON.parse(responseBody));
        } else {
          res.status(204).send(); // No content = allow
        }
      } catch (error) {
        logger.error('Evaluation endpoint error', { error });
        res.status(500).json({ error: 'Evaluation failed' });
      }
    });

    // Get statistics
    this.app.get('/stats', (_req: Request, res: Response) => {
      const evalStats = getEvaluatorStats();
      const auditStats = getAuditStats();

      res.json({
        evaluator: evalStats,
        audit: auditStats,
        rules: {
          globalCount: this.globalRules.length,
        },
      });
    });

    // Get recent audit log entries
    this.app.get('/logs', (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 50;
      const entries = readAuditLog(Math.min(limit, 500));
      res.json({ entries });
    });

    // Reload rules
    this.app.post('/reload-rules', (_req: Request, res: Response) => {
      this.loadGlobalRules();
      res.json({ message: 'Rules reloaded', count: this.globalRules.length });
    });

    // Clear cache
    this.app.post('/clear-cache', (_req: Request, res: Response) => {
      clearCache();
      res.json({ message: 'Cache cleared' });
    });

    // Version info
    this.app.get('/version', (_req: Request, res: Response) => {
      res.json({ version: VERSION, name: 'HET - Hook Evaluation Tool' });
    });
  }

  /**
   * Get rules for a specific context (global + repo-specific)
   */
  private getRulesForContext(input: HookInput): Rule[] {
    if (!input.workingDirectory) {
      return this.globalRules;
    }

    const repoRulesPath = findRepoRulesFile(input.workingDirectory);
    if (!repoRulesPath) {
      return this.globalRules;
    }

    const repoRules = loadRulesFile(repoRulesPath);
    return mergeRules(this.globalRules, repoRules);
  }

  /**
   * Load global rules
   */
  private loadGlobalRules(): void {
    this.globalRules = loadRulesFile(GLOBAL_RULES_PATH);
    logger.info(`Loaded ${this.globalRules.length} global rules`);
  }

  /**
   * Start the server
   */
  async start(port: number = DEFAULT_CONFIG.port, host: string = DEFAULT_CONFIG.host): Promise<void> {
    // Initialize evaluator
    await initializeEvaluator();

    // Load global rules
    this.loadGlobalRules();

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, host, () => {
          logger.info(`HET daemon started on ${host}:${port}`);
          console.log(`HET daemon listening on http://${host}:${port}`);
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${port} is already in use`);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          logger.info('HET daemon stopped');
          resolve();
        }
      });
    });
  }
}
