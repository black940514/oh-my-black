---
name: ralph
description: Self-referential loop until task completion with architect verification
---

# Ralph Skill

[RALPH + ULTRAWORK - ITERATION {{ITERATION}}/{{MAX}}]

Your previous attempt did not output the completion promise. Continue working on the task.

## PRD MODE (OPTIONAL)

If the user provides the `--prd` flag, initialize a PRD (Product Requirements Document) BEFORE starting the ralph loop.

### Detecting PRD Mode

Check if `{{PROMPT}}` contains the flag pattern: `--prd` or `--PRD`

### PRD Initialization Workflow

When `--prd` flag detected:

1. **Create PRD File Structure** (`.omb/prd.json` and `.omb/progress.txt`)
2. **Parse the task** (everything after `--prd` flag)
3. **Break down into user stories** with this structure:

```json
{
  "project": "[Project Name]",
  "branchName": "ralph/[feature-name]",
  "description": "[Feature description]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[Short title]",
      "description": "As a [user], I want to [action] so that [benefit].",
      "acceptanceCriteria": ["Criterion 1", "Typecheck passes"],
      "priority": 1,
      "passes": false
    }
  ]
}
```

4. **Create progress.txt**:

```
# Ralph Progress Log
Started: [ISO timestamp]

## Codebase Patterns
(No patterns discovered yet)

---
```

5. **Guidelines for PRD creation**:
   - Right-sized stories: Each completable in one focused session
   - Verifiable criteria: Include "Typecheck passes", "Tests pass"
   - Independent stories: Minimize dependencies
   - Priority order: Foundational work (DB, types) before UI

6. **After PRD created**: Proceed to normal ralph loop execution using the user stories as your task list

### Example Usage

User input: `--prd build a todo app with React and TypeScript`

Your workflow:
1. Detect `--prd` flag
2. Extract task: "build a todo app with React and TypeScript"
3. Create `.omb/prd.json` with user stories
4. Create `.omb/progress.txt`
5. Begin ralph loop using user stories as task breakdown

## ULTRAWORK MODE (AUTO-ACTIVATED)

Ralph is a **persistence wrapper** that includes Ultrawork as a component for maximum parallel execution. You MUST follow these rules:

### Parallel Execution Rules
- **PARALLEL**: Fire independent calls simultaneously - NEVER wait sequentially
- **BACKGROUND FIRST**: Use Task(run_in_background=true) for long operations (10+ concurrent)
- **DELEGATE**: Route tasks to specialist agents immediately

### Smart Model Routing (SAVE TOKENS)

| Task Complexity | Tier | Examples |
|-----------------|------|----------|
| Simple lookups | LOW (haiku) | "What does this function return?", "Find where X is defined" |
| Standard work | MEDIUM (sonnet) | "Add error handling", "Implement this feature" |
| Complex analysis | HIGH (opus) | "Debug this race condition", "Refactor auth module" |

### Available Agents by Tier

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

### Background Execution Rules

**Run in Background** (set `run_in_background: true`):
- Package installation (npm install, pip install, cargo build, etc.)
- Build processes (project build command, make, etc.)
- Test suites (project test command, etc.)
- Docker operations: docker build, docker pull

**Run Blocking** (foreground):
- Quick status checks: git status, ls, pwd
- File reads, edits
- Simple commands

## COMPLETION REQUIREMENTS

Before claiming completion, you MUST:
1. Verify ALL requirements from the original task are met
2. Ensure no partial implementations
3. Check that code compiles/runs without errors
4. Verify tests pass (if applicable)
5. TODO LIST: Zero pending/in_progress tasks

## VERIFICATION BEFORE COMPLETION (IRON LAW)

**NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE**

Before outputting the completion promise:

### Steps (MANDATORY)
1. **IDENTIFY**: What command proves the task is complete?
2. **RUN**: Execute verification (test, build, lint)
3. **READ**: Check output - did it actually pass?
4. **ONLY THEN**: Proceed to Architect verification

### Red Flags (STOP and verify)
- Using "should", "probably", "seems to"
- About to output completion without fresh evidence
- Expressing satisfaction before verification

### Evidence Chain
1. Fresh test run output showing pass
2. Fresh build output showing success
3. lsp_diagnostics showing 0 errors
4. THEN Architect verification
5. THEN completion promise

**Skipping verification = Task NOT complete**

## VERIFICATION PROTOCOL (TIERED)

Ralph uses tiered verification to save tokens while maintaining quality.

### Verification Tier Selection

Before spawning architect for verification, determine the appropriate tier:

| Change Profile | Tier | Agent |
|----------------|------|-------|
| <5 files, <100 lines, full tests | LIGHT | architect-low (haiku) |
| Standard changes | STANDARD | architect-medium (sonnet) |
| >20 files, security/architectural | THOROUGH | architect (opus) |

### Ralph Minimum Verification Tier

**Floor: STANDARD (architect-medium / sonnet)**

Even for small changes (<5 files), ralph requires at least STANDARD tier verification. The LIGHT tier (haiku) is insufficient for ralph's completion guarantee. When tier selection returns LIGHT, upgrade to STANDARD.

### Verification Flow

1. **Collect change metadata**: Count files, lines, detect security/architectural patterns
2. **Select tier**: Apply rules from `/docs/shared/verification-tiers.md`
3. **Spawn appropriate architect**:
   ```
   // LIGHT - small, well-tested changes
   Task(subagent_type="oh-my-black:architect-low", model="haiku", prompt="Quick verification: [describe changes]")

   // STANDARD - most changes
   Task(subagent_type="oh-my-black:architect-medium", model="sonnet", prompt="Verify implementation: [describe changes]")

   // THOROUGH - large/security/architectural changes
   Task(subagent_type="oh-my-black:architect", model="opus", prompt="Full verification: [describe changes]")
   ```
4. **Wait for verdict**
5. **If approved**: Run `/oh-my-black:cancel` to cleanly exit
6. **If rejected**: Fix issues and re-verify (same tier)

For complete tier selection rules, read: `docs/shared/verification-tiers.md`

## ZERO TOLERANCE

- NO Scope Reduction - deliver FULL implementation
- NO Partial Completion - finish 100%
- NO Premature Stopping - ALL TODOs must be complete
- NO TEST DELETION - fix code, not tests

## STATE CLEANUP ON COMPLETION

**IMPORTANT: Use the cancel skill for proper state cleanup**

When work is complete and Architect verification passes, run `/oh-my-black:cancel` to cleanly exit ralph mode. This handles:
- Deletion of ralph state files (both local and global)
- Cleanup of linked ultrawork or ecomode state
- Proper termination of the ralph loop

This ensures clean state for future sessions without leaving stale state files behind.

## INSTRUCTIONS

- Review your progress so far
- Continue from where you left off
- Use parallel execution and background tasks
- When FULLY complete AND Architect verified: Run `/oh-my-black:cancel` to cleanly exit and clean up all state files
- Do not stop until the task is truly done

Original task:
{{PROMPT}}

---

## Builder-Validator Mode

Ralph now supports B-V validation cycles for structured task verification. Enable this mode with the `--bv` flag.

### Usage

```
ralph --bv "Complete the feature implementation"
```

Or with additional options:

```
ralph --bv --validation architect --max-retries 5 "Implement secure authentication"
```

### Behavior

When B-V mode is enabled:

1. **Each task goes through a Builder-Validator cycle**
   - Builder agent executes the task
   - Validator agent verifies the output
   - Failed validations trigger automatic retry

2. **Retry Logic**
   - Failed validations are retried up to `maxRetries` times (default: 3)
   - Each retry includes feedback from the previous validation
   - Persistent issues (same issue across 2+ attempts) trigger escalation

3. **Escalation Handling**
   - Security issues escalate to architect
   - 5+ failed attempts escalate to human
   - Escalations pause ralph until resolved (configurable)

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--bv` | false | Enable Builder-Validator mode |
| `--validation` | `validator` | Validation type: `self-only`, `validator`, `architect` |
| `--max-retries` | 3 | Maximum retry attempts per task |
| `--continue-on-failure` | false | Continue ralph loop even if validation fails |
| `--escalation` | `pause` | Escalation mode: `pause`, `skip`, `force-continue` |

### Validation Types

- **self-only**: Builder validates its own output (fastest, least rigorous)
- **validator**: Separate validator agent checks the output (balanced)
- **architect**: Architect-level verification (most rigorous, for critical changes)

### Integration with PRD Mode

B-V mode works seamlessly with PRD mode. Each user story in the PRD goes through the B-V cycle:

```
ralph --prd --bv "Build a todo app with React and TypeScript"
```

### State Files

B-V ralph state is persisted alongside regular ralph state:
- `.omb/state/ralph-bv-state.json` - B-V cycle state
- `.omb/state/ralph-state.json` - Regular ralph state

### Example Workflow

1. Ralph breaks task into subtasks (or uses PRD user stories)
2. For each subtask:
   - Builder agent executes the subtask
   - Validator checks output against acceptance criteria
   - If validation fails:
     - Retry with feedback (up to max retries)
     - Escalate if retries exhausted or critical issue
   - If validation passes:
     - Proceed to next subtask
3. Architect verification at the end (unchanged from regular ralph)

### B-V Report

After completion, ralph generates a B-V report showing:
- Tasks attempted/completed/failed
- Total B-V cycles run
- Total retries performed
- Escalations raised
- Overall success rate
