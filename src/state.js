import fs from 'node:fs';
import path from 'node:path';
import { config, paths, loadCalendar } from './config.js';

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

  const lastUsed = new Map(); // topicId -> timestamp of last published post
  for (const p of loadLedger().posts) {
    if (p.outcome !== 'published' || !p.topicId) continue;
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
