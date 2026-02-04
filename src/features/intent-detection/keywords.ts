// Korean keywords for each mode
export const KOREAN_KEYWORDS = {
  autopilot: ['해줘', '만들어', '구현해', '추가해', '수정해', '고쳐줘', '작성해'],
  ralplan: ['계획', '어떻게', '방법', '전략', '접근'],
  ultrapilot: ['빨리', '급해', '병렬', '동시에', '빠르게'],
  ralph: ['끝까지', '완료', '멈추지', '다될때까지', '포기하지마'],
  quality: ['프로덕션', '중요', '꼼꼼', '확실', '검증', '보안', '결제', '인증'],
  speed: ['빠르게', '간단히', '대충', '급히']
};

// English keywords for each mode
export const ENGLISH_KEYWORDS = {
  autopilot: ['do', 'build', 'create', 'implement', 'add', 'fix', 'make'],
  ralplan: ['plan', 'how', 'strategy', 'approach', 'should'],
  ultrapilot: ['fast', 'quick', 'parallel', 'urgent', 'asap', 'concurrent'],
  ralph: ['complete', 'dont stop', 'until done', 'finish', 'keep going'],
  quality: ['production', 'important', 'thorough', 'verify', 'security', 'payment', 'auth'],
  speed: ['quickly', 'simple', 'just', 'basic']
};

/**
 * Detect quality-related keywords that suggest need for architect validation
 */
export function detectQualityKeywords(input: string): boolean {
  const lowerInput = input.toLowerCase();

  // Check English keywords
  const hasEnglishQuality = ENGLISH_KEYWORDS.quality.some(kw =>
    lowerInput.includes(kw.toLowerCase())
  );

  // Check Korean keywords
  const hasKoreanQuality = KOREAN_KEYWORDS.quality.some(kw =>
    lowerInput.includes(kw)
  );

  return hasEnglishQuality || hasKoreanQuality;
}

/**
 * Detect speed-related keywords that suggest self-validation is sufficient
 */
export function detectSpeedKeywords(input: string): boolean {
  const lowerInput = input.toLowerCase();

  // Check English keywords
  const hasEnglishSpeed = ENGLISH_KEYWORDS.speed.some(kw =>
    lowerInput.includes(kw.toLowerCase())
  );

  // Check Korean keywords
  const hasKoreanSpeed = KOREAN_KEYWORDS.speed.some(kw =>
    lowerInput.includes(kw)
  );

  return hasEnglishSpeed || hasKoreanSpeed;
}

/**
 * Detect architect-specific keywords that require architect validation
 */
export function detectArchitectKeywords(input: string): boolean {
  const architectKeywords = [
    'architect', 'architecture', 'design', 'refactor', 'optimize',
    '아키텍처', '설계', '구조', '리팩토링', '최적화'
  ];

  const lowerInput = input.toLowerCase();

  return architectKeywords.some(kw =>
    lowerInput.includes(kw.toLowerCase())
  );
}
