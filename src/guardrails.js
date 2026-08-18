/**
 * Deterministic content check that runs after the model and before publishing.
 *
 * This is the seatbelt for fully automatic posting. A "block" violation stops
 * the run entirely: nothing is published. A "style" violation triggers one
 * regeneration, then posts anyway.
 *
 * EPG note: unlike the 3DCON agent, the guarantee ("top 3 in 90 days or your
 * money back") and the free audit ARE approved claims, so guarantee language is
 * allowed. Invented statistics, client counts, pricing, and any contact detail
 * other than epgads.net are still blocked.
 */

const ALLOWED_CAPS = new Set(['SEO', 'GBP', 'FAQ', 'DIY', 'USA', 'CTA', 'NAP', 'DM']);

// Domains the content is allowed to reference (the brand site plus Google, since
// every post is about Google). Anything else is treated as a stray link.
const REFERENCE_DOMAINS = new Set([
  'google.com', 'business.google.com', 'support.google.com', 'g.co', 'maps.google.com',
]);

const digitsOf = (s) => s.replace(/\D/g, '');
const EMOJI = /\p{Extended_Pictographic}/gu;
const countEmoji = (t) => (t.match(EMOJI) || []).length;

function collectText(draft) {
  const parts = [];
  const push = (v) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'object') Object.values(v).forEach(push);
    else parts.push(String(v));
  };
  push(draft.cover);
  push(draft.context);
  push(draft.points);
  push(draft.recap);
  push(draft.cta);
  push(draft.instagramCaption);
  push(draft.linkedinPost);
  push(draft.article);
  // Strip emphasis markers so *free* does not look like malformed text.
  return parts.join('\n').replace(/\*/g, '');
}

export function checkContent(draft, brand) {
  const v = [];
  const block = (rule, detail) => v.push({ severity: 'block', rule, detail });
  const style = (rule, detail) => v.push({ severity: 'style', rule, detail });

  const ig = String(draft.instagramCaption || '');
  const li = String(draft.linkedinPost || '');
  const article = String(draft.article?.body || '');
  const tags = Array.isArray(draft.hashtags) ? draft.hashtags : [];
  const all = collectText(draft) + '\n' + tags.join(' ');
  const claims = brand.approvedClaims;

  // --- Money and pricing (never in social) --------------------------------
  if (/\$\s*[\d.]/.test(all) || /\b\d[\d,.]*\s*(dollars|bucks)\b/i.test(all)) {
    block('no-pricing', 'Contains a dollar amount. Drive to the free audit instead.');
  }
  if (!claims.discountsOrPromos) {
    const promo = all.match(/(\bpercent off\b|\bdiscount(s|ed)?\b|\bcoupon\b|\bpromo code\b|\bsale price\b|\bact now\b|\bspecial offer\b|\bsave big\b)/i);
    if (promo) block('no-promos', `Contains promotional claim: "${promo[0]}"`);
  }
  if (!claims.financing) {
    const fin = all.match(/\b(financing|no interest|apr|monthly payments|0 down)\b/i);
    if (fin) block('no-financing', `Contains financing claim: "${fin[0]}"`);
  }

  // --- Awards and rankings (about EPG itself) ------------------------------
  if (!claims.awardsOrRankings) {
    const award = all.match(/(\baward[- ]winning\b|\bvoted\b|\btop[- ]rated agency\b|\bbest[- ]rated agency\b|\b5[- ]star agency\b)/i);
    if (award) block('no-awards', `Contains an award or ranking claim about EPG: "${award[0].trim()}"`);
  }

  // --- Invented numbers ----------------------------------------------------
  if (claims.yearsInBusiness === null) {
    const yrs = all.match(/\b\d+\+?\s*(years?|yrs?)\s+(in business|of experience|helping)\b/i);
    if (yrs) block('no-years-claim', `Claims years in business ("${yrs[0]}") but that is not set in brand.json.`);
  }
  if (claims.clientCount === null) {
    const count = all.match(/\b\d{2,}\+?\s*(businesses|clients|customers|companies|owners|brands|local businesses)\b/i);
    if (count) block('no-client-count', `Claims a client or customer count ("${count[0]}") but clientCount is not set in brand.json.`);
  }
  // Invented precise percentages read as fabricated stats. "top 3" and "8-10"
  // and "90 days" are allowed; a bare "\d%" is not.
  const pct = all.match(/\b\d{1,3}\s*%/);
  if (pct) block('no-fake-percentage', `Contains a specific percentage ("${pct[0]}") that reads as an invented statistic. Use "nearly all" or "most".`);

  // --- Invented testimonials ----------------------------------------------
  // Only flag a long quote if it actually reads like praise from a person
  // (first-person voice + praise/gratitude). Explanatory quotes are fine.
  const praise = /\b(amazing|awesome|best|great|excellent|fantastic|incredible|highly recommend|recommend|helped us|helped me|thank|thanks|grateful|love(d)?|professional|worth it|five[- ]star|5[- ]star|blew|exceeded)\b/i;
  const firstPerson = /\b(I|I'm|I've|we|we're|we've|my|our|they helped|he|she)\b/;
  for (const q of all.match(/["“][^"”]{25,}["”]/g) || []) {
    if (praise.test(q) && firstPerson.test(q)) {
      block('no-invented-testimonial', `Contains a quotation that reads as a customer testimonial: ${q.slice(0, 60)}...`);
      break;
    }
  }

  // --- Contact details: only epgads.net, no phone, no email ---------------
  const allowedDomain = new URL(brand.business.website).hostname.replace(/^www\./, '');
  for (const m of all.match(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|co|io|biz|us|info|shop)\b/gi) || []) {
    const host = m.toLowerCase().replace(/^www\./, '');
    if (host !== allowedDomain && !REFERENCE_DOMAINS.has(host)) {
      block('wrong-domain', `Contains a domain that is not ${allowedDomain} or an allowed Google reference: ${m}`);
    }
  }
  for (const m of all.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []) {
    block('stray-phone', `Contains a phone number, which EPG posts should not include: ${m}`);
  }
  for (const m of all.match(/[\w.+-]+@[\w.-]+\.\w+/g) || []) {
    block('stray-email', `Contains an email address, which EPG posts should not include: ${m}`);
  }

  // --- Placeholders and formatting ----------------------------------------
  if (/[[\]{}]|\bTODO\b|\bINSERT\b|\bXXX\b|lorem ipsum|your (city|name|business) here/i.test(all)) {
    block('placeholder-text', 'Contains brackets or unfilled placeholder text.');
  }
  if (/—|–|--/.test(all)) block('no-em-dash', 'Contains an em dash, en dash, or double hyphen.');

  // --- Hashtags -----------------------------------------------------------
  const pool = new Set(brand.hashtagPool.map((t) => t.toLowerCase()));
  for (const tag of tags) {
    if (!/^#[A-Za-z0-9_]+$/.test(tag)) block('bad-hashtag-format', `Malformed hashtag: "${tag}"`);
    else if (!pool.has(tag.toLowerCase())) block('hashtag-not-in-pool', `Hashtag "${tag}" is not in the approved pool.`);
  }
  if (tags.length < 3) style('too-few-hashtags', `Only ${tags.length} hashtags, aim for 5 to 10.`);
  if (tags.length > 12) block('too-many-hashtags', `${tags.length} hashtags. Cap is 12.`);

  // --- Structure sanity ---------------------------------------------------
  if (!Array.isArray(draft.points) || draft.points.length !== 3) {
    block('wrong-point-count', `Carousel needs exactly 3 points, got ${draft.points?.length ?? 0}.`);
  }
  if (!draft.cover?.headline) block('missing-cover-headline', 'Cover headline is empty.');
  if (!draft.cta?.headline) block('missing-cta', 'CTA slide headline is empty.');

  // --- Length limits ------------------------------------------------------
  if (ig.length < 40) block('instagram-too-short', `Instagram caption is only ${ig.length} characters.`);
  const igFull = `${ig}\n\n${tags.join(' ')}`;
  if (igFull.length > 2200) block('instagram-too-long', `Instagram caption plus hashtags is ${igFull.length} chars, cap 2200.`);
  if (li.length < 60) block('linkedin-too-short', `LinkedIn post is only ${li.length} characters.`);
  if (li.length > 2900) block('linkedin-too-long', `LinkedIn post is ${li.length} chars, cap 2900.`);
  if (article && article.length < 400) style('article-short', `Article body is only ${article.length} chars.`);

  // --- Tone ---------------------------------------------------------------
  for (const word of all.match(/\b[A-Z]{3,}\b/g) || []) {
    if (!ALLOWED_CAPS.has(word)) style('all-caps', `Shouting in all caps: "${word}"`);
  }
  if ((ig.match(/!/g) || []).length > 1) style('too-many-exclamations', 'More than one exclamation mark in the Instagram caption.');
  if ((li.match(/!/g) || []).length > 1) style('too-many-exclamations', 'More than one exclamation mark in the LinkedIn post.');
  if (countEmoji(ig) > 3) style('too-many-emoji', `${countEmoji(ig)} emoji in the Instagram caption, cap is 3.`);
  if (countEmoji(li) > 3) style('too-many-emoji', `${countEmoji(li)} emoji in the LinkedIn post, cap is 3.`);

  const cliche = all.match(/\b(game[- ]changer|revolutionary|cutting[- ]edge|unleash|supercharge|skyrocket|10x|secret sauce|ninja|guru|crush it)\b/i);
  if (cliche) style('cliche-language', `Marketing cliche: "${cliche[0]}". Use plainer wording.`);

  return {
    violations: v,
    blocking: v.filter((x) => x.severity === 'block'),
    stylistic: v.filter((x) => x.severity === 'style'),
    passed: v.length === 0,
  };
}

export function describeViolations(list) {
  return list.map((x) => `[${x.severity}] ${x.rule}: ${x.detail}`);
}
