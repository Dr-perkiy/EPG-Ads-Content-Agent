import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { log } from './log.js';

const base = () => `https://graph.facebook.com/${config.meta.apiVersion}`;

async function readGraph(res) {
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok || body.error) {
    const e = body.error || {};
    throw new Error(
      `Meta Graph API ${res.status}: ${e.message || text.slice(0, 300)}` +
        (e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : ''),
    );
  }
  return body;
}

async function graphGet(edge, params = {}) {
  const url = new URL(`${base()}/${edge}`);
  for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
  url.searchParams.set('access_token', config.meta.pageToken);
  return readGraph(await fetch(url));
}

async function graphPost(edge, fields = {}) {
  const body = new URLSearchParams();
  for (const [k, val] of Object.entries(fields)) body.set(k, val);
  body.set('access_token', config.meta.pageToken);
  return readGraph(await fetch(`${base()}/${edge}`, { method: 'POST', body }));
}

/**
 * Instagram cannot accept a file upload; it fetches each image from a public
 * URL. In GitHub Actions we point at raw.githubusercontent.com pinned to the
 * commit that holds the rendered slides (repo must be public). Locally, set
 * IMAGE_BASE_URL to a public folder that already hosts output/.
 */
export function publicImageUrl(pngFile) {
  const name = path.basename(pngFile);
  if (config.imageBaseUrl) return `${config.imageBaseUrl}/${encodeURIComponent(name)}`;
  const sha = process.env.IMAGE_SHA || config.githubSha;
  if (config.githubRepo && sha) {
    return `https://raw.githubusercontent.com/${config.githubRepo}/${sha}/output/${encodeURIComponent(name)}`;
  }
  throw new Error(
    'Instagram needs a public image URL and none could be determined.\n' +
      '  In GitHub Actions the repository must be public (raw URLs are derived automatically),\n' +
      '  or set IMAGE_BASE_URL to a public folder that hosts output/.',
  );
}

export async function assertImageReachable(url) {
  let res;
  try { res = await fetch(url, { method: 'HEAD', redirect: 'follow' }); }
  catch (err) { throw new Error(`Image URL is not reachable (${err.message}): ${url}`); }
  if (!res.ok) throw new Error(`Image URL returned HTTP ${res.status}: ${url}`);
}

async function waitForContainer(id, { attempts = 15, delayMs = 5000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    const s = await graphGet(id, { fields: 'status_code,status' });
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') {
      throw new Error(`Instagram rejected media container ${id} (${s.status_code}): ${s.status || 'no detail'}`);
    }
    log.info(`IG container ${id} ${s.status_code}, waiting (${i}/${attempts})`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Instagram container ${id} never reached FINISHED. Aborting without publishing.`);
}

/**
 * Publishes a multi-image carousel. imageUrls must be public and in slide order.
 */
export async function postCarouselToInstagram({ imageUrls, caption }) {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error(`Instagram carousels need 2 to 10 images, got ${imageUrls.length}.`);
  }

  // 1. Create a child container per image.
  const childIds = [];
  for (const url of imageUrls) {
    const child = await graphPost(`${config.meta.igUserId}/media`, {
      image_url: url,
      is_carousel_item: 'true',
    });
    childIds.push(child.id);
  }
  log.info(`Created ${childIds.length} IG carousel item containers`);
  for (const id of childIds) await waitForContainer(id);

  // 2. Create the carousel parent container.
  const parent = await graphPost(`${config.meta.igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
  });
  await waitForContainer(parent.id);

  // 3. Publish.
  const published = await graphPost(`${config.meta.igUserId}/media_publish`, {
    creation_id: parent.id,
  });

  let permalink = null;
  try { permalink = (await graphGet(published.id, { fields: 'permalink' })).permalink; } catch {}

  return { platform: 'instagram', mediaId: published.id, url: permalink };
}

export async function inspectInstagram() {
  return graphGet(config.meta.igUserId, {
    fields: 'id,username,name,followers_count,media_count',
  });
}

// ---------------------------------------------------------------------------
// Facebook Page (multi-photo post)
// ---------------------------------------------------------------------------

/**
 * Publishes a multi-photo post to the Facebook Page. Each slide is uploaded
 * unpublished (published=false) via multipart, so Facebook needs no public URL,
 * then all photo ids are attached to a single feed post. This shows as a photo
 * post/album on the Page (Facebook has no swipeable carousel like Instagram).
 */
export async function postAlbumToFacebook({ pngFiles, message }) {
  const pageId = config.meta.pageId;
  const mediaFbids = [];
  for (const file of pngFiles) {
    const form = new FormData();
    const bytes = fs.readFileSync(file);
    form.append('source', new Blob([bytes], { type: 'image/png' }), path.basename(file));
    form.append('published', 'false');
    form.append('access_token', config.meta.pageToken);
    const res = await fetch(`${base()}/${pageId}/photos`, { method: 'POST', body: form });
    const body = await readGraph(res);
    mediaFbids.push(body.id);
  }
  log.info(`Uploaded ${mediaFbids.length} unpublished photos to Facebook`);

  const fields = { message };
  mediaFbids.forEach((id, i) => { fields[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
  const post = await graphPost(`${pageId}/feed`, fields);

  return {
    platform: 'facebook',
    postId: post.id,
    url: `https://facebook.com/${post.id}`,
  };
}

export async function inspectFacebookPage() {
  return graphGet(config.meta.pageId, { fields: 'id,name,fan_count,link' });
}
