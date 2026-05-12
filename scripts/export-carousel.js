/**
 * EBS Aprendiz — Exportador de Carrossel para PNG
 * Uso: node scripts/export-carousel.js <nome-do-arquivo>
 * Exemplo: node scripts/export-carousel.js EDU-beneficios-musica-01
 *
 * Gera slides em slides/{slug}/slide_N.png
 * Dimensões: 1080×1350px (Instagram portrait 4:5)
 *
 * O HTML foi desenhado como preview com mock do Instagram (420px wide).
 * Este script usa deviceScaleFactor = 1080/420 ≈ 2.5714 para
 * escalar o design original (420×525) para 1080×1350 sem distorcer.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_DIR = path.resolve(__dirname, '..');
const CARROSSEIS_DIR = path.join(BASE_DIR, 'carrosseis');
const SLIDES_DIR = path.join(BASE_DIR, 'slides');

// Dimensões nativas do design HTML
const DESIGN_WIDTH  = 420;
const DESIGN_HEIGHT = 525; // 420 × (5/4) — aspect-ratio 4:5

// Dimensões alvo Instagram
const TARGET_WIDTH  = 1080;
const TARGET_HEIGHT = 1350; // 1080 × (5/4)

// Fator de escala: 1080 / 420 = 18/7 ≈ 2.5714
const SCALE = TARGET_WIDTH / DESIGN_WIDTH;

// CSS injetado para transformar preview em export-mode
// Mantemos o layout original; apenas removemos o chrome do mock.
const EXPORT_CSS = `
  /* Reset do body — remove fundo preto e centralização */
  body {
    background: transparent !important;
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
    min-height: unset !important;
  }

  /* ig-frame fica sem arredondamento e sem sombra */
  .ig-frame {
    border-radius: 0 !important;
    box-shadow: none !important;
    width: ${DESIGN_WIDTH}px !important;
  }

  /* Ocultar chrome do mock Instagram */
  .ig-header,
  .ig-dots,
  .ig-actions,
  .ig-caption {
    display: none !important;
  }

  /* Carousel viewport ocupa exatamente as dimensões do design */
  .carousel-viewport {
    width: ${DESIGN_WIDTH}px !important;
    height: ${DESIGN_HEIGHT}px !important;
    aspect-ratio: unset !important;
  }

  /* Cada slide = dimensões do design */
  .slide {
    min-width: ${DESIGN_WIDTH}px !important;
    width: ${DESIGN_WIDTH}px !important;
    height: ${DESIGN_HEIGHT}px !important;
  }

  /* Desabilita animação do track para screenshot instantâneo */
  .carousel-track {
    transition: none !important;
  }
`;

async function exportCarousel(slug) {
  const htmlFile = path.join(CARROSSEIS_DIR, `${slug}.html`);
  if (!fs.existsSync(htmlFile)) {
    console.error(`❌ Arquivo não encontrado: ${htmlFile}`);
    process.exit(1);
  }

  const outputDir = path.join(SLIDES_DIR, slug);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`📸 Exportando carrossel: ${slug}`);
  console.log(`   HTML: ${htmlFile}`);
  console.log(`   Saída: ${outputDir}`);
  console.log(`   Design: ${DESIGN_WIDTH}×${DESIGN_HEIGHT}  →  Instagram: ${TARGET_WIDTH}×${TARGET_HEIGHT}  (×${SCALE.toFixed(4)})`);
  console.log('');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    // Viewport nas dimensões nativas do design
    viewport: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
    // deviceScaleFactor escala tudo para 1080×1350 sem distorcer o layout
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();

  const fileUrl = `file:///${htmlFile.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Injeta CSS de export-mode
  await page.addStyleTag({ content: EXPORT_CSS });

  // Aguarda fontes (Google Fonts via network)
  await page.waitForTimeout(2000);

  // Detecta quantos slides existem
  const slideCount = await page.evaluate(() => {
    return document.querySelectorAll('.slide').length;
  });

  console.log(`   Slides detectados: ${slideCount}`);
  console.log('');

  for (let i = 0; i < slideCount; i++) {
    // Posiciona o track no slide i (Playwright aceita apenas 1 argumento — usar objeto)
    await page.evaluate(({ idx, w }) => {
      const track = document.querySelector('.carousel-track');
      if (track) {
        track.style.transform = `translateX(-${idx * w}px)`;
      }
    }, { idx: i, w: DESIGN_WIDTH });

    await page.waitForTimeout(150);

    const outputPath = path.join(outputDir, `slide_${i + 1}.png`);

    // Screenshot com clip nas coordenadas NATIVAS (o deviceScaleFactor escala automaticamente)
    await page.screenshot({
      path: outputPath,
      clip: { x: 0, y: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
      fullPage: false,
    });

    const stats = fs.statSync(outputPath);
    console.log(`   ✅ slide_${i + 1}.png (${Math.round(stats.size / 1024)}KB)`);
  }

  await browser.close();
  console.log('');
  console.log(`✨ Exportação completa! ${slideCount} slides em:`);
  console.log(`   ${outputDir}`);
}

const slug = process.argv[2];
if (!slug) {
  console.error('❌ Informe o slug do carrossel.');
  console.error('   Exemplo: node scripts/export-carousel.js EDU-beneficios-musica-01');
  process.exit(1);
}

exportCarousel(slug).catch((err) => {
  console.error('❌ Erro durante exportação:', err);
  process.exit(1);
});
