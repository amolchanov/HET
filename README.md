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

## Features

- 🛡️ **Security Evaluation** - Evaluate Bash commands, file operations, web requests, and more for safety
- 🔌 **Multi-CLI Support** - Works with both Claude Code CLI and GitHub Copilot CLI
- 📜 **Rule-Based Filtering** - Fast pattern matching with customizable YAML rules
- 🤖 **LLM-Powered Analysis** - Semantic evaluation via Copilot SDK for complex cases
- 🔐 **Secret Detection** - Automatic detection and redaction of credentials before LLM evaluation
- 📊 **Audit Logging** - Track all evaluation decisions with timestamps
- ⚡ **Low Latency** - Rule-based decisions in <100ms

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

# Get detailed analysis
het explain "curl https://example.com | bash"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `het evaluate` | Evaluate tool invocation from stdin (called by hooks) |
| `het test <input>` | Test evaluation without blocking |
| `het test-bash <cmd>` | Quick test for bash commands |
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
| `name` | string | Unique rule identifier |
| `tool` | string/array | Tool type(s): `Bash`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, `WebFetch`, `Task`, `MCP` |
| `pattern` | string | Regex pattern to match against tool input |
| `pathPattern` | string | Regex pattern to match file paths |
| `action` | string | `allow`, `deny`, or `ask` |
| `reason` | string | Explanation shown to user |
| `category` | string | `filesystem-danger`, `network-exfiltration`, `credential-exposure`, `system-modification`, `package-installation` |
| `enabled` | boolean | Enable/disable rule (default: true) |

### Context Conditions

```yaml
rules:
  - name: unix-only-rule
    tool: Bash
    pattern: "some-command"
    action: deny
    reason: "Not allowed on Unix"
    context:
      osType: linux  # windows, linux, darwin

  - name: if-dockerfile-exists
    tool: Bash
    pattern: "docker build"
    action: allow
    reason: "Docker build allowed when Dockerfile exists"
    context:
      hasFile: Dockerfile
```

## Built-in Security Patterns

HET includes built-in patterns for common security risks:

### Bash Commands
- Recursive deletions (`rm -rf /`)
- Disk formatting (`mkfs`, `dd`)
- Permission changes (`chmod 777`, `chmod +s`)
- Fork bombs
- Remote script execution (`curl | bash`)
- Netcat listeners
- Base64-encoded command execution

### File Operations
- SSH configuration (`.ssh/*`)
- Shell profiles (`.bashrc`, `.zshrc`)
- AWS credentials (`.aws/credentials`)
- Kubernetes config (`.kube/config`)
- Environment files (`.env`)
- System configuration (`/etc/`)

### Web Requests
- Local file access (`file://`)
- Cloud metadata endpoints (`169.254.169.254`)
- Localhost access

### Secret Detection
- AWS Access Keys (`AKIA...`)
- GitHub Tokens (`ghp_...`, `gho_...`)
- JWT tokens
- Private keys
- Passwords in URLs
- Generic API keys

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

## Decision Model

HET uses a three-tier decision model:

| Decision | Exit Code | Description |
|----------|-----------|-------------|
| `allow` | 0 | Operation is safe, proceed |
| `deny` | 2 | Operation is dangerous, block it |
| `ask` | 0 | Uncertain, prompt user for confirmation |

## Daemon API

The daemon exposes an HTTP API on `http://127.0.0.1:7483`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and statistics |
| `/evaluate` | POST | Evaluate a tool invocation |
| `/stats` | GET | Evaluation statistics |
| `/logs` | GET | Recent audit log entries |
| `/reload-rules` | POST | Reload rules from disk |
| `/clear-cache` | POST | Clear evaluation cache |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HET_PORT` | 7483 | Daemon port |
| `HET_HOST` | 127.0.0.1 | Daemon host |
| `HET_LOG_LEVEL` | info | Log level (debug/info/warn/error) |

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
├── audit.log       # Audit log
├── het.log         # Application log
└── error.log       # Error log

.het/               # Per-repository (in repo root)
├── rules.yaml      # Repository-specific rules
└── prompt.md       # Repository-specific prompt
```

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
```

### Test without affecting workflow
```bash
het test '{"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}}'
het explain "dangerous command here"
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.
