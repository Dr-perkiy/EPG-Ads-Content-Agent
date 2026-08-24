// Rebuilds the nested draft shape the templates and guardrails expect from the
// FLAT tool-call fields returned by the model.
//
// Why flat: nested objects in the tool schema came back mangled, with sub-fields
// collapsed to the top level and internal parameter markup leaking into values.
// Keeping every schema field a top-level string or string array avoids that
// entirely, and this module puts the structure back.
//
// Kept free of any SDK import so it can be unit tested without credentials.

/** Strip leaked tool markup, normalise arrays, and trim. */
export const clean = (v) => {
  if (Array.isArray(v)) return v.map(clean).filter(Boolean);
  if (typeof v !== 'string') return v ?? '';
  return v
    .replace(/<\/?parameter[^>]*>/g, '')
    .replace(/<\/?antml:[^>]*>/g, '')
    .trim();
};

export function assembleDraft(f) {
  const point = (n) => ({
    label: clean(f[`point${n}Label`]),
    title: clean(f[`point${n}Title`]),
    body: clean(f[`point${n}Body`]),
    action: clean(f[`point${n}Action`]),
  });

  return {
    cover: {
      eyebrow: clean(f.coverEyebrow),
      headline: clean(f.coverHeadline),
      subhead: clean(f.coverSubhead),
    },
    context: {
      eyebrow: clean(f.contextEyebrow),
      headline: clean(f.contextHeadline),
      paragraphs: clean(f.contextParagraphs || []),
    },
    points: [point(1), point(2), point(3)],
    recap: {
      eyebrow: clean(f.recapEyebrow) || 'The honest part',
      headline: clean(f.recapHeadline),
      body: clean(f.recapBody),
      done: clean(f.recapDone || []),
      locked: clean(f.recapLocked),
    },
    cta: {
      eyebrow: clean(f.ctaEyebrow),
      headline: clean(f.ctaHeadline),
      body: clean(f.ctaBody),
      button: clean(f.ctaButton) || 'Book your free Google audit',
      url: 'epgads',
    },
    instagramCaption: clean(f.instagramCaption),
    linkedinPost: clean(f.linkedinPost),
    article: { title: clean(f.articleTitle), body: clean(f.articleBody) },
    hashtags: clean(f.hashtags || []),
  };
}

/** Field paths that must be non-empty for a draft to be renderable. */
export function missingFields(draft) {
  const missing = [];
  if (!draft.cover.headline) missing.push('cover.headline');
  if (!draft.cta.headline) missing.push('cta.headline');
  if (!draft.instagramCaption) missing.push('instagramCaption');
  if (!draft.linkedinPost) missing.push('linkedinPost');
  if (draft.points.some((p) => !p.title || !p.body)) missing.push('points');
  return missing;
}
