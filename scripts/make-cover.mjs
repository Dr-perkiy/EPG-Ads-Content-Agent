// Renders a LinkedIn article cover image (1280x720, the size LinkedIn wants).
//
//   npm run cover                          # uses the title in output/content.json
//   npm run cover -- "Your headline here"  # explicit headline
//   npm run cover -- "Headline" ocean      # explicit headline + palette id
//
// Output: output/article-cover.png
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { paths } from '../src/config.js';
import { THEMES, themeById, themeCss, DEFAULT_THEME } from '../templates/themes.js';

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// *word* becomes an accent-colored span, same convention as the carousel.
const em = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>');

const args = process.argv.slice(2).filter((a) => a !== '--');
let headline = args[0];
let themeArg = args[1];
let eyebrow = 'Local SEO';

if (!headline) {
  const file = path.join(paths.output, 'content.json');
  if (!fs.existsSync(file)) {
    console.error('No headline given and output/content.json not found.');
    console.error('Usage: npm run cover -- "Your headline" [themeId]');
    process.exit(1);
  }
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  // The carousel cover hook reads better on an image than the long SEO title.
  headline = c.cover?.headline || c.article?.title || '';
  eyebrow = c.cover?.eyebrow || eyebrow;
  if (!themeArg && c.themeId) themeArg = c.themeId;
}

const theme = themeArg ? themeById(themeArg) : DEFAULT_THEME;
if (themeArg && !THEMES.some((t) => t.id === themeArg)) {
  console.warn(`Unknown theme "${themeArg}", falling back to ${theme.id}.`);
}

// A schematic map pack: three ranked results, then a dimmed "you" row far below.
// Names are deliberately abstract bars so no real business is implied.
const row = (n) => `
  <div class="row">
    <div class="rank">${n}</div>
    <div class="lines">
      <div class="bar w${n}"></div>
      <div class="stars">
        ${'<i></i>'.repeat(5)}
        <span class="revs"></span>
      </div>
    </div>
    <div class="callbtn"></div>
  </div>`;

const html = `<!doctype html><meta charset="utf-8"><style>
${themeCss(theme)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1280px;height:720px;background:var(--bg);overflow:hidden}
body{font-family:"Segoe UI",Inter,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased}
.wrap{width:1280px;height:720px;position:relative;display:flex;align-items:center;gap:56px;padding:64px 68px;overflow:hidden}
.wrap::before{content:"";position:absolute;inset:0;background:radial-gradient(900px 520px at 88% -10%, rgba(var(--accent-rgb), var(--glow)), transparent 62%);pointer-events:none}
.wrap>*{position:relative;z-index:1}

.left{width:620px;flex:0 0 auto}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:30px}
.brand .mark{width:40px;height:40px;border-radius:10px;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-weight:900;font-size:19px}
.brand .name{font-weight:800;font-size:21px;letter-spacing:.4px}
.brand .name span{color:var(--accent-soft)}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:17px;font-weight:800;letter-spacing:2.4px;text-transform:uppercase;color:var(--accent-soft);margin-bottom:20px}
.eyebrow .dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
h1{font-size:60px;line-height:1.03;font-weight:900;letter-spacing:-1.6px}
h1 .hl{color:var(--accent)}
.rule{width:96px;height:6px;border-radius:3px;background:var(--accent);margin:30px 0 24px}
.url{font-size:23px;font-weight:800}
.url span{color:var(--accent-soft)}

.card{flex:1 1 auto;height:100%;border-radius:22px;padding:22px;background:rgba(var(--accent-rgb), var(--panel));border:1px solid rgba(var(--accent-rgb), var(--border));display:flex;flex-direction:column;justify-content:center;gap:14px}
.searchbar{height:46px;border-radius:23px;background:var(--lock-bg);border:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:0 18px;flex:0 0 auto}
.searchbar .mag{width:16px;height:16px;border-radius:50%;border:2.5px solid var(--muted);position:relative}
.searchbar .mag::after{content:"";position:absolute;right:-6px;bottom:-4px;width:8px;height:2.5px;background:var(--muted);transform:rotate(45deg)}
.searchbar .q{height:9px;width:172px;border-radius:5px;background:var(--muted);opacity:.55}
.map{height:104px;border-radius:14px;position:relative;overflow:hidden;background:linear-gradient(135deg, rgba(var(--accent-rgb),.30), rgba(var(--accent-rgb),.08));border:1px solid var(--line);flex:0 0 auto}
.map i{position:absolute;width:16px;height:16px;border-radius:50% 50% 50% 0;background:var(--accent);transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.35)}
.map i:nth-of-type(1){left:19%;top:34%}
.map i:nth-of-type(2){left:49%;top:20%}
.map i:nth-of-type(3){left:74%;top:48%}
.map .road{position:absolute;background:var(--line)}
.map .road.a{left:0;right:0;top:62%;height:3px}
.map .road.b{top:0;bottom:0;left:38%;width:3px}

.row{display:flex;align-items:center;gap:14px;padding:13px 14px;border-radius:13px;background:var(--lock-bg);border:1px solid var(--line);flex:0 0 auto}
.rank{width:30px;height:30px;border-radius:9px;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-weight:900;font-size:15px;flex:0 0 auto}
.lines{flex:1 1 auto;display:flex;flex-direction:column;gap:8px}
.bar{height:11px;border-radius:6px;background:var(--text);opacity:.85}
.bar.w1{width:78%}.bar.w2{width:64%}.bar.w3{width:71%}
.stars{display:flex;align-items:center;gap:4px}
.stars i{width:9px;height:9px;background:var(--accent-soft);clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
.stars .revs{width:44px;height:7px;border-radius:4px;background:var(--muted);opacity:.5;margin-left:6px}
.callbtn{width:52px;height:26px;border-radius:13px;background:var(--accent);opacity:.9;flex:0 0 auto}

.gap{display:flex;align-items:center;justify-content:center;gap:7px;padding:2px 0;flex:0 0 auto}
.gap b{width:5px;height:5px;border-radius:50%;background:var(--muted);opacity:.55}

.you{display:flex;align-items:center;gap:14px;padding:13px 14px;border-radius:13px;border:1px dashed var(--line);flex:0 0 auto}
.you .rank{background:transparent;border:1.5px solid var(--muted);color:var(--muted)}
.you .label{font-size:16px;font-weight:800;color:var(--muted);letter-spacing:.2px}
</style>
<div class="wrap">
  <div class="left">
    <div class="brand"><div class="mark">E</div><div class="name">EPG<span> ADS</span></div></div>
    <div class="eyebrow"><span class="dot"></span> ${em(eyebrow)}</div>
    <h1>${em(headline)}</h1>
    <div class="rule"></div>
    <div class="url">epgads<span>.net</span></div>
  </div>

  <div class="card">
    <div class="searchbar"><span class="mag"></span><span class="q"></span></div>
    <div class="map"><span class="road a"></span><span class="road b"></span><i></i><i></i><i></i></div>
    ${row(1)}${row(2)}${row(3)}
    <div class="gap"><b></b><b></b><b></b></div>
    <div class="you">
      <div class="rank">7</div>
      <div class="label">Your business</div>
    </div>
  </div>
</div>`;

fs.mkdirSync(paths.output, { recursive: true });
const out = path.join(paths.output, 'article-cover.png');

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 720 } });
} finally {
  await browser.close();
}
console.log(`Cover written to ${out} (palette: ${theme.id})`);
