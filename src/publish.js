import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, paths, validateConfig } from './config.js';
import { log } from './log.js';
import { appendToLedger, loadLedger } from './state.js';
import { postCarouselToInstagram, postAlbumToFacebook, publicImageUrl, assertImageReachable } from './meta.js';
import { postDocumentToLinkedIn } from './linkedin.js';

function loadStaged() {
  const contentFile = path.join(paths.output, 'content.json');
  if (!fs.existsSync(contentFile)) {
    throw new Error('output/content.json not found. Run the build step first.');
  }
  const draft = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  const pngFiles = fs
    .readdirSync(paths.output)
    .filter((f) => /^slide-\d+\.png$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
    .map((f) => path.join(paths.output, f));
  const pdfFile = path.join(paths.output, 'carousel.pdf');
  return { draft, pngFiles, pdfFile };
}

/**
 * Phase 2: publish the already-staged carousel to the configured platforms.
 */
export async function publishStaged() {
  if (config.dryRun) { log.warn('DRY_RUN is true. Refusing to publish.'); return; }

  const { draft, pngFiles, pdfFile } = loadStaged();

  // Safety net: output/ persists between runs, so a skipped or failed build
  // leaves last run's files sitting there. Never post the same topic twice
  // inside the minimum gap.
  const lastPublished = loadLedger().posts.filter((p) => p.outcome === 'published').pop();
  if (lastPublished && lastPublished.topicId === draft.topicId && config.minGapHours > 0) {
    const hours = (Date.now() - new Date(lastPublished.postedAt).getTime()) / 3_600_000;
    if (hours < config.minGapHours) {
      log.warn(
        `Staged content is topic "${draft.topicId}", already published ${hours.toFixed(1)}h ago. ` +
          'Refusing to post a duplicate.',
      );
      return;
    }
  }
  const igCaption = `${draft.instagramCaption}\n\n${(draft.hashtags || []).join(' ')}`;
  const results = [];
  const errors = [];

  if (config.platforms.includes('instagram')) {
    try {
      log.step('Publishing to Instagram');
      if (pngFiles.length < 2) throw new Error(`Need at least 2 slide PNGs, found ${pngFiles.length}.`);
      const imageUrls = pngFiles.map(publicImageUrl);
      for (const u of imageUrls) await assertImageReachable(u);
      const r = await postCarouselToInstagram({ imageUrls, caption: igCaption });
      log.ok(`Instagram posted: ${r.url || r.mediaId}`);
      results.push(r);
    } catch (err) {
      log.error(`Instagram failed: ${err.message}`);
      errors.push({ platform: 'instagram', error: err.message });
    }
  }

  if (config.platforms.includes('facebook')) {
    try {
      log.step('Publishing to Facebook');
      if (pngFiles.length < 1) throw new Error('No slide PNGs to post.');
      const r = await postAlbumToFacebook({ pngFiles, message: igCaption });
      log.ok(`Facebook posted: ${r.url || r.postId}`);
      results.push(r);
    } catch (err) {
      log.error(`Facebook failed: ${err.message}`);
      errors.push({ platform: 'facebook', error: err.message });
    }
  }

  if (config.platforms.includes('linkedin')) {
    try {
      log.step('Publishing to LinkedIn');
      if (!fs.existsSync(pdfFile)) throw new Error('carousel.pdf not found.');
      const r = await postDocumentToLinkedIn({
        pdfFile,
        commentary: draft.linkedinPost,
        title: draft.article?.title || draft.hook,
      });
      log.ok(`LinkedIn posted: ${r.url || r.postUrn}`);
      results.push(r);
    } catch (err) {
      log.error(`LinkedIn failed: ${err.message}`);
      errors.push({ platform: 'linkedin', error: err.message });
    }
  }

  appendToLedger({
    topicId: draft.topicId,
    themeId: draft.themeId,
    hook: draft.hook,
    outcome: results.length ? 'published' : 'failed',
    postedAt: new Date().toISOString(),
    platforms: results.map((r) => r.platform),
    urls: results.map((r) => r.url).filter(Boolean),
    errors: errors.length ? errors : undefined,
  });

  if (!results.length) { log.error('Nothing published on any platform.'); process.exitCode = 1; }
  else if (errors.length) log.warn(`Published to ${results.map((r) => r.platform).join(', ')}, some platforms failed.`);
  else log.ok('Done.');
}

// Runnable directly as CI phase 2.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  log.step('EPG content agent - publish');
  validateConfig();
  await publishStaged();
}
