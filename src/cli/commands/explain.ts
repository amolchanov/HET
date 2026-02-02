/**
 * Explain Command - Show detailed risk analysis for a command
 */

import chalk from 'chalk';
import { parseHookInput } from '../../hooks';
import { evaluate, initializeEvaluator } from '../../evaluator';
import { loadRulesFile, findRepoRulesFile, mergeRules, matchRules } from '../../rules';
import { GLOBAL_RULES_PATH, DANGEROUS_PATTERNS } from '../../config';
import { redactSecrets, containsSecrets } from '../../utils/secrets';
import { HookInput } from '../../types';

/**
 * Explain command - show detailed analysis of a command
 */
export async function explainCommand(command: string): Promise<void> {
  try {
    await initializeEvaluator();

    // Parse as bash command
    const hookInput = parseHookInput(
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command },
        cwd: process.cwd(),
      })
    );

    if (!hookInput) {
      console.error(chalk.red('Failed to parse command'));
      process.exit(1);
    }

    // Load rules
    const globalRules = loadRulesFile(GLOBAL_RULES_PATH);
    const repoRulesPath = findRepoRulesFile(process.cwd());
    const repoRules = repoRulesPath ? loadRulesFile(repoRulesPath) : [];
    const rules = mergeRules(globalRules, repoRules);

    console.log();
    console.log(chalk.bold.blue('HET Security Analysis'));
    console.log('═'.repeat(50));
    console.log();

    // Show the command (redacted if contains secrets)
    console.log(chalk.bold('Command:'));
    if (containsSecrets(command)) {
      const { redactedText, secretsFound } = redactSecrets(command);
      console.log(`  ${chalk.dim(redactedText)}`);
      console.log();
      console.log(chalk.yellow(`  ⚠ Secrets detected: ${secretsFound.join(', ')}`));
    } else {
      console.log(`  ${chalk.dim(command)}`);
    }
    console.log();

    // Check built-in patterns
    console.log(chalk.bold('Built-in Pattern Analysis:'));
    const patternMatches = analyzeBuiltInPatterns(command);
    if (patternMatches.length > 0) {
      for (const match of patternMatches) {
        console.log(`  ${chalk.red('✗')} ${match}`);
      }
    } else {
      console.log(`  ${chalk.green('✓')} No built-in dangerous patterns detected`);
    }
    console.log();

    // Check custom rules
    console.log(chalk.bold('Custom Rule Analysis:'));
    const ruleMatch = matchRules(hookInput, rules);
    if (ruleMatch.matched && ruleMatch.rule) {
      console.log(`  ${chalk.yellow('!')} Matched rule: ${ruleMatch.rule.name}`);
      console.log(`  ${chalk.dim('  Action:')} ${ruleMatch.rule.action}`);
      console.log(`  ${chalk.dim('  Reason:')} ${ruleMatch.rule.reason}`);
    } else {
      console.log(`  ${chalk.green('✓')} No custom rules matched`);
    }
    console.log();

    // Full evaluation
    console.log(chalk.bold('Full Evaluation:'));
    const result = await evaluate(hookInput, rules);

    const decisionIcon = {
      allow: chalk.green('✓'),
      deny: chalk.red('✗'),
      ask: chalk.yellow('?'),
    };

    console.log(`  Decision: ${decisionIcon[result.decision]} ${result.decision.toUpperCase()}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);

    if (result.reason) {
      console.log(`  Reason: ${result.reason}`);
    }

    if (result.riskFactors && result.riskFactors.length > 0) {
      console.log();
      console.log(chalk.bold('Risk Factors:'));
      for (const factor of result.riskFactors) {
        console.log(`  ${chalk.yellow('•')} ${factor}`);
      }
    }

    console.log();

    // Recommendations
    console.log(chalk.bold('Recommendations:'));
    const recommendations = getRecommendations(command, result);
    if (recommendations.length > 0) {
      for (const rec of recommendations) {
        console.log(`  ${chalk.cyan('→')} ${rec}`);
      }
    } else {
      console.log(`  ${chalk.green('✓')} Command appears safe to execute`);
    }

    console.log();
  } catch (error) {
    console.error(chalk.red('Explain failed:'), error);
    process.exit(1);
  }
}

/**
 * Analyze command against built-in patterns
 */
function analyzeBuiltInPatterns(command: string): string[] {
  const matches: string[] = [];

  for (const { pattern, reason } of DANGEROUS_PATTERNS.bash) {
    if (pattern.test(command)) {
      matches.push(reason);
    }
  }

  return matches;
}

/**
 * Get recommendations based on analysis
 */
function getRecommendations(
  command: string,
  result: { decision: string; riskFactors?: string[] }
): string[] {
  const recommendations: string[] = [];

  // Based on patterns detected
  if (command.includes('rm -rf')) {
    recommendations.push('Consider using rm -ri for interactive confirmation');
    recommendations.push('Double-check the path before executing');
  }

  if (command.includes('chmod 777')) {
    recommendations.push('Use more restrictive permissions (e.g., 755 for directories, 644 for files)');
  }

  if (command.includes('--force')) {
    recommendations.push('Consider removing --force flag unless absolutely necessary');
  }

  if (command.includes('curl') && command.includes('|')) {
    recommendations.push('Download the script first and review it before executing');
  }

  if (containsSecrets(command)) {
    recommendations.push('Avoid including secrets directly in commands');
    recommendations.push('Use environment variables or secret managers instead');
  }

  // Based on decision
  if (result.decision === 'ask') {
    recommendations.push('This command requires user confirmation before execution');
  }

  if (result.decision === 'deny') {
    recommendations.push('This command is blocked by security policy');
    recommendations.push('Review and modify the command or contact your administrator');
  }

  return recommendations;
}
