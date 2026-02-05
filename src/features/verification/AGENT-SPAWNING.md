# Agent Spawning Architecture - Hook-Based Bridge Pattern

## Overview

The Builder-Validator (B-V) cycle requires spawning real agents with full project context. Since TypeScript hooks cannot directly call the Task tool, we use a **hook-based bridge pattern** where the hook instructs the main LLM to spawn agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. WRITE REQUEST                                                 │
│    spawnBuilderAgent() writes to .omb/state/bv-requests/        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. HOOK READS REQUEST (PostToolUse)                             │
│    bv-spawner hook detects pending requests                     │
│    Marks request as "processing"                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. HOOK RETURNS INSTRUCTIONS                                    │
│    formatSpawnInstructions() generates LLM-readable message     │
│    Includes: agent type, model, prompt, response format         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. MAIN LLM SPAWNS AGENT                                        │
│    Reads instructions from hook output                          │
│    Calls Task tool: Task(subagent_type, model, prompt)          │
│    Agent executes with full project context                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. MAIN LLM WRITES RESPONSE                                     │
│    After agent completes, writes to .omb/state/bv-responses/   │
│    Format: { requestId, success, parsedOutput, duration }       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. POLL FOR RESPONSE                                            │
│    spawnBuilderAgent() polls response directory                 │
│    Returns SpawnResult to caller                                │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Agent Spawner (`agent-spawner.ts`)

**Responsibility**: Request/response coordination

**Key Functions**:
- `spawnBuilderAgent()` - Write request, poll for response
- `writeRequest()` - Write request to `.omb/state/bv-requests/`
- `pollForResponse()` - Poll `.omb/state/bv-responses/` with timeout

**Configuration**:
- `USE_CLI_FALLBACK` - Enable CLI spawning for testing (set `OMB_CLI_FALLBACK=true`)
- Default: Uses hook-based bridge pattern

### 2. BV Spawner Hook (`hooks/bv-spawner/index.ts`)

**Responsibility**: Read requests, generate instructions

**Key Functions**:
- `processPendingRequests(directory)` - Read pending requests, mark as processing
- `formatSpawnInstructions(instructions)` - Generate LLM instructions

**Called from**: `bridge.ts` PostToolUse hook

### 3. Hook Bridge (`hooks/bridge.ts`)

**Responsibility**: Integration point

**PostToolUse Handler**:
```typescript
const bvInstructions = processPendingRequests(directory);
if (bvInstructions.length > 0) {
  const bvMessage = formatSpawnInstructions(bvInstructions);
  messages.push(bvMessage);
}
```

## Request/Response Format

### Request (`.omb/state/bv-requests/{requestId}.json`)

```json
{
  "requestId": "uuid-v4",
  "agentType": "validator-syntax",
  "model": "haiku",
  "prompt": "Verify syntax of changes...",
  "taskId": "task-123",
  "timeout": 120000,
  "createdAt": 1234567890,
  "status": "pending"
}
```

### Response (`.omb/state/bv-responses/{requestId}.json`)

```json
{
  "requestId": "uuid-v4",
  "success": true,
  "rawOutput": "Full agent output...",
  "parsedOutput": {
    "agentId": "agent-456",
    "taskId": "task-123",
    "status": "success",
    "summary": "Syntax check passed",
    "evidence": [
      { "type": "command_output", "content": "...", "passed": true }
    ],
    "timestamp": 1234567890
  },
  "completedAt": 1234567890,
  "duration": 5000
}
```

## Status Transitions

```
pending → processing → (response written by main LLM)
    ↓
  timeout (if no response after 120s)
```

## Why Hook-Based Bridge?

### ❌ Direct CLI Spawning (Old Approach)

```typescript
// agent-spawner.ts
spawn('claude', ['--print', '--model', model, prompt])
```

**Problems**:
- No project context (files, structure)
- No Task tool capabilities
- No agent tracking
- Just a one-shot prompt

### ✅ Hook-Based Bridge (New Approach)

```typescript
// 1. Write request
writeRequest({ agentType, model, prompt })

// 2. Hook detects and instructs
return { message: "Spawn oh-my-black:validator-syntax..." }

// 3. Main LLM spawns with Task tool
Task(subagent_type="oh-my-black:validator-syntax", model="haiku", ...)

// 4. Main LLM writes response
writeFileSync('.omb/state/bv-responses/...')

// 5. Poll returns result
const response = await pollForResponse(requestId)
```

**Benefits**:
- Full project context via Task tool
- Proper agent orchestration
- Agent tracking and metrics
- Can read files, use MCP tools

## Configuration

### Enable CLI Fallback (for testing)

```bash
export OMB_CLI_FALLBACK=true
```

When enabled:
- Skips hook-based bridge
- Uses direct `claude --print` spawning
- Useful for standalone testing without main LLM

### Default Behavior

- Hook-based bridge active
- PostToolUse hook processes requests
- Main LLM spawns agents via Task tool

## Debugging

### Check Pending Requests

```bash
ls -la .omb/state/bv-requests/
cat .omb/state/bv-requests/*.json
```

### Check Responses

```bash
ls -la .omb/state/bv-responses/
cat .omb/state/bv-responses/*.json
```

### Enable Verbose Logging

```bash
export OMB_DEBUG=1
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Timeout after 120s | Hook not processing requests | Check PostToolUse hook is active |
| Request stuck in "pending" | Hook not marking as "processing" | Check `processPendingRequests()` runs |
| No response file | Main LLM not spawning agent | Check hook message in LLM context |
| Empty response | Agent failed | Check agent output in rawOutput field |

## Future Improvements

1. **Parallel Spawning**: Process multiple requests concurrently
2. **Priority Queue**: High-priority validators first
3. **Retry Logic**: Auto-retry failed spawns
4. **Metrics Dashboard**: Spawn success rates, durations
5. **Agent Pooling**: Reuse agents for multiple validations

## References

- Builder-Validator Cycle: `builder-validator.ts`
- Agent Output Schema: `agent-output/schema.ts`
- Hook Integration: `hooks/bridge.ts`
