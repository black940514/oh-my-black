<!-- Generated: 2026-01-28 | Updated: 2026-01-31 -->

# oh-my-black

Multi-agent orchestration system for Claude Code CLI, providing intelligent delegation, parallel execution, and IDE-like capabilities through LSP/AST integration.

**Version:** 4.0+
**Base:** 3.9.4 with ohmyblack enhancement
**Purpose:** Transform Claude Code into a conductor of specialized AI agents with verification-driven workflows
**Inspired by:** oh-my-zsh / oh-my-opencode

## Purpose

oh-my-black enhances Claude Code with:

- **38 specialized agents** across multiple domains with 3-tier model routing (Haiku/Sonnet/Opus)
  - 32 core agents (original)
  - 5 new validator agents (ohmyblack)
  - 1 coordinator agent (ohmyblack)
- **37+ skills** for workflow automation and specialized behaviors
- **31 hooks** for event-driven execution modes and enhancements
- **15+ custom tools** including 12 LSP, 2 AST, and Python REPL
- **Execution modes**: autopilot, ultrawork, ralph, ultrapilot, swarm, pipeline, ecomode
- **Builder-Validator Cycles** (ohmyblack) - Automatic verification of every code change
- **Team Auto-Composition** (ohmyblack) - Intelligent team selection based on task complexity
- **MCP integration** with plugin-scoped tool discovery and skill loading

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Project dependencies and npm scripts |
| `tsconfig.json` | TypeScript configuration |
| `CHANGELOG.md` | Version history and release notes |
| `docs/CLAUDE.md` | End-user orchestration instructions (installed to user projects) |
| `src/index.ts` | Main entry point - exports `createSisyphusSession()` |
| `.mcp.json` | MCP server configuration for plugin discovery |
| `.claude-plugin/plugin.json` | Claude Code plugin manifest |

## Subdirectories

| Directory | Purpose | Related AGENTS.md |
|-----------|---------|-------------------|
| `src/` | TypeScript source code - core library | `src/AGENTS.md` |
| `agents/` | Markdown prompt templates for 32 agents (see `agents/templates/` for guidelines) | - |
| `skills/` | 37 skill definitions for workflows | `skills/AGENTS.md` |
| `commands/` | 31 slash command definitions (mirrors skills) | - |
| `scripts/` | Build scripts, utilities, and automation | - |
| `docs/` | User documentation and guides | `docs/AGENTS.md` |
| `templates/` | Hook and rule templates (coding-style, testing, security, performance, git-workflow) | - |
| `benchmark/` | Performance testing framework | - |
| `bridge/` | Pre-bundled MCP server for plugin distribution | - |

## For AI Agents

### Working In This Directory

1. **Delegation-First Protocol**: You are a CONDUCTOR, not a performer. Delegate substantive work:

   | Work Type | Delegate To | Model |
   |-----------|-------------|-------|
   | Code changes | `executor` / `executor-low` / `executor-high` | sonnet/haiku/opus |
   | Analysis | `architect` / `architect-medium` / `architect-low` | opus/sonnet/haiku |
   | Search | `explore` / `explore-medium` / `explore-high` | haiku/sonnet/opus |
   | UI/UX | `designer` / `designer-low` / `designer-high` | sonnet/haiku/opus |
   | Docs | `writer` | haiku |
   | Security | `security-reviewer` / `security-reviewer-low` | opus/haiku |
   | Build errors | `build-fixer` / `build-fixer-low` | sonnet/haiku |
   | Testing | `qa-tester` / `qa-tester-high` | sonnet/opus |
   | Code review | `code-reviewer` / `code-reviewer-low` | opus/haiku |
   | TDD | `tdd-guide` / `tdd-guide-low` | sonnet/haiku |
   | Data analysis | `scientist` / `scientist-low` / `scientist-high` | sonnet/haiku/opus |

2. **LSP/AST Tools**: Use IDE-like tools for code intelligence:
   - `lsp_hover` - Type info and documentation at position
   - `lsp_goto_definition` - Jump to symbol definition
   - `lsp_find_references` - Find all usages across codebase
   - `lsp_document_symbols` - Get file outline
   - `lsp_workspace_symbols` - Search symbols across workspace
   - `lsp_diagnostics` - Get errors/warnings for single file
   - `lsp_diagnostics_directory` - Project-wide type checking (uses tsc or LSP)
   - `lsp_rename` - Preview refactoring across files
   - `lsp_code_actions` - Get available quick fixes
   - `ast_grep_search` - Structural code search with patterns
   - `ast_grep_replace` - AST-aware code transformation
   - `python_repl` - Execute Python code for data analysis

3. **Model Routing**: Match model tier to task complexity:
   - **Haiku** (LOW): Simple lookups, trivial fixes, fast searches
   - **Sonnet** (MEDIUM): Standard implementation, moderate reasoning
   - **Opus** (HIGH): Complex reasoning, architecture, debugging

### Modification Checklist

#### Cross-File Dependencies

| If you modify... | Also check/update... |
|------------------|---------------------|
| `agents/*.md` | `src/agents/definitions.ts`, `src/agents/index.ts`, `docs/REFERENCE.md` |
| `agents/validator-*.md` | `src/features/verification/`, `AGENTS.md` (validator agents section) |
| `agents/coordinator.md` | `src/features/team/`, `src/features/verification/` |
| `skills/*/SKILL.md` | `commands/*.md` (mirror), `scripts/build-skill-bridge.mjs` |
| `commands/*.md` | `skills/*/SKILL.md` (mirror) |
| `src/hooks/*` | `src/hooks/index.ts`, `src/hooks/bridge.ts`, related skill/command |
| Agent prompt | Tiered variants (`-low`, `-medium`, `-high`) |
| Tool definition | `src/tools/index.ts`, `src/mcp/omb-tools-server.ts`, `docs/REFERENCE.md` |
| `src/hud/*` | `commands/hud.md`, `skills/hud/SKILL.md` |
| `src/mcp/*` | `docs/REFERENCE.md` (MCP Tools section) |
| Agent tool assignments | `docs/CLAUDE.md` (Agent Tool Matrix) |
| `templates/rules/*` | `src/hooks/rules-injector/` if pattern changes |
| New execution mode | `src/hooks/*/`, `skills/*/SKILL.md`, `commands/*.md` (all three) |
| B-V Cycle behavior | `src/features/verification/`, `docs/MIGRATION-OHMYBLACK.md` |
| Team composition rules | `src/features/team/`, `TEAM_MODULE_SUMMARY.md` |

#### Documentation Updates (docs/)

| If you change... | Update this docs/ file |
|------------------|----------------------|
| Agent count or agent list | `docs/REFERENCE.md` (Agents section), `AGENTS.md` (this file) |
| Validator agents or coordinator | `docs/MIGRATION-OHMYBLACK.md`, `AGENTS.md` (Agent Summary) |
| Skill count or skill list | `docs/REFERENCE.md` (Skills section) |
| Hook count or hook list | `docs/REFERENCE.md` (Hooks System section) |
| Magic keywords | `docs/REFERENCE.md` (Magic Keywords section) |
| Architecture or skill composition | `docs/ARCHITECTURE.md` |
| B-V cycles or team auto-composition | `docs/MIGRATION-OHMYBLACK.md`, `docs/CLAUDE.md` |
| Internal API or feature | `docs/FEATURES.md` |
| Breaking changes | `docs/MIGRATION.md` |
| Tiered agent design | `docs/TIERED_AGENTS_V2.md` |
| Compatibility requirements | `docs/COMPATIBILITY.md` |
| CLAUDE.md content | `docs/CLAUDE.md` (end-user instructions) |
| ohmyblack features | `docs/MIGRATION-OHMYBLACK.md`, `docs/CLAUDE.md` |

#### Skills ↔ Commands Relationship

- `skills/` contains skill implementations with full prompts
- `commands/` contains slash command definitions that invoke skills
- Both should be kept in sync for the same functionality

#### AGENTS.md Update Requirements

When you modify files in these locations, update the corresponding AGENTS.md:

| If you change... | Update this AGENTS.md |
|------------------|----------------------|
| Root project structure, new features | `/AGENTS.md` (this file) |
| `src/**/*.ts` structure or new modules | `src/AGENTS.md` |
| `agents/*.md` files | `src/agents/AGENTS.md` (implementation details) |
| `skills/*/` directories | `skills/AGENTS.md` |
| `src/hooks/*/` directories | `src/hooks/AGENTS.md` |
| `src/tools/**/*.ts` | `src/tools/AGENTS.md` |
| `src/features/*/` modules | `src/features/AGENTS.md` |
| `src/tools/lsp/` | `src/tools/lsp/AGENTS.md` |
| `src/tools/diagnostics/` | `src/tools/diagnostics/AGENTS.md` |
| `src/agents/*.ts` | `src/agents/AGENTS.md` |

#### What to Update

- Update version number when releasing
- Update feature descriptions when functionality changes
- Update file/directory tables when structure changes
- Keep "Generated" date as original, update "Updated" date

### Testing Requirements

```bash
npm test              # Run Vitest test suite
npm run build         # TypeScript compilation
npm run lint          # ESLint checks
npm run test:coverage # Coverage report
```

### Common Patterns

```typescript
// Entry point
import { createSisyphusSession } from 'oh-my-black';
const session = createSisyphusSession();

// Agent registration
import { getAgentDefinitions } from './agents/definitions';
const agents = getAgentDefinitions();

// Tool access
import { allCustomTools, lspTools, astTools } from './tools';
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code CLI                          │
├─────────────────────────────────────────────────────────────┤
│                  oh-my-black (OMB)                     │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │   Skills    │   Agents    │    Tools    │   Hooks     │  │
│  │ (37 skills) │ (32 agents) │(LSP/AST/REPL)│ (31 hooks)  │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Features Layer                             ││
│  │ model-routing | boulder-state | verification | notepad  ││
│  │ delegation-categories | task-decomposer | state-manager ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Agent Summary (38 Total)

### Base Agents (12)

| Agent | Model | Purpose |
|-------|-------|---------|
| architect | opus | Architecture, debugging, root cause analysis |
| researcher | sonnet | Documentation, external API research |
| explore | haiku | Fast codebase pattern search |
| executor | sonnet | Focused task implementation |
| designer | sonnet | UI/UX, component design |
| writer | haiku | Technical documentation |
| vision | sonnet | Image/screenshot analysis |
| critic | opus | Critical plan review |
| analyst | opus | Pre-planning requirements analysis |
| planner | opus | Strategic planning with interviews |
| qa-tester | sonnet | Interactive CLI/service testing |
| scientist | sonnet | Data analysis, hypothesis testing |

### Specialized Agents (4)

| Agent | Model | Purpose |
|-------|-------|---------|
| security-reviewer | opus | Security vulnerability detection and audits |
| build-fixer | sonnet | Build/type error resolution (multi-language) |
| tdd-guide | sonnet | Test-driven development workflow |
| code-reviewer | opus | Expert code review and quality assessment |

### Validator Agents (5) - ohmyblack

| Agent | Model | Purpose |
|-------|-------|---------|
| validator-syntax | haiku | Type/syntax verification via LSP |
| validator-logic | sonnet | Functional requirement verification via tests |
| validator-security | opus | Security vulnerability detection |
| validator-integration | sonnet | Cross-component integration testing |
| coordinator | sonnet | Builder-Validator cycle management and retry logic |

### Tiered Variants (16 Core + 5 Validators = 21)

| Tier | Agents |
|------|--------|
| **LOW** (Haiku) | `architect-low`, `executor-low`, `researcher-low`, `designer-low`, `scientist-low`, `security-reviewer-low`, `build-fixer-low`, `tdd-guide-low`, `code-reviewer-low`, `validator-syntax` (10) |
| **MEDIUM** (Sonnet) | `architect-medium`, `explore-medium`, `validator-logic`, `validator-integration`, `coordinator` (5) |
| **HIGH** (Opus) | `executor-high`, `designer-high`, `explore-high`, `qa-tester-high`, `scientist-high`, `validator-security` (6) |

## Execution Modes

| Mode | Trigger | Purpose |
|------|---------|---------|
| autopilot | "autopilot", "build me", "I want a" | Full autonomous execution |
| ultrawork | "ulw", "ultrawork" | Maximum parallel agent execution |
| ralph | "ralph", "don't stop until" | Persistence with architect verification |
| ultrapilot | "ultrapilot", "parallel build" | Parallel autopilot with file ownership |
| swarm | "swarm N agents" | N coordinated agents with SQLite task claiming |
| pipeline | "pipeline" | Sequential agent chaining with data passing |
| ecomode | "eco", "efficient", "budget" | Token-efficient parallel execution |

**With ohmyblack enhancement:**
- Any mode + `--ohmyblack` → Enable Builder-Validator cycles
- Any mode + `--auto-team` → Enable intelligent team composition
- Combine: `ultrawork --ohmyblack --auto-team` or `ralph --auto-team --validation=architect`

## Validator Agent Details (ohmyblack)

### validator-syntax (Haiku)

**Role**: Type and syntax verification

**Capabilities**:
- Run TypeScript compiler (tsc)
- Execute ESLint
- Check LSP diagnostics
- Verify type correctness

**Output**: Pass/Fail with specific error locations and line numbers

**Use Cases**:
- All standard work (included in `validator` validation level)
- Quick type checking before integration tests
- Minimal cost (haiku model)

**Error Categories**:
- Type mismatches
- Undefined variables/functions
- Missing imports
- Syntax errors
- Linting violations

### validator-logic (Sonnet)

**Role**: Functional requirement verification

**Capabilities**:
- Execute test suites (jest, vitest, pytest)
- Verify behavior against requirements
- Check edge cases
- Validate integration between components

**Output**: Test results with coverage, pass/fail per requirement

**Use Cases**:
- Feature implementation (included in `robust` team template)
- Post-refactoring validation
- Acceptance criteria verification

**Test Types**:
- Unit tests
- Integration tests
- API contract tests
- Behavioral tests

### validator-security (Opus)

**Role**: Security vulnerability detection

**Capabilities**:
- OWASP Top 10 checks
- Secrets/credentials detection
- SQL injection prevention
- XSS/CSRF protection
- Input validation checks
- Dependency vulnerability scanning

**Output**: Severity ratings (critical, high, medium, low)

**Use Cases**:
- Security-sensitive code (included in `secure` team template)
- Authentication/authorization changes
- Data handling modifications
- Third-party integration reviews

**Severity Levels**:
- **Critical**: Immediate security threat
- **High**: Requires urgent fix
- **Medium**: Should fix before release
- **Low**: Nice to have fix

### validator-integration (Sonnet)

**Role**: Cross-component integration testing

**Capabilities**:
- API contract verification
- Breaking change detection
- Dependency compatibility checks
- Integration test execution

**Output**: Integration test results, compatibility report

**Use Cases**:
- Complex multi-file changes (included in `robust`+ templates)
- API changes
- Shared library modifications
- Cross-module refactoring

**Checks**:
- API endpoints match contracts
- Type exports compatible
- Dependency versions compatible
- Module exports unchanged

### coordinator (Sonnet)

**Role**: Builder-Validator cycle orchestration

**Responsibilities**:
1. Receive task from orchestrator
2. Execute builder agent
3. Validate builder output
4. Decide: pass, retry, or escalate
5. Report results with evidence

**Key Features**:
- **Retry Logic**: Up to 3 attempts per task
- **Escalation**: To architect on persistent issues
- **Evidence Collection**: Build logs, test results, validation reports
- **State Tracking**: Maintains coordination state in `.omb/state/coordination/`

**Decision Tree**:
```
Builder completes
    ↓
Validator checks
    ├─ PASS → Report success
    ├─ FAIL + retryable + attempts < max → Retry builder with feedback
    └─ FAIL + non-retryable OR attempts >= max → Escalate
```

**Output Schema**:
```json
{
  "coordinatorId": "coordinator-{taskId}",
  "taskId": "{task-id}",
  "cycleResult": {
    "status": "success|failed|escalated",
    "attempts": 2,
    "maxAttempts": 3,
    "builderPassed": true,
    "validatorPassed": true
  },
  "evidence": [...],
  "issues": [...],
  "escalation": {
    "required": false,
    "level": null,
    "reason": null
  }
}
```

## Skills (37)

Key skills: `autopilot`, `ultrawork`, `ralph`, `ultrapilot`, `plan`, `ralplan`, `deepsearch`, `deepinit`, `frontend-ui-ux`, `git-master`, `tdd`, `security-review`, `code-review`, `research`, `analyze`, `swarm`, `pipeline`, `ecomode`, `cancel`, `learner`, `note`, `hud`, `doctor`, `omb-setup`, `mcp-setup`, `build-fix`, `ultraqa`

## LSP/AST Tools

### LSP Tools

```typescript
// IDE-like code intelligence via Language Server Protocol
lsp_hover              // Type info at position
lsp_goto_definition    // Jump to definition
lsp_find_references    // Find all usages
lsp_document_symbols   // File outline
lsp_workspace_symbols  // Cross-workspace symbol search
lsp_diagnostics        // Single file errors/warnings
lsp_diagnostics_directory  // PROJECT-WIDE type checking
lsp_servers            // List available language servers
lsp_prepare_rename     // Check if rename is valid
lsp_rename             // Preview multi-file rename
lsp_code_actions       // Available refactorings/fixes
lsp_code_action_resolve // Get action details
```

#### Supported Languages

TypeScript, Python, Rust, Go, C/C++, Java, JSON, HTML, CSS, YAML

### AST Tools

```typescript
// Structural code search/transform via ast-grep
ast_grep_search   // Pattern matching with meta-variables ($NAME, $$$ARGS)
ast_grep_replace  // AST-aware code transformation (dry-run by default)
```

#### Supported Languages

JavaScript, TypeScript, TSX, Python, Ruby, Go, Rust, Java, Kotlin, Swift, C, C++, C#, HTML, CSS, JSON, YAML

## State Files

| Path | Purpose |
|------|---------|
| `.omb/state/*.json` | Execution mode state (autopilot, swarm, etc.) |
| `.omb/notepads/` | Plan-scoped wisdom (learnings, decisions, issues) |
| `~/.omb/state/` | Global state |
| `~/.claude/.omb/` | Legacy state (auto-migrated) |

## Dependencies

### Runtime

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/claude-agent-sdk` | Claude Code integration |
| `@ast-grep/napi` | AST-based code search/replace |
| `vscode-languageserver-protocol` | LSP types |
| `zod` | Runtime schema validation |
| `better-sqlite3` | Swarm task coordination |
| `chalk` | Terminal styling |
| `commander` | CLI parsing |

### Development

| Package | Purpose |
|---------|---------|
| `typescript` | Type system |
| `vitest` | Testing framework |
| `eslint` | Linting |
| `prettier` | Code formatting |

## Commands

```bash
npm run build           # Build TypeScript + skill bridge
npm run dev             # Watch mode
npm test                # Run tests
npm run test:coverage   # Coverage report
npm run lint            # ESLint
npm run sync-metadata   # Sync agent/skill metadata
```

## ohmyblack System (v4.0+)

Enhanced orchestration system adding verification-driven workflows and intelligent team composition.

### Key Features

**Builder-Validator Cycles (B-V)**
- Every code change verified automatically before completion
- Retry logic with up to 3 attempts per task
- Escalation to architect on persistent issues
- Support for 3 validation levels: `self-only`, `validator`, `architect`

**Team Auto-Composition**
- Analyzes task complexity (0-1 scale)
- Auto-selects optimal team based on complexity
- 5 predefined templates: minimal, standard, robust, secure, fullstack
- Override with `--team` or `--complexity` flags

**Meta-prompt Templates**
- Template-based consistent prompts
- Location: `.omb/templates/`
- Files: `agent.tpl`, `plan.tpl`, `task.tpl`, `team.tpl`
- Variables: `{TASK_DESCRIPTION}`, `{COMPLEXITY_SCORE}`, `{TEAM_MEMBERS}`, etc.

### New Files & Modules

**Validators:**
- `agents/validator-syntax.md` - Type/syntax checks
- `agents/validator-logic.md` - Functional verification
- `agents/validator-security.md` - Security scanning
- `agents/validator-integration.md` - Cross-component testing
- `agents/coordinator.md` - B-V cycle management

**Features:**
- `src/features/verification/builder-validator.ts` - B-V cycle implementation
- `src/features/verification/ohmyblack-checks.ts` - Verification checks
- `src/features/team/auto-composer.ts` - Complexity analysis & team selection
- `src/features/team/types.ts` - Team definition schemas
- `src/features/state-manager/ohmyblack-schemas.ts` - State file schemas

**Skills:**
- `skills/autopilot/ohmyblack-integration.ts` - Autopilot B-V integration
- `skills/ralph/bv-ralph.ts` - Ralph with B-V cycles
- `skills/ultrawork/bv-ultrawork.ts` - Ultrawork with B-V cycles

### Configuration

In `.omb-config.json`:

```json
{
  "ohmyblack": {
    "enabled": true,
    "defaultValidationLevel": "validator",
    "autoTeamComposition": true,
    "metaPromptTemplates": "enabled"
  }
}
```

Environment variables:

```bash
OMB_OHMYBLACK_DEFAULT=true        # Enable for all commands
OMB_VALIDATION_LEVEL=validator    # Default validation rigor
OMB_AUTO_TEAM=true                # Auto-compose teams
OMB_TEMPLATE_ENGINE=disabled      # Meta-prompt templates
```

### Team Templates

| Template | Complexity | Members | Validation |
|----------|-----------|---------|------------|
| **minimal** | < 0.3 | `executor-low` | self-only |
| **standard** | < 0.5 | `executor`, `validator-syntax` | validator |
| **robust** | < 0.7 | `executor`, `validator-syntax`, `validator-logic` | validator |
| **secure** | < 0.9 | `executor-high`, `architect`, `validator-security`, `validator-logic` | architect |
| **fullstack** | >= 0.9 | 6+ members (builders + validators) | architect |

### State Files

```
.omb/state/
├── teams/
│   ├── minimal.json
│   ├── standard.json
│   ├── robust.json
│   ├── secure.json
│   └── fullstack.json
├── workflows/
│   ├── {workflow-id}.json
├── validations/
│   ├── {validation-id}.json
├── coordination/
│   ├── {coordinator-id}.json
```

### Backward Compatibility

ohmyblack is **fully backward compatible** with v3.9.5. All existing workflows continue unchanged. Enable features via:
- Command flags: `--ohmyblack`, `--auto-team`
- Configuration: `.omb-config.json`
- Environment: `OMB_OHMYBLACK_DEFAULT=true`

For detailed migration guide, see `docs/MIGRATION-OHMYBLACK.md`.

## Hook System (31+)

Key hooks in `src/hooks/`:

- `autopilot/` - Full autonomous execution
- `ralph/` - Persistence until verified
- `ultrawork/` - Parallel execution
- `ultrapilot/` - Parallel autopilot with ownership
- `swarm/` - Coordinated multi-agent
- `learner/` - Skill extraction
- `recovery/` - Error recovery
- `rules-injector/` - Rule file injection
- `think-mode/` - Enhanced reasoning
- `bv-integration/` - Builder-Validator cycle hooks (ohmyblack)

## Configuration

Settings in `~/.claude/.omb-config.json`:

```json
{
  "defaultExecutionMode": "ultrawork",
  "mcpServers": {
    "context7": { "enabled": true },
    "exa": { "enabled": true, "apiKey": "..." }
  }
}
```

<!-- MANUAL: Project-specific notes below this line are preserved on regeneration -->
