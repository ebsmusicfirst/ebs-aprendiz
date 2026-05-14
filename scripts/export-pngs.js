/**
 * EBS Aprendiz — Exportar carrosséis HTML como PNG
 * Gera imagens 1080x1350px para cada slide dos carrosséis
 *
 * Uso: npm run export (ou: node scripts/export-pngs.js)
 * Usa Playwright para renderizar cada slide
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');
const CARROSSEIS_DIR = path.join(BASE_DIR, 'carrosseis');
const SLIDES_DIR = path.join(BASE_DIR, 'slides');
const QUEUE_PATH = path.join(BASE_DIR, 'queue.json');

// Garantir que a pasta slides/ existe
if (!fs.existsSync(SLIDES_DIR)) {
  fs.mkdirSync(SLIDES_DIR, { recursive: true });
}

async function exportCarouselPNGs() {
  let browser, context;
  try {
    browser = await chromium.launch();
    context = await browser.newContext({
      viewport: { width: 1080, height: 1350 },
    });

    const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
    let updated = false;

    for (const carousel of queue.carousels) {
      const htmlPath = path.join(CARROSSEIS_DIR, carousel.id + '.html');

      if (!fs.existsSync(htmlPath)) {
        console.log(`⏭️  Pulando ${carousel.id} — arquivo HTML não encontrado`);
        continue;
      }

      console.log(`\n📸 Exportando: ${carousel.id}`);
      const carouselSlideDir = path.join(SLIDES_DIR, carousel.id);

      if (!fs.existsSync(carouselSlideDir)) {
        fs.mkdirSync(carouselSlideDir, { recursive: true });
      }

      const page = await context.newPage();
      const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

      try {
        await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });
      } catch (err) {
        console.log(`   ⚠️  Erro ao carregar: ${err.message}`);
        await page.close();
        continue;
      }

      // Obter número de slides do carrossel (verificando elementos .slide)
      const slideCount = await page.evaluate(() => {
        const slides = document.querySelectorAll('.slide');
        console.log(`Slides found: ${slides.length}`);
        return slides.length;
      });

      console.log(`   📄 ${slideCount} slides detectados`);

      // Exportar cada slide
      const slidePaths = [];
      for (let i = 0; i < slideCount; i++) {
        // Mostrar o slide atual (adicionar classe 'active' ou modificar display)
        await page.evaluate((index) => {
          const slides = document.querySelectorAll('.slide');
          slides.forEach((s, idx) => {
            s.style.display = idx === index ? 'flex' : 'none';
          });
        }, i);

        await page.waitForTimeout(200);

        const slideNum = i + 1;
        const pngPath = path.join(carouselSlideDir, `slide_${slideNum}.png`);

        await page.screenshot({
          path: pngPath,
          fullPage: false,
          timeout: 10000
        });

        const relativePath = `slides/${carousel.id}/slide_${slideNum}.png`;
        slidePaths.push(relativePath);

        console.log(`   ✅ slide_${slideNum}.png (${i + 1}/${slideCount})`);
      }

      carousel.slides = slidePaths;
      updated = true;
      await page.close();
    }

    // Salvar queue.json atualizado
    if (updated) {
      fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
      console.log('\n✅ queue.json atualizado com os caminhos das imagens');
    } else {
      console.log('\n⏭️  Nenhum carrossel foi atualizado');
    }

  } catch (err) {
    console.error('❌ Erro ao exportar PNGs:', err.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

exportCarouselPNGs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
