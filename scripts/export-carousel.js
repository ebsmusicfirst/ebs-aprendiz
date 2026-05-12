/**
 * EBS Aprendiz — Exportador de Carrossel para PNG
 * Uso: node scripts/export-carousel.js <nome-do-arquivo>
 * Exemplo: node scripts/export-carousel.js EDU-beneficios-musica-01
 *
 * Gera 7 slides em slides/{slug}/slide_1.png até slide_7.png
 * Dimensões: 1080×1350px (Instagram portrait)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_DIR = path.resolve(__dirname, '..');
const CARROSSEIS_DIR = path.join(BASE_DIR, 'carrosseis');
const SLIDES_DIR = path.join(BASE_DIR, 'slides');

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

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const fileUrl = `file:///${htmlFile.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Aguarda fontes e imagens carregarem
  await page.waitForTimeout(1500);

  // Detecta quantos slides existem
  const slideCount = await page.evaluate(() => {
    const slides = document.querySelectorAll('.slide');
    return slides.length;
  });

  console.log(`   Slides detectados: ${slideCount}`);

  for (let i = 1; i <= slideCount; i++) {
    // Navega para o slide i (clica ou usa keyboard)
    if (i > 1) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
    }

    // Garante que o slide correto está visível
    await page.evaluate((slideIndex) => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, idx) => {
        s.style.display = idx === slideIndex - 1 ? 'flex' : 'none';
      });
    }, i);

    await page.waitForTimeout(300);

    const outputPath = path.join(outputDir, `slide_${i}.png`);
    await page.screenshot({
      path: outputPath,
      clip: { x: 0, y: 0, width: 1080, height: 1350 },
      fullPage: false,
    });

    const stats = fs.statSync(outputPath);
    console.log(`   ✅ slide_${i}.png (${Math.round(stats.size / 1024)}KB)`);
  }

  await browser.close();
  console.log(`\n✨ Exportação completa! ${slideCount} slides em: ${outputDir}`);
}

const slug = process.argv[2];
if (!slug) {
  console.error('❌ Informe o slug do carrossel. Ex: node export-carousel.js EDU-beneficios-musica-01');
  process.exit(1);
}

exportCarousel(slug).catch((err) => {
  console.error('❌ Erro durante exportação:', err);
  process.exit(1);
});
