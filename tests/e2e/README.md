# E2E Tests for Ohmyblack Autopilot

This directory contains end-to-end (E2E) tests for the ohmyblack autopilot system, specifically testing the complete workflow with Builder-Validator (B-V) cycles.

## Test Structure

```
tests/e2e/
├── autopilot-ohmyblack.test.ts    # Autopilot with ohmyblack B-V integration
├── ralph-bv.test.ts               # Sequential execution with B-V cycles
├── ultrawork-bv.test.ts           # Parallel execution with B-V cycles
├── full-workflow.test.ts          # Complete end-to-end scenarios
└── fixtures/                      # Test data fixtures
    ├── sample-task.json           # Example task definition
    ├── sample-decomposition.json  # Example decomposed task
    └── sample-team.json           # Example team configuration
```

## Test Coverage

### 1. Autopilot Ohmyblack E2E (`autopilot-ohmyblack.test.ts`)

Tests the complete autopilot flow with ohmyblack mode:

- **Full Flow Tests:**
  - Simple task with self-only validation
  - Complex task with validator validation
  - Validation failure and retry handling
  - Escalation after max retries

- **Team Composition Tests:**
  - Auto-selection of minimal team for simple tasks
  - Auto-selection of robust team for complex tasks
  - Team template override support

- **Progress Tracking Tests:**
  - Progress event emission during execution
  - B-V cycle progress tracking

- **State Persistence Tests:**
  - State serialization and restoration
  - Workflow resume after interruption

### 2. Ralph B-V E2E (`ralph-bv.test.ts`)

Tests Ralph's sequential execution mode with B-V validation:

- Sequential task execution with dependency chains
- Escalation handling with continuation
- Comprehensive report generation
- Persistence through multiple failures and retries

**Key Characteristics:**
- Sequential execution (tasks run one at a time)
- Strong persistence (doesn't give up easily)
- Escalation without workflow failure
- Detailed retry tracking

### 3. Ultrawork B-V E2E (`ultrawork-bv.test.ts`)

Tests Ultrawork's parallel execution mode with B-V validation:

- Parallel task execution with B-V cycles
- Max parallel B-V cycle limit enforcement
- Fail-fast mode behavior
- Continue-on-failure mode behavior
- Mixed parallel and sequential dependencies

**Key Characteristics:**
- Parallel execution (multiple tasks simultaneously)
- Respects `maxParallelBV` configuration
- Two failure modes: fail-fast vs continue-on-failure
- Dynamic dependency resolution

### 4. Full Workflow E2E (`full-workflow.test.ts`)

Complete real-world scenarios from start to finish:

#### Scenario 1: Feature Implementation
- Full-stack feature with multiple components
- Complex workflow: 6 tasks with dependencies
- Parallel and sequential execution phases
- Multiple validation levels (validator + architect)
- Integration testing phase

#### Scenario 2: Bug Fix
- Simple, focused fix
- Minimal team (single builder)
- Self-only validation
- Fast execution path

#### Scenario 3: Refactoring
- Sequential refactoring workflow
- Security-critical changes
- Architect-level validation
- Escalation policy enforcement

## Test Strategy

### Simulation Mode

All E2E tests use **simulation mode** to avoid spawning actual agents:

- Mock agent responses for predictable behavior
- Controlled timing for deterministic tests
- State verification at each phase
- Event emission tracking

### Test Phases

Each E2E test follows these phases:

1. **Analysis** - Task understanding and classification
2. **Decomposition** - Breaking down into subtasks
3. **Team Composition** - Selecting appropriate agents
4. **Workflow Creation** - Building execution plan
5. **Execution** - Running tasks with B-V cycles
6. **Validation** - Final quality checks
7. **Reporting** - Generating completion report

### Verification Points

Tests verify at each critical point:

- ✅ State consistency
- ✅ Event emission
- ✅ Evidence collection
- ✅ Retry tracking
- ✅ Escalation handling
- ✅ Report accuracy

## Running the Tests

### Run all E2E tests:
```bash
npm run test -- tests/e2e
```

### Run specific test file:
```bash
npm run test -- tests/e2e/autopilot-ohmyblack.test.ts
```

### Run with verbose output:
```bash
npx vitest run tests/e2e --reporter=verbose
```

### Run with coverage:
```bash
npm run test:coverage -- tests/e2e
```

### Run in watch mode (for development):
```bash
npx vitest tests/e2e
```

## Test Fixtures

### `sample-task.json`
Example task definition with:
- Task description
- Complexity rating
- Requirements list
- Technology stack
- Estimated duration

### `sample-decomposition.json`
Example decomposed task with:
- Task analysis
- Component breakdown
- Subtasks with dependencies
- Validation requirements
- Ownership patterns

### `sample-team.json`
Example team configuration with:
- Team members (builders, validators, specialists)
- Role assignments
- Capability matrix
- Escalation policy
- Parallel execution limits

## Key Test Patterns

### 1. Simulation Helpers

```typescript
async function simulateBVCycle(
  context: Context,
  task: WorkflowTask,
  options?: {
    shouldFailValidation?: boolean;
    validationIssues?: string[];
    retryAttempt?: number;
  }
): Promise<BVOrchestrationResult>
```

Simulates a complete B-V cycle with configurable outcomes.

### 2. State Verification

```typescript
expectValidWorkflowState(workflow);
expectValidSubtasks(decomposition.subtasks);
expectValidEvidence(result.evidence);
```

Validates state structure and consistency.

### 3. Async Coordination

```typescript
// Parallel execution
await Promise.all(tasks.map(task => executeBVCycle(task)));

// Sequential execution
for (const task of tasks) {
  await executeBVCycle(task);
}
```

Tests handle both parallel and sequential execution patterns.

## Test Timeouts

E2E tests have extended timeouts due to simulation delays:

- Simple tests: 30 seconds
- Complex tests: 60 seconds
- Full scenarios: 90 seconds

## Expected Failures (TDD)

These tests are written **BEFORE** implementation (Test-Driven Development).

**Currently failing tests are EXPECTED** - they define the specification that the implementation must meet.

As implementation progresses, tests should gradually turn green.

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Run E2E Tests
  run: npm run test -- tests/e2e --reporter=verbose
  timeout-minutes: 10
```

### Pre-commit Hook

```bash
#!/bin/sh
npm run test -- tests/e2e --run
```

## Debugging Tests

### Enable verbose logging:
```typescript
// In test file
import { vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
```

### Check state at failure point:
```typescript
console.log(JSON.stringify(context, null, 2));
```

### Use test.only for focused debugging:
```typescript
it.only('should handle specific case', async () => {
  // ...
});
```

## Performance Benchmarks

Expected performance characteristics (simulation mode):

| Test Suite | Tests | Duration |
|------------|-------|----------|
| autopilot-ohmyblack | 11 | ~5s |
| ralph-bv | 4 | ~2s |
| ultrawork-bv | 5 | ~3s |
| full-workflow | 3 | ~8s |
| **Total** | **23** | **~18s** |

## Contributing

When adding new E2E tests:

1. Follow the existing test structure
2. Use simulation helpers for consistency
3. Verify state at each critical phase
4. Add appropriate timeout for test complexity
5. Update this README with new test coverage

## Related Documentation

- [Integration Tests](../integration/README.md)
- [Unit Tests](../unit/README.md)
- [B-V Cycle Documentation](../../src/features/verification/README.md)
- [Team Workflow Documentation](../../src/features/team/README.md)

## Troubleshooting

### Test hangs indefinitely
- Check for missing `await` on promises
- Verify timeout is set appropriately
- Check for infinite loops in dependency resolution

### State inconsistency errors
- Verify state is properly initialized in `beforeEach`
- Check for mutations between tests
- Ensure cleanup in `afterEach`

### Flaky tests
- Use deterministic mocks (no random values)
- Control timing with explicit delays
- Avoid relying on system time

## License

MIT - Same as parent project
