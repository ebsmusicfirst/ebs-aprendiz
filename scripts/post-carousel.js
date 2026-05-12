/**
 * EBS Aprendiz — Script de Postagem Diária
 * Executado pelo GitHub Actions 1x ao dia (ou quando há carrosséis agendados)
 *
 * Modos:
 *   1. status=approved sem container_id  → cria containers + publica (fluxo normal)
 *   2. status=approved com container_id  → publica container pré-criado
 *   3. status=scheduled com container_id → publica se scheduled_for <= agora
 */

const fs   = require('fs');
const path = require('path');
const meta = require('./meta-api');

const QUEUE_PATH   = path.join(__dirname, '..', 'queue.json');
const IG_USER_ID   = process.env.META_IG_USER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPOSITORY;
const GITHUB_REF   = process.env.GITHUB_REF_NAME || 'main';

if (!IG_USER_ID || !ACCESS_TOKEN) {
  console.error('❌ META_IG_USER_ID e META_ACCESS_TOKEN são obrigatórios');
  process.exit(1);
}

async function main() {
  console.log('🎸 EBS Aprendiz — Poster @aprendiz.ebs');
  console.log(`   Repo: ${GITHUB_REPO} | Branch: ${GITHUB_REF}`);
  console.log('');

  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  let posted = 0;

  // ── Modo 3: publicar containers agendados prontos ─────────────────────────
  const now = new Date();
  const scheduled = queue.carousels.filter(
    c => c.status === 'scheduled' &&
         c.meta_container_id &&
         c.scheduled_for &&
         new Date(c.scheduled_for) <= now
  );

  for (const c of scheduled) {
    console.log(`📅 Publicando agendado: ${c.id}`);
    try {
      const postId = await meta.publishCarousel(c.meta_container_id, IG_USER_ID, ACCESS_TOKEN);
      c.status       = 'published';
      c.published_at = new Date().toISOString();
      c.meta_post_id = postId;
      delete c.meta_container_id;
      console.log(`   ✅ Post ID: ${postId}`);
      posted++;
    } catch (err) {
      console.error(`   ❌ Erro ao publicar ${c.id}: ${err.message}`);
    }
  }

  // ── Modo 1/2: publicar próximo aprovado ───────────────────────────────────
  const next = queue.carousels.find(c => c.status === 'approved');

  if (!next) {
    if (posted === 0) {
      console.warn('⚠️  Nenhum carrossel aprovado ou agendado pronto. Postagem ignorada.');
    }
  } else {
    console.log(`📋 Próximo aprovado: ${next.id} — "${next.title}"`);
    console.log('');

    let postId;

    if (next.meta_container_id) {
      // Container pré-criado (foi preparado via dashboard)
      console.log(`  ♻️  Usando container pré-criado: ${next.meta_container_id}`);
      postId = await meta.publishCarousel(next.meta_container_id, IG_USER_ID, ACCESS_TOKEN);
    } else {
      // Fluxo normal: criar containers e publicar
      const result = await meta.postCarouselNow(
        next, IG_USER_ID, ACCESS_TOKEN, GITHUB_REPO, GITHUB_REF
      );
      postId = result.postId;
    }

    next.status       = 'published';
    next.published_at = new Date().toISOString();
    next.meta_post_id = postId;
    delete next.meta_container_id;
    posted++;

    console.log('');
    console.log(`✅ Publicado! Post ID: ${postId}`);
  }

  // ── Salvar queue ──────────────────────────────────────────────────────────
  if (posted > 0) {
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
  }

  const remaining = queue.carousels.filter(c => c.status === 'approved' || c.status === 'scheduled').length;
  console.log(`📊 Carrosséis restantes (approved + scheduled): ${remaining}`);
  if (remaining <= 2) {
    console.warn('⚠️  ATENÇÃO: Fila baixa! Crie novos carrosséis em breve.');
  }
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
