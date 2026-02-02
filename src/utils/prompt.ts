/**
 * Prompt Loader - Load and merge system prompts
 */

import * as fs from 'fs';
import * as path from 'path';
import { SECURITY_EVALUATION_PROMPT, HET_DIR } from '../config';
import { logger } from './logger';

const GLOBAL_PROMPT_PATH = path.join(HET_DIR, 'prompt.md');

/**
 * Load the global prompt if it exists
 */
export function loadGlobalPrompt(): string | null {
  if (!fs.existsSync(GLOBAL_PROMPT_PATH)) {
    return null;
  }

  try {
    return fs.readFileSync(GLOBAL_PROMPT_PATH, 'utf-8');
  } catch (error) {
    logger.warn('Failed to load global prompt', { error });
    return null;
  }
}

/**
 * Find and load a repository-specific prompt
 */
export function findRepoPrompt(workingDir: string): string | null {
  let current = workingDir;

  while (current !== path.dirname(current)) {
    const promptPath = path.join(current, '.het', 'prompt.md');
    if (fs.existsSync(promptPath)) {
      try {
        return fs.readFileSync(promptPath, 'utf-8');
      } catch (error) {
        logger.warn('Failed to load repo prompt', { error, path: promptPath });
        return null;
      }
    }

    // Check for .git to find repo root
    const gitPath = path.join(current, '.git');
    if (fs.existsSync(gitPath)) {
      const rootPromptPath = path.join(current, '.het', 'prompt.md');
      if (fs.existsSync(rootPromptPath)) {
        try {
          return fs.readFileSync(rootPromptPath, 'utf-8');
        } catch {
          return null;
        }
      }
      return null;
    }

    current = path.dirname(current);
  }

  return null;
}

/**
 * Build the complete system prompt by merging base, global, and repo prompts
 */
export function buildSystemPrompt(workingDir?: string): string {
  const parts: string[] = [SECURITY_EVALUATION_PROMPT];

  // Add global prompt if exists
  const globalPrompt = loadGlobalPrompt();
  if (globalPrompt) {
    parts.push('\n\n---\n\n## Global Custom Rules\n\n' + globalPrompt);
  }

  // Add repo prompt if exists and working directory is provided
  if (workingDir) {
    const repoPrompt = findRepoPrompt(workingDir);
    if (repoPrompt) {
      parts.push('\n\n---\n\n## Repository-Specific Rules\n\n' + repoPrompt);
    }
  }

  return parts.join('');
}
