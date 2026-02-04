---
description: Cancel any active OMB mode (autopilot, ralph, ultrawork, ecomode, ultraqa, swarm, ultrapilot, pipeline)
---

# Cancel Command

[UNIFIED CANCEL - INTELLIGENT MODE DETECTION]

You are cancelling the active OMB mode. The cancel skill will automatically detect which mode is running and clean it up properly.

## Auto-Detection

The skill checks state files to determine what's active and cancels in order of dependency:

1. **Autopilot** - Stops workflow, preserves progress for resume, cleans up ralph/ultraqa
2. **Ralph** - Stops persistence loop, cleans up linked ultrawork or ecomode
3. **Ultrawork** - Stops parallel execution (standalone)
4. **Ecomode** - Stops token-efficient execution (standalone)
5. **UltraQA** - Stops QA cycling workflow
6. **Swarm** - Stops coordinated agents, releases claimed tasks
7. **Ultrapilot** - Stops parallel autopilot workers
8. **Pipeline** - Stops sequential agent chain

## Usage

Basic cancellation (auto-detects mode):
```
/oh-my-black:cancel
```

Force clear ALL state files:
```
/oh-my-black:cancel --force
/oh-my-black:cancel --all
```

## User Arguments

{{ARGUMENTS}}

## State Files Checked

- `.omb/state/autopilot-state.json` → Autopilot
- `.omb/state/ralph-state.json` → Ralph
- `.omb/state/ultrawork-state.json` → Ultrawork
- `.omb/state/ecomode-state.json` → Ecomode
- `.omb/state/ultraqa-state.json` → UltraQA
- `.omb/state/swarm.db` (SQLite) or `.omb/state/swarm-active.marker` → Swarm
- `.omb/state/ultrapilot-state.json` → Ultrapilot
- `.omb/state/pipeline-state.json` → Pipeline

## What Gets Preserved

| Mode | Progress Preserved | Resume |
|------|-------------------|--------|
| Autopilot | Yes (phase, spec, plan) | `/oh-my-black:autopilot` |
| All Others | No | N/A |

## Dependency-Aware Cleanup

- **Autopilot cancellation** → Cleans ralph + ultraqa if active
- **Ralph cancellation** → Cleans linked ultrawork OR ecomode if applicable
- **Force mode** → Clears ALL state files regardless of what's active

## Exit Messages

The skill will report:
- Which mode was cancelled
- What phase/iteration it was in (if applicable)
- What dependent modes were cleaned up
- How to resume (if applicable)

## Implementation

Run the cancel skill which contains the full bash implementation for intelligent mode detection and cleanup.
