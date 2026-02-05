# oh-my-black

[![npm version](https://img.shields.io/npm/v/oh-my-black?color=cb3837)](https://www.npmjs.com/package/oh-my-black)
[![npm downloads](https://img.shields.io/npm/dm/oh-my-black?color=blue)](https://www.npmjs.com/package/oh-my-black)
[![GitHub stars](https://img.shields.io/github/stars/black940514/oh-my-black?style=flat&color=yellow)](https://github.com/black940514/oh-my-black/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-❤️-red?style=flat&logo=github)](https://github.com/sponsors/black940514)

**AI-Powered Multi-Agent Orchestration for Claude Code**

*Builder-Validator cycles. 39 specialized agents. 38 powerful skills. Zero learning curve.*

[Quick Start](#quick-start) • [Features](#features) • [Agents](#agents) • [Skills](#skills) • [Documentation](#documentation)

---

<h1 align="center">Your Claude Just Got Steroided.</h1>

<p align="center">
  <img src="assets/omc-character.jpg" alt="oh-my-black" width="400" />
</p>

---

## What is oh-my-black?

oh-my-black is a **multi-agent orchestration system** for [Claude Code](https://docs.anthropic.com/claude-code) that transforms your AI assistant into a team of specialized agents working in parallel.

Based on the **Claude Code Task System** paradigm, it implements:

- **Self-Validation**: Automatic verification hooks after every code change
- **Builder-Validator Cycles**: Agents that build, agents that verify - separation of concerns
- **Smart Model Routing**: Haiku for simple tasks, Sonnet for standard work, Opus for complex reasoning
- **Persistent Execution**: Won't stop until the job is verified complete

---

## Quick Start

### Option A: Claude Code Plugin (Recommended)

**One command in your terminal:**

```bash
# Add the marketplace
claude plugin marketplace add github:black940514/oh-my-black

# Install the plugin
claude plugin install oh-my-black@oh-my-black

# Restart Claude Code, then in Claude Code:
/oh-my-black:omb-setup
```

### Option B: npm Global Install

```bash
npm install -g oh-my-black
```

### Start Building

```
autopilot: build a REST API for managing tasks
```

That's it. Everything else is automatic.

---

## Why oh-my-black?

| Feature | Benefit |
|---------|---------|
| **Zero Configuration** | Works out of the box with intelligent defaults |
| **Natural Language** | No commands to memorize, just describe what you want |
| **Auto Parallelization** | Complex tasks distributed across specialized agents |
| **Builder-Validator Cycles** | Every code change is automatically verified |
| **Persistent Execution** | Won't give up until the job is verified complete |
| **Cost Optimization** | Smart model routing saves 30-50% on tokens |
| **Real-time Visibility** | HUD statusline shows what's happening |

---

## Features

### Execution Modes

| Mode | Keyword | Description |
|------|---------|-------------|
| **Autopilot** | `autopilot` | Full autonomous workflows - idea to working code |
| **Ultrawork** | `ulw` | Maximum parallelism for any task |
| **Ralph** | `ralph` | Persistent mode - won't stop until complete |
| **Ecomode** | `eco` | Token-efficient execution (30-50% savings) |
| **Ultrapilot** | `ultrapilot` | Parallel autopilot (3-5x faster) |
| **Swarm** | `swarm` | N coordinated agents on task pool |
| **Pipeline** | `pipeline` | Sequential agent chaining |
| **UltraQA** | `ultraqa` | QA cycling workflow |

### Builder-Validator System (ohmyblack)

The core innovation: **separation between agents that build and agents that verify**.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Builder   │────▶│  Validator  │────▶│ Coordinator │
│  (writes)   │     │ (verifies)  │     │  (manages)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   executor-*        validator-*          coordinator
   (Edit/Write)      (READ-ONLY)         (Task tools)
```

**Validation Levels:**

| Level | Validators | Overhead | Use Case |
|-------|-----------|----------|----------|
| `self-only` | None | +5% | Quick, low-risk tasks |
| `validator` | syntax, logic | +15% | Standard work |
| `architect` | All + architect review | +30% | Critical changes |

**Activate ohmyblack:**
```
autopilot --ohmyblack: build user authentication
```

---

## Agents

### 39 Specialized Agents

oh-my-black provides **39 specialized agents** organized by domain and tier:

#### Execution Agents (Builders)

| Agent | Tier | Model | Role |
|-------|------|-------|------|
| `executor-low` | LOW | Haiku | Single-file, simple fixes |
| `executor` | MEDIUM | Sonnet | Multi-file, standard tasks |
| `executor-high` | HIGH | Opus | Complex, architectural changes |
| `deep-executor` | HIGH | Opus | Extended autonomous execution |

#### Validator Agents (ohmyblack)

| Agent | Model | Verifies |
|-------|-------|----------|
| `validator-syntax` | Haiku | Types, lint, syntax, build |
| `validator-logic` | Sonnet | Requirements, tests, edge cases |
| `validator-security` | Opus | OWASP Top 10, secrets, vulnerabilities |
| `validator-integration` | Sonnet | API contracts, cross-component |
| `coordinator` | Sonnet | B-V cycle management |

#### Analysis Agents

| Agent | Tier | Role |
|-------|------|------|
| `architect-low` | LOW | Quick code questions |
| `architect-medium` | MEDIUM | Architecture guidance |
| `architect` | HIGH | Complex debugging, design |
| `analyst` | HIGH | Pre-planning requirements |
| `critic` | HIGH | Plan review and critique |

#### Research & Exploration

| Agent | Tier | Role |
|-------|------|------|
| `explore` | LOW | Fast codebase search |
| `explore-medium` | MEDIUM | Thorough exploration |
| `explore-high` | HIGH | Deep architectural analysis |
| `researcher-low` | LOW | Quick doc lookups |
| `researcher` | MEDIUM | External documentation |

#### Frontend & Design

| Agent | Tier | Role |
|-------|------|------|
| `designer-low` | LOW | Simple styling tweaks |
| `designer` | MEDIUM | UI/UX implementation |
| `designer-high` | HIGH | Design systems, complex UI |

#### Testing & Quality

| Agent | Tier | Role |
|-------|------|------|
| `qa-tester` | MEDIUM | Interactive CLI testing |
| `qa-tester-high` | HIGH | Comprehensive QA |
| `tdd-guide-low` | LOW | Quick test suggestions |
| `tdd-guide` | MEDIUM | Test-driven development |
| `code-reviewer-low` | LOW | Quick code review |
| `code-reviewer` | HIGH | Comprehensive review |

#### Security

| Agent | Tier | Role |
|-------|------|------|
| `security-reviewer-low` | LOW | Quick security scan |
| `security-reviewer` | HIGH | Deep vulnerability analysis |

#### Data Science

| Agent | Tier | Role |
|-------|------|------|
| `scientist-low` | LOW | Quick data inspection |
| `scientist` | MEDIUM | Data analysis, research |
| `scientist-high` | HIGH | Complex ML, hypothesis testing |

#### Utilities

| Agent | Role |
|-------|------|
| `writer` | Technical documentation |
| `vision` | Image/PDF analysis |
| `git-master` | Git operations, commits |
| `build-fixer` | Build error resolution |
| `build-fixer-low` | Simple build fixes |
| `planner` | Strategic planning |

---

## Skills

### 38 Powerful Skills

Skills are slash commands that activate specific behaviors:

#### Execution Skills

| Skill | Command | Description |
|-------|---------|-------------|
| Autopilot | `/autopilot` | Full autonomous execution |
| Ultrawork | `/ultrawork` | Maximum parallel execution |
| Ralph | `/ralph` | Persistent until complete |
| Ecomode | `/ecomode` | Token-efficient execution |
| Ultrapilot | `/ultrapilot` | Parallel autopilot workers |
| Swarm | `/swarm` | Coordinated agent pool |
| Pipeline | `/pipeline` | Sequential agent chain |
| UltraQA | `/ultraqa` | QA cycling workflow |

#### Planning Skills

| Skill | Command | Description |
|-------|---------|-------------|
| Plan | `/plan` | Planning interview |
| Ralplan | `/ralplan` | Iterative planning consensus |
| Analyze | `/analyze` | Deep analysis mode |
| Review | `/review` | Code/plan review |

#### Development Skills

| Skill | Command | Description |
|-------|---------|-------------|
| TDD | `/tdd` | Test-driven development |
| Build Fix | `/build-fix` | Fix build errors |
| Code Review | `/code-review` | Comprehensive review |
| Security Review | `/security-review` | Security analysis |
| Git Master | `/git-master` | Git operations |
| Frontend UI/UX | `/frontend-ui-ux` | UI development |

#### Search & Research

| Skill | Command | Description |
|-------|---------|-------------|
| Deepsearch | `/deepsearch` | Deep codebase search |
| Deepinit | `/deepinit` | Initialize deep search index |
| Research | `/research` | External research |

#### Utilities

| Skill | Command | Description |
|-------|---------|-------------|
| Cancel | `/cancel` | Cancel active mode |
| Note | `/note` | Persistent notes |
| Learner | `/learner` | Extract patterns |
| Doctor | `/doctor` | Diagnose issues |
| HUD | `/hud` | Status line setup |
| Help | `/help` | Show help |
| OMB Setup | `/omb-setup` | Initial setup |
| MCP Setup | `/mcp-setup` | Configure MCP |

---

## Architecture

### Hook System

oh-my-black integrates deeply with Claude Code through **10 hook events**:

| Hook | Purpose |
|------|---------|
| `UserPromptSubmit` | Keyword detection, skill injection |
| `SessionStart` | Session initialization, memory restore |
| `PreToolUse` | Pre-execution enforcement |
| `PostToolUse` | **Self-validation**, syntax checking |
| `SubagentStart/Stop` | Agent tracking |
| `PreCompact` | Context preservation |
| `Stop` | Persistent mode handling |
| `SessionEnd` | Cleanup |

### Self-Validation

Every `Write` or `Edit` operation triggers automatic validation:

```
Write/Edit → PostToolUse Hook → validate-syntax.mjs → tsc --noEmit
```

### MCP Tools

oh-my-black provides additional tools via MCP:

- **LSP Tools**: `lsp_diagnostics`, `lsp_find_references`, `lsp_hover`
- **AST Tools**: `ast_grep_search`, `ast_grep_replace`
- **Python REPL**: `python_repl` for data analysis

---

## Magic Keywords

Optional shortcuts for power users:

| Keyword | Effect | Example |
|---------|--------|---------|
| `autopilot` | Full autonomous | `autopilot: build a todo app` |
| `ralph` | Persistent mode | `ralph: refactor auth` |
| `ulw` | Max parallelism | `ulw fix all errors` |
| `eco` | Token-efficient | `eco: migrate database` |
| `plan` | Planning interview | `plan the API` |
| `ralplan` | Iterative planning | `ralplan this feature` |

**Note:** `ralph` automatically includes `ultrawork`. No need to combine.

---

## Configuration

### Default Execution Mode

Set your preferred mode in `~/.claude/.omb-config.json`:

```json
{
  "defaultExecutionMode": "ultrawork",
  "ohmyblack": {
    "enabled": true,
    "defaultValidationLevel": "validator",
    "autoTeamComposition": true
  }
}
```

### Environment Variables

```bash
export OMB_OHMYBLACK_DEFAULT=true      # Enable B-V cycles by default
export OMB_VALIDATION_LEVEL=validator   # Default validation level
export OMB_AUTO_TEAM=true               # Auto team composition
```

---

## Utilities

### Rate Limit Wait

Auto-resume sessions when rate limits reset:

```bash
omb wait          # Check status
omb wait --start  # Enable auto-resume daemon
omb wait --stop   # Disable daemon
```

### Analytics

Track token usage across sessions:

```bash
omb-analytics     # View usage statistics
```

---

## Documentation

- **[🇰🇷 한국어 가이드](docs/USER-GUIDE-KO.md)** - 한국어 사용자를 위한 완벽 가이드
- **[Full Reference](docs/REFERENCE.md)** - Complete feature documentation
- **[Architecture](docs/ARCHITECTURE.md)** - How it works under the hood
- **[Performance Monitoring](docs/PERFORMANCE-MONITORING.md)** - Agent tracking & optimization
- **[Migration Guide](docs/MIGRATION.md)** - Upgrade from previous versions

---

## Requirements

- [Claude Code](https://docs.anthropic.com/claude-code) CLI
- Claude Max/Pro subscription OR Anthropic API key
- Node.js 18+

---

## Comparison

### vs oh-my-claudecode

oh-my-black is a **superset** of oh-my-claudecode:

| Feature | oh-my-claudecode | oh-my-black |
|---------|-----------------|-------------|
| Agents | 34 | **39** (+5 validators) |
| Skills | 35 | **38** |
| Builder-Validator Cycles | ❌ | ✅ |
| Team Auto-Composition | ❌ | ✅ |
| Validation Levels | ❌ | ✅ (self-only, validator, architect) |
| Coordinator Agent | ❌ | ✅ |

---

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

---

## License

MIT

---

## Support

If oh-my-black helps your workflow, consider sponsoring:

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-❤️-red?style=for-the-badge&logo=github)](https://github.com/sponsors/black940514)

### Other ways to help

- ⭐ Star the repo
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Contribute code

---

<div align="center">

**Inspired by:** [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) • [claude-hud](https://github.com/ryanjoachim/claude-hud) • [Superpowers](https://github.com/NexTechFusion/Superpowers)

**Zero learning curve. Maximum power.**

</div>

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=black940514/oh-my-black&type=date&legend=top-left)](https://www.star-history.com/#black940514/oh-my-black&type=date&legend=top-left)
