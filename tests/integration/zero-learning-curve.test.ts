import { describe, it, expect } from 'vitest';
import { detectIntent } from '../../src/features/intent-detection/index.js';
import { autoConfigureDefaults } from '../../src/features/smart-defaults/index.js';

/**
 * Integration tests for Zero Learning Curve feature
 * Tests the full pipeline: user input → intent detection → smart defaults
 */
describe('Zero Learning Curve Integration', () => {
  describe('J. End-to-End Scenarios', () => {
    it('J1: Korean novice user - simple feature request', () => {
      const userInput = '로그인 버튼 만들어줘';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('autopilot');
      expect(intent.validationLevel).toBe('self-only');

      // Step 2: Auto-configure defaults
      const config = autoConfigureDefaults(userInput, intent.validationLevel === 'self-only' ? 1 : 3);
      expect(config.validationType).toBe('self-only');
      expect(config.parallelWorkers).toBe(1);
      expect(config.enableOhmyblack).toBe(false);
    });

    it('J2: English novice user - urgent parallel request', () => {
      const userInput = 'build a dashboard quickly, parallel execution';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('ultrapilot'); // Detects parallel keyword

      // Step 2: Auto-configure defaults
      const config = autoConfigureDefaults(userInput, 5, 'dashboard', ['react']);
      expect(config.teamTemplate).toBe('frontend');
      expect(config.parallelWorkers).toBe(2);
    });

    it('J3: Korean advanced user - production critical feature', () => {
      const userInput = '중요한 결제 시스템 구현해줘, 프로덕션 배포용';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('autopilot');
      expect(intent.validationLevel).toBe('architect'); // Quality keywords detected

      // Step 2: Auto-configure defaults
      const config = autoConfigureDefaults(userInput, 8, 'payment system', ['stripe', 'nodejs']);
      expect(config.validationType).toBe('architect');
      expect(config.enableOhmyblack).toBe(true);
      expect(config.parallelWorkers).toBe(3);
    });

    it('J4: Planning request for complex refactoring', () => {
      const userInput = '전체 시스템 리팩토링 어떻게 해야 할까?';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('ralplan'); // Planning mode
      expect(['low', 'medium', 'high']).toContain(intent.confidence);

      // Step 2: Auto-configure defaults
      const config = autoConfigureDefaults(userInput, 15, 'refactoring', ['microservices', 'api', 'database']);
      expect(config.validationType).toBe('architect');
      expect(config.teamTemplate).toBe('refactoring');
      expect(config.parallelWorkers).toBe(5); // Max workers for large refactor
      expect(config.enableOhmyblack).toBe(true);
    });

    it('J5: Persistence mode with quality requirements', () => {
      const userInput = 'complete this auth system thoroughly, dont stop until done';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('ralph'); // Persistence keywords
      expect(intent.validationLevel).toBe('architect'); // Auth = quality keyword

      // Step 2: Auto-configure defaults - use 7+ files for architect
      const config = autoConfigureDefaults(userInput, 8, 'authentication', ['oauth', 'jwt']);
      expect(config.teamTemplate).toBe('secure');
      expect(config.validationType).toBe('architect');
      expect(config.enableOhmyblack).toBe(true);
    });

    it('J6: Fullstack application from scratch', () => {
      const userInput = 'build a fullstack todo app with React and Express';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('autopilot');

      // Step 2: Auto-configure defaults
      const config = autoConfigureDefaults(userInput, 12, 'fullstack application', ['react', 'express', 'postgres']);
      expect(config.teamTemplate).toBe('fullstack');
      expect(config.parallelWorkers).toBe(5);
      expect(config.enableOhmyblack).toBe(true);
    });

    it('J7: Quick bug fix scenario', () => {
      const userInput = '빠르게 버그 고쳐줘';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('ultrapilot'); // Speed keyword
      expect(intent.validationLevel).toBe('self-only'); // Speed = self validation

      // Step 2: Auto-configure defaults
      const config = autoConfigureDefaults(userInput, 1, 'bugfix', []);
      expect(config.teamTemplate).toBe('bugfix');
      expect(config.validationType).toBe('self-only');
      expect(config.parallelWorkers).toBe(1);
      expect(config.enableOhmyblack).toBe(false);
    });

    it('J8: Security-sensitive feature with mixed keywords', () => {
      const userInput = 'implement OAuth authentication for production';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('autopilot');
      expect(intent.validationLevel).toBe('architect'); // Auth + production

      // Step 2: Auto-configure defaults
      const config = autoConfigureDefaults(userInput, 4, 'security authentication', ['oauth']);
      expect(config.teamTemplate).toBe('secure');
      expect(config.validationType).toBe('architect');
      expect(config.enableOhmyblack).toBe(true);
    });

    it('J9: Multi-stage planning and execution', () => {
      const userInput = '어떻게 마이그레이션 전략 세우고 빨리 실행할까?';

      // Step 1: Detect intent - should prioritize planning
      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('ralplan'); // Planning has priority over speed

      // Step 2: Auto-configure defaults
      const config = autoConfigureDefaults(userInput, 10, 'migration strategy', ['database', 'api']);
      expect(config.validationType).toBe('architect'); // Complex migration
      expect(config.parallelWorkers).toBe(3);
      expect(config.enableOhmyblack).toBe(true);
    });

    it('J10: Simple frontend component with low confidence', () => {
      const userInput = 'I need a button component';

      // Step 1: Detect intent
      const intent = detectIntent(userInput);
      // Might not detect strong mode due to low keyword match
      expect(['autopilot', 'none']).toContain(intent.mode);
      expect(intent.validationLevel).toBe('self-only');

      // Step 2: Auto-configure defaults - should still provide sensible defaults
      const config = autoConfigureDefaults(userInput, 1, 'frontend component', ['react']);
      expect(config.teamTemplate).toBe('frontend');
      expect(config.validationType).toBe('self-only');
      expect(config.parallelWorkers).toBe(1);
      expect(config.enableOhmyblack).toBe(false);
    });
  });

  describe('K. Conflict Resolution', () => {
    it('K1: resolves speed vs quality conflict (quality wins)', () => {
      const userInput = '빠르게 프로덕션용 결제 기능 만들어줘';

      const intent = detectIntent(userInput);
      // Speed keyword present but quality keywords should override
      expect(intent.validationLevel).toBe('architect');

      const config = autoConfigureDefaults(userInput, 5, 'payment', ['stripe']);
      expect(config.validationType).toBe('architect');
      expect(config.enableOhmyblack).toBe(true);
    });

    it('K2: resolves planning vs execution conflict (planning wins)', () => {
      const userInput = 'plan how to build this feature';

      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('ralplan'); // Planning has priority
    });

    it('K3: resolves persistence vs speed conflict (persistence wins)', () => {
      const userInput = 'complete this quickly until done';

      const intent = detectIntent(userInput);
      expect(intent.mode).toBe('ralph'); // Persistence has higher priority
    });
  });

  describe('L. Validation Integration', () => {
    it('L1: validates that architect validation is applied for high-risk tasks', () => {
      const inputs = [
        '프로덕션 배포 준비',
        'production deployment',
        'security audit',
        '보안 강화',
        'payment system',
      ];

      inputs.forEach(input => {
        const intent = detectIntent(input);
        expect(intent.validationLevel).toBe('architect');
      });
    });

    it('L2: validates that self-only validation is applied for quick tasks', () => {
      const inputs = [
        '빠르게 수정',
        'quick fix',
        'simple change',
        '간단히 추가',
      ];

      inputs.forEach(input => {
        const intent = detectIntent(input);
        expect(intent.validationLevel).toBe('self-only');
      });
    });
  });

  describe('M. Complexity-Based Decision Making', () => {
    it('M1: suggests appropriate settings for low complexity task', () => {
      const userInput = 'add a button';

      const intent = detectIntent(userInput);
      const config = autoConfigureDefaults(userInput, 1);

      expect(intent.validationLevel).toBe('self-only');
      expect(config.parallelWorkers).toBe(1);
      expect(config.enableOhmyblack).toBe(false);
    });

    it('M2: suggests appropriate settings for medium complexity task', () => {
      const userInput = 'add API endpoints and update docs';

      const intent = detectIntent(userInput);
      const config = autoConfigureDefaults(userInput, 5, 'api', ['express']);

      // Validation level could be any based on complexity detection
      expect(['self-only', 'validator', 'architect']).toContain(intent.validationLevel || '');
      expect(config.parallelWorkers).toBe(2);
      expect(config.enableOhmyblack).toBe(true);
    });

    it('M3: suggests appropriate settings for high complexity task', () => {
      const userInput = 'refactor the entire system architecture, migrate to microservices, and optimize performance';

      const intent = detectIntent(userInput);
      const config = autoConfigureDefaults(userInput, 20, 'architecture refactoring', ['microservices', 'kubernetes', 'api-gateway']);

      expect(intent.validationLevel).toBe('architect');
      expect(config.parallelWorkers).toBe(5);
      expect(config.enableOhmyblack).toBe(true);
      expect(config.teamTemplate).toBe('refactoring');
    });
  });

  describe('N. Team Template Selection Integration', () => {
    it('N1: selects appropriate template based on context', () => {
      const scenarios = [
        { input: 'bug fix needed', taskType: 'bugfix', expectedTemplate: 'bugfix' },
        { input: 'code refactoring', taskType: 'refactoring', expectedTemplate: 'refactoring' },
        { input: 'security feature', taskType: 'security OAuth', expectedTemplate: 'secure' },
        { input: 'UI work', taskType: 'React UI components', tech: ['react'], expectedTemplate: 'frontend' },
        { input: 'backend work', taskType: 'server backend', tech: ['express'], expectedTemplate: 'backend' },
        { input: 'fullstack', taskType: 'fullstack app', tech: ['react', 'express'], expectedTemplate: 'fullstack' },
      ];

      scenarios.forEach(scenario => {
        const config = autoConfigureDefaults(
          scenario.input,
          5,
          scenario.taskType,
          scenario.tech || []
        );
        expect(config.teamTemplate).toBe(scenario.expectedTemplate);
      });
    });
  });

  describe('O. Ohmyblack Auto-Enable Integration', () => {
    it('O1: enables ohmyblack for file count threshold', () => {
      const config = autoConfigureDefaults('add features', 3);
      expect(config.enableOhmyblack).toBe(true);
    });

    it('O2: enables ohmyblack for risk keywords', () => {
      const config = autoConfigureDefaults('중요한 기능', 1);
      expect(config.enableOhmyblack).toBe(true);
    });

    it('O3: enables ohmyblack for high complexity', () => {
      const config = autoConfigureDefaults(
        'refactor entire architecture',
        5,
        'architecture refactoring',
        ['microservices', 'api', 'database']
      );
      expect(config.enableOhmyblack).toBe(true);
    });

    it('O4: disables ohmyblack for simple, low-risk tasks', () => {
      const config = autoConfigureDefaults('add simple button', 1);
      expect(config.enableOhmyblack).toBe(false);
    });
  });

  describe('P. Reasoning Quality', () => {
    it('P1: provides clear reasoning for decisions', () => {
      const intent = detectIntent('build a production payment system');

      expect(intent.reasoning).toBeTruthy();
      expect(intent.reasoning).toContain('mode');
      expect(intent.reasoning).toContain('confidence');
      expect(intent.reasoning).toContain('Complexity');
    });

    it('P2: reasoning includes matched keywords', () => {
      const intent = detectIntent('build and create a feature');

      expect(intent.reasoning).toMatch(/(build|create)/);
    });

    it('P3: reasoning includes validation level recommendation', () => {
      const intent = detectIntent('production critical feature');

      expect(intent.reasoning).toContain('architect');
    });
  });
});
