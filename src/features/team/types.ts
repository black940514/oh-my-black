/**
 * Team definition types
 */

/**
 * Team member roles
 */
export type TeamRole =
  | 'orchestrator'
  | 'coordinator'
  | 'builder'
  | 'validator'
  | 'specialist';

/**
 * Agent capability categories
 */
export type AgentCapability =
  | 'code_modification'
  | 'code_review'
  | 'testing'
  | 'security_analysis'
  | 'documentation'
  | 'exploration'
  | 'planning'
  | 'design';

/**
 * Team member definition
 */
export interface TeamMember {
  /** Unique member ID */
  id: string;
  /** Agent type (e.g., 'executor', 'validator-logic') */
  agentType: string;
  /** Role in the team */
  role: TeamRole;
  /** Model tier to use */
  modelTier: 'low' | 'medium' | 'high';
  /** Agent capabilities */
  capabilities: AgentCapability[];
  /** Maximum concurrent tasks */
  maxConcurrentTasks: number;
  /** Current status */
  status: 'idle' | 'busy' | 'blocked' | 'offline';
  /** Currently assigned task IDs */
  assignedTasks: string[];
}

/**
 * Team definition
 */
export interface TeamDefinition {
  /** Unique team ID */
  id: string;
  /** Team name */
  name: string;
  /** Team purpose/description */
  description: string;
  /** Team members */
  members: TeamMember[];
  /** Default validation type for this team */
  defaultValidationType: 'self-only' | 'validator' | 'architect';
  /** Team configuration */
  config: TeamConfig;
}

/**
 * Team configuration
 */
export interface TeamConfig {
  /** Maximum retry attempts per task */
  maxRetries: number;
  /** Timeout per task in milliseconds */
  taskTimeout: number;
  /** Whether to run tasks in parallel */
  parallelExecution: boolean;
  /** Maximum parallel tasks */
  maxParallelTasks: number;
  /** Escalation policy */
  escalationPolicy: EscalationPolicy;
}

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  /** When to escalate to coordinator */
  coordinatorThreshold: number;  // retry attempts
  /** When to escalate to architect */
  architectThreshold: number;
  /** When to escalate to human */
  humanThreshold: number;
  /** Auto-escalate on security issues */
  autoEscalateOnSecurity: boolean;
}

/**
 * Pre-defined team templates
 */
export type TeamTemplate =
  | 'minimal'      // 1 builder, self-validation only
  | 'standard'     // 1 builder, 1 validator
  | 'robust'       // 1 builder, 2 validators (syntax + logic)
  | 'secure'       // 1 builder, 3 validators (syntax + logic + security)
  | 'fullstack';   // Multiple builders, full validation suite

/**
 * Task assignment
 */
export interface TaskAssignment {
  taskId: string;
  memberId: string;
  assignedAt: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: unknown;
}
