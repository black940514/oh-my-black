# Integration Tests for Ohmyblack System

This directory contains comprehensive integration tests for the **ohmyblack** Builder-Validator system.

## Test Structure

```
tests/integration/
├── README.md                  # This file
├── helpers.ts                 # Test utilities and mock data generators
├── bv-cycle.test.ts          # Builder-Validator cycle tests
├── team-workflow.test.ts     # Team workflow execution tests
├── meta-prompt.test.ts       # Meta-prompt generation tests
├── auto-composer.test.ts     # Team auto-composition tests
└── skill-integration.test.ts # Skill integration tests
```

## Running Tests

### Run all integration tests
```bash
npm test tests/integration
```

### Run specific test file
```bash
npm test tests/integration/bv-cycle.test.ts
npm test tests/integration/team-workflow.test.ts
npm test tests/integration/meta-prompt.test.ts
npm test tests/integration/auto-composer.test.ts
npm test tests/integration/skill-integration.test.ts
```

### Run with coverage
```bash
npm run test:coverage
```

### Run in watch mode
```bash
npm test -- --watch tests/integration
```

## Test Coverage

### bv-cycle.test.ts
Tests the complete Builder-Validator cycle including:
- ✅ Self-only, validator, and architect validation modes
- ✅ Retry logic and state management
- ✅ Escalation decisions (coordinator, architect, human)
- ✅ Evidence collection from builder and validators
- ✅ Validator prompt generation and output parsing
- ✅ Aggregation of multiple validator results
- ✅ Failure report generation

**Key Functions Tested:**
- `runBuilderValidatorCycleWithAgentOutput()`
- `createRetryState()`, `recordAttempt()`, `shouldRetry()`
- `determineEscalation()`, `generateFailureReport()`
- `createValidatorPrompt()`, `parseValidatorOutput()`
- `aggregateValidatorResults()`, `selectValidator()`

### team-workflow.test.ts
Tests team-based workflow execution including:
- ✅ Workflow creation from decomposition results
- ✅ Task dependency tracking (blockedBy/blocks)
- ✅ Task assignment (manual and automatic)
- ✅ Task state transitions (pending → assigned → running → completed/failed)
- ✅ Dependency resolution when tasks complete
- ✅ Progress tracking and metrics calculation
- ✅ Workflow serialization and parsing

**Key Functions Tested:**
- `createWorkflow()`, `getAvailableTasks()`
- `assignTask()`, `autoAssignTasks()`
- `startTask()`, `completeTask()`, `failTask()`
- `updateDependencies()`, `isWorkflowComplete()`
- `getWorkflowProgress()`, `generateExecutionPlan()`

### meta-prompt.test.ts
Tests template-based prompt generation including:
- ✅ Template compilation and rendering
- ✅ Variable substitution (`{{variable}}`)
- ✅ Nested property access (`{{obj.prop}}`)
- ✅ Conditionals (`{{#if}}...{{else}}...{{/if}}`)
- ✅ Loops (`{{#each}}...{{/each}}`)
- ✅ Helper functions (`| upper`, `| lower`, `| join`)
- ✅ Team/plan/task/agent context conversion
- ✅ Prompt generation with different detail levels

**Key Functions Tested:**
- `TemplateEngine.compile()`, `TemplateEngine.render()`
- `teamToContext()`, `decompositionToPlanContext()`

### auto-composer.test.ts
Tests automatic team composition including:
- ✅ Template selection by complexity (minimal → standard → robust → secure → fullstack)
- ✅ Template selection by task type and capabilities
- ✅ Requirements analysis (designer, security, architect, docs needs)
- ✅ Capability extraction from task analysis
- ✅ Builder and validator determination
- ✅ Specialist addition (designer, security-reviewer, writer)
- ✅ Fitness score calculation
- ✅ Constraint validation and team balancing

**Key Functions Tested:**
- `TeamAutoComposer.composeTeam()`, `TeamAutoComposer.recommendTemplate()`
- `selectTemplateByComplexity()`, `selectTemplateByTaskType()`
- `analyzeRequirements()`, `extractRequiredCapabilities()`
- `determineBuilders()`, `determineValidators()`, `addSpecialists()`
- `balanceTeam()`

### skill-integration.test.ts
Tests integration points between ohmyblack and OMB skills:
- ✅ Autopilot ohmyblack state initialization
- ✅ Task analysis → auto-composition → workflow creation pipeline
- ✅ Autopilot progress tracking through phases
- ✅ Ralph B-V retry state management
- ✅ Ralph continuation decisions after failures
- ✅ Ultrawork parallel batch scheduling
- ✅ Ultrawork metrics aggregation
- ✅ Cross-skill verification protocol consistency

**Integration Points Tested:**
- Autopilot: planning → team-composition → workflow-creation → execution
- Ralph: persistent retry state per task, escalation handling
- Ultrawork: parallel batch execution, team capacity respect

## Test Helpers

The `helpers.ts` file provides:

### Mock Data Generators
- `createMockTaskAnalysis()` - Generate task analysis objects
- `createMockDecomposition()` - Generate decomposition results
- `createMockAgentOutput()` - Generate builder/agent outputs
- `createMockValidatorOutput()` - Generate validator outputs
- `createMockTeam()` - Generate team definitions
- `createMockEvidence()` - Generate verification evidence

### Assertion Helpers
- `expectValidEvidence()` - Validate evidence structure
- `expectValidWorkflowState()` - Validate workflow state
- `expectTeamHasRole()` - Assert team has required role
- `expectTeamHasCapability()` - Assert team has capability
- `expectValidSubtasks()` - Validate subtask structure
- `waitFor()` - Wait for async conditions

## Coverage Requirements

All tests must maintain minimum **80% coverage** for:
- Lines
- Functions
- Branches
- Statements

Run `npm run test:coverage` to generate detailed coverage reports.

## TDD Principles Followed

These tests were written following **Test-Driven Development** principles:

1. **Tests written BEFORE implementation** - Tests define expected behavior
2. **RED phase verified** - Tests fail initially when functionality missing
3. **GREEN phase verified** - Tests pass after implementation
4. **Refactoring safe** - Tests provide safety net for refactoring
5. **Edge cases covered** - Tests include null, empty, invalid inputs
6. **Real function calls** - Minimal mocking, tests use actual implementations

## Edge Cases Tested

- ✅ **Null/Undefined**: Missing properties, undefined variables
- ✅ **Empty Collections**: Empty arrays, empty objects
- ✅ **Invalid Types**: Wrong status values, invalid enum values
- ✅ **Boundaries**: Max retries, capacity limits, complexity thresholds
- ✅ **Errors**: Validation failures, escalation triggers
- ✅ **Race Conditions**: Parallel execution conflicts
- ✅ **Large Data**: Multiple tasks, complex workflows
- ✅ **Special Cases**: Self-validation, blocked tasks, failed dependencies

## Adding New Tests

When adding new integration tests:

1. Follow the existing structure in test files
2. Use helpers from `helpers.ts` for mock data
3. Test both happy path and error paths
4. Include edge cases
5. Verify with actual function calls (minimize mocks)
6. Update this README with new test coverage

## Continuous Integration

These tests run automatically on:
- Pre-commit hooks
- Pull request builds
- Main branch commits

Failing tests will block merges to ensure code quality.
