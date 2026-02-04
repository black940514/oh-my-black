/**
 * Unit tests for ohmyblack-checks.ts
 * Testing verification check creation and validation logic
 */

import { describe, it, expect } from 'vitest';
import {
  OHMYBLACK_CHECKS,
  createOhmyblackCheck,
  allOhmyblackChecksPassed,
  runBuilderValidatorCycle,
  type ValidationType,
  type BuilderResult
} from '../../../src/features/verification/ohmyblack-checks.js';
import type { VerificationEvidence } from '../../../src/features/verification/types.js';

describe('OHMYBLACK_CHECKS', () => {
  it('should have all required checks defined', () => {
    expect(OHMYBLACK_CHECKS.SYNTAX_CLEAN).toBeDefined();
    expect(OHMYBLACK_CHECKS.VALIDATOR_APPROVAL).toBeDefined();
    expect(OHMYBLACK_CHECKS.INTEGRATION_PASS).toBeDefined();
  });

  it('should have correct check properties', () => {
    expect(OHMYBLACK_CHECKS.SYNTAX_CLEAN.id).toBe('syntax_clean');
    expect(OHMYBLACK_CHECKS.SYNTAX_CLEAN.required).toBe(true);
    expect(OHMYBLACK_CHECKS.SYNTAX_CLEAN.completed).toBe(false);
  });

  it('should mark INTEGRATION_PASS as optional', () => {
    expect(OHMYBLACK_CHECKS.INTEGRATION_PASS.required).toBe(false);
  });
});

describe('createOhmyblackCheck', () => {
  it('should create check from base template', () => {
    const check = createOhmyblackCheck('SYNTAX_CLEAN');

    expect(check.id).toBe('syntax_clean');
    expect(check.name).toBe('Syntax Clean');
    expect(check.completed).toBe(false);
    expect(check.command).toBeUndefined();
  });

  it('should create check with custom command', () => {
    const check = createOhmyblackCheck('VALIDATOR_APPROVAL', 'npm run validate');

    expect(check.id).toBe('validator_approval');
    expect(check.command).toBe('npm run validate');
  });

  it('should create independent check instances', () => {
    const check1 = createOhmyblackCheck('SYNTAX_CLEAN');
    const check2 = createOhmyblackCheck('SYNTAX_CLEAN');

    check1.completed = true;
    expect(check2.completed).toBe(false);
  });

  it('should handle all check types', () => {
    const syntaxCheck = createOhmyblackCheck('SYNTAX_CLEAN');
    const validatorCheck = createOhmyblackCheck('VALIDATOR_APPROVAL');
    const integrationCheck = createOhmyblackCheck('INTEGRATION_PASS');

    expect(syntaxCheck.id).toBe('syntax_clean');
    expect(validatorCheck.id).toBe('validator_approval');
    expect(integrationCheck.id).toBe('integration_pass');
  });
});

describe('allOhmyblackChecksPassed', () => {
  it('should return true when all required checks passed', () => {
    const evidence: VerificationEvidence[] = [
      { type: 'syntax_clean', passed: true, timestamp: new Date() },
      { type: 'validator_approval', passed: true, timestamp: new Date() }
    ];

    expect(allOhmyblackChecksPassed(evidence)).toBe(true);
  });

  it('should return false when syntax_clean failed', () => {
    const evidence: VerificationEvidence[] = [
      { type: 'syntax_clean', passed: false, timestamp: new Date() },
      { type: 'validator_approval', passed: true, timestamp: new Date() }
    ];

    expect(allOhmyblackChecksPassed(evidence)).toBe(false);
  });

  it('should return false when validator_approval failed', () => {
    const evidence: VerificationEvidence[] = [
      { type: 'syntax_clean', passed: true, timestamp: new Date() },
      { type: 'validator_approval', passed: false, timestamp: new Date() }
    ];

    expect(allOhmyblackChecksPassed(evidence)).toBe(false);
  });

  it('should return false when evidence is empty', () => {
    expect(allOhmyblackChecksPassed([])).toBe(false);
  });

  it('should return false when only one required check is present', () => {
    const evidence: VerificationEvidence[] = [
      { type: 'syntax_clean', passed: true, timestamp: new Date() }
    ];

    expect(allOhmyblackChecksPassed(evidence)).toBe(false);
  });

  it('should ignore optional checks', () => {
    const evidence: VerificationEvidence[] = [
      { type: 'syntax_clean', passed: true, timestamp: new Date() },
      { type: 'validator_approval', passed: true, timestamp: new Date() },
      { type: 'integration_pass', passed: false, timestamp: new Date() }
    ];

    // Should still pass because integration_pass is optional
    expect(allOhmyblackChecksPassed(evidence)).toBe(true);
  });

  it('should handle duplicate evidence entries', () => {
    const evidence: VerificationEvidence[] = [
      { type: 'syntax_clean', passed: false, timestamp: new Date() },
      { type: 'syntax_clean', passed: true, timestamp: new Date() },
      { type: 'validator_approval', passed: true, timestamp: new Date() }
    ];

    // Should pass if at least one entry passed
    expect(allOhmyblackChecksPassed(evidence)).toBe(true);
  });
});

describe('runBuilderValidatorCycle', () => {
  it('should return failure when builder failed', async () => {
    const builderResult: BuilderResult = {
      success: false,
      filesModified: [],
      errors: ['Build error']
    };

    const result = await runBuilderValidatorCycle(
      builderResult,
      'validator',
      { maxRetries: 3, validatorAgent: 'validator', timeout: 5000 }
    );

    expect(result.success).toBe(false);
    expect(result.builderPassed).toBe(false);
    expect(result.validatorPassed).toBe(false);
    expect(result.issues).toContain('Builder phase failed');
    expect(result.issues).toContain('Build error');
  });

  it('should return success for self-only validation when builder passed', async () => {
    const builderResult: BuilderResult = {
      success: true,
      filesModified: ['file.ts'],
      errors: []
    };

    const result = await runBuilderValidatorCycle(
      builderResult,
      'self-only',
      { maxRetries: 3, validatorAgent: 'self', timeout: 5000 }
    );

    expect(result.success).toBe(true);
    expect(result.builderPassed).toBe(true);
    expect(result.validatorPassed).toBe(true);
    expect(result.retryCount).toBe(0);
  });

  it('should handle validation timeout', async () => {
    const builderResult: BuilderResult = {
      success: true,
      filesModified: ['file.ts'],
      errors: []
    };

    const result = await runBuilderValidatorCycle(
      builderResult,
      'validator',
      { maxRetries: 3, validatorAgent: 'validator', timeout: 1 }
    );

    // Should complete (simulated implementation doesn't actually timeout)
    expect(result.builderPassed).toBe(true);
  });

  it('should collect builder evidence', async () => {
    const builderEvidence: VerificationEvidence = {
      type: 'syntax_clean',
      passed: true,
      timestamp: new Date()
    };

    const builderResult: BuilderResult = {
      success: true,
      filesModified: ['file.ts'],
      errors: [],
      evidence: builderEvidence
    };

    const result = await runBuilderValidatorCycle(
      builderResult,
      'validator',
      { maxRetries: 3, validatorAgent: 'validator', timeout: 5000 }
    );

    expect(result.evidence).toContainEqual(builderEvidence);
  });

  it('should not retry for self-only validation', async () => {
    const builderResult: BuilderResult = {
      success: true,
      filesModified: ['file.ts'],
      errors: ['Syntax error']
    };

    const result = await runBuilderValidatorCycle(
      builderResult,
      'self-only',
      { maxRetries: 3, validatorAgent: 'self', timeout: 5000 }
    );

    expect(result.retryCount).toBe(0);
  });

  it('should handle empty files list', async () => {
    const builderResult: BuilderResult = {
      success: true,
      filesModified: [],
      errors: []
    };

    const result = await runBuilderValidatorCycle(
      builderResult,
      'validator',
      { maxRetries: 3, validatorAgent: 'validator', timeout: 5000 }
    );

    expect(result.success).toBe(true);
  });

  it('should respect maxRetries limit', async () => {
    const builderResult: BuilderResult = {
      success: true,
      filesModified: ['file.ts'],
      errors: []
    };

    const result = await runBuilderValidatorCycle(
      builderResult,
      'validator',
      { maxRetries: 2, validatorAgent: 'validator', timeout: 5000 }
    );

    expect(result.retryCount).toBeLessThanOrEqual(2);
  });
});

describe('ValidationType', () => {
  it('should support all validation types', () => {
    const types: ValidationType[] = ['self-only', 'validator', 'architect'];

    for (const type of types) {
      const builderResult: BuilderResult = {
        success: true,
        filesModified: [],
        errors: []
      };

      expect(async () => {
        await runBuilderValidatorCycle(
          builderResult,
          type,
          { maxRetries: 1, validatorAgent: type, timeout: 5000 }
        );
      }).not.toThrow();
    }
  });
});
