/**
 * EBS Aprendiz — Script de Postagem Diária
 * Executado pelo GitHub Actions 1x ao dia
 *
 * Lê o próximo carrossel aprovado de queue.json,
 * posta no @aprendiz.ebs via Meta Graph API,
 * e atualiza o status para "published".
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const QUEUE_PATH = path.join(__dirname, '..', 'queue.json');
const IG_USER_ID = process.env.META_IG_USER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPOSITORY; // ex: ebsmusicfirst/ebs-aprendiz
const GITHUB_REF = process.env.GITHUB_REF_NAME || 'main';

if (!IG_USER_ID || !ACCESS_TOKEN) {
  console.error('❌ META_IG_USER_ID e META_ACCESS_TOKEN são obrigatórios');
  process.exit(1);
}

// ─────────────────────────────────────────
// Helpers HTTP
// ─────────────────────────────────────────

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString();
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─────────────────────────────────────────
// URL pública dos slides via raw.githubusercontent.com
// ─────────────────────────────────────────

function slideUrl(slidePath) {
  return `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_REF}/${slidePath}`;
}

// ─────────────────────────────────────────
// Meta Graph API
// ─────────────────────────────────────────

async function createSlideContainer(imageUrl) {
  console.log(`  📤 Upload slide: ${imageUrl}`);
  const result = await httpPost(
    `https://graph.facebook.com/v21.0/${IG_USER_ID}/media`,
    {
      image_url: imageUrl,
      is_carousel_item: 'true',
      access_token: ACCESS_TOKEN,
    }
  );
  if (!result.id) throw new Error(`Falha ao criar container: ${JSON.stringify(result)}`);
  return result.id;
}

async function createCarouselContainer(childIds, caption) {
  console.log(`  🎠 Criando container de carrossel (${childIds.length} slides)...`);
  const result = await httpPost(
    `https://graph.facebook.com/v21.0/${IG_USER_ID}/media`,
    {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: caption,
      access_token: ACCESS_TOKEN,
    }
  );
  if (!result.id) throw new Error(`Falha ao criar carrossel: ${JSON.stringify(result)}`);
  return result.id;
}

async function publishCarousel(containerId) {
  console.log(`  🚀 Publicando...`);
  const result = await httpPost(
    `https://graph.facebook.com/v21.0/${IG_USER_ID}/media_publish`,
    {
      creation_id: containerId,
      access_token: ACCESS_TOKEN,
    }
  );
  if (!result.id) throw new Error(`Falha ao publicar: ${JSON.stringify(result)}`);
  return result.id;
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────

async function main() {
  console.log('🎸 EBS Aprendiz — Poster Diário @aprendiz.ebs');
  console.log(`   Repo: ${GITHUB_REPO} | Branch: ${GITHUB_REF}`);
  console.log('');

  // Lê a fila
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  const next = queue.carousels.find((c) => c.status === 'approved');

  if (!next) {
    console.warn('⚠️  Nenhum carrossel aprovado na fila. Postagem ignorada.');
    process.exit(0);
  }

  console.log(`📋 Próximo: ${next.id} — "${next.title}"`);
  console.log('');

  // 1. Cria containers para cada slide
  const childIds = [];
  for (const slidePath of next.slides) {
    const url = slideUrl(slidePath);
    const id = await createSlideContainer(url);
    childIds.push(id);
  }

  // 2. Cria container de carrossel
  const caption = `${next.caption}\n\n${next.hashtags}`;
  const carouselId = await createCarouselContainer(childIds, caption);

  // 3. Publica
  const postId = await publishCarousel(carouselId);

  console.log('');
  console.log(`✅ Publicado com sucesso! Post ID: ${postId}`);

  // 4. Atualiza queue.json
  next.status = 'published';
  next.published_at = new Date().toISOString();
  next.meta_post_id = postId;
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));

  // Contagem restante
  const remaining = queue.carousels.filter((c) => c.status === 'approved').length;
  console.log(`📊 Carrosséis aprovados restantes na fila: ${remaining}`);
  if (remaining <= 2) {
    console.warn('⚠️  ATENÇÃO: Fila baixa! Crie novos carrosséis em breve.');
    // O GitHub Actions vai fazer o commit do queue.json atualizado
    // e pode notificar via Actions summary
  }
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
