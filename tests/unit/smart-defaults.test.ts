import { describe, it, expect } from 'vitest';
import { autoConfigureDefaults } from '../../src/features/smart-defaults/index.js';
import { selectValidationType } from '../../src/features/smart-defaults/validation-selector.js';
import { selectTeamTemplate } from '../../src/features/smart-defaults/team-selector.js';
import { calculateParallelWorkers } from '../../src/features/smart-defaults/parallelism-calculator.js';

describe('Smart Defaults', () => {
  describe('G. Validation Level Auto-Selection', () => {
    it('G1: selects "architect" for risk keywords', () => {
      const result = selectValidationType(2, true, false);
      expect(result).toBe('architect');
    });

    it('G2: selects "architect" for 7+ files without risk keywords', () => {
      const result = selectValidationType(7, false, false);
      expect(result).toBe('architect');
    });

    it('G3: selects "architect" for 10+ files', () => {
      const result = selectValidationType(10, false, false);
      expect(result).toBe('architect');
    });

    it('G4: selects "validator" for 3-6 files without risk keywords', () => {
      const result = selectValidationType(5, false, false);
      expect(result).toBe('validator');
    });

    it('G5: selects "validator" for exactly 6 files', () => {
      const result = selectValidationType(6, false, false);
      expect(result).toBe('validator');
    });

    it('G6: selects "self-only" for 1-2 files without risk keywords', () => {
      const result = selectValidationType(2, false, false);
      expect(result).toBe('self-only');
    });

    it('G7: selects "self-only" for speed keywords regardless of file count', () => {
      const result = selectValidationType(10, false, true);
      expect(result).toBe('self-only');
    });

    it('G8: prioritizes risk keywords over speed keywords', () => {
      const result = selectValidationType(2, true, true);
      expect(result).toBe('architect');
    });

    it('G9: selects "self-only" for 1 file', () => {
      const result = selectValidationType(1, false, false);
      expect(result).toBe('self-only');
    });

    it('G10: prioritizes risk keywords over file count', () => {
      const result = selectValidationType(1, true, false);
      expect(result).toBe('architect');
    });
  });

  describe('H. Team Template Auto-Selection', () => {
    it('H1: selects "secure" for security keywords', () => {
      const result = selectTeamTemplate('security audit', []);
      expect(result).toBe('secure');
    });

    it('H2: selects "secure" for auth keywords', () => {
      const result = selectTeamTemplate('implement authentication', ['oauth']);
      expect(result).toBe('secure');
    });

    it('H3: selects "bugfix" for bug keywords', () => {
      const result = selectTeamTemplate('fix bug in login', []);
      expect(result).toBe('bugfix');
    });

    it('H4: selects "bugfix" for Korean bug keywords', () => {
      const result = selectTeamTemplate('버그 수정', []);
      expect(result).toBe('bugfix');
    });

    it('H5: selects "refactoring" for refactor keywords', () => {
      const result = selectTeamTemplate('refactor the codebase', []);
      expect(result).toBe('refactoring');
    });

    it('H6: selects "refactoring" for Korean refactor keywords', () => {
      const result = selectTeamTemplate('리팩토링 작업', []);
      expect(result).toBe('refactoring');
    });

    it('H7: selects "fullstack" when both frontend and backend keywords present', () => {
      const result = selectTeamTemplate('build API and UI', ['react', 'express']);
      expect(result).toBe('fullstack');
    });

    it('H8: selects "frontend" for React UI work', () => {
      const result = selectTeamTemplate('create React components', ['react']);
      expect(result).toBe('frontend');
    });

    it('H9: selects "backend" for API work', () => {
      const result = selectTeamTemplate('server API development', ['express']);
      expect(result).toBe('backend');
    });

    it('H10: selects "standard" as default for general tasks', () => {
      const result = selectTeamTemplate('general implementation', []);
      expect(result).toBe('standard');
    });

    it('H11: prioritizes security over other templates', () => {
      const result = selectTeamTemplate('fix security bug in React', ['react']);
      expect(result).toBe('secure');
    });

    it('H12: prioritizes bug fix over refactoring', () => {
      const result = selectTeamTemplate('fix bug and refactor', []);
      expect(result).toBe('bugfix');
    });

    it('H13: detects frontend from CSS keywords', () => {
      const result = selectTeamTemplate('style the components', ['css']);
      expect(result).toBe('frontend');
    });

    it('H14: detects backend from database keywords', () => {
      const result = selectTeamTemplate('database migration', ['sql']);
      expect(result).toBe('backend');
    });

    it('H15: detects technologies from task type', () => {
      const result = selectTeamTemplate('build Vue application', []);
      expect(result).toBe('frontend');
    });
  });

  describe('I. Parallelism Auto-Selection', () => {
    it('I1: selects 1 worker for 1 file', () => {
      const result = calculateParallelWorkers(1);
      expect(result).toBe(1);
    });

    it('I2: selects 1 worker for 2 files', () => {
      const result = calculateParallelWorkers(2);
      expect(result).toBe(1);
    });

    it('I3: selects 2 workers for 3 files', () => {
      const result = calculateParallelWorkers(3);
      expect(result).toBe(2);
    });

    it('I4: selects 2 workers for 5 files', () => {
      const result = calculateParallelWorkers(5);
      expect(result).toBe(2);
    });

    it('I5: selects 3 workers for 6 files', () => {
      const result = calculateParallelWorkers(6);
      expect(result).toBe(3);
    });

    it('I6: selects 3 workers for 10 files', () => {
      const result = calculateParallelWorkers(10);
      expect(result).toBe(3);
    });

    it('I7: selects 5 workers (max) for 11 files', () => {
      const result = calculateParallelWorkers(11);
      expect(result).toBe(5);
    });

    it('I8: selects 5 workers (max) for 20 files', () => {
      const result = calculateParallelWorkers(20);
      expect(result).toBe(5);
    });

    it('I9: selects 5 workers (max) for 100 files', () => {
      const result = calculateParallelWorkers(100);
      expect(result).toBe(5);
    });

    it('I10: handles edge case of 0 files', () => {
      const result = calculateParallelWorkers(0);
      expect(result).toBe(1);
    });
  });

  describe('J. autoConfigureDefaults Integration', () => {
    it('J1: configures minimal validation for simple quick task', () => {
      const result = autoConfigureDefaults('빠르게 간단한 버튼 추가해줘', 1);
      expect(result.validationType).toBe('self-only');
      expect(result.parallelWorkers).toBe(1);
    });

    it('J2: configures architect validation for production deployment', () => {
      const result = autoConfigureDefaults('production deployment ready', 5);
      expect(result.validationType).toBe('architect');
      expect(result.enableOhmyblack).toBe(true);
    });

    it('J3: enables ohmyblack for 3+ files', () => {
      const result = autoConfigureDefaults('add new features', 3);
      expect(result.enableOhmyblack).toBe(true);
    });

    it('J4: enables ohmyblack for risk keywords', () => {
      const result = autoConfigureDefaults('중요한 프로덕션 기능', 1);
      expect(result.enableOhmyblack).toBe(true);
    });

    it('J5: disables ohmyblack for simple tasks', () => {
      const result = autoConfigureDefaults('quick fix', 1);
      expect(result.enableOhmyblack).toBe(false);
    });

    it('J6: selects appropriate team template for fullstack work', () => {
      const result = autoConfigureDefaults(
        'build API and React frontend',
        10,
        'fullstack',
        ['react', 'express']
      );
      expect(result.teamTemplate).toBe('fullstack');
      expect(result.parallelWorkers).toBe(3);
    });

    it('J7: increases workers for large file count', () => {
      const result = autoConfigureDefaults('refactor codebase', 15);
      expect(result.parallelWorkers).toBe(5);
    });

    it('J8: enables ohmyblack for high complexity score', () => {
      const result = autoConfigureDefaults(
        'refactor entire system architecture',
        8, // 7+ files triggers architect
        'architecture refactoring',
        ['microservices', 'kubernetes', 'database']
      );
      expect(result.enableOhmyblack).toBe(true);
      expect(result.validationType).toBe('architect');
    });

    it('J9: selects secure template for auth work', () => {
      const result = autoConfigureDefaults(
        'implement OAuth authentication',
        4,
        'security',
        ['oauth', 'jwt']
      );
      expect(result.teamTemplate).toBe('secure');
    });

    it('J10: overrides validation for speed keywords', () => {
      const result = autoConfigureDefaults('빠르게 10개 파일 수정', 10);
      expect(result.validationType).toBe('self-only');
    });
  });

  describe('K. Complexity Score Calculation', () => {
    it('K1: calculates high complexity for many files', () => {
      const result = autoConfigureDefaults('add features', 15);
      expect(result.enableOhmyblack).toBe(true);
    });

    it('K2: calculates high complexity for refactoring', () => {
      const result = autoConfigureDefaults(
        'refactor architecture',
        3,
        'architecture refactoring',
        []
      );
      expect(result.enableOhmyblack).toBe(true);
    });

    it('K3: calculates high complexity for multiple technologies', () => {
      const result = autoConfigureDefaults(
        'implement system',
        3,
        'implementation',
        ['react', 'node', 'postgres', 'redis']
      );
      expect(result.enableOhmyblack).toBe(true);
    });

    it('K4: calculates low complexity for single file, simple task', () => {
      const result = autoConfigureDefaults('add button', 1);
      expect(result.validationType).toBe('self-only');
      expect(result.enableOhmyblack).toBe(false);
    });
  });

  describe('L. Edge Cases', () => {
    it('L1: handles empty user input', () => {
      const result = autoConfigureDefaults('', 1);
      expect(result.validationType).toBe('self-only');
      expect(result.teamTemplate).toBe('standard');
    });

    it('L2: handles undefined technologies', () => {
      const result = autoConfigureDefaults('build app', 5);
      expect(result.teamTemplate).toBe('standard');
    });

    it('L3: handles very large file count', () => {
      const result = autoConfigureDefaults('massive refactor', 1000);
      expect(result.parallelWorkers).toBe(5); // Capped at max
      expect(result.enableOhmyblack).toBe(true);
    });

    it('L4: handles zero file count', () => {
      const result = autoConfigureDefaults('analysis only', 0);
      expect(result.parallelWorkers).toBe(1);
    });

    it('L5: handles conflicting keywords', () => {
      const result = autoConfigureDefaults('빠르게 프로덕션 배포', 5);
      // Risk keywords should override speed keywords
      expect(result.validationType).toBe('architect');
    });
  });
});
