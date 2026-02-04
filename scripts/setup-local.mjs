#!/usr/bin/env node

/**
 * oh-my-black Local Setup Script
 *
 * Automatically configures oh-my-black plugin for Claude Code
 *
 * Usage:
 *   node scripts/setup-local.mjs          # Install and enable
 *   node scripts/setup-local.mjs --remove # Remove and restore oh-my-claudecode
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, symlinkSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const CLAUDE_DIR = join(homedir(), '.claude');
const PLUGINS_DIR = join(CLAUDE_DIR, 'plugins');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');
const INSTALLED_PLUGINS_FILE = join(PLUGINS_DIR, 'installed_plugins.json');
const OMB_ROOT = dirname(__dirname);
const OMB_SYMLINK = join(PLUGINS_DIR, 'oh-my-black');

const PLUGIN_ID = 'oh-my-black@omb';
const OMC_PLUGIN_ID = 'oh-my-claudecode@omc';

function log(msg) {
  console.log(`[oh-my-black] ${msg}`);
}

function error(msg) {
  console.error(`[oh-my-black] ERROR: ${msg}`);
}

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function createSymlink() {
  if (existsSync(OMB_SYMLINK)) {
    log(`Symlink already exists: ${OMB_SYMLINK}`);
    return true;
  }

  try {
    symlinkSync(OMB_ROOT, OMB_SYMLINK);
    log(`Created symlink: ${OMB_SYMLINK} -> ${OMB_ROOT}`);
    return true;
  } catch (e) {
    error(`Failed to create symlink: ${e.message}`);
    return false;
  }
}

function removeSymlink() {
  if (!existsSync(OMB_SYMLINK)) {
    return true;
  }

  try {
    unlinkSync(OMB_SYMLINK);
    log(`Removed symlink: ${OMB_SYMLINK}`);
    return true;
  } catch (e) {
    error(`Failed to remove symlink: ${e.message}`);
    return false;
  }
}

/**
 * Get hooks configuration for oh-my-black
 * Uses OMB_ROOT for absolute paths to hook scripts
 */
function getHooksConfig() {
  return {
    UserPromptSubmit: [{
      matcher: '*',
      hooks: [{
        type: 'command',
        command: `node ${OMB_ROOT}/templates/hooks/keyword-detector.mjs`,
        timeout: 5000
      }]
    }],
    Stop: [{
      matcher: '*',
      hooks: [{
        type: 'command',
        command: `node ${OMB_ROOT}/scripts/persistent-mode.cjs`,
        timeout: 5000
      }]
    }]
  };
}

/**
 * Check if a hook entry belongs to oh-my-black
 */
function isOmbHook(hookEntry) {
  if (!hookEntry?.hooks) return false;
  return hookEntry.hooks.some(h =>
    h.command?.includes('oh-my-black') ||
    h.command?.includes('/omb/') ||
    h.command?.includes(OMB_ROOT)
  );
}

/**
 * Add oh-my-black hooks to settings, avoiding duplicates
 */
function addHooks(settings) {
  const ombHooks = getHooksConfig();

  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const [eventName, ombEntries] of Object.entries(ombHooks)) {
    if (!settings.hooks[eventName]) {
      settings.hooks[eventName] = [];
    }

    // Remove existing oh-my-black hooks (to avoid duplicates)
    settings.hooks[eventName] = settings.hooks[eventName].filter(entry => !isOmbHook(entry));

    // Add oh-my-black hooks
    settings.hooks[eventName].push(...ombEntries);
    log(`Added ${eventName} hook for oh-my-black`);
  }
}

/**
 * Remove oh-my-black hooks from settings
 */
function removeHooks(settings) {
  if (!settings.hooks) return;

  for (const eventName of Object.keys(settings.hooks)) {
    const before = settings.hooks[eventName].length;
    settings.hooks[eventName] = settings.hooks[eventName].filter(entry => !isOmbHook(entry));
    const removed = before - settings.hooks[eventName].length;

    if (removed > 0) {
      log(`Removed ${removed} ${eventName} hook(s) for oh-my-black`);
    }

    // Clean up empty arrays
    if (settings.hooks[eventName].length === 0) {
      delete settings.hooks[eventName];
    }
  }

  // Clean up empty hooks object
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
}

function updateSettings(enable = true) {
  let settings = readJSON(SETTINGS_FILE);

  if (!settings) {
    settings = {
      permissions: { allow: [], deny: [], ask: [] },
      enabledPlugins: {}
    };
  }

  if (!settings.enabledPlugins) {
    settings.enabledPlugins = {};
  }

  if (enable) {
    // Enable oh-my-black (keep oh-my-claudecode as-is for coexistence)
    settings.enabledPlugins[PLUGIN_ID] = true;
    // Don't disable oh-my-claudecode - they can coexist
    log(`Enabled ${PLUGIN_ID}`);

    // Add hooks to settings.json
    addHooks(settings);
  } else {
    // Disable oh-my-black only
    settings.enabledPlugins[PLUGIN_ID] = false;
    log(`Disabled ${PLUGIN_ID}`);

    // Remove oh-my-black hooks
    removeHooks(settings);
  }

  writeJSON(SETTINGS_FILE, settings);
  log(`Updated settings: ${SETTINGS_FILE}`);
}

function updateInstalledPlugins(install = true) {
  let plugins = readJSON(INSTALLED_PLUGINS_FILE);

  if (!plugins) {
    plugins = { version: 2, plugins: {} };
  }

  if (!plugins.plugins) {
    plugins.plugins = {};
  }

  if (install) {
    plugins.plugins[PLUGIN_ID] = [{
      scope: 'user',
      installPath: OMB_ROOT,
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }];
    log(`Registered ${PLUGIN_ID} in installed_plugins.json`);
  } else {
    delete plugins.plugins[PLUGIN_ID];
    log(`Removed ${PLUGIN_ID} from installed_plugins.json`);
  }

  writeJSON(INSTALLED_PLUGINS_FILE, plugins);
}

function verifyPluginJson() {
  const pluginJsonPath = join(OMB_ROOT, '.claude-plugin', 'plugin.json');
  const pluginJson = readJSON(pluginJsonPath);

  if (!pluginJson) {
    error(`plugin.json not found at ${pluginJsonPath}`);
    return false;
  }

  // Ensure hooks field exists
  if (!pluginJson.hooks) {
    pluginJson.hooks = './hooks/hooks.json';
    writeJSON(pluginJsonPath, pluginJson);
    log('Added hooks field to plugin.json');
  }

  // Verify hooks.json exists
  const hooksPath = join(OMB_ROOT, 'hooks', 'hooks.json');
  if (!existsSync(hooksPath)) {
    error(`hooks.json not found at ${hooksPath}`);
    return false;
  }

  log('Plugin configuration verified');
  return true;
}

function install() {
  log('=== Installing oh-my-black ===');

  // 1. Ensure directories exist
  ensureDir(PLUGINS_DIR);
  log(`Ensured plugins directory: ${PLUGINS_DIR}`);

  // 2. Verify plugin.json
  if (!verifyPluginJson()) {
    return false;
  }

  // 3. Create symlink
  if (!createSymlink()) {
    return false;
  }

  // 4. Update installed_plugins.json
  updateInstalledPlugins(true);

  // 5. Update settings.json
  updateSettings(true);

  log('');
  log('=== Installation Complete ===');
  log('');
  log('Restart Claude Code to activate oh-my-black:');
  log('  /exit');
  log('  claude');
  log('');
  log('Then test with:');
  log('  /oh-my-black:help');
  log('');

  return true;
}

function remove() {
  log('=== Removing oh-my-black ===');

  // 1. Update settings.json (restore oh-my-claudecode)
  updateSettings(false);

  // 2. Update installed_plugins.json
  updateInstalledPlugins(false);

  // 3. Remove symlink
  removeSymlink();

  log('');
  log('=== Removal Complete ===');
  log('');
  log('oh-my-claudecode has been restored.');
  log('Restart Claude Code to apply changes.');
  log('');

  return true;
}

function status() {
  log('=== oh-my-black Status ===');
  log('');

  // Check symlink
  const symlinkExists = existsSync(OMB_SYMLINK);
  log(`Symlink: ${symlinkExists ? '✅' : '❌'} ${OMB_SYMLINK}`);

  // Check settings
  const settings = readJSON(SETTINGS_FILE);
  if (settings?.enabledPlugins) {
    const ombEnabled = settings.enabledPlugins[PLUGIN_ID] === true;
    const omcEnabled = settings.enabledPlugins[OMC_PLUGIN_ID] === true;
    log(`oh-my-black enabled: ${ombEnabled ? '✅' : '❌'}`);
    log(`oh-my-claudecode enabled: ${omcEnabled ? '✅' : '❌'}`);
  }

  // Check installed_plugins
  const plugins = readJSON(INSTALLED_PLUGINS_FILE);
  const registered = !!plugins?.plugins?.[PLUGIN_ID];
  log(`Registered: ${registered ? '✅' : '❌'}`);

  // Check plugin.json
  const pluginJsonPath = join(OMB_ROOT, '.claude-plugin', 'plugin.json');
  const pluginJson = readJSON(pluginJsonPath);
  const hasHooks = !!pluginJson?.hooks;
  log(`Plugin hooks.json: ${hasHooks ? '✅' : '❌'}`);

  // Check hooks in settings.json
  const hasUserPromptHook = settings?.hooks?.UserPromptSubmit?.some(entry => isOmbHook(entry));
  const hasStopHook = settings?.hooks?.Stop?.some(entry => isOmbHook(entry));
  log(`Settings hooks:`);
  log(`  UserPromptSubmit: ${hasUserPromptHook ? '✅' : '❌'}`);
  log(`  Stop: ${hasStopHook ? '✅' : '❌'}`);

  log('');
}

// Main
const args = process.argv.slice(2);

if (args.includes('--remove') || args.includes('-r')) {
  remove();
} else if (args.includes('--status') || args.includes('-s')) {
  status();
} else {
  install();
}
