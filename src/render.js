import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { paths } from './config.js';
import { log } from './log.js';
import { buildSlides, slideDoc, deckDoc } from '../templates/slides.js';

/**
 * Renders the carousel to disk:
 *   output/slide-1.png ... slide-8.png   (1080x1080, for Instagram)
 *   output/carousel.pdf                   (8 square pages, for LinkedIn documents)
 * Returns { pngFiles: [...], pdfFile }.
 */
export async function renderCarousel(draft) {
  fs.mkdirSync(paths.output, { recursive: true });
  // Clear stale output so a failed run never leaves last week's slides behind.
  for (const f of fs.readdirSync(paths.output)) {
    if (/^slide-\d+\.png$/.test(f) || f === 'carousel.pdf') fs.rmSync(path.join(paths.output, f));
  }

  const slides = buildSlides(draft);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });

  const pngFiles = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

    for (let i = 0; i < slides.length; i++) {
      // Content is fully inline (no network), so wait for the DOM, not idle.
      await page.setContent(slideDoc(slides[i]), { waitUntil: 'domcontentloaded' });
      const file = path.join(paths.output, `slide-${i + 1}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1080 } });
      pngFiles.push(file);
    }
    log.ok(`Rendered ${pngFiles.length} slide PNGs`);

    // One document with every slide as its own square page, for LinkedIn.
    const pdfPage = await browser.newPage();
    pdfPage.setDefaultTimeout(60000);
    await pdfPage.setContent(deckDoc(slides), { waitUntil: 'domcontentloaded' });
    const pdfFile = path.join(paths.output, 'carousel.pdf');
    await pdfPage.pdf({
      path: pdfFile,
      width: '1080px',
      height: '1080px',
      printBackground: true,
      pageRanges: `1-${slides.length}`,
    });
    log.ok('Rendered carousel.pdf for LinkedIn');

    return { pngFiles, pdfFile };
  } finally {
    await browser.close();
  }
}
