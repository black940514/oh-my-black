export type ProgressEventType =
  | 'task_started'
  | 'task_progress'
  | 'task_completed'
  | 'task_failed'
  | 'validation_started'
  | 'validation_passed'
  | 'validation_failed'
  | 'agent_spawned'
  | 'agent_completed'
  | 'cycle_started'
  | 'cycle_completed'
  | 'error'
  | 'warning'
  | 'info';

export interface ProgressEvent {
  id: string;
  type: ProgressEventType;
  timestamp: number;
  source: {
    agentId?: string;
    taskId?: string;
    sessionId: string;
  };
  data: ProgressEventData;
  metadata?: Record<string, unknown>;
}

export interface ProgressEventData {
  message: string;
  progress?: number;  // 0-100
  details?: Record<string, unknown>;
}

export interface ProgressStreamConfig {
  /** Stream to file */
  filePath?: string;
  /** Stream to callback */
  onEvent?: (event: ProgressEvent) => void;
  /** Buffer events before flushing */
  bufferSize?: number;
  /** Auto-flush interval in ms */
  flushInterval?: number;
  /** Include debug events */
  includeDebug?: boolean;
}
