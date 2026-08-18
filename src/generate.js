import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { log } from './log.js';

// maxRetries handles the SDK's own automatic backoff; the wrapper below adds a
// few more attempts for longer overload spikes (429/5xx/529 "Overloaded").
const client = new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 5 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createWithRetry(params, { attempts = 4, baseMs = 8000 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      const status = err?.status;
      const retryable = status === 429 || status === 529 || (status >= 500 && status < 600);
      lastErr = err;
      if (!retryable || i === attempts) throw err;
      const wait = baseMs * i; // 8s, 16s, 24s
      log.warn(`Anthropic API ${status} (${err?.error?.error?.type || 'error'}); retry ${i}/${attempts - 1} in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

// Models often emit real line breaks inside string values (e.g. a multi-line
// LinkedIn post), which is invalid JSON. Escape control chars that occur INSIDE
// string literals so JSON.parse succeeds while preserving the line breaks.
function escapeControlCharsInStrings(s) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && ch === '\n') { out += '\\n'; continue; }
    if (inStr && ch === '\r') { out += '\\r'; continue; }
    if (inStr && ch === '\t') { out += '\\t'; continue; }
    out += ch;
  }
  return out;
}

function parseJson(text) {
  // Tolerate accidental code fences or leading prose around the JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON.');
  return JSON.parse(escapeControlCharsInStrings(raw.slice(start, end + 1)));
}

const SCHEMA = `Return ONLY a JSON object with exactly this shape:
{
  "cover":   { "eyebrow": "string, <= 40 chars, uppercase-ish label", "headline": "string, punchy hook, 6-10 words, wrap 1-2 key words in *asterisks* to highlight them", "subhead": "string, one sentence, may use *asterisks* on 1-2 words" },
  "context": { "eyebrow": "string label", "headline": "string, the stakes, may highlight with *asterisks*", "paragraphs": ["sentence 1", "sentence 2 (keep the good-news turn here)"] },
  "points":  [ { "label": "3-6 word tag, may wrap to lines", "title": "the fix, 3-6 words, highlight 1 word with *asterisks*", "body": "2-3 plain sentences, may bold with *asterisks*", "action": "one concrete do-it-now step" }, {second}, {third} ],
  "recap":   { "eyebrow": "The honest part", "headline": "That's 3. There are usually *8-10*.", "body": "1-2 sentences", "done": ["short label 1", "short label 2", "short label 3"], "locked": "Reviews - citations - on-page SEO - +more" },
  "cta":     { "eyebrow": "short label", "headline": "offer the *free* audit, may highlight", "body": "1-2 sentences, no pitch, no obligation", "button": "Book your free Google audit", "url": "epgads" },
  "instagramCaption": "string, hook first line, teach the 3 fixes briefly, end with the CTA and a save/share nudge. No hashtags in here.",
  "linkedinPost": "string, slightly more professional than IG, 3-6 short lines, ends with the free-audit CTA and epgads.net. No hashtags in here.",
  "article": { "title": "SEO title with the target keyword and a Tampa/Brandon location", "body": "600-900 word LinkedIn article in plain text with short paragraphs and simple headings on their own lines. Cover the 3 points in depth, add a short FAQ, and end with the free-audit CTA to epgads.net." },
  "hashtags": ["#Tag", "..."]
}`;

export async function generateContent({ topic, brand, recentHooks, styleFeedback }) {
  const system = [
    `You are the content writer for ${brand.business.name}, ${brand.business.what}, serving ${brand.business.serviceArea}.`,
    `Audience: ${brand.business.audience}.`,
    `Voice: ${brand.voice.tone} Point of view: ${brand.voice.pointOfView}.`,
    `Hard rules:`,
    ...brand.voice.rules.map((r) => `- ${r}`),
    `- The ONLY offer you may mention is the free Google audit and the guarantee: "${brand.offer.guarantee}". ${brand.offer.note}`,
    `- Never invent statistics, client counts, revenue numbers, star ratings, awards, or testimonials.`,
    `- The website is ${brand.business.website}. Never mention any other domain, phone number, or email.`,
    `- Hashtags MUST be chosen only from this pool, 5 to 10 of them: ${brand.hashtagPool.join(' ')}`,
    `- Highlight markers: wrap words in *single asterisks* only inside headline/title/body fields, at most 2 words per field. Do not use asterisks anywhere else.`,
    ``,
    `THESE WILL CAUSE AN AUTOMATIC REJECTION, so follow them exactly:`,
    `- Never write any word in ALL CAPITAL LETTERS. Use normal sentence case everywhere. The design already displays labels in uppercase automatically, so you must type them in normal case.`,
    `- Never use the percent sign or any percentage. Do not write "100%", "90%", etc. Say "nearly all" or "most" instead.`,
    `- Never write "100% free" or "100% guaranteed". Just say "free" or state the guarantee plainly.`,
    `- Never put a specific number in front of businesses, clients, customers, years, or reviews (no "helped 200 businesses", no "10 years").`,
    `- Never use an em dash, en dash, or double hyphen. Use a comma, colon, or a new sentence.`,
    `- Do not wrap whole sentences in quotation marks. Write them plainly. Quotation marks are only for a short specific term.`,
    `- Never write a fake customer testimonial or quote a customer.`,
  ].join('\n');

  const user = [
    `This week's topic: "${topic.hook}"`,
    `Angle: ${topic.angle}`,
    `Target search keyword for the article: ${topic.targetKeyword}`,
    `Use these three teaching points in order (rewrite in your own words, do not withhold the answer):`,
    ...topic.points.map((p, i) => `  ${i + 1}. ${p}`),
    recentHooks.length ? `\nDo NOT reuse the phrasing of these recent posts:\n${recentHooks.map((h) => `  - ${h}`).join('\n')}` : '',
    styleFeedback ? `\nThe previous draft had these style issues. Fix them this time:\n${styleFeedback}` : '',
    `\n${SCHEMA}`,
  ].join('\n');

  log.info(`Generating content with ${config.model} for topic "${topic.id}"`);
  const res = await createWithRetry({
    model: config.model,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const draft = parseJson(text);
  draft.topicId = topic.id;
  draft.hook = topic.hook;
  return draft;
}
