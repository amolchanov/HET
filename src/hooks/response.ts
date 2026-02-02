/**
 * Hook Response - Format responses for different CLI sources
 */

import { EvaluationResult, ClaudeCodeHookResponse, CopilotHookResponse } from '../types';

/**
 * Format response for Claude Code
 *
 * Claude Code expects:
 * - Exit code 0 with empty/no output = allow
 * - Exit code 0 with JSON containing decision = use that decision
 * - Exit code 2 = block
 */
export function formatClaudeCodeResponse(result: EvaluationResult): ClaudeCodeHookResponse {
  const response: ClaudeCodeHookResponse = {};

  switch (result.decision) {
    case 'allow':
      // Empty response or explicit approve
      if (result.updatedInput) {
        response.updatedInput = result.updatedInput;
      }
      break;

    case 'deny':
      response.decision = 'block';
      response.reason = result.reason || 'Blocked by HET security policy';
      break;

    case 'ask':
      response.decision = 'ask';
      response.reason = result.reason || 'User confirmation required';
      break;
  }

  // Add additional context if provided
  if (result.additionalContext) {
    response.additionalContext = result.additionalContext;
  }

  // Add risk factors to additional context
  if (result.riskFactors && result.riskFactors.length > 0) {
    const riskInfo = `\n\nRisk factors identified by HET:\n- ${result.riskFactors.join('\n- ')}`;
    response.additionalContext = (response.additionalContext || '') + riskInfo;
  }

  return response;
}

/**
 * Format response for GitHub Copilot
 */
export function formatCopilotResponse(result: EvaluationResult): CopilotHookResponse {
  return {
    allow: result.decision === 'allow',
    message: result.reason,
    modifiedInput: result.updatedInput,
  };
}

/**
 * Format response based on source
 */
export function formatResponse(
  result: EvaluationResult,
  source: 'claude-code' | 'copilot'
): string {
  if (source === 'claude-code') {
    const response = formatClaudeCodeResponse(result);
    // Only output JSON if there's something to communicate
    if (response.decision || response.updatedInput || response.additionalContext) {
      return JSON.stringify(response);
    }
    // Empty output = allow
    return '';
  }

  return JSON.stringify(formatCopilotResponse(result));
}

/**
 * Get exit code for Claude Code
 */
export function getExitCode(result: EvaluationResult): number {
  switch (result.decision) {
    case 'allow':
      return 0;
    case 'deny':
      return 2; // Exit code 2 = block
    case 'ask':
      return 0; // Ask is communicated via JSON, not exit code
    default:
      return 0;
  }
}
