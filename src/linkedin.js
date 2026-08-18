import fs from 'node:fs';
import { config } from './config.js';
import { log } from './log.js';

const REST = 'https://api.linkedin.com/rest';

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${config.linkedin.token}`,
    'LinkedIn-Version': config.linkedin.apiVersion,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  };
}

async function readLi(res) {
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    throw new Error(`LinkedIn API ${res.status}: ${body.message || text.slice(0, 300)}`);
  }
  return { body, res };
}

/**
 * LinkedIn "commentary" uses a little-language where these characters are
 * reserved and must be backslash-escaped or the post is rejected.
 */
export function escapeCommentary(text) {
  return String(text).replace(/([\\<>#~_|{}()\[\]@*])/g, '\\$1');
}

// 1. Reserve a document and get a one-time upload URL.
async function initializeUpload(owner) {
  const { body } = await readLi(
    await fetch(`${REST}/documents?action=initializeUpload`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    }),
  );
  const value = body.value || {};
  if (!value.uploadUrl || !value.document) {
    throw new Error('LinkedIn initializeUpload did not return an uploadUrl and document urn.');
  }
  return { uploadUrl: value.uploadUrl, documentUrn: value.document };
}

// 2. Upload the PDF bytes to the one-time URL.
async function uploadBinary(uploadUrl, buffer) {
  // The versioned upload endpoint accepts the raw bytes with the bearer token.
  // Some tenants want PUT, others POST; try PUT then fall back to POST.
  const attempt = (method) =>
    fetch(uploadUrl, {
      method,
      headers: { Authorization: `Bearer ${config.linkedin.token}`, 'Content-Type': 'application/pdf' },
      body: buffer,
    });
  let res = await attempt('PUT');
  if (res.status === 405 || res.status === 400) res = await attempt('POST');
  if (!res.ok) throw new Error(`LinkedIn document upload failed: HTTP ${res.status}`);
}

// 3. Create the post referencing the uploaded document.
async function createDocumentPost({ author, commentary, documentUrn, title }) {
  const payload = {
    author,
    commentary: escapeCommentary(commentary),
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    content: { media: { title: title.slice(0, 100), id: documentUrn } },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  const { res } = await readLi(
    await fetch(`${REST}/posts`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }),
  );
  const postUrn = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id');
  return postUrn;
}

/**
 * Publishes the carousel PDF as a native LinkedIn document post (swipeable),
 * with the given commentary as the post text.
 */
export async function postDocumentToLinkedIn({ pdfFile, commentary, title }) {
  const author = config.linkedin.authorUrn;
  const buffer = fs.readFileSync(pdfFile);

  const { uploadUrl, documentUrn } = await initializeUpload(author);
  log.info(`LinkedIn document reserved: ${documentUrn}`);
  await uploadBinary(uploadUrl, buffer);
  log.info('LinkedIn document uploaded');
  const postUrn = await createDocumentPost({ author, commentary, documentUrn, title });

  return {
    platform: 'linkedin',
    postUrn: postUrn || documentUrn,
    url: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : null,
  };
}
