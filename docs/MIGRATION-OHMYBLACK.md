# Migration Guide: oh-my-black v3.9.5 → ohmyblack

This guide helps you migrate from oh-my-black v3.9.5 to the enhanced **ohmyblack** system, which adds powerful verification-driven workflows and intelligent team composition.

---

## Overview

### What's New in ohmyblack

ohmyblack augments oh-my-black v3.9.5 with:

- **Builder-Validator Cycles** - Every code change automatically verified before completion
- **Team Auto-Composition** - Intelligent team selection based on task complexity
- **Meta-prompt Generation** - Template-based consistent prompts across all agents
- **Enhanced Validation** - Syntax, logic, security, and integration validators
- **DAG-Based Workflow Execution** - Parallel execution with intelligent dependency management

### Backward Compatibility

**ohmyblack is fully backward compatible with v3.9.5.** All existing skills, agents, and modes work exactly as before. New features are opt-in via command flags.

### What Changes for You

| Aspect | Before (v3.9.5) | After (ohmyblack) | Migration Effort |
|--------|-----------------|-------------------|------------------|
| **Existing workflows** | Works as-is | Works identically | NONE |
| **Core commands** | `/oh-my-black:ralph`, `/oh-my-black:ultrawork` | Same, plus optional flags | OPTIONAL |
| **Verification** | Manual (architect verification) | Automatic (B-V cycles) | OPT-IN |
| **Team selection** | Manual specification | Automatic (complexity-based) | OPT-IN |
| **Configuration** | `.omb-config.json` | `.omb-config.json` + optional `.omb/templates/` | BACKWARD COMPATIBLE |

---

## Quick Migration Path

Choose your migration path based on your needs:

### Path 1: Zero Changes (Recommended for Production)

Keep using oh-my-black v3.9.5 exactly as-is. ohmyblack is installed alongside:

```bash
# v3.9.5 workflows continue working unchanged
autopilot: build a REST API
ralph: refactor the authentication system
ulw: fix all TypeScript errors
```

**No changes required. Your existing workflows continue working.**

### Path 2: Gradual Adoption (Recommended for New Projects)

Enable ohmyblack features incrementally for new projects:

```bash
# Step 1: Enable B-V cycles for standard tasks
ralph --ohmyblack "Your task here"

# Step 2: Enable auto-team composition
ultrawork --auto-team task1 task2 task3

# Step 3: Control validation level
autopilot --ohmyblack --validation=architect "complex task"
```

### Path 3: Full Adoption (For Exploration)

Use ohmyblack features exclusively:

```bash
# All new work uses ohmyblack
export OMB_OHMYBLACK_DEFAULT=true

# All modes now use B-V cycles and auto-team composition
autopilot "Your project"
```

---

## Migration Steps

### Step 1: Verify Installation

ohmyblack is distributed as part of the oh-my-black package starting with v4.0.0-rc1.

```bash
# Check version
npm list -g oh-my-black

# Should show v4.0.0-rc1 or later
# If you're on v3.9.5, stay there - ohmyblack is backward compatible
```

### Step 2: Configure ohmyblack (Optional)

Create or update `.omb-config.json` to enable ohmyblack features globally:

```json
{
  "defaultExecutionMode": "ultrawork",
  "ohmyblack": {
    "enabled": true,
    "defaultValidationLevel": "validator",
    "autoTeamComposition": true,
    "metaPromptTemplates": "enabled"
  }
}
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ohmyblack.enabled` | boolean | **true** | Globally enable ohmyblack features (B-V cycle) |
| `ohmyblack.defaultValidationLevel` | "self-only" \| "validator" \| "architect" | **"validator"** | Default validation rigor |
| `ohmyblack.autoTeamComposition` | boolean | true | Auto-select team by complexity |
| `ohmyblack.metaPromptTemplates` | "enabled" \| "disabled" | **"enabled"** | Use template-based prompts |

### Step 3: Understand Validation Levels

ohmyblack offers three validation levels you can choose for different situations:

| Level | Verification | Use Case | Speed Impact |
|-------|--------------|----------|--------------|
| **self-only** | Builder self-validates via LSP | Quick fixes, low-risk tasks | Minimal (+5%) |
| **validator** | + Dedicated syntax/logic validator | Standard feature implementation | Moderate (+15%) |
| **architect** | + Full architect review (opus) | Architecture changes, security-critical | Significant (+30%) |

#### Setting Validation Level Per Command

```bash
# Quick tasks - minimal verification
autopilot --ohmyblack --validation=self-only "Fix typo in docs"

# Standard tasks - recommended
ultrawork --ohmyblack --validation=validator task1 task2

# Critical tasks - full verification
ralph --ohmyblack --validation=architect "Refactor authentication"
```

### Step 4: Automatic Team Composition (Optional)

ohmyblack analyzes task complexity and automatically selects the right team:

```bash
# Task complexity < 0.3 (simple)
ultrawork --auto-team "Add a console.log statement"
# Team: executor-low only

# Task complexity ~0.5 (standard)
ultrawork --auto-team "Implement user profile page"
# Team: executor-medium + validator-syntax + validator-logic

# Task complexity > 0.8 (complex)
ultrawork --auto-team "Refactor entire auth system to OAuth 2.0"
# Team: executor-high + architect + 3 validators + security-reviewer
```

**Complexity Factors:**

- Lines of code to modify
- Number of files affected
- External dependencies involved
- Test coverage requirements
- Security implications

### Step 5: Use Meta-Prompt Templates (Optional)

For consistent prompts across teams, enable meta-prompt generation:

```bash
# Create template directory
mkdir -p .omb/templates

# Enable in config
echo '{"metaPromptTemplates": "enabled"}' >> ~/.claude/.omb-config.json

# Templates are auto-generated in .omb/templates/
# - agent.tpl - Agent behavior
# - plan.tpl - Work planning
# - task.tpl - Task structure
# - team.tpl - Team composition
```

**Template Variables Available:**

```
{TASK_DESCRIPTION} - User's task
{COMPLEXITY_SCORE} - Calculated complexity 0-1
{TEAM_MEMBERS} - Selected team
{VALIDATION_LEVEL} - Chosen validation rigor
{MAX_RETRIES} - Failure retries allowed
{TIMEOUT_SECONDS} - Task timeout
```

---

## New Features in Detail

### Builder-Validator Cycles

The core innovation in ohmyblack is the Builder-Validator (B-V) cycle:

```
┌─────────────────────────────────────┐
│  1. Builder executes task           │
├─────────────────────────────────────┤
│  2. Builder self-validates (LSP)    │
├─────────────────────────────────────┤
│  3. Validator independently checks  │
├─────────────────────────────────────┤
│  On failure:                        │
│  4. Retry (up to 3 times)          │
│  5. Escalate if unresolvable       │
└─────────────────────────────────────┘
```

**Enable B-V cycles:**

```bash
# For a single command
ralph --ohmyblack "Refactor authentication"

# For all commands (global)
export OMB_OHMYBLACK_DEFAULT=true
```

**B-V Cycle Behavior:**

| Stage | Agent | Tool | Output |
|-------|-------|------|--------|
| Build | executor | Code writing | Source code + LSP diagnostics |
| Self-Validate | executor | lsp_diagnostics | Error list |
| Validate | validator-syntax | AST analysis | Type/syntax verification |
| Validate | validator-logic | Test runner | Functional verification |
| Escalate | architect | Deep review | Root cause analysis |

### Team Auto-Composition

ohmyblack analyzes task complexity and auto-selects the optimal team:

```bash
# Let ohmyblack choose the team
ultrawork --auto-team "Your task"

# Or explicitly set complexity
ultrawork --complexity=0.7 task1 task2
```

**Team Selection Rules:**

| Complexity | Template | Team Composition | Cost Factor |
|------------|----------|------------------|-------------|
| < 0.3 | minimal | executor-low | 1x |
| < 0.5 | standard | executor-low + validator-syntax | 1.2x |
| < 0.7 | robust | executor + validator-syntax + validator-logic | 1.5x |
| < 0.9 | secure | executor-high + architect + 3 validators | 2.0x |
| >= 0.9 | fullstack | Multiple builders + full validation + security-reviewer | 2.5x |

**Complexity Calculation:**

```
complexity = (
  0.2 * (files_affected / max_typical_files) +
  0.3 * (dependencies / max_typical_deps) +
  0.2 * (line_changes / max_typical_lines) +
  0.2 * (security_risk_score) +
  0.1 * (test_coverage_needed)
)
```

### Validator Agents

ohmyblack introduces specialized validator agents:

| Agent | Model | Purpose | When Used |
|-------|-------|---------|-----------|
| **validator-syntax** | haiku | Type/syntax errors | Always (low cost) |
| **validator-logic** | sonnet | Functional correctness | Standard+ (logic checks) |
| **validator-security** | opus | Security vulnerabilities | Secure+ (security review) |
| **validator-integration** | sonnet | Cross-component compatibility | Robust+ (integration tests) |

**Validator Responsibilities:**

- **validator-syntax** - Type checking, linting, syntax errors
- **validator-logic** - Test execution, behavior verification
- **validator-security** - Vulnerability scan, secrets detection
- **validator-integration** - API compatibility, dependency checks

### Meta-Prompt Templates

Templates ensure consistent prompts across all team members:

**Location:** `.omb/templates/`

**Files:**

```
.omb/templates/
├── agent.tpl           # Agent role definition
├── plan.tpl            # Work planning template
├── task.tpl            # Task structure
└── team.tpl            # Team composition rules
```

**Example agent.tpl:**

```
You are {AGENT_ROLE}.

Task: {TASK_DESCRIPTION}
Complexity: {COMPLEXITY_SCORE}/1.0
Validation Level: {VALIDATION_LEVEL}
Team: {TEAM_MEMBERS}

Your role in this team:
{AGENT_SPECIFIC_INSTRUCTIONS}

Success criteria:
{SUCCESS_CRITERIA}

Failure handling:
If you encounter an error, {ERROR_HANDLING_STRATEGY}
```

---

## New State Files

### Team State Files

ohmyblack stores team definitions and workflow state:

**Location:** `.omb/state/`

| File | Purpose | Example |
|------|---------|---------|
| `teams/{id}.json` | Team definitions and composition | Team member list, roles |
| `workflows/{id}.json` | Current workflow state | DAG execution progress |
| `validations/{id}.json` | Validation results | B-V cycle outcomes |

**Example `teams/standard.json`:**

```json
{
  "id": "standard",
  "name": "Standard Implementation Team",
  "members": [
    {
      "agent": "executor-low",
      "model": "haiku",
      "role": "code_writer"
    },
    {
      "agent": "validator-syntax",
      "model": "haiku",
      "role": "syntax_checker"
    },
    {
      "agent": "validator-logic",
      "model": "sonnet",
      "role": "logic_validator"
    }
  ],
  "coordinationStrategy": "sequential",
  "retryLimit": 3,
  "timeoutSeconds": 300
}
```

### Extended Autopilot/Ralph/Ultrawork State

Existing state files gain an optional `ohmyblack` section when features are enabled:

```json
{
  "mode": "ralph",
  "tasks": [...],
  "ohmyblack": {
    "enabled": true,
    "team": "robust",
    "validationLevel": "validator",
    "bvResults": [
      {
        "taskId": "task-1",
        "buildOutput": "...",
        "validationsPassed": ["syntax", "logic"],
        "retries": 0,
        "status": "passed"
      }
    ]
  }
}
```

---

## Configuration Migration

### From v3.9.5 to ohmyblack

Your existing `.omb-config.json` remains valid. Add ohmyblack configuration optionally:

**Before (v3.9.5):**

```json
{
  "defaultExecutionMode": "ultrawork"
}
```

**After (ohmyblack):**

```json
{
  "defaultExecutionMode": "ultrawork",
  "ohmyblack": {
    "enabled": false,
    "defaultValidationLevel": "self-only",
    "autoTeamComposition": true
  }
}
```

### Environment Variables

ohmyblack uses environment variables for global configuration:

| Variable | Default | Purpose |
|----------|---------|---------|
| `OMB_OHMYBLACK_DEFAULT` | false | Enable ohmyblack for all commands |
| `OMB_VALIDATION_LEVEL` | "self-only" | Default validation rigor |
| `OMB_AUTO_TEAM` | true | Auto-compose teams |
| `OMB_TEMPLATE_ENGINE` | "disabled" | Meta-prompt templates |

---

## Usage Examples

### Example 1: Quick Bug Fix (self-only validation)

```bash
# Old v3.9.5 way (still works)
executor-low "Fix typo in src/utils.ts line 42"

# New ohmyblack way (with verification)
executor-low --ohmyblack --validation=self-only "Fix typo in src/utils.ts line 42"

# Result: 1 minute faster, includes automatic LSP validation
```

### Example 2: Feature Implementation (standard validation)

```bash
# Old v3.9.5 way
ultrawork "Implement user profile page"

# New ohmyblack way
ultrawork --auto-team "Implement user profile page"

# ohmyblack auto-selects:
# - executor (code implementation)
# - validator-syntax (type checking)
# - validator-logic (test verification)
# - validator-integration (API compatibility)
```

### Example 3: Complex Refactoring (architect validation)

```bash
# Old v3.9.5 way
architect "Plan authentication refactoring"
ralph "Refactor auth to OAuth 2.0"

# New ohmyblack way
ralph --ohmyblack --validation=architect "Refactor auth to OAuth 2.0"

# ohmyblack automatically:
# - Plans the refactoring
# - Selects full team (executor-high + architect)
# - Runs B-V cycles with architect validation
# - Escalates failures to architect-high
```

### Example 4: Persistent Task with Verification

```bash
# Mix traditional ralph with ohmyblack verification
ralph --ohmyblack "Don't stop until migration is complete"

# This enables:
# - Ralph-loop persistence (won't stop until done)
# - Builder-Validator cycles (each task verified)
# - Auto-team composition (right team per subtask)
# - Escalation on failure (architect reviews)
```

---

## Troubleshooting

### B-V Cycle Failing

**Problem:** Validator rejects builder's output.

**Solution:**

1. Check validation level - try `--validation=self-only` first
2. Review validator feedback for specific issues
3. Check for missing external dependencies or setup issues

```bash
# Increase verbosity to see validator output
OMB_DEBUG=true ralph --ohmyblack "Your task"

# Lower validation level for debugging
ultrawork --validation=self-only "Your task"
```

### Team Composition Not Matching Complexity

**Problem:** Task seems complex but gets minimal team.

**Solution:**

1. Verify complexity calculation: `OMB_DEBUG=complexity=true`
2. Manually override: `--team=robust` or `--complexity=0.8`
3. Check `.omb/state/teams/` for team definitions

```bash
# Force specific team
ultrawork --team=robust "Your complex task"

# Or manually set complexity
ultrawork --complexity=0.85 task1 task2
```

### Template Errors

**Problem:** Meta-prompt generation fails.

**Solution:**

1. Verify templates exist: `ls -la .omb/templates/`
2. Check template syntax: `npm run validate:templates`
3. Disable templates temporarily: `--no-templates`

```bash
# Regenerate templates
rm -rf .omb/templates/
/oh-my-black:omb-setup  # Reinstall OMB to regenerate

# Or manually create minimal templates
mkdir -p .omb/templates
cp ~/.omb/templates/* .omb/templates/  # From global template cache
```

### Performance Regression

**Problem:** Tasks are running slower with ohmyblack.

**Solution:**

ohmyblack adds verification overhead:
- `self-only` validation: +5-10% slower
- `validator` validation: +15-25% slower
- `architect` validation: +30-40% slower

**Optimize:**

```bash
# Use appropriate validation level
--validation=self-only   # For quick tasks
--validation=validator   # For standard work (default)
--validation=architect   # For critical/complex only

# Reduce team size for simple tasks
--team=minimal "Simple fix"

# Use ecomode to offset extra compute
eco ultrawork --auto-team "Your task"
```

---

## FAQ

**Q: Do I need to migrate all my workflows?**

A: No. Your v3.9.5 workflows continue working unchanged. Enable ohmyblack features gradually using `--ohmyblack` flag.

**Q: When should I use ohmyblack mode?**

A: Use ohmyblack when verification is important:
- New features (validation catches edge cases)
- Refactoring (validators ensure no regressions)
- Security-sensitive code
- Shared libraries (team-wide impact)

Skip ohmyblack for:
- Quick fixes, prototyping
- Well-tested code
- Budget-constrained projects

**Q: Can I mix old and new modes?**

A: Yes. Each command independently chooses its mode:

```bash
# Some commands use ohmyblack
ralph --ohmyblack "Complex refactoring"

# Others use traditional v3.9.5
ultrawork "Quick fixes"

# Both work together seamlessly
```

**Q: What's the performance/cost impact?**

A: ohmyblack adds compute cost for verification:

| Validation | Time Overhead | Token Overhead |
|------------|---------------|----------------|
| self-only | +5% | +10% |
| validator | +15% | +35% |
| architect | +30% | +50% |

Use `--validation=self-only` for quick tasks to minimize overhead.

**Q: Can I use ohmyblack with ecomode?**

A: Yes:

```bash
eco ralph --ohmyblack "Refactor API"
```

This enables:
- ecomode's token savings (smart routing)
- ohmyblack's verification (B-V cycles)
- Result: Efficient AND verified

**Q: What if I want to disable ohmyblack globally?**

A: ohmyblack is opt-in by default. Don't set `--ohmyblack` flag and it won't activate.

If you accidentally enabled it globally:

```bash
# Reset config
rm ~/.claude/.omb-config.json
/oh-my-black:omb-setup
```

---

## Best Practices for ohmyblack

### 1. Match Validation Level to Risk

| Risk Level | Validation | Rationale |
|------------|-----------|-----------|
| Low (docs, comments) | self-only | Fast, minimal overhead |
| Standard (features) | validator | Catches most issues |
| High (auth, security) | architect | Full oversight |

### 2. Use Auto-Team for New Projects

Let ohmyblack analyze complexity and select the team:

```bash
# Don't manually specify team
ultrawork --manual-team executor,validator-syntax

# Use auto-composition
ultrawork --auto-team "Your task"
```

### 3. Combine with Ralph for Critical Work

Ralph ensures completion + ohmyblack ensures quality:

```bash
# Don't stop until done + verify each step
ralph --ohmyblack "Migrate database schema"
```

### 4. Monitor B-V Cycle Results

Check validation results after work:

```bash
# View B-V cycle history
cat .omb/state/validations/latest.json

# Analyze validator feedback
OMB_DEBUG=validation=true ultrawork "Your task"
```

### 5. Tune Templates for Your Team

Customize meta-prompt templates for your coding style:

```bash
# Review generated templates
cat .omb/templates/agent.tpl

# Customize for your needs
edit .omb/templates/agent.tpl

# They'll be used for all subsequent tasks
```

---

## Rollback to v3.9.5

If you need to return to pure v3.9.5 behavior:

```bash
# Disable ohmyblack entirely
echo '{"ohmyblack": {"enabled": false}}' > ~/.claude/.omb-config.json

# Or remove the option to use defaults
rm ~/.claude/.omb-config.json

# Existing workflows continue working
autopilot: build a REST API
ralph: refactor authentication
```

No data is lost - ohmyblack state files are optional and non-destructive.

---

## Stay Updated

- **GitHub:** [oh-my-black releases](https://github.com/black940514/oh-my-black)
- **Changelog:** See [CHANGELOG.md](../CHANGELOG.md)
- **Documentation:** See [docs/](../)

---

## Summary

| What | Before (v3.9.5) | After (ohmyblack) | Effort |
|-----|-----------------|-------------------|--------|
| **Your workflows** | Work perfectly | Work identically | NONE |
| **Optional enhancements** | N/A | B-V cycles, auto-team, templates | OPT-IN |
| **Configuration changes** | None required | Optional `.omb-config.json` update | OPTIONAL |
| **State files** | No changes | New optional files in `.omb/state/` | BACKWARD COMPATIBLE |
| **Rollback** | Not needed | Simple config change | ALWAYS POSSIBLE |

**Recommendation:** Leave v3.9.5 as-is unless you specifically want verification benefits. Try ohmyblack features incrementally using `--ohmyblack` flag for critical projects. No rush - both systems work together seamlessly.
