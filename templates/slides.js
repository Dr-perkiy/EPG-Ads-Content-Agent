// Turns a generated content object into the fixed 8-slide EPG carousel.
// The layout never changes; only the copy in the slots does. Text may contain
// *emphasis* markers, which become blue highlighted spans.

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Escape first, then turn *word* into a highlighted span (asterisks survive esc).
const em = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>');

export const SLIDE_CSS = `
:root{
  --bg:#000000;--blue:#4f63f5;--blue-soft:#7d8bff;--white:#fff;--muted:#c9cdd6;
  --line:rgba(255,255,255,.10);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1080px;background:#000;overflow:hidden}
body{font-family:"Segoe UI",Inter,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.slide{width:1080px;height:1080px;background:var(--bg);position:relative;overflow:hidden;display:flex;flex-direction:column;padding:96px 92px}
.slide::before{content:"";position:absolute;inset:0;background:radial-gradient(1100px 620px at 80% -12%, rgba(79,99,245,.28), transparent 60%);pointer-events:none}
.slide>*{position:relative;z-index:1}
.hl{color:var(--blue)}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:auto}
.brand{display:flex;align-items:center;gap:14px}
.brand .mark{width:46px;height:46px;border-radius:11px;background:var(--blue);display:grid;place-items:center;font-weight:900;font-size:22px;color:#fff}
.brand .name{font-weight:800;font-size:24px;letter-spacing:.5px}
.brand .name span{color:var(--blue-soft)}
.counter{font-size:20px;font-weight:700;color:var(--muted);letter-spacing:1px}
.eyebrow{display:inline-flex;align-items:center;gap:12px;font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--blue-soft);margin-bottom:26px}
.eyebrow .dot{width:10px;height:10px;border-radius:50%;background:var(--blue)}
h1{font-size:104px;line-height:.98;font-weight:900;letter-spacing:-2px}
h1 .hl{color:var(--blue)}
h2{font-size:76px;line-height:1.02;font-weight:900;letter-spacing:-1.5px}
h2 .hl{color:var(--blue-soft)}
.lead{font-size:38px;line-height:1.4;color:var(--muted);font-weight:500;margin-top:32px;max-width:840px}
.lead b{color:#fff;font-weight:800}
.lead .hl{color:var(--blue-soft)}
.numwrap{display:flex;align-items:center;gap:28px;margin-bottom:10px}
.num{font-size:150px;font-weight:900;line-height:1;color:var(--blue);letter-spacing:-4px}
.numlabel{font-size:26px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:var(--muted);line-height:1.25}
.body-text{font-size:36px;line-height:1.42;color:var(--muted);font-weight:500;margin-top:26px;max-width:880px}
.body-text b{color:#fff;font-weight:800}
.body-text .hl{color:var(--blue-soft);font-weight:800}
.do{margin-top:38px;padding:28px 32px;border-radius:16px;background:rgba(79,99,245,.12);border:1px solid rgba(79,99,245,.4);display:flex;gap:20px;align-items:flex-start}
.do svg{flex:0 0 auto;margin-top:4px}
.do .k{font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:var(--blue-soft);display:block;margin-bottom:8px}
.do .v{font-size:30px;line-height:1.35;color:#fff;font-weight:600}
.recap{margin-top:34px;display:flex;flex-direction:column;gap:20px}
.recap .item{display:flex;align-items:center;gap:22px;font-size:34px;font-weight:700;color:#fff}
.recap .item .chk{width:52px;height:52px;border-radius:12px;background:rgba(79,99,245,.15);border:1px solid rgba(79,99,245,.45);display:grid;place-items:center;flex:0 0 auto}
.recap .locked{color:var(--muted);font-weight:600}
.recap .locked .chk{background:rgba(255,255,255,.05);border-color:var(--line)}
.cta{margin-top:44px;display:inline-flex;align-items:center;gap:18px;background:var(--blue);color:#fff;font-size:36px;font-weight:900;padding:30px 46px;border-radius:18px;box-shadow:0 20px 60px rgba(79,99,245,.4)}
.url{margin-top:34px;font-size:32px;font-weight:800;color:#fff}
.url span{color:var(--blue-soft)}
.fineprint{margin-top:18px;font-size:24px;color:var(--muted);font-weight:500}
.swipe{position:absolute;bottom:70px;right:92px;z-index:2;display:flex;align-items:center;gap:14px;font-size:24px;font-weight:800;color:#fff;letter-spacing:1px}
.save-badge{position:absolute;bottom:70px;left:92px;z-index:2;display:inline-flex;align-items:center;gap:12px;font-size:24px;font-weight:800;color:var(--blue-soft);letter-spacing:1px}
.end{align-items:center;justify-content:center;text-align:center}
.end .biglogo{width:120px;height:120px;border-radius:26px;background:var(--blue);display:grid;place-items:center;font-weight:900;font-size:54px;margin:0 auto 34px;box-shadow:0 24px 70px rgba(79,99,245,.45)}
.end h2{font-size:88px}
.end .tag{font-size:36px;color:var(--muted);margin-top:24px;font-weight:500}
.end .handle{margin-top:46px;font-size:34px;font-weight:800}
.end .handle span{color:var(--blue-soft)}
.end .share{margin-top:60px;font-size:28px;font-weight:800;color:#fff;display:inline-flex;align-items:center;gap:14px;padding:22px 34px;border:1px solid var(--line);border-radius:16px}
`;

const brandTop = (n, mark) =>
  `<div class="top"><div class="brand"><div class="mark">${esc(mark)}</div><div class="name">EPG<span> ADS</span></div></div><div class="counter">${n} / 8</div></div>`;

const arrow = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const swipe = `<div class="swipe">Swipe ${arrow}</div>`;
const bookmark = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" fill="#7d8bff"/></svg>`;
const check = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4L19 7" stroke="#7d8bff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const checkCircle = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#7d8bff" stroke-width="2"/><path d="M8 12.5l2.5 2.5L16 9" stroke="#7d8bff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const lock = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="#c9cdd6" stroke-width="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="#c9cdd6" stroke-width="2"/></svg>`;

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
    <div class="cta">${esc(c.cta?.button || 'Book your free Google audit')} <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
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
export function slideDoc(slideHtml) {
  return `<!doctype html><meta charset="utf-8"><style>${SLIDE_CSS}</style>${slideHtml}`;
}

/** One multi-page HTML doc (all slides) used to render the LinkedIn PDF. */
export function deckDoc(slides) {
  const pages = slides
    .map((s) => `<div class="page">${s}</div>`)
    .join('');
  const pdfCss = `
    @page{size:1080px 1080px;margin:0}
    html,body{width:1080px;background:#000}
    .page{width:1080px;height:1080px;page-break-after:always;break-after:page;overflow:hidden}
    .page .slide{border-radius:0}
  `;
  return `<!doctype html><meta charset="utf-8"><style>${SLIDE_CSS}${pdfCss}</style>${pages}`;
}
