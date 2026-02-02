/**
 * Rule Parser - YAML rule file loading and parsing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Rule, RulesFile, ToolType, RuleAction, RuleCategory } from '../types';
import { logger } from '../utils/logger';

/**
 * Load and parse a rules file
 */
export function loadRulesFile(filePath: string): Rule[] {
  if (!fs.existsSync(filePath)) {
    logger.debug(`Rules file not found: ${filePath}`);
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content) as RulesFile;

    if (!parsed || !parsed.rules || !Array.isArray(parsed.rules)) {
      logger.warn(`Invalid rules file format: ${filePath}`);
      return [];
    }

    // Validate and normalize rules
    const rules: Rule[] = [];
    for (const rule of parsed.rules) {
      const validatedRule = validateRule(rule);
      if (validatedRule) {
        rules.push(validatedRule);
      }
    }

    logger.info(`Loaded ${rules.length} rules from ${filePath}`);
    return rules;
  } catch (error) {
    logger.error(`Failed to load rules file: ${filePath}`, { error });
    return [];
  }
}

/**
 * Validate a single rule
 */
function validateRule(rule: unknown): Rule | null {
  if (!rule || typeof rule !== 'object') {
    return null;
  }

  const r = rule as Record<string, unknown>;

  // Required fields
  if (!r.name || typeof r.name !== 'string') {
    logger.warn('Rule missing required field: name');
    return null;
  }

  if (!r.action || !isValidAction(r.action as string)) {
    logger.warn(`Rule "${r.name}" has invalid action: ${r.action}`);
    return null;
  }

  if (!r.reason || typeof r.reason !== 'string') {
    logger.warn(`Rule "${r.name}" missing required field: reason`);
    return null;
  }

  // At least one pattern must be specified
  if (!r.pattern && !r.pathPattern && !r.path_pattern) {
    logger.warn(`Rule "${r.name}" must have pattern or pathPattern`);
    return null;
  }

  // Validate tool if specified
  let tool: ToolType | ToolType[] | undefined;
  if (r.tool) {
    if (Array.isArray(r.tool)) {
      tool = r.tool.filter(isValidTool) as ToolType[];
    } else if (isValidTool(r.tool as string)) {
      tool = r.tool as ToolType;
    }
  }

  return {
    name: r.name as string,
    tool,
    pattern: r.pattern as string | undefined,
    pathPattern: (r.pathPattern || r.path_pattern) as string | undefined,
    action: r.action as RuleAction,
    reason: r.reason as string,
    category: isValidCategory(r.category as string) ? (r.category as RuleCategory) : 'general',
    context: r.context as Rule['context'],
    enabled: r.enabled !== false, // Default to enabled
  };
}

function isValidAction(action: string): action is RuleAction {
  return ['allow', 'deny', 'ask'].includes(action);
}

function isValidTool(tool: string): tool is ToolType {
  return [
    'Bash',
    'PowerShell',
    'Write',
    'Edit',
    'Read',
    'Glob',
    'Grep',
    'WebFetch',
    'WebSearch',
    'Task',
    'NotebookEdit',
    'MCP',
  ].includes(tool);
}

function isValidCategory(category: string): category is RuleCategory {
  return [
    'filesystem-danger',
    'network-exfiltration',
    'credential-exposure',
    'system-modification',
    'package-installation',
    'general',
  ].includes(category);
}

/**
 * Find repository rules file from a working directory
 */
export function findRepoRulesFile(workingDir: string): string | null {
  // Look for .het/rules.yaml in working directory and parent directories
  let current = workingDir;

  while (current !== path.dirname(current)) {
    const rulesPath = path.join(current, '.het', 'rules.yaml');
    if (fs.existsSync(rulesPath)) {
      return rulesPath;
    }

    // Also check for .git to find repo root
    const gitPath = path.join(current, '.git');
    if (fs.existsSync(gitPath)) {
      // This is the repo root, check once more and stop
      const rootRulesPath = path.join(current, '.het', 'rules.yaml');
      return fs.existsSync(rootRulesPath) ? rootRulesPath : null;
    }

    current = path.dirname(current);
  }

  return null;
}

/**
 * Merge rules with precedence (later rules override earlier)
 */
export function mergeRules(globalRules: Rule[], repoRules: Rule[]): Rule[] {
  // Repo rules override global rules with the same name
  const ruleMap = new Map<string, Rule>();

  for (const rule of globalRules) {
    ruleMap.set(rule.name, rule);
  }

  for (const rule of repoRules) {
    ruleMap.set(rule.name, rule);
  }

  return Array.from(ruleMap.values()).filter((r) => r.enabled !== false);
}
