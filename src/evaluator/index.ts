/**
 * Evaluator Module - Main evaluation orchestration
 */

import NodeCache from 'node-cache';
import { HookInput, EvaluationResult, Rule } from '../types';
import { matchRules } from '../rules';
import { evaluateWithLLM, isLLMAvailable, initializeCopilotClient } from './llm';
import { logger } from '../utils/logger';
import { writeAuditLog } from '../utils/audit';
import { DEFAULT_CONFIG } from '../config';

// Evaluation cache
const cache = new NodeCache({
  stdTTL: DEFAULT_CONFIG.cacheTtlSeconds,
  checkperiod: 60,
});

// Statistics
let evaluationCount = 0;
let lastEvaluationTime: Date | null = null;

/**
 * Initialize the evaluator
 */
export async function initializeEvaluator(): Promise<void> {
  await initializeCopilotClient();
  logger.info('Evaluator initialized');
}

/**
 * Main evaluation function
 *
 * Implements tiered evaluation:
 * 1. Check cache
 * 2. Check rules (fast)
 * 3. Use LLM (slow, only if needed)
 */
export async function evaluate(
  input: HookInput,
  rules: Rule[]
): Promise<EvaluationResult> {
  const startTime = Date.now();
  evaluationCount++;
  lastEvaluationTime = new Date();

  // Generate cache key
  const cacheKey = generateCacheKey(input);

  // Check cache
  const cachedResult = cache.get<EvaluationResult>(cacheKey);
  if (cachedResult) {
    logger.debug('Cache hit', { toolName: input.toolName, cacheKey });
    logEvaluation(input, cachedResult, Date.now() - startTime, true);
    return cachedResult;
  }

  // Tier 1 & 2: Rule-based evaluation
  const ruleMatch = matchRules(input, rules);
  if (ruleMatch.matched && ruleMatch.result) {
    logger.info('Rule matched', {
      toolName: input.toolName,
      rule: ruleMatch.rule?.name,
      decision: ruleMatch.result.decision,
    });

    cache.set(cacheKey, ruleMatch.result);
    logEvaluation(input, ruleMatch.result, Date.now() - startTime, false);
    return ruleMatch.result;
  }

  // Tier 3: LLM-based evaluation
  if (isLLMAvailable()) {
    try {
      const llmResult = await evaluateWithLLM(input);
      logger.info('LLM evaluation completed', {
        toolName: input.toolName,
        decision: llmResult.decision,
        confidence: llmResult.confidence,
      });

      // Only cache high-confidence results
      if (llmResult.confidence >= 0.7) {
        cache.set(cacheKey, llmResult);
      }

      logEvaluation(input, llmResult, Date.now() - startTime, false);
      return llmResult;
    } catch (error) {
      logger.error('LLM evaluation failed', { error });
    }
  }

  // Default: allow with low confidence
  const defaultResult: EvaluationResult = {
    decision: 'allow',
    reason: 'No matching rules, LLM unavailable',
    confidence: 0.5,
  };

  logEvaluation(input, defaultResult, Date.now() - startTime, false);
  return defaultResult;
}

/**
 * Generate a cache key for a tool invocation
 */
function generateCacheKey(input: HookInput): string {
  const relevant = {
    tool: input.toolName,
    input: input.toolInput,
  };
  return Buffer.from(JSON.stringify(relevant)).toString('base64').substring(0, 64);
}

/**
 * Log an evaluation to the audit log
 */
function logEvaluation(
  input: HookInput,
  result: EvaluationResult,
  evaluationTimeMs: number,
  fromCache: boolean
): void {
  writeAuditLog({
    timestamp: new Date().toISOString(),
    sessionId: input.sessionId,
    toolName: input.toolName,
    toolInput: input.toolInput,
    decision: result.decision,
    reason: result.reason,
    confidence: result.confidence,
    matchedRule: result.matchedRule,
    source: input.source,
    evaluationTimeMs: fromCache ? 0 : evaluationTimeMs,
  });
}

/**
 * Get evaluator statistics
 */
export function getEvaluatorStats(): {
  evaluationCount: number;
  lastEvaluation: string | null;
  cacheSize: number;
  llmAvailable: boolean;
} {
  return {
    evaluationCount,
    lastEvaluation: lastEvaluationTime?.toISOString() ?? null,
    cacheSize: cache.keys().length,
    llmAvailable: isLLMAvailable(),
  };
}

/**
 * Clear the evaluation cache
 */
export function clearCache(): void {
  cache.flushAll();
  logger.info('Evaluation cache cleared');
}

export { initializeCopilotClient, isLLMAvailable } from './llm';
