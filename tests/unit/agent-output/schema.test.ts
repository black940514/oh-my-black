/**
 * Unit tests for agent-output/schema.ts
 * Testing AgentOutput schema validation and type definitions
 */

import { describe, it, expect } from 'vitest';
import type {
  AgentOutput,
  Evidence,
  FileChange,
  SelfValidationResult,
  AgentOutputValidationResult
} from '../../../src/features/agent-output/schema.js';

describe('AgentOutput type definition', () => {
  it('should accept valid agent output with required fields only', () => {
    const output: AgentOutput = {
      agentId: 'agent-1',
      taskId: 'task-1',
      status: 'success',
      summary: 'Task completed successfully',
      evidence: [],
      timestamp: Date.now()
    };

    expect(output.agentId).toBe('agent-1');
    expect(output.taskId).toBe('task-1');
    expect(output.status).toBe('success');
    expect(output.summary).toBe('Task completed successfully');
    expect(output.evidence).toEqual([]);
    expect(output.timestamp).toBeGreaterThan(0);
  });

  it('should accept all status types', () => {
    const statuses: AgentOutput['status'][] = ['success', 'partial', 'failed', 'blocked'];

    for (const status of statuses) {
      const output: AgentOutput = {
        agentId: 'agent-1',
        taskId: 'task-1',
        status,
        summary: 'Test',
        evidence: [],
        timestamp: Date.now()
      };

      expect(output.status).toBe(status);
    }
  });

  it('should accept optional fields', () => {
    const output: AgentOutput = {
      agentId: 'agent-1',
      taskId: 'task-1',
      status: 'success',
      summary: 'Done',
      evidence: [],
      timestamp: Date.now(),
      filesModified: [
        { path: 'src/file.ts', changeType: 'modified', diagnosticsClean: true }
      ],
      selfValidation: {
        passed: true,
        retryCount: 0
      },
      nextSteps: ['Deploy to production'],
      learnings: ['Learned X']
    };

    expect(output.filesModified).toBeDefined();
    expect(output.selfValidation).toBeDefined();
    expect(output.nextSteps).toBeDefined();
    expect(output.learnings).toBeDefined();
  });

  it('should accept empty arrays', () => {
    const output: AgentOutput = {
      agentId: 'agent-1',
      taskId: 'task-1',
      status: 'success',
      summary: 'Done',
      evidence: [],
      timestamp: Date.now(),
      filesModified: [],
      nextSteps: [],
      learnings: []
    };

    expect(output.evidence).toEqual([]);
    expect(output.filesModified).toEqual([]);
    expect(output.nextSteps).toEqual([]);
    expect(output.learnings).toEqual([]);
  });

  it('should handle multiple evidence items', () => {
    const evidence: Evidence[] = [
      { type: 'command_output', content: 'Build success', passed: true },
      { type: 'test_result', content: 'All tests passed', passed: true },
      { type: 'diagnostics', content: 'No errors', passed: true }
    ];

    const output: AgentOutput = {
      agentId: 'agent-1',
      taskId: 'task-1',
      status: 'success',
      summary: 'Done',
      evidence,
      timestamp: Date.now()
    };

    expect(output.evidence).toHaveLength(3);
  });

  it('should handle long summary text', () => {
    const longSummary = 'A'.repeat(1000);

    const output: AgentOutput = {
      agentId: 'agent-1',
      taskId: 'task-1',
      status: 'success',
      summary: longSummary,
      evidence: [],
      timestamp: Date.now()
    };

    expect(output.summary.length).toBe(1000);
  });
});

describe('Evidence type definition', () => {
  it('should accept all evidence types', () => {
    const types: Evidence['type'][] = ['command_output', 'test_result', 'diagnostics', 'manual_check'];

    for (const type of types) {
      const evidence: Evidence = {
        type,
        content: 'Test content',
        passed: true
      };

      expect(evidence.type).toBe(type);
    }
  });

  it('should accept passed and failed evidence', () => {
    const passed: Evidence = {
      type: 'test_result',
      content: 'Tests passed',
      passed: true
    };

    const failed: Evidence = {
      type: 'test_result',
      content: 'Tests failed',
      passed: false
    };

    expect(passed.passed).toBe(true);
    expect(failed.passed).toBe(false);
  });

  it('should accept empty content', () => {
    const evidence: Evidence = {
      type: 'manual_check',
      content: '',
      passed: true
    };

    expect(evidence.content).toBe('');
  });

  it('should accept multiline content', () => {
    const evidence: Evidence = {
      type: 'command_output',
      content: 'Line 1\nLine 2\nLine 3',
      passed: true
    };

    expect(evidence.content).toContain('\n');
  });

  it('should accept special characters in content', () => {
    const evidence: Evidence = {
      type: 'diagnostics',
      content: 'Error: <script>alert("test")</script>',
      passed: false
    };

    expect(evidence.content).toContain('<script>');
  });
});

describe('FileChange type definition', () => {
  it('should accept all change types', () => {
    const changeTypes: FileChange['changeType'][] = ['created', 'modified', 'deleted'];

    for (const changeType of changeTypes) {
      const fileChange: FileChange = {
        path: 'src/file.ts',
        changeType,
        diagnosticsClean: true
      };

      expect(fileChange.changeType).toBe(changeType);
    }
  });

  it('should accept absolute paths', () => {
    const fileChange: FileChange = {
      path: '/Users/user/project/src/file.ts',
      changeType: 'modified',
      diagnosticsClean: true
    };

    expect(fileChange.path).toContain('/Users/');
  });

  it('should accept relative paths', () => {
    const fileChange: FileChange = {
      path: './src/file.ts',
      changeType: 'modified',
      diagnosticsClean: true
    };

    expect(fileChange.path).toContain('./');
  });

  it('should accept Windows-style paths', () => {
    const fileChange: FileChange = {
      path: 'C:\\Users\\user\\project\\file.ts',
      changeType: 'modified',
      diagnosticsClean: true
    };

    expect(fileChange.path).toContain('C:\\');
  });

  it('should handle diagnostics status', () => {
    const clean: FileChange = {
      path: 'file.ts',
      changeType: 'modified',
      diagnosticsClean: true
    };

    const dirty: FileChange = {
      path: 'file.ts',
      changeType: 'modified',
      diagnosticsClean: false
    };

    expect(clean.diagnosticsClean).toBe(true);
    expect(dirty.diagnosticsClean).toBe(false);
  });
});

describe('SelfValidationResult type definition', () => {
  it('should accept passed validation', () => {
    const result: SelfValidationResult = {
      passed: true,
      retryCount: 0
    };

    expect(result.passed).toBe(true);
    expect(result.retryCount).toBe(0);
  });

  it('should accept failed validation', () => {
    const result: SelfValidationResult = {
      passed: false,
      retryCount: 3,
      lastError: 'Validation failed: missing tests'
    };

    expect(result.passed).toBe(false);
    expect(result.retryCount).toBe(3);
    expect(result.lastError).toBeDefined();
  });

  it('should handle validation without error', () => {
    const result: SelfValidationResult = {
      passed: false,
      retryCount: 1
    };

    expect(result.lastError).toBeUndefined();
  });

  it('should accept zero retries', () => {
    const result: SelfValidationResult = {
      passed: true,
      retryCount: 0
    };

    expect(result.retryCount).toBe(0);
  });

  it('should accept multiple retries', () => {
    const result: SelfValidationResult = {
      passed: false,
      retryCount: 10,
      lastError: 'Still failing'
    };

    expect(result.retryCount).toBe(10);
  });

  it('should handle empty error message', () => {
    const result: SelfValidationResult = {
      passed: false,
      retryCount: 1,
      lastError: ''
    };

    expect(result.lastError).toBe('');
  });
});

describe('AgentOutputValidationResult type definition', () => {
  it('should accept valid result', () => {
    const result: AgentOutputValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should accept invalid result with errors', () => {
    const result: AgentOutputValidationResult = {
      valid: false,
      errors: ['Missing required field: agentId', 'Invalid status value'],
      warnings: []
    };

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('should accept warnings without errors', () => {
    const result: AgentOutputValidationResult = {
      valid: true,
      errors: [],
      warnings: ['Evidence is empty', 'No files modified']
    };

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(2);
  });

  it('should handle both errors and warnings', () => {
    const result: AgentOutputValidationResult = {
      valid: false,
      errors: ['Critical error'],
      warnings: ['Minor warning']
    };

    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it('should accept empty arrays', () => {
    const result: AgentOutputValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('AgentOutput real-world scenarios', () => {
  it('should represent successful code modification', () => {
    const output: AgentOutput = {
      agentId: 'executor-1',
      taskId: 'implement-feature-x',
      status: 'success',
      summary: 'Implemented feature X with full test coverage',
      evidence: [
        {
          type: 'command_output',
          content: 'npm run build\n✓ Build completed successfully',
          passed: true
        },
        {
          type: 'test_result',
          content: 'npm test\n✓ 25 tests passed',
          passed: true
        },
        {
          type: 'diagnostics',
          content: 'tsc --noEmit\nNo errors found',
          passed: true
        }
      ],
      timestamp: Date.now(),
      filesModified: [
        { path: 'src/feature-x.ts', changeType: 'created', diagnosticsClean: true },
        { path: 'src/feature-x.test.ts', changeType: 'created', diagnosticsClean: true },
        { path: 'src/index.ts', changeType: 'modified', diagnosticsClean: true }
      ],
      selfValidation: {
        passed: true,
        retryCount: 0
      },
      nextSteps: ['Update documentation', 'Create PR'],
      learnings: ['Feature X integrates well with existing system']
    };

    expect(output.status).toBe('success');
    expect(output.evidence).toHaveLength(3);
    expect(output.filesModified).toHaveLength(3);
    expect(output.selfValidation?.passed).toBe(true);
  });

  it('should represent failed task with retry', () => {
    const output: AgentOutput = {
      agentId: 'executor-2',
      taskId: 'fix-bug-y',
      status: 'failed',
      summary: 'Attempted to fix bug Y but tests still failing',
      evidence: [
        {
          type: 'test_result',
          content: 'npm test\n✗ 3 tests failed',
          passed: false
        },
        {
          type: 'command_output',
          content: 'Error: Cannot read property of undefined',
          passed: false
        }
      ],
      timestamp: Date.now(),
      filesModified: [
        { path: 'src/buggy-file.ts', changeType: 'modified', diagnosticsClean: false }
      ],
      selfValidation: {
        passed: false,
        retryCount: 2,
        lastError: 'Tests failing: TypeError in line 45'
      },
      nextSteps: ['Debug line 45', 'Add null checks'],
      learnings: ['Bug Y is more complex than initially assessed']
    };

    expect(output.status).toBe('failed');
    expect(output.selfValidation?.passed).toBe(false);
    expect(output.selfValidation?.retryCount).toBe(2);
  });

  it('should represent partial completion', () => {
    const output: AgentOutput = {
      agentId: 'executor-3',
      taskId: 'refactor-module',
      status: 'partial',
      summary: 'Refactored 2 out of 5 files before timeout',
      evidence: [
        {
          type: 'manual_check',
          content: 'Completed refactoring of util functions',
          passed: true
        },
        {
          type: 'diagnostics',
          content: 'Remaining files need attention',
          passed: false
        }
      ],
      timestamp: Date.now(),
      filesModified: [
        { path: 'src/utils/helper.ts', changeType: 'modified', diagnosticsClean: true },
        { path: 'src/utils/formatter.ts', changeType: 'modified', diagnosticsClean: true }
      ],
      selfValidation: {
        passed: false,
        retryCount: 0,
        lastError: 'Incomplete: 3 files remaining'
      },
      nextSteps: [
        'Continue refactoring remaining files',
        'Update imports in dependent modules'
      ]
    };

    expect(output.status).toBe('partial');
    expect(output.filesModified).toHaveLength(2);
  });

  it('should represent blocked task', () => {
    const output: AgentOutput = {
      agentId: 'executor-4',
      taskId: 'integrate-api',
      status: 'blocked',
      summary: 'Cannot proceed without API credentials',
      evidence: [
        {
          type: 'manual_check',
          content: 'Checked .env file - API_KEY is missing',
          passed: false
        }
      ],
      timestamp: Date.now(),
      filesModified: [],
      nextSteps: [
        'Obtain API credentials from team lead',
        'Configure .env file',
        'Retry integration'
      ],
      learnings: ['API requires authentication token']
    };

    expect(output.status).toBe('blocked');
    expect(output.filesModified).toEqual([]);
  });

  it('should handle minimal valid output', () => {
    const output: AgentOutput = {
      agentId: 'quick-agent',
      taskId: 'simple-task',
      status: 'success',
      summary: 'Done',
      evidence: [
        { type: 'manual_check', content: 'OK', passed: true }
      ],
      timestamp: Date.now()
    };

    expect(output).toBeDefined();
    expect(Object.keys(output)).toHaveLength(6); // 6 required fields
  });

  it('should handle comprehensive output with all fields', () => {
    const output: AgentOutput = {
      agentId: 'comprehensive-agent',
      taskId: 'comprehensive-task',
      status: 'success',
      summary: 'Comprehensive task completed',
      evidence: [
        { type: 'command_output', content: 'Output 1', passed: true },
        { type: 'test_result', content: 'Output 2', passed: true },
        { type: 'diagnostics', content: 'Output 3', passed: true },
        { type: 'manual_check', content: 'Output 4', passed: true }
      ],
      timestamp: Date.now(),
      filesModified: [
        { path: 'file1.ts', changeType: 'created', diagnosticsClean: true },
        { path: 'file2.ts', changeType: 'modified', diagnosticsClean: true },
        { path: 'file3.ts', changeType: 'deleted', diagnosticsClean: true }
      ],
      selfValidation: {
        passed: true,
        retryCount: 1,
        lastError: 'Previous error (now resolved)'
      },
      nextSteps: ['Step 1', 'Step 2', 'Step 3'],
      learnings: ['Learning 1', 'Learning 2', 'Learning 3']
    };

    expect(output.evidence).toHaveLength(4);
    expect(output.filesModified).toHaveLength(3);
    expect(output.nextSteps).toHaveLength(3);
    expect(output.learnings).toHaveLength(3);
  });
});
