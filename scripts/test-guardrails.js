// Offline self-test: no network, no API key, no npm install needed.
// Verifies the guardrails and the slide template. Run with: npm test
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContent } from '../src/guardrails.js';
import { buildSlides } from '../templates/slides.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand.json'), 'utf8'));

let failures = 0;
const assert = (cond, msg) => {
  if (cond) { console.log(`  ok   ${msg}`); }
  else { console.log(`  FAIL ${msg}`); failures++; }
};

const goodDraft = {
  topicId: 'three-free-fixes',
  hook: '3 free things every local business can fix on Google today',
  cover: { eyebrow: 'Local SEO', headline: '3 *free* fixes to rank higher on Google', subhead: 'You can do all three today.' },
  context: { eyebrow: 'Why it matters', headline: 'Most clicks go to the *top 3*.', paragraphs: ['If you are not there, customers call a competitor.', 'Good news: these fixes are free.'] },
  points: [
    { label: 'The fix most owners miss', title: 'Set the *right* category', body: 'Your primary category is a strong ranking signal. Pick the most specific one.', action: 'Edit profile then Categories' },
    { label: 'Free ranking points', title: 'Fill *every* field', body: 'Google ranks complete profiles higher. Add services, hours, and photos.', action: 'Complete every section' },
    { label: 'The weekly habit', title: 'Post *every week*', body: 'Active profiles get shown more. One post a week is enough.', action: 'Add an update weekly' },
  ],
  recap: { eyebrow: 'The honest part', headline: "That's 3. There are usually *8-10*.", body: 'These are the easy wins.', done: ['Right category', 'Complete profile', 'Weekly posts'], locked: 'Reviews, citations, on-page SEO, and more' },
  cta: { eyebrow: 'Want the rest?', headline: 'Get a *free* audit', body: 'No pitch, no obligation.', button: 'Book your free Google audit', url: 'epgads' },
  instagramCaption: 'Your competitor is not better than you. Their Google profile is. Here are 3 free fixes you can make today. Save this and share it with an owner who needs it. Free audit at epgads.net.',
  linkedinPost: 'Most local businesses are invisible on Google for one fixable reason. Here are three free fixes any owner can make today. Want the rest for your business? Book a free Google audit at epgads.net.',
  article: { title: 'How to Rank Higher on Google Maps in Tampa, FL', body: 'If you run a local business in Tampa, showing up in the map pack is what drives calls. '.repeat(8) },
  hashtags: ['#LocalSEO', '#GoogleBusinessProfile', '#TampaBusiness', '#BrandonFL', '#GoogleMaps'],
};

console.log('Valid draft:');
const clean = checkContent(goodDraft, brand);
assert(clean.passed, `clean draft passes (violations: ${clean.violations.length ? JSON.stringify(clean.violations) : 'none'})`);

const trips = (mutate, rule) => {
  const d = structuredClone(goodDraft);
  mutate(d);
  const r = checkContent(d, brand);
  assert(r.blocking.some((x) => x.rule === rule), `blocks "${rule}"`);
};

console.log('\nBlocking rules:');
trips((d) => (d.instagramCaption += ' Only $1,499 today.'), 'no-pricing');
trips((d) => (d.instagramCaption += ' We helped 200 businesses rank.'), 'no-client-count');
trips((d) => (d.instagramCaption += ' 87% of searches never scroll.'), 'no-fake-percentage');
trips((d) => (d.linkedinPost += ' Call us at (813) 555-1234.'), 'stray-phone');
trips((d) => (d.linkedinPost += ' Email hello@someoneelse.com'), 'stray-email');
trips((d) => (d.instagramCaption += ' Visit competitorsite.com now.'), 'wrong-domain');
trips((d) => (d.instagramCaption += ' This is a game-changer -- really.'), 'no-em-dash');
trips((d) => (d.hashtags = ['#NotInPool']), 'hashtag-not-in-pool');
trips((d) => (d.points = d.points.slice(0, 2)), 'wrong-point-count');

console.log('\nGuarantee language is ALLOWED (EPG core offer):');
const g = structuredClone(goodDraft);
g.instagramCaption += ' Top 3 on Google in 90 days or your money back.';
assert(checkContent(g, brand).blocking.length === 0, 'approved guarantee does not block');

console.log('\nGoogle reference domain is allowed:');
const gg = structuredClone(goodDraft);
gg.article.body += ' Learn more at support.google.com and business.google.com.';
assert(!checkContent(gg, brand).blocking.some((x) => x.rule === 'wrong-domain'), 'google.com references pass');

console.log('\nTemplate:');
const slides = buildSlides(goodDraft);
assert(slides.length === 8, `builds 8 slides (got ${slides.length})`);
assert(slides[0].includes('rank higher on Google'), 'cover headline rendered');
assert(slides[2].includes('class="num">1<'), 'point 1 numbered');
assert(!slides.join('').includes('*'), 'emphasis asterisks converted to spans');

console.log(`\n${failures ? `FAILED (${failures})` : 'ALL PASSED'}`);
process.exitCode = failures ? 1 : 0;
