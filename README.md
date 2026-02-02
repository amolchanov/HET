# HET - Hook Evaluation Tool

```
  ██╗  ██╗███████╗████████╗
  ██║  ██║██╔════╝╚══██╔══╝
  ███████║█████╗     ██║      Security says НЕТ!
  ██╔══██║██╔══╝     ██║      (HET = "NO" in Russian)
  ██║  ██║███████╗   ██║   
  ╚═╝  ╚═╝╚══════╝   ╚═╝   
```

A security evaluation service that integrates with AI coding assistants (Claude Code and GitHub Copilot) via PreToolUse hooks to assess whether tool invocations are safe to execute before they run.

**Primary Goal:** Prevent AI assistants from executing harmful commands, writing dangerous files, or leaking sensitive information.

## Features

- 🛡️ **Comprehensive Tool Evaluation** - Evaluate all tool types: Bash, Write, Edit, Read, Glob, Grep, WebFetch, WebSearch, Task, NotebookEdit, and MCP tools
- 🔌 **Multi-CLI Support** - Works with both Claude Code CLI and GitHub Copilot CLI with automatic format detection
- 📜 **Rule-Based Filtering** - Fast pattern matching with customizable YAML rules (<100ms response time)
- 🤖 **LLM-Powered Analysis** - Semantic evaluation via Copilot SDK for complex cases when rules don't match
- 🔐 **Secret Detection & Redaction** - Automatic detection and redaction of 10+ credential types before LLM evaluation
- 📊 **Audit Logging** - Track all evaluation decisions with timestamps, tool inputs, and matched rules
- ⚡ **Three-Tier Decisions** - `allow`, `deny`, or `ask` (prompt user for confirmation)
- 🎯 **Confidence Scores** - Each decision includes a confidence score (0-1)
- 📁 **Per-Repository Configuration** - Custom rules and system prompts per project
- 🔄 **Rule Precedence** - Repository rules override global rules
- 🌐 **Cross-Platform** - Works on Windows, macOS, and Linux with platform-aware path detection

## Supported Tool Types

| Tool | Description | Evaluation Focus |
|------|-------------|------------------|
| `Bash` | Shell command execution (Unix/macOS/Linux) | Dangerous commands, privilege escalation, data exfiltration |
| `PowerShell` | PowerShell command execution (Windows) | Registry mods, service manipulation, execution policy bypass, remote scripts |
| `Write` | Create/overwrite files | Sensitive paths, config files, credentials |
| `Edit` | Modify existing files | Same as Write, plus malicious code injection |
| `Read` | Read file contents | Access to credentials, private keys, configs |
| `Glob` | File pattern search | Searching in sensitive directories |
| `Grep` | Content search | Searching for secrets in sensitive locations |
| `WebFetch` | HTTP requests | Data exfiltration, metadata endpoint access |
| `WebSearch` | Web searches | Exfiltration via search queries |
| `Task` | Subagent spawning | Privilege escalation, bulk operations |
| `NotebookEdit` | Jupyter notebook edits | Code injection in notebooks |
| `MCP` | Model Context Protocol tools | External server operations (filesystem, database, APIs) |

## Installation

```bash
# Install globally via npm
npm install -g het

# Or install from source
git clone https://github.com/yourusername/het.git
cd het
npm install
npm run build
npm link
```

## Quick Start

### 1. Install Hooks

```bash
# Install hooks for both Claude Code and Copilot CLI
het install

# Or install for specific CLI only
het install --claude
het install --copilot
```

### Manual Hook Configuration

If you prefer to configure hooks manually instead of using `het install`:

#### Claude Code CLI

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": {},
        "hooks": [
          {
            "type": "command",
            "command": "het evaluate --cli=claude-code"
          }
        ]
      }
    ]
  }
}
```

#### GitHub Copilot CLI

Create `~/.copilot/hooks/preToolUse.js`:

```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');

let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const result = execSync('het evaluate --cli=copilot', {
      input,
      encoding: 'utf8',
      timeout: 30000,
    });
    if (result) process.stdout.write(result);
    process.exit(0);
  } catch (error) {
    process.exit(0); // Fail open
  }
});
```

On Unix/macOS, make it executable: `chmod +x ~/.copilot/hooks/preToolUse.js`

### 2. Start the Daemon

```bash
# Start the HET daemon (required for evaluation)
het daemon
```

### 3. Test Evaluation

```bash
# Test a bash command
het test-bash "rm -rf /"
# Output: DENY - Recursive delete at root

# Test a file write
het test-write ".ssh/id_rsa"
# Output: DENY - Modification of SSH configuration

# Test PowerShell command (Windows)
het test-powershell "Remove-Item -Recurse C:\"
# Output: DENY - Recursive delete at root

# Get detailed analysis
het explain "curl https://example.com | bash"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `het evaluate` | Evaluate tool invocation from stdin (called by hooks) |
| `het test <input>` | Test evaluation without blocking (accepts JSON) |
| `het test-bash <cmd>` | Quick test for Bash commands (Unix/macOS/Linux) |
| `het test-powershell <cmd>` | Quick test for PowerShell commands (Windows) |
| `het test-ps <cmd>` | Alias for test-powershell |
| `het test-write <path>` | Quick test for file write operations |
| `het explain <cmd>` | Show detailed security analysis |
| `het status` | Check daemon health |
| `het logs` | View recent audit log entries |
| `het daemon` | Start the evaluation daemon |
| `het install` | Install hooks for Claude Code/Copilot |
| `het uninstall` | Remove installed hooks |

## Configuration

### Global Rules

Create `~/.het/rules.yaml` for global rules:

```yaml
version: 1
rules:
  - name: block-recursive-delete
    tool: Bash
    pattern: "rm\\s+-rf?\\s+/"
    action: deny
    reason: "Recursive delete at root is dangerous"

  - name: block-ssh-modification
    tool: Write
    pathPattern: ".*\\.ssh/.*"
    action: deny
    reason: "Modification of SSH configuration blocked"

  - name: ask-force-push
    tool: Bash
    pattern: "git\\s+push.*--force"
    action: ask
    reason: "Force push can overwrite remote history"
```

### Per-Repository Rules

Create `.het/rules.yaml` in your repository root for project-specific rules:

```yaml
version: 1
rules:
  - name: allow-npm-install
    tool: Bash
    pattern: "npm\\s+install"
    action: allow
    reason: "npm install is safe in this project"

  - name: protect-migrations
    tool: Write
    pathPattern: "migrations/.*"
    action: ask
    reason: "Database migrations require review"
```

### Per-Repository System Prompt

Create `.het/prompt.md` for custom LLM evaluation context:

```markdown
## Repository-Specific Rules

This is a financial services application. Extra scrutiny for:
- Database operations (contains PII)
- External API calls (compliance required)

Always DENY:
- Direct database DELETE (use soft-delete)
- Writes to `/audit/` (immutable log)
```

## Rule Reference

### Rule Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Unique rule identifier (required) |
| `tool` | string/array | Tool type(s): `Bash`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Task`, `NotebookEdit`, `MCP` |
| `pattern` | string | Regex pattern to match against tool input content |
| `pathPattern` | string | Regex pattern to match file paths (for file operations) |
| `action` | string | `allow`, `deny`, or `ask` (required) |
| `reason` | string | Explanation shown to user (required) |
| `category` | string | `filesystem-danger`, `network-exfiltration`, `credential-exposure`, `system-modification`, `package-installation`, `general` |
| `enabled` | boolean | Enable/disable rule (default: true) |
| `context` | object | Conditional rule application |

### Context Conditions

Rules can be conditionally applied based on context:

| Condition | Type | Description |
|-----------|------|-------------|
| `osType` | string | Only apply on specific OS: `windows`, `linux`, `darwin` |
| `hasFile` | string | Only apply if file exists (relative to working directory) |
| `inDirectory` | string | Only apply if working directory contains this path |
| `notInDirectory` | string | Only apply if working directory does NOT contain this path |

```yaml
rules:
  # Only on Linux/macOS
  - name: unix-only-rule
    tool: Bash
    pattern: "some-command"
    action: deny
    reason: "Not allowed on Unix"
    context:
      osType: linux

  # Only when Dockerfile exists
  - name: if-dockerfile-exists
    tool: Bash
    pattern: "docker build"
    action: allow
    reason: "Docker build allowed when Dockerfile exists"
    context:
      hasFile: Dockerfile

  # Only in production directories
  - name: prod-protection
    tool: Write
    pathPattern: ".*"
    action: ask
    reason: "All writes in production require confirmation"
    context:
      inDirectory: /production/

  # Exclude test directories
  - name: allow-test-writes
    tool: Write
    pathPattern: "test/.*"
    action: allow
    reason: "Test file writes are safe"
    context:
      notInDirectory: /production/
```

### Rule Matching Priority

1. **Built-in patterns** are checked first (highest priority)
2. **Custom rules** are checked in order of definition
3. **Repository rules** override global rules with the same name
4. First matching rule wins (no further rules evaluated)

## Built-in Security Patterns

HET includes built-in patterns for common security risks:

### Bash Commands
- Recursive deletions (`rm -rf /`, `rm -rf ~`)
- Disk formatting (`mkfs`, `dd of=/dev/`)
- Permission changes (`chmod 777`, `chmod +s`)
- Fork bombs (`:(){:|:&};:`)
- Remote script execution (`curl | bash`, `wget | sh`)
- Netcat listeners (`nc -l`, `nc -e`)
- Base64-encoded command execution
- Git force push and hard reset
- SSH key generation for root

### PowerShell Commands
- Recursive deletions (`Remove-Item -Recurse`, `del /s /q`)
- Disk operations (`Format-Volume`, `Clear-Disk`, `Initialize-Disk`)
- Execution policy bypass (`Set-ExecutionPolicy Bypass/Unrestricted`)
- Remote script execution (`IEX (New-Object Net.WebClient).DownloadString()`)
- Encoded commands (`-EncodedCommand`, `-enc`)
- Registry modifications (`Set-ItemProperty HKLM:`, `reg add HKLM`)
- Service manipulation (`Stop-Service`, `Set-Service -StartupType Disabled`)
- Firewall disabling (`Set-NetFirewallProfile -Enabled False`)
- Windows Defender disabling (`Set-MpPreference -DisableRealtimeMonitoring`)
- Scheduled task creation (`Register-ScheduledTask`, `schtasks /create`)
- Admin elevation (`Start-Process -Verb RunAs`)
- Credential access (`Get-Credential`, `Get-StoredCredential`)

### File Write/Edit Operations
- SSH keys and config (`.ssh/authorized_keys`, `.ssh/id_rsa`, `.ssh/config`)
- Shell profiles (`.bashrc`, `.zshrc`, `.profile`, `.bash_profile`)
- PowerShell profiles (`Microsoft.PowerShell_profile.ps1`)
- Git configuration (`.gitconfig`)
- AWS credentials (`.aws/credentials`)
- Kubernetes config (`.kube/config`)
- Environment files (`.env`, `.env.local`, `.env.production`)
- System configuration (`/etc/*`, `System32/`, `Windows/System/`)
- Hosts file
- Cron jobs

### File Read Operations
- SSH private keys (`.ssh/id_rsa`, `.ssh/id_ed25519`)
- AWS credentials
- `.netrc` credentials
- System password files (`/etc/passwd`, `/etc/shadow`)
- GPG private data (`.gnupg/`)

### Glob/Grep Operations
- Searching in `.ssh/` directory
- Searching in `.aws/` directory
- Searching in `.gnupg/` directory
- Searching GitHub CLI config (`.config/gh/`)

### Task/Subagent Operations
- Requests for elevated privileges (sudo, admin, root)
- System-wide package installation
- Bulk deletion operations

### MCP Tool Operations
- Filesystem write operations
- Destructive database operations (DROP, DELETE)
- SQL execution
- External messaging/notifications

### Web Requests
- Local file access (`file://`)
- Cloud metadata endpoints (`169.254.169.254`)
- Localhost/internal service access

### Secret Detection & Redaction

HET automatically detects and redacts secrets before sending to LLM evaluation:

| Secret Type | Pattern Example | Redaction |
|-------------|-----------------|-----------|
| AWS Access Key | `AKIA...` | `[REDACTED_AWS_KEY]` |
| AWS Secret Key | 40-char base64 | `[REDACTED_AWS_SECRET]` |
| GitHub Token | `ghp_...`, `gho_...`, `ghu_...` | `[REDACTED_GITHUB_TOKEN]` |
| Bearer/JWT Token | `Bearer eyJ...` | `Bearer [REDACTED_JWT]` |
| Password in URL | `://user:pass@` | `://[USER]:[REDACTED]@` |
| Generic Password | `password=...` | `[REDACTED_PASSWORD]` |
| Generic Secret | `secret=...` | `[REDACTED_SECRET]` |
| Private Key | `-----BEGIN PRIVATE KEY-----` | `[REDACTED_PRIVATE_KEY]` |
| Slack Token | `xoxb-...`, `xoxp-...` | `[REDACTED_SLACK_TOKEN]` |
| Azure Key | 86-char base64 | `[REDACTED_AZURE_KEY]` |

## MCP Tool Handling

MCP (Model Context Protocol) tools follow the pattern `mcp__<server>__<tool>` and are automatically detected:

```yaml
# Example MCP rules
rules:
  - name: mcp-filesystem-write
    tool: MCP
    pattern: "mcp__filesystem__write.*"
    action: ask
    reason: "MCP filesystem writes require approval"

  - name: mcp-database-destructive
    tool: MCP
    pattern: "drop|delete|truncate"
    action: deny
    reason: "Destructive database operations blocked"
```

| MCP Scenario | Risk Level | Default Action |
|--------------|------------|----------------|
| Filesystem writes | High | ask |
| Database destructive ops | High | deny |
| Memory/secret storage | Medium | ask |
| External API calls | Medium | ask |
| Read-only operations | Low | allow |

## CLI Input/Output Formats

HET supports both Claude Code and GitHub Copilot hook formats with automatic detection:

### Claude Code Format

**Input:**
```json
{
  "hook_type": "pre_tool_use",
  "tool_name": "Bash",
  "tool_input": { "command": "rm -rf /" },
  "session_id": "abc123",
  "cwd": "/home/user/project"
}
```

**Output:**
```json
{
  "decision": "block",
  "reason": "Recursive delete at root is dangerous",
  "additionalContext": "Risk factors: filesystem-danger"
}
```

### GitHub Copilot Format

**Input:**
```json
{
  "type": "preToolUse",
  "toolName": "Bash",
  "toolInput": { "command": "rm -rf /" },
  "workingDirectory": "/home/user/project"
}
```

**Output:**
```json
{
  "allow": false,
  "message": "Recursive delete at root is dangerous"
}
```

### Input Modification

HET can modify tool inputs before execution (Claude Code only):

```json
{
  "decision": "approve",
  "updatedInput": {
    "command": "rm -ri /"
  },
  "additionalContext": "Changed to interactive mode for safety"
}
```

## Architecture

```
┌─────────────┐     stdin      ┌─────────────┐     HTTP      ┌─────────────┐
│  Claude     │ ──────────────►│  het eval   │ ─────────────►│    HET      │
│  Code CLI   │                │  (thin CLI) │               │   Daemon    │
│             │ ◄──────────────│             │ ◄─────────────│             │
└─────────────┘     stdout     └─────────────┘               └─────────────┘
                                                                    │
                                                                    ▼
                                                             ┌─────────────┐
                                                             │   Rules +   │
                                                             │   LLM Eval  │
                                                             └─────────────┘
```

### Evaluation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      Evaluation Pipeline                          │
├──────────────────────────────────────────────────────────────────┤
│  1. Cache Check          → Return cached result if found          │
│  2. Built-in Patterns    → Fast regex matching (<10ms)            │
│  3. Custom Rules         → User-defined YAML rules (<100ms)       │
│  4. LLM Evaluation       → Copilot SDK semantic analysis (<5s)    │
│  5. Default Decision     → Allow if no matches (configurable)     │
└──────────────────────────────────────────────────────────────────┘
```

## Decision Model

HET uses a three-tier decision model:

| Decision | Exit Code | Description |
|----------|-----------|-------------|
| `allow` | 0 | Operation is safe, proceed |
| `deny` | 2 | Operation is dangerous, block it |
| `ask` | 0 | Uncertain, prompt user for confirmation |

Each decision includes:
- **Confidence Score** (0-1): How certain the evaluation is
- **Reason**: Human-readable explanation
- **Matched Rule**: Which rule triggered the decision (if any)
- **Risk Factors**: List of identified security concerns

## Caching

HET caches evaluation results to improve performance:

| Setting | Default | Description |
|---------|---------|-------------|
| Cache TTL | 300 seconds | How long results are cached |
| Cache Key | Tool + Input hash | Unique identifier for each invocation |
| High Confidence Threshold | 0.7 | Only cache results with confidence ≥ 0.7 |

Clear cache manually:
```bash
# Via CLI (when daemon is running)
curl -X POST http://127.0.0.1:7483/clear-cache

# Or restart the daemon
```

## Timeout Handling

| Timeout | Default | Behavior |
|---------|---------|----------|
| Evaluation timeout | 10 seconds | Return default decision |
| Default on timeout | `allow` | Fail-open to avoid blocking workflows |
| Stdin read timeout | 5 seconds | For hook input reading |

Configure via environment or config:
```bash
export HET_TIMEOUT_MS=15000
export HET_DEFAULT_ON_TIMEOUT=ask  # or 'deny' for fail-closed
```

## Daemon API

The daemon exposes an HTTP API on `http://127.0.0.1:7483`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with uptime, version, rules count, evaluation stats |
| `/evaluate` | POST | Evaluate a tool invocation (accepts JSON or text body) |
| `/stats` | GET | Detailed evaluation statistics |
| `/logs` | GET | Recent audit log entries (supports `?limit=N`) |
| `/reload-rules` | POST | Hot-reload rules from disk without restart |
| `/clear-cache` | POST | Clear evaluation cache |
| `/version` | GET | Version information |

### Response Headers

All `/evaluate` responses include:
- `X-HET-Decision`: allow, deny, or ask
- `X-HET-Confidence`: 0.0 to 1.0
- `X-HET-Time-Ms`: Evaluation time in milliseconds

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HET_PORT` | 7483 | Daemon port |
| `HET_HOST` | 127.0.0.1 | Daemon host |
| `HET_LOG_LEVEL` | info | Log level (debug/info/warn/error) |
| `HET_TIMEOUT_MS` | 10000 | Evaluation timeout in milliseconds |
| `HET_CACHE_TTL` | 300 | Cache TTL in seconds |
| `NODE_ENV` | development | Set to `production` to disable console logging |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run daemon in development
npm run dev

# Run CLI in development
npm run cli -- test-bash "ls -la"

# Run tests
npm test

# Lint
npm run lint
```

## File Structure

```
~/.het/
├── rules.yaml      # Global rules
├── prompt.md       # Global system prompt
├── audit.log       # Audit log (JSON lines format)
├── het.log         # Application log
└── error.log       # Error log

.het/               # Per-repository (in repo root)
├── rules.yaml      # Repository-specific rules (overrides global)
└── prompt.md       # Repository-specific prompt (merged with global)
```

## Audit Log Format

The audit log (`~/.het/audit.log`) uses JSON Lines format, one entry per line:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "sessionId": "abc123",
  "toolName": "Bash",
  "toolInput": { "command": "rm -rf /tmp/test" },
  "decision": "allow",
  "reason": "No matching rules",
  "confidence": 0.8,
  "matchedRule": null,
  "source": "claude-code",
  "evaluationTimeMs": 45
}
```

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 timestamp |
| `sessionId` | CLI session identifier (if provided) |
| `toolName` | Tool type (Bash, Write, etc.) |
| `toolInput` | Sanitized tool input (secrets redacted) |
| `decision` | allow, deny, or ask |
| `reason` | Explanation for the decision |
| `confidence` | Confidence score (0-1) |
| `matchedRule` | Name of matched rule (or null) |
| `source` | claude-code or copilot |
| `evaluationTimeMs` | Time taken for evaluation |

**Note:** Secrets in `toolInput` are automatically redacted before logging.

## Troubleshooting

### Daemon not running
```bash
het status  # Check if daemon is running
het daemon  # Start the daemon
```

### Check recent evaluations
```bash
het logs              # View recent decisions
het logs --stats      # View statistics
het logs -t Bash      # Filter by tool type
het logs -d deny      # Filter by decision
het logs -n 50        # Show 50 entries
het logs --json       # Output as JSON
```

### Test without affecting workflow
```bash
het test '{"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}}'
het test-bash "rm -rf /"
het test-write ".ssh/id_rsa"
het explain "dangerous command here"
```

### Debug logging
```bash
HET_LOG_LEVEL=debug het daemon
```

### Clear cache if getting stale results
```bash
curl -X POST http://127.0.0.1:7483/clear-cache
```

### Reload rules without restart
```bash
curl -X POST http://127.0.0.1:7483/reload-rules
```

## Performance

| Metric | Target | Description |
|--------|--------|-------------|
| Rule-based decisions | <100ms | Pattern matching only |
| LLM-based decisions | <5s | When rules don't match |
| Cache hit | <10ms | Previously evaluated commands |
| Memory footprint | <100MB | Daemon memory usage |

## Security Considerations

- **Fail-open by default**: On timeout, HET allows the operation to avoid blocking workflows
- **Secret redaction**: Credentials are redacted before LLM evaluation and audit logging
- **Local only**: Daemon binds to localhost by default
- **No execution**: HET never executes evaluated commands, only analyzes them

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.
