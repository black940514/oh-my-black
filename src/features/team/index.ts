/**
 * Team definition utilities
 */

import type {
  TeamDefinition,
  TeamMember,
  TeamTemplate,
  TeamConfig,
  TeamRole,
  AgentCapability,
  TaskAssignment,
  EscalationPolicy
} from './types.js';

// Re-export types
export * from './types.js';

// Re-export workflow module
export * from './workflow.js';

// Re-export executor module
export * from './executor.js';

// Re-export auto-composer module
export * from './auto-composer.js';

/**
 * Default escalation policy
 */
export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  coordinatorThreshold: 2,
  architectThreshold: 3,
  humanThreshold: 5,
  autoEscalateOnSecurity: true
};

/**
 * Default team configuration
 */
export const DEFAULT_TEAM_CONFIG: TeamConfig = {
  maxRetries: 3,
  taskTimeout: 300000, // 5 minutes
  parallelExecution: true,
  maxParallelTasks: 3,
  escalationPolicy: DEFAULT_ESCALATION_POLICY
};

/**
 * Agent type to capability mapping
 */
const AGENT_CAPABILITIES: Record<string, AgentCapability[]> = {
  'executor': ['code_modification', 'exploration'],
  'executor-low': ['code_modification'],
  'executor-high': ['code_modification', 'exploration'],
  'validator-syntax': ['code_review', 'testing'],
  'validator-logic': ['code_review', 'testing'],
  'validator-security': ['code_review', 'security_analysis'],
  'validator-integration': ['code_review', 'testing'],
  'architect': ['exploration', 'planning', 'code_review'],
  'designer': ['design', 'code_modification'],
  'writer': ['documentation'],
  'security-reviewer': ['security_analysis', 'code_review'],
  'explore': ['exploration'],
  'qa-tester': ['testing', 'code_review']
};

/**
 * Agent type to model tier mapping
 */
const AGENT_MODEL_TIERS: Record<string, 'low' | 'medium' | 'high'> = {
  'executor-low': 'low',
  'executor': 'medium',
  'executor-high': 'high',
  'validator-syntax': 'low',
  'validator-logic': 'medium',
  'validator-security': 'high',
  'validator-integration': 'medium',
  'architect': 'high',
  'designer': 'medium',
  'designer-high': 'high',
  'writer': 'low',
  'security-reviewer': 'high',
  'security-reviewer-low': 'low',
  'explore': 'low',
  'explore-medium': 'medium',
  'explore-high': 'high',
  'qa-tester': 'medium',
  'qa-tester-high': 'high'
};

/**
 * Get default capabilities for agent type
 */
export function getDefaultCapabilities(agentType: string): AgentCapability[] {
  // Try exact match first
  if (AGENT_CAPABILITIES[agentType]) {
    return [...AGENT_CAPABILITIES[agentType]];
  }

  // Try base type without suffix
  const baseType = agentType.replace(/-(low|medium|high)$/, '');
  if (AGENT_CAPABILITIES[baseType]) {
    return [...AGENT_CAPABILITIES[baseType]];
  }

  // Default fallback
  return ['code_modification'];
}

/**
 * Get recommended model tier for agent type
 */
export function getRecommendedModelTier(agentType: string): 'low' | 'medium' | 'high' {
  return AGENT_MODEL_TIERS[agentType] || 'medium';
}

/**
 * Create a team member
 */
export function createTeamMember(
  id: string,
  agentType: string,
  role: TeamRole,
  options?: {
    modelTier?: 'low' | 'medium' | 'high';
    capabilities?: AgentCapability[];
    maxConcurrentTasks?: number;
  }
): TeamMember {
  return {
    id,
    agentType,
    role,
    modelTier: options?.modelTier || getRecommendedModelTier(agentType),
    capabilities: options?.capabilities || getDefaultCapabilities(agentType),
    maxConcurrentTasks: options?.maxConcurrentTasks || 1,
    status: 'idle',
    assignedTasks: []
  };
}

/**
 * Create a custom team
 */
export function createTeam(
  id: string,
  name: string,
  description: string,
  members: TeamMember[],
  config?: Partial<TeamConfig>
): TeamDefinition {
  // Determine default validation type based on team composition
  let defaultValidationType: 'self-only' | 'validator' | 'architect' = 'self-only';

  const hasValidator = members.some(m => m.role === 'validator');
  const hasArchitect = members.some(m => m.agentType === 'architect');

  if (hasArchitect) {
    defaultValidationType = 'architect';
  } else if (hasValidator) {
    defaultValidationType = 'validator';
  }

  return {
    id,
    name,
    description,
    members,
    defaultValidationType,
    config: { ...DEFAULT_TEAM_CONFIG, ...config }
  };
}

/**
 * Create a team from template
 */
export function createTeamFromTemplate(
  template: TeamTemplate,
  teamId: string,
  teamName: string
): TeamDefinition {
  const members: TeamMember[] = [];
  let description = '';
  let defaultValidationType: 'self-only' | 'validator' | 'architect' = 'self-only';
  const configOverrides: Partial<TeamConfig> = {};

  switch (template) {
    case 'minimal':
      description = 'Minimal team with single builder and basic validation';
      members.push(
        createTeamMember('builder-1', 'executor-low', 'builder'),
        createTeamMember('validator-1', 'validator-syntax', 'validator')
      );
      defaultValidationType = 'validator';  // B-V cycle enabled by default
      configOverrides.maxParallelTasks = 1;
      break;

    case 'standard':
      description = 'Standard team with builder and syntax validator';
      members.push(
        createTeamMember('builder-1', 'executor', 'builder'),
        createTeamMember('validator-1', 'validator-syntax', 'validator')
      );
      defaultValidationType = 'validator';
      configOverrides.maxParallelTasks = 2;
      break;

    case 'robust':
      description = 'Robust team with builder and dual validators (syntax + logic)';
      members.push(
        createTeamMember('builder-1', 'executor', 'builder'),
        createTeamMember('validator-1', 'validator-syntax', 'validator'),
        createTeamMember('validator-2', 'validator-logic', 'validator')
      );
      defaultValidationType = 'validator';
      configOverrides.maxParallelTasks = 3;
      break;

    case 'secure':
      description = 'Secure team with builder and triple validators (syntax + logic + security)';
      members.push(
        createTeamMember('builder-1', 'executor-high', 'builder'),
        createTeamMember('validator-1', 'validator-syntax', 'validator'),
        createTeamMember('validator-2', 'validator-logic', 'validator'),
        createTeamMember('validator-3', 'validator-security', 'validator')
      );
      defaultValidationType = 'architect';
      configOverrides.maxParallelTasks = 4;
      configOverrides.escalationPolicy = {
        ...DEFAULT_ESCALATION_POLICY,
        autoEscalateOnSecurity: true
      };
      break;

    case 'fullstack':
      description = 'Full-stack team with multiple builders and comprehensive validation';
      members.push(
        createTeamMember('builder-1', 'executor', 'builder', { maxConcurrentTasks: 2 }),
        createTeamMember('builder-2', 'executor', 'builder', { maxConcurrentTasks: 2 }),
        createTeamMember('designer-1', 'designer', 'specialist'),
        createTeamMember('validator-1', 'validator-syntax', 'validator'),
        createTeamMember('validator-2', 'validator-logic', 'validator'),
        createTeamMember('validator-3', 'validator-integration', 'validator')
      );
      defaultValidationType = 'architect';
      configOverrides.maxParallelTasks = 5;
      break;

    default:
      throw new Error(`Unknown team template: ${template}`);
  }

  return {
    id: teamId,
    name: teamName,
    description,
    members,
    defaultValidationType,
    config: { ...DEFAULT_TEAM_CONFIG, ...configOverrides }
  };
}

/**
 * Find available member for a task
 */
export function findAvailableMember(
  team: TeamDefinition,
  requiredRole: TeamRole,
  requiredCapabilities?: AgentCapability[]
): TeamMember | null {
  const candidates = team.members.filter(member => {
    // Must match role
    if (member.role !== requiredRole) return false;

    // Must be available
    if (member.status !== 'idle' && member.status !== 'busy') return false;

    // Must not exceed concurrent task limit
    if (member.assignedTasks.length >= member.maxConcurrentTasks) return false;

    // Must have required capabilities (if specified)
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const hasAllCapabilities = requiredCapabilities.every(cap =>
        member.capabilities.includes(cap)
      );
      if (!hasAllCapabilities) return false;
    }

    return true;
  });

  // Sort by number of assigned tasks (prefer less busy members)
  candidates.sort((a, b) => a.assignedTasks.length - b.assignedTasks.length);

  return candidates[0] || null;
}

/**
 * Assign task to member
 */
export function assignTaskToMember(
  team: TeamDefinition,
  taskId: string,
  memberId: string
): TeamDefinition {
  const members = team.members.map(member => {
    if (member.id === memberId) {
      return {
        ...member,
        status: 'busy' as const,
        assignedTasks: [...member.assignedTasks, taskId]
      };
    }
    return member;
  });

  return {
    ...team,
    members
  };
}

/**
 * Release task from member
 */
export function releaseTaskFromMember(
  team: TeamDefinition,
  taskId: string,
  memberId: string
): TeamDefinition {
  const members = team.members.map(member => {
    if (member.id === memberId) {
      const assignedTasks = member.assignedTasks.filter(id => id !== taskId);
      return {
        ...member,
        status: assignedTasks.length === 0 ? ('idle' as const) : member.status,
        assignedTasks
      };
    }
    return member;
  });

  return {
    ...team,
    members
  };
}

/**
 * Get team status summary
 */
export function getTeamStatus(team: TeamDefinition): {
  totalMembers: number;
  idleMembers: number;
  busyMembers: number;
  totalAssignedTasks: number;
  memberStatuses: Array<{ id: string; status: string; tasks: number }>;
} {
  const idleMembers = team.members.filter(m => m.status === 'idle').length;
  const busyMembers = team.members.filter(m => m.status === 'busy').length;
  const totalAssignedTasks = team.members.reduce(
    (sum, m) => sum + m.assignedTasks.length,
    0
  );

  const memberStatuses = team.members.map(m => ({
    id: m.id,
    status: m.status,
    tasks: m.assignedTasks.length
  }));

  return {
    totalMembers: team.members.length,
    idleMembers,
    busyMembers,
    totalAssignedTasks,
    memberStatuses
  };
}

/**
 * Serialize team to JSON for storage
 */
export function serializeTeam(team: TeamDefinition): string {
  return JSON.stringify(team, null, 2);
}

/**
 * Parse team from JSON
 */
export function parseTeam(json: string): TeamDefinition | null {
  try {
    const parsed = JSON.parse(json);

    // Basic validation
    if (!parsed.id || !parsed.name || !parsed.members || !Array.isArray(parsed.members)) {
      return null;
    }

    return parsed as TeamDefinition;
  } catch {
    return null;
  }
}
