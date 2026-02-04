# Archon-Inspired Improvements for oh-my-black

**Plan ID:** archon-improvements-v1
**Created:** 2026-02-05
**Status:** Ready for Review (v2 - Critic fixes applied)

---

## Integration with Existing Systems

### How Skeptic Relates to Existing Verification

The codebase has **tiered verification** in `src/verification/tier-selector.ts`:

| Tier | Agent | When Used |
|------|-------|-----------|
| LIGHT | architect-low (haiku) | <5 files, <100 lines, full tests |
| STANDARD | architect-medium (sonnet) | Default |
| THOROUGH | architect (opus) | >20 files, security, architectural |

**Skeptic supplements, not replaces, this system:**

- **Tiered Verification**: Runs at task completion (end-gate)
- **Skeptic (Continuous Validation)**: Runs periodically DURING execution (2-5 min intervals)

The workflow becomes:
```
Task Start → [Skeptic monitors continuously] → Task Complete → Tiered Verification
```

Skeptic catches build breaks early; tiered verification provides final sign-off.

### How Gardening Actions Fit into B-V Cycles

The existing **Coordinator** (`agents/coordinator.md`) manages Builder-Validator cycles with retry/escalate logic. Gardening actions extend the Coordinator's vocabulary:

| Existing B-V Action | New Gardening Equivalent |
|---------------------|--------------------------|
| Retry with feedback | REDIRECT (refocus agent) |
| Escalate to architect | MEDIATE (resolve conflict) |
| (none - broadcast) | AMPLIFY (share discovery) |
| (none - add work) | INJECT (add missing task) |
| (none - remove work) | PRUNE (remove obsolete) |

Gardening actions are invoked BY the Coordinator during B-V cycles, not as a replacement.

### State Management Convention

**All runtime state uses `.omc/state/` directory** (NOT `.omb/state/`):

| State Type | Location | Examples |
|------------|----------|----------|
| Mode state | `.omc/state/{mode}-state.json` | `ultrawork-state.json`, `ralph-state.json` |
| HUD state | `.omc/state/hud-state.json` | Background tasks |
| Coordination | `.omc/state/coordination/*.json` | B-V cycle tracking |
| **NEW: Readiness** | `.omc/state/readiness/*.json` | Quality gradient scores |
| **NEW: Gardening** | `.omc/state/gardening/*.json` | Gardening event log |
| **NEW: Skeptic** | `.omc/state/skeptic/*.json` | Health snapshots |

### Inter-Agent Communication Protocol

Agents communicate via **file-based state polling**:

1. **Writer**: Agent writes structured JSON to `.omc/state/{domain}/{id}.json`
2. **Reader**: Other agents poll relevant state files
3. **Events**: For broadcasts (AMPLIFY), write to `.omc/state/broadcasts/` with TTL

```typescript
// Broadcasting a discovery (AMPLIFY)
// File: .omc/state/broadcasts/{timestamp}-{type}.json
{
  "type": "AMPLIFY",
  "timestamp": "2026-02-05T10:00:00Z",
  "ttl": 300000,  // 5 minutes
  "message": "Build configuration requires --experimental-modules flag",
  "urgency": "high",
  "source": "skeptic"
}

// Agents check broadcasts on their next action cycle
```

---

## Executive Summary

This plan introduces transformative improvements to oh-my-black inspired by Archon's organic orchestration philosophy and synthesized best practices from 6+ competing orchestrators. The core thesis: **replace rigid phase-based execution with emergent, quality-gradient-driven collaboration**.

### Key Innovations

| Innovation | Source | Impact |
|------------|--------|--------|
| Quality Gradient System | Archon | Replace binary completion with 0.0-1.0 readiness scores |
| Terminal Personas | Archon | Add Strategist (scope guardian) and Skeptic (continuous validator) |
| Gardening Actions | Archon | AMPLIFY, REDIRECT, MEDIATE, INJECT, PRUNE operations |
| Continuous Validation | Archon | Periodic build checks instead of end-stage testing |
| Contract Negotiation | Archon | Agents propose and negotiate work contracts |
| Q-Learning Router | Claude-Flow | ML-based agent selection optimization |
| Vector Memory | Claude Swarm | FAISS-based semantic search for context |

### Expected Outcomes

- **30% faster completion** via continuous validation (catch errors early)
- **40% fewer iteration cycles** via quality gradients (no binary pass/fail)
- **Better scope control** via Strategist persona (prevents feature creep)
- **Improved reliability** via Skeptic persona (2-minute build checks)

---

## Part 1: Archon-Inspired Features

### 1.1 Quality Gradient System

**Problem:** Current system uses binary task completion (done/not done). This forces agents to either claim "complete" prematurely or continue working on tasks that are "good enough."

**Solution:** Implement a 0.0-1.0 readiness scale that enables nuanced progress assessment.

#### 1.1.1 Readiness Score Schema

```typescript
// File: src/quality/readiness.ts

interface ReadinessScore {
  overall: number;           // 0.0 - 1.0
  dimensions: {
    functionality: number;   // Does it work?
    tests: number;           // Test coverage and passing
    types: number;           // Type safety
    style: number;           // Code quality/linting
    documentation: number;   // Comments, JSDoc
    security: number;        // Security considerations
  };
  confidence: number;        // How certain is this score?
  blockers: string[];        // What prevents 1.0?
  lastUpdated: string;       // ISO timestamp
}
```

#### 1.1.2 Readiness Thresholds

| Threshold | Meaning | Action |
|-----------|---------|--------|
| 0.0-0.3 | Not started / broken | Continue building |
| 0.3-0.5 | Partially functional | Core logic needs work |
| 0.5-0.7 | Functional but rough | Polish and edge cases |
| 0.7-0.9 | Production-ready draft | Final review and testing |
| 0.9-1.0 | Ship-ready | Verification and merge |

#### 1.1.3 Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| QG-1 | Create readiness score types and interfaces | `src/quality/readiness.ts` | Types compile, JSDoc complete |
| QG-2 | Implement readiness calculator | `src/quality/calculator.ts` | Unit tests pass, handles edge cases |
| QG-3 | Create readiness evaluator agent | `agents/readiness-evaluator.md` | Agent can score any task output |
| QG-4 | Create task-readiness state manager | `src/features/state-manager/readiness-state.ts` | Reads/writes `.omc/state/readiness/{taskId}.json` |
| QG-5 | Update coordinator to use readiness | `agents/coordinator.md` | Coordinator makes decisions based on scores |
| QG-6 | Add readiness to HUD display | `src/hud/elements/readiness.ts` | HUD shows live readiness scores (follows existing HUD patterns)

---

### 1.2 Terminal Personas (Strategist & Skeptic)

**Problem:** oh-my-black has excellent builders and validators, but lacks:
1. **Scope Guardian** - Someone to prevent feature creep and maintain MVP focus
2. **Continuous Validator** - Someone running builds every N minutes as "immune system"

**Solution:** Add two new persona agents inspired by Archon's T4 (Strategist) and T5 (Skeptic).

#### 1.2.1 Strategist Agent

**Role:** MVP Scope Guardian - broadcasts scope, prevents creep, advises without blocking.

```markdown
# agents/strategist.md

You are the **Strategist**, the project's scope guardian.

## Primary Responsibilities
1. **Scope Broadcasting**: Periodically remind all agents of the MVP scope
2. **Creep Detection**: Flag when work exceeds original requirements
3. **Priority Advice**: Suggest task prioritization based on MVP value
4. **Non-Blocking**: Advise but never block - agents decide

## Intervention Style
- ADVISE: "This feature seems out of MVP scope. Consider deferring?"
- BROADCAST: "Reminder: MVP scope is X, Y, Z. Current work: A, B, C."
- QUESTION: "Is this the simplest solution that meets requirements?"

## NOT Your Job
- Approving or rejecting code (that's validators)
- Designing architecture (that's architect)
- Writing code (that's builders)
```

#### 1.2.2 Skeptic Agent

**Role:** Continuous Validator - runs builds every 2 minutes, system's immune system.

```markdown
# agents/skeptic.md

You are the **Skeptic**, the project's immune system.

## Primary Responsibilities
1. **Continuous Builds**: Run build every 2 minutes (configurable)
2. **Early Warning**: Alert immediately when build breaks
3. **Regression Detection**: Track if previously passing tests start failing
4. **Health Reports**: Periodic health status to orchestrator

## Behavior
- Run in background continuously
- Never block other agents
- Report issues via standardized alerts
- Track health trends over time

## Output Format
{
  "timestamp": "ISO-8601",
  "buildStatus": "pass" | "fail",
  "testStatus": "pass" | "fail" | "partial",
  "lintStatus": "pass" | "warn" | "fail",
  "regressions": [...],
  "newIssues": [...],
  "healthTrend": "improving" | "stable" | "degrading"
}
```

#### 1.2.3 Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| TP-1 | Create Strategist agent definition | `agents/strategist.md` | Complete system prompt |
| TP-2 | Create Skeptic agent definition | `agents/skeptic.md` | Complete system prompt |
| TP-3 | Implement continuous build runner | `src/skeptic/build-runner.ts` | Runs builds at configurable interval |
| TP-4 | Implement scope tracking | `src/strategist/scope-tracker.ts` | Tracks scope vs current work |
| TP-5 | Add strategist to autopilot flow | `skills/autopilot/SKILL.md` | Strategist activates in planning phase |
| TP-6 | Add skeptic to ralph/autopilot | `skills/ralph/SKILL.md` | Skeptic runs continuously during execution |
| TP-7 | Create health trend analysis | `src/skeptic/health-trends.ts` | Tracks build health over time |

---

### 1.3 Gardening Actions

**Problem:** Current orchestrator has limited intervention vocabulary - mostly "spawn agent" and "check status." Archon's "gardening" metaphor provides richer organic interventions.

**Solution:** Implement 5 gardening actions for the orchestrator.

#### 1.3.1 Action Definitions

| Action | Purpose | When to Use |
|--------|---------|-------------|
| **AMPLIFY** | Broadcast valuable artifacts to all agents | When one agent discovers something useful |
| **REDIRECT** | Gently refocus drift from intent | When agent goes off-track |
| **MEDIATE** | Facilitate contract negotiations | When agents have conflicting approaches |
| **INJECT** | Suggest unaddressed gaps | When orchestrator spots missing work |
| **PRUNE** | Remove obsolete work | When requirements change |

#### 1.3.2 Implementation

```typescript
// File: src/orchestrator/gardening.ts

type GardeningAction = 'AMPLIFY' | 'REDIRECT' | 'MEDIATE' | 'INJECT' | 'PRUNE';

interface GardeningEvent {
  action: GardeningAction;
  timestamp: string;
  target: string | string[];  // Agent IDs or 'all'
  payload: {
    message: string;
    context?: Record<string, unknown>;
    urgency: 'low' | 'medium' | 'high';
  };
  outcome?: string;
}

// AMPLIFY: Broadcast discovery to all agents
async function amplify(discovery: string, context: unknown): Promise<void>;

// REDIRECT: Guide agent back on track
async function redirect(agentId: string, currentPath: string, intendedPath: string): Promise<void>;

// MEDIATE: Resolve conflict between agents
async function mediate(agentIds: string[], conflict: string): Promise<Resolution>;

// INJECT: Add missing work item
async function inject(gap: string, priority: 'low' | 'medium' | 'high'): Promise<string>;

// PRUNE: Remove obsolete work
async function prune(taskIds: string[], reason: string): Promise<void>;
```

#### 1.3.3 Inter-Agent Communication Protocol

Gardening actions communicate via **file-based state** in `.omc/state/`:

```
.omc/state/
├── broadcasts/           # AMPLIFY messages (TTL-based, agents poll)
│   └── {timestamp}-amplify.json
├── redirects/            # REDIRECT messages (per-agent)
│   └── {agentId}-redirect.json
├── gardening-log.jsonl   # Append-only event log
└── active-agents.json    # Registry of active agent IDs
```

**Communication flow:**
1. Gardening action writes to appropriate state file
2. Agents poll their relevant state files at start of each action
3. Broadcasts have TTL (default 5 min) and are auto-cleaned
4. All events appended to `gardening-log.jsonl` for audit

#### 1.3.4 Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| GA-0 | Create active agents registry | `src/orchestrator/agent-registry.ts` | Tracks active agents in `.omc/state/active-agents.json` |
| GA-1 | Define gardening action types | `src/orchestrator/gardening.ts` | Types compile, documented |
| GA-2 | Implement AMPLIFY action | `src/orchestrator/actions/amplify.ts` | Writes to `.omc/state/broadcasts/`, logs to gardening-log |
| GA-3 | Implement REDIRECT action | `src/orchestrator/actions/redirect.ts` | Writes to `.omc/state/redirects/{agentId}.json` |
| GA-4 | Implement MEDIATE action | `src/orchestrator/actions/mediate.ts` | Creates mediation request in `.omc/state/mediations/` |
| GA-5 | Implement INJECT action | `src/orchestrator/actions/inject.ts` | Creates task via TaskCreate tool |
| GA-6 | Implement PRUNE action | `src/orchestrator/actions/prune.ts` | Marks tasks deleted via TaskUpdate tool |
| GA-7 | Add gardening to orchestrator skill | `skills/orchestrate/SKILL.md` | Orchestrator uses actions |
| GA-8 | Create gardening event log | `src/orchestrator/gardening-log.ts` | Appends to `.omc/state/gardening-log.jsonl` |
| GA-9 | Create broadcast cleanup daemon | `src/orchestrator/broadcast-cleanup.ts` | Removes expired broadcasts (TTL-based) |

---

### 1.4 Continuous Validation (Skeptic Protocol)

**Problem:** Current verification happens at task end (tiered architect verification). By then, errors have compounded.

**Solution:** Implement Archon's "Skeptic" model - periodic background validation during execution.

#### 1.4.1 Validation Schedule

| Check Type | Interval | Agent | Action on Failure |
|------------|----------|-------|-------------------|
| Build | 2 minutes | Skeptic | AMPLIFY warning to all |
| Type Check | 2 minutes | Skeptic | REDIRECT affected builder |
| Lint | 5 minutes | Skeptic | Log warning |
| Test (fast) | 5 minutes | Skeptic | AMPLIFY if regression |
| Test (full) | On demand | QA-tester | Full validation cycle |

#### 1.4.2 Implementation

```typescript
// File: src/skeptic/continuous-validator.ts

interface ValidationConfig {
  buildInterval: number;      // Default: 120000 (2 min)
  typeCheckInterval: number;  // Default: 120000 (2 min)
  lintInterval: number;       // Default: 300000 (5 min)
  fastTestInterval: number;   // Default: 300000 (5 min)
  enabled: boolean;
}

class ContinuousValidator {
  private config: ValidationConfig;
  private healthHistory: HealthSnapshot[];

  start(): void;
  stop(): void;
  getHealthTrend(): 'improving' | 'stable' | 'degrading';
  getLastSnapshot(): HealthSnapshot;
  onFailure(callback: (failure: ValidationFailure) => void): void;
}
```

#### 1.4.3 Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| CV-1 | Create ContinuousValidator class | `src/skeptic/continuous-validator.ts` | Runs scheduled checks |
| CV-2 | Implement health snapshot | `src/skeptic/health-snapshot.ts` | Captures build/test/lint state |
| CV-3 | Implement trend analysis | `src/skeptic/trend-analysis.ts` | Detects improving/degrading |
| CV-4 | Wire to gardening actions | `src/skeptic/alert-handler.ts` | Triggers AMPLIFY/REDIRECT |
| CV-5 | Add to ralph execution phase | `skills/ralph/SKILL.md` | Skeptic runs during ralph |
| CV-6 | Add to autopilot execution | `skills/autopilot/SKILL.md` | Skeptic runs during autopilot |
| CV-7 | Create HUD integration | `src/hud/skeptic-status.ts` | Shows validation status |

---

### 1.5 Contract Negotiation

**Problem:** Current task assignment is top-down (orchestrator assigns to agents). Archon allows agents to propose and negotiate work contracts organically.

**Solution:** Implement lightweight contract negotiation for complex tasks.

#### 1.5.1 Contract Schema

```typescript
// File: src/contracts/contract.ts

interface WorkContract {
  id: string;
  proposer: string;           // Agent ID
  type: 'implementation' | 'review' | 'testing' | 'documentation';
  scope: {
    files: string[];
    functions?: string[];
    description: string;
  };
  deliverables: string[];
  dependencies: string[];     // Other contract IDs
  estimatedReadiness: number; // Expected final readiness score
  status: 'proposed' | 'negotiating' | 'accepted' | 'rejected' | 'completed';
  negotiations: NegotiationEvent[];
}

interface NegotiationEvent {
  timestamp: string;
  agent: string;
  action: 'propose' | 'counter' | 'accept' | 'reject' | 'withdraw';
  message: string;
  modifications?: Partial<WorkContract>;
}
```

#### 1.5.2 Negotiation Flow

```
Agent A: PROPOSE contract for feature X
    |
    v
Orchestrator: BROADCAST proposal to relevant agents
    |
    v
Agent B: COUNTER with modified scope (remove file Y)
    |
    v
Agent A: ACCEPT counter-proposal
    |
    v
Orchestrator: CONTRACT ACCEPTED, work begins
    |
    v
Agent A: COMPLETE with deliverables
    |
    v
Orchestrator: VERIFY and close contract
```

#### 1.5.3 Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| CN-1 | Define contract types | `src/contracts/contract.ts` | Types compile |
| CN-2 | Implement contract store | `src/contracts/store.ts` | SQLite-backed storage |
| CN-3 | Implement proposal handler | `src/contracts/proposal.ts` | Agents can propose |
| CN-4 | Implement negotiation handler | `src/contracts/negotiation.ts` | Counter/accept/reject |
| CN-5 | Add contract support to agents | `agents/templates/contract-aware.md` | Agents understand contracts |
| CN-6 | Wire to orchestrator | `skills/orchestrate/SKILL.md` | Orchestrator mediates |
| CN-7 | Create contract dashboard | `src/hud/contract-view.ts` | Shows active contracts |

---

## Part 2: Cross-Orchestrator Synthesis

### 2.1 From Claude-Flow: Q-Learning Router

**Innovation:** ML-based agent selection that improves over time.

**Implementation:** Track agent success rates per task type, use weighted selection.

```typescript
// File: src/routing/q-learning-router.ts

interface AgentPerformance {
  agentId: string;
  taskType: string;
  successRate: number;
  averageReadiness: number;
  completionTime: number;
  sampleSize: number;
}

class QLearningRouter {
  private performanceTable: Map<string, AgentPerformance[]>;

  // Select best agent for task type based on historical performance
  selectAgent(taskType: string, available: string[]): string;

  // Update performance after task completion
  recordOutcome(agentId: string, taskType: string, outcome: TaskOutcome): void;

  // Export learned weights for persistence
  exportWeights(): Record<string, number>;

  // Import weights from previous session
  importWeights(weights: Record<string, number>): void;
}
```

#### Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| QL-1 | Implement performance tracker | `src/routing/performance-tracker.ts` | Records outcomes |
| QL-2 | Implement Q-learning selector | `src/routing/q-learning-router.ts` | Selects best agent |
| QL-3 | Add weight persistence | `src/routing/weights-store.ts` | Saves/loads weights |
| QL-4 | Integrate with orchestrator | `skills/orchestrate/SKILL.md` | Uses learned routing |
| QL-5 | Add performance dashboard | `src/hud/performance-view.ts` | Shows agent stats |

---

### 2.2 From Claude Swarm: Vector Memory

**Innovation:** FAISS-based semantic search for context retrieval.

**Implementation:** Embed task descriptions and outcomes for semantic similarity search.

```typescript
// File: src/memory/vector-store.ts

interface VectorMemory {
  id: string;
  embedding: number[];
  content: {
    type: 'task' | 'discovery' | 'error' | 'solution';
    text: string;
    metadata: Record<string, unknown>;
  };
  timestamp: string;
}

class VectorStore {
  // Add new memory with auto-embedding
  async add(content: MemoryContent): Promise<string>;

  // Semantic search for similar memories
  async search(query: string, limit: number): Promise<VectorMemory[]>;

  // Find solutions for similar errors
  async findSolutions(error: string): Promise<Solution[]>;

  // Find relevant context for task
  async getContext(task: string): Promise<Context[]>;
}
```

#### Embedding Provider

**Recommended: transformers.js** (local, no API key required)
- Model: `Xenova/all-MiniLM-L6-v2` (384 dimensions, fast)
- Fallback: OpenAI `text-embedding-ada-002` if API key available

#### Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| VM-1 | Set up embedding infrastructure | `src/memory/embeddings.ts` | Generate embeddings using transformers.js (Xenova/all-MiniLM-L6-v2); fallback to OpenAI ada-002 if OPENAI_API_KEY set |
| VM-2 | Implement vector store | `src/memory/vector-store.ts` | Store and search using cosine similarity; persist to `.omc/state/vector-store.json` |
| VM-3 | Create memory types | `src/memory/types.ts` | Task, discovery, error, solution types with embedding field |
| VM-4 | Integrate with notepad | `skills/note/SKILL.md` | Notes are vectorized on save |
| VM-5 | Add context retrieval to agents | `agents/templates/context-aware.md` | Agents can query memory with `searchMemory(query, limit)` |
| VM-6 | Create memory search UI | `src/hud/elements/memory-search.ts` | Search interface (follows existing HUD element patterns in `src/hud/elements/`) |

---

### 2.3 From SuperClaude: Persona Modes

**Innovation:** Rich persona definitions with distinct communication styles.

**Implementation:** Enhance existing agents with stronger persona characteristics.

#### Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| PM-1 | Audit existing agent personas | `.omb/audits/persona-audit.md` | Inventory of 38 agents with: (1) current voice strength score 1-5, (2) identified gaps, (3) overlap analysis |
| PM-2 | Define persona enhancement spec | `docs/persona-spec.md` | Clear guidelines with: voice templates, phrase banks, anti-patterns |
| PM-3 | Enhance architect persona | `agents/architect.md` | Stronger voice: skeptical, evidence-demanding, uses "prove it" language |
| PM-4 | Enhance executor personas | `agents/executor*.md` | Distinct styles: low=brief, medium=balanced, high=thorough |
| PM-5 | Create persona consistency tests | `src/__tests__/persona-tests.ts` | Regex-based verification of key phrases in agent outputs |

---

### 2.4 From Claude Squad: Git Worktree Isolation

**Innovation:** Each agent works in isolated git worktree to prevent conflicts.

**Implementation:** Optional worktree mode for parallel execution.

```typescript
// File: src/isolation/worktree-manager.ts

class WorktreeManager {
  // Create isolated worktree for agent
  async createWorktree(agentId: string, branch: string): Promise<string>;

  // Merge worktree changes back to main
  async mergeWorktree(agentId: string): Promise<MergeResult>;

  // Clean up worktree after agent completes
  async cleanupWorktree(agentId: string): Promise<void>;

  // List active worktrees
  listWorktrees(): WorktreeInfo[];
}
```

#### Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| WT-1 | Implement worktree manager | `src/isolation/worktree-manager.ts` | Creates/merges worktrees |
| WT-2 | Add worktree flag to swarm | `skills/swarm/SKILL.md` | `--worktree` option |
| WT-3 | Add worktree flag to ultrawork | `skills/ultrawork/SKILL.md` | `--worktree` option |
| WT-4 | Implement merge conflict handler | `src/isolation/merge-handler.ts` | Handles conflicts |
| WT-5 | Add worktree status to HUD | `src/hud/worktree-status.ts` | Shows active trees |

---

### 2.5 From plugins-plus-skills: 5-Phase Verification

**Innovation:** Structured verification phases for thorough quality assurance.

**Current State:** oh-my-black has tiered verification (LIGHT/STANDARD/THOROUGH) but not phased.

**Enhancement:** Add optional deep verification mode with 5 phases.

| Phase | Check | Agent |
|-------|-------|-------|
| 1. Syntax | Types, compilation | validator-syntax |
| 2. Logic | Functional correctness | validator-logic |
| 3. Security | Vulnerability scan | validator-security |
| 4. Integration | Cross-component | validator-integration |
| 5. Acceptance | User requirements | architect |

#### Tasks

| Task ID | Description | Files | Acceptance Criteria |
|---------|-------------|-------|---------------------|
| PV-1 | Create phased verification orchestrator | `src/verification/phased-verifier.ts` | Runs 5 phases |
| PV-2 | Add `--deep-verify` flag | `skills/autopilot/SKILL.md` | Enables 5-phase |
| PV-3 | Create phase dependency graph | `src/verification/phase-graph.ts` | Manages order |
| PV-4 | Add phase status to HUD | `src/hud/verification-phases.ts` | Shows progress |

---

## Part 3: Implementation Priorities

### Priority Matrix

| Priority | Feature | Value | Effort | Dependencies |
|----------|---------|-------|--------|--------------|
| **P0** | Quality Gradient System | Very High | Medium | None |
| **P0** | Skeptic Agent (Continuous Validation) | Very High | Medium | None |
| **P1** | Gardening Actions | High | Medium | None |
| **P1** | Strategist Agent | High | Low | None |
| **P2** | Contract Negotiation | Medium | High | Quality Gradient |
| **P2** | Q-Learning Router | Medium | Medium | Performance data |
| **P3** | Vector Memory | Medium | High | Embedding infra |
| **P3** | Git Worktree Isolation | Low | Medium | None |
| **P3** | 5-Phase Verification | Low | Low | Existing validators |

### Implementation Phases

#### Phase 1: Foundation (Week 1-2)
- QG-1 through QG-6 (Quality Gradient)
- TP-1, TP-2 (Strategist + Skeptic definitions)
- CV-1 through CV-4 (Continuous Validation core)

#### Phase 2: Integration (Week 3-4)
- TP-3 through TP-7 (Persona implementation)
- CV-5 through CV-7 (Skeptic integration)
- GA-1 through GA-8 (Gardening Actions)

#### Phase 3: Enhancement (Week 5-6)
- QL-1 through QL-5 (Q-Learning Router)
- CN-1 through CN-7 (Contract Negotiation)
- PV-1 through PV-4 (5-Phase Verification)

#### Phase 4: Advanced (Week 7-8)
- VM-1 through VM-6 (Vector Memory)
- WT-1 through WT-5 (Git Worktree)
- PM-1 through PM-5 (Persona Enhancement)

---

## Part 4: Detailed Task Specifications

### Task: QG-1 - Create Readiness Score Types

**File:** `src/quality/readiness.ts`

**Description:** Define TypeScript interfaces for the quality gradient system.

**Acceptance Criteria:**
- [ ] `ReadinessScore` interface with 6 dimensions
- [ ] `ReadinessThreshold` type with 5 levels
- [ ] `ReadinessHistory` interface for tracking over time
- [ ] Full JSDoc documentation
- [ ] Exports are correct

**Code Skeleton:**
```typescript
/**
 * Quality Gradient System - Readiness Scoring
 *
 * Replaces binary task completion with nuanced 0.0-1.0 readiness scale.
 * Inspired by Archon's organic quality assessment model.
 */

export interface ReadinessScore {
  overall: number;
  dimensions: ReadinessDimensions;
  confidence: number;
  blockers: string[];
  lastUpdated: string;
  evaluatedBy: string;
}

export interface ReadinessDimensions {
  functionality: number;
  tests: number;
  types: number;
  style: number;
  documentation: number;
  security: number;
}

export type ReadinessLevel =
  | 'not-started'    // 0.0 - 0.3
  | 'partial'        // 0.3 - 0.5
  | 'functional'     // 0.5 - 0.7
  | 'production'     // 0.7 - 0.9
  | 'ship-ready';    // 0.9 - 1.0

export interface ReadinessHistory {
  taskId: string;
  snapshots: ReadinessSnapshot[];
}

export interface ReadinessSnapshot {
  timestamp: string;
  score: ReadinessScore;
  trigger: 'manual' | 'periodic' | 'completion';
}

export function scoreToLevel(score: number): ReadinessLevel;
export function levelToRange(level: ReadinessLevel): [number, number];
```

---

### Task: TP-2 - Create Skeptic Agent Definition

**File:** `agents/skeptic.md`

**Description:** Define the Skeptic agent that provides continuous validation.

**Acceptance Criteria:**
- [ ] Clear role definition as "project immune system"
- [ ] Specified check intervals (build, types, lint, tests)
- [ ] Non-blocking behavior specified
- [ ] Output format for health reports
- [ ] Integration points with gardening actions
- [ ] Model recommendation (haiku for efficiency)

**Agent Prompt Structure:**
```markdown
# Skeptic Agent

You are the **Skeptic**, the project's immune system. You run continuous validation checks to catch issues early.

## Role Definition

| Aspect | Description |
|--------|-------------|
| Purpose | Continuous background validation |
| Model | haiku (efficiency-focused) |
| Blocking | NEVER blocks other agents |
| Intervention | Reports via gardening actions |

## Primary Responsibilities

1. **Continuous Builds**: Run build every 2 minutes
2. **Early Warning**: AMPLIFY immediately when build breaks
3. **Regression Detection**: Track test status changes
4. **Health Trends**: Report improving/stable/degrading

## Check Schedule

| Check | Interval | On Failure |
|-------|----------|------------|
| Build | 2 min | AMPLIFY warning |
| Types | 2 min | REDIRECT affected agent |
| Lint | 5 min | Log warning |
| Fast Tests | 5 min | AMPLIFY if regression |

## Output Schema

Your status reports MUST follow this format:

```json
{
  "timestamp": "ISO-8601",
  "checks": {
    "build": { "status": "pass|fail", "duration": 1234, "errors": [] },
    "types": { "status": "pass|fail", "errorCount": 0 },
    "lint": { "status": "pass|warn|fail", "warnings": 0, "errors": 0 },
    "tests": { "status": "pass|fail|partial", "passed": 10, "failed": 0, "skipped": 2 }
  },
  "healthTrend": "improving|stable|degrading",
  "regressions": [],
  "alerts": []
}
```

## Behavior Rules

1. Run silently in background - no chat output
2. Only surface issues via structured alerts
3. Track trends across multiple check cycles
4. Never modify files - read and report only
5. Exit gracefully when signaled by orchestrator

## Integration with Gardening

When issue detected:
- Build failure → trigger `AMPLIFY` to all agents
- Type error in file X → trigger `REDIRECT` to agent working on X
- Regression → trigger `AMPLIFY` with specific test info

## Tools Available

You may use:
- `Bash` for running build/test commands
- `Read` for checking files
- `Grep` for finding patterns
- `mcp__plugin_oh-my-black_t__lsp_diagnostics` for type checking

You may NOT use:
- `Write` or `Edit` (you don't modify)
- `Task` (you don't spawn agents)
```

---

### Task: GA-2 - Implement AMPLIFY Action

**File:** `src/orchestrator/actions/amplify.ts`

**Description:** Implement the AMPLIFY gardening action that broadcasts discoveries to all agents.

**Acceptance Criteria:**
- [ ] Function signature matches spec
- [ ] Broadcasts to all active agents
- [ ] Supports urgency levels
- [ ] Logs event to gardening log
- [ ] Unit tests pass

**Code Skeleton:**
```typescript
import { GardeningEvent } from '../gardening';
import { getActiveAgents } from '../agent-registry';  // GA-0: New registry module
import { logGardeningEvent } from '../gardening-log';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// State directory for broadcasts (codebase convention: .omc/state/)
const BROADCASTS_DIR = '.omc/state/broadcasts';
const DEFAULT_TTL_MS = 300000; // 5 minutes

interface AmplifyOptions {
  urgency: 'low' | 'medium' | 'high';
  context?: Record<string, unknown>;
  excludeAgents?: string[];
  ttlMs?: number;
}

/**
 * AMPLIFY - Broadcast valuable artifact/discovery to all agents
 *
 * Use when one agent discovers something useful that others should know:
 * - Build configuration insight
 * - API discovery
 * - Error pattern and solution
 * - Scope clarification from user
 *
 * Communication: File-based via .omc/state/broadcasts/
 * Agents poll this directory at start of each action cycle
 */
export async function amplify(
  discovery: string,
  options: AmplifyOptions = { urgency: 'medium' }
): Promise<GardeningEvent> {
  const activeAgents = await getActiveAgents();  // Reads from .omc/state/active-agents.json
  const targets = options.excludeAgents
    ? activeAgents.filter(a => !options.excludeAgents?.includes(a))
    : activeAgents;

  const event: GardeningEvent = {
    action: 'AMPLIFY',
    timestamp: new Date().toISOString(),
    target: targets.length === activeAgents.length ? 'all' : targets,
    payload: {
      message: discovery,
      context: options.context,
      urgency: options.urgency,
    },
  };

  // Write broadcast to state directory (file-based inter-agent communication)
  await writeBroadcast(event, options.ttlMs ?? DEFAULT_TTL_MS);

  // Log for audit trail
  await logGardeningEvent(event);

  return event;
}

/**
 * Write broadcast to .omc/state/broadcasts/{timestamp}-amplify.json
 * Agents poll this directory; cleanup daemon removes expired broadcasts
 */
async function writeBroadcast(event: GardeningEvent, ttlMs: number): Promise<void> {
  if (!existsSync(BROADCASTS_DIR)) {
    mkdirSync(BROADCASTS_DIR, { recursive: true });
  }

  const filename = `${Date.now()}-amplify.json`;
  const filepath = join(BROADCASTS_DIR, filename);

  const broadcast = {
    ...event,
    ttl: ttlMs,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };

  writeFileSync(filepath, JSON.stringify(broadcast, null, 2));
}
```

---

### Task: CV-1 - Create ContinuousValidator Class

**File:** `src/skeptic/continuous-validator.ts`

**Description:** Core class that manages scheduled validation checks.

**Acceptance Criteria:**
- [ ] Configurable intervals for each check type
- [ ] Start/stop methods
- [ ] Health trend calculation
- [ ] Failure callbacks
- [ ] Graceful shutdown
- [ ] Unit tests pass

**Code Skeleton:**
```typescript
import { HealthSnapshot, ValidationFailure, ValidationConfig } from './types';
import { amplify, redirect } from '../orchestrator/actions';

const DEFAULT_CONFIG: ValidationConfig = {
  buildInterval: 120000,      // 2 minutes
  typeCheckInterval: 120000,  // 2 minutes
  lintInterval: 300000,       // 5 minutes
  fastTestInterval: 300000,   // 5 minutes
  enabled: true,
};

export class ContinuousValidator {
  private config: ValidationConfig;
  private healthHistory: HealthSnapshot[] = [];
  private timers: NodeJS.Timer[] = [];
  private failureCallbacks: ((failure: ValidationFailure) => void)[] = [];
  private running = false;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Schedule build checks
    this.timers.push(setInterval(
      () => this.runBuildCheck(),
      this.config.buildInterval
    ));

    // Schedule type checks
    this.timers.push(setInterval(
      () => this.runTypeCheck(),
      this.config.typeCheckInterval
    ));

    // Schedule lint checks
    this.timers.push(setInterval(
      () => this.runLintCheck(),
      this.config.lintInterval
    ));

    // Schedule fast test checks
    this.timers.push(setInterval(
      () => this.runFastTestCheck(),
      this.config.fastTestInterval
    ));

    // Run initial checks
    this.runAllChecks();
  }

  stop(): void {
    this.running = false;
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];
  }

  getHealthTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.healthHistory.length < 3) return 'stable';

    const recent = this.healthHistory.slice(-5);
    const scores = recent.map(h => this.calculateHealthScore(h));

    const trend = scores[scores.length - 1] - scores[0];
    if (trend > 0.1) return 'improving';
    if (trend < -0.1) return 'degrading';
    return 'stable';
  }

  getLastSnapshot(): HealthSnapshot | null {
    return this.healthHistory[this.healthHistory.length - 1] || null;
  }

  onFailure(callback: (failure: ValidationFailure) => void): void {
    this.failureCallbacks.push(callback);
  }

  private async runBuildCheck(): Promise<void> {
    // Implementation: Run build command, parse output, handle failure
  }

  private async runTypeCheck(): Promise<void> {
    // Implementation: Run tsc --noEmit or LSP diagnostics
  }

  private async runLintCheck(): Promise<void> {
    // Implementation: Run linter
  }

  private async runFastTestCheck(): Promise<void> {
    // Implementation: Run fast test suite
  }

  private async runAllChecks(): Promise<void> {
    await Promise.all([
      this.runBuildCheck(),
      this.runTypeCheck(),
      this.runLintCheck(),
      this.runFastTestCheck(),
    ]);
  }

  private calculateHealthScore(snapshot: HealthSnapshot): number {
    // Weighted average of check statuses
    const weights = { build: 0.4, types: 0.3, lint: 0.1, tests: 0.2 };
    // Implementation
    return 0;
  }

  private notifyFailure(failure: ValidationFailure): void {
    this.failureCallbacks.forEach(cb => cb(failure));
  }
}
```

---

## Part 5: Risk Assessment

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Quality scores are subjective | Medium | High | Define clear rubrics, use multiple evaluators |
| Continuous validation overhead | Medium | Medium | Make configurable, allow disable |
| Contract negotiation complexity | High | Medium | Start simple, iterate |
| Vector embedding cost | Low | High | Cache embeddings, batch updates |
| Worktree merge conflicts | Medium | Medium | Require clean merges, fallback to sequential |

### Compatibility Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaks existing workflows | High | Feature flags for all new features |
| Increases token usage | Medium | Skeptic uses haiku, monitor costs |
| Slows execution | Medium | Async/background operations |

### Mitigation Strategy

1. **Feature Flags**: All new features behind flags, default OFF
2. **Gradual Rollout**: Enable one feature at a time
3. **Monitoring**: Track performance metrics before/after
4. **Rollback Plan**: Each feature independently disableable

---

## Part 6: Success Metrics

### Quantitative Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Iteration cycles per task | ~3.5 | ~2.0 | Count B-V cycles |
| Time to detect build break | End of task | <2 min | Skeptic latency |
| Scope creep incidents | Unknown | -50% | Strategist interventions |
| Agent selection accuracy | Unknown | 85%+ | Q-learning success rate |

### Qualitative Metrics

| Metric | Measurement |
|--------|-------------|
| Developer satisfaction | Survey after 2 weeks |
| Code quality perception | Review sample outputs |
| Debugging ease | Time to diagnose issues |

### Tracking Dashboard

Create `.omb/metrics/` directory with:
- `performance.json` - Task completion stats
- `quality.json` - Readiness score distributions
- `skeptic.json` - Validation check history
- `routing.json` - Agent selection outcomes

---

## Part 7: Commit Strategy

### Commit Sequence

1. **Foundation types** (QG-1, types only)
2. **Agent definitions** (TP-1, TP-2, markdown only)
3. **Core implementation** (QG-2 through QG-4)
4. **Skeptic implementation** (CV-1 through CV-4)
5. **Gardening actions** (GA-1 through GA-6)
6. **Integration** (CV-5, CV-6, GA-7, GA-8)
7. **Tests and documentation**

### Commit Message Format

```
feat(quality): add readiness score types and interfaces

- Define ReadinessScore with 6 dimensions
- Add ReadinessLevel type with 5 thresholds
- Create ReadinessHistory for temporal tracking
- Full JSDoc documentation

Part of: Archon-inspired improvements
Task: QG-1
```

---

## Part 8: File Structure

### New Files

```
src/
  quality/
    readiness.ts               # QG-1: Types
    calculator.ts              # QG-2: Score calculation
  features/
    state-manager/
      readiness-state.ts       # QG-4: Reads/writes .omc/state/readiness/*.json
  skeptic/
    continuous-validator.ts    # CV-1: Main class
    health-snapshot.ts         # CV-2: Snapshot type
    trend-analysis.ts          # CV-3: Trend detection
    alert-handler.ts           # CV-4: Gardening integration
  orchestrator/
    agent-registry.ts          # GA-0: Active agents in .omc/state/active-agents.json
    gardening.ts               # GA-1: Types
    gardening-log.ts           # GA-8: Appends to .omc/state/gardening-log.jsonl
    broadcast-cleanup.ts       # GA-9: TTL-based cleanup daemon
    actions/
      amplify.ts               # GA-2: Writes to .omc/state/broadcasts/
      redirect.ts              # GA-3: Writes to .omc/state/redirects/{agentId}.json
      mediate.ts               # GA-4: Creates .omc/state/mediations/
      inject.ts                # GA-5: Creates tasks via TaskCreate
      prune.ts                 # GA-6: Marks tasks deleted via TaskUpdate
  contracts/
    contract.ts                # CN-1: Types
    store.ts                   # CN-2: Storage
    proposal.ts                # CN-3: Proposal handling
    negotiation.ts             # CN-4: Negotiation logic
  routing/
    performance-tracker.ts     # QL-1
    q-learning-router.ts       # QL-2
    weights-store.ts           # QL-3
  memory/
    embeddings.ts              # VM-1: transformers.js (Xenova/all-MiniLM-L6-v2)
    vector-store.ts            # VM-2: Cosine similarity, persists to .omc/state/
    types.ts                   # VM-3
  isolation/
    worktree-manager.ts        # WT-1
    merge-handler.ts           # WT-4
  verification/
    phased-verifier.ts         # PV-1
    phase-graph.ts             # PV-3
  hud/
    elements/
      readiness.ts             # QG-6: Follows existing HUD element patterns
      skeptic-status.ts        # CV-7
      contract-view.ts         # CN-7
      performance-view.ts      # QL-5
      memory-search.ts         # VM-6
      worktree-status.ts       # WT-5
      verification-phases.ts   # PV-4
  __tests__/
    persona-tests.ts           # PM-5: Regex-based persona verification

agents/
  strategist.md                # TP-1
  skeptic.md                   # TP-2
  readiness-evaluator.md       # QG-3
  templates/
    contract-aware.md          # CN-5
    context-aware.md           # VM-5

docs/
  persona-spec.md              # PM-2

.omb/
  audits/
    persona-audit.md           # PM-1: Persona inventory and gap analysis
```

### New State Directories (Runtime)

```
.omc/state/
  readiness/                   # QG-4: Per-task readiness scores
    {taskId}.json
  broadcasts/                  # GA-2: AMPLIFY messages (TTL-based)
    {timestamp}-amplify.json
  redirects/                   # GA-3: Per-agent redirect messages
    {agentId}-redirect.json
  mediations/                  # GA-4: Mediation requests
    {conflictId}.json
  skeptic/                     # CV-*: Health snapshots
    health-{timestamp}.json
  active-agents.json           # GA-0: Registry of active agent IDs
  gardening-log.jsonl          # GA-8: Append-only event log
  vector-store.json            # VM-2: Persisted embeddings
```

### Modified Files

```
agents/coordinator.md          # QG-5: Use readiness in decisions
skills/autopilot/SKILL.md      # TP-5, CV-6, PV-2: Add strategist, skeptic, deep-verify
skills/ralph/SKILL.md          # TP-6, CV-5: Add skeptic
skills/orchestrate/SKILL.md    # GA-7, CN-6, QL-4: Gardening, contracts, routing
skills/swarm/SKILL.md          # WT-2: Add worktree option
skills/ultrawork/SKILL.md      # WT-3: Add worktree option
skills/note/SKILL.md           # VM-4: Vectorize notes
agents/architect*.md           # PM-3: Enhance personas
agents/executor*.md            # PM-4: Enhance personas
```

---

## Definition of Done

This plan is complete when:

- [ ] All P0 tasks implemented and tested
- [ ] All P1 tasks implemented and tested
- [ ] Documentation updated in CLAUDE.md
- [ ] Feature flags added for all new features
- [ ] Performance metrics baseline established
- [ ] At least 2 autopilot runs with new features
- [ ] No regressions in existing functionality

---

## Appendix: Research References

### Archon
- Repository: https://github.com/martino-vigiani/Archon
- Key innovation: Organic orchestration, quality gradients, terminal personas

### Claude-Flow
- Key innovation: Q-Learning router, ReasoningBank
- SWE-Bench: 84.8% (highest known)

### Claude Swarm
- Key innovation: SwarmMemory with FAISS vector search

### Claude Squad
- Stars: 5.9k
- Key innovation: tmux + git worktree isolation

### SuperClaude
- Key innovation: 30 commands, 16 personas, 8 MCPs

### plugins-plus-skills
- Key innovation: 270 plugins, 1537 skills, 5-phase verification

---

**Plan Author:** Prometheus (Planner Agent)
**Plan Version:** 2.0 (Critic fixes applied)
**Changes in v2.0:**
- Added "Integration with Existing Systems" section explaining Skeptic/tiered verification relationship
- Fixed QG-4: Changed from non-existent `src/lib/task-state.ts` to `src/features/state-manager/readiness-state.ts`
- Fixed GA-2-6: Defined inter-agent communication protocol (file-based via `.omc/state/`)
- Fixed CV-1: Corrected import path from non-existent swarm module to new `agent-registry.ts`
- Added GA-0 (agent registry) and GA-9 (broadcast cleanup) tasks
- Fixed PM-1: Made acceptance criteria specific (inventory with scores, gaps, overlap analysis)
- Fixed VM-1: Specified embedding provider (transformers.js with OpenAI fallback)
- Fixed HUD paths to use existing `src/hud/elements/` pattern
- Added "New State Directories" section documenting runtime state structure

**Next Step:** Submit to Critic for re-review

PLAN_READY: /Users/kimtaeyoun/Personal/Dev/oh-my-black/.omb/plans/archon-inspired-improvements.md
