/**
 * Smart validation type selector based on file count and risk keywords
 *
 * Rules (B-V cycle enabled by default):
 * - Risk keywords (production, deploy, critical) → architect
 * - Speed keywords (quick, fast, simple) → self-only (opt-out)
 * - 1-6 files → validator (B-V cycle default)
 * - 7+ files → architect (high complexity)
 */
export function selectValidationType(
  fileCount: number,
  riskKeywords: boolean,
  speedKeywords: boolean
): 'self-only' | 'validator' | 'architect' {
  // Risk keywords always → architect
  if (riskKeywords) return 'architect';

  // Speed keywords → self-only (explicit opt-out from B-V)
  if (speedKeywords) return 'self-only';

  // File count based (B-V enabled by default):
  // 1-6 files → validator (B-V cycle)
  // 7+ files → architect (high complexity)
  if (fileCount >= 7) return 'architect';
  return 'validator';
}
