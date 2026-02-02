# HET Implementation Tasks

## Phase 1: Core Infrastructure

### Types & Interfaces
- [x] FR-9: Define Decision type with three-tier model (`allow`, `deny`, `ask`)
- [x] FR-13: Define EvaluationResult with confidence score (0-1)
- [x] Define normalized ToolInvocation interface (unifies Claude Code & Copilot formats)
- [x] Define Rule interface with all supported properties
- [x] Define HookInput/HookOutput interfaces for both CLIs

### Configuration System
- [x] FR-14: Load global rules from `~/.het/rules.yaml`
- [x] FR-15: Load per-repository rules from `.het/rules.yaml`
- [x] FR-16: Implement rule precedence (repo overrides global)
- [ ] FR-20: Configurable per-repo rule loading mode (auto-detect/opt-in/disabled)
- [x] FR-36: Support per-repository system prompt via `.het/prompt.md`
- [ ] Hot-reload rules with file watcher (500ms debounce)

### Rule Engine
- [x] FR-17: Support regex pattern matching in rules
- [x] FR-18: Support context conditions in rules
- [x] FR-19: Support rule categories (`filesystem-danger`, `network-exfiltration`, etc.)
- [x] Rule YAML schema validation

## Phase 2: CLI Integration Layer

### Input Parsing
- [x] FR-21: Parse JSON input from Claude Code PreToolUse hooks
- [x] FR-22: Parse input from GitHub Copilot preToolUse hooks
- [x] Auto-detect CLI type from JSON structure (fallback)
- [x] Normalize both formats to internal ToolInvocation

### Output Formatting
- [x] FR-23: Return properly formatted JSON for Claude Code (`hookSpecificOutput`)
- [x] FR-24: Return properly formatted response for GitHub Copilot
- [x] FR-25: Support `updatedInput` to modify tool arguments
- [x] FR-26: Support `additionalContext` to inject warnings

### Hook Installation
- [x] NFR-13: Auto-setup Claude Code hook configuration
- [x] NFR-14: Auto-setup GitHub Copilot hook configuration

## Phase 3: Core Evaluation Engine

### Tool Evaluators
- [x] FR-1: Evaluate Bash/shell commands for safety
- [x] FR-2: Evaluate file Write operations (sensitive paths)
- [x] FR-3: Evaluate file Edit operations for dangerous modifications
- [x] FR-4: Evaluate WebFetch/WebSearch for data exfiltration
- [x] FR-5: Evaluate Task/subagent spawning for privilege escalation
- [x] FR-6: Evaluate Read operations for sensitive file access
- [x] Evaluate Glob/Grep tools with sensitive folder rules
- [x] Evaluate MCP tools (pattern `mcp__<server>__<tool>`)

### Multi-Language Support
- [ ] FR-7: Bash script analysis
- [ ] FR-7: PowerShell script analysis
- [ ] FR-7: Python script analysis

### Secret Detection
- [x] FR-8: Detect credential/secret exposure in commands
- [x] NFR-5: Redact secrets before sending to cloud LLM
- [x] Implement built-in secret patterns (AWS, GitHub, JWT, etc.)
- [ ] Support custom secret patterns via config
- [ ] Support disabled_patterns configuration

### Decision Engine
- [x] FR-10: Provide clear, actionable reasons for denials
- [ ] FR-11: Support "deny always" persistent blocklist (per-repo and global)
- [ ] FR-12: Support "allow always" persistent allowlist (per-repo and global)
- [ ] Return `ask` with error context for malformed input

## Phase 4: LLM Integration

### Copilot SDK Integration
- [x] FR-27: Use Copilot SDK for LLM-based tool evaluation (placeholder)
- [ ] FR-28: Use web search (via SDK) to lookup unknown commands
- [ ] FR-29: Use file reading (via SDK) to analyze referenced scripts
- [x] FR-30: Cache evaluation results (configurable TTL)
- [x] NFR-10: Graceful degradation if SDK unavailable (rules-only fallback)
- [ ] Context isolation - reset context for each evaluation

### System Prompt
- [x] Implement base evaluation system prompt
- [x] Merge global `~/.het/prompt.md` with base
- [x] Merge repo `.het/prompt.md` with global+base

## Phase 5: Daemon Architecture

### Server
- [x] HTTP server for hook requests
- [ ] Socket communication for thin CLI
- [x] NFR-11: Health check endpoint
- [ ] NFR-9: Auto-restart on crash

### Concurrency & Timeouts
- [ ] Request queue with workers
- [x] NFR-4: Graceful timeout handling (10s max, default allow)
- [x] NFR-1: Rule-based decisions < 100ms
- [ ] NFR-2: LLM-based decisions < 5 seconds
- [ ] Smart timeout: return `ask` early if queue depth × avg_time > remaining
- [ ] Subagent mode detection (no timeout for autonomous operation)

### Thin CLI
- [x] `het evaluate` command (stdin/stdout for hooks)
- [ ] Forward to daemon via socket/HTTP
- [ ] Fallback to direct evaluation if daemon unavailable

## Phase 6: CLI Commands

### Core Commands
- [x] FR-31: `het test <tool_json>` - test evaluation without blocking
- [x] FR-32: `het explain <command>` - show risk analysis
- [x] FR-33: `het status` - check daemon health
- [x] FR-34: `het logs` - view recent evaluation decisions

### Setup Commands
- [ ] NFR-15: Interactive setup wizard (`het init` or `het setup`)
- [x] `het install` - install hook configurations

## Phase 7: Cross-Platform Support

### Sensitive Path Detection
- [x] Unix paths: `.bashrc`, `.ssh/*`, `~/.aws/*`, etc.
- [ ] Windows paths: `$PROFILE`, `%USERPROFILE%\.ssh\*`, etc.
- [ ] Platform-agnostic path normalization

## Phase 8: Logging & Audit

### Logging
- [x] Console output with verbosity levels (debug/info/warn/error)
- [x] NFR-6: Audit log all evaluation decisions with timestamps
- [ ] NFR-3: Memory footprint < 100MB

### Secure Storage
- [ ] NFR-7: Secure storage for persistent allow/deny lists

## Phase 9: Testing & Quality

### Unit Tests
- [ ] Rule parser tests
- [ ] Rule matcher tests
- [ ] Hook input/output parser tests
- [ ] Secret detection tests
- [ ] Evaluator tests for each tool type

### Integration Tests
- [ ] End-to-end hook evaluation flow
- [ ] Daemon communication tests
- [ ] Hot-reload tests

## Phase 10: Documentation & Distribution

### Documentation
- [ ] README with installation instructions
- [ ] Configuration reference
- [ ] Rule authoring guide
- [ ] Examples for common use cases

### Distribution
- [x] NFR-12: npm package (`npm install -g het`)
- [x] Shebang in CLI entry point

## Phase 11: CLI Infrastructure

### CLI Entry Point
- [x] Create main CLI entry point `src/cli/index.ts` with Commander.js
- [x] Wire up all commands (evaluate, test, explain, status, logs, daemon, install)
