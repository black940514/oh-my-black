/**
 * Builder-Validator Cycle Integration Tests
 *
 * Tests the complete Builder-Validator cycle including:
 * - runBuilderValidatorCycle execution
 * - Retry logic and state management
 * - Escalation decisions
 * - Evidence collection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  runBuilderValidatorCycleWithAgentOutput,
  createValidatorPrompt,
  parseValidatorOutput,
  aggregateValidatorResults,
  selectValidator,
  checkBuilderSelfValidation,
  validatorOutputToEvidence,
  type ValidatorOutput,
  type BuilderSelfValidationCheck
} from '../../src/features/verification/builder-validator.js';
import {
  createRetryState,
  recordAttempt,
  shouldRetry,
  isRetryableIssue,
  determineEscalation,
  generateFailureReport,
  createRetryPrompt,
  type RetryState
} from '../../src/features/verification/retry-logic.js';
import type { ValidationCycleOptions } from '../../src/features/verification/types.js';
import { createMockAgentOutput, createMockValidatorOutput, expectValidEvidence } from './helpers.js';

describe('Builder-Validator Cycle', () => {
  describe('runBuilderValidatorCycle', () => {
    let mockOptions: ValidationCycleOptions;

    beforeEach(() => {
      mockOptions = {
        maxRetries: 3,
        validatorAgent: 'validator-syntax',
        timeout: 10000
      };
    });

    it('should pass with valid builder output and self-only validation', async () => {
      const builderOutput = createMockAgentOutput('success');
      const result = await runBuilderValidatorCycleWithAgentOutput(
        builderOutput,
        'self-only',
        mockOptions
      );

      expect(result.success).toBe(true);
      expect(result.builderPassed).toBe(true);
      expect(result.validatorPassed).toBe(true);
      expect(result.retryCount).toBe(0);
      expect(result.evidence.length).toBeGreaterThan(0);
      expectValidEvidence(result.evidence);
    });

    it('should invoke validator for validator type', async () => {
      const builderOutput = createMockAgentOutput('success');
      const result = await runBuilderValidatorCycleWithAgentOutput(
        builderOutput,
        'validator',
        mockOptions
      );

      expect(result.success).toBe(true);
      expect(result.builderPassed).toBe(true);
      expect(result.validatorPassed).toBe(true);
      // Should have both builder and validator evidence
      expect(result.evidence.length).toBeGreaterThan(1);
    });

    it('should fail when builder status is failed', async () => {
      const builderOutput = createMockAgentOutput('failed');
      const result = await runBuilderValidatorCycleWithAgentOutput(
        builderOutput,
        'validator',
        mockOptions
      );

      expect(result.success).toBe(false);
      expect(result.builderPassed).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should fail when builder self-validation fails', async () => {
      const builderOutput = createMockAgentOutput('success');
      builderOutput.selfValidation = {
        passed: false,
        retryCount: 1,
        lastError: 'Self-validation failed'
      };

      const result = await runBuilderValidatorCycleWithAgentOutput(
        builderOutput,
        'self-only',
        mockOptions
      );

      expect(result.success).toBe(false);
      expect(result.validatorPassed).toBe(false);
      expect(result.issues).toContain('Builder self-validation failed: Self-validation failed');
    });

    it('should select correct validators based on complexity', () => {
      const lowValidators = selectValidator('validator', 'low');
      expect(lowValidators).toEqual(['syntax']);

      const mediumValidators = selectValidator('validator', 'medium');
      expect(mediumValidators).toEqual(['syntax', 'logic']);

      const highValidators = selectValidator('validator', 'high');
      expect(highValidators).toEqual(['syntax', 'logic', 'security']);

      const architectValidators = selectValidator('architect', 'medium');
      expect(architectValidators).toEqual(['syntax', 'logic', 'security', 'integration']);

      const selfOnlyValidators = selectValidator('self-only', 'high');
      expect(selfOnlyValidators).toEqual([]);
    });

    it('should collect evidence from both builder and validator', async () => {
      const builderOutput = createMockAgentOutput('success');
      builderOutput.evidence = [
        {
          type: 'test_result',
          passed: true,
          content: 'Builder test output'
        },
        {
          type: 'diagnostics',
          passed: true,
          content: 'No errors'
        }
      ];

      const result = await runBuilderValidatorCycleWithAgentOutput(
        builderOutput,
        'validator',
        mockOptions
      );

      expect(result.evidence.length).toBeGreaterThanOrEqual(2);
      expectValidEvidence(result.evidence);
    });
  });

  describe('Validator Utilities', () => {
    it('should create properly formatted validator prompt', () => {
      const builderResult = createMockAgentOutput('success');
      const taskContext = {
        taskId: 'task-1',
        requirements: ['Implement feature', 'Add tests'],
        filesModified: ['src/feature.ts', 'src/feature.test.ts']
      };

      const prompt = createValidatorPrompt('syntax', builderResult, taskContext);

      expect(prompt).toContain('SYNTAX VALIDATION REQUEST');
      expect(prompt).toContain('task-1');
      expect(prompt).toContain('Implement feature');
      expect(prompt).toContain('src/feature.ts');
      expect(prompt).toContain('Required Output Format');
    });

    it('should parse validator output from JSON', () => {
      const validatorJson = JSON.stringify({
        validatorType: 'syntax',
        taskId: 'task-1',
        status: 'APPROVED',
        checks: [
          {
            name: 'No syntax errors',
            passed: true,
            evidence: 'All files compile',
            severity: 'critical'
          }
        ],
        issues: [],
        recommendations: []
      });

      const parsed = parseValidatorOutput(`\`\`\`json\n${validatorJson}\n\`\`\``);

      expect(parsed).not.toBeNull();
      expect(parsed!.validatorType).toBe('syntax');
      expect(parsed!.status).toBe('APPROVED');
      expect(parsed!.checks.length).toBe(1);
      expect(parsed!.checks[0].passed).toBe(true);
    });

    it('should return null for invalid validator output', () => {
      expect(parseValidatorOutput('')).toBeNull();
      expect(parseValidatorOutput('not json')).toBeNull();
      expect(parseValidatorOutput('{}')).toBeNull();
      expect(parseValidatorOutput('{"validatorType": "test"}')).toBeNull();
    });

    it('should convert validator output to evidence', () => {
      const validatorOutput = createMockValidatorOutput('APPROVED');
      const evidence = validatorOutputToEvidence(validatorOutput);

      expect(evidence.type).toBe('syntax_clean');
      expect(evidence.passed).toBe(true);
      expect(evidence.timestamp).toBeInstanceOf(Date);
      expect(evidence.metadata).toBeDefined();
      expect(evidence.metadata!.validatorType).toBe('syntax');
    });

    it('should aggregate multiple validator results', () => {
      const results: ValidatorOutput[] = [
        createMockValidatorOutput('APPROVED'),
        {
          ...createMockValidatorOutput('REJECTED'),
          validatorType: 'logic',
          issues: ['Logic error found']
        }
      ];

      const aggregated = aggregateValidatorResults(results);

      expect(aggregated.overallStatus).toBe('REJECTED');
      expect(aggregated.criticalIssues.length).toBeGreaterThan(0);
      expect(aggregated.allEvidence.length).toBe(2);
    });

    it('should check builder self-validation status', () => {
      const builderWithValidation = createMockAgentOutput('success');
      builderWithValidation.selfValidation = {
        passed: true,
        retryCount: 0
      };

      const check = checkBuilderSelfValidation(builderWithValidation);
      expect(check.passed).toBe(true);
      expect(check.retryCount).toBe(0);

      const builderWithoutValidation = createMockAgentOutput('success');
      builderWithoutValidation.selfValidation = undefined;

      const checkNoValidation = checkBuilderSelfValidation(builderWithoutValidation);
      expect(checkNoValidation.passed).toBe(false);
      expect(checkNoValidation.lastError).toContain('No self-validation data');
    });
  });

  describe('Retry Logic', () => {
    it('should create initial retry state', () => {
      const state = createRetryState(3);

      expect(state.currentAttempt).toBe(0);
      expect(state.maxAttempts).toBe(3);
      expect(state.history).toEqual([]);
      expect(state.status).toBe('in_progress');
    });

    it('should record retry attempts correctly', () => {
      let state = createRetryState(3);
      const builderResult = createMockAgentOutput('success');
      const validatorResult = createMockValidatorOutput('REJECTED');

      state = recordAttempt(state, builderResult, validatorResult, 'retry');

      expect(state.currentAttempt).toBe(1);
      expect(state.history.length).toBe(1);
      expect(state.history[0].action).toBe('retry');
      expect(state.status).toBe('in_progress');

      state = recordAttempt(state, builderResult, validatorResult, 'success');

      expect(state.currentAttempt).toBe(2);
      expect(state.history.length).toBe(2);
      expect(state.status).toBe('success');
    });

    it('should correctly identify retryable issues', () => {
      // Retryable issues
      expect(isRetryableIssue('Syntax error on line 10')).toBe(true);
      expect(isRetryableIssue('Type mismatch')).toBe(true);
      expect(isRetryableIssue('Logic error in calculation')).toBe(true);
      expect(isRetryableIssue('Missing null check')).toBe(true);

      // Non-retryable issues
      expect(isRetryableIssue('Security vulnerability detected')).toBe(false);
      expect(isRetryableIssue('Missing dependency: react')).toBe(false);
      expect(isRetryableIssue('Architectural design flaw')).toBe(false);
      expect(isRetryableIssue('Requires manual intervention')).toBe(false);
    });

    it('should decide not to retry after max attempts', () => {
      const state = createRetryState(3);
      state.currentAttempt = 3;
      const validatorResult = createMockValidatorOutput('REJECTED');

      const decision = shouldRetry(state, validatorResult);

      expect(decision.shouldRetry).toBe(false);
      expect(decision.action).toBe('fail');
      expect(decision.reason).toContain('Maximum retry attempts');
    });

    it('should escalate on critical failures', () => {
      const state = createRetryState(3);
      const validatorResult = createMockValidatorOutput('REJECTED');
      validatorResult.checks = [
        {
          name: 'Critical check',
          passed: false,
          evidence: 'Critical failure',
          severity: 'critical'
        }
      ];

      const decision = shouldRetry(state, validatorResult);

      expect(decision.shouldRetry).toBe(false);
      expect(decision.action).toBe('escalate');
      expect(decision.reason).toContain('Critical validation failure');
    });

    it('should escalate when NEEDS_REVIEW status', () => {
      const state = createRetryState(3);
      const validatorResult = createMockValidatorOutput('NEEDS_REVIEW');

      const decision = shouldRetry(state, validatorResult);

      expect(decision.shouldRetry).toBe(false);
      expect(decision.action).toBe('escalate');
      expect(decision.reason).toContain('Manual review required');
    });

    it('should determine correct escalation level', () => {
      const state = createRetryState(5);
      state.currentAttempt = 5;

      const validatorResult = createMockValidatorOutput('REJECTED');
      validatorResult.issues = ['Some issue'];

      const escalation = determineEscalation(state, validatorResult);

      expect(escalation.shouldEscalate).toBe(true);
      expect(escalation.escalationLevel).toBe('human');
      expect(escalation.reason).toContain('Exceeded reasonable retry limit');
    });

    it('should escalate to architect for security issues', () => {
      const state = createRetryState(3);
      const validatorResult = createMockValidatorOutput('REJECTED');
      validatorResult.issues = ['Security vulnerability: SQL injection risk'];

      const escalation = determineEscalation(state, validatorResult);

      expect(escalation.shouldEscalate).toBe(true);
      expect(escalation.escalationLevel).toBe('architect');
      expect(escalation.reason).toContain('security');
    });

    it('should generate comprehensive failure report', () => {
      let state = createRetryState(3);
      const builderResult = createMockAgentOutput('success');
      const validatorResult = createMockValidatorOutput('REJECTED');
      validatorResult.issues = ['Issue 1', 'Issue 2'];

      state = recordAttempt(state, builderResult, validatorResult, 'retry');
      state = recordAttempt(state, builderResult, validatorResult, 'fail');

      const report = generateFailureReport('task-1', state, validatorResult);

      expect(report.taskId).toBe('task-1');
      expect(report.totalAttempts).toBe(2);
      expect(report.finalStatus).toBe('failed');
      expect(report.attemptSummary.length).toBe(2);
      expect(report.rootCauseAnalysis).toBeDefined();
      expect(report.recommendedAction).toBeDefined();
      expect(report.evidence.length).toBeGreaterThan(0);
    });

    it('should create retry prompt with validator feedback', () => {
      const originalTask = 'Implement authentication';
      const previousResult = createMockAgentOutput('success');
      const validatorFeedback = createMockValidatorOutput('REJECTED');
      validatorFeedback.issues = ['Missing error handling'];
      validatorFeedback.recommendations = ['Add try-catch blocks'];

      const prompt = createRetryPrompt(
        originalTask,
        previousResult,
        validatorFeedback,
        2
      );

      expect(prompt).toContain('RETRY REQUEST (Attempt 2)');
      expect(prompt).toContain('Implement authentication');
      expect(prompt).toContain('Missing error handling');
      expect(prompt).toContain('Add try-catch blocks');
      expect(prompt).toContain('Priority Actions');
    });
  });
});
