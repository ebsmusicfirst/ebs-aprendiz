#!/usr/bin/env node
/**
 * EBS Aprendiz — Screenshot de Carrossel para QA Visual
 *
 * Captura todos os slides de um carrossel como PNGs em tamanho de preview.
 * Usado pelo agente @imagem-curator (Iris) para inspeção visual.
 *
 * Uso:
 *   node scripts/screenshot-carousel.js <carouselId>
 *   node scripts/screenshot-carousel.js tweet-guitarra-sozinho-01
 *
 * Output:
 *   tmp/qa-screenshots/<id>/slide-1.png
 *   tmp/qa-screenshots/<id>/slide-2.png
 *   ...
 *   tmp/qa-screenshots/<id>/editorial-image.png  ← somente para carrosséis editoriais com imagem
 *
 * Saída stdout (uma linha por arquivo):
 *   SLIDE tmp/qa-screenshots/<id>/slide-1.png
 *   IMAGE tmp/qa-screenshots/<id>/editorial-image.png
 *
 * Exit codes:
 *   0  — sucesso
 *   1  — erro (carousel não existe, Playwright falhou, etc.)
 */

'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const BASE_DIR       = path.resolve(__dirname, '..');
const CARROSSEIS_DIR = path.join(BASE_DIR, 'carrosseis');
const QA_DIR         = path.join(BASE_DIR, 'tmp', 'qa-screenshots');

// ── Args ──────────────────────────────────────────────────────────────────────

const carouselId = process.argv[2];
if (!carouselId) {
  console.error('Uso: node scripts/screenshot-carousel.js <carouselId>');
  process.exit(1);
}

const htmlPath = path.join(CARROSSEIS_DIR, carouselId + '.html');
if (!fs.existsSync(htmlPath)) {
  console.error(`HTML não encontrado: ${htmlPath}`);
  process.exit(1);
}

const outDir = path.join(QA_DIR, carouselId);
fs.mkdirSync(outDir, { recursive: true });

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    const html     = fs.readFileSync(htmlPath, 'utf-8');
    const isTweet  = html.includes('carousel-track') && html.includes('x-slide');

    console.error(`🔍 Capturando slides: ${carouselId} (${isTweet ? 'tweet' : 'editorial'})`);

    const results = isTweet
      ? await screenshotTweet(browser, htmlPath, outDir, html)
      : await screenshotEditorial(browser, htmlPath, outDir, html);

    // Imprime caminhos para stdout (para o agente parsear)
    for (const { type, file } of results) {
      console.log(`${type} ${file}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();

// ── Tweet carousel ────────────────────────────────────────────────────────────
// Tamanho de preview: 420×525 (nativo — mesma viewport do design)

async function screenshotTweet(browser, htmlPath, outDir, html) {
  const ctx  = await browser.newContext({ viewport: { width: 420, height: 525 } });
  const page = await ctx.newPage();
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000); // aguarda Google Fonts

  // Esconde chrome do frame X
  await page.evaluate(() => {
    document.querySelectorAll('.x-topbar,.x-dots').forEach(el => el.style.display = 'none');
    const frame    = document.querySelector('.x-frame');
    const viewport = document.querySelector('.carousel-viewport');
    if (frame)    frame.style.cssText    = 'width:420px;height:525px;max-width:none;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';
    if (viewport) viewport.style.cssText = 'width:420px;height:525px;aspect-ratio:unset;overflow:hidden;cursor:default;';
    document.body.style.cssText = 'padding:0;margin:0;display:block;overflow:hidden;background:#000;';
  });

  const slideCount = await page.evaluate(() => document.querySelectorAll('.x-slide').length);
  console.error(`   ${slideCount} slides encontrados`);

  const results = [];
  for (let i = 0; i < slideCount; i++) {
    await page.evaluate(idx => {
      const track = document.querySelector('.carousel-track');
      if (track) {
        track.style.transition = 'none';
        track.style.transform  = `translateX(${-idx * 420}px)`;
      }
    }, i);
    await page.waitForTimeout(200);

    const file = path.join(outDir, `slide-${i + 1}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 420, height: 525 } });
    results.push({ type: 'SLIDE', file });
    console.error(`   ✅ slide-${i + 1}.png`);
  }

  await ctx.close();
  return results;
}

// ── Editorial carousel ────────────────────────────────────────────────────────
// Tamanho de preview: 540×675 (metade do export — rápido e nítido para QA)

async function screenshotEditorial(browser, htmlPath, outDir, html) {
  const ctx  = await browser.newContext({ viewport: { width: 540, height: 675 } });
  const page = await ctx.newPage();
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(600);

  const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
  console.error(`   ${slideCount} slides encontrados`);

  const results = [];

  for (let i = 0; i < slideCount; i++) {
    await page.evaluate(idx => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, k) => { s.style.display = k === idx ? 'flex' : 'none'; });
    }, i);
    await page.waitForTimeout(150);

    const file = path.join(outDir, `slide-${i + 1}.png`);
    await page.screenshot({ path: file });
    results.push({ type: 'SLIDE', file });
    console.error(`   ✅ slide-${i + 1}.png`);
  }

  // ── Extrai imagem editorial dominante ──────────────────────────────────────
  // Procura background-image nos slides e captura isolada (sem texto overlay)
  const hasEditorialImage = await page.evaluate(() => {
    const slides = document.querySelectorAll('.slide');
    for (const s of slides) {
      const bg = window.getComputedStyle(s).backgroundImage;
      if (bg && bg !== 'none' && bg.includes('url(')) return true;
      const imgs = s.querySelectorAll('img');
      if (imgs.length > 0) return true;
    }
    return false;
  });

  if (hasEditorialImage) {
    // Captura slide 1 sem overlay de texto (para ver só a imagem)
    await page.evaluate(() => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, k) => { s.style.display = k === 0 ? 'flex' : 'none'; });
      // Esconde temporariamente todos os elementos de texto
      document.querySelectorAll('.slide-text,.slide-title,.slide-subtitle,.caption,.overlay,.text-overlay').forEach(el => {
        el.dataset.origDisplay = el.style.display;
        el.style.display = 'none';
      });
    });
    await page.waitForTimeout(100);

    const imgFile = path.join(outDir, 'editorial-image.png');
    await page.screenshot({ path: imgFile });
    results.push({ type: 'IMAGE', file: imgFile });
    console.error('   ✅ editorial-image.png (imagem isolada do slide 1)');

    // Restaura texto
    await page.evaluate(() => {
      document.querySelectorAll('[data-orig-display]').forEach(el => {
        el.style.display = el.dataset.origDisplay || '';
      });
    });
  }

  await ctx.close();
  return results;
}
