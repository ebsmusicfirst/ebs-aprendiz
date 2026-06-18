/**
 * EBS Aprendiz — Converter PNG para JPEG
 * A Meta Graph API pode ter problemas com PNG
 * Usa Sharp para converter com qualidade alta
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SLIDES_DIR = path.join(__dirname, '..', 'slides');
const QUEUE_PATH = path.join(__dirname, '..', 'queue.json');

async function convertPngsToJpeg() {
  try {
    const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
    let updated = false;

    for (const carousel of queue.carousels) {
      if (!carousel.slides || carousel.slides.length === 0) continue;

      console.log(`\n📸 Convertendo: ${carousel.id}`);
      const newSlides = [];

      for (const slidePath of carousel.slides) {
        const pngPath = path.join(SLIDES_DIR, slidePath);

        if (!fs.existsSync(pngPath)) {
          console.log(`   ⏭️  ${slidePath} não encontrado`);
          newSlides.push(slidePath);
          continue;
        }

        // Converter PNG para JPEG
        const jpgPath = pngPath.replace(/\.png$/i, '.jpg');

        try {
          await sharp(pngPath)
            .jpeg({ quality: 90, progressive: true })
            .toFile(jpgPath);

          // Remover PNG original
          fs.unlinkSync(pngPath);

          const newRelativePath = slidePath.replace(/\.png$/i, '.jpg');
          newSlides.push(newRelativePath);

          console.log(`   ✅ ${newRelativePath}`);
        } catch (err) {
          console.error(`   ❌ Erro ao converter ${slidePath}:`, err.message);
          newSlides.push(slidePath);
        }
      }

      carousel.slides = newSlides;
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
      console.log('\n✅ queue.json atualizado com caminhos de JPEG');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

convertPngsToJpeg().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
