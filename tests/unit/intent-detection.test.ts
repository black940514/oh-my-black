import { describe, it, expect } from 'vitest';
import { detectIntent, detectModeFromKeywords } from '../../src/features/intent-detection/index.js';
import { detectQualityKeywords, detectSpeedKeywords } from '../../src/features/intent-detection/keywords.js';

describe('Intent Detection', () => {
  describe('A. Autopilot Mode Detection', () => {
    it('A1: detects autopilot from Korean "만들어줘"', () => {
      const result = detectIntent('로그인 기능 만들어줘');
      expect(result.mode).toBe('autopilot');
    });

    it('A2: detects autopilot from Korean "해줘"', () => {
      const result = detectIntent('회원가입 폼 구현해줘');
      expect(result.mode).toBe('autopilot');
    });

    it('A3: detects autopilot from Korean "추가해"', () => {
      const result = detectIntent('다크모드 추가해');
      expect(result.mode).toBe('autopilot');
    });

    it('A4: detects autopilot from Korean "고쳐줘"', () => {
      const result = detectIntent('버그 고쳐줘');
      expect(result.mode).toBe('autopilot');
    });

    it('A5: detects autopilot from English "build"', () => {
      const result = detectIntent('build a login system');
      expect(result.mode).toBe('autopilot');
    });

    it('A6: detects autopilot from English "create"', () => {
      const result = detectIntent('create a dashboard');
      expect(result.mode).toBe('autopilot');
    });

    it('A7: detects autopilot from English "implement"', () => {
      const result = detectIntent('implement user authentication');
      expect(result.mode).toBe('autopilot');
    });

    it('A8: detects autopilot from English "add"', () => {
      const result = detectIntent('add error handling');
      expect(result.mode).toBe('autopilot');
    });

    it('A9: detects autopilot from English "fix"', () => {
      const result = detectIntent('fix the broken tests');
      expect(result.mode).toBe('autopilot');
    });

    it('A10: detects autopilot from English "make"', () => {
      const result = detectIntent('make a contact form');
      expect(result.mode).toBe('autopilot');
    });

    it('A11: detects autopilot from mixed Korean and English', () => {
      const result = detectIntent('React 컴포넌트 만들어줘');
      expect(result.mode).toBe('autopilot');
    });

    it('A12: detects autopilot with high confidence for multiple keywords', () => {
      const result = detectIntent('build and create and implement a new API endpoint');
      expect(result.mode).toBe('autopilot');
      expect(result.confidence).toBe('high');
    });

    it('A13: includes matched keywords in result', () => {
      const result = detectIntent('build a new feature');
      expect(result.keywords).toContain('build');
    });

    it('A14: provides reasoning for autopilot detection', () => {
      const result = detectIntent('create a login page');
      expect(result.reasoning).toContain('autopilot');
    });

    it('A15: ignores keywords inside code blocks', () => {
      const result = detectIntent('Review this code: ```build()```');
      // Should not detect as autopilot since keyword is in code block
      expect(result.mode).not.toBe('autopilot');
    });
  });

  describe('B. Ralplan Mode Detection', () => {
    it('B1: detects ralplan from Korean "계획"', () => {
      const result = detectIntent('이 프로젝트 계획 세워줘');
      expect(result.mode).toBe('ralplan');
    });

    it('B2: detects ralplan from Korean "어떻게"', () => {
      const result = detectIntent('이 기능 어떻게 구현해야 할까?');
      expect(result.mode).toBe('ralplan');
    });

    it('B3: detects ralplan from Korean "방법"', () => {
      const result = detectIntent('리팩토링 방법 알려줘');
      expect(result.mode).toBe('ralplan');
    });

    it('B4: detects ralplan from Korean "전략"', () => {
      const result = detectIntent('마이그레이션 전략 수립해줘');
      expect(result.mode).toBe('ralplan');
    });

    it('B5: detects ralplan from English "plan"', () => {
      const result = detectIntent('plan the migration strategy');
      expect(result.mode).toBe('ralplan');
    });

    it('B6: detects ralplan from English "how"', () => {
      const result = detectIntent('how should I refactor this?');
      expect(result.mode).toBe('ralplan');
    });

    it('B7: detects ralplan from English "strategy"', () => {
      const result = detectIntent('what strategy should we use?');
      expect(result.mode).toBe('ralplan');
    });

    it('B8: detects ralplan from English "approach"', () => {
      const result = detectIntent('what approach is best?');
      expect(result.mode).toBe('ralplan');
    });

    it('B9: detects ralplan from English "should"', () => {
      const result = detectIntent('should I redesign the architecture?');
      expect(result.mode).toBe('ralplan');
    });

    it('B10: prioritizes ralplan over autopilot when both present', () => {
      const result = detectIntent('plan how to build this feature');
      expect(result.mode).toBe('ralplan');
    });
  });

  describe('C. Ultrapilot Mode Detection', () => {
    it('C1: detects ultrapilot from Korean "빨리"', () => {
      const result = detectIntent('빨리 구현해줘');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C2: detects ultrapilot from Korean "급해"', () => {
      const result = detectIntent('급해, 빨리 만들어줘');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C3: detects ultrapilot from Korean "병렬"', () => {
      const result = detectIntent('병렬로 처리해줘');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C4: detects ultrapilot from Korean "동시에"', () => {
      const result = detectIntent('동시에 여러 작업 실행해줘');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C5: detects ultrapilot from English "fast"', () => {
      const result = detectIntent('fast implementation needed');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C6: detects ultrapilot from English "quick"', () => {
      const result = detectIntent('quick fix please');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C7: detects ultrapilot from English "parallel"', () => {
      const result = detectIntent('run this in parallel');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C8: detects ultrapilot from English "urgent"', () => {
      const result = detectIntent('urgent: fix all errors');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C9: detects ultrapilot from English "asap"', () => {
      const result = detectIntent('need this asap');
      expect(result.mode).toBe('ultrapilot');
    });

    it('C10: detects ultrapilot from English "concurrent"', () => {
      const result = detectIntent('concurrent execution required');
      expect(result.mode).toBe('ultrapilot');
    });
  });

  describe('D. Ralph Mode Detection', () => {
    it('D1: detects ralph from Korean "끝까지"', () => {
      const result = detectIntent('끝까지 완료해줘');
      expect(result.mode).toBe('ralph');
    });

    it('D2: detects ralph from Korean "완료"', () => {
      const result = detectIntent('완료될 때까지 계속해줘');
      expect(result.mode).toBe('ralph');
    });

    it('D3: detects ralph from Korean "멈추지"', () => {
      const result = detectIntent('멈추지 말고 진행해줘');
      expect(result.mode).toBe('ralph');
    });

    it('D4: detects ralph from Korean "다될때까지"', () => {
      const result = detectIntent('다될때까지 계속');
      expect(result.mode).toBe('ralph');
    });

    it('D5: detects ralph from English "complete"', () => {
      const result = detectIntent('complete this task fully');
      expect(result.mode).toBe('ralph');
    });

    it('D6: detects ralph from English "dont stop"', () => {
      const result = detectIntent('dont stop until its done');
      expect(result.mode).toBe('ralph');
    });

    it('D7: detects ralph from English "until done"', () => {
      const result = detectIntent('work until done');
      expect(result.mode).toBe('ralph');
    });

    it('D8: detects ralph from English "finish"', () => {
      const result = detectIntent('finish this completely');
      expect(result.mode).toBe('ralph');
    });

    it('D9: detects ralph from English "keep going"', () => {
      const result = detectIntent('keep going until all tests pass');
      expect(result.mode).toBe('ralph');
    });

    it('D10: prioritizes ralph over ultrapilot when both present', () => {
      const result = detectIntent('complete this fast');
      expect(result.mode).toBe('ralph');
    });
  });

  describe('E. Validation Level Detection', () => {
    it('E1: detects architect level for Korean quality keywords', () => {
      const result = detectIntent('프로덕션 배포 준비해줘');
      expect(result.validationLevel).toBe('architect');
    });

    it('E2: detects architect level for Korean "중요"', () => {
      const result = detectIntent('중요한 기능이니 꼼꼼하게 해줘');
      expect(result.validationLevel).toBe('architect');
    });

    it('E3: detects architect level for Korean security keywords', () => {
      const result = detectIntent('보안 강화 작업 해줘');
      expect(result.validationLevel).toBe('architect');
    });

    it('E4: detects architect level for English "production"', () => {
      const result = detectIntent('production ready implementation');
      expect(result.validationLevel).toBe('architect');
    });

    it('E5: detects architect level for English "security"', () => {
      const result = detectIntent('security audit needed');
      expect(result.validationLevel).toBe('architect');
    });

    it('E6: detects architect level for architect keywords', () => {
      const result = detectIntent('refactor the architecture');
      expect(result.validationLevel).toBe('architect');
    });

    it('E7: detects self-only for Korean speed keywords', () => {
      const result = detectIntent('빠르게 간단히 해줘');
      expect(result.validationLevel).toBe('self-only');
    });

    it('E8: detects self-only for English speed keywords', () => {
      const result = detectIntent('quick and simple fix');
      expect(result.validationLevel).toBe('self-only');
    });

    it('E9: detects architect level for high complexity', () => {
      const result = detectIntent('refactor the entire system architecture and migrate to microservices');
      expect(result.validationLevel).toBe('architect');
    });

    it('E10: detects appropriate validation level based on complexity', () => {
      // Simpler tasks should get self-only or validator, not architect
      const result = detectIntent('add API endpoints, update components, integrate third party service');
      expect(['self-only', 'validator']).toContain(result.validationLevel);
    });
  });

  describe('F. Edge Cases & Conflict Resolution', () => {
    it('F1: handles empty input', () => {
      const result = detectIntent('');
      expect(result.mode).toBe('none');
    });

    it('F2: handles input with only whitespace', () => {
      const result = detectIntent('   \n\t  ');
      expect(result.mode).toBe('none');
    });

    it('F3: ignores keywords in code blocks with triple backticks', () => {
      const result = detectIntent('Review: ```function build() {}```');
      expect(result.keywords).not.toContain('build');
    });

    it('F4: ignores keywords in inline code', () => {
      const result = detectIntent('The `create` function is broken');
      // Should have lower confidence or different mode than "create a function"
      expect(result.confidence).not.toBe('high');
    });

    it('F5: prioritizes ralplan > ralph > ultrapilot > autopilot', () => {
      // Test with all keywords present
      const result = detectIntent('plan how to complete this fast build');
      // ralplan has highest priority
      expect(result.mode).toBe('ralplan');
    });
  });

  describe('G. detectModeFromKeywords function', () => {
    it('G1: returns "none" for no matches', () => {
      const mode = detectModeFromKeywords('just review this code');
      expect(mode).toBe('none');
    });

    it('G2: detects analyze mode for question words', () => {
      const mode = detectModeFromKeywords('why is this failing?');
      expect(mode).toBe('analyze');
    });

    it('G3: detects analyze mode for Korean question words', () => {
      const mode = detectModeFromKeywords('왜 안되지?');
      expect(mode).toBe('analyze');
    });

    it('G4: correctly prioritizes modes', () => {
      const mode = detectModeFromKeywords('plan to complete');
      expect(mode).toBe('ralplan');
    });
  });

  describe('H. detectQualityKeywords function', () => {
    it('H1: detects English quality keywords', () => {
      expect(detectQualityKeywords('production deployment')).toBe(true);
    });

    it('H2: detects Korean quality keywords', () => {
      expect(detectQualityKeywords('프로덕션 배포')).toBe(true);
    });

    it('H3: returns false for non-quality keywords', () => {
      expect(detectQualityKeywords('simple feature')).toBe(false);
    });
  });

  describe('I. detectSpeedKeywords function', () => {
    it('I1: detects English speed keywords', () => {
      expect(detectSpeedKeywords('quickly fix this')).toBe(true);
    });

    it('I2: detects Korean speed keywords', () => {
      expect(detectSpeedKeywords('빠르게 해줘')).toBe(true);
    });

    it('I3: returns false for non-speed keywords', () => {
      expect(detectSpeedKeywords('thorough review')).toBe(false);
    });
  });

  describe('J. Confidence Calculation', () => {
    it('J1: calculates high confidence for 3+ keyword matches', () => {
      const result = detectIntent('build and create and implement a feature');
      expect(result.confidence).toBe('high');
    });

    it('J2: calculates medium confidence for 2 keyword matches', () => {
      const result = detectIntent('build and create');
      expect(result.confidence).toBe('medium');
    });

    it('J3: calculates low confidence for 1 keyword match', () => {
      const result = detectIntent('just build it');
      expect(result.confidence).toBe('low');
    });
  });

  describe('K. Reasoning Output', () => {
    it('K1: includes mode in reasoning', () => {
      const result = detectIntent('build a feature');
      expect(result.reasoning).toContain('autopilot');
    });

    it('K2: includes matched keywords in reasoning', () => {
      const result = detectIntent('build a feature');
      expect(result.reasoning).toContain('build');
    });

    it('K3: includes complexity score in reasoning', () => {
      const result = detectIntent('refactor the system');
      expect(result.reasoning).toMatch(/Complexity score: \d+\.\d+/);
    });

    it('K4: includes risk level in reasoning', () => {
      const result = detectIntent('simple feature');
      expect(result.reasoning).toMatch(/(low|medium|high)/);
    });

    it('K5: includes estimated files in reasoning', () => {
      const result = detectIntent('add a feature');
      expect(result.reasoning).toMatch(/Estimated \d+ files/);
    });

    it('K6: suggests ralplan for complex tasks', () => {
      const result = detectIntent('refactor the entire system architecture and migrate databases');
      expect(result.reasoning).toContain('ralplan');
    });
  });
});
