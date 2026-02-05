/**
 * Registry Checker
 *
 * Verifies that skills, agents, and hooks are properly registered in their
 * respective registries. Detects missing registrations that would prevent
 * features from being discovered at runtime.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { WiringIssue } from '../types.js';

/**
 * Extract skill names from skills directory
 *
 * @param skillsDir Path to skills directory
 * @returns Array of skill names
 */
export function extractSkillNames(skillsDir: string): string[] {
  const skills: string[] = [];

  try {
    if (!fs.existsSync(skillsDir)) {
      return skills;
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if directory has a skill.md or index.ts
        const skillPath = path.join(skillsDir, entry.name);
        const hasSkillMd = fs.existsSync(path.join(skillPath, 'skill.md'));
        const hasIndexTs = fs.existsSync(path.join(skillPath, 'index.ts'));

        if (hasSkillMd || hasIndexTs) {
          skills.push(entry.name);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to extract skills from ${skillsDir}:`, error);
  }

  return skills;
}

/**
 * Extract agent names from agents directory
 *
 * @param agentsDir Path to agents directory
 * @returns Array of agent names
 */
export function extractAgentNames(agentsDir: string): string[] {
  const agents: string[] = [];

  try {
    if (!fs.existsSync(agentsDir)) {
      return agents;
    }

    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if directory has an index.ts or config file
        const agentPath = path.join(agentsDir, entry.name);
        const hasIndexTs = fs.existsSync(path.join(agentPath, 'index.ts'));
        const hasConfigJson = fs.existsSync(path.join(agentPath, 'config.json'));

        if (hasIndexTs || hasConfigJson) {
          agents.push(entry.name);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to extract agents from ${agentsDir}:`, error);
  }

  return agents;
}

/**
 * Check if a name is registered in a registry file
 *
 * @param registryPath Path to registry file
 * @param name Name to check for
 * @returns True if name is registered
 */
export function isRegistered(registryPath: string, name: string): boolean {
  try {
    if (!fs.existsSync(registryPath)) {
      return false;
    }

    const content = fs.readFileSync(registryPath, 'utf-8');

    // Check for string literal (quotes)
    const quotedPattern = new RegExp(`['"\`]${name}['"\`]`, 'g');
    if (quotedPattern.test(content)) {
      return true;
    }

    // Check for import/export statement
    const importExportPattern = new RegExp(`\\b${name}\\b`, 'g');
    if (importExportPattern.test(content)) {
      return true;
    }
  } catch (error) {
    console.warn(`Failed to check registry ${registryPath}:`, error);
  }

  return false;
}

/**
 * Check skill registry consistency
 *
 * @param projectRoot Project root directory
 * @returns Array of wiring issues
 */
export function checkSkillRegistry(projectRoot: string): WiringIssue[] {
  const issues: WiringIssue[] = [];
  const skillsDir = path.join(projectRoot, 'skills');
  const registryPath = path.join(projectRoot, 'src', 'skills', 'registry.ts');

  // Extract skill names
  const skills = extractSkillNames(skillsDir);

  // Check each skill is registered
  for (const skill of skills) {
    if (!isRegistered(registryPath, skill)) {
      issues.push({
        type: 'registry_missing',
        severity: 'error',
        file: registryPath,
        message: `Skill '${skill}' not registered in skill registry`,
        suggestion: `Add '${skill}' to ${registryPath}`,
      });
    }
  }

  return issues;
}

/**
 * Check agent registry consistency
 *
 * @param projectRoot Project root directory
 * @returns Array of wiring issues
 */
export function checkAgentRegistry(projectRoot: string): WiringIssue[] {
  const issues: WiringIssue[] = [];
  const agentsDir = path.join(projectRoot, 'src', 'agents');
  const registryPath = path.join(projectRoot, 'src', 'agents', 'registry.ts');

  // Extract agent names
  const agents = extractAgentNames(agentsDir);

  // Check each agent is registered
  for (const agent of agents) {
    if (!isRegistered(registryPath, agent)) {
      issues.push({
        type: 'registry_missing',
        severity: 'error',
        file: registryPath,
        message: `Agent '${agent}' not registered in agent registry`,
        suggestion: `Add '${agent}' to ${registryPath}`,
      });
    }
  }

  return issues;
}

/**
 * Check hook registry consistency
 *
 * @param projectRoot Project root directory
 * @returns Array of wiring issues
 */
export function checkHookRegistry(projectRoot: string): WiringIssue[] {
  const issues: WiringIssue[] = [];
  const hooksDir = path.join(projectRoot, 'src', 'hooks');
  const registryPath = path.join(projectRoot, 'src', 'hooks', 'registry.ts');

  try {
    if (!fs.existsSync(hooksDir)) {
      return issues;
    }

    // Find all hook files
    const hookFiles = fs.readdirSync(hooksDir)
      .filter(f => f.endsWith('.ts') && f !== 'registry.ts' && f !== 'index.ts')
      .map(f => f.replace('.ts', ''));

    // Check each hook is registered
    for (const hook of hookFiles) {
      if (!isRegistered(registryPath, hook)) {
        issues.push({
          type: 'registry_missing',
          severity: 'warning',
          file: registryPath,
          message: `Hook '${hook}' not registered in hook registry`,
          suggestion: `Add '${hook}' to ${registryPath}`,
        });
      }
    }
  } catch (error) {
    console.warn(`Failed to check hook registry:`, error);
  }

  return issues;
}

/**
 * Check all registries for consistency
 *
 * @param projectRoot Project root directory
 * @returns Array of all registry issues
 */
export function checkRegistries(projectRoot: string): WiringIssue[] {
  return [
    ...checkSkillRegistry(projectRoot),
    ...checkAgentRegistry(projectRoot),
    ...checkHookRegistry(projectRoot),
  ];
}
