/**
 * EBS Aprendiz — Exportar UM carrossel HTML como PNGs 1080×1350px
 *
 * Uso: node scripts/export-one.js <carouselId>
 * Ex.:  node scripts/export-one.js tweet-guitarra-sozinho-01
 *
 * Detecta automaticamente se o carrossel é:
 *  - Editorial (slides com classe `.slide`)        → script clássico
 *  - Tweet (carousel-track com .x-slide)           → roteiro Playwright do skill
 *
 * Atualiza queue.json com os caminhos dos slides em caso de sucesso.
 * Sai com código 0 (ok) ou 1 (erro).
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const BASE_DIR        = path.resolve(__dirname, '..');
const CARROSSEIS_DIR  = path.join(BASE_DIR, 'carrosseis');
const SLIDES_DIR      = path.join(BASE_DIR, 'slides');
const QUEUE_PATH      = path.join(BASE_DIR, 'queue.json');

// ── Args ─────────────────────────────────────────────────────────────────────

const carouselId = process.argv[2];
if (!carouselId) {
  console.error('Uso: node scripts/export-one.js <carouselId>');
  process.exit(1);
}

const htmlPath = path.join(CARROSSEIS_DIR, carouselId + '.html');
if (!fs.existsSync(htmlPath)) {
  console.error(`HTML não encontrado: ${htmlPath}`);
  process.exit(1);
}

const outDir = path.join(SLIDES_DIR, carouselId);
fs.mkdirSync(outDir, { recursive: true });

// ── Export logic ─────────────────────────────────────────────────────────────

(async () => {
  let browser;
  try {
    browser = await chromium.launch();
    console.log(`📸 Exportando: ${carouselId}`);

    // Detecta tipo lendo o HTML
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const isTweet = html.includes('carousel-track') && html.includes('x-slide');

    const slidePaths = isTweet
      ? await exportTweet(browser, htmlPath, outDir, carouselId)
      : await exportEditorial(browser, htmlPath, outDir, carouselId);

    console.log(`✅ ${slidePaths.length} slides exportados em slides/${carouselId}/`);

    // Atualizar queue.json
    const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
    const c = queue.carousels.find(x => x.id === carouselId);
    if (c) {
      c.slides = slidePaths;
      fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
      console.log('💾 queue.json atualizado');
    } else {
      console.warn('⚠️  Carrossel não encontrado em queue.json — slides exportados mas não registrados');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();

// ── Editorial export (classe .slide) ─────────────────────────────────────────

async function exportEditorial(browser, htmlPath, outDir, carouselId) {
  const context = await browser.newContext({ viewport: { width: 1080, height: 1350 } });
  const page = await context.newPage();
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(800);

  const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
  console.log(`   ${slideCount} slides (editorial)`);

  const paths = [];
  for (let i = 0; i < slideCount; i++) {
    await page.evaluate(idx => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, k) => { s.style.display = k === idx ? 'flex' : 'none'; });
    }, i);
    await page.waitForTimeout(150);

    const file = path.join(outDir, `slide_${i + 1}.png`);
    await page.screenshot({ path: file });
    paths.push(`slides/${carouselId}/slide_${i + 1}.png`);
    console.log(`   ✅ slide_${i + 1}.png`);
  }

  await context.close();
  return paths;
}

// ── Tweet export (transform-scale, carousel-track) ───────────────────────────

async function exportTweet(browser, htmlPath, outDir, carouselId) {
  const VIEW_W = 420, VIEW_H = 525, SCALE = 1080 / 420;
  const context = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500); // fonts

  // Esconde chrome do X-frame, prepara viewport
  await page.evaluate(() => {
    document.querySelectorAll('.x-topbar,.x-dots').forEach(el => el.style.display = 'none');
    const frame    = document.querySelector('.x-frame');
    const viewport = document.querySelector('.carousel-viewport');
    if (frame)    frame.style.cssText    = 'width:420px;height:525px;max-width:none;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';
    if (viewport) viewport.style.cssText = 'width:420px;height:525px;aspect-ratio:unset;overflow:hidden;cursor:default;';
    document.body.style.cssText = 'padding:0;margin:0;display:block;overflow:hidden;';
  });
  await page.waitForTimeout(300);

  const slideCount = await page.evaluate(() => document.querySelectorAll('.x-slide').length);
  console.log(`   ${slideCount} slides (tweet)`);

  const paths = [];
  for (let i = 0; i < slideCount; i++) {
    await page.evaluate(idx => {
      const track = document.querySelector('.carousel-track');
      if (track) {
        track.style.transition = 'none';
        track.style.transform  = 'translateX(' + (-idx * 420) + 'px)';
      }
    }, i);
    await page.waitForTimeout(300);

    const file = path.join(outDir, `slide_${i + 1}.png`);
    await page.screenshot({
      path: file,
      clip: { x: 0, y: 0, width: VIEW_W, height: VIEW_H },
    });
    paths.push(`slides/${carouselId}/slide_${i + 1}.png`);
    console.log(`   ✅ slide_${i + 1}.png`);
  }

  await context.close();
  return paths;
}
