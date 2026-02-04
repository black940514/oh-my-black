---
name: autopilot
description: Full autonomous execution from idea to working code
---

# Autopilot Skill

Full autonomous execution from idea to working code.

## Overview

Autopilot is the ultimate hands-off mode. Give it a brief product idea (2-3 lines) and it handles everything:

1. **Understands** your requirements (Analyst)
2. **Designs** the technical approach (Architect)
3. **Plans** the implementation (Critic-validated)
4. **Builds** with parallel agents (Ralph + Ultrawork)
5. **Tests** until everything passes (UltraQA)
6. **Validates** quality and security (Multi-architect review)

## Usage

```
/oh-my-black:autopilot <your idea>
/oh-my-black:ap "A CLI tool that tracks daily habits"
/oh-my-black:autopilot Add dark mode to the app
```

## Magic Keywords

These phrases auto-activate autopilot:
- "autopilot", "auto pilot", "autonomous"
- "build me", "create me", "make me"
- "full auto", "handle it all"
- "I want a/an..."

## Phases

### Phase 0: Expansion

**Goal:** Turn vague idea into detailed spec

**Agents:**
- Analyst (Opus) - Extract requirements
- Architect (Opus) - Technical specification

**Output:** `.omb/autopilot/spec.md`

### Phase 1: Planning

**Goal:** Create implementation plan from spec

**Agents:**
- Architect (Opus) - Create plan (direct mode, no interview)
- Critic (Opus) - Validate plan

**Output:** `.omb/plans/autopilot-impl.md`

### Phase 2: Execution

**Goal:** Implement the plan

**Mode:** Ralph + Ultrawork (persistence + parallelism)

**Agents:**
- Executor-low (Haiku) - Simple tasks
- Executor (Sonnet) - Standard tasks
- Executor-high (Opus) - Complex tasks

### Phase 3: QA

**Goal:** All tests pass

**Mode:** UltraQA

**Cycle:**
1. Build
2. Lint
3. Test
4. Fix failures
5. Repeat (max 5 cycles)

### Phase 4: Validation

**Goal:** Multi-perspective approval

**Agents (parallel):**
- Architect - Functional completeness
- Security-reviewer - Vulnerability check
- Code-reviewer - Quality review

**Rule:** All must APPROVE or issues get fixed and re-validated.

## Configuration

Optional settings in `.claude/settings.json`:

```json
{
  "omc": {
    "autopilot": {
      "maxIterations": 10,
      "maxQaCycles": 5,
      "maxValidationRounds": 3,
      "pauseAfterExpansion": false,
      "pauseAfterPlanning": false,
      "skipQa": false,
      "skipValidation": false
    }
  }
}
```

## Cancellation

```
/oh-my-black:cancel
```

Or say: "stop", "cancel", "abort"

Progress is preserved for resume.

## Resume

If autopilot was cancelled or failed, just run `/oh-my-black:autopilot` again to resume from where it stopped.

## Examples

**New Project:**
```
/oh-my-black:autopilot A REST API for a bookstore inventory with CRUD operations
```

**Feature Addition:**
```
/oh-my-black:autopilot Add user authentication with JWT tokens
```

**Enhancement:**
```
/oh-my-black:ap Add dark mode support with system preference detection
```

## Best Practices

1. **Be specific about the domain** - "bookstore" not "store"
2. **Mention key features** - "with CRUD", "with authentication"
3. **Specify constraints** - "using TypeScript", "with PostgreSQL"
4. **Let it run** - Don't interrupt unless truly needed

## Ohmyblack Mode (Enhanced)

Autopilot now supports ohmyblack mode for enhanced reliability and consistency. This mode integrates:

- **Team Auto-Composition**: Automatically selects optimal team based on task analysis
- **Builder-Validator Cycles**: Every task verified before completion
- **Meta-prompt Generation**: Consistent, template-based agent prompts

### Activation

```
/oh-my-black:autopilot --ohmyblack "Build a REST API"
```

Or automatically when task complexity > 0.5 (configurable via `complexityThreshold`).

### Features

| Feature | Description |
|---------|-------------|
| **Team Auto-Composition** | Analyzes task to select minimal, standard, robust, secure, or fullstack team |
| **B-V Cycles** | Validates each task output with appropriate validator (self, validator, or architect) |
| **Meta-prompts** | Generates consistent prompts from templates for all agents |
| **Parallel Execution** | Runs independent tasks in parallel with file ownership tracking |
| **Retry Logic** | Automatic retries with escalation policy |

### Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `--ohmyblack` | false | Enable ohmyblack mode explicitly |
| `--validation` | validator | Validation type: self-only, validator, architect |
| `--team` | auto | Team template: minimal, standard, robust, secure, fullstack |
| `--max-workers` | 3 | Maximum parallel workers |
| `--no-bv` | false | Disable B-V cycles |
| `--complexity-threshold` | 0.5 | Auto-enable ohmyblack above this complexity |

### Flow

```
[Task] --> [Analyze] --> [Decompose] --> [Auto-Compose Team]
                                              |
                                              v
                              [Generate Meta-Prompts for Tasks]
                                              |
                                              v
                              [Execute with B-V Cycles (parallel)]
                                              |
                                              v
                              [Aggregate Results & Report]
                                              |
                                              v
                                    [Verified Complete]
```

### Validation Types

| Type | When Used | Validators |
|------|-----------|------------|
| `self-only` | Simple tasks (complexity < 0.3) | Builder self-validates |
| `validator` | Medium tasks (0.3 <= complexity < 0.7) | Dedicated validator agent |
| `architect` | Complex tasks (complexity >= 0.7) | Architect-level review |

### Team Templates

| Template | Members | Use Case |
|----------|---------|----------|
| `minimal` | 1 builder | Simple, low-complexity tasks |
| `standard` | 1 builder, 1 validator | Most common tasks |
| `robust` | 1 builder, 2 validators | Medium complexity with dual validation |
| `secure` | 1 builder, 3 validators | Security-sensitive code |
| `fullstack` | Multiple builders, full validation | Complex multi-component systems |

### State File

The ohmyblack state extends the base autopilot state:

```json
{
  "mode": "autopilot",
  "task": "...",
  "ohmyblack": {
    "enabled": true,
    "sessionId": "ohmyblack-1234567890-abc123",
    "config": {
      "autoComposeTeam": true,
      "enableBVCycles": true,
      "useMetaPrompts": true,
      "validationType": "validator",
      "maxParallelWorkers": 3
    },
    "team": {
      "id": "team-xxx",
      "name": "Auto-composed team",
      "template": "standard"
    },
    "bvResults": []
  }
}
```

### Example with Ohmyblack

```
/oh-my-black:autopilot --ohmyblack --validation architect "Build a secure REST API with JWT authentication"
```

This will:
1. Analyze the task (detects: security keywords, API patterns)
2. Auto-compose a `secure` team (builder + 3 validators including security)
3. Decompose into subtasks with file ownership
4. Generate meta-prompts for each task
5. Execute in parallel with B-V cycles
6. Require architect approval for each task
7. Generate final verification report

## STATE CLEANUP ON COMPLETION

**IMPORTANT: Delete ALL state files on successful completion**

When autopilot reaches the `complete` phase (all validation passed):

```bash
# Delete autopilot and all sub-mode state files
rm -f .omb/state/autopilot-state.json
rm -f .omb/state/ralph-state.json
rm -f .omb/state/ultrawork-state.json
rm -f .omb/state/ultraqa-state.json
```

This ensures clean state for future sessions.

## Troubleshooting

**Stuck in a phase?**
- Check TODO list for blocked tasks
- Review `.omb/autopilot-state.json` for state
- Cancel and resume if needed

**Validation keeps failing?**
- Review the specific issues
- Consider if requirements were too vague
- Cancel and provide more detail

**QA cycles exhausted?**
- Same error 3 times = fundamental issue
- Review the error pattern
- May need manual intervention
