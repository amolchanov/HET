/**
 * HET Configuration
 */

import * as path from 'path';
import * as os from 'os';
import { DaemonConfig } from '../types';

// Default paths
const HOME_DIR = os.homedir();
export const HET_DIR = path.join(HOME_DIR, '.het');
export const GLOBAL_RULES_PATH = path.join(HET_DIR, 'rules.yaml');
export const AUDIT_LOG_PATH = path.join(HET_DIR, 'audit.log');
export const REPO_RULES_FILENAME = '.het/rules.yaml';

// Default daemon configuration
export const DEFAULT_CONFIG: DaemonConfig = {
  port: 7483, // "HET3" on phone keypad
  host: '127.0.0.1',
  logLevel: 'info',
  timeoutMs: 10000,
  defaultOnTimeout: 'allow',
  cacheTtlSeconds: 300, // 5 minutes
  auditLogPath: AUDIT_LOG_PATH,
  globalRulesPath: GLOBAL_RULES_PATH,
};

// Security evaluation system prompt for LLM
export const SECURITY_EVALUATION_PROMPT = `You are a security evaluator for AI coding assistant tool invocations. Your job is to analyze tool calls and determine if they are safe to execute.

For each tool invocation, you must:
1. Identify potential security risks
2. Consider the context and intent
3. Make a decision: allow, deny, or ask (prompt user for confirmation)

Risk categories to consider:
- filesystem-danger: Destructive file operations, permission changes
- network-exfiltration: Sending sensitive data to external services
- credential-exposure: Commands that might expose secrets, tokens, passwords
- system-modification: Changes to system configuration
- package-installation: Installing untrusted packages

Be conservative but practical. Common development operations should be allowed.
Deny operations that could:
- Delete important files or directories
- Expose credentials or secrets
- Modify system security settings
- Send sensitive data to untrusted destinations

When uncertain, use "ask" to let the user decide.

Respond with JSON in this format:
{
  "decision": "allow" | "deny" | "ask",
  "reason": "explanation of decision",
  "confidence": 0.0-1.0,
  "riskFactors": ["list", "of", "identified", "risks"]
}`;

// Dangerous patterns for quick rule-based evaluation
export const DANGEROUS_PATTERNS = {
  bash: [
    { pattern: /rm\s+(-[rf]+\s+)*\/($|\s)/, reason: 'Recursive delete at root', action: 'deny' as const },
    { pattern: /rm\s+-rf?\s+~/, reason: 'Recursive delete in home directory', action: 'ask' as const },
    { pattern: />\s*\/dev\/sd[a-z]/, reason: 'Direct write to disk device', action: 'deny' as const },
    { pattern: /mkfs\./, reason: 'Filesystem formatting', action: 'deny' as const },
    { pattern: /dd\s+.*of=\/dev\//, reason: 'Direct disk write with dd', action: 'deny' as const },
    { pattern: /chmod\s+777/, reason: 'Overly permissive file permissions', action: 'ask' as const },
    { pattern: /chmod\s+\+s/, reason: 'Setting SUID bit', action: 'deny' as const },
    { pattern: /:(){ :|:& };:/, reason: 'Fork bomb detected', action: 'deny' as const },
    { pattern: /git\s+push.*--force/, reason: 'Force push can overwrite remote history', action: 'ask' as const },
    { pattern: /git\s+reset\s+--hard/, reason: 'Hard reset can lose uncommitted changes', action: 'ask' as const },
    { pattern: /curl.*\|\s*(ba)?sh/, reason: 'Piping remote script to shell', action: 'ask' as const },
    { pattern: /wget.*\|\s*(ba)?sh/, reason: 'Piping remote script to shell', action: 'ask' as const },
    { pattern: /eval\s*\$\(/, reason: 'Eval with command substitution', action: 'ask' as const },
    { pattern: /base64\s+-d.*\|\s*(ba)?sh/, reason: 'Executing base64-encoded commands', action: 'deny' as const },
    { pattern: /nc\s+-[el]/, reason: 'Netcat listener (potential backdoor)', action: 'deny' as const },
    { pattern: /ssh-keygen.*-f.*\/root/, reason: 'Generating SSH keys for root', action: 'deny' as const },
  ],
  write: [
    { pathPattern: /\.ssh\/(authorized_keys|id_rsa|config)/, reason: 'Modification of SSH configuration', action: 'deny' as const },
    { pathPattern: /\.(bashrc|zshrc|profile|bash_profile)$/, reason: 'Shell configuration modification', action: 'ask' as const },
    { pathPattern: /\.gitconfig$/, reason: 'Git configuration modification', action: 'ask' as const },
    { pathPattern: /\/etc\//, reason: 'System configuration modification', action: 'deny' as const },
    { pathPattern: /\.(env|env\.local|env\.production)$/, reason: 'Environment file modification', action: 'ask' as const },
    { pathPattern: /\.aws\/credentials$/, reason: 'AWS credentials modification', action: 'deny' as const },
    { pathPattern: /\.kube\/config$/, reason: 'Kubernetes config modification', action: 'deny' as const },
    { pathPattern: /cron/, reason: 'Cron job modification', action: 'deny' as const },
  ],
  webfetch: [
    { pattern: /file:\/\//, reason: 'Local file access via URL', action: 'deny' as const },
    { pattern: /169\.254\.169\.254/, reason: 'Cloud metadata endpoint access', action: 'deny' as const },
    { pattern: /localhost|127\.0\.0\.1/, reason: 'Local service access', action: 'ask' as const },
  ],
  read: [
    { pathPattern: /\.ssh\/(id_rsa|id_ed25519|id_ecdsa)$/, reason: 'Reading SSH private keys', action: 'deny' as const },
    { pathPattern: /\.aws\/credentials$/, reason: 'Reading AWS credentials', action: 'deny' as const },
    { pathPattern: /\.netrc$/, reason: 'Reading .netrc credentials', action: 'deny' as const },
    { pathPattern: /\/etc\/(passwd|shadow)$/, reason: 'Reading system password files', action: 'deny' as const },
    { pathPattern: /\.kube\/config$/, reason: 'Reading Kubernetes config', action: 'ask' as const },
    { pathPattern: /\.gnupg\//, reason: 'Reading GPG private data', action: 'deny' as const },
  ],
  glob: [
    { pathPattern: /\.ssh\//, reason: 'Searching in SSH directory', action: 'deny' as const },
    { pathPattern: /\.aws\//, reason: 'Searching in AWS config directory', action: 'deny' as const },
    { pathPattern: /\.gnupg\//, reason: 'Searching in GPG directory', action: 'deny' as const },
    { pathPattern: /\.config\/gh\//, reason: 'Searching in GitHub CLI config', action: 'ask' as const },
  ],
  task: [
    { pattern: /sudo|admin|root|elevated/i, reason: 'Task may request elevated privileges', action: 'ask' as const },
    { pattern: /install.*system|system.*install/i, reason: 'Task may install system-wide packages', action: 'ask' as const },
    { pattern: /delete.*all|remove.*all|clear.*all/i, reason: 'Task may perform bulk deletion', action: 'ask' as const },
  ],
  mcp: [
    { pattern: /filesystem.*write|write.*file/i, reason: 'MCP filesystem write operation', action: 'ask' as const },
    { pattern: /database.*drop|drop.*database|delete.*table/i, reason: 'MCP destructive database operation', action: 'deny' as const },
    { pattern: /execute.*sql|sql.*execute/i, reason: 'MCP SQL execution', action: 'ask' as const },
    { pattern: /send.*message|post.*message/i, reason: 'MCP external messaging', action: 'ask' as const },
  ],
};

// Secret patterns for redaction
export const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}(?=\s|$|")/g, replacement: '[REDACTED_AWS_SECRET]' },
  { name: 'GitHub Token', pattern: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { name: 'Generic API Key', pattern: /["\']?api[_-]?key["\']?\s*[:=]\s*["\']?[A-Za-z0-9_-]{20,}["\']?/gi, replacement: '[REDACTED_API_KEY]' },
  { name: 'Bearer Token', pattern: /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi, replacement: 'Bearer [REDACTED_JWT]' },
  { name: 'Password in URL', pattern: /:\/\/[^:]+:([^@]+)@/g, replacement: '://[USER]:[REDACTED]@' },
  { name: 'Generic Password', pattern: /["\']?password["\']?\s*[:=]\s*["\']?[^"'\s]+["\']?/gi, replacement: '[REDACTED_PASSWORD]' },
  { name: 'Generic Secret', pattern: /["\']?secret["\']?\s*[:=]\s*["\']?[^"'\s]+["\']?/gi, replacement: '[REDACTED_SECRET]' },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,}/g, replacement: '[REDACTED_SLACK_TOKEN]' },
  { name: 'Azure Key', pattern: /[A-Za-z0-9/+]{86}==/g, replacement: '[REDACTED_AZURE_KEY]' },
];
