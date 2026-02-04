/**
 * Unit tests for retry-logic.ts
 * Testing retry state management, retry decisions, and escalation logic
 */

import { describe, it, expect } from 'vitest';
import {
  createRetryState,
  recordAttempt,
  shouldRetry,
  isRetryableIssue,
  determineEscalation,
  generateFailureReport,
  createRetryPrompt,
  type RetryState
} from '../../../src/features/verification/retry-logic.js';
import type { AgentOutput } from '../../../src/features/agent-output/schema.js';
import type { ValidatorOutput } from '../../../src/features/verification/builder-validator.js';

describe('createRetryState', () => {
  it('should create initial retry state', () => {
    const state = createRetryState(3);

    expect(state.currentAttempt).toBe(0);
    expect(state.maxAttempts).toBe(3);
    expect(state.history).toEqual([]);
    expect(state.status).toBe('in_progress');
  });

  it('should handle zero max attempts', () => {
    const state = createRetryState(0);

    expect(state.maxAttempts).toBe(0);
  });

  it('should handle large max attempts', () => {
    const state = createRetryState(100);

    expect(state.maxAttempts).toBe(100);
  });
});

describe('recordAttempt', () => {
  it('should record retry attempt', () => {
    const initialState = createRetryState(3);
    const mockValidator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Error 1'],
      recommendations: []
    };

    const updated = recordAttempt(initialState, undefined, mockValidator, 'retry');

    expect(updated.currentAttempt).toBe(1);
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].action).toBe('retry');
    expect(updated.status).toBe('in_progress');
  });

  it('should mark status as success on success action', () => {
    const state = createRetryState(3);
    const updated = recordAttempt(state, undefined, undefined, 'success');

    expect(updated.status).toBe('success');
  });

  it('should mark status as escalated on escalate action', () => {
    const state = createRetryState(3);
    const updated = recordAttempt(state, undefined, undefined, 'escalate');

    expect(updated.status).toBe('escalated');
  });

  it('should mark status as failed on fail action', () => {
    const state = createRetryState(3);
    const updated = recordAttempt(state, undefined, undefined, 'fail');

    expect(updated.status).toBe('failed');
  });

  it('should preserve existing history', () => {
    let state = createRetryState(3);
    state = recordAttempt(state, undefined, undefined, 'retry');
    state = recordAttempt(state, undefined, undefined, 'retry');

    expect(state.history).toHaveLength(2);
    expect(state.currentAttempt).toBe(2);
  });

  it('should record timestamp', () => {
    const state = createRetryState(3);
    const before = Date.now();
    const updated = recordAttempt(state, undefined, undefined, 'retry');
    const after = Date.now();

    expect(updated.history[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(updated.history[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('should collect issues from validator', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Issue 1', 'Issue 2'],
      recommendations: []
    };

    const updated = recordAttempt(state, undefined, validator, 'retry');

    expect(updated.history[0].issues).toEqual(['Issue 1', 'Issue 2']);
  });
});

describe('shouldRetry', () => {
  it('should not retry when max attempts reached', () => {
    const state: RetryState = {
      currentAttempt: 3,
      maxAttempts: 3,
      history: [],
      status: 'in_progress'
    };

    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Error'],
      recommendations: []
    };

    const decision = shouldRetry(state, validator);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.action).toBe('fail');
    expect(decision.reason).toContain('Maximum retry attempts');
  });

  it('should not retry when status is APPROVED', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'APPROVED',
      checks: [],
      issues: [],
      recommendations: []
    };

    const decision = shouldRetry(state, validator);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.action).toBe('success');
  });

  it('should escalate when status is NEEDS_REVIEW', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'NEEDS_REVIEW',
      checks: [],
      issues: [],
      recommendations: []
    };

    const decision = shouldRetry(state, validator);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.action).toBe('escalate');
  });

  it('should escalate on non-retryable issues', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'security',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Security vulnerability detected'],
      recommendations: []
    };

    const decision = shouldRetry(state, validator);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.action).toBe('escalate');
  });

  it('should escalate on critical failures', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [
        {
          name: 'Critical check',
          passed: false,
          evidence: 'Failed',
          severity: 'critical'
        }
      ],
      issues: [],
      recommendations: []
    };

    const decision = shouldRetry(state, validator);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.action).toBe('escalate');
  });

  it('should retry on retryable issues', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Syntax error on line 10'],
      recommendations: []
    };

    const decision = shouldRetry(state, validator);

    expect(decision.shouldRetry).toBe(true);
    expect(decision.action).toBe('retry');
  });

  it('should escalate on persistent issues after multiple attempts', () => {
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Syntax error on line 42'],  // Retryable issue
      recommendations: []
    };

    let state = createRetryState(5);
    state = recordAttempt(state, undefined, validator, 'retry');
    state = recordAttempt(state, undefined, validator, 'retry');
    state = recordAttempt(state, undefined, validator, 'retry');

    const decision = shouldRetry(state, validator);

    expect(decision.shouldRetry).toBe(false);
    expect(decision.action).toBe('escalate');
    expect(decision.reason).toContain('Persistent issues');
  });
});

describe('isRetryableIssue', () => {
  it('should mark security issues as non-retryable', () => {
    expect(isRetryableIssue('Security vulnerability found')).toBe(false);
    expect(isRetryableIssue('SQL injection detected')).toBe(false);
    expect(isRetryableIssue('XSS vulnerability')).toBe(false);
  });

  it('should mark missing dependencies as non-retryable', () => {
    expect(isRetryableIssue('Missing dependency: express')).toBe(false);
    expect(isRetryableIssue('Module not found')).toBe(false);
    expect(isRetryableIssue('Package not installed')).toBe(false);
  });

  it('should mark architectural issues as non-retryable', () => {
    expect(isRetryableIssue('Architectural design flaw')).toBe(false);
    expect(isRetryableIssue('Fundamental issue with approach')).toBe(false);
  });

  it('should mark syntax errors as retryable', () => {
    expect(isRetryableIssue('Syntax error on line 10')).toBe(true);
    expect(isRetryableIssue('Parse error: unexpected token')).toBe(true);
    expect(isRetryableIssue('Missing semicolon')).toBe(true);
  });

  it('should mark type errors as retryable', () => {
    expect(isRetryableIssue('Type error: cannot assign string to number')).toBe(true);
    expect(isRetryableIssue('Type mismatch')).toBe(true);
  });

  it('should mark logic errors as retryable', () => {
    expect(isRetryableIssue('Logic error in implementation')).toBe(true);
    expect(isRetryableIssue('Incorrect edge case handling')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isRetryableIssue('SYNTAX ERROR')).toBe(true);
    expect(isRetryableIssue('security VULNERABILITY')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(isRetryableIssue('')).toBe(false);
  });
});

describe('determineEscalation', () => {
  it('should escalate to architect for security issues', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'security',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Security vulnerability detected'],
      recommendations: []
    };

    const escalation = determineEscalation(state, validator);

    expect(escalation.shouldEscalate).toBe(true);
    expect(escalation.escalationLevel).toBe('architect');
    expect(escalation.reason).toContain('security');
  });

  it('should escalate to human after 5+ attempts', () => {
    let state = createRetryState(10);
    for (let i = 0; i < 5; i++) {
      state = recordAttempt(state, undefined, undefined, 'retry');
    }

    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Error'],
      recommendations: []
    };

    const escalation = determineEscalation(state, validator);

    expect(escalation.shouldEscalate).toBe(true);
    expect(escalation.escalationLevel).toBe('human');
  });

  it('should escalate to human for missing dependencies', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Missing dependency: react'],
      recommendations: []
    };

    const escalation = determineEscalation(state, validator);

    expect(escalation.shouldEscalate).toBe(true);
    expect(escalation.escalationLevel).toBe('human');
  });

  it('should escalate to coordinator for persistent issues', () => {
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Same error'],
      recommendations: []
    };

    let state = createRetryState(5);
    state = recordAttempt(state, undefined, validator, 'retry');
    state = recordAttempt(state, undefined, validator, 'retry');
    state = recordAttempt(state, undefined, validator, 'retry');

    const escalation = determineEscalation(state, validator);

    expect(escalation.shouldEscalate).toBe(true);
    expect(escalation.escalationLevel).toBe('coordinator');
  });

  it('should escalate to architect for critical failures', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'logic',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [
        { name: 'Critical', passed: false, evidence: 'Failed', severity: 'critical' }
      ],
      issues: [],
      recommendations: []
    };

    const escalation = determineEscalation(state, validator);

    expect(escalation.shouldEscalate).toBe(true);
    expect(escalation.escalationLevel).toBe('architect');
  });

  it('should not escalate if no escalation conditions met', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Minor syntax error'],
      recommendations: []
    };

    const escalation = determineEscalation(state, validator);

    expect(escalation.shouldEscalate).toBe(false);
  });

  it('should include context in escalation', () => {
    const state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'security',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Security issue'],
      recommendations: []
    };

    const escalation = determineEscalation(state, validator);

    expect(escalation.context.attemptHistory).toBeDefined();
    expect(escalation.context.persistentIssues).toBeDefined();
    expect(escalation.context.suggestedAction).toBeDefined();
  });
});

describe('generateFailureReport', () => {
  it('should generate basic failure report', () => {
    const state = createRetryState(3);
    const report = generateFailureReport('task-1', state);

    expect(report.taskId).toBe('task-1');
    expect(report.totalAttempts).toBe(0);
    expect(report.finalStatus).toBe('failed');
    expect(report.persistentIssues).toEqual([]);
    expect(report.attemptSummary).toEqual([]);
  });

  it('should include attempt history', () => {
    let state = createRetryState(3);
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Error 1'],
      recommendations: []
    };

    state = recordAttempt(state, undefined, validator, 'retry');
    state = recordAttempt(state, undefined, validator, 'fail');

    const report = generateFailureReport('task-1', state, validator);

    expect(report.attemptSummary).toHaveLength(2);
    expect(report.attemptSummary[0].action).toBe('retry');
    expect(report.attemptSummary[1].action).toBe('fail');
  });

  it('should detect persistent issues', () => {
    const validator: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Same error'],
      recommendations: []
    };

    let state = createRetryState(3);
    state = recordAttempt(state, undefined, validator, 'retry');
    state = recordAttempt(state, undefined, validator, 'retry');

    const report = generateFailureReport('task-1', state, validator);

    expect(report.persistentIssues.length).toBeGreaterThan(0);
  });

  it('should include root cause analysis', () => {
    const state = createRetryState(3);
    const report = generateFailureReport('task-1', state);

    expect(report.rootCauseAnalysis).toBeDefined();
    expect(typeof report.rootCauseAnalysis).toBe('string');
  });

  it('should include recommended action', () => {
    const state = createRetryState(3);
    const report = generateFailureReport('task-1', state);

    expect(report.recommendedAction).toBeDefined();
    expect(typeof report.recommendedAction).toBe('string');
  });

  it('should mark as escalated when appropriate', () => {
    let state = createRetryState(3);
    state = recordAttempt(state, undefined, undefined, 'escalate');

    const report = generateFailureReport('task-1', state);

    expect(report.finalStatus).toBe('escalated');
  });

  it('should collect evidence from attempts', () => {
    const builderResult: AgentOutput = {
      agentId: 'builder-1',
      taskId: 'task-1',
      status: 'partial',
      summary: 'Attempted',
      evidence: [
        { type: 'command_output', content: 'Output', passed: false }
      ],
      timestamp: Date.now()
    };

    let state = createRetryState(3);
    state = recordAttempt(state, builderResult, undefined, 'retry');

    const report = generateFailureReport('task-1', state);

    expect(report.evidence.length).toBeGreaterThan(0);
  });
});

describe('createRetryPrompt', () => {
  const mockPreviousResult: AgentOutput = {
    agentId: 'builder-1',
    taskId: 'task-1',
    status: 'partial',
    summary: 'Previous attempt',
    evidence: [],
    timestamp: Date.now()
  };

  const mockFeedback: ValidatorOutput = {
    validatorType: 'syntax',
    taskId: 'task-1',
    status: 'REJECTED',
    checks: [
      { name: 'Syntax', passed: false, evidence: 'Error on line 10', severity: 'major' }
    ],
    issues: ['Syntax error', 'Missing import'],
    recommendations: ['Fix syntax', 'Add import']
  };

  it('should include retry header', () => {
    const prompt = createRetryPrompt('Original task', mockPreviousResult, mockFeedback, 2);

    expect(prompt).toContain('RETRY REQUEST');
    expect(prompt).toContain('Attempt 2');
  });

  it('should include original task', () => {
    const prompt = createRetryPrompt('Build feature X', mockPreviousResult, mockFeedback, 2);

    expect(prompt).toContain('Original Task');
    expect(prompt).toContain('Build feature X');
  });

  it('should include previous attempt summary', () => {
    const prompt = createRetryPrompt('Task', mockPreviousResult, mockFeedback, 2);

    expect(prompt).toContain('Previous Attempt Summary');
    expect(prompt).toContain('partial');
  });

  it('should include validation feedback', () => {
    const prompt = createRetryPrompt('Task', mockPreviousResult, mockFeedback, 2);

    expect(prompt).toContain('Validation Feedback');
    expect(prompt).toContain('REJECTED');
  });

  it('should list failed checks', () => {
    const prompt = createRetryPrompt('Task', mockPreviousResult, mockFeedback, 2);

    expect(prompt).toContain('Failed Checks');
    expect(prompt).toContain('Syntax');
    expect(prompt).toContain('Error on line 10');
  });

  it('should list issues to fix', () => {
    const prompt = createRetryPrompt('Task', mockPreviousResult, mockFeedback, 2);

    expect(prompt).toContain('Issues to Fix');
    expect(prompt).toContain('Syntax error');
    expect(prompt).toContain('Missing import');
  });

  it('should list recommendations', () => {
    const prompt = createRetryPrompt('Task', mockPreviousResult, mockFeedback, 2);

    expect(prompt).toContain('Recommendations');
    expect(prompt).toContain('Fix syntax');
    expect(prompt).toContain('Add import');
  });

  it('should include instructions', () => {
    const prompt = createRetryPrompt('Task', mockPreviousResult, mockFeedback, 2);

    expect(prompt).toContain('Instructions');
    expect(prompt).toContain('Priority Actions');
  });

  it('should handle feedback with no failed checks', () => {
    const feedbackNoChecks: ValidatorOutput = {
      ...mockFeedback,
      checks: []
    };

    const prompt = createRetryPrompt('Task', mockPreviousResult, feedbackNoChecks, 1);

    expect(prompt).toBeDefined();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should handle feedback with no recommendations', () => {
    const feedbackNoRecs: ValidatorOutput = {
      ...mockFeedback,
      recommendations: []
    };

    const prompt = createRetryPrompt('Task', mockPreviousResult, feedbackNoRecs, 1);

    expect(prompt).toBeDefined();
  });
});
