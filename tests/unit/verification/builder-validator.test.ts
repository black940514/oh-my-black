/**
 * Unit tests for builder-validator.ts
 * Testing validator prompt generation, output parsing, and results aggregation
 */

import { describe, it, expect } from 'vitest';
import {
  createValidatorPrompt,
  parseValidatorOutput,
  validatorOutputToEvidence,
  aggregateValidatorResults,
  selectValidator,
  checkBuilderSelfValidation,
  type ValidatorOutput,
  type TaskContext,
  type ValidatorCheck
} from '../../../src/features/verification/builder-validator.js';
import type { AgentOutput } from '../../../src/features/agent-output/schema.js';

describe('createValidatorPrompt', () => {
  const mockBuilderResult: AgentOutput = {
    agentId: 'builder-1',
    taskId: 'task-1',
    status: 'success',
    summary: 'Task completed',
    evidence: [
      { type: 'command_output', content: 'Build successful', passed: true }
    ],
    timestamp: Date.now()
  };

  const mockTaskContext: TaskContext = {
    taskId: 'task-1',
    requirements: ['Requirement 1', 'Requirement 2'],
    filesModified: ['src/file1.ts', 'src/file2.ts']
  };

  it('should generate prompt with all sections', () => {
    const prompt = createValidatorPrompt('syntax', mockBuilderResult, mockTaskContext);

    expect(prompt).toContain('SYNTAX VALIDATION REQUEST');
    expect(prompt).toContain('Task Context');
    expect(prompt).toContain('Requirements to Verify');
    expect(prompt).toContain('Builder Output');
    expect(prompt).toContain('Validation Instructions');
    expect(prompt).toContain('Required Output Format');
  });

  it('should include task context', () => {
    const prompt = createValidatorPrompt('syntax', mockBuilderResult, mockTaskContext);

    expect(prompt).toContain('task-1');
    expect(prompt).toContain('src/file1.ts');
    expect(prompt).toContain('src/file2.ts');
  });

  it('should include requirements', () => {
    const prompt = createValidatorPrompt('syntax', mockBuilderResult, mockTaskContext);

    expect(prompt).toContain('Requirement 1');
    expect(prompt).toContain('Requirement 2');
  });

  it('should handle empty requirements', () => {
    const context: TaskContext = {
      ...mockTaskContext,
      requirements: []
    };

    const prompt = createValidatorPrompt('syntax', mockBuilderResult, context);

    expect(prompt).toContain('No specific requirements provided');
  });

  it('should include builder evidence', () => {
    const prompt = createValidatorPrompt('syntax', mockBuilderResult, mockTaskContext);

    expect(prompt).toContain('Builder Evidence');
    expect(prompt).toContain('Build successful');
  });

  it('should truncate long evidence content', () => {
    const longContent = 'a'.repeat(1000);
    const builderWithLongEvidence: AgentOutput = {
      ...mockBuilderResult,
      evidence: [
        { type: 'command_output', content: longContent, passed: true }
      ]
    };

    const prompt = createValidatorPrompt('syntax', builderWithLongEvidence, mockTaskContext);

    expect(prompt.length).toBeLessThan(longContent.length + 1000);
    expect(prompt).toContain('...');
  });

  it('should include validation instructions for syntax type', () => {
    const prompt = createValidatorPrompt('syntax', mockBuilderResult, mockTaskContext);

    expect(prompt).toContain('Perform SYNTAX validation');
    expect(prompt).toContain('Check for syntax errors');
  });

  it('should include validation instructions for logic type', () => {
    const prompt = createValidatorPrompt('logic', mockBuilderResult, mockTaskContext);

    expect(prompt).toContain('Perform LOGIC validation');
    expect(prompt).toContain('Verify the implementation logic is correct');
  });

  it('should include validation instructions for security type', () => {
    const prompt = createValidatorPrompt('security', mockBuilderResult, mockTaskContext);

    expect(prompt).toContain('Perform SECURITY validation');
    expect(prompt).toContain('Check for security vulnerabilities');
  });

  it('should include validation instructions for integration type', () => {
    const prompt = createValidatorPrompt('integration', mockBuilderResult, mockTaskContext);

    expect(prompt).toContain('Perform INTEGRATION validation');
    expect(prompt).toContain('Verify changes integrate with existing code');
  });

  it('should include self-validation results if present', () => {
    const builderWithSelfValidation: AgentOutput = {
      ...mockBuilderResult,
      selfValidation: {
        passed: true,
        retryCount: 2,
        lastError: 'Previous error'
      }
    };

    const prompt = createValidatorPrompt('syntax', builderWithSelfValidation, mockTaskContext);

    expect(prompt).toContain('Builder Self-Validation');
    expect(prompt).toContain('Passed: true');
    expect(prompt).toContain('Retry Count: 2');
    expect(prompt).toContain('Previous error');
  });

  it('should handle empty files modified list', () => {
    const context: TaskContext = {
      ...mockTaskContext,
      filesModified: []
    };

    const prompt = createValidatorPrompt('syntax', mockBuilderResult, context);

    expect(prompt).toContain('Files Modified: None');
  });
});

describe('parseValidatorOutput', () => {
  const validJson = `\`\`\`json
{
  "validatorType": "syntax",
  "taskId": "task-1",
  "status": "APPROVED",
  "checks": [
    {
      "name": "Syntax check",
      "passed": true,
      "evidence": "No errors found",
      "severity": "critical"
    }
  ],
  "issues": [],
  "recommendations": ["Add more tests"]
}
\`\`\``;

  it('should parse valid JSON from code block', () => {
    const result = parseValidatorOutput(validJson);

    expect(result).not.toBeNull();
    expect(result?.validatorType).toBe('syntax');
    expect(result?.taskId).toBe('task-1');
    expect(result?.status).toBe('APPROVED');
    expect(result?.checks).toHaveLength(1);
  });

  it('should return null for empty string', () => {
    expect(parseValidatorOutput('')).toBeNull();
  });

  it('should return null for non-string input', () => {
    expect(parseValidatorOutput(null as any)).toBeNull();
  });

  it('should parse JSON without code block markers', () => {
    const rawJson = `{
      "validatorType": "logic",
      "taskId": "task-2",
      "status": "REJECTED",
      "checks": [],
      "issues": ["Logic error"],
      "recommendations": []
    }`;

    const result = parseValidatorOutput(rawJson);

    expect(result).not.toBeNull();
    expect(result?.validatorType).toBe('logic');
    expect(result?.status).toBe('REJECTED');
  });

  it('should normalize status to uppercase', () => {
    const json = validJson.replace('APPROVED', 'approved');
    const result = parseValidatorOutput(json);

    expect(result?.status).toBe('APPROVED');
  });

  it('should reject invalid status values', () => {
    const json = validJson.replace('APPROVED', 'INVALID');
    const result = parseValidatorOutput(json);

    expect(result).toBeNull();
  });

  it('should return null for missing required fields', () => {
    const invalidJson = `\`\`\`json
{
  "validatorType": "syntax",
  "status": "APPROVED"
}
\`\`\``;

    expect(parseValidatorOutput(invalidJson)).toBeNull();
  });

  it('should handle empty arrays', () => {
    const result = parseValidatorOutput(validJson);

    expect(result?.checks).toBeInstanceOf(Array);
    expect(result?.issues).toBeInstanceOf(Array);
    expect(result?.recommendations).toBeInstanceOf(Array);
  });

  it('should default severity to major if invalid', () => {
    const jsonWithInvalidSeverity = validJson.replace('"critical"', '"invalid"');
    const result = parseValidatorOutput(jsonWithInvalidSeverity);

    expect(result?.checks[0].severity).toBe('major');
  });

  it('should handle all status types', () => {
    const statuses = ['APPROVED', 'REJECTED', 'NEEDS_REVIEW'];

    for (const status of statuses) {
      const json = validJson.replace('APPROVED', status);
      const result = parseValidatorOutput(json);

      expect(result?.status).toBe(status);
    }
  });

  it('should return null for malformed JSON', () => {
    const malformed = '{ invalid json }';

    expect(parseValidatorOutput(malformed)).toBeNull();
  });
});

describe('validatorOutputToEvidence', () => {
  it('should convert syntax validator to syntax_clean evidence', () => {
    const output: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'APPROVED',
      checks: [],
      issues: [],
      recommendations: []
    };

    const evidence = validatorOutputToEvidence(output);

    expect(evidence.type).toBe('syntax_clean');
    expect(evidence.passed).toBe(true);
  });

  it('should convert integration validator to integration_pass evidence', () => {
    const output: ValidatorOutput = {
      validatorType: 'integration',
      taskId: 'task-1',
      status: 'APPROVED',
      checks: [],
      issues: [],
      recommendations: []
    };

    const evidence = validatorOutputToEvidence(output);

    expect(evidence.type).toBe('integration_pass');
  });

  it('should convert other validators to validator_approval evidence', () => {
    const output: ValidatorOutput = {
      validatorType: 'logic',
      taskId: 'task-1',
      status: 'APPROVED',
      checks: [],
      issues: [],
      recommendations: []
    };

    const evidence = validatorOutputToEvidence(output);

    expect(evidence.type).toBe('validator_approval');
  });

  it('should mark evidence as passed for APPROVED status', () => {
    const output: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'APPROVED',
      checks: [],
      issues: [],
      recommendations: []
    };

    const evidence = validatorOutputToEvidence(output);

    expect(evidence.passed).toBe(true);
    expect(evidence.error).toBeUndefined();
  });

  it('should mark evidence as failed for REJECTED status', () => {
    const output: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [],
      issues: ['Error 1', 'Error 2'],
      recommendations: []
    };

    const evidence = validatorOutputToEvidence(output);

    expect(evidence.passed).toBe(false);
    expect(evidence.error).toBe('Error 1; Error 2');
  });

  it('should include metadata', () => {
    const output: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'APPROVED',
      checks: [
        { name: 'Check 1', passed: true, evidence: 'OK', severity: 'major' }
      ],
      issues: [],
      recommendations: ['Improve code']
    };

    const evidence = validatorOutputToEvidence(output);

    expect(evidence.metadata).toBeDefined();
    expect(evidence.metadata?.validatorType).toBe('syntax');
    expect(evidence.metadata?.checksPerformed).toBe(1);
    expect(evidence.metadata?.recommendations).toEqual(['Improve code']);
  });

  it('should count critical failures', () => {
    const output: ValidatorOutput = {
      validatorType: 'syntax',
      taskId: 'task-1',
      status: 'REJECTED',
      checks: [
        { name: 'Check 1', passed: false, evidence: 'Failed', severity: 'critical' },
        { name: 'Check 2', passed: false, evidence: 'Failed', severity: 'major' }
      ],
      issues: [],
      recommendations: []
    };

    const evidence = validatorOutputToEvidence(output);

    expect(evidence.metadata?.criticalFailures).toBe(1);
  });
});

describe('aggregateValidatorResults', () => {
  it('should return APPROVED for empty results', () => {
    const aggregated = aggregateValidatorResults([]);

    expect(aggregated.overallStatus).toBe('APPROVED');
    expect(aggregated.criticalIssues).toHaveLength(0);
    expect(aggregated.allEvidence).toHaveLength(0);
  });

  it('should return APPROVED when all validators approve', () => {
    const results: ValidatorOutput[] = [
      {
        validatorType: 'syntax',
        taskId: 'task-1',
        status: 'APPROVED',
        checks: [],
        issues: [],
        recommendations: []
      },
      {
        validatorType: 'logic',
        taskId: 'task-1',
        status: 'APPROVED',
        checks: [],
        issues: [],
        recommendations: []
      }
    ];

    const aggregated = aggregateValidatorResults(results);

    expect(aggregated.overallStatus).toBe('APPROVED');
  });

  it('should return REJECTED if any validator rejects', () => {
    const results: ValidatorOutput[] = [
      {
        validatorType: 'syntax',
        taskId: 'task-1',
        status: 'APPROVED',
        checks: [],
        issues: [],
        recommendations: []
      },
      {
        validatorType: 'logic',
        taskId: 'task-1',
        status: 'REJECTED',
        checks: [],
        issues: ['Logic error'],
        recommendations: []
      }
    ];

    const aggregated = aggregateValidatorResults(results);

    expect(aggregated.overallStatus).toBe('REJECTED');
    expect(aggregated.criticalIssues).toContain('Logic error');
  });

  it('should return NEEDS_REVIEW if any validator needs review', () => {
    const results: ValidatorOutput[] = [
      {
        validatorType: 'syntax',
        taskId: 'task-1',
        status: 'APPROVED',
        checks: [],
        issues: [],
        recommendations: []
      },
      {
        validatorType: 'security',
        taskId: 'task-1',
        status: 'NEEDS_REVIEW',
        checks: [],
        issues: [],
        recommendations: []
      }
    ];

    const aggregated = aggregateValidatorResults(results);

    expect(aggregated.overallStatus).toBe('NEEDS_REVIEW');
  });

  it('should collect critical check failures', () => {
    const results: ValidatorOutput[] = [
      {
        validatorType: 'syntax',
        taskId: 'task-1',
        status: 'REJECTED',
        checks: [
          { name: 'Syntax', passed: false, evidence: 'Syntax error', severity: 'critical' }
        ],
        issues: [],
        recommendations: []
      }
    ];

    const aggregated = aggregateValidatorResults(results);

    expect(aggregated.criticalIssues).toContain('[syntax] Syntax: Syntax error');
  });

  it('should convert all results to evidence', () => {
    const results: ValidatorOutput[] = [
      {
        validatorType: 'syntax',
        taskId: 'task-1',
        status: 'APPROVED',
        checks: [],
        issues: [],
        recommendations: []
      },
      {
        validatorType: 'logic',
        taskId: 'task-1',
        status: 'APPROVED',
        checks: [],
        issues: [],
        recommendations: []
      }
    ];

    const aggregated = aggregateValidatorResults(results);

    expect(aggregated.allEvidence).toHaveLength(2);
  });
});

describe('selectValidator', () => {
  it('should return empty for self-only validation', () => {
    expect(selectValidator('self-only', 'low')).toEqual([]);
    expect(selectValidator('self-only', 'medium')).toEqual([]);
    expect(selectValidator('self-only', 'high')).toEqual([]);
  });

  it('should return syntax for low complexity validator', () => {
    expect(selectValidator('validator', 'low')).toEqual(['syntax']);
  });

  it('should return syntax and logic for medium complexity', () => {
    expect(selectValidator('validator', 'medium')).toEqual(['syntax', 'logic']);
  });

  it('should return full suite for high complexity', () => {
    expect(selectValidator('validator', 'high')).toEqual(['syntax', 'logic', 'security']);
  });

  it('should return full validation suite for architect', () => {
    expect(selectValidator('architect', 'low')).toEqual(['syntax', 'logic', 'security', 'integration']);
    expect(selectValidator('architect', 'medium')).toEqual(['syntax', 'logic', 'security', 'integration']);
    expect(selectValidator('architect', 'high')).toEqual(['syntax', 'logic', 'security', 'integration']);
  });
});

describe('checkBuilderSelfValidation', () => {
  it('should return not passed when no self-validation data', () => {
    const builderResult: AgentOutput = {
      agentId: 'builder-1',
      taskId: 'task-1',
      status: 'success',
      summary: 'Done',
      evidence: [],
      timestamp: Date.now()
    };

    const result = checkBuilderSelfValidation(builderResult);

    expect(result.passed).toBe(false);
    expect(result.retryCount).toBe(0);
    expect(result.lastError).toContain('No self-validation data');
  });

  it('should return passed when self-validation succeeded', () => {
    const builderResult: AgentOutput = {
      agentId: 'builder-1',
      taskId: 'task-1',
      status: 'success',
      summary: 'Done',
      evidence: [],
      timestamp: Date.now(),
      selfValidation: {
        passed: true,
        retryCount: 0
      }
    };

    const result = checkBuilderSelfValidation(builderResult);

    expect(result.passed).toBe(true);
    expect(result.retryCount).toBe(0);
  });

  it('should return not passed when self-validation failed', () => {
    const builderResult: AgentOutput = {
      agentId: 'builder-1',
      taskId: 'task-1',
      status: 'success',
      summary: 'Done',
      evidence: [],
      timestamp: Date.now(),
      selfValidation: {
        passed: false,
        retryCount: 3,
        lastError: 'Validation failed'
      }
    };

    const result = checkBuilderSelfValidation(builderResult);

    expect(result.passed).toBe(false);
    expect(result.retryCount).toBe(3);
    expect(result.lastError).toBe('Validation failed');
  });

  it('should handle self-validation with no error message', () => {
    const builderResult: AgentOutput = {
      agentId: 'builder-1',
      taskId: 'task-1',
      status: 'success',
      summary: 'Done',
      evidence: [],
      timestamp: Date.now(),
      selfValidation: {
        passed: false,
        retryCount: 1
      }
    };

    const result = checkBuilderSelfValidation(builderResult);

    expect(result.passed).toBe(false);
    expect(result.lastError).toBeUndefined();
  });
});
