/**
 * Types for B-V Spawner Hook
 */

export interface SpawnRequest {
  requestId: string;
  agentType: string;
  model: 'haiku' | 'sonnet' | 'opus';
  prompt: string;
  taskId: string;
  timeout: number;
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
}

export interface SpawnResponse {
  requestId: string;
  success: boolean;
  rawOutput?: string;
  parsedOutput?: {
    summary: string;
    changes: string[];
    evidence: string;
  };
  error?: string;
  completedAt: number;
  duration: number;
}

export type ModelTier = 'haiku' | 'sonnet' | 'opus';
