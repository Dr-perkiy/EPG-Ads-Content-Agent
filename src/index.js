// Local convenience entry point: build then publish in one process.
// In CI the two phases run separately (build -> commit output -> publish) so
// Instagram can fetch the committed images by public URL. See .github/workflows.
//
//   npm run preview   # dry run: generate + render + stage, publish nothing
//   npm run post      # build + publish (needs credentials and DRY_RUN=false)
import { config, validateConfig } from './config.js';
import { log } from './log.js';
import { buildContent } from './build.js';
import { publishStaged } from './publish.js';

async function main() {
  log.step('EPG Ads content agent');
  validateConfig();

  const built = await buildContent();
  if (!built) return;

  if (config.dryRun) {
    log.step('DRY RUN - nothing published');
    log.info('Instagram caption:', `${built.draft.instagramCaption}\n\n${(built.draft.hashtags || []).join(' ')}`);
    log.info('LinkedIn post:', built.draft.linkedinPost);
    log.info('Review output/: slide-1..8.png, carousel.pdf, article.md. Set DRY_RUN=false to publish.');
    return;
  }

  // Note: single-process publishing needs IMAGE_BASE_URL for Instagram, since
  // there is no committed GitHub SHA. CI uses the two-phase workflow instead.
  await publishStaged();
}

main().catch((err) => {
  log.error(`Fatal: ${err.message}`, err.stack);
  process.exitCode = 1;
});
