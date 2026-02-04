/**
 * Smart validation type selector based on file count and risk keywords
 *
 * Rules:
 * - Risk keywords (production, deploy, critical) → architect
 * - Speed keywords (quick, fast, simple) → self-only
 * - 1-2 files → self-only
 * - 3-6 files → validator
 * - 7+ files → architect
 */
export function selectValidationType(
  fileCount: number,
  riskKeywords: boolean,
  speedKeywords: boolean
): 'self-only' | 'validator' | 'architect' {
  // Risk keywords always → architect
  if (riskKeywords) return 'architect';

  // Speed keywords → self-only
  if (speedKeywords) return 'self-only';

  // File count based:
  // 1-2 files → self-only
  // 3-6 files → validator
  // 7+ files → architect
  if (fileCount >= 7) return 'architect';
  if (fileCount >= 3) return 'validator';
  return 'self-only';
}
