/**
 * Smart team template selector based on task type and technologies
 *
 * Detection rules:
 * - Frontend keywords: React, CSS, UI, component → frontend
 * - Backend keywords: API, database, server, Node → backend
 * - Both frontend and backend → fullstack
 * - Refactor keywords → refactoring
 * - Bug, fix keywords → bugfix
 * - Security keywords → secure
 */
export function selectTeamTemplate(
  taskType: string,
  technologies: string[]
): 'minimal' | 'standard' | 'robust' | 'secure' | 'fullstack' | 'frontend' | 'backend' | 'bugfix' | 'refactoring' {
  const taskLower = taskType.toLowerCase();
  const techSet = new Set(technologies.map(t => t.toLowerCase()));

  // Security keywords
  const securityKeywords = ['security', 'auth', 'authentication', 'authorization', 'oauth', 'jwt', 'encrypt', 'secure'];
  if (securityKeywords.some(k => taskLower.includes(k))) {
    return 'secure';
  }

  // Bug/fix keywords
  const bugKeywords = ['bug', 'fix', 'error', 'issue', 'debug', '버그', '수정'];
  if (bugKeywords.some(k => taskLower.includes(k))) {
    return 'bugfix';
  }

  // Refactor keywords
  const refactorKeywords = ['refactor', 'refactoring', 'restructure', 'reorganize', '리팩토링', '리팩터'];
  if (refactorKeywords.some(k => taskLower.includes(k))) {
    return 'refactoring';
  }

  // Frontend detection
  const frontendKeywords = ['react', 'vue', 'svelte', 'angular', 'ui', 'ux', 'component', 'css', 'style', 'frontend', 'client'];
  const hasFrontend = frontendKeywords.some(k =>
    taskLower.includes(k) || techSet.has(k)
  );

  // Backend detection
  const backendKeywords = ['api', 'database', 'server', 'backend', 'node', 'express', 'fastapi', 'django', 'sql', 'db'];
  const hasBackend = backendKeywords.some(k =>
    taskLower.includes(k) || techSet.has(k)
  );

  // Fullstack if both
  if (hasFrontend && hasBackend) {
    return 'fullstack';
  }

  // Frontend only
  if (hasFrontend) {
    return 'frontend';
  }

  // Backend only
  if (hasBackend) {
    return 'backend';
  }

  // Default to standard for general tasks
  return 'standard';
}
