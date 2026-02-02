/**
 * Rule Matcher - Match tool invocations against rules
 */

import { Rule, ToolType, HookInput, EvaluationResult, RuleContext } from '../types';
import { DANGEROUS_PATTERNS } from '../config';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface MatchResult {
  matched: boolean;
  rule?: Rule;
  result?: EvaluationResult;
}

/**
 * Match a tool invocation against all rules
 */
export function matchRules(input: HookInput, rules: Rule[]): MatchResult {
  const toolName = input.toolName;
  const toolInput = input.toolInput;

  // First, check built-in dangerous patterns
  const builtInResult = checkBuiltInPatterns(toolName, toolInput);
  if (builtInResult.matched) {
    return builtInResult;
  }

  // Then check custom rules
  for (const rule of rules) {
    // Check if rule applies to this tool
    if (rule.tool) {
      const tools = Array.isArray(rule.tool) ? rule.tool : [rule.tool];
      if (!tools.includes(toolName)) {
        continue;
      }
    }

    // Check context conditions
    if (rule.context && !checkContext(rule.context, input)) {
      continue;
    }

    // Check pattern match
    if (rule.pattern) {
      const textToMatch = getTextToMatch(toolName, toolInput);
      if (textToMatch) {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          if (regex.test(textToMatch)) {
            logger.debug(`Rule matched: ${rule.name}`, { toolName, pattern: rule.pattern });
            return {
              matched: true,
              rule,
              result: {
                decision: rule.action,
                reason: rule.reason,
                confidence: 1.0,
                matchedRule: rule.name,
              },
            };
          }
        } catch (error) {
          logger.warn(`Invalid regex in rule "${rule.name}": ${rule.pattern}`);
        }
      }
    }

    // Check path pattern match
    if (rule.pathPattern) {
      const pathToMatch = getPathToMatch(toolName, toolInput);
      if (pathToMatch) {
        try {
          const regex = new RegExp(rule.pathPattern, 'i');
          if (regex.test(pathToMatch)) {
            logger.debug(`Rule path matched: ${rule.name}`, { toolName, pathPattern: rule.pathPattern });
            return {
              matched: true,
              rule,
              result: {
                decision: rule.action,
                reason: rule.reason,
                confidence: 1.0,
                matchedRule: rule.name,
              },
            };
          }
        } catch (error) {
          logger.warn(`Invalid path regex in rule "${rule.name}": ${rule.pathPattern}`);
        }
      }
    }
  }

  return { matched: false };
}

/**
 * Check built-in dangerous patterns
 */
function checkBuiltInPatterns(toolName: ToolType, toolInput: Record<string, unknown>): MatchResult {
  switch (toolName) {
    case 'Bash': {
      const command = toolInput.command as string;
      if (!command) return { matched: false };

      for (const { pattern, reason, action } of DANGEROUS_PATTERNS.bash) {
        if (pattern.test(command)) {
          return {
            matched: true,
            result: {
              decision: action,
              reason,
              confidence: 1.0,
              matchedRule: 'builtin:bash',
              riskFactors: [reason],
            },
          };
        }
      }
      break;
    }

    case 'PowerShell': {
      const command = (toolInput.command || toolInput.script || toolInput.code) as string;
      if (!command) return { matched: false };

      for (const { pattern, reason, action } of DANGEROUS_PATTERNS.powershell) {
        if (pattern.test(command)) {
          return {
            matched: true,
            result: {
              decision: action,
              reason,
              confidence: 1.0,
              matchedRule: 'builtin:powershell',
              riskFactors: [reason],
            },
          };
        }
      }
      break;
    }

    case 'Write':
    case 'Edit': {
      const filePath = (toolInput.file_path || toolInput.filePath || toolInput.path) as string;
      if (!filePath) return { matched: false };

      for (const { pathPattern, reason, action } of DANGEROUS_PATTERNS.write) {
        if (pathPattern.test(filePath)) {
          return {
            matched: true,
            result: {
              decision: action,
              reason,
              confidence: 1.0,
              matchedRule: 'builtin:write',
              riskFactors: [reason],
            },
          };
        }
      }
      break;
    }

    case 'Read': {
      const filePath = (toolInput.file_path || toolInput.filePath || toolInput.path) as string;
      if (!filePath) return { matched: false };

      for (const { pathPattern, reason, action } of DANGEROUS_PATTERNS.read) {
        if (pathPattern.test(filePath)) {
          return {
            matched: true,
            result: {
              decision: action,
              reason,
              confidence: 1.0,
              matchedRule: 'builtin:read',
              riskFactors: [reason],
            },
          };
        }
      }
      break;
    }

    case 'Glob':
    case 'Grep': {
      const searchPath = (toolInput.path || toolInput.pattern) as string;
      if (!searchPath) return { matched: false };

      for (const { pathPattern, reason, action } of DANGEROUS_PATTERNS.glob) {
        if (pathPattern.test(searchPath)) {
          return {
            matched: true,
            result: {
              decision: action,
              reason,
              confidence: 1.0,
              matchedRule: 'builtin:glob',
              riskFactors: [reason],
            },
          };
        }
      }
      break;
    }

    case 'WebFetch': {
      const url = toolInput.url as string;
      if (!url) return { matched: false };

      for (const { pattern, reason, action } of DANGEROUS_PATTERNS.webfetch) {
        if (pattern.test(url)) {
          return {
            matched: true,
            result: {
              decision: action,
              reason,
              confidence: 1.0,
              matchedRule: 'builtin:webfetch',
              riskFactors: [reason],
            },
          };
        }
      }
      break;
    }

    case 'Task': {
      const prompt = (toolInput.prompt || toolInput.description) as string;
      if (!prompt) return { matched: false };

      for (const { pattern, reason, action } of DANGEROUS_PATTERNS.task) {
        if (pattern.test(prompt)) {
          return {
            matched: true,
            result: {
              decision: action,
              reason,
              confidence: 0.8,
              matchedRule: 'builtin:task',
              riskFactors: [reason],
            },
          };
        }
      }
      break;
    }

    case 'MCP': {
      // For MCP, check both the tool name pattern and the input
      const toolStr = JSON.stringify(toolInput);
      for (const { pattern, reason, action } of DANGEROUS_PATTERNS.mcp) {
        if (pattern.test(toolStr)) {
          return {
            matched: true,
            result: {
              decision: action,
              reason,
              confidence: 0.9,
              matchedRule: 'builtin:mcp',
              riskFactors: [reason],
            },
          };
        }
      }
      break;
    }
  }

  return { matched: false };
}

/**
 * Get text to match for pattern rules
 */
function getTextToMatch(toolName: ToolType, toolInput: Record<string, unknown>): string | null {
  switch (toolName) {
    case 'Bash':
      return toolInput.command as string;
    case 'Write':
    case 'Edit':
      return (toolInput.content || toolInput.new_string || toolInput.newString) as string;
    case 'WebFetch':
    case 'WebSearch':
      return (toolInput.url || toolInput.query) as string;
    case 'Task':
      return toolInput.prompt as string;
    case 'Read':
    case 'Glob':
    case 'Grep':
      return (toolInput.pattern || toolInput.file_path || toolInput.path) as string;
    default:
      return JSON.stringify(toolInput);
  }
}

/**
 * Get path to match for path pattern rules
 */
function getPathToMatch(toolName: ToolType, toolInput: Record<string, unknown>): string | null {
  switch (toolName) {
    case 'Write':
    case 'Edit':
    case 'Read':
      return (toolInput.file_path || toolInput.filePath || toolInput.path) as string;
    case 'Glob':
    case 'Grep':
      return toolInput.path as string;
    default:
      return null;
  }
}

/**
 * Check context conditions
 */
function checkContext(context: RuleContext, input: HookInput): boolean {
  const workingDir = input.workingDirectory || process.cwd();

  // Check OS type
  if (context.osType) {
    const currentOs = process.platform === 'win32' ? 'windows' : process.platform;
    if (context.osType !== currentOs) {
      return false;
    }
  }

  // Check if specific file exists
  if (context.hasFile) {
    const filePath = path.resolve(workingDir, context.hasFile);
    if (!fs.existsSync(filePath)) {
      return false;
    }
  }

  // Check if in specific directory
  if (context.inDirectory) {
    if (!workingDir.includes(context.inDirectory)) {
      return false;
    }
  }

  // Check if not in specific directory
  if (context.notInDirectory) {
    if (workingDir.includes(context.notInDirectory)) {
      return false;
    }
  }

  return true;
}
