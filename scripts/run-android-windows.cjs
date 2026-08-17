/**
 * Windows: Gradle 8.6+ can fail moving cache dirs when AV/Metro lock files.
 * Uses Gradle 8.5 + external project cache; recovers stuck temp dirs before retry.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'node_modules', 'react-native', 'cli.js');
const GRADLE_HOME = 'D:\\gradle-home';
const PROJECT_CACHE = path.join(GRADLE_HOME, 'project-cache');
const LEGACY_PROJECT_GRADLE = path.join(ROOT, 'android', '.gradle');
const MAX_TRIES = 6;

// 32-char (MD5) or 40-char (SHA-1) hash + UUID temp workspace suffix
const TEMP_WORKSPACE = /^([0-9a-f]{32}|[0-9a-f]{40})-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function recoverStuckWorkspaces(dir, stats) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const full = path.join(dir, entry.name);
    const match = entry.name.match(TEMP_WORKSPACE);
    if (match) {
      const dest = path.join(dir, match[1]);
      try {
        if (!fs.existsSync(dest)) {
          fs.renameSync(full, dest);
          stats.recovered += 1;
          console.log(`[gradle-win] recovered ${dest}`);
        } else {
          fs.rmSync(full, { recursive: true, force: true });
          stats.recovered += 1;
          console.log(`[gradle-win] removed stuck temp ${full}`);
        }
      } catch (err) {
        console.warn(`[gradle-win] skip ${full}: ${err.message}`);
      }
      continue;
    }
    recoverStuckWorkspaces(full, stats);
  }
}

function prepareCaches() {
  fs.mkdirSync(PROJECT_CACHE, { recursive: true });
  const stats = { recovered: 0 };
  for (const root of [GRADLE_HOME, PROJECT_CACHE, LEGACY_PROJECT_GRADLE]) {
    if (fs.existsSync(root)) {
      recoverStuckWorkspaces(root, stats);
    }
  }
  return stats.recovered;
}

for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
  prepareCaches();
  console.log(`[gradle-win] android build attempt ${attempt}/${MAX_TRIES}`);
  const result = spawnSync(process.execPath, [CLI, 'run-android', ...process.argv.slice(2)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      GRADLE_USER_HOME: GRADLE_HOME,
    },
  });
  if (result.status === 0) {
    process.exit(0);
  }
  const recovered = prepareCaches();
  if (!recovered || attempt === MAX_TRIES) {
    process.exit(result.status || 1);
  }
  console.log('[gradle-win] retrying after cache recovery...');
}

process.exit(1);
