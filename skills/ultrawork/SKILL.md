---
name: ultrawork
description: Parallel execution engine for high-throughput task completion
---

# Ultrawork Skill

Parallel execution engine. This is a **COMPONENT**, not a standalone persistence mode.

## What Ultrawork Provides

1. **Parallel Execution**: Running multiple agents simultaneously for independent tasks
2. **Background Operations**: Using `run_in_background: true` for long operations
3. **Smart Model Routing**: Using tiered agents to save tokens

## What Ultrawork Does NOT Provide

- **Persistence**: Use `ralph` for "don't stop until done" behavior
- **Verification Loop**: Use `ralph` for mandatory architect verification
- **State Management**: Use `ralph` or `autopilot` for session persistence

## Usage

Ultrawork is automatically activated by:
- `ralph` (for persistent parallel work)
- `autopilot` (for autonomous parallel work)
- Direct invocation when you want parallel-only execution with manual oversight

## Smart Model Routing

**FIRST ACTION:** Before delegating any work, read the agent reference file:
```
Read file: docs/shared/agent-tiers.md
```
This provides the complete agent tier matrix, MCP tool assignments, and selection guidance.

**CRITICAL: Always pass `model` parameter explicitly!**

```
Task(subagent_type="oh-my-black:architect-low", model="haiku", prompt="...")
Task(subagent_type="oh-my-black:executor", model="sonnet", prompt="...")
Task(subagent_type="oh-my-black:architect", model="opus", prompt="...")
```

## Background Execution Rules

**Run in Background** (set `run_in_background: true`):
- Package installation (npm install, pip install, cargo build, etc.)
- Build processes (project build command, make, etc.)
- Test suites (project test command, etc.)

**Run Blocking** (foreground):
- Quick status checks: git status, ls, pwd
- File reads, edits
- Simple commands

## Relationship to Other Modes

```
ralph (persistence wrapper)
└── includes: ultrawork (this skill)
    └── provides: parallel execution only

autopilot (autonomous execution)
└── includes: ralph
    └── includes: ultrawork (this skill)

ecomode (token efficiency)
└── modifies: ultrawork's model selection
```

## When to Use Ultrawork Directly

Use ultrawork directly when you want:
- Parallel execution without persistence guarantees
- Manual oversight over completion
- Quick parallel tasks where you'll verify yourself

Use `ralph` instead when you want:
- Verified completion (architect check)
- Automatic retry on failure
- Session persistence for resume

## Completion Verification (Direct Invocations)

When ultrawork is invoked directly (not via ralph), apply lightweight verification before claiming completion:

### Quick Verification Checklist
- [ ] **BUILD:** Project type check/build command passes
- [ ] **TESTS:** Run affected tests, all pass
- [ ] **ERRORS:** No new errors introduced

This is lighter than ralph's full verification but ensures basic quality for direct ultrawork usage.

For full persistence and comprehensive verification, use `ralph` mode instead.

---

## Builder-Validator Mode

Ultrawork supports parallel B-V cycles for structured validation of parallel tasks. Enable this mode with the `--bv` flag.

### Usage

```
ultrawork --bv task1 task2 task3
```

Or with additional options:

```
ultrawork --bv --max-parallel-bv 5 --validation validator "fix auth" "fix api" "fix tests"
```

### Behavior

When B-V mode is enabled:

1. **B-V cycles run in parallel** (up to `maxParallelBVCycles`)
   - Each task gets its own Builder-Validator cycle
   - Cycles run concurrently for maximum throughput
   - Independent validation ensures quality without blocking

2. **Each task is independently validated**
   - Builder agent executes the task
   - Validator agent verifies the output
   - Failed tasks can be retried without blocking others

3. **Failed tasks can be retried without blocking others**
   - Retries happen within each task's B-V cycle
   - Other tasks continue executing
   - Final results aggregated after all tasks complete

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--bv` | false | Enable Builder-Validator mode |
| `--validation` | `validator` | Validation type: `self-only`, `validator`, `architect` |
| `--max-parallel-bv` | 3 | Maximum parallel B-V cycles |
| `--max-retries` | 3 | Maximum retry attempts per task |
| `--fail-fast` | false | Stop all tasks on first failure |

### Validation Types

- **self-only**: Builder validates its own output (fastest, least rigorous)
- **validator**: Separate validator agent checks the output (balanced)
- **architect**: Architect-level verification (most rigorous)

### Fail-Fast Mode

With `--fail-fast`, ultrawork stops all parallel execution when any task fails:

```
ultrawork --bv --fail-fast "critical-task-1" "critical-task-2"
```

Without fail-fast (default), all tasks run to completion regardless of individual failures.

### Team Integration

When using team workflow, B-V cycles are coordinated through the team:

- Builder role executes tasks
- Validator role verifies outputs
- Coordinator manages parallel execution

### State Files

B-V ultrawork state is persisted at:
- `.omb/state/ultrawork-bv-state.json` - B-V cycle state
- `.omb/state/ultrawork-state.json` - Regular ultrawork state

### Example Workflow

1. Ultrawork receives multiple tasks
2. Schedules first batch (up to `maxParallelBVCycles`)
3. For each parallel task:
   - Builder agent executes the task
   - Validator checks output
   - If validation fails: retry within the task's cycle
   - If validation passes: task marked complete
4. When a slot opens, schedule next pending task
5. Continue until all tasks complete or fail-fast triggered
6. Generate aggregated B-V report

### B-V Report

After completion, ultrawork generates a B-V report showing:
- Total tasks processed
- Parallel batches executed
- Tasks completed/failed
- Total B-V cycles run
- Total retries performed
- Peak parallelism achieved
- Average cycle time
- Success rate
