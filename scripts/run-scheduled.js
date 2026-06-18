#!/usr/bin/env node
/**
 * EBS Aprendiz — Auto-Publisher de Carrosséis Agendados
 *
 * Roda em GitHub Actions (cron) ou localmente. Para cada carrossel com:
 *   status === "scheduled"  &&  scheduled_for <= now
 *
 * Publica via Meta Graph API e atualiza queue.json em seguida.
 *
 * Variáveis de ambiente necessárias:
 *   META_IG_USER_ID    — Instagram Business User ID
 *   META_ACCESS_TOKEN  — Long-lived Page Access Token
 *   GITHUB_REPO        — formato: owner/repo (ex.: ebsmusicfirst/ebs-aprendiz)
 *   GITHUB_REF         — branch ou tag (default: main)
 *
 * Exit codes:
 *   0  — sucesso (zero ou N posts publicados)
 *   1  — erro fatal (config inválida, queue corrompido)
 *   2  — pelo menos um post falhou (mas outros podem ter passado)
 */

const fs   = require('fs');
const path = require('path');
const meta = require('./meta-api');

const BASE_DIR   = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(BASE_DIR, 'queue.json');

const IG_USER_ID   = process.env.META_IG_USER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO || 'ebsmusicfirst/ebs-aprendiz';
const GITHUB_REF   = process.env.GITHUB_REF  || 'main';

// ── Logging ──────────────────────────────────────────────────────────────────

function log(...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...args);
}

function fatal(msg, code = 1) {
  log('❌ FATAL:', msg);
  process.exit(code);
}

// ── Validate config ──────────────────────────────────────────────────────────

if (!IG_USER_ID)   fatal('META_IG_USER_ID não definido');
if (!ACCESS_TOKEN) fatal('META_ACCESS_TOKEN não definido');

// ── Read queue ───────────────────────────────────────────────────────────────

let queue;
try {
  queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
} catch (e) {
  fatal(`Não consegui ler queue.json: ${e.message}`);
}

if (!queue.carousels || !Array.isArray(queue.carousels)) {
  fatal('queue.json malformado — falta carousels[]');
}

// ── Pick due carousels ───────────────────────────────────────────────────────

const now = Date.now();

const due = queue.carousels.filter(c => {
  if (c.status !== 'scheduled') return false;
  if (!c.scheduled_for)         return false;
  const ts = Date.parse(c.scheduled_for);
  if (Number.isNaN(ts))         return false;
  return ts <= now;
});

log(`📋 Total no queue: ${queue.carousels.length}`);
log(`⏰ Vencidos (prontos pra publicar): ${due.length}`);

if (!due.length) {
  log('✅ Nada para publicar agora. Saindo.');
  process.exit(0);
}

// ── Publish each due carousel ────────────────────────────────────────────────

(async () => {
  let failures = 0;

  for (const carousel of due) {
    log('');
    log(`──────────────────────────────────────────────`);
    log(`🚀 Publicando: ${carousel.id}`);
    log(`   "${carousel.title}"`);
    log(`   Agendado para: ${carousel.scheduled_for}`);
    log(`──────────────────────────────────────────────`);

    // Validar slides antes de subir
    if (!carousel.slides || !carousel.slides.length) {
      log(`❌ Sem slides em ${carousel.id} — pulando`);
      failures++;
      continue;
    }

    try {
      const result = await meta.postCarouselNow(
        carousel, IG_USER_ID, ACCESS_TOKEN, GITHUB_REPO, GITHUB_REF, log
      );

      // Atualizar o objeto no array (mutação direta — o queue será reescrito)
      carousel.status        = 'published';
      carousel.published_at  = new Date().toISOString();
      carousel.meta_post_id  = result.postId;

      // Persistir IMEDIATAMENTE após cada sucesso — se falhar no meio,
      // não republica o que já saiu.
      fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
      log(`✅ ${carousel.id} → published (meta_post_id=${result.postId})`);

    } catch (err) {
      log(`❌ Falha em ${carousel.id}: ${err.message}`);
      failures++;
      // Não muda o status — fica em scheduled e tenta de novo na próxima execução
    }
  }

  log('');
  log(`──────────────────────────────────────────────`);
  log(`Resumo: ${due.length - failures}/${due.length} publicados`);
  log(`──────────────────────────────────────────────`);

  process.exit(failures ? 2 : 0);
})().catch(err => {
  log('❌ Erro inesperado:', err.stack || err.message);
  process.exit(1);
});
