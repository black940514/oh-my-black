/**
 * Test Helpers and Fixtures for Integration Tests
 *
 * Provides mock data generators and assertion utilities for testing
 * the ohmyblack system.
 */

import type { TaskAnalysis, DecompositionResult, Subtask, Component } from '../../src/features/task-decomposer/types.js';
import type { AgentOutput, Evidence } from '../../src/features/agent-output/schema.js';
import type { ValidatorOutput } from '../../src/features/verification/builder-validator.js';
import type { TeamDefinition, TeamMember, TeamRole, AgentCapability } from '../../src/features/team/types.js';
import type { VerificationEvidence } from '../../src/features/verification/types.js';
import type { WorkflowState } from '../../src/features/team/workflow.js';

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Create mock task analysis
 */
export function createMockTaskAnalysis(overrides?: Partial<TaskAnalysis>): TaskAnalysis {
  return {
    task: 'Implement user authentication',
    type: 'feature',
    complexity: 0.6,
    areas: ['backend', 'security'],
    technologies: ['typescript', 'jwt'],
    estimatedComponents: 3,
    isParallelizable: true,
    ...overrides
  };
}

/**
 * Create mock decomposition result
 */
export function createMockDecomposition(taskCount: number = 3): DecompositionResult {
  const analysis = createMockTaskAnalysis();

  const components: Component[] = [];
  const subtasks: Subtask[] = [];

  for (let i = 0; i < taskCount; i++) {
    const componentId = `comp-${i + 1}`;
    const subtaskId = `task-${i + 1}`;

    components.push({
      id: componentId,
      name: `Component ${i + 1}`,
      role: i === 0 ? 'backend' : i === 1 ? 'frontend' : 'testing',
      description: `Component ${i + 1} description`,
      canParallelize: i > 0,
      dependencies: i > 0 ? [`comp-${i}`] : [],
      effort: 'medium'
    });

    subtasks.push({
      id: subtaskId,
      name: `Subtask ${i + 1}`,
      component: components[i],
      prompt: `Implement ${subtasks[i] || 'feature'}`,
      agentType: 'executor',
      modelTier: 'medium',
      acceptanceCriteria: [`Criterion ${i + 1}`],
      verification: `Verify task ${i + 1}`,
      blockedBy: i > 0 ? [`task-${i}`] : [],
      validation: {
        validationType: 'validator',
        validatorAgent: 'validator-logic',
        maxRetries: 3
      },
      ownership: {
        patterns: [`**/${componentId}/*`],
        files: []
      }
    });
  }

  // Build executionOrder based on actual subtask count
  const executionOrder = subtasks.map(s => [s.id]);

  return {
    analysis,
    components,
    subtasks,
    strategy: 'component-based',
    executionOrder,
    warnings: []
  };
}

/**
 * Create mock agent output
 */
export function createMockAgentOutput(
  status: 'success' | 'failed' | 'blocked' = 'success'
): AgentOutput {
  return {
    taskId: 'task-1',
    agentType: 'executor',
    status,
    summary: `Task ${status}`,
    filesModified: ['src/test.ts'],
    evidence: [
      {
        type: 'test_result',
        passed: status === 'success',
        content: 'Test output'
      }
    ],
    selfValidation: {
      passed: status === 'success',
      retryCount: 0
    },
    nextActions: []
  };
}

/**
 * Create mock validator output
 */
export function createMockValidatorOutput(
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW' = 'APPROVED'
): ValidatorOutput {
  return {
    validatorType: 'syntax',
    taskId: 'task-1',
    status,
    checks: [
      {
        name: 'Syntax check',
        passed: status === 'APPROVED',
        evidence: 'No syntax errors found',
        severity: 'critical'
      }
    ],
    issues: status === 'REJECTED' ? ['Syntax error on line 10'] : [],
    recommendations: status === 'REJECTED' ? ['Fix syntax error'] : []
  };
}

/**
 * Create mock team
 */
export function createMockTeam(template: 'minimal' | 'standard' | 'robust' = 'standard'): TeamDefinition {
  const members: TeamMember[] = [
    {
      id: 'builder-1',
      agentType: 'executor',
      role: 'builder',
      modelTier: 'medium',
      capabilities: ['code_modification'],
      maxConcurrentTasks: 2,
      status: 'idle',
      assignedTasks: []
    }
  ];

  // B-V cycle enabled by default: all templates include at least one validator
  members.push({
    id: 'validator-1',
    agentType: 'validator-syntax',
    role: 'validator',
    modelTier: 'medium',
    capabilities: ['code_review'],
    maxConcurrentTasks: 1,
    status: 'idle',
    assignedTasks: []
  });

  if (template === 'robust') {
    members.push({
      id: 'validator-2',
      agentType: 'validator-logic',
      role: 'validator',
      modelTier: 'medium',
      capabilities: ['code_review'],
      maxConcurrentTasks: 1,
      status: 'idle',
      assignedTasks: []
    });
  }

  return {
    id: 'team-test',
    name: 'Test Team',
    description: 'A test team',
    members,
    defaultValidationType: 'validator',  // B-V cycle enabled by default for all templates
    config: {
      maxRetries: 3,
      taskTimeout: 300000,
      parallelExecution: true,
      maxParallelTasks: 3,
      escalationPolicy: {
        coordinatorThreshold: 2,
        architectThreshold: 3,
        humanThreshold: 5,
        autoEscalateOnSecurity: true
      }
    }
  };
}

/**
 * Create mock verification evidence
 */
export function createMockEvidence(passed: boolean = true): VerificationEvidence {
  return {
    type: 'test_pass',
    passed,
    command: 'npm test',
    output: passed ? 'All tests passed' : 'Tests failed',
    timestamp: new Date(),
    metadata: {}
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that evidence is valid
 */
export function expectValidEvidence(evidence: VerificationEvidence[]): void {
  if (evidence.length === 0) {
    throw new Error('Evidence array is empty');
  }

  for (const ev of evidence) {
    if (!ev.type) {
      throw new Error('Evidence missing type');
    }
    if (ev.passed === undefined) {
      throw new Error('Evidence missing passed status');
    }
    if (!ev.timestamp) {
      throw new Error('Evidence missing timestamp');
    }
  }
}

/**
 * Assert that workflow state is valid
 */
export function expectValidWorkflowState(workflow: WorkflowState): void {
  if (!workflow.workflowId) {
    throw new Error('Workflow missing ID');
  }
  if (!workflow.team) {
    throw new Error('Workflow missing team');
  }
  if (!Array.isArray(workflow.tasks)) {
    throw new Error('Workflow tasks is not an array');
  }
  if (!workflow.status) {
    throw new Error('Workflow missing status');
  }
  if (!workflow.config) {
    throw new Error('Workflow missing config');
  }
  if (!workflow.metrics) {
    throw new Error('Workflow missing metrics');
  }
}

/**
 * Assert that team has required roles
 */
export function expectTeamHasRole(team: TeamDefinition, role: TeamRole): void {
  const hasRole = team.members.some(m => m.role === role);
  if (!hasRole) {
    throw new Error(`Team missing required role: ${role}`);
  }
}

/**
 * Assert that team has required capability
 */
export function expectTeamHasCapability(team: TeamDefinition, capability: AgentCapability): void {
  const hasCapability = team.members.some(m => m.capabilities.includes(capability));
  if (!hasCapability) {
    throw new Error(`Team missing required capability: ${capability}`);
  }
}

/**
 * Assert that all subtasks have valid structure
 */
export function expectValidSubtasks(subtasks: Subtask[]): void {
  if (subtasks.length === 0) {
    throw new Error('Subtasks array is empty');
  }

  for (const subtask of subtasks) {
    if (!subtask.id) {
      throw new Error('Subtask missing ID');
    }
    if (!subtask.name) {
      throw new Error('Subtask missing name');
    }
    if (!subtask.agentType) {
      throw new Error('Subtask missing agentType');
    }
    if (!subtask.modelTier) {
      throw new Error('Subtask missing modelTier');
    }
    if (!Array.isArray(subtask.acceptanceCriteria)) {
      throw new Error('Subtask acceptanceCriteria is not an array');
    }
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
