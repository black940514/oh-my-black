---
name: ralplan
description: Iterative planning with Planner, Architect, and Critic until consensus
---

# Ralplan Command

**This is an alias for `/plan --consensus`**

Ralplan orchestrates three specialized agents—Planner, Architect, and Critic—in an iterative loop until consensus is reached on a comprehensive work plan.

## Usage

```
/oh-my-black:ralplan [task]
```

## What It Does

Invokes the plan skill with --consensus mode, which:
1. Creates initial plan with Planner agent
2. Consults Architect for architectural questions
3. Reviews with Critic agent
4. Iterates until Critic approves (max 5 iterations)

## Implementation

When this skill is invoked, immediately invoke the plan skill with consensus mode:

```
Invoke Skill: plan --consensus {{ARGUMENTS}}
```

Pass all arguments to the plan skill. The plan skill handles all consensus logic, state management, and iteration.

## CRITICAL: Plan-Only Mode (No Auto-Implementation)

**STOP AFTER PLANNING IS COMPLETE.**

When the Critic approves the plan:
1. Save the plan to `.omb/plans/`
2. Display: "✅ [RALPLAN 완료] 계획이 승인되었습니다."
3. **DO NOT automatically implement the plan**
4. **DO NOT continue to code generation**
5. Ask: "구현을 시작하시겠습니까? (autopilot/ralph/manual)"

**Override Continuation Enforcement:** The ralplan task is COMPLETE when the plan is approved and saved. The "FUNCTIONALITY" check does NOT apply to planning tasks - the deliverable is the PLAN, not the implementation.

This prevents automatic implementation after planning, giving the user control over when to start coding.

## See Also

- `/plan` - Base planning skill with all modes
- `/plan --consensus` - Direct invocation of consensus mode
- `/cancel` - Cancel active planning session
