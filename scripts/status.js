// Health check for the posting loop. Run: npm run status
// Answers one question: is this thing still going to post tomorrow?
import { config, loadCalendar } from '../src/config.js';
import { loadLedger, pickNextTopic, pickNextTheme, daysSinceLastPost, isPaused } from '../src/state.js';
import { THEMES } from '../templates/themes.js';

const line = (s = '') => console.log(s);
const ok = (m) => console.log(`  ok    ${m}`);
const warn = (m) => console.log(`  WARN  ${m}`);
const bad = (m) => console.log(`  STOP  ${m}`);

const posts = loadLedger().posts;
const published = posts.filter((p) => p.outcome === 'published');
const recent = posts.slice(-10);

line('=== EPG content agent status ===');
line();

// --- Are we posting? ------------------------------------------------------
line('Posting history');
line(`  runs recorded : ${posts.length}`);
line(`  published     : ${published.length}`);
line(`  blocked       : ${posts.filter((p) => p.outcome === 'blocked').length}`);
line(`  failed        : ${posts.filter((p) => p.outcome === 'failed').length}`);
const days = daysSinceLastPost();
if (days === null) warn('nothing has published yet');
else if (days > 3) bad(`last successful post was ${days.toFixed(1)} days ago. The loop may be stalled.`);
else ok(`last successful post was ${days.toFixed(1)} days ago`);

if (recent.length) {
  line();
  line('  Recent runs (newest last):');
  for (const p of recent) {
    const when = String(p.postedAt).replace('T', ' ').slice(0, 16);
    const where = (p.platforms || []).join(',') || '-';
    line(`    ${when}  ${String(p.outcome).padEnd(9)} ${String(p.topicId).padEnd(26)} ${where}`);
  }
}

// --- Kill switch ----------------------------------------------------------
line();
line('Switches');
if (isPaused()) bad('state/PAUSED exists. Nothing will post until you delete that file.');
else ok('kill switch is off (no state/PAUSED file)');
if (!config.enabled) bad('AGENT_ENABLED is false.');
else ok('AGENT_ENABLED is true');
line(`  platforms     : ${config.platforms.join(', ')}`);

// --- Content runway -------------------------------------------------------
line();
line('Content runway');
const { topics } = loadCalendar();
const active = topics.filter((t) => !t.paused);
const usedIds = new Set(published.map((p) => p.topicId));
const unused = active.filter((t) => !usedIds.has(t.id)).length;
const perWeek = 10; // twice a day, weekdays
line(`  topics active : ${active.length} (${unused} never posted yet)`);
if (unused === 0) warn('every topic has run at least once. Posts are now repeating topics.');
else {
  const weeks = (unused / perWeek).toFixed(1);
  if (unused < perWeek) warn(`only ${unused} fresh topics left, under a week at ${perWeek}/week. Add more.`);
  else ok(`${weeks} weeks of fresh topics left at ${perWeek} posts/week`);
}
line(`  palettes      : ${THEMES.length} rotating`);

try {
  const nextTopic = pickNextTopic();
  const nextTheme = pickNextTheme(nextTopic);
  line(`  next up       : "${nextTopic.hook}"`);
  line(`  next palette  : ${nextTheme.name}`);
} catch (err) {
  bad(`cannot pick a next topic: ${err.message}`);
}

// --- Credentials ----------------------------------------------------------
line();
line('Credentials');
if (!config.anthropicApiKey) bad('ANTHROPIC_API_KEY missing locally (CI uses its own secret)');
else ok('ANTHROPIC_API_KEY present locally');

if (config.meta.pageToken) {
  try {
    const r = await fetch(
      `https://graph.facebook.com/${config.meta.apiVersion}/debug_token` +
        `?input_token=${config.meta.pageToken}&access_token=${config.meta.pageToken}`,
    );
    const d = (await r.json()).data || {};
    if (!d.is_valid) bad('Meta token is NO LONGER VALID. Instagram and Facebook will fail.');
    else {
      ok(`Meta token valid (${d.expires_at === 0 ? 'never expires' : 'expires ' + new Date(d.expires_at * 1000).toDateString()})`);
      if (d.data_access_expires_at) {
        const daysLeft = (d.data_access_expires_at * 1000 - Date.now()) / 86_400_000;
        const when = new Date(d.data_access_expires_at * 1000).toDateString();
        if (daysLeft < 21) bad(`Meta DATA ACCESS expires in ${Math.round(daysLeft)} days (${when}). Regenerate the token.`);
        else if (daysLeft < 45) warn(`Meta data access expires in ${Math.round(daysLeft)} days (${when}).`);
        else ok(`Meta data access good for ${Math.round(daysLeft)} more days (${when})`);
      }
      for (const need of ['pages_manage_posts', 'instagram_content_publish']) {
        if ((d.scopes || []).includes(need)) ok(`scope ${need}`);
        else bad(`missing scope ${need}`);
      }
    }
  } catch (err) {
    warn(`could not reach Meta to check the token: ${err.message}`);
  }
} else {
  warn('META_PAGE_ACCESS_TOKEN not set locally (CI uses its own secret)');
}

// --- Standing reminders ---------------------------------------------------
line();
line('Keep-alive reminders');
line('  - GitHub disables scheduled workflows after ~60 days with no human');
line('    repository activity. The bot\'s own commits may not count. If GitHub');
line('    emails you about it, click re-enable, or just push any small commit.');
line('  - Meta tokens need regenerating roughly every 90 days (see above).');
line('  - Add topics before the runway above drops under a week.');
line();
