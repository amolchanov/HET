/**
 * Install Command - Auto-setup hook configurations for Claude Code and Copilot
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

interface InstallOptions {
  force?: boolean;
  claude?: boolean;
  copilot?: boolean;
}

const HOME_DIR = os.homedir();

// Claude Code settings paths
const CLAUDE_CODE_SETTINGS_PATHS = {
  global: path.join(HOME_DIR, '.claude', 'settings.json'),
  project: '.claude/settings.local.json',
};

// GitHub Copilot hooks paths
const COPILOT_HOOKS_PATHS = {
  global: path.join(HOME_DIR, '.copilot', 'hooks'),
  project: '.copilot/hooks',
};

/**
 * Claude Code hook configuration
 */
const CLAUDE_CODE_HOOK_CONFIG = {
  hooks: {
    PreToolUse: [
      {
        matcher: '*',
        hooks: [
          {
            type: 'command',
            command: 'het evaluate --cli=claude-code',
          },
        ],
      },
    ],
  },
};

/**
 * Copilot hooks.json configuration
 */
const COPILOT_HOOKS_CONFIG = {
  version: 1,
  hooks: {
    preToolUse: [
      {
        type: 'command',
        bash: 'het evaluate --cli=copilot',
        powershell: 'het evaluate --cli=copilot',
        timeoutSec: 30,
      },
    ],
  },
};

/**
 * Install Claude Code hooks
 */
function installClaudeCodeHooks(options: InstallOptions): boolean {
  const settingsPath = CLAUDE_CODE_SETTINGS_PATHS.global;
  const settingsDir = path.dirname(settingsPath);

  console.log(chalk.dim(`Installing Claude Code hooks to ${settingsPath}...`));

  // Create directory if it doesn't exist
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  // Load existing settings or create new
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (error) {
      console.log(chalk.yellow('⚠ Could not parse existing settings, will backup and recreate'));
      const backupPath = `${settingsPath}.bak.${Date.now()}`;
      fs.renameSync(settingsPath, backupPath);
    }
  }

  // Check if hooks already exist
  if (settings.hooks && !options.force) {
    console.log(chalk.yellow('⚠ Claude Code hooks already configured'));
    console.log(chalk.dim('  Use --force to overwrite'));
    return false;
  }

  // Merge hook configuration
  settings = {
    ...settings,
    ...CLAUDE_CODE_HOOK_CONFIG,
  };

  // Write settings
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(chalk.green('✓') + ' Claude Code hooks installed');
  return true;
}

/**
 * Install Copilot hooks
 */
function installCopilotHooks(options: InstallOptions): boolean {
  const hooksDir = COPILOT_HOOKS_PATHS.global;
  const hookPath = path.join(hooksDir, 'hooks.json');

  console.log(chalk.dim(`Installing Copilot hooks to ${hookPath}...`));

  // Create directory if it doesn't exist
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // Check if hook already exists
  if (fs.existsSync(hookPath) && !options.force) {
    console.log(chalk.yellow('⚠ Copilot hooks already configured'));
    console.log(chalk.dim('  Use --force to overwrite'));
    return false;
  }

  // Write hooks.json configuration
  fs.writeFileSync(hookPath, JSON.stringify(COPILOT_HOOKS_CONFIG, null, 2));

  console.log(chalk.green('✓') + ' Copilot hooks installed');
  return true;
}

/**
 * Main install command
 */
export async function installCommand(options: InstallOptions): Promise<void> {
  console.log();
  console.log(chalk.red('  ╦ ╦╔═╗╔╦╗'));
  console.log(chalk.red('  ╠═╣║╣  ║ ') + chalk.bold(' Hook Installation'));
  console.log(chalk.red('  ╩ ╩╚═╝ ╩'));
  console.log('─'.repeat(40));
  console.log();

  const installClaude = options.claude || (!options.claude && !options.copilot);
  const installCopilotFlag = options.copilot || (!options.claude && !options.copilot);

  let success = true;

  if (installClaude) {
    try {
      installClaudeCodeHooks(options);
    } catch (error) {
      console.log(chalk.red('✗') + ' Failed to install Claude Code hooks');
      console.error(chalk.dim(String(error)));
      success = false;
    }
  }

  if (installCopilotFlag) {
    try {
      installCopilotHooks(options);
    } catch (error) {
      console.log(chalk.red('✗') + ' Failed to install Copilot hooks');
      console.error(chalk.dim(String(error)));
      success = false;
    }
  }

  console.log();

  if (success) {
    console.log(chalk.green('Installation complete!'));
    console.log();
    console.log('Next steps:');
    console.log(chalk.dim('  1. Start the HET daemon: ') + chalk.cyan('het daemon'));
    console.log(chalk.dim('  2. Test evaluation: ') + chalk.cyan('het test "rm -rf /"'));
    console.log(chalk.dim('  3. Create custom rules: ') + chalk.cyan('~/.het/rules.yaml'));
  } else {
    console.log(chalk.yellow('Installation completed with warnings'));
  }

  console.log();
}

/**
 * Uninstall hooks
 */
export async function uninstallCommand(options: InstallOptions): Promise<void> {
  console.log();
  console.log(chalk.bold.blue('HET Hook Uninstallation'));
  console.log('─'.repeat(40));
  console.log();

  const uninstallClaude = options.claude || (!options.claude && !options.copilot);
  const uninstallCopilot = options.copilot || (!options.claude && !options.copilot);

  if (uninstallClaude) {
    const settingsPath = CLAUDE_CODE_SETTINGS_PATHS.global;
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        delete settings.hooks;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log(chalk.green('✓') + ' Claude Code hooks removed');
      } catch (error) {
        console.log(chalk.red('✗') + ' Failed to remove Claude Code hooks');
      }
    } else {
      console.log(chalk.dim('Claude Code settings not found'));
    }
  }

  if (uninstallCopilot) {
    const hookPath = path.join(COPILOT_HOOKS_PATHS.global, 'hooks.json');
    if (fs.existsSync(hookPath)) {
      try {
        fs.unlinkSync(hookPath);
        console.log(chalk.green('✓') + ' Copilot hooks removed');
      } catch (error) {
        console.log(chalk.red('✗') + ' Failed to remove Copilot hooks');
      }
    } else {
      console.log(chalk.dim('Copilot hooks not found'));
    }
  }

  console.log();
}
