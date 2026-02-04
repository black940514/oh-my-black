/**
 * Smart parallel workers calculator based on estimated file count
 *
 * Rules:
 * - 1-2 files → 1 worker (sequential)
 * - 3-5 files → 2 workers
 * - 6-10 files → 3 workers
 * - 11+ files → 5 workers (max)
 */
export function calculateParallelWorkers(estimatedFiles: number): number {
  if (estimatedFiles <= 2) return 1;
  if (estimatedFiles <= 5) return 2;
  if (estimatedFiles <= 10) return 3;
  return 5; // Max workers
}
