import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, paths, loadBrand, validateConfig } from './config.js';
import { log } from './log.js';
import { pickNextTopic, pickNextTheme, recentHooks, isPaused, appendToLedger, relative, daysSinceLastPost } from './state.js';
import { generateContent } from './generate.js';
import { checkContent, describeViolations } from './guardrails.js';
import { renderCarousel } from './render.js';

/**
 * Phase 1: pick a topic, generate the copy, run guardrails, render the slides,
 * and stage everything in output/. Publishes nothing. Returns the draft, or
 * null if the run was blocked or should not proceed.
 */
export async function buildContent() {
  if (!config.enabled) { log.warn('AGENT_ENABLED is false. Skipping build.'); return null; }
  if (isPaused()) { log.warn('Kill switch active (state/PAUSED). Skipping build.'); return null; }

  // Each schedule window fires several times so a dropped GitHub run still
  // lands. Only the first attempt that gets through should post.
  if (config.minGapHours > 0) {
    const days = daysSinceLastPost();
    if (days !== null && days * 24 < config.minGapHours) {
      log.info(
        `Last post was ${(days * 24).toFixed(1)}h ago, inside the ${config.minGapHours}h minimum gap. ` +
          'This is a duplicate attempt from the same window. Skipping.',
      );
      return null;
    }
  }

  const brand = loadBrand();
  const topic = pickNextTopic();
  log.info(`This week's topic: ${topic.id} - "${topic.hook}"`);

  let draft = await generateContent({ topic, brand, recentHooks: recentHooks() });
  let check = checkContent(draft, brand);

  if (check.blocking.length === 0 && check.stylistic.length) {
    log.warn('Stylistic issues, regenerating once:', describeViolations(check.stylistic));
    draft = await generateContent({
      topic, brand, recentHooks: recentHooks(),
      styleFeedback: describeViolations(check.stylistic).join('\n'),
    });
    check = checkContent(draft, brand);
  }

  if (check.blocking.length) {
    log.error('BLOCKED. Nothing will be rendered or posted:', describeViolations(check.blocking));
    appendToLedger({
      topicId: topic.id, hook: topic.hook, outcome: 'blocked',
      postedAt: new Date().toISOString(), violations: describeViolations(check.blocking),
    });
    process.exitCode = 1;
    return null;
  }
  log.ok('Guardrails passed');

  const theme = pickNextTheme(topic);
  draft.themeId = theme.id;
  log.info(`Palette this run: ${theme.name}`);
  const { pngFiles, pdfFile } = await renderCarousel(draft, theme);

  fs.writeFileSync(path.join(paths.output, 'content.json'), JSON.stringify(draft, null, 2));
  fs.writeFileSync(
    path.join(paths.output, 'instagram-caption.txt'),
    `${draft.instagramCaption}\n\n${(draft.hashtags || []).join(' ')}\n`,
  );
  fs.writeFileSync(path.join(paths.output, 'linkedin-post.txt'), `${draft.linkedinPost}\n`);
  if (draft.article?.body) {
    fs.writeFileSync(path.join(paths.output, 'article.md'), `# ${draft.article.title}\n\n${draft.article.body}\n`);
  }
  log.ok(`Staged output in ${relative(paths.output)}/`);
  return { draft, pngFiles, pdfFile };
}

// Runnable directly as CI phase 1.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  log.step('EPG content agent - build');
  validateConfig();
  const built = await buildContent();
  // The workflow gates the publish step on this, so a skipped build never
  // republishes whatever is left in output/ from the previous run.
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `built=${built ? 'true' : 'false'}
`);
  }
}
