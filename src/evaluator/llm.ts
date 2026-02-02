/**
 * LLM Evaluator - Uses Copilot SDK for semantic evaluation
 *
 * Note: This is a placeholder implementation. The actual Copilot SDK
 * integration will be added when the SDK is available.
 */

import { HookInput, EvaluationResult, ToolType } from '../types';
import { redactObjectSecrets } from '../utils/secrets';
import { buildSystemPrompt } from '../utils/prompt';
import { logger } from '../utils/logger';

// Placeholder for Copilot SDK client
let copilotClient: CopilotClientInterface | null = null;

interface CopilotClientInterface {
  evaluate(prompt: string): Promise<string>;
  isAvailable(): boolean;
}

/**
 * Initialize the Copilot SDK client
 * This will be implemented when the SDK is available
 */
export async function initializeCopilotClient(): Promise<boolean> {
  try {
    // Placeholder: Check if Copilot SDK is available
    // In production, this would initialize the actual SDK:
    // const { CopilotClient } = await import('@github/copilot-sdk');
    // copilotClient = new CopilotClient();

    logger.info('Copilot SDK client initialization (placeholder)');

    // For now, use a mock client
    copilotClient = createMockClient();
    return true;
  } catch (error) {
    logger.warn('Copilot SDK not available, LLM evaluation disabled', { error });
    return false;
  }
}

/**
 * Create a mock client for testing without the actual SDK
 */
function createMockClient(): CopilotClientInterface {
  return {
    evaluate: async (prompt: string): Promise<string> => {
      // Simple heuristic-based mock evaluation
      return mockEvaluate(prompt);
    },
    isAvailable: () => true,
  };
}

/**
 * Mock evaluation logic for testing
 */
function mockEvaluate(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();

  // Check for obvious dangerous patterns
  const dangerKeywords = [
    'rm -rf /',
    'delete all',
    'format disk',
    'drop database',
    'send to external',
    'exfiltrate',
    'backdoor',
    'reverse shell',
  ];

  for (const keyword of dangerKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return JSON.stringify({
        decision: 'deny',
        reason: `Detected potentially dangerous pattern: ${keyword}`,
        confidence: 0.9,
        riskFactors: ['dangerous-command'],
      });
    }
  }

  // Check for patterns that need user confirmation
  const askKeywords = [
    'force push',
    'overwrite',
    'sudo',
    'admin',
    'credentials',
    'password',
    'token',
    'secret',
  ];

  for (const keyword of askKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return JSON.stringify({
        decision: 'ask',
        reason: `Operation involves ${keyword}, user confirmation recommended`,
        confidence: 0.7,
        riskFactors: ['needs-confirmation'],
      });
    }
  }

  // Default: allow with moderate confidence
  return JSON.stringify({
    decision: 'allow',
    reason: 'No obvious security concerns detected',
    confidence: 0.8,
    riskFactors: [],
  });
}

/**
 * Check if LLM evaluation is available
 */
export function isLLMAvailable(): boolean {
  return copilotClient?.isAvailable() ?? false;
}

/**
 * Evaluate a tool invocation using LLM
 */
export async function evaluateWithLLM(input: HookInput): Promise<EvaluationResult> {
  if (!copilotClient) {
    logger.warn('LLM evaluation requested but client not initialized');
    return {
      decision: 'allow',
      reason: 'LLM evaluation unavailable, defaulting to allow',
      confidence: 0.5,
    };
  }

  // Redact secrets before sending to LLM
  const { redacted, secretsFound } = redactObjectSecrets(input.toolInput);

  if (secretsFound.length > 0) {
    logger.info('Secrets redacted before LLM evaluation', { secretsFound });
  }

  // Build the evaluation prompt with merged system prompts
  const evaluationPrompt = buildEvaluationPrompt(
    input.toolName, 
    redacted as Record<string, unknown>,
    input.workingDirectory
  );

  try {
    const response = await copilotClient.evaluate(evaluationPrompt);
    const parsed = parseEvaluationResponse(response);

    // Add warning about secrets if found
    if (secretsFound.length > 0) {
      parsed.riskFactors = parsed.riskFactors || [];
      parsed.riskFactors.push(`Secrets detected and redacted: ${secretsFound.join(', ')}`);
    }

    return parsed;
  } catch (error) {
    logger.error('LLM evaluation failed', { error });
    return {
      decision: 'allow',
      reason: 'LLM evaluation failed, defaulting to allow',
      confidence: 0.3,
    };
  }
}

/**
 * Build the evaluation prompt for the LLM
 */
function buildEvaluationPrompt(
  toolName: ToolType, 
  toolInput: Record<string, unknown>,
  workingDirectory?: string
): string {
  const toolDescription = getToolDescription(toolName);
  const systemPrompt = buildSystemPrompt(workingDirectory);

  return `${systemPrompt}

---

Evaluate the following tool invocation:

Tool: ${toolName}
Description: ${toolDescription}
Input: ${JSON.stringify(toolInput, null, 2)}

Analyze this invocation and provide your security assessment.`;
}

/**
 * Get a description of the tool for context
 */
function getToolDescription(toolName: ToolType): string {
  const descriptions: Record<ToolType, string> = {
    Bash: 'Executes shell commands on Unix/Linux/macOS systems',
    PowerShell: 'Executes PowerShell commands on Windows systems',
    Write: 'Creates or overwrites files on the filesystem',
    Edit: 'Modifies existing files using string replacement',
    Read: 'Reads file contents from the filesystem',
    Glob: 'Searches for files matching patterns',
    Grep: 'Searches file contents for patterns',
    WebFetch: 'Fetches content from URLs',
    WebSearch: 'Performs web searches',
    Task: 'Spawns subagent tasks',
    NotebookEdit: 'Modifies Jupyter notebook cells',
    MCP: 'MCP (Model Context Protocol) tool from an external server',
  };

  return descriptions[toolName] || 'Unknown tool';
}

/**
 * Parse the LLM evaluation response
 */
function parseEvaluationResponse(response: string): EvaluationResult {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(response);

    return {
      decision: parsed.decision || 'allow',
      reason: parsed.reason || 'No reason provided',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
    };
  } catch {
    // If not valid JSON, try to extract decision from text
    logger.warn('Failed to parse LLM response as JSON, using fallback');

    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('deny') || lowerResponse.includes('block')) {
      return {
        decision: 'deny',
        reason: response.substring(0, 200),
        confidence: 0.6,
      };
    }

    if (lowerResponse.includes('ask') || lowerResponse.includes('confirm')) {
      return {
        decision: 'ask',
        reason: response.substring(0, 200),
        confidence: 0.6,
      };
    }

    return {
      decision: 'allow',
      reason: 'Could not parse evaluation, defaulting to allow',
      confidence: 0.4,
    };
  }
}
