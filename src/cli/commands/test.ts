/**
 * Test Command - Test HET evaluation without blocking
 */

import chalk from 'chalk';
import { parseHookInput } from '../../hooks';
import { evaluate, initializeEvaluator } from '../../evaluator';
import { loadRulesFile, findRepoRulesFile, mergeRules } from '../../rules';
import { GLOBAL_RULES_PATH } from '../../config';
import { ToolType } from '../../types';

interface TestOptions {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Test command - evaluate a tool invocation without blocking
 */
export async function testCommand(input: string, options: TestOptions): Promise<void> {
  try {
    await initializeEvaluator();

    // Try to parse as JSON first
    let hookInput;
    try {
      hookInput = parseHookInput(input);
    } catch {
      // If not JSON, assume it's a bash command
      hookInput = parseHookInput(
        JSON.stringify({
          tool_name: 'Bash',
          tool_input: { command: input },
        })
      );
    }

    if (!hookInput) {
      console.error(chalk.red('Failed to parse input'));
      process.exit(1);
    }

    // Load rules
    const globalRules = loadRulesFile(GLOBAL_RULES_PATH);
    const repoRulesPath = findRepoRulesFile(process.cwd());
    const repoRules = repoRulesPath ? loadRulesFile(repoRulesPath) : [];
    const rules = mergeRules(globalRules, repoRules);

    // Evaluate
    const startTime = Date.now();
    const result = await evaluate(hookInput, rules);
    const evalTime = Date.now() - startTime;

    if (options.json) {
      console.log(JSON.stringify({ ...result, evaluationTimeMs: evalTime }, null, 2));
      return;
    }

    // Pretty print result
    console.log();
    console.log(chalk.bold('HET Evaluation Result'));
    console.log('─'.repeat(40));

    // Decision with color
    const decisionColor = {
      allow: chalk.green,
      deny: chalk.red,
      ask: chalk.yellow,
    };
    console.log(
      `${chalk.bold('Decision:')} ${decisionColor[result.decision](result.decision.toUpperCase())}`
    );

    console.log(`${chalk.bold('Confidence:')} ${(result.confidence * 100).toFixed(0)}%`);

    if (result.reason) {
      console.log(`${chalk.bold('Reason:')} ${result.reason}`);
    }

    if (result.matchedRule) {
      console.log(`${chalk.bold('Matched Rule:')} ${result.matchedRule}`);
    }

    if (result.riskFactors && result.riskFactors.length > 0) {
      console.log(`${chalk.bold('Risk Factors:')}`);
      for (const factor of result.riskFactors) {
        console.log(`  ${chalk.yellow('•')} ${factor}`);
      }
    }

    if (options.verbose) {
      console.log(`${chalk.bold('Evaluation Time:')} ${evalTime}ms`);
      console.log(`${chalk.bold('Rules Loaded:')} ${rules.length}`);
    }

    console.log();
  } catch (error) {
    console.error(chalk.red('Test failed:'), error);
    process.exit(1);
  }
}

/**
 * Quick test for a specific tool type
 */
export async function quickTestCommand(
  tool: string,
  input: string,
  options: TestOptions
): Promise<void> {
  const toolMap: Record<string, ToolType> = {
    bash: 'Bash',
    powershell: 'PowerShell',
    ps: 'PowerShell',
    pwsh: 'PowerShell',
    write: 'Write',
    edit: 'Edit',
    read: 'Read',
    webfetch: 'WebFetch',
    websearch: 'WebSearch',
    task: 'Task',
  };

  const toolType = toolMap[tool.toLowerCase()];
  if (!toolType) {
    console.error(chalk.red(`Unknown tool type: ${tool}`));
    console.log('Available tools: bash, powershell (ps/pwsh), write, edit, read, webfetch, websearch, task');
    process.exit(1);
  }

  // Build tool input based on tool type
  let toolInput: Record<string, unknown>;
  switch (toolType) {
    case 'Bash':
    case 'PowerShell':
      toolInput = { command: input };
      break;
    case 'Write':
    case 'Edit':
      toolInput = { file_path: input, content: '' };
      break;
    case 'Read':
      toolInput = { file_path: input };
      break;
    case 'WebFetch':
      toolInput = { url: input };
      break;
    case 'WebSearch':
      toolInput = { query: input };
      break;
    case 'Task':
      toolInput = { prompt: input };
      break;
    default:
      toolInput = { input };
  }

  const hookInput = JSON.stringify({
    tool_name: toolType,
    tool_input: toolInput,
  });

  await testCommand(hookInput, options);
}
