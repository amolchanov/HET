/**
 * HET Type Definitions
 */

// Tool types supported by HET
export type ToolType =
  | 'Bash'
  | 'PowerShell'
  | 'Write'
  | 'Edit'
  | 'Read'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'WebSearch'
  | 'Task'
  | 'NotebookEdit'
  | 'MCP'; // MCP tools (mcp__<server>__<tool>)

// Decision types
export type Decision = 'allow' | 'deny' | 'ask';

// Rule action types
export type RuleAction = Decision;

// Rule categories
export type RuleCategory =
  | 'filesystem-danger'
  | 'network-exfiltration'
  | 'credential-exposure'
  | 'system-modification'
  | 'package-installation'
  | 'general';

// Rule definition
export interface Rule {
  name: string;
  tool?: ToolType | ToolType[];
  pattern?: string;
  pathPattern?: string;
  action: RuleAction;
  reason: string;
  category?: RuleCategory;
  context?: RuleContext;
  enabled?: boolean;
}

// Context conditions for rules
export interface RuleContext {
  hasFile?: string;
  inDirectory?: string;
  notInDirectory?: string;
  osType?: 'windows' | 'linux' | 'darwin';
}

// Rules file structure
export interface RulesFile {
  version: number;
  rules: Rule[];
}

// Hook input from Claude Code
export interface ClaudeCodeHookInput {
  hook_type: 'pre_tool_use';
  tool_name: string;
  tool_input: Record<string, unknown>;
  session_id?: string;
  cwd?: string;
  env?: Record<string, string>;
}

// Hook input from GitHub Copilot
export interface CopilotHookInput {
  type: 'preToolUse';
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId?: string;
  workingDirectory?: string;
}

// Unified hook input
export interface HookInput {
  toolName: ToolType;
  toolInput: Record<string, unknown>;
  sessionId?: string;
  workingDirectory?: string;
  source: 'claude-code' | 'copilot';
  rawInput: ClaudeCodeHookInput | CopilotHookInput;
}

// Evaluation result
export interface EvaluationResult {
  decision: Decision;
  reason?: string;
  confidence: number;
  matchedRule?: string;
  riskFactors?: string[];
  updatedInput?: Record<string, unknown>;
  additionalContext?: string;
}

// Claude Code hook response
export interface ClaudeCodeHookResponse {
  decision?: 'approve' | 'block' | 'ask';
  reason?: string;
  updatedInput?: Record<string, unknown>;
  additionalContext?: string;
}

// Copilot hook response
export interface CopilotHookResponse {
  allow: boolean;
  message?: string;
  modifiedInput?: Record<string, unknown>;
}

// Audit log entry
export interface AuditLogEntry {
  timestamp: string;
  sessionId?: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  decision: Decision;
  reason?: string;
  confidence: number;
  matchedRule?: string;
  source: 'claude-code' | 'copilot';
  evaluationTimeMs: number;
}

// Daemon configuration
export interface DaemonConfig {
  port: number;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  timeoutMs: number;
  defaultOnTimeout: Decision;
  cacheTtlSeconds: number;
  auditLogPath: string;
  globalRulesPath: string;
}

// Secret pattern for redaction
export interface SecretPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

// Cache entry
export interface CacheEntry {
  result: EvaluationResult;
  timestamp: number;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  rulesLoaded: number;
  evaluationsCount: number;
  lastEvaluation?: string;
}
