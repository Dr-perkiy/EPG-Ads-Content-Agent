// Turns a generated content object into the fixed 8-slide EPG carousel.
// The LAYOUT is fixed; only the palette changes (see templates/themes.js), so
// every post stays recognizably EPG while the feed stays visually varied.
// Text may contain *emphasis* markers, which become accent-colored spans.

import { DEFAULT_THEME, themeCss } from './themes.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Escape first, then turn *word* into a highlighted span (asterisks survive esc).
const em = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>');

// Structural CSS only. Every color resolves through a theme custom property,
// and every icon inherits `currentColor`, so a theme swap restyles everything.
export const SLIDE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1080px;background:var(--bg);overflow:hidden}
body{font-family:"Segoe UI",Inter,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased}
.slide{width:1080px;height:1080px;background:var(--bg);position:relative;overflow:hidden;display:flex;flex-direction:column;padding:96px 92px}
.slide::before{content:"";position:absolute;inset:0;background:radial-gradient(1100px 620px at 80% -12%, rgba(var(--accent-rgb), var(--glow)), transparent 60%);pointer-events:none}
.slide>*{position:relative;z-index:1}
.hl{color:var(--accent)}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:auto}
.brand{display:flex;align-items:center;gap:14px}
.brand .mark{width:46px;height:46px;border-radius:11px;background:var(--accent);display:grid;place-items:center;font-weight:900;font-size:22px;color:var(--on-accent)}
.brand .name{font-weight:800;font-size:24px;letter-spacing:.5px;color:var(--text)}
.brand .name span{color:var(--accent-soft)}
.counter{font-size:20px;font-weight:700;color:var(--muted);letter-spacing:1px}
.eyebrow{display:inline-flex;align-items:center;gap:12px;font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--accent-soft);margin-bottom:26px}
.eyebrow .dot{width:10px;height:10px;border-radius:50%;background:var(--accent)}
h1{font-size:104px;line-height:.98;font-weight:900;letter-spacing:-2px;color:var(--text)}
h2{font-size:76px;line-height:1.02;font-weight:900;letter-spacing:-1.5px;color:var(--text)}
h2 .hl{color:var(--accent-soft)}
.lead{font-size:38px;line-height:1.4;color:var(--muted);font-weight:500;margin-top:32px;max-width:840px}
.lead b{color:var(--text);font-weight:800}
.lead .hl{color:var(--accent-soft)}
.numwrap{display:flex;align-items:center;gap:28px;margin-bottom:10px}
.num{font-size:150px;font-weight:900;line-height:1;color:var(--accent);letter-spacing:-4px}
.numlabel{font-size:26px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:var(--muted);line-height:1.25}
.body-text{font-size:36px;line-height:1.42;color:var(--muted);font-weight:500;margin-top:26px;max-width:880px}
.body-text b{color:var(--text);font-weight:800}
.body-text .hl{color:var(--accent-soft);font-weight:800}
.do{margin-top:38px;padding:28px 32px;border-radius:16px;background:rgba(var(--accent-rgb), var(--panel));border:1px solid rgba(var(--accent-rgb), var(--border));display:flex;gap:20px;align-items:flex-start;color:var(--accent-soft)}
.do svg{flex:0 0 auto;margin-top:4px}
.do .k{font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:var(--accent-soft);display:block;margin-bottom:8px}
.do .v{font-size:30px;line-height:1.35;color:var(--text);font-weight:600}
.recap{margin-top:34px;display:flex;flex-direction:column;gap:20px}
.recap .item{display:flex;align-items:center;gap:22px;font-size:34px;font-weight:700;color:var(--text)}
.recap .item .chk{width:52px;height:52px;border-radius:12px;background:rgba(var(--accent-rgb), var(--chk));border:1px solid rgba(var(--accent-rgb), var(--border));display:grid;place-items:center;flex:0 0 auto;color:var(--accent-soft)}
.recap .locked{color:var(--muted);font-weight:600}
.recap .locked .chk{background:var(--lock-bg);border-color:var(--line);color:var(--muted)}
.cta{margin-top:44px;display:inline-flex;align-items:center;gap:18px;background:var(--accent);color:var(--on-accent);font-size:36px;font-weight:900;padding:30px 46px;border-radius:18px;box-shadow:0 20px 60px rgba(var(--accent-rgb), .4)}
.url{margin-top:34px;font-size:32px;font-weight:800;color:var(--text)}
.url span{color:var(--accent-soft)}
.fineprint{margin-top:18px;font-size:24px;color:var(--muted);font-weight:500}
.swipe{position:absolute;bottom:70px;right:92px;z-index:2;display:flex;align-items:center;gap:14px;font-size:24px;font-weight:800;color:var(--text);letter-spacing:1px}
.save-badge{position:absolute;bottom:70px;left:92px;z-index:2;display:inline-flex;align-items:center;gap:12px;font-size:24px;font-weight:800;color:var(--accent-soft);letter-spacing:1px}
.end{align-items:center;justify-content:center;text-align:center}
.end .biglogo{width:120px;height:120px;border-radius:26px;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-weight:900;font-size:54px;margin:0 auto 34px;box-shadow:0 24px 70px rgba(var(--accent-rgb), .45)}
.end h2{font-size:88px}
.end .tag{font-size:36px;color:var(--muted);margin-top:24px;font-weight:500}
.end .handle{margin-top:46px;font-size:34px;font-weight:800;color:var(--text)}
.end .handle span{color:var(--accent-soft)}
.end .share{margin-top:60px;font-size:28px;font-weight:800;color:var(--text);display:inline-flex;align-items:center;gap:14px;padding:22px 34px;border:1px solid var(--line);border-radius:16px}
`;

const brandTop = (n, mark) =>
  `<div class="top"><div class="brand"><div class="mark">${esc(mark)}</div><div class="name">EPG<span> ADS</span></div></div><div class="counter">${n} / 8</div></div>`;

// Icons inherit currentColor so they follow the active theme automatically.
const arrow = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const swipe = `<div class="swipe">Swipe ${arrow}</div>`;
const bookmark = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" fill="currentColor"/></svg>`;
const check = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const checkCircle = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const lock = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" stroke-width="2"/></svg>`;
const ctaArrow = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function buildSlides(c, mark = 'E') {
  const p = c.points || [];
  const point = (i) => {
    const pt = p[i] || {};
    return `<section class="slide">${brandTop(i + 3, mark)}
      <div class="numwrap"><div class="num">${i + 1}</div><div class="numlabel">${em(pt.label || '')}</div></div>
      <h2>${em(pt.title || '')}</h2>
      <p class="body-text">${em(pt.body || '')}</p>
      <div class="do">${checkCircle}<div><span class="k">Do it now</span><span class="v">${em(pt.action || '')}</span></div></div>
      ${swipe}</section>`;
  };

  const cover = `<section class="slide">${brandTop(1, mark)}
    <div class="eyebrow"><span class="dot"></span> ${em(c.cover?.eyebrow || '')}</div>
    <h1>${em(c.cover?.headline || '')}</h1>
    <p class="lead">${em(c.cover?.subhead || '')}</p>
    <div class="save-badge">${bookmark} Save this</div>${swipe}</section>`;

  const contextParas = (c.context?.paragraphs || []).map((x) => `<p class="lead">${em(x)}</p>`).join('');
  const context = `<section class="slide">${brandTop(2, mark)}
    <div class="eyebrow"><span class="dot"></span> ${em(c.context?.eyebrow || '')}</div>
    <h2>${em(c.context?.headline || '')}</h2>
    ${contextParas}${swipe}</section>`;

  const doneItems = (c.recap?.done || []).map((d) => `<div class="item"><span class="chk">${check}</span>${em(d)}</div>`).join('');
  const recap = `<section class="slide">${brandTop(6, mark)}
    <div class="eyebrow"><span class="dot"></span> ${em(c.recap?.eyebrow || 'The honest part')}</div>
    <h2>${em(c.recap?.headline || '')}</h2>
    <p class="body-text">${em(c.recap?.body || '')}</p>
    <div class="recap">${doneItems}<div class="item locked"><span class="chk">${lock}</span>${em(c.recap?.locked || '')}</div></div>${swipe}</section>`;

  const cta = `<section class="slide">${brandTop(7, mark)}
    <div class="eyebrow"><span class="dot"></span> ${em(c.cta?.eyebrow || 'Want the rest?')}</div>
    <h2>${em(c.cta?.headline || '')}</h2>
    <p class="body-text">${em(c.cta?.body || '')}</p>
    <div class="cta">${esc(c.cta?.button || 'Book your free Google audit')} ${ctaArrow}</div>
    <div class="url">${esc(c.cta?.url || 'epgads')}<span>.net</span></div>
    <div class="fineprint">Serving local businesses across Tampa &amp; Brandon, FL</div></section>`;

  const end = `<section class="slide end">
    <div class="biglogo">${esc(mark)}</div>
    <h2>EPG <span class="hl">Ads</span></h2>
    <div class="tag">Local SEO that gets you into Google's top 3.</div>
    <div class="handle">epgads<span>.net</span></div>
    <div class="share">${bookmark} Save &amp; share with an owner who needs it</div></section>`;

  return [cover, context, point(0), point(1), point(2), recap, cta, end];
}

/** One standalone HTML doc for a single slide (used to screenshot a PNG). */
export function slideDoc(slideHtml, theme = DEFAULT_THEME) {
  return `<!doctype html><meta charset="utf-8"><style>${themeCss(theme)}${SLIDE_CSS}</style>${slideHtml}`;
}

/** One multi-page HTML doc (all slides) used to render the LinkedIn PDF. */
export function deckDoc(slides, theme = DEFAULT_THEME) {
  const pages = slides.map((s) => `<div class="page">${s}</div>`).join('');
  const pdfCss = `
    @page{size:1080px 1080px;margin:0}
    html,body{width:1080px;background:var(--bg)}
    .page{width:1080px;height:1080px;page-break-after:always;break-after:page;overflow:hidden}
    .page .slide{border-radius:0}
  `;
  return `<!doctype html><meta charset="utf-8"><style>${themeCss(theme)}${SLIDE_CSS}${pdfCss}</style>${pages}`;
}
