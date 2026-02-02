/**
 * Evaluate Command - Called by hooks to evaluate tool invocations
 *
 * This is the primary entry point when called from CLI hooks.
 * It reads from stdin, evaluates, and outputs the result.
 */

import { parseHookInput } from '../../hooks';
import { formatResponse, getExitCode } from '../../hooks/response';
import { evaluate, initializeEvaluator } from '../../evaluator';
import { loadRulesFile, findRepoRulesFile, mergeRules } from '../../rules';
import { GLOBAL_RULES_PATH, DEFAULT_CONFIG } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Read all input from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';

    // Check if stdin has data (not a TTY)
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    // Handle case where stdin is already closed
    process.stdin.on('error', () => {
      resolve(data);
    });

    // Timeout for reading stdin
    setTimeout(() => {
      resolve(data);
    }, 5000);
  });
}

/**
 * Main evaluate command
 */
export async function evaluateCommand(): Promise<void> {
  try {
    // Initialize evaluator
    await initializeEvaluator();

    // Read input from stdin
    const rawInput = await readStdin();

    if (!rawInput.trim()) {
      // No input provided, nothing to evaluate
      process.exit(0);
    }

    // Parse the input
    const input = parseHookInput(rawInput);
    if (!input) {
      logger.error('Failed to parse hook input');
      // On parse error, allow the operation (fail open)
      process.exit(0);
    }

    // Load rules
    const globalRules = loadRulesFile(GLOBAL_RULES_PATH);
    let rules = globalRules;

    // Try to load repo-specific rules
    const workingDir = input.workingDirectory || process.cwd();
    const repoRulesPath = findRepoRulesFile(workingDir);
    if (repoRulesPath) {
      const repoRules = loadRulesFile(repoRulesPath);
      rules = mergeRules(globalRules, repoRules);
    }

    // Evaluate with timeout
    const result = await Promise.race([
      evaluate(input, rules),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), DEFAULT_CONFIG.timeoutMs)
      ),
    ]).catch(() => ({
      decision: DEFAULT_CONFIG.defaultOnTimeout as 'allow' | 'deny' | 'ask',
      reason: 'Evaluation timed out',
      confidence: 0.3,
    }));

    // Format and output response
    const response = formatResponse(result, input.source);
    if (response) {
      console.log(response);
    }

    // Exit with appropriate code
    process.exit(getExitCode(result));
  } catch (error) {
    logger.error('Evaluate command failed', { error });
    // On error, allow the operation (fail open)
    process.exit(0);
  }
}
