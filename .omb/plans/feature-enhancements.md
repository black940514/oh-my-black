# Feature Enhancements Plan: Plugin-Inspired Upgrades for oh-my-black

**Plan ID:** feature-enhancements
**Created:** 2026-02-04
**Status:** Ready for Execution

---

## Context

### Original Request
Enhance oh-my-black with features from popular Claude Code plugins to improve safety, memory persistence, learning capture, and user notifications.

### Research Summary
Analysis of trending Claude Code plugins revealed four key enhancement opportunities:

| Plugin | Key Feature | Relevance to OMB |
|--------|-------------|------------------|
| claude-mem | Persistent memory with vector search | Enhance notepad system |
| claude-code-safety-net | Destructive command blocking | Critical safety gap |
| compound-engineering | Learning documentation | Compound knowledge |
| call-me | Task completion notifications | Long-running task UX |

### Current oh-my-black State
- **Hooks:** PreToolUse (soft delegation warning), PostToolUse (remember tags), SessionStart (state restore)
- **Memory:** Notepad system with Priority Context, Working Memory, Manual sections
- **Safety:** Delegation warnings only (soft enforcement)
- **Notifications:** None

---

## Work Objectives

### Core Objective
Add four enhancement modules to oh-my-black that provide safety protection, enhanced memory, learning capture, and completion notifications.

### Deliverables
1. Safety Net module with PreToolUse blocking
2. Enhanced Memory system with semantic search
3. Compound Learning document capture
4. Notification system for long-running tasks

### Definition of Done
- [ ] All four modules implemented and tested
- [ ] Existing functionality preserved (backward compatible)
- [ ] Documentation updated in CLAUDE.md
- [ ] Configuration options in .omb-config.json

---

## Guardrails

### MUST Have
- Backward compatibility with existing workflows
- User opt-in for blocking behaviors (not default)
- Graceful degradation when dependencies unavailable
- All state in `.omc/` directory (codebase convention, not `~/.claude/`)

### MUST NOT Have
- Breaking changes to existing hooks
- External service dependencies for core features
- Automatic blocking without user consent
- Token-heavy operations in hooks (keep under 100ms)

---

## Priority 1: Safety Net Integration

**Complexity:** Medium
**Risk:** Low (additive, opt-in)
**Files:** 4 new, 2 modified

### Rationale
The existing PreToolUse hook only warns about delegation violations. A proper safety net should block genuinely destructive commands before they execute.

### Implementation Steps

#### Task 1.1: Create Safety Rules Engine
**File:** `templates/hooks/lib/safety-rules.mjs`
```
- Define destructive command patterns:
  - Git: checkout --, reset --hard, push --force, clean -f, branch -D
  - Shell: rm -rf, chmod 777, sudo rm
  - File: > /dev/sda, mkfs, dd if=
- Define shell wrapper detection (bash -c, sh -c, eval)
- Define interpreter one-liner detection (python -c, node -e, ruby -e)
- Export: checkCommand(cmd) -> { blocked: bool, reason: string, severity: 'warn'|'block' }
```

#### Task 1.2: Create Safety Configuration Schema
**File:** `templates/safety-net.schema.json`
```
- mode: 'off' | 'warn' | 'strict' | 'paranoid'
- customRules: array of { pattern: string, action: 'allow'|'warn'|'block', reason: string }
- allowlist: array of patterns to always allow
- blocklist: array of patterns to always block
- auditLog: boolean (default true)
```

#### Task 1.3: Enhance PreToolUse Hook
**File:** `templates/hooks/pre-tool-use.mjs` (modify)
```
- Import safety-rules.mjs
- Load .omc/safety-net.json or .safety-net.json config
- For Bash commands:
  - Run through safety rules engine
  - If mode='strict' or 'paranoid' and blocked=true: return { continue: false, decision: 'block' }
  - If mode='warn': return warning in additionalContext
- Add audit logging to .omc/logs/safety-audit.jsonl
```

#### Task 1.4: Create Safety Net Skill
**File:** `commands/safety-net.md`
```
- /oh-my-black:safety-net status - Show current mode
- /oh-my-black:safety-net [off|warn|strict|paranoid] - Set mode
- /oh-my-black:safety-net allow <pattern> - Add to allowlist
- /oh-my-black:safety-net block <pattern> - Add to blocklist
- /oh-my-black:safety-net audit - Show recent blocked/warned commands
```

### Acceptance Criteria
- [ ] `git reset --hard` blocked in strict mode
- [ ] `rm -rf /` blocked in all modes except off
- [ ] Custom rules can override defaults
- [ ] Audit log captures all safety events
- [ ] Existing warn-only behavior unchanged when mode='warn'

---

## Priority 2: Enhanced Memory System

**Complexity:** High
**Risk:** Medium (new dependencies possible)
**Files:** 6 new, 3 modified

### Rationale
The current notepad system is text-based with simple timestamping. claude-mem demonstrates the power of semantic search and AI-powered compression. We can achieve 80% of the benefit without external databases.

### Implementation Steps

#### Task 2.1: Design Memory Architecture
**File:** `docs/memory-system.md`
```
Three-tier memory (building on existing notepad):
1. Hot Memory (Priority Context) - Always loaded, <500 chars
2. Warm Memory (Working Memory) - Recent 7 days, searchable
3. Cold Memory (Archive) - Compressed summaries, semantic index

New additions:
- Observations: Captured facts from tool use
- Decisions: Architecture/design decisions with rationale
- Patterns: Repeated solutions for similar problems
```

#### Task 2.2: Create Memory Index
**File:** `templates/hooks/lib/memory-index.mjs`
```
- Simple keyword-based index (no external dependencies)
- Index structure: { keyword: [{ entry_id, section, timestamp, score }] }
- Functions:
  - indexEntry(content, metadata) -> entry_id
  - search(query, limit=5) -> entries[]
  - prune(olderThan) -> removed_count
- Storage: .omc/memory/index.json
```

#### Task 2.3: Create Memory Compression
**File:** `templates/hooks/lib/memory-compress.mjs`
```
- Compress old Working Memory entries into summaries
- Trigger: When Working Memory exceeds 50 entries or 10KB
- Method: Group by date/topic, extract key facts
- Output: Compressed summary in Cold Memory archive
- Storage: .omc/memory/archive/YYYY-MM.md
```

#### Task 2.4: Enhance PostToolUse for Observations
**File:** `templates/hooks/post-tool-use.mjs` (modify)
```
- Capture observations from tool outputs using EXPLICIT TAGS ONLY
- Tag format: <observe>content</observe> or <observe type="category">content</observe>
- Supported categories: error, pattern, discovery, preference, api
- Examples:
  - <observe type="error">ECONNREFUSED on port 3000 - fixed by killing zombie process</observe>
  - <observe type="pattern">Use --legacy-peer-deps for npm install in this project</observe>
  - <observe type="discovery">Auth middleware at src/middleware/auth.ts</observe>

NO AUTO-EXTRACTION - Reasons:
1. "error:" appears in legitimate output (e.g., "error handling code")
2. "found at" appears in search results constantly
3. "created" appears in file creation confirmations (noise)

Auto-extraction was considered but rejected due to high false-positive rate.
Explicit tags ensure intentional, high-quality observations only.

- Store observations in .omc/memory/observations.jsonl (append-only)
- Index observations for search via memory-index.mjs
```

#### Task 2.5: Create Memory Search Skill
**File:** `commands/memory.md`
```
- /oh-my-black:memory search <query> - Search all memory tiers
- /oh-my-black:memory add <content> - Add to Working Memory
- /oh-my-black:memory decide <decision> - Record design decision
- /oh-my-black:memory compress - Manually trigger compression
- /oh-my-black:memory stats - Show memory usage
```

#### Task 2.6: Enhance Session Start for Memory
**File:** `templates/hooks/session-start.mjs` (modify)
**NOTE:** This task and Task 3.5 both modify session-start.mjs. Execute 2.6 FIRST, then 3.5.
```
- Load relevant memories based on current directory/project
- Inject recent decisions into context
- Show memory stats in session restore message
- Add memory injection point that Task 3.5 will extend
```

### Acceptance Criteria
- [ ] Memory search returns relevant results within 100ms
- [ ] Auto-compression triggers at threshold
- [ ] Observations captured via explicit `<observe>` tags
- [ ] Decisions persist across sessions
- [ ] No external database dependencies
- [ ] Backward compatible with existing notepad

---

## Priority 3: Compound Learning System

**Complexity:** Medium
**Risk:** Low (additive feature)
**Files:** 4 new, 1 modified

### Rationale
compound-engineering's philosophy of "compounding" knowledge is powerful. Each session should contribute to a growing knowledge base that improves future sessions.

### Implementation Steps

#### Task 3.1: Design Learning Document Structure
**File:** `docs/compound-learning.md`
```
Learning categories:
1. Patterns: Reusable solutions (e.g., "auth flow pattern")
2. Gotchas: Common pitfalls and their solutions
3. Preferences: User/project preferences discovered
4. APIs: External API behaviors discovered
5. Tools: Effective tool combinations

Storage: .omc/learnings/
- patterns.md - Solution patterns
- gotchas.md - Pitfalls and fixes
- preferences.md - User preferences
- apis.md - API discoveries
- tools.md - Tool combinations
```

#### Task 3.2: Create Learning Capture Hook
**File:** `templates/hooks/lib/learning-capture.mjs`
```
- Parse agent output for learning signals:
  - "I learned that..." -> explicit learning
  - "Note for future:" -> explicit learning
  - Error followed by fix -> implicit gotcha
  - Repeated pattern across tasks -> implicit pattern
- Functions:
  - captureLearning(content, category, source)
  - getLearnings(category, limit)
  - searchLearnings(query)
```

#### Task 3.3: Enhance Learner Skill
**File:** `commands/learner.md` (modify)
```
Enhance the existing learner skill with learning extraction:
- After complex task completion, extract learnings
- Categorize and store in appropriate file (.omc/learnings/)
- Deduplicate against existing learnings
- Update relevance scores based on usage
- Integrate with learning-capture.mjs library
```

#### Task 3.4: Create Learning Skill
**File:** `commands/learn.md`
```
- /oh-my-black:learn - Extract learnings from current session
- /oh-my-black:learn show [category] - Display learnings
- /oh-my-black:learn search <query> - Search learnings
- /oh-my-black:learn export - Export learnings as markdown
```

#### Task 3.5: Inject Relevant Learnings
**File:** `templates/hooks/session-start.mjs` (modify)
**NOTE:** Execute AFTER Task 2.6 (both modify session-start.mjs). Builds on memory injection point from 2.6.
```
- On session start, identify relevant learnings for current project
- Inject top 3-5 relevant learnings into context
- Format: <learnings>...</learnings> section
- Use the memory injection infrastructure added by Task 2.6
```

### Acceptance Criteria
- [ ] Learnings captured automatically from agent output
- [ ] Learnings searchable and retrievable
- [ ] Relevant learnings injected on session start
- [ ] No duplicate learnings stored
- [ ] Export produces clean markdown

---

## Priority 4: Notification System

**Complexity:** Low
**Risk:** Low (OS-level, no external services)
**Files:** 3 new, 1 modified

### Rationale
Long-running tasks (autopilot, ralph, ultrawork) can take minutes to hours. Users need notification when tasks complete, especially if they've switched focus.

### Implementation Steps

#### Task 4.1: Create Notification Module
**File:** `templates/hooks/lib/notify.mjs`
```
- Cross-platform notification support:
  - macOS: osascript for native notifications
  - Linux: notify-send
  - Windows: PowerShell toast
- Functions:
  - notify(title, message, options)
  - options: { sound: bool, sticky: bool, action: string }
- Graceful fallback if notification unavailable
```

#### Task 4.2: Create Notification Configuration
**File:** Add to `.omb-config.json` schema
```
notifications: {
  enabled: boolean (default: true),
  onComplete: boolean (default: true),
  onError: boolean (default: true),
  onLongTask: number (minutes, default: 5),
  sound: boolean (default: false),
  methods: ['system'] // future: 'webhook', 'slack', 'email'
}
```

#### Task 4.3: Create Mode Completion Detection
**File:** `templates/hooks/lib/mode-completion.mjs` (new)
```
NOTE: persistent-mode.mjs is a STOP hook that BLOCKS premature termination.
It does NOT detect successful completion. We need a different approach.

Completion detection strategy:
1. Each mode skill (ralph, ultrawork, autopilot) calls notifyCompletion()
   when it reaches its natural end state
2. The cancel skill calls notifyCompletion() when user explicitly cancels

Implementation:
- Create mode-completion.mjs library with:
  - trackModeStart(mode, metadata) -> writes .omc/state/{mode}-tracking.json
  - notifyCompletion(mode, result) -> reads tracking, calculates duration, sends notification
  - Functions:
    - getModeDuration(mode) -> milliseconds since start
    - getModeMetadata(mode) -> { startTime, taskCount, etc }
- Modify cancel.md skill to call notifyCompletion() on explicit cancel
- Modify each mode's completion logic in their respective skill files:
  - commands/ralph.md -> call notifyCompletion on natural completion
  - commands/ultrawork.md -> call notifyCompletion on all tasks done
  - commands/autopilot.md -> call notifyCompletion on completion

Notification payload:
- mode: string (ralph, ultrawork, autopilot, etc)
- duration: number (seconds)
- result: 'completed' | 'cancelled' | 'failed'
- taskCount: number (tasks completed)
- summary: string (brief status)
```

#### Task 4.4: Create Notification Skill
**File:** `commands/notify.md`
```
- /oh-my-black:notify test - Send test notification
- /oh-my-black:notify [on|off] - Toggle notifications
- /oh-my-black:notify config - Show/edit notification settings
```

### Acceptance Criteria
- [ ] Notifications work on macOS (primary)
- [ ] Graceful fallback on unsupported platforms
- [ ] Configurable thresholds
- [ ] Sound optional
- [ ] No external service dependencies

---

## Task Flow and Dependencies

```
[Priority 1: Safety Net] ─────────────────────────────────┐
    │                                                      │
    ├── Task 1.1: Safety Rules Engine                      │
    │       │                                              │
    │       └── Task 1.3: Enhance PreToolUse ──────────────┤
    │                                                      │
    ├── Task 1.2: Safety Config Schema                     │
    │       │                                              │
    │       └── Task 1.4: Safety Skill ────────────────────┤
    │                                                      │
[Priority 2: Enhanced Memory] ─────────────────────────────┤
    │                                                      │
    ├── Task 2.1: Memory Architecture Doc                  │
    │       │                                              │
    │       ├── Task 2.2: Memory Index                     │
    │       │       │                                      │
    │       │       └── Task 2.5: Memory Skill ────────────┤
    │       │                                              │
    │       ├── Task 2.3: Memory Compression               │
    │       │                                              │
    │       └── Task 2.4: Enhance PostToolUse              │
    │               │                                      │
    │               └── Task 2.6: Enhance SessionStart ────┤
    │                                                      │
[Priority 3: Compound Learning] ───────────────────────────┤
    │                                                      │
    ├── Task 3.1: Learning Doc Structure                   │
    │       │                                              │
    │       ├── Task 3.2: Learning Capture Hook            │
    │       │       │                                      │
    │       │       └── Task 3.3: Learner Skill ───────────┤
    │       │                                              │
    │       └── Task 3.4: Learning Skill                   │
    │               │                                      │
    │               └── Task 3.5: Inject Learnings ────────┤
    │                                                      │
[Priority 4: Notifications] ───────────────────────────────┘
    │
    ├── Task 4.1: Notification Module
    │       │
    │       └── Task 4.3: Mode Completion Detection (lib + mode skills)
    │
    ├── Task 4.2: Notification Config
    │       │
    │       └── Task 4.4: Notification Skill
```

---

## Detailed TODOs

### Priority 1: Safety Net (Est. 4-6 hours)

| ID | Task | File | Acceptance | Blocked By |
|----|------|------|------------|------------|
| 1.1 | Create safety rules engine | `lib/safety-rules.mjs` | All destructive patterns detected | - |
| 1.2 | Create safety config schema | `safety-net.schema.json` | Valid JSON schema | - |
| 1.3 | Enhance PreToolUse hook | `pre-tool-use.mjs` | Blocks in strict mode | 1.1 |
| 1.4 | Create safety-net skill | `commands/safety-net.md` | All commands work | 1.2, 1.3 |

### Priority 2: Enhanced Memory (Est. 15-20 hours)

| ID | Task | File | Acceptance | Blocked By |
|----|------|------|------------|------------|
| 2.1 | Document memory architecture | `docs/memory-system.md` | Clear 3-tier design | - |
| 2.2 | Create memory index | `lib/memory-index.mjs` | Search <100ms | 2.1 |
| 2.3 | Create memory compression | `lib/memory-compress.mjs` | Auto-triggers at threshold | 2.1 |
| 2.4 | Enhance PostToolUse | `post-tool-use.mjs` | Observations captured | 2.2 |
| 2.5 | Create memory skill | `commands/memory.md` | All commands work | 2.2 |
| 2.6 | Enhance SessionStart for memory | `session-start.mjs` | Memories injected | 2.2, 2.4 |

### Priority 3: Compound Learning (Est. 6-8 hours)

| ID | Task | File | Acceptance | Blocked By |
|----|------|------|------------|------------|
| 3.1 | Document learning structure | `docs/compound-learning.md` | 5 categories defined | - |
| 3.2 | Create learning capture | `lib/learning-capture.mjs` | Auto-extracts learnings | 3.1 |
| 3.3 | Enhance learner skill | `commands/learner.md` | Extracts post-task | 3.2 |
| 3.4 | Create learning skill | `commands/learn.md` | All commands work | 3.2 |
| 3.5 | Inject learnings | `session-start.mjs` | Top 5 injected | 3.2, 2.6 |

### Priority 4: Notifications (Est. 3-4 hours)

| ID | Task | File | Acceptance | Blocked By |
|----|------|------|------------|------------|
| 4.1 | Create notification module | `lib/notify.mjs` | macOS notifications work | - |
| 4.2 | Add notification config | `.omb-config.json` | Schema validated | - |
| 4.3 | Create mode completion detection | `lib/mode-completion.mjs` + mode skills | Notifies on complete | 4.1 |
| 4.4 | Create notify skill | `commands/notify.md` | All commands work | 4.1, 4.2 |

---

## Commit Strategy

Consolidated into 4 feature-grouped commits (reduced from 13):

```
feat(safety): add safety net module with PreToolUse blocking

- Add safety rules engine for destructive command detection
- Add PreToolUse blocking in strict/paranoid modes
- Add safety-net skill for configuration
- Add audit logging to .omc/logs/safety-audit.jsonl

feat(memory): add enhanced memory system with search and compression

- Add 3-tier memory architecture (hot/warm/cold)
- Add keyword-based memory index with <100ms search
- Add auto-compression for cold storage archive
- Enhance PostToolUse with explicit <observe> tag capture
- Enhance SessionStart for memory injection
- Add memory skill for search and management

feat(learning): add compound learning capture system

- Add learning document structure (patterns, gotchas, preferences, apis, tools)
- Add learning-capture.mjs library for extraction
- Enhance learner skill for post-task extraction
- Add learn skill for learning management
- Inject relevant learnings on session start

feat(notify): add cross-platform notification system

- Add notification module (macOS/Linux/Windows)
- Add mode-completion.mjs for completion detection
- Integrate with mode skills (ralph, ultrawork, autopilot, cancel)
- Add notify skill for configuration
- Update CLAUDE.md with all feature documentation
```

---

## Success Criteria

### Functional
- [ ] Safety net blocks `git reset --hard` in strict mode
- [ ] Memory search finds relevant entries within 100ms
- [ ] Learnings auto-extracted from at least 30% of sessions
- [ ] Notifications delivered on macOS within 2 seconds

### Non-Functional
- [ ] All hooks complete within 100ms
- [ ] No external service dependencies
- [ ] Backward compatible with existing workflows
- [ ] All features opt-in (not breaking defaults)

### Documentation
- [ ] CLAUDE.md updated with all four features
- [ ] Each feature has skill documentation
- [ ] Migration notes for existing users

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Hook latency increases | High | Medium | Profile all hooks, set 100ms budget |
| Memory index grows unbounded | Medium | Medium | Auto-compression, size limits |
| Safety blocks legitimate commands | High | Low | Allowlist, mode options, clear messaging |
| Notifications fail silently | Low | Medium | Graceful fallback, test command |

---

## Notes for Executor

1. **Start with Priority 1** - Safety is foundational and enables confident execution
2. **Test hooks in isolation** - Each hook should be testable standalone
3. **Use existing patterns** - Follow the style in current `pre-tool-use.mjs` and `post-tool-use.mjs`
4. **Atomic writes** - Use `lib/atomic-write.mjs` for all file operations
5. **No breaking changes** - All features must be additive/opt-in

## Design Decisions (Architect Questions Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Migrate `.omc/` to `.omb/`? | **Keep `.omc/`** | Codebase convention, avoid breaking existing installations |
| Memory index: keyword vs TF-IDF? | **Keyword-based** | Simpler, no dependencies, sufficient for MVP. TF-IDF can be added later |
| Notification webhook support? | **Not initially** | Start with OS-native only. Add `methods: ['system']` config for future extensibility |

---

---

## Appendix: Orchestration Plugin Comparison (10 Plugins)

사용자 요청에 따라 superclaude를 포함한 10개의 오케스트레이션 플러그인을 비교 분석했습니다.

### Comparison Matrix

| Plugin | Stars | Architecture | Key Feature | oh-my-black 적용 가능성 |
|--------|-------|--------------|-------------|----------------------|
| **SuperClaude Framework** | ⭐⭐⭐ | 30 commands, 16 personas, 8 MCPs | Cognitive personas + MCP integration | 🔴 경쟁 관계 (참고용) |
| **Claude Squad** | 5.9k | tmux + git worktrees | Multi-workspace parallel execution | 🟢 **PSM 기능 강화** |
| **Claude Swarm** | ⭐⭐ | Ruby single-process | SwarmMemory + FAISS vector | 🟢 **Memory system 참고** |
| **Claude-Flow** | ⭐⭐⭐ | Q-Learning router + 60 agents | ReasoningBank + Agent Booster | 🟡 Token optimizer 참고 |
| **Agent Council** | ⭐⭐ | Multi-LLM consensus | Parallel opinion + Chairman synthesis | 🟢 **Multi-LLM 지원 추가** |
| **Claude Task Master** | ⭐⭐ | Task orchestration | Cursor AI integration | 🟡 Task system 참고 |
| **Claude Task Runner** | ⭐⭐ | Context isolation | Context length optimization | 🟢 **Context management** |
| **Ralph Orchestrator** | ⭐⭐ | Autonomous loops | Circuit breaker + 75 tests | 🟢 이미 ralph에 반영됨 |
| **TSK** | ⭐⭐ | Rust + Docker sandbox | Git branch isolation | 🟡 Sandbox 개념 참고 |
| **plugins-plus-skills** | ⭐⭐⭐ | 270 plugins, 1537 skills | 5-phase verification + Learning Lab | 🟢 **Verification system** |

### Top 5 Features to Adopt

Based on the analysis, these features would most benefit oh-my-black:

#### 1. 🥇 Multi-Workspace Isolation (from Claude Squad)
**현재 상태:** PSM skill 존재하지만 기본적
**개선안:** tmux + git worktree 통합으로 진정한 병렬 작업 공간
```
- Multiple concurrent sessions with isolated codebases
- Background task execution with auto-accept
- Session pause/resume capabilities
```
**구현 난이도:** Medium | **영향도:** High

#### 2. 🥈 Semantic Memory with Vector Search (from Claude Swarm)
**현재 상태:** Notepad system (text-based)
**개선안:** FAISS-backed vector indexing for semantic retrieval
```
- MemoryWrite / MemorySearch / LoadSkill tools
- Cross-session knowledge persistence
- Skill learning from experience
```
**구현 난이도:** High | **영향도:** High

#### 3. 🥉 Multi-LLM Council Mode (from Agent Council)
**현재 상태:** Claude-only orchestration
**개선안:** Codex CLI, Gemini CLI 등 다중 LLM 의견 수렴
```
- Parallel opinion gathering from multiple AI agents
- Chairman synthesis for unified recommendations
- No additional API costs (uses CLI subscriptions)
```
**구현 난이도:** Medium | **영향도:** Medium

#### 4. Token Optimization Engine (from Claude-Flow)
**현재 상태:** ecomode (model routing only)
**개선안:** ReasoningBank + caching + batch optimization
```
- Pattern caching for similar tasks (-32% tokens)
- Batch optimization for related operations (-20% tokens)
- WebAssembly-based code transforms (no LLM needed)
```
**구현 난이도:** High | **영향도:** High

#### 5. 5-Phase Verification System (from plugins-plus-skills)
**현재 상태:** Architect verification (single pass)
**개선안:** Multi-phase verification with empirical evidence
```
- Phase contracts defining input/output expectations
- Script-based validation producing measurable evidence
- Integration with test harness
```
**구현 난이도:** Medium | **영향도:** High

### Implementation Recommendation

**Phase 1 (Quick Wins - 1-2 weeks):**
- Multi-Workspace Isolation (PSM enhancement)
- 5-Phase Verification System (ohmyblack enhancement)

**Phase 2 (Medium Term - 2-4 weeks):**
- Multi-LLM Council Mode (new skill)
- Token Optimization basics (ReasoningBank)

**Phase 3 (Long Term - 1-2 months):**
- Semantic Memory with Vector Search
- Full Token Optimization Engine

---

## Updated Priority Summary

| Priority | Original Feature | New Orchestration Feature | Combined Value |
|----------|------------------|---------------------------|----------------|
| P1 | Safety Net | - | Critical safety |
| P2 | Enhanced Memory | + Vector Search (Swarm) | **High** - semantic retrieval |
| P3 | Compound Learning | + ReasoningBank (Flow) | **High** - pattern caching |
| P4 | Notifications | - | UX improvement |
| P5 | - | Multi-Workspace (Squad) | **High** - parallel work |
| P6 | - | Multi-LLM Council | **Medium** - diverse opinions |
| P7 | - | 5-Phase Verification | **High** - reliability |

---

*Plan generated by Prometheus (planner agent)*
*Updated with orchestration plugin comparison per user request*
*Ready for Critic review*
