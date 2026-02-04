/**
 * Progress Streaming Module
 * Provides real-time progress event streaming for ohmyblack system
 */

import { appendFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import type { AgentOutput } from '../agent-output/index.js';
import type {
  ProgressEvent,
  ProgressEventType,
  ProgressEventData,
  ProgressStreamConfig,
} from './types.js';

export * from './types.js';

/**
 * Creates a unique event ID using UUID v4
 */
export function createEventId(): string {
  return randomUUID();
}

/**
 * Format event for console output with color coding
 */
export function formatEventForConsole(event: ProgressEvent): string {
  const timestamp = new Date(event.timestamp).toISOString();
  const source = event.source.agentId || event.source.taskId || event.source.sessionId;
  const progress = event.data.progress !== undefined ? ` [${event.data.progress}%]` : '';

  return `[${timestamp}] ${event.type} (${source})${progress}: ${event.data.message}`;
}

/**
 * Format event as JSON Lines output (single line JSON)
 */
export function formatEventAsJsonLine(event: ProgressEvent): string {
  return JSON.stringify(event) + '\n';
}

/**
 * Parse JSON Lines file into events
 */
export function parseProgressLog(content: string): ProgressEvent[] {
  const events: ProgressEvent[] = [];
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as ProgressEvent;
      events.push(event);
    } catch (error) {
      console.warn('Failed to parse progress log line:', line);
    }
  }

  return events;
}

/**
 * Progress Stream Implementation
 * Manages buffered streaming of progress events to file and/or callback
 */
export class ProgressStream {
  private config: ProgressStreamConfig;
  private buffer: ProgressEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private closed = false;
  private sessionId: string;

  constructor(config: ProgressStreamConfig) {
    this.config = {
      bufferSize: 10,
      flushInterval: 1000,
      includeDebug: false,
      ...config,
    };

    this.sessionId = createEventId();

    // Start auto-flush timer if configured
    if (this.config.flushInterval && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        void this.flush().catch(err => {
          console.error('Auto-flush failed:', err);
        });
      }, this.config.flushInterval);
    }
  }

  /**
   * Emit a progress event
   */
  emit(event: Omit<ProgressEvent, 'id' | 'timestamp'>): void {
    if (this.closed) {
      console.warn('Cannot emit event on closed stream');
      return;
    }

    const fullEvent: ProgressEvent = {
      id: createEventId(),
      timestamp: Date.now(),
      ...event,
      source: {
        ...event.source,
        sessionId: this.sessionId,
      },
    };

    // Call callback immediately if provided
    if (this.config.onEvent) {
      try {
        this.config.onEvent(fullEvent);
      } catch (error) {
        console.error('Event callback failed:', error);
      }
    }

    // Buffer event for file writing
    if (this.config.filePath) {
      this.buffer.push(fullEvent);

      // Auto-flush if buffer is full
      if (this.buffer.length >= (this.config.bufferSize || 10)) {
        void this.flush().catch(err => {
          console.error('Buffer flush failed:', err);
        });
      }
    }
  }

  /**
   * Task started
   */
  taskStarted(taskId: string, agentId: string, message: string): void {
    this.emit({
      type: 'task_started',
      source: { taskId, agentId, sessionId: this.sessionId },
      data: { message, progress: 0 },
    });
  }

  /**
   * Task progress update
   */
  taskProgress(taskId: string, progress: number, message: string): void {
    this.emit({
      type: 'task_progress',
      source: { taskId, sessionId: this.sessionId },
      data: { message, progress: Math.min(100, Math.max(0, progress)) },
    });
  }

  /**
   * Task completed successfully
   */
  taskCompleted(taskId: string, message: string, evidence?: unknown[]): void {
    this.emit({
      type: 'task_completed',
      source: { taskId, sessionId: this.sessionId },
      data: {
        message,
        progress: 100,
        details: evidence ? { evidenceCount: evidence.length } : undefined,
      },
    });
  }

  /**
   * Task failed
   */
  taskFailed(taskId: string, error: string): void {
    this.emit({
      type: 'task_failed',
      source: { taskId, sessionId: this.sessionId },
      data: { message: error },
    });
  }

  /**
   * Validation started
   */
  validationStarted(taskId: string, validationType: string): void {
    this.emit({
      type: 'validation_started',
      source: { taskId, sessionId: this.sessionId },
      data: { message: `Starting ${validationType} validation`, details: { validationType } },
    });
  }

  /**
   * Validation passed
   */
  validationPassed(taskId: string, evidence: unknown[]): void {
    this.emit({
      type: 'validation_passed',
      source: { taskId, sessionId: this.sessionId },
      data: {
        message: 'Validation passed',
        details: { evidenceCount: evidence.length },
      },
    });
  }

  /**
   * Validation failed
   */
  validationFailed(taskId: string, issues: string[]): void {
    this.emit({
      type: 'validation_failed',
      source: { taskId, sessionId: this.sessionId },
      data: {
        message: `Validation failed with ${issues.length} issue(s)`,
        details: { issues },
      },
    });
  }

  /**
   * Agent spawned
   */
  agentSpawned(agentId: string, agentType: string, taskId?: string): void {
    this.emit({
      type: 'agent_spawned',
      source: { agentId, taskId, sessionId: this.sessionId },
      data: { message: `Agent spawned: ${agentType}`, details: { agentType } },
    });
  }

  /**
   * Agent completed
   */
  agentCompleted(agentId: string, status: string): void {
    this.emit({
      type: 'agent_completed',
      source: { agentId, sessionId: this.sessionId },
      data: { message: `Agent completed with status: ${status}`, details: { status } },
    });
  }

  /**
   * Info message
   */
  info(message: string, details?: Record<string, unknown>): void {
    this.emit({
      type: 'info',
      source: { sessionId: this.sessionId },
      data: { message, details },
    });
  }

  /**
   * Warning message
   */
  warning(message: string, details?: Record<string, unknown>): void {
    this.emit({
      type: 'warning',
      source: { sessionId: this.sessionId },
      data: { message, details },
    });
  }

  /**
   * Error message
   */
  error(message: string, error?: Error): void {
    this.emit({
      type: 'error',
      source: { sessionId: this.sessionId },
      data: {
        message,
        details: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
    });
  }

  /**
   * Flush buffer to destination
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.filePath) {
      return;
    }

    const eventsToWrite = [...this.buffer];
    this.buffer = [];

    try {
      const lines = eventsToWrite.map(formatEventAsJsonLine).join('');
      await appendFile(this.config.filePath, lines, 'utf-8');
    } catch (error) {
      // Restore buffer on failure
      this.buffer = [...eventsToWrite, ...this.buffer];
      throw error;
    }
  }

  /**
   * Close stream and cleanup
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Clear auto-flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining buffer
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * Get all buffered events (for testing)
   */
  getEvents(): ProgressEvent[] {
    return [...this.buffer];
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

/**
 * Create a file-based progress stream
 */
export function createFileProgressStream(
  filePath: string,
  options?: Partial<ProgressStreamConfig>
): ProgressStream {
  return new ProgressStream({
    ...options,
    filePath,
  });
}

/**
 * Create a callback-based progress stream
 */
export function createCallbackProgressStream(
  onEvent: (event: ProgressEvent) => void
): ProgressStream {
  return new ProgressStream({
    onEvent,
  });
}

/**
 * Convert AgentOutput to progress events
 * Useful for converting agent outputs to streaming format
 */
export function fromAgentOutput(output: AgentOutput): ProgressEvent[] {
  const events: ProgressEvent[] = [];
  const sessionId = createEventId();

  // Task started event
  events.push({
    id: createEventId(),
    type: 'task_started',
    timestamp: output.timestamp - 1000, // Approximate start time
    source: {
      agentId: output.agentId,
      taskId: output.taskId,
      sessionId,
    },
    data: {
      message: 'Task started',
      progress: 0,
    },
  });

  // Self-validation events if present
  if (output.selfValidation) {
    events.push({
      id: createEventId(),
      type: 'validation_started',
      timestamp: output.timestamp - 500,
      source: {
        agentId: output.agentId,
        taskId: output.taskId,
        sessionId,
      },
      data: {
        message: 'Self-validation started',
        details: { retryCount: output.selfValidation.retryCount },
      },
    });

    events.push({
      id: createEventId(),
      type: output.selfValidation.passed ? 'validation_passed' : 'validation_failed',
      timestamp: output.timestamp - 100,
      source: {
        agentId: output.agentId,
        taskId: output.taskId,
        sessionId,
      },
      data: {
        message: output.selfValidation.passed ? 'Self-validation passed' : 'Self-validation failed',
        details: output.selfValidation.lastError ? { error: output.selfValidation.lastError } : undefined,
      },
    });
  }

  // Task completion event
  const statusEventType: ProgressEventType =
    output.status === 'success' ? 'task_completed' : 'task_failed';

  events.push({
    id: createEventId(),
    type: statusEventType,
    timestamp: output.timestamp,
    source: {
      agentId: output.agentId,
      taskId: output.taskId,
      sessionId,
    },
    data: {
      message: output.summary,
      progress: output.status === 'success' ? 100 : undefined,
      details: {
        status: output.status,
        evidenceCount: output.evidence.length,
        filesModified: output.filesModified?.length,
      },
    },
  });

  return events;
}
