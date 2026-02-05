#!/usr/bin/env node

/**
 * OMC Persistent Mode Hook (Node.js)
 * Minimal continuation enforcer for all OMC modes.
 * Stripped down for reliability — no optional imports, no PRD, no notepad pruning.
 *
 * Supported modes: ralph, autopilot, ultrapilot, swarm, ultrawork, ecomode, ultraqa, pipeline
 */

const {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
} = require("fs");
const { join, dirname, resolve, normalize } = require("path");
const { homedir } = require("os");

/**
 * Global registry path for tracking active modes across all projects.
 * This allows the Stop hook to find active modes even when directory
 * resolution fails (e.g., when process.cwd() is home directory).
 */
const GLOBAL_ACTIVE_MODES_REGISTRY = join(homedir(), ".claude", ".omb-active-modes.json");

/**
 * Read the global active modes registry.
 * @returns {object} - Registry object { [projectPath]: { mode, startedAt, sessionId } }
 */
function readActiveModesRegistry() {
  try {
    if (!existsSync(GLOBAL_ACTIVE_MODES_REGISTRY)) return {};
    const data = JSON.parse(readFileSync(GLOBAL_ACTIVE_MODES_REGISTRY, "utf-8"));
    return data || {};
  } catch {
    return {};
  }
}

/**
 * Write the global active modes registry.
 * @param {object} registry - Registry object to write
 */
function writeActiveModesRegistry(registry) {
  try {
    const dir = dirname(GLOBAL_ACTIVE_MODES_REGISTRY);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(GLOBAL_ACTIVE_MODES_REGISTRY, JSON.stringify(registry, null, 2));
  } catch {
    // Silent fail - registry is a performance optimization, not critical
  }
}

/**
 * Register an active mode in the global registry.
 * @param {string} projectPath - Project path
 * @param {string} mode - Mode name (ralph, autopilot, etc.)
 * @param {string} sessionId - Session ID
 */
function registerActiveMode(projectPath, mode, sessionId) {
  const registry = readActiveModesRegistry();
  const normalizedPath = normalizePath(projectPath);
  registry[normalizedPath] = {
    mode,
    startedAt: new Date().toISOString(),
    sessionId,
    statePath: join(normalizedPath, ".omb", "state", `${mode}-state.json`)
  };
  writeActiveModesRegistry(registry);
}

/**
 * Unregister a mode from the global registry.
 * @param {string} projectPath - Project path
 */
function unregisterActiveMode(projectPath) {
  const registry = readActiveModesRegistry();
  const normalizedPath = normalizePath(projectPath);
  delete registry[normalizedPath];
  writeActiveModesRegistry(registry);
}

/**
 * Get all active modes from the registry that match the current session or are recent.
 * @param {string} currentSessionId - Current session ID
 * @returns {Array} - Array of { projectPath, mode, statePath, sessionId }
 */
function getActiveModes(currentSessionId) {
  const registry = readActiveModesRegistry();
  const now = Date.now();
  const activeModes = [];

  for (const [projectPath, entry] of Object.entries(registry)) {
    // Skip stale entries (older than 2 hours)
    const age = now - new Date(entry.startedAt).getTime();
    if (age > 2 * 60 * 60 * 1000) continue;

    // Include if session matches or no session specified
    if (!currentSessionId || !entry.sessionId || entry.sessionId === currentSessionId) {
      activeModes.push({
        projectPath,
        mode: entry.mode,
        statePath: entry.statePath,
        sessionId: entry.sessionId
      });
    }
  }

  return activeModes;
}

/**
 * Normalize a path for comparison.
 */
function normalizePath(p) {
  if (!p) return "";
  let normalized = resolve(p);
  normalized = normalize(normalized);
  normalized = normalized.replace(/[\/\\]+$/, "");
  if (process.platform === "win32") {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

/**
 * Check if a path is inside a .claude-accounts structure.
 * Returns the account directory if found, null otherwise.
 * @param {string} dir - Directory to check
 * @returns {string|null} - Account directory or null
 */
function getAccountDirectory(dir) {
  const normalized = normalizePath(dir);
  const accountsMatch = normalized.match(/(.+[\/\\]\.claude-accounts[\/\\][^\/\\]+)/i);
  if (accountsMatch) {
    return accountsMatch[1];
  }
  return null;
}

/**
 * Find the project root by looking for common project markers.
 * Respects .claude-accounts boundaries to prevent cross-account state leakage.
 * @param {string} startDir - Directory to start searching from
 * @returns {string} - Project root or startDir if not found
 */
function findProjectRoot(startDir) {
  const markers = ['.git', 'package.json', 'pyproject.toml', '.claude', 'CLAUDE.md', 'Cargo.toml', 'go.mod'];

  // Check if we're inside a .claude-accounts structure
  const accountDir = getAccountDirectory(startDir);

  let current = startDir;
  const sep = process.platform === 'win32' ? '\\' : '/';
  const root = process.platform === 'win32' ? current.split(sep)[0] + sep : '/';

  while (current !== root) {
    // Stop at .claude-accounts boundary to prevent cross-account state access
    if (accountDir && !normalizePath(current).startsWith(accountDir)) {
      break;
    }

    // Stop at home directory to prevent going too high
    const home = homedir();
    if (normalizePath(current) === normalizePath(home)) {
      break;
    }

    for (const marker of markers) {
      if (existsSync(join(current, marker))) {
        return current;
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return startDir; // Fallback to original directory
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function readJsonFile(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function writeJsonFile(path, data) {
  try {
    // Ensure directory exists
    const dir = dirname(path);
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Staleness threshold for mode states (2 hours in milliseconds).
 * States older than this are treated as inactive to prevent stale state
 * from causing the stop hook to malfunction in new sessions.
 */
const STALE_STATE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Check if a state is stale based on its timestamps and session ID.
 * A state is considered stale if it hasn't been updated recently or belongs to a different session.
 * We check both `last_checked_at` and `started_at` - using whichever is more recent.
 * @param {object} state - State object to check
 * @param {string} currentSessionId - Current session ID to compare against
 * @returns {boolean} - True if state is stale or belongs to different session
 */
function isStaleState(state, currentSessionId) {
  if (!state) return true;

  // If session_id exists and doesn't match current session, consider stale
  if (currentSessionId && state.session_id && state.session_id !== currentSessionId) {
    return true;
  }

  const lastChecked = state.last_checked_at
    ? new Date(state.last_checked_at).getTime()
    : 0;
  const startedAt = state.started_at ? new Date(state.started_at).getTime() : 0;
  const mostRecent = Math.max(lastChecked, startedAt);

  if (mostRecent === 0) return true; // No valid timestamps

  const age = Date.now() - mostRecent;
  return age > STALE_STATE_THRESHOLD_MS;
}

/**
 * Check if a state belongs to the current project.
 * Enhanced to handle .claude-accounts boundaries and multiple verification layers.
 * @param {object} state - State object to check
 * @param {string} currentDirectory - Current working directory
 * @param {string} projectRoot - Resolved project root
 * @param {boolean} isGlobalState - Whether state was read from global location
 * @returns {boolean} - True if state belongs to current project
 */
function isStateForCurrentProject(
  state,
  currentDirectory,
  projectRoot,
  isGlobalState = false,
) {
  if (!state) return true;

  // If state has no project_path, only allow if not global
  if (!state.project_path) {
    if (isGlobalState) {
      return false;
    }
    return true;
  }

  const stateProjectPath = normalizePath(state.project_path);
  const normalizedCurrent = normalizePath(currentDirectory);
  const normalizedRoot = normalizePath(projectRoot);

  // Check exact match with either current directory or project root
  if (stateProjectPath === normalizedCurrent || stateProjectPath === normalizedRoot) {
    return true;
  }

  // Check if state belongs to a different .claude-accounts account
  const stateAccount = getAccountDirectory(state.project_path);
  const currentAccount = getAccountDirectory(currentDirectory);

  // If both are in different accounts, definitely not the same project
  if (stateAccount && currentAccount && stateAccount !== currentAccount) {
    return false;
  }

  // If current is in an account but state is not (or vice versa), be cautious
  if ((stateAccount && !currentAccount) || (!stateAccount && currentAccount)) {
    return false;
  }

  return false;
}

/**
 * Read state file from local location only.
 */
function readStateFile(stateDir, filename) {
  const localPath = join(stateDir, filename);
  const state = readJsonFile(localPath);
  return { state, path: localPath, isGlobal: false };
}

/**
 * Count incomplete Tasks from Claude Code's native Task system.
 */
function countIncompleteTasks(sessionId) {
  if (!sessionId || typeof sessionId !== "string") return 0;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,255}$/.test(sessionId)) return 0;

  const taskDir = join(homedir(), ".claude", "tasks", sessionId);
  if (!existsSync(taskDir)) return 0;

  let count = 0;
  try {
    const files = readdirSync(taskDir).filter(
      (f) => f.endsWith(".json") && f !== ".lock",
    );
    for (const file of files) {
      try {
        const content = readFileSync(join(taskDir, file), "utf-8");
        const task = JSON.parse(content);
        if (task.status === "pending" || task.status === "in_progress") count++;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
  return count;
}

function countIncompleteTodos(sessionId, projectDir) {
  let count = 0;

  // Session-specific todos only (no global scan)
  if (
    sessionId &&
    typeof sessionId === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,255}$/.test(sessionId)
  ) {
    const sessionTodoPath = join(
      homedir(),
      ".claude",
      "todos",
      `${sessionId}.json`,
    );
    try {
      const data = readJsonFile(sessionTodoPath);
      const todos = Array.isArray(data)
        ? data
        : Array.isArray(data?.todos)
          ? data.todos
          : [];
      count += todos.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled",
      ).length;
    } catch {
      /* skip */
    }
  }

  // Project-local todos only
  for (const path of [
    join(projectDir, ".omb", "todos.json"),
    join(projectDir, ".claude", "todos.json"),
  ]) {
    try {
      const data = readJsonFile(path);
      const todos = Array.isArray(data)
        ? data
        : Array.isArray(data?.todos)
          ? data.todos
          : [];
      count += todos.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled",
      ).length;
    } catch {
      /* skip */
    }
  }

  return count;
}

/**
 * Detect if stop was triggered by context-limit related reasons.
 * When context is exhausted, Claude Code needs to stop so it can compact.
 * Blocking these stops causes a deadlock: can't compact because can't stop,
 * can't continue because context is full.
 *
 * See: https://github.com/Yeachan-Heo/oh-my-claudecode/issues/213
 */
function isContextLimitStop(data) {
  const reason = (data.stop_reason || data.stopReason || "").toLowerCase();

  const contextPatterns = [
    "context_limit",
    "context_window",
    "context_exceeded",
    "context_full",
    "max_context",
    "token_limit",
    "max_tokens",
    "conversation_too_long",
    "input_too_long",
  ];

  if (contextPatterns.some((p) => reason.includes(p))) {
    return true;
  }

  const endTurnReason = (
    data.end_turn_reason ||
    data.endTurnReason ||
    ""
  ).toLowerCase();
  if (endTurnReason && contextPatterns.some((p) => endTurnReason.includes(p))) {
    return true;
  }

  return false;
}

/**
 * Detect if stop was triggered by user abort (Ctrl+C, cancel button, etc.)
 */
function isUserAbort(data) {
  if (data.user_requested || data.userRequested) return true;

  const reason = (data.stop_reason || data.stopReason || "").toLowerCase();
  // Exact-match patterns: short generic words that cause false positives with .includes()
  const exactPatterns = ["aborted", "abort", "cancel", "interrupt"];
  // Substring patterns: compound words safe for .includes() matching
  const substringPatterns = [
    "user_cancel",
    "user_interrupt",
    "ctrl_c",
    "manual_stop",
  ];

  return (
    exactPatterns.some((p) => reason === p) ||
    substringPatterns.some((p) => reason.includes(p))
  );
}

/**
 * Determine the best directory to use for state file lookup.
 * Priority: data.directory > data.cwd > CLAUDE_PROJECT_DIR > process.cwd()
 * @param {object} data - Hook input data
 * @returns {string} - Resolved directory path
 */
function resolveDirectory(data) {
  // 1. Explicit directory from hook data (highest priority)
  if (data.directory && existsSync(data.directory)) {
    return data.directory;
  }

  // 2. CWD from hook data
  if (data.cwd && existsSync(data.cwd)) {
    return data.cwd;
  }

  // 3. Environment variable (Claude Code may set this)
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir && existsSync(envDir)) {
    return envDir;
  }

  // 4. Fallback to process.cwd()
  return process.cwd();
}

async function main() {
  try {
    const input = await readStdin();
    let data = {};
    try {
      data = JSON.parse(input);
    } catch {}

    const directory = resolveDirectory(data);
    const sessionId = data.sessionId || data.session_id || "";
    const projectRoot = findProjectRoot(directory);
    const stateDir = join(projectRoot, ".omb", "state");

    // Log for debugging (only in verbose mode)
    if (process.env.OMB_DEBUG === "1") {
      console.error(`[persistent-mode] directory=${directory}, projectRoot=${projectRoot}, stateDir=${stateDir}`);
    }

    // CRITICAL: Never block context-limit stops.
    // Blocking these causes a deadlock where Claude Code cannot compact.
    // See: https://github.com/Yeachan-Heo/oh-my-claudecode/issues/213
    if (isContextLimitStop(data)) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Respect user abort (Ctrl+C, cancel)
    if (isUserAbort(data)) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Check global registry for active modes (fallback when local lookup fails)
    // This handles cases where process.cwd() is wrong (e.g., home directory)
    const activeModes = getActiveModes(sessionId);
    let actualStateDir = stateDir;
    let actualProjectRoot = projectRoot;

    // If we found active modes in registry and local state dir doesn't exist,
    // use the registered project path instead
    if (activeModes.length > 0 && !existsSync(stateDir)) {
      const firstActive = activeModes[0];
      actualProjectRoot = firstActive.projectPath;
      actualStateDir = join(actualProjectRoot, ".omb", "state");
      if (process.env.OMB_DEBUG === "1") {
        console.error(`[persistent-mode] Using registry fallback: ${actualStateDir}`);
      }
    }

    // Read all mode states (local-only)
    const ralph = readStateFile(actualStateDir, "ralph-state.json");
    const autopilot = readStateFile(actualStateDir, "autopilot-state.json");
    const ultrapilot = readStateFile(actualStateDir, "ultrapilot-state.json");
    const ultrawork = readStateFile(stateDir, "ultrawork-state.json");
    const ecomode = readStateFile(stateDir, "ecomode-state.json");
    const ultraqa = readStateFile(stateDir, "ultraqa-state.json");
    const pipeline = readStateFile(stateDir, "pipeline-state.json");

    // Swarm uses swarm-summary.json (not swarm-state.json) + marker file
    const swarmMarker = existsSync(join(stateDir, "swarm-active.marker"));
    const swarmSummary = readJsonFile(join(stateDir, "swarm-summary.json"));

    // Count incomplete items (session-specific + project-local only)
    const taskCount = countIncompleteTasks(sessionId);
    const todoCount = countIncompleteTodos(sessionId, directory);
    const totalIncomplete = taskCount + todoCount;

    // Helper to check project match for all modes
    const isForThisProject = (stateObj) =>
      isStateForCurrentProject(stateObj.state, directory, actualProjectRoot, stateObj.isGlobal);

    // Priority 1: Ralph Loop (explicit persistence mode)
    // Skip if state is stale (older than 2 hours) - prevents blocking new sessions
    if (ralph.state?.active && !isStaleState(ralph.state, sessionId) && isForThisProject(ralph)) {
      const iteration = ralph.state.iteration || 1;
      const maxIter = ralph.state.max_iterations || 100;

      if (iteration < maxIter) {
        ralph.state.iteration = iteration + 1;
        ralph.state.last_checked_at = new Date().toISOString();
        // Ensure critical fields exist
        if (!ralph.state.project_path) {
          ralph.state.project_path = actualProjectRoot;
        }
        if (!ralph.state.session_id) {
          ralph.state.session_id = sessionId || `ralph-${Date.now()}`;
        }
        writeJsonFile(ralph.path, ralph.state);

        // Register in global registry for cross-directory lookup
        registerActiveMode(ralph.state.project_path, "ralph", ralph.state.session_id);

        console.log(
          JSON.stringify({
            decision: "block",
            reason: `[RALPH LOOP - ITERATION ${iteration + 1}/${maxIter}] Work is NOT done. Continue working.\nWhen FULLY complete (after Architect verification), run /oh-my-black:cancel to cleanly exit ralph mode and clean up all state files. If cancel fails, retry with /oh-my-black:cancel --force.\n${ralph.state.prompt ? `Task: ${ralph.state.prompt}` : ""}`,
          }),
        );
        return;
      }
    }

    // Priority 2: Autopilot (high-level orchestration)
    if (autopilot.state?.active && !isStaleState(autopilot.state, sessionId) && isForThisProject(autopilot)) {
      const phase = autopilot.state.phase || "init";
      // If phase is missing or not "complete", treat as active
      if (phase !== "complete" && phase !== "failed") {
        const newCount = (autopilot.state.reinforcement_count || 0) + 1;
        if (newCount <= 20) {
          autopilot.state.reinforcement_count = newCount;
          autopilot.state.last_checked_at = new Date().toISOString();
          // Ensure critical fields exist
          if (!autopilot.state.project_path) {
            autopilot.state.project_path = actualProjectRoot;
          }
          if (!autopilot.state.session_id) {
            autopilot.state.session_id = sessionId || `autopilot-${Date.now()}`;
          }
          writeJsonFile(autopilot.path, autopilot.state);

          // Register in global registry for cross-directory lookup
          registerActiveMode(autopilot.state.project_path, "autopilot", autopilot.state.session_id);

          console.log(
            JSON.stringify({
              decision: "block",
              reason: `[AUTOPILOT - Phase: ${phase}] Autopilot not complete. Continue working. When all phases are complete, run /oh-my-black:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-black:cancel --force.`,
            }),
          );
          return;
        }
      }
    }

    // Priority 3: Ultrapilot (parallel autopilot)
    if (ultrapilot.state?.active && !isStaleState(ultrapilot.state, sessionId) && isForThisProject(ultrapilot)) {
      const workers = ultrapilot.state.workers || [];
      const incomplete = workers.filter(
        (w) => w.status !== "complete" && w.status !== "failed",
      ).length;
      if (incomplete > 0) {
        const newCount = (ultrapilot.state.reinforcement_count || 0) + 1;
        if (newCount <= 20) {
          ultrapilot.state.reinforcement_count = newCount;
          ultrapilot.state.last_checked_at = new Date().toISOString();
          // Ensure critical fields exist
          if (!ultrapilot.state.project_path) {
            ultrapilot.state.project_path = directory;
          }
          if (!ultrapilot.state.sessionId) {
            ultrapilot.state.sessionId = sessionId || `ultrapilot-${Date.now()}`;
          }
          writeJsonFile(ultrapilot.path, ultrapilot.state);

          console.log(
            JSON.stringify({
              decision: "block",
              reason: `[ULTRAPILOT] ${incomplete} workers still running. Continue working. When all workers complete, run /oh-my-black:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-black:cancel --force.`,
            }),
          );
          return;
        }
      }
    }

    // Priority 4: Swarm (coordinated agents with SQLite)
    // Swarm uses different state structure, create wrapper for project check
    const swarmStateObj = { state: swarmSummary, isGlobal: false };
    if (swarmMarker && swarmSummary?.active && !isStaleState(swarmSummary, sessionId) && isForThisProject(swarmStateObj)) {
      const pending =
        (swarmSummary.tasks_pending || 0) + (swarmSummary.tasks_claimed || 0);
      if (pending > 0) {
        const newCount = (swarmSummary.reinforcement_count || 0) + 1;
        if (newCount <= 15) {
          swarmSummary.reinforcement_count = newCount;
          swarmSummary.last_checked_at = new Date().toISOString();
          writeJsonFile(join(stateDir, "swarm-summary.json"), swarmSummary);

          console.log(
            JSON.stringify({
              decision: "block",
              reason: `[SWARM ACTIVE] ${pending} tasks remain. Continue working. When all tasks are done, run /oh-my-black:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-black:cancel --force.`,
            }),
          );
          return;
        }
      }
    }

    // Priority 5: Pipeline (sequential stages)
    if (pipeline.state?.active && !isStaleState(pipeline.state, sessionId) && isForThisProject(pipeline)) {
      const currentStage = pipeline.state.current_stage || 0;
      const totalStages = pipeline.state.stages?.length || 0;
      if (currentStage < totalStages) {
        const newCount = (pipeline.state.reinforcement_count || 0) + 1;
        if (newCount <= 15) {
          pipeline.state.reinforcement_count = newCount;
          pipeline.state.last_checked_at = new Date().toISOString();
          writeJsonFile(pipeline.path, pipeline.state);

          console.log(
            JSON.stringify({
              decision: "block",
              reason: `[PIPELINE - Stage ${currentStage + 1}/${totalStages}] Pipeline not complete. Continue working. When all stages complete, run /oh-my-black:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-black:cancel --force.`,
            }),
          );
          return;
        }
      }
    }

    // Priority 6: UltraQA (QA cycling)
    if (ultraqa.state?.active && !isStaleState(ultraqa.state, sessionId) && isForThisProject(ultraqa)) {
      const cycle = ultraqa.state.cycle || 1;
      const maxCycles = ultraqa.state.max_cycles || 10;
      if (cycle < maxCycles && !ultraqa.state.all_passing) {
        ultraqa.state.cycle = cycle + 1;
        ultraqa.state.last_checked_at = new Date().toISOString();
        writeJsonFile(ultraqa.path, ultraqa.state);

        console.log(
          JSON.stringify({
            decision: "block",
            reason: `[ULTRAQA - Cycle ${cycle + 1}/${maxCycles}] Tests not all passing. Continue fixing. When all tests pass, run /oh-my-black:cancel to cleanly exit and clean up state files. If cancel fails, retry with /oh-my-black:cancel --force.`,
          }),
        );
        return;
      }
    }

    // Priority 7: Ultrawork - ALWAYS continue while active (not just when tasks exist)
    // This prevents false stops from bash errors, transient failures, etc.
    // Session isolation: only block if state belongs to this session (issue #311)
    // If state has session_id, it must match. If no session_id (legacy), allow.
    // Project isolation: only block if state belongs to this project
    if (
      ultrawork.state?.active &&
      !isStaleState(ultrawork.state, sessionId) &&
      (!ultrawork.state.session_id ||
        ultrawork.state.session_id === sessionId) &&
      isForThisProject(ultrawork)
    ) {
      const newCount = (ultrawork.state.reinforcement_count || 0) + 1;
      const maxReinforcements = ultrawork.state.max_reinforcements || 50;

      if (newCount > maxReinforcements) {
        // Max reinforcements reached - allow stop
        console.log(JSON.stringify({ continue: true }));
        return;
      }

      ultrawork.state.reinforcement_count = newCount;
      ultrawork.state.last_checked_at = new Date().toISOString();
      writeJsonFile(ultrawork.path, ultrawork.state);

      let reason = `[ULTRAWORK #${newCount}/${maxReinforcements}] Mode active.`;

      if (totalIncomplete > 0) {
        const itemType = taskCount > 0 ? "Tasks" : "todos";
        reason += ` ${totalIncomplete} incomplete ${itemType} remain. Continue working.`;
      } else if (newCount >= 3) {
        // Only suggest cancel after minimum iterations (guard against no-tasks-created scenario)
        reason += ` If all work is complete, run /oh-my-black:cancel to cleanly exit ultrawork mode and clean up state files. If cancel fails, retry with /oh-my-black:cancel --force. Otherwise, continue working.`;
      } else {
        // Early iterations with no tasks yet - just tell LLM to continue
        reason += ` Continue working - create Tasks to track your progress.`;
      }

      if (ultrawork.state.original_prompt) {
        reason += `\nTask: ${ultrawork.state.original_prompt}`;
      }

      console.log(JSON.stringify({ decision: "block", reason }));
      return;
    }

    // Priority 8: Ecomode - ALWAYS continue while active
    if (ecomode.state?.active && !isStaleState(ecomode.state, sessionId) && isForThisProject(ecomode)) {
      const newCount = (ecomode.state.reinforcement_count || 0) + 1;
      const maxReinforcements = ecomode.state.max_reinforcements || 50;

      if (newCount > maxReinforcements) {
        // Max reinforcements reached - allow stop
        console.log(JSON.stringify({ continue: true }));
        return;
      }

      ecomode.state.reinforcement_count = newCount;
      ecomode.state.last_checked_at = new Date().toISOString();
      writeJsonFile(ecomode.path, ecomode.state);

      let reason = `[ECOMODE #${newCount}/${maxReinforcements}] Mode active.`;

      if (totalIncomplete > 0) {
        const itemType = taskCount > 0 ? "Tasks" : "todos";
        reason += ` ${totalIncomplete} incomplete ${itemType} remain. Continue working.`;
      } else if (newCount >= 3) {
        // Only suggest cancel after minimum iterations (guard against no-tasks-created scenario)
        reason += ` If all work is complete, run /oh-my-black:cancel to cleanly exit ecomode and clean up state files. If cancel fails, retry with /oh-my-black:cancel --force. Otherwise, continue working.`;
      } else {
        // Early iterations with no tasks yet - just tell LLM to continue
        reason += ` Continue working - create Tasks to track your progress.`;
      }

      console.log(JSON.stringify({ decision: "block", reason }));
      return;
    }

    // No blocking needed
    console.log(JSON.stringify({ continue: true }));
  } catch (error) {
    // On any error, allow stop rather than blocking forever
    console.error(`[persistent-mode] Error: ${error.message}`);
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
