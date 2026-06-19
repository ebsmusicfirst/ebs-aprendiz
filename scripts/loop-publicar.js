/**
 * loop-publicar.js — Loop Publicador de Criativos Aprovados
 *
 * Ciclo: LÊ criativos "Aprovado" no ClickUp → adiciona na fila do Buffer → atualiza ClickUp para "Agendado"
 *
 * AUTORIZAÇÃO: o status "Aprovado" no ClickUp é a autorização explícita de Alex.
 * O script só roda para criativos que Alex moveu para "Aprovado" — portanto, sem aprovação
 * no ClickUp, NUNCA chega ao Buffer. A fila do Buffer publica no horário agendado.
 *
 * Uso: node scripts/loop-publicar.js
 *      node scripts/loop-publicar.js --dry-run
 */

'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const cu   = require('./clickup.js');
const buf  = require('./buffer-api.js');

const DRY_RUN         = process.argv.includes('--dry-run');
const STATE_FILE      = path.join(__dirname, '..', 'STATE.md');
const BUFFER_TOKEN    = process.env.BUFFER_ACCESS_TOKEN;
const BUFFER_CHANNEL  = '6a0b6029090476fb99338257';  // @aprendiz.ebs
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ebsmusicfirst/ebs-aprendiz/master/slides';

// ── Leitura / escrita do STATE.md ─────────────────────────────
function lerState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  const text = fs.readFileSync(STATE_FILE, 'utf8');
  const m = text.match(/```json\n([\s\S]*?)\n```/);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  return {};
}

function salvarState(state) {
  const agora = new Date().toISOString();
  const content = `# STATE — Loop EBS Aprendiz\n> Atualizado: ${agora}\n\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n`;
  fs.writeFileSync(STATE_FILE, content, 'utf8');
}

// ── Descobrir URLs públicas dos PNGs no GitHub ────────────────
function getPngUrls(slug) {
  const slidesDir = path.join(__dirname, '..', 'slides', slug);
  if (!fs.existsSync(slidesDir)) return [];

  return fs.readdirSync(slidesDir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => `${GITHUB_RAW_BASE}/${slug}/${f}`);
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('   Loop Publicador — EBS Aprendiz');
  console.log(`   ${new Date().toLocaleString('pt-BR')}`);
  if (DRY_RUN) console.log('   [DRY RUN — nenhuma modificação]');
  console.log('══════════════════════════════════════════════════\n');

  // 1. LER ESTADO
  const state = lerState();

  // 2. BUSCAR CRIATIVOS APROVADOS
  console.log('Buscando criativos "Aprovado"...');
  const criativos = await cu.listCriativos('Aprovado');
  console.log(`  Encontrados: ${criativos.length}`);

  if (criativos.length === 0) {
    console.log('\n✅ Nenhum criativo aprovado. Aguardando aprovação de Alex no ClickUp.');
    state.ultimaRodadaPublicador = new Date().toISOString();
    state.proximaAcaoPublicador  = 'Aguardar Alex mover criativo para "Aprovado" no ClickUp';
    salvarState(state);
    return;
  }

  // Processa um por rodada
  const criativo = criativos[0];
  const slug     = criativo.name;
  console.log(`\nProcessando: "${slug}" (${criativo.id})`);

  // 3. LER CAMPOS DO CRIATIVO
  const caption  = cu.readField(cu.FIELDS.criativos.caption, criativo)   || '';
  const hashtags = cu.readField(cu.FIELDS.criativos.hashtags, criativo)  || '';
  const notas    = cu.readField(cu.FIELDS.criativos.notasRevisao, criativo) || '';

  if (notas) console.log(`  Notas de revisão: "${notas}"`);

  // 4. DESCOBRIR PNGs
  const imageUrls = getPngUrls(slug);
  if (imageUrls.length === 0) {
    console.error(`  ❌ Nenhum PNG encontrado em slides/${slug}/`);
    console.error('  Verifique se os PNGs foram exportados e commitados ao repositório.');
    process.exit(1);
  }
  console.log(`  PNGs: ${imageUrls.length} imagens`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Seria criado draft no Buffer:');
    console.log('  Caption:', caption.substring(0, 80));
    console.log('  Hashtags:', hashtags.substring(0, 60));
    console.log('  Imagens:', imageUrls.length);
    return;
  }

  // 5. ADICIONAR NA FILA DO BUFFER
  // draft: false — autorização já veio do ClickUp ("Aprovado" = autorização explícita de Alex)
  console.log('  Adicionando na fila do Buffer...');
  let bufferPost;
  try {
    const text = [caption, hashtags].filter(Boolean).join('\n\n');
    bufferPost = await buf.createPost({
      token:     BUFFER_TOKEN,
      channelId: BUFFER_CHANNEL,
      text,
      imageUrls,
      draft:     false,  // aprovação no ClickUp É a autorização
    });
  } catch (e) {
    console.error('  ❌ Buffer falhou:', e.message);
    await cu.journalLog('buffer_erro', criativo.id, slug, { erro: e.message });
    process.exit(1);
  }
  console.log(`  ✅ Agendado no Buffer: ${bufferPost.id} (status: ${bufferPost.status})`);

  // 6. ATUALIZAR CLICKUP
  await cu.marcarAgendado(criativo.id, bufferPost.id);
  console.log(`  ✅ ClickUp: "${slug}" → Agendado (bufferPostId: ${bufferPost.id})`);

  // 7. ATUALIZAR STATE
  state.ultimaRodadaPublicador = new Date().toISOString();
  state.ultimoPublicado = { id: criativo.id, slug, bufferPostId: bufferPost.id };
  state.proximaAcaoPublicador = `"${slug}" agendado no Buffer — publicará no próximo slot disponível`;
  salvarState(state);

  console.log('\n══════════════════════════════════════════════════');
  console.log(`   AGENDADO: "${slug}"`);
  console.log(`   Buffer post ID: ${bufferPost.id}`);
  console.log('══════════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
