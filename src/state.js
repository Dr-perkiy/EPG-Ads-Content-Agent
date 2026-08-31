import fs from 'node:fs';
import path from 'node:path';
import { config, paths, loadCalendar } from './config.js';
import { THEMES, themeById } from '../templates/themes.js';

function ensureStateDir() {
  fs.mkdirSync(paths.state, { recursive: true });
}

export function loadLedger() {
  if (!fs.existsSync(paths.ledger)) return { posts: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(paths.ledger, 'utf8'));
    return { posts: Array.isArray(parsed.posts) ? parsed.posts : [] };
  } catch {
    // A corrupt ledger must not silently reset history and repeat topics.
    throw new Error('state/posted.json is not valid JSON. Fix or delete it before running again.');
  }
}

export function appendToLedger(entry) {
  ensureStateDir();
  const ledger = loadLedger();
  ledger.posts.push(entry);
  fs.writeFileSync(paths.ledger, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
  return ledger;
}

/**
 * Pick the next topic: the least-recently-used, non-paused topic in the
 * calendar. Topics never posted come first (in calendar order), then the one
 * whose last successful post is oldest. This is the loop's idempotency anchor:
 * it will not repeat a topic until every other topic has run.
 */
export function pickNextTopic() {
  const { topics } = loadCalendar();
  const active = topics.filter((t) => !t.paused);
  if (!active.length) throw new Error('No active topics in content-calendar.json (all paused?).');

  // Count blocked attempts as usage, not just successful posts. Otherwise a
  // topic whose copy trips a guardrail stays at the front of the queue and
  // every later run picks it again, jamming the whole schedule on one bad
  // topic. Treating it as used sends it to the back, so the next run moves on
  // and the topic gets a fresh attempt when it comes around again.
  const lastUsed = new Map(); // topicId -> timestamp of last attempt
  for (const p of loadLedger().posts) {
    if (!p.topicId) continue;
    if (p.outcome !== 'published' && p.outcome !== 'blocked') continue;
    const t = new Date(p.postedAt).getTime();
    if (!lastUsed.has(p.topicId) || t > lastUsed.get(p.topicId)) lastUsed.set(p.topicId, t);
  }

  active.sort((a, b) => {
    const au = lastUsed.has(a.id) ? lastUsed.get(a.id) : -1;
    const bu = lastUsed.has(b.id) ? lastUsed.get(b.id) : -1;
    return au - bu; // never-used (-1) first, then oldest first
  });

  return active[0];
}

/** Recent published hooks, newest first, for the "do not repeat these" prompt. */
export function recentHooks(limit = config.recentTopicsToAvoid) {
  return loadLedger()
    .posts.filter((p) => p.outcome === 'published')
    .slice(-limit)
    .reverse()
    .map((p) => p.hook)
    .filter(Boolean);
}

export function isPaused() {
  return fs.existsSync(paths.pausedFlag);
}

export function daysSinceLastPost() {
  const posts = loadLedger().posts.filter((p) => p.outcome === 'published');
  if (!posts.length) return null;
  const last = new Date(posts[posts.length - 1].postedAt);
  if (Number.isNaN(last.getTime())) return null;
  return (Date.now() - last.getTime()) / 86_400_000;
}

export function relative(p) {
  return path.relative(paths.root, p).split(path.sep).join('/');
}

/**
 * Pick the next color theme: least-recently-used across published posts, so the
 * feed never shows the same palette twice in a row. A topic may pin a palette
 * by setting "theme": "<id>" in content-calendar.json (e.g. warnings -> signal).
 */
export function pickNextTheme(topic) {
  if (topic?.theme) return themeById(topic.theme);

  const lastUsed = new Map();
  for (const p of loadLedger().posts) {
    if (p.outcome !== 'published' || !p.themeId) continue;
    const t = new Date(p.postedAt).getTime();
    if (!lastUsed.has(p.themeId) || t > lastUsed.get(p.themeId)) lastUsed.set(p.themeId, t);
  }

  const ranked = [...THEMES].sort((a, b) => {
    const au = lastUsed.has(a.id) ? lastUsed.get(a.id) : -1;
    const bu = lastUsed.has(b.id) ? lastUsed.get(b.id) : -1;
    return au - bu; // never-used first, then oldest first
  });
  return ranked[0];
}
