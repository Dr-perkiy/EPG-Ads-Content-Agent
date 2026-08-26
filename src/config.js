import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const paths = {
  root: ROOT,
  brand: path.join(ROOT, 'brand.json'),
  calendar: path.join(ROOT, 'content-calendar.json'),
  templates: path.join(ROOT, 'templates'),
  output: path.join(ROOT, 'output'),
  state: path.join(ROOT, 'state'),
  ledger: path.join(ROOT, 'state', 'posted.json'),
  pausedFlag: path.join(ROOT, 'state', 'PAUSED'),
};

// Minimal .env loader so a local run needs no extra dependency.
// Real values in CI come from GitHub Secrets, which are already in process.env.
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv();

const bool = (v, fallback) => {
  if (v === undefined || v === '') return fallback;
  return String(v).toLowerCase() === 'true';
};

const cliDryRun = process.argv.includes('--dry-run');

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.CLAUDE_MODEL || 'claude-opus-5',

  // Instagram is published through the Meta Graph API (same as the 3DCON agent).
  meta: {
    pageToken: process.env.META_PAGE_ACCESS_TOKEN || '',
    igUserId: process.env.META_IG_USER_ID || '',
    pageId: process.env.META_PAGE_ID || '',
    apiVersion: process.env.META_API_VERSION || 'v21.0',
  },

  // LinkedIn is published through the LinkedIn REST (Posts + Documents) API.
  linkedin: {
    token: process.env.LINKEDIN_ACCESS_TOKEN || '',
    // The author URN. For a Company Page: "urn:li:organization:1234567".
    // For a personal profile: "urn:li:person:abc123".
    authorUrn: process.env.LINKEDIN_AUTHOR_URN || '',
    apiVersion: process.env.LINKEDIN_API_VERSION || '202506',
  },

  dryRun: cliDryRun || bool(process.env.DRY_RUN, true),
  enabled: bool(process.env.AGENT_ENABLED, true),

  platforms: (process.env.PLATFORMS || 'instagram,facebook')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean),

  // Instagram cannot accept a file upload, only a public image URL. In CI we
  // point at raw.githubusercontent.com pinned to the commit that holds the
  // rendered slides, which requires the repository to be public. Alternatively
  // set IMAGE_BASE_URL to a public folder that hosts output/ (e.g. on epgads.net).
  imageBaseUrl: (process.env.IMAGE_BASE_URL || '').replace(/\/+$/, ''),
  githubRepo: process.env.GITHUB_REPOSITORY || '',
  githubSha: process.env.GITHUB_SHA || '',

  // How many recently used topics to avoid repeating (also drives rotation).
  recentTopicsToAvoid: 6,

  // Minimum hours between published posts. Each schedule window fires several
  // times because GitHub drops scheduled runs, so this is what stops the extra
  // attempts from posting again. Manual runs pass 0 to force a post.
  minGapHours: Number(process.env.MIN_GAP_HOURS ?? 5),
};

export function loadBrand() {
  return JSON.parse(fs.readFileSync(paths.brand, 'utf8'));
}

export function loadCalendar() {
  return JSON.parse(fs.readFileSync(paths.calendar, 'utf8'));
}

/**
 * Fail fast with a readable message instead of a cryptic API error later.
 * Only checks what the requested run actually needs.
 */
export function validateConfig() {
  const missing = [];
  if (!config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');

  if (!config.dryRun) {
    if (config.platforms.includes('instagram')) {
      if (!config.meta.pageToken) missing.push('META_PAGE_ACCESS_TOKEN');
      if (!config.meta.igUserId) missing.push('META_IG_USER_ID');
    }
    if (config.platforms.includes('facebook')) {
      if (!config.meta.pageToken) missing.push('META_PAGE_ACCESS_TOKEN');
      if (!config.meta.pageId) missing.push('META_PAGE_ID');
    }
    if (config.platforms.includes('linkedin')) {
      if (!config.linkedin.token) missing.push('LINKEDIN_ACCESS_TOKEN');
      if (!config.linkedin.authorUrn) missing.push('LINKEDIN_AUTHOR_URN');
    }
  }

  if (missing.length) {
    throw new Error(
      `Missing required config: ${missing.join(', ')}. ` +
        `Set them in .env locally, or as GitHub repo Secrets in CI.`,
    );
  }

  const unknown = config.platforms.filter((p) => !['instagram', 'facebook', 'linkedin'].includes(p));
  if (unknown.length) throw new Error(`Unknown PLATFORMS value(s): ${unknown.join(', ')}`);
  if (!config.platforms.length) {
    throw new Error('PLATFORMS is empty. Set it to instagram, facebook, and/or linkedin.');
  }
}
