/**
 * Hook Parser - Parse and normalize hook inputs from different CLI sources
 */

import { HookInput, ClaudeCodeHookInput, CopilotHookInput, ToolType } from '../types';
import { logger } from '../utils/logger';

/**
 * Parse Claude Code hook input from stdin
 */
export function parseClaudeCodeInput(raw: string): HookInput | null {
  try {
    const parsed = JSON.parse(raw) as ClaudeCodeHookInput;

    // Validate required fields
    if (!parsed.tool_name || !parsed.tool_input) {
      logger.warn('Invalid Claude Code hook input: missing required fields');
      return null;
    }

    const toolName = normalizeToolName(parsed.tool_name);
    if (!toolName) {
      logger.warn(`Unknown tool name: ${parsed.tool_name}`);
      return null;
    }

    return {
      toolName,
      toolInput: parsed.tool_input as Record<string, unknown>,
      sessionId: parsed.session_id,
      workingDirectory: parsed.cwd,
      source: 'claude-code',
      rawInput: parsed,
    };
  } catch (error) {
    logger.error('Failed to parse Claude Code hook input', { error, raw });
    return null;
  }
}

/**
 * Parse GitHub Copilot hook input
 */
export function parseCopilotInput(raw: string): HookInput | null {
  try {
    const parsed = JSON.parse(raw) as CopilotHookInput;

    // Validate required fields
    if (!parsed.toolName || !parsed.toolInput) {
      logger.warn('Invalid Copilot hook input: missing required fields');
      return null;
    }

    const toolName = normalizeToolName(parsed.toolName);
    if (!toolName) {
      logger.warn(`Unknown tool name: ${parsed.toolName}`);
      return null;
    }

    return {
      toolName,
      toolInput: parsed.toolInput as Record<string, unknown>,
      sessionId: parsed.sessionId,
      workingDirectory: parsed.workingDirectory,
      source: 'copilot',
      rawInput: parsed,
    };
  } catch (error) {
    logger.error('Failed to parse Copilot hook input', { error, raw });
    return null;
  }
}

/**
 * Auto-detect and parse hook input
 */
export function parseHookInput(raw: string): HookInput | null {
  try {
    const parsed = JSON.parse(raw);

    // Detect source based on field names
    if ('tool_name' in parsed) {
      return parseClaudeCodeInput(raw);
    }

    if ('toolName' in parsed) {
      return parseCopilotInput(raw);
    }

    // Try to detect by other fields
    if ('hook_type' in parsed) {
      return parseClaudeCodeInput(raw);
    }

    if ('type' in parsed && parsed.type === 'preToolUse') {
      return parseCopilotInput(raw);
    }

    logger.warn('Could not detect hook input source format');
    return null;
  } catch (error) {
    logger.error('Failed to parse hook input', { error });
    return null;
  }
}

/**
 * Normalize tool name to standard format
 */
function normalizeToolName(name: string): ToolType | null {
  // Check for MCP tools first (pattern: mcp__<server>__<tool>)
  if (name.startsWith('mcp__') || name.startsWith('mcp-')) {
    return 'MCP';
  }

  const normalized = name.toLowerCase();

  const mapping: Record<string, ToolType> = {
    // Shell commands
    bash: 'Bash',
    shell: 'Bash',
    command: 'Bash',
    // PowerShell (Copilot on Windows)
    powershell: 'PowerShell',
    pwsh: 'PowerShell',
    ps: 'PowerShell',
    ps1: 'PowerShell',
    // File operations
    write: 'Write',
    writefile: 'Write',
    write_file: 'Write',
    create: 'Write',
    edit: 'Edit',
    editfile: 'Edit',
    edit_file: 'Edit',
    read: 'Read',
    readfile: 'Read',
    read_file: 'Read',
    view: 'Read',
    // Search
    glob: 'Glob',
    grep: 'Grep',
    search: 'Grep',
    // Web
    webfetch: 'WebFetch',
    web_fetch: 'WebFetch',
    fetch: 'WebFetch',
    websearch: 'WebSearch',
    web_search: 'WebSearch',
    // Agents
    task: 'Task',
    agent: 'Task',
    // Notebooks
    notebookedit: 'NotebookEdit',
    notebook_edit: 'NotebookEdit',
  };

  return mapping[normalized] || null;
}
