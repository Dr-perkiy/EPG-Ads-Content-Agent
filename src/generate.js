import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { config, paths } from './config.js';
import { log } from './log.js';
import { assembleDraft, missingFields } from './assemble.js';

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

// ---------------------------------------------------------------------------
// Structured output, FLAT on purpose.
//
// The carousel is declared as a tool schema so the API returns an already
// parsed object instead of text we have to parse. Two bugs drove this design:
//   1. Parsing free-text JSON broke on unescaped quotes and raw line breaks.
//   2. NESTED objects in the tool schema came back mangled: sub-fields
//      collapsed to the top level and parameter markup leaked into values.
// So every field here is a top-level string or array of strings, and the
// nested shape the templates expect is rebuilt in assembleDraft() below.
// ---------------------------------------------------------------------------

const s = (description) => ({ type: 'string', description });
const list = (description, minItems, maxItems) => ({
  type: 'array', items: { type: 'string' }, minItems, maxItems, description,
});

const pointProps = (n) => ({
  [`point${n}Label`]: s(`Point ${n}: a 3 to 6 word tag.`),
  [`point${n}Title`]: s(`Point ${n}: the fix in 3 to 6 words. Highlight one word with *asterisks*.`),
  [`point${n}Body`]: s(`Point ${n}: two or three plain sentences. May emphasise with *asterisks*.`),
  [`point${n}Action`]: s(`Point ${n}: one concrete do-it-now step.`),
});

const PROPS = {
  coverEyebrow: s('Cover label, under 40 characters, normal sentence case.'),
  coverHeadline: s('Cover hook, 6 to 10 words. Wrap 1 or 2 key words in *asterisks*.'),
  coverSubhead: s('Cover subheading, one sentence.'),

  contextEyebrow: s('Context slide label.'),
  contextHeadline: s('Context slide headline stating the stakes. May highlight with *asterisks*.'),
  contextParagraphs: list('One or two short paragraphs. Put the good-news turn in the last one.', 1, 2),

  ...pointProps(1),
  ...pointProps(2),
  ...pointProps(3),

  recapEyebrow: s('Recap label, usually: The honest part'),
  recapHeadline: s('Recap headline, for example: Thats 3. There are usually *8-10*.'),
  recapBody: s('Recap, one or two sentences.'),
  recapDone: list('Three short labels recapping the three points.', 3, 3),
  recapLocked: s('Short list of what is still missing, separated by commas.'),

  ctaEyebrow: s('CTA label.'),
  ctaHeadline: s('CTA headline offering the *free* audit.'),
  ctaBody: s('CTA body, one or two sentences. No pitch, no obligation.'),
  ctaButton: s('Button text, for example: Book your free Google audit'),

  instagramCaption: s('Hook first line, then the three fixes briefly, then the CTA and a save or share nudge. No hashtags in this field.'),
  linkedinPost: s('Slightly more professional than the Instagram caption. Three to six short lines ending with the free-audit CTA and epgads.net. No hashtags in this field.'),

  articleTitle: s('SEO title containing the target keyword and a Tampa or Brandon location.'),
  articleBody: s('A 600 to 900 word article in plain text: short paragraphs, simple headings on their own lines, a short FAQ, ending with the free-audit CTA to epgads.net.'),

  hashtags: list('Five to ten hashtags chosen ONLY from the approved pool.', 5, 10),
};

const CAROUSEL_TOOL = {
  name: 'emit_carousel',
  description: 'Return the finished carousel copy, captions, and article for one post.',
  input_schema: {
    type: 'object',
    properties: PROPS,
    required: Object.keys(PROPS),
  },
};

/** Keep the raw reply on disk when something goes wrong, so it is diagnosable. */
function dumpRaw(label, payload) {
  try {
    fs.mkdirSync(paths.output, { recursive: true });
    const file = path.join(paths.output, 'last-raw-reply.txt');
    fs.writeFileSync(file, `${label}\n\n${payload}`, 'utf8');
    log.warn(`Raw model reply saved to ${file} for inspection.`);
  } catch {
    // Diagnostics must never mask the original error.
  }
}

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
    `- Highlight markers: wrap words in *single asterisks* only inside headline, title, and body fields, at most 2 words per field. Do not use asterisks anywhere else.`,
    ``,
    `THESE WILL CAUSE AN AUTOMATIC REJECTION, so follow them exactly:`,
    `- Never write any word in ALL CAPITAL LETTERS. Use normal sentence case in every field. The design uppercases labels automatically, so type them normally.`,
    `- Never use the percent sign or any percentage. Say "nearly all" or "most" instead.`,
    `- Never write "100% free" or "100% guaranteed". Just say free, or state the guarantee plainly.`,
    `- Never put a specific number in front of businesses, clients, customers, years, or reviews.`,
    `- Never use an em dash, en dash, or double hyphen. Use a comma, colon, or a new sentence.`,
    `- Do not wrap whole sentences in quotation marks. Prefer no quotation marks at all.`,
    `- Never write a fake customer testimonial or quote a customer.`,
  ].join('\n');

  const user = [
    `Topic for this post: "${topic.hook}"`,
    `Angle: ${topic.angle}`,
    `Target search keyword for the article: ${topic.targetKeyword}`,
    `Use these three teaching points in order (rewrite in your own words, do not withhold the answer):`,
    ...topic.points.map((p, i) => `  ${i + 1}. ${p}`),
    recentHooks.length ? `\nDo NOT reuse the phrasing of these recent posts:\n${recentHooks.map((h) => `  - ${h}`).join('\n')}` : '',
    styleFeedback ? `\nThe previous draft had these style issues. Fix them this time:\n${styleFeedback}` : '',
    `\nCall the emit_carousel tool, filling in every field.`,
  ].join('\n');

  log.info(`Generating content with ${config.model} for topic "${topic.id}"`);
  const res = await createWithRetry({
    model: config.model,
    max_tokens: 8000,
    system,
    tools: [CAROUSEL_TOOL],
    tool_choice: { type: 'tool', name: CAROUSEL_TOOL.name },
    messages: [{ role: 'user', content: user }],
  });

  const toolUse = res.content.find((b) => b.type === 'tool_use' && b.name === CAROUSEL_TOOL.name);
  if (!toolUse) {
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    dumpRaw(`stop_reason=${res.stop_reason} (no tool_use block)`, text);
    throw new Error(`Model did not call ${CAROUSEL_TOOL.name} (stop_reason: ${res.stop_reason}).`);
  }
  if (res.stop_reason === 'max_tokens') {
    dumpRaw('stop_reason=max_tokens (truncated tool input)', JSON.stringify(toolUse.input, null, 2));
    throw new Error('Model hit max_tokens before finishing the carousel. Raise max_tokens.');
  }

  const draft = assembleDraft(toolUse.input);

  // Fail loudly here rather than letting empty slides reach the guardrails.
  const missing = missingFields(draft);
  if (missing.length) {
    dumpRaw(`assembled draft missing: ${missing.join(', ')}`, JSON.stringify(toolUse.input, null, 2));
    throw new Error(`Model returned an incomplete carousel (missing: ${missing.join(', ')}).`);
  }

  draft.topicId = topic.id;
  draft.hook = topic.hook;
  return draft;
}
