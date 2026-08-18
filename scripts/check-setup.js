// Verifies credentials and connections without posting. Run: npm run check
import { config } from '../src/config.js';
import { inspectInstagram, inspectFacebookPage } from '../src/meta.js';

const yn = (v) => (v ? 'set' : 'MISSING');
console.log('Config presence:');
console.log(`  ANTHROPIC_API_KEY        ${yn(config.anthropicApiKey)}`);
console.log(`  Platforms                ${config.platforms.join(', ') || '(none)'}`);
console.log(`  DRY_RUN                  ${config.dryRun}`);
console.log(`  AGENT_ENABLED            ${config.enabled}`);
console.log('Instagram / Facebook (Meta):');
console.log(`  META_PAGE_ACCESS_TOKEN   ${yn(config.meta.pageToken)}`);
console.log(`  META_IG_USER_ID          ${yn(config.meta.igUserId)}`);
console.log(`  META_PAGE_ID             ${config.meta.pageId || 'MISSING'}`);
console.log('LinkedIn:');
console.log(`  LINKEDIN_ACCESS_TOKEN    ${yn(config.linkedin.token)}`);
console.log(`  LINKEDIN_AUTHOR_URN      ${config.linkedin.authorUrn || 'MISSING'}`);

if (config.platforms.includes('instagram') && config.meta.pageToken && config.meta.igUserId) {
  try {
    const ig = await inspectInstagram();
    console.log(`\nInstagram OK: @${ig.username} (${ig.followers_count} followers, ${ig.media_count} posts)`);
  } catch (err) {
    console.log(`\nInstagram check FAILED: ${err.message}`);
  }
}

if (config.platforms.includes('facebook') && config.meta.pageToken && config.meta.pageId) {
  try {
    const fb = await inspectFacebookPage();
    console.log(`Facebook OK: ${fb.name} (${fb.fan_count ?? 0} followers)`);
  } catch (err) {
    console.log(`Facebook check FAILED: ${err.message}`);
  }
}

if (config.platforms.includes('linkedin') && config.linkedin.token) {
  try {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${config.linkedin.token}` },
    });
    if (res.ok) {
      const me = await res.json();
      console.log(`LinkedIn token OK: ${me.name || me.sub} (person urn: urn:li:person:${me.sub})`);
    } else {
      console.log(`LinkedIn userinfo returned HTTP ${res.status} (fine if this is an organization-only token).`);
    }
  } catch (err) {
    console.log(`LinkedIn check error: ${err.message}`);
  }
}
