# Enhancement Recommendations Plan: New Skills, Hooks, Agents & MCP for oh-my-black

**Plan ID:** enhancement-recommendations
**Created:** 2026-02-05
**Status:** Ready for Critic Review (Iteration 2)

---

## Directory Convention (CRITICAL)

**IMPORTANT:** There is an inconsistency between documentation and source code:

| Location | Convention | Notes |
|----------|------------|-------|
| **Source code** | `.omc/` | Used in scripts, hooks, state management |
| **Documentation** (CLAUDE.md) | `.omb/` | Referenced in user-facing docs |
| **Plan files** | `.omb/plans/` | Current location (matches docs) |

**For this plan:**
- **State files go in `.omc/`** (matching source code implementation)
- **Plan files stay in `.omb/plans/`** (current convention)
- **Note:** Documentation should eventually be updated to clarify this distinction

---

## MCP Integration Pattern

### Architecture Decision: Standalone vs Aggregated

The existing `src/mcp/omb-tools-server.ts` uses an **aggregated pattern** - it bundles LSP, AST, Python REPL, and skills tools into a single in-process MCP server (`mcp__t__*`).

**Recommendation for new MCP servers: STANDALONE**

| Approach | Pros | Cons |
|----------|------|------|
| **Standalone (Recommended)** | Independent lifecycle, easier testing, optional install | More config entries |
| **Aggregated** | Single config entry | Couples all tools, heavier startup |

### MCP Server Registration Pattern

New MCP servers must be registered in `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "linear": {
      "command": "node",
      "args": ["/path/to/oh-my-black/dist/mcp/linear-server.js"],
      "env": {
        "LINEAR_API_KEY": "${LINEAR_API_KEY}"
      }
    },
    "vector-memory": {
      "command": "node",
      "args": ["/path/to/oh-my-black/dist/mcp/vector-memory-server.js"]
    }
  }
}
```

### Dependency Installation Requirements

| MCP Server | Dependencies | Install Command |
|------------|--------------|-----------------|
| `mcp-linear` | `@linear/sdk` | `npm install @linear/sdk` |
| `mcp-vector-memory` | `better-sqlite3`, `sqlite-vss` OR `lancedb` | `npm install better-sqlite3` + native build |
| `mcp-browser` | `playwright` | `npx playwright install` (downloads browsers) |
| `mcp-observability` | Provider SDKs (datadog, etc.) | Per-provider install |
| `mcp-notion` | `@notionhq/client` | `npm install @notionhq/client` |

### Reference Implementation

See `src/mcp/omb-tools-server.ts` for the aggregated pattern (if extending existing server) or create standalone servers following the MCP SDK pattern:

```typescript
// Standalone server pattern
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";

const server = new Server({ name: "server-name", version: "1.0.0" });
// Register tools...
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Context

### Original Request
oh-my-black에 추가되면 좋을 skills, commands, hooks, subagents, MCP 추천 계획 작성

### Current Inventory

**Skills (32개):**
analyze, autopilot, build-fix, cancel, code-review, deepinit, deepsearch, doctor, ecomode, help, hud, learn-about-omc, learner, mcp-setup, note, omc-setup, pipeline, plan, psm, ralph-init, ralph, ralplan, release, research, review, security-review, swarm, tdd, ultrapilot, ultraqa, ultrawork

**Agents (39개):**
analyst, architect (3 tiers), build-fixer (2 tiers), code-reviewer (2 tiers), coordinator, critic, deep-executor, designer (3 tiers), executor (3 tiers), explore (3 tiers), git-master, planner, qa-tester (2 tiers), researcher (2 tiers), scientist (3 tiers), security-reviewer (2 tiers), tdd-guide (2 tiers), validators (4종), vision, writer

**Hooks (12개 scripts):**
keyword-detector.mjs, skill-injector.mjs, session-start.mjs, project-memory-session.mjs, setup-init.mjs, setup-maintenance.mjs, pre-tool-enforcer.mjs, permission-handler.mjs, post-tool-verifier.mjs, project-memory-posttool.mjs, validate-syntax.mjs, subagent-tracker.mjs, persistent-mode.cjs, pre-compact.mjs, project-memory-precompact.mjs, session-end.mjs

### Competitive Analysis Findings

| Source | Key Features Missing in oh-my-black |
|--------|-------------------------------------|
| superpowers | brainstorming, git-worktrees, systematic-debugging, writing-skills |
| episodic-memory | Semantic search across sessions |
| double-shot-latte | Claude-judged decision making |
| Claude Squad | tmux + git worktree parallel workspaces |
| Claude Swarm | FAISS vector memory |
| Claude-Flow | ReasoningBank + token optimization |
| Agent Council | Multi-LLM consensus |
| feature-enhancements.md | Safety Net, Enhanced Memory, Compound Learning, Notifications |

### Previous Critic Feedback Applied
1. Use `.omc/` directory (not `.omb/`) for state files - **APPLIED**
2. Correct file references - **APPLIED**
3. Use explicit `<observe>` tags only - **APPLIED**
4. Notification via mode-completion.mjs (not persistent-mode.mjs) - **APPLIED**
5. Directory convention clarification - **APPLIED** (this iteration)
6. MCP integration pattern documented - **APPLIED** (this iteration)
7. Hook registration details added - **APPLIED** (this iteration)
8. Agent template references added - **APPLIED** (this iteration)
9. Skill boundary clarifications added - **APPLIED** (this iteration)

---

## Work Objectives

### Core Objective
Recommend and plan new skills, hooks, subagents, and MCP integrations that fill gaps in oh-my-black's capabilities based on competitive analysis.

### Deliverables
1. **5-7 New Skills** with implementation details
2. **2-3 New Hooks** for automation and UX
3. **2-3 New Subagents** for specialized tasks
4. **3-5 MCP Integrations** for extended capabilities
5. **2-3 New Commands** for user convenience

### Definition of Done
- [ ] Each recommendation has clear rationale
- [ ] Implementation approach defined
- [ ] Files to create/modify listed
- [ ] Acceptance criteria specified
- [ ] Priority assigned (P1/P2/P3)

---

## SECTION 1: New Skills (7개)

### Skill 1.1: `brainstorm` - AI-Facilitated Ideation Sessions
**Priority:** P2
**Rationale:** superpowers 플러그인의 brainstorming 기능. 새 기능 설계나 문제 해결 시 구조화된 아이디어 발산 세션이 필요함. 현재 plan skill은 실행 계획에 집중하고, 아이디어 발산은 지원하지 않음.

**Implementation Approach:**
```
1. Multi-round brainstorming protocol:
   - Round 1: Divergent thinking (generate many ideas)
   - Round 2: Clustering (group related ideas)
   - Round 3: Evaluation (pros/cons each cluster)
   - Round 4: Selection (rank top 3-5)
2. Use researcher agent for external inspiration
3. Save session to .omc/brainstorm/{topic}.md
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/brainstorm.md` | Skill definition |
| `.omc/brainstorm/` | Session storage directory |

**Acceptance Criteria:**
- [ ] 4-round protocol completes successfully
- [ ] External research integrated when requested
- [ ] Session saved with timestamped ideas
- [ ] Can resume previous brainstorm sessions

---

### Skill 1.2: `worktree` - Git Worktree Parallel Development
**Priority:** P1
**Rationale:** Claude Squad의 핵심 기능. 여러 작업을 진정한 병렬로 수행하려면 isolated workspace가 필요. 현재 ultrawork는 같은 codebase에서 동시 수정 시 충돌 위험.

**Implementation Approach:**
```
1. git worktree 생성/관리 자동화
2. 각 worktree에서 독립 executor 실행
3. 완료 후 자동 merge 또는 PR 생성
4. PSM skill과 통합 (session per worktree)
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/worktree.md` | Skill definition |
| `scripts/worktree-manager.mjs` | Worktree lifecycle management |
| `agents/worktree-executor.md` | Worktree-aware executor |

**Acceptance Criteria:**
- [ ] `worktree create <branch>` creates isolated workspace
- [ ] `worktree exec <branch> <task>` runs task in worktree
- [ ] `worktree merge <branch>` merges back to main
- [ ] `worktree list` shows active worktrees
- [ ] Cleanup on session end

---

### Skill 1.3: `debug` - Systematic Debugging Protocol
**Priority:** P1
**Rationale:** superpowers의 systematic-debugging. 현재 analyze skill은 일반적 분석에 집중. 버그 재현, 가설 검증, 이분 탐색 등 체계적 디버깅 프로토콜 부재.

**Boundary with `analyze` skill:**

| Aspect | `analyze` (existing) | `debug` (new) |
|--------|---------------------|---------------|
| **Focus** | General investigation | Bug-specific workflow |
| **Output** | Findings + recommendations | Root cause + fix + verification |
| **Protocol** | Flexible analysis | Strict 5-phase protocol |
| **Artifacts** | None | `.omc/debug/{issue}.md` session log |
| **Tools** | Read, grep, git log | + git bisect, test runners |
| **When to use** | "Analyze this architecture" | "Debug this failing test" |

**Implementation Approach:**
```
1. Structured debugging phases:
   - Phase 1: Reproduce (확실한 재현 케이스 확보)
   - Phase 2: Isolate (최소 재현 케이스)
   - Phase 3: Hypothesize (가설 3개 이상 생성)
   - Phase 4: Test (각 가설 검증)
   - Phase 5: Fix & Verify (수정 및 회귀 테스트)
2. 각 단계 결과를 .omc/debug/{issue}.md에 기록
3. Binary search for regression detection (git bisect)
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/debug.md` | Skill definition |
| `agents/debugger.md` | Specialized debugging agent |
| `templates/debug-report.md` | Debug session template |

**Acceptance Criteria:**
- [ ] 5-phase protocol enforced
- [ ] Each phase produces documented evidence
- [ ] Binary search for regressions (git bisect integration)
- [ ] Final report with root cause + fix

---

### Skill 1.4: `council` - Multi-LLM Consensus Mode
**Priority:** P2
**Rationale:** Agent Council 플러그인 영감. 중요한 아키텍처 결정 시 단일 LLM의 편향을 줄이기 위해 여러 관점 수렴. Claude CLI subscription만으로 Codex CLI, Gemini CLI 등 활용 가능.

**Implementation Approach:**
```
1. 지원 LLM CLI:
   - codex (OpenAI Codex CLI)
   - gemini (Google Gemini CLI)
   - grok (xAI Grok CLI)
   - claude (default)
2. 각 LLM에 동일 질문 병렬 전송
3. Chairman (claude opus)이 응답 종합
4. 합의점과 분기점 명시
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/council.md` | Skill definition |
| `scripts/council-dispatch.mjs` | Multi-CLI dispatcher |
| `agents/chairman.md` | Consensus synthesizer |

**Acceptance Criteria:**
- [ ] 최소 2개 LLM 응답 수집
- [ ] 응답 불가 LLM graceful fallback
- [ ] Chairman synthesis 생성
- [ ] 합의/분기 명확히 구분

---

### Skill 1.5: `perf` - Performance Profiling & Optimization
**Priority:** P2
**Rationale:** 성능 최적화는 별도 전문 지식 필요. 현재 어떤 skill도 프로파일링, 벤치마크, 병목 분석을 전담하지 않음.

**Implementation Approach:**
```
1. Language-specific profilers 통합:
   - Node.js: --prof, clinic.js
   - Python: cProfile, py-spy
   - Go: pprof
2. Benchmark before/after comparison
3. Automated bottleneck detection
4. Optimization suggestions with expected impact
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/perf.md` | Skill definition |
| `agents/perf-analyst.md` | Performance analysis agent |
| `scripts/profiler-adapters/` | Language-specific adapters |

**Acceptance Criteria:**
- [ ] Profile command runs appropriate profiler
- [ ] Bottleneck identified with evidence
- [ ] Before/after metrics comparison
- [ ] Optimization recommendations prioritized

---

### Skill 1.6: `refactor` - Safe Large-Scale Refactoring
**Priority:** P1
**Rationale:** 대규모 리팩토링은 위험도 높음. AST 기반 변환, 단계별 검증, 롤백 지원이 필요하지만 현재 executor가 직접 처리.

**Integration with `ast_grep_replace` MCP Tool:**

This skill MUST leverage the existing `mcp__plugin_oh-my-black_t__ast_grep_replace` tool for structural code transformations:

```typescript
// Example usage within refactor skill
mcp__plugin_oh-my-black_t__ast_grep_replace({
  pattern: "console.log($MSG)",
  replacement: "logger.info($MSG)",
  language: "typescript",
  path: "src/",
  dryRun: true  // Always preview first
})
```

**Implementation Approach:**
```
1. Refactoring types:
   - rename (symbol rename across codebase) → use ast_grep_replace
   - extract (function/class extraction) → use ast_grep_replace + manual
   - move (file/module relocation) → git mv + import updates
   - inline (collapse abstraction) → use ast_grep_replace
2. Each operation:
   - Dry-run first via ast_grep_replace(dryRun: true)
   - Show affected files from dry-run output
   - Apply via ast_grep_replace(dryRun: false)
   - Test after each step
   - Git commit checkpoint
3. Rollback support via git
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/refactor.md` | Skill definition |
| `agents/refactorer.md` | Refactoring specialist |
| `scripts/refactor-ops.mjs` | Refactoring operations |

**Acceptance Criteria:**
- [ ] Dry-run shows all affected files (via ast_grep_replace)
- [ ] AST-grep used for structural changes
- [ ] Tests run after each step
- [ ] Rollback possible at any checkpoint

---

### Skill 1.7: `doc` - Documentation Generation & Maintenance
**Priority:** P3
**Rationale:** writer agent 존재하지만 문서화 전용 skill 부재. API docs, README, CHANGELOG 자동 생성/업데이트 워크플로우 필요.

**Implementation Approach:**
```
1. Documentation types:
   - readme: Project README generation
   - api: API documentation from code
   - changelog: Changelog from commits
   - architecture: Architecture decision records (ADR)
2. Template-based generation
3. Incremental update (diff-aware)
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/doc.md` | Skill definition |
| `templates/docs/` | Documentation templates |

**Acceptance Criteria:**
- [ ] `doc readme` generates/updates README
- [ ] `doc api` extracts API docs from code
- [ ] `doc changelog` generates from commits
- [ ] Incremental update without overwriting manual edits

---

## SECTION 2: New Hooks (3개)

### Hook 2.1: `context-optimizer.mjs` - Automatic Context Window Management
**Priority:** P1
**Rationale:** Claude-Flow의 token optimization 기능. 긴 세션에서 context가 커지면 성능 저하. 자동으로 불필요 컨텍스트 제거 및 압축 필요.

**Hook Registration Details:**

| Property | Value |
|----------|-------|
| **Event Type** | `PreCompact` |
| **Matcher** | `*` (all compactions) |
| **Timeout** | `15000` (15 seconds - compression can be slow) |
| **Order** | **BEFORE** existing `pre-compact.mjs` (runs first) |

**Interaction with existing `pre-compact.mjs`:**

| Hook | Purpose | Order |
|------|---------|-------|
| `context-optimizer.mjs` (new) | Aggressive context compression | 1st |
| `pre-compact.mjs` (existing) | State preservation, notepad handling | 2nd |
| `project-memory-precompact.mjs` (existing) | Project memory persistence | 3rd |

The context-optimizer runs FIRST to reduce context size, then existing hooks handle their specific state management.

**hooks.json Registration:**
```json
{
  "PreCompact": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/context-optimizer.mjs\"",
          "timeout": 15
        },
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/pre-compact.mjs\"",
          "timeout": 10
        },
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/project-memory-precompact.mjs\"",
          "timeout": 5
        }
      ]
    }
  ]
}
```

**Implementation Approach:**
```
1. Context analysis:
   - 오래된 tool outputs 요약
   - 반복 패턴 deduplicate
   - 완료된 task 상세 정보 제거
2. Token budget 설정 (e.g., 80% of max)
3. Smart compression algorithm
4. Preserve Priority Context (from notepad)
```

**Files to Create/Modify:**
| File | Action | Purpose |
|------|--------|---------|
| `scripts/context-optimizer.mjs` | Create | Context analysis & compression |
| `hooks/hooks.json` | Modify | Register in PreCompact (first position) |

**Acceptance Criteria:**
- [ ] Context size reduced by 30%+ after compression
- [ ] Critical information preserved (Priority Context)
- [ ] No loss of task-critical data
- [ ] Configurable token budget

---

### Hook 2.2: `auto-test-trigger.mjs` - Automatic Test Execution on Changes
**Priority:** P2
**Rationale:** TDD skill 있지만, 일반 개발 시에도 변경된 파일 관련 테스트 자동 실행이 유용. PostToolUse에서 Write/Edit 감지 후 관련 테스트 실행.

**Hook Registration Details:**

| Property | Value |
|----------|-------|
| **Event Type** | `PostToolUse` |
| **Matcher** | `Write\|Edit` (only file modifications) |
| **Timeout** | `60000` (60 seconds - tests can be slow) |
| **Order** | **AFTER** existing `validate-syntax.mjs` |

**hooks.json Registration:**
```json
{
  "PostToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/validators/validate-syntax.mjs\"",
          "timeout": 30
        },
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/auto-test-trigger.mjs\"",
          "timeout": 60
        }
      ]
    }
  ]
}
```

**Implementation Approach:**
```
1. PostToolUse에서 Write/Edit 감지
2. 변경된 파일의 관련 테스트 파일 탐색:
   - src/foo.ts → tests/foo.test.ts
   - src/foo.ts → __tests__/foo.spec.ts
3. 테스트 존재 시 백그라운드 실행
4. 실패 시 additionalContext로 경고 주입
```

**Files to Create/Modify:**
| File | Action | Purpose |
|------|--------|---------|
| `scripts/auto-test-trigger.mjs` | Create | Test file mapping & execution |
| `hooks/hooks.json` | Modify | Register in PostToolUse (Write\|Edit) |

**Test File Pattern Mapping:**
```javascript
const testPatterns = [
  // Pattern: source → test
  { src: /^src\/(.+)\.ts$/, test: 'tests/$1.test.ts' },
  { src: /^src\/(.+)\.ts$/, test: '__tests__/$1.spec.ts' },
  { src: /^src\/(.+)\.tsx$/, test: 'src/$1.test.tsx' },
  { src: /^lib\/(.+)\.py$/, test: 'tests/test_$1.py' },
];
```

**Acceptance Criteria:**
- [ ] Related test file correctly identified
- [ ] Test runs in background (non-blocking)
- [ ] Failure warning injected in next response
- [ ] Configurable enable/disable

---

### Hook 2.3: `progress-reporter.mjs` - Real-time Progress Streaming
**Priority:** P3
**Rationale:** 긴 작업 중 사용자가 진행 상황을 알기 어려움. HUD skill 존재하지만 수동 호출 필요. 자동 progress 업데이트 필요.

**Hook Registration Details:**

| Property | Value |
|----------|-------|
| **Event Type** | `SubagentStart` AND `SubagentStop` |
| **Matcher** | `*` (all subagents) |
| **Timeout** | `3000` (3 seconds - must be fast) |
| **Order** | **AFTER** existing `subagent-tracker.mjs` |

**hooks.json Registration:**
```json
{
  "SubagentStart": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/subagent-tracker.mjs\" start",
          "timeout": 3
        },
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/progress-reporter.mjs\" start",
          "timeout": 3
        }
      ]
    }
  ],
  "SubagentStop": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/subagent-tracker.mjs\" stop",
          "timeout": 5
        },
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/progress-reporter.mjs\" stop",
          "timeout": 3
        }
      ]
    }
  ]
}
```

**Implementation Approach:**
```
1. SubagentStart/SubagentStop에서 진행 상황 추적
2. .omc/progress.json 실시간 업데이트:
   - total_tasks, completed_tasks
   - current_task, eta
3. 외부 프로세스(HUD daemon)가 파일 watch하여 표시
4. Terminal statusline 또는 desktop notification
```

**Files to Create/Modify:**
| File | Action | Purpose |
|------|--------|---------|
| `scripts/progress-reporter.mjs` | Create | Progress tracking & file updates |
| `hooks/hooks.json` | Modify | Register in SubagentStart/Stop |
| `scripts/hud-daemon.mjs` | Create | File watcher for display |

**Acceptance Criteria:**
- [ ] Progress file updated on each agent event
- [ ] HUD daemon displays current progress
- [ ] ETA calculation (optional)
- [ ] No performance impact on main execution

---

## SECTION 3: New Subagents (3개)

### Agent 3.1: `migrator` - Database & Schema Migration Specialist
**Priority:** P2
**Rationale:** DB 마이그레이션은 위험도 높고 전문 지식 필요. 현재 executor가 직접 처리하지만 rollback, 데이터 백업, 스키마 검증 등 전문 기능 부재.

**Template Reference:** `agents/templates/base-agent.md`

**Agent Tiers:**
| Tier | File | Model | Use Case |
|------|------|-------|----------|
| Low | `agents/migrator-low.md` | haiku | Simple migrations (add column, index) |
| Standard | `agents/migrator.md` | sonnet | Complex migrations with FK, data transforms |

**Implementation Approach:**
```
1. 지원 migration frameworks:
   - Prisma, Drizzle (Node.js)
   - Alembic, Django (Python)
   - Goose, GORM (Go)
2. Safety checks:
   - Destructive changes 경고
   - Dry-run 필수
   - Backup reminder
3. Rollback plan 생성
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `agents/migrator.md` | Agent definition (sonnet tier) |
| `agents/migrator-low.md` | Haiku tier for simple migrations |

**Acceptance Criteria:**
- [ ] Framework auto-detection
- [ ] Destructive change warnings
- [ ] Rollback SQL/code generation
- [ ] Dry-run mode support

---

### Agent 3.2: `devops` - Infrastructure & Deployment Specialist
**Priority:** P2
**Rationale:** Docker, K8s, CI/CD 설정은 특화 지식 필요. 현재 executor가 처리하지만 보안 설정, 리소스 최적화 등 전문 지식 부족.

**Template Reference:** `agents/templates/base-agent.md`

**Agent Tiers:**
| Tier | File | Model | Use Case |
|------|------|-------|----------|
| Standard | `agents/devops.md` | sonnet | Docker, CI/CD, simple K8s |
| High | `agents/devops-high.md` | opus | Complex infra, multi-cloud, security hardening |

**Implementation Approach:**
```
1. 지원 영역:
   - Docker/Compose configuration
   - Kubernetes manifests
   - CI/CD pipelines (GitHub Actions, GitLab CI)
   - Cloud deployments (AWS, GCP, Azure basics)
2. Security best practices 내장
3. Cost optimization suggestions
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `agents/devops.md` | Agent definition (sonnet tier) |
| `agents/devops-high.md` | Opus tier for complex infra |

**Acceptance Criteria:**
- [ ] Docker best practices applied
- [ ] K8s manifests validated (optional kubectl validate)
- [ ] CI/CD pipeline syntax checked
- [ ] Security warnings for common mistakes

---

### Agent 3.3: `translator` - i18n & Localization Specialist
**Priority:** P3
**Rationale:** 다국어 지원은 특화 작업. 현재 writer agent가 처리할 수 있지만 i18n 키 관리, 번역 일관성, RTL 지원 등 전문 기능 부재.

**Template Reference:** `agents/templates/base-agent.md`

**Agent Tiers:**
| Tier | File | Model | Use Case |
|------|------|-------|----------|
| Standard | `agents/translator.md` | sonnet | All i18n tasks |

**Implementation Approach:**
```
1. 지원 i18n frameworks:
   - react-i18next, next-intl
   - vue-i18n
   - Python gettext
2. 기능:
   - 번역 키 추출 및 관리
   - 번역 누락 탐지
   - 번역 일관성 검사
   - 컨텍스트 기반 번역 제안
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `agents/translator.md` | Agent definition (sonnet tier) |

**Acceptance Criteria:**
- [ ] Translation key extraction
- [ ] Missing translation detection
- [ ] Consistent terminology enforcement
- [ ] Context-aware translation suggestions

---

## SECTION 4: MCP Integrations (5개)

### MCP 4.1: `mcp-linear` - Linear Issue Tracker Integration
**Priority:** P1
**Rationale:** GitHub Issues 외에 Linear 사용하는 팀 다수. 이슈 생성, 상태 업데이트, 스프린트 관리 자동화 필요.

**Server Type:** Standalone (separate process)

**Dependencies:**
```bash
npm install @linear/sdk
```

**Registration (`~/.claude/settings.json`):**
```json
{
  "mcpServers": {
    "linear": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/linear-server.js"],
      "env": {
        "LINEAR_API_KEY": "${LINEAR_API_KEY}"
      }
    }
  }
}
```

**Implementation Approach:**
```
1. 기존 GitHub MCP 패턴 참조
2. Linear GraphQL API 활용
3. 기능:
   - linear_create_issue
   - linear_update_issue
   - linear_list_issues
   - linear_get_sprint
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/mcp/linear-server.ts` | MCP server implementation |
| `docs/mcp/linear.md` | Usage documentation |

**Acceptance Criteria:**
- [ ] Issue CRUD operations
- [ ] Sprint/cycle integration
- [ ] Comment support
- [ ] Webhook for real-time updates (optional)

**Estimated Time:** 10-14 hours (includes Linear API learning curve)

---

### MCP 4.2: `mcp-vector-memory` - Semantic Memory with Vector Search
**Priority:** P1
**Rationale:** Claude Swarm의 핵심 기능. 현재 notepad는 keyword 기반. Semantic search로 관련 정보 검색 정확도 향상.

**Server Type:** Standalone (separate process)

**Dependencies:**
```bash
# Option A: SQLite + sqlite-vss (recommended for simplicity)
npm install better-sqlite3
# sqlite-vss requires native compilation

# Option B: LanceDB (pure JS, easier install)
npm install lancedb
```

**Registration (`~/.claude/settings.json`):**
```json
{
  "mcpServers": {
    "vector-memory": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/vector-memory-server.js"],
      "env": {
        "VECTOR_DB_PATH": "${HOME}/.omc/vector.db"
      }
    }
  }
}
```

**Implementation Approach:**
```
1. Local vector DB (SQLite + sqlite-vss 또는 LanceDB)
2. Embedding:
   - Local: all-MiniLM-L6-v2 (onnx)
   - API: OpenAI embeddings (optional)
3. MCP tools:
   - memory_store(content, metadata)
   - memory_search(query, limit)
   - memory_delete(id)
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/mcp/vector-memory-server.ts` | MCP server |
| `scripts/setup-vector-db.mjs` | DB initialization |

**Acceptance Criteria:**
- [ ] Local-first (no external API required)
- [ ] Sub-100ms search latency
- [ ] Metadata filtering support
- [ ] Graceful fallback to keyword search

**Estimated Time:** 18-24 hours (vector DB setup complexity)

---

### MCP 4.3: `mcp-browser` - Browser Automation & Testing
**Priority:** P2
**Rationale:** E2E 테스트, 웹 스크래핑, UI 검증에 browser 자동화 필요. Playwright/Puppeteer 통합.

**Server Type:** Standalone (separate process)

**Dependencies:**
```bash
npm install playwright
npx playwright install  # Downloads browser binaries (~500MB)
```

**Registration (`~/.claude/settings.json`):**
```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/browser-server.js"],
      "env": {
        "PLAYWRIGHT_BROWSERS_PATH": "${HOME}/.cache/ms-playwright"
      }
    }
  }
}
```

**Implementation Approach:**
```
1. Playwright 기반 (cross-browser)
2. MCP tools:
   - browser_navigate(url)
   - browser_click(selector)
   - browser_type(selector, text)
   - browser_screenshot() -> base64
   - browser_evaluate(script)
3. Vision agent와 연동 (screenshot 분석)
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/mcp/browser-server.ts` | MCP server |
| `docs/mcp/browser.md` | Usage documentation |

**Acceptance Criteria:**
- [ ] Navigate and interact with pages
- [ ] Screenshot capture
- [ ] JavaScript evaluation
- [ ] Vision agent integration for visual QA

**Estimated Time:** 12-16 hours

---

### MCP 4.4: `mcp-observability` - Logs, Metrics, Traces Integration
**Priority:** P2
**Rationale:** Production 디버깅 시 로그/메트릭/트레이스 조회 필요. 현재 수동으로 외부 도구 사용.

**Server Type:** Standalone (separate process)

**Dependencies:**
```bash
# Per-provider (install only what's needed)
npm install @datadog/datadog-api-client  # For Datadog
npm install @aws-sdk/client-cloudwatch-logs  # For CloudWatch
```

**Registration (`~/.claude/settings.json`):**
```json
{
  "mcpServers": {
    "observability": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/observability-server.js"],
      "env": {
        "DD_API_KEY": "${DD_API_KEY}",
        "DD_APP_KEY": "${DD_APP_KEY}"
      }
    }
  }
}
```

**Implementation Approach:**
```
1. 지원 backends:
   - Datadog (logs, metrics, APM)
   - Grafana/Loki (logs)
   - CloudWatch (AWS)
2. MCP tools:
   - logs_search(query, timerange)
   - metrics_query(metric, timerange)
   - traces_get(trace_id)
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/mcp/observability-server.ts` | MCP server |
| `docs/mcp/observability.md` | Usage documentation |

**Acceptance Criteria:**
- [ ] Log search with filters
- [ ] Metric visualization data
- [ ] Trace retrieval
- [ ] Multiple backend support

**Estimated Time:** 14-20 hours

---

### MCP 4.5: `mcp-notion` - Notion Workspace Integration
**Priority:** P3
**Rationale:** 문서화, 지식 관리에 Notion 사용하는 팀 다수. 페이지 생성/업데이트, 데이터베이스 쿼리 자동화.

**Server Type:** Standalone (separate process)

**Dependencies:**
```bash
npm install @notionhq/client
```

**Registration (`~/.claude/settings.json`):**
```json
{
  "mcpServers": {
    "notion": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/notion-server.js"],
      "env": {
        "NOTION_API_KEY": "${NOTION_API_KEY}"
      }
    }
  }
}
```

**Implementation Approach:**
```
1. Notion API 활용
2. MCP tools:
   - notion_search(query)
   - notion_get_page(page_id)
   - notion_create_page(parent_id, content)
   - notion_update_page(page_id, content)
   - notion_query_database(db_id, filter)
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/mcp/notion-server.ts` | MCP server |
| `docs/mcp/notion.md` | Usage documentation |

**Acceptance Criteria:**
- [ ] Page CRUD operations
- [ ] Database query with filters
- [ ] Block-level content manipulation
- [ ] Markdown conversion

**Estimated Time:** 10-14 hours

---

## SECTION 5: New Commands (3개)

### Command 5.1: `status` - Comprehensive System Status
**Priority:** P1
**Rationale:** doctor skill은 문제 진단에 집중. 현재 상태 한눈에 보기 (활성 모드, 진행 중 작업, 리소스 사용) 부재.

**Implementation Approach:**
```
/oh-my-black:status
- Active mode: ralph (iteration 3/10)
- Tasks: 5 pending, 2 in-progress, 8 completed
- Agents: 3 running (executor, qa-tester, architect)
- Memory: 45KB notepad, 12 observations
- Duration: 15m 32s
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/status.md` | Command definition |
| `scripts/status-collector.mjs` | Status aggregation |

**Acceptance Criteria:**
- [ ] Shows active mode and iteration
- [ ] Shows task progress
- [ ] Shows running agents
- [ ] Shows resource usage

---

### Command 5.2: `rollback` - Safe State Rollback
**Priority:** P1
**Rationale:** 작업 중 문제 발생 시 이전 상태로 복구 어려움. Git checkpoint + state 파일 롤백 통합.

**Implementation Approach:**
```
1. Checkpoint 생성:
   - Git stash 또는 commit
   - .omc/state/ 스냅샷
2. Rollback:
   - Git restore
   - State 파일 복원
   - Running agent cancellation
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/rollback.md` | Command definition |
| `scripts/checkpoint-manager.mjs` | Checkpoint management |

**Acceptance Criteria:**
- [ ] `rollback checkpoint` creates checkpoint
- [ ] `rollback list` shows checkpoints
- [ ] `rollback to <id>` restores state
- [ ] Confirmation required for destructive rollback

---

### Command 5.3: `config` - Unified Configuration Management
**Priority:** P2
**Rationale:** 설정이 여러 파일에 분산 (.omb-config.json, .omc/, hooks.json). 통합 관리 인터페이스 필요.

**Implementation Approach:**
```
/oh-my-black:config show - 전체 설정 표시
/oh-my-black:config get <key> - 특정 설정 조회
/oh-my-black:config set <key> <value> - 설정 변경
/oh-my-black:config reset - 기본값 복원
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `commands/config.md` | Command definition |
| `scripts/config-manager.mjs` | Configuration management |

**Acceptance Criteria:**
- [ ] All config sources unified view
- [ ] Get/set individual values
- [ ] Validation before save
- [ ] Backup before changes

---

## Task Flow and Dependencies

```
[P1 Skills] ──────────────────────────────────────────────┐
    │                                                      │
    ├── 1.2 worktree (requires git worktree knowledge)     │
    ├── 1.3 debug (requires systematic protocol)           │
    └── 1.6 refactor (requires AST-grep integration)       │
                                                           │
[P1 Hooks] ────────────────────────────────────────────────┤
    │                                                      │
    └── 2.1 context-optimizer (requires pre-compact ext)   │
                                                           │
[P1 MCP] ──────────────────────────────────────────────────┤
    │                                                      │
    ├── 4.1 mcp-linear (standalone)                        │
    └── 4.2 mcp-vector-memory (standalone)                 │
                                                           │
[P1 Commands] ─────────────────────────────────────────────┤
    │                                                      │
    ├── 5.1 status (requires state aggregation)            │
    └── 5.2 rollback (requires checkpoint system)          │
                                                           │
[P2 Skills] ──────────────────────────────────────────────┤
    │                                                      │
    ├── 1.1 brainstorm (standalone)                        │
    ├── 1.4 council (requires multi-CLI setup)             │
    └── 1.5 perf (requires profiler adapters)              │
                                                           │
[P2 Hooks & Agents] ───────────────────────────────────────┤
    │                                                      │
    ├── 2.2 auto-test-trigger (depends on test patterns)   │
    ├── 3.1 migrator (standalone)                          │
    └── 3.2 devops (standalone)                            │
                                                           │
[P2 MCP & Commands] ───────────────────────────────────────┤
    │                                                      │
    ├── 4.3 mcp-browser (requires Playwright)              │
    ├── 4.4 mcp-observability (requires backend configs)   │
    └── 5.3 config (depends on state structure)            │
                                                           │
[P3 Items] ────────────────────────────────────────────────┘
    │
    ├── 1.7 doc (standalone)
    ├── 2.3 progress-reporter (depends on HUD)
    ├── 3.3 translator (standalone)
    └── 4.5 mcp-notion (standalone)
```

---

## Detailed TODOs by Priority

### Priority 1 (Critical - Implement First)

| ID | Category | Item | Files | Est. Hours |
|----|----------|------|-------|------------|
| 1.2 | Skill | worktree | 3 files | 8-12 |
| 1.3 | Skill | debug | 3 files | 6-8 |
| 1.6 | Skill | refactor | 3 files | 10-15 |
| 2.1 | Hook | context-optimizer | 2 files | 4-6 |
| 4.1 | MCP | linear | 2 files | 10-14 |
| 4.2 | MCP | vector-memory | 2 files | 18-24 |
| 5.1 | Command | status | 2 files | 3-4 |
| 5.2 | Command | rollback | 2 files | 6-8 |

**P1 Total:** 65-91 hours

### Priority 2 (Important - Implement Second)

| ID | Category | Item | Files | Est. Hours |
|----|----------|------|-------|------------|
| 1.1 | Skill | brainstorm | 2 files | 4-6 |
| 1.4 | Skill | council | 3 files | 8-12 |
| 1.5 | Skill | perf | 3 files | 8-12 |
| 2.2 | Hook | auto-test-trigger | 2 files | 4-6 |
| 3.1 | Agent | migrator | 2 files | 6-8 |
| 3.2 | Agent | devops | 2 files | 6-8 |
| 4.3 | MCP | browser | 2 files | 12-16 |
| 4.4 | MCP | observability | 2 files | 14-20 |
| 5.3 | Command | config | 2 files | 4-6 |

**P2 Total:** 66-94 hours

### Priority 3 (Nice to Have)

| ID | Category | Item | Files | Est. Hours |
|----|----------|------|-------|------------|
| 1.7 | Skill | doc | 2 files | 4-6 |
| 2.3 | Hook | progress-reporter | 3 files | 6-8 |
| 3.3 | Agent | translator | 1 file | 4-6 |
| 4.5 | MCP | notion | 2 files | 10-14 |

**P3 Total:** 24-34 hours

---

## Test File Patterns

Each new component should have corresponding tests:

| Component Type | Test Location Pattern |
|----------------|----------------------|
| Skills | `commands/__tests__/{skill}.test.md` (behavior spec) |
| Hooks | `scripts/__tests__/{hook}.test.mjs` |
| Agents | `agents/__tests__/{agent}.test.md` (behavior spec) |
| MCP Servers | `src/mcp/__tests__/{server}.test.ts` |
| Scripts | `scripts/__tests__/{script}.test.mjs` |

---

## Commit Strategy

```
feat(skill): add worktree skill for parallel development with git worktrees

- Add worktree skill with create/exec/merge/list commands
- Add worktree-manager.mjs for lifecycle management
- Add worktree-executor agent for isolated execution

feat(skill): add debug skill with systematic debugging protocol

- Add 5-phase debugging protocol (reproduce, isolate, hypothesize, test, fix)
- Add debugger agent for specialized debugging
- Add git bisect integration for regression detection
- Clear boundary: debug=bug-specific, analyze=general investigation

feat(skill): add refactor skill with safe large-scale refactoring

- Add refactoring operations (rename, extract, move, inline)
- Integrate with mcp__plugin_oh-my-black_t__ast_grep_replace tool
- Add checkpoint-based rollback support

feat(hook): add context-optimizer for automatic context compression

- Add context analysis and compression in PreCompact (runs before pre-compact.mjs)
- Reduce context size by 30%+ while preserving critical info
- Add configurable token budget

feat(mcp): add linear integration for issue tracking

- Add Linear GraphQL API MCP server (standalone)
- Support issue CRUD, sprint management, comments
- Registration docs for ~/.claude/settings.json

feat(mcp): add vector-memory for semantic search

- Add local vector DB with LanceDB
- Add MCP tools for memory_store/search/delete
- Support local embeddings (no external API required)

feat(command): add status command for system overview

- Show active mode, task progress, running agents
- Show memory usage and session duration

feat(command): add rollback command for safe state recovery

- Add checkpoint creation and restoration
- Support git + state file combined rollback
```

---

## Success Criteria

### Quantitative
- [ ] P1 items: 100% implemented
- [ ] P2 items: 70%+ implemented
- [ ] Test coverage: 80%+ for new code
- [ ] Hook latency: <100ms each (except auto-test-trigger)

### Qualitative
- [ ] Skills integrate seamlessly with existing workflows
- [ ] MCP servers stable and well-documented
- [ ] No breaking changes to existing functionality
- [ ] User feedback positive on new features

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Git worktree conflicts | High | Medium | Isolated branches, merge conflict detection |
| Vector DB performance | Medium | Low | Benchmark, fallback to keyword search |
| Multi-LLM API failures | Medium | Medium | Graceful fallback to Claude-only |
| Context compression data loss | High | Low | Conservative compression, preserve Priority Context |
| MCP server stability | Medium | Medium | Comprehensive error handling, timeouts |
| Native dependency build failures | Medium | Medium | Provide LanceDB as pure-JS alternative |

---

## Notes for Executor

1. **Start with P1 items** - These provide the most value and unblock other features
2. **Test in isolation** - Each new component should be testable standalone
3. **Follow existing patterns** - Match style of current skills/hooks/agents
4. **Document as you go** - Update CLAUDE.md and docs/ for each feature
5. **Feature flags** - New features should be opt-in where appropriate
6. **Reference base-agent.md** - All new agents must follow `agents/templates/base-agent.md` structure
7. **Use ast_grep_replace** - For structural code changes, use the existing MCP tool

---

*Plan generated by Prometheus (planner agent)*
*Iteration 2 - Addressed all critic feedback*
*Ready for Critic review*

PLAN_READY: /Users/kimtaeyoun/Personal/Dev/oh-my-black/.omb/plans/enhancement-recommendations.md
