/**
 * clickup-check.js — Diagnóstico completo do ClickUp (EBS Aprendiz)
 *
 * Uso: node scripts/clickup-check.js
 *
 * Inspeciona toda a estrutura Syncra L0/L1/L2, identifica problemas e
 * entrega um relatório em texto formatado. Não modifica dados.
 */

require('dotenv').config();
const MAP = require('./clickup-map.json');

const BASE  = 'https://api.clickup.com/api/v2';
const TOKEN = process.env.CLICKUP_API_KEY;
const F     = MAP.fields;
const LISTS = MAP.lists;

// ── HTTP ──────────────────────────────────────────────────────
async function api(path) {
  try {
    const r = await fetch(BASE + path, {
      headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    });
    const d = await r.json().catch(() => ({}));
    if (d && d.err) return { error: `${d.err} (${d.ECODE})` };
    return d;
  } catch (e) {
    return { error: e.message };
  }
}

// ── Helpers de leitura de fields ──────────────────────────────
function readDropdown(fieldDef, task) {
  const f = (task.custom_fields || []).find((x) => x.id === fieldDef.id);
  if (!f || f.value == null) return null;
  if (typeof f.value === 'number') {
    const opt = f.type_config && f.type_config.options && f.type_config.options[f.value];
    return opt ? opt.name : `orderindex:${f.value}`;
  }
  const entry = Object.entries(fieldDef.options || {}).find(([, id]) => id === f.value);
  return entry ? entry[0] : f.value;
}

function readText(fieldDef, task) {
  const f = (task.custom_fields || []).find((x) => x.id === fieldDef.id);
  return f ? f.value : null;
}

function readRelation(fieldId, task) {
  const f = (task.custom_fields || []).find((x) => x.id === fieldId);
  if (!f || !Array.isArray(f.value) || f.value.length === 0) return null;
  return f.value.map((v) => v.name || v.id).join(', ');
}

function fmt(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'string' && v.length > 60) return v.slice(0, 57) + '…';
  return v;
}

function ts(ms) {
  if (!ms) return '—';
  return new Date(parseInt(ms)).toLocaleDateString('pt-BR');
}

// ── Seções do relatório ───────────────────────────────────────
const issues   = [];
const warnings = [];
const ok       = [];

function issue(msg)   { issues.push('  ❌ ' + msg); }
function warn(msg)    { warnings.push('  ⚠️  ' + msg); }
function good(msg)    { ok.push('  ✅ ' + msg); }

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('   ClickUp Check — EBS Aprendiz');
  console.log('   ' + new Date().toLocaleString('pt-BR'));
  console.log('══════════════════════════════════════════════════\n');

  // 1. Conectividade
  console.log('── 1. CONECTIVIDADE ─────────────────────────────');
  const team = await api(`/team/${MAP.team}`);
  if (team.error) {
    issue('API inacessível: ' + team.error);
    console.log('  ❌ Token inválido ou sem acesso ao workspace');
    console.log('\n' + issues.join('\n'));
    return;
  }
  good(`Workspace "${team.team?.name}" acessível`);
  console.log(ok[ok.length - 1]);

  // 2. L1 — Campanhas
  console.log('\n── 2. L1 CAMPANHAS ──────────────────────────────');
  const campData = await api(`/list/${LISTS.campanhas}/task?include_closed=true`);
  const campanhas = campData.tasks || [];
  if (campData.error) {
    issue('Erro ao buscar campanhas: ' + campData.error);
    console.log('  ❌ ' + campData.error);
  } else if (campanhas.length === 0) {
    warn('Nenhuma campanha criada em L1');
    console.log('  ⚠️  Nenhuma campanha');
  } else {
    for (const c of campanhas) {
      const fw      = readDropdown(F.campanhas.framework, c);
      const status  = readDropdown(F.campanhas.statusCampanha, c);
      const cta     = readDropdown(F.campanhas.cta, c);
      const hashtags = readText(F.campanhas.hashtagsBase, c);
      console.log(`  📣 [${c.id}] ${c.name}`);
      console.log(`     Framework: ${fmt(fw)} | Status: ${fmt(status)} | CTA: ${fmt(cta)}`);
      console.log(`     Hashtags: ${fmt(hashtags)}`);
      if (!fw)       warn(`Campanha "${c.name}" sem framework definido`);
      if (!hashtags) warn(`Campanha "${c.name}" sem hashtags base`);
    }
    good(`${campanhas.length} campanha(s) encontrada(s)`);
  }

  // 3. L2 — Criativos
  console.log('\n── 3. L2 CRIATIVOS ──────────────────────────────');
  const criativosData = await api(`/list/${LISTS.criativos}/task?include_closed=true`);
  const criativos = criativosData.tasks || [];
  if (criativosData.error) {
    issue('Erro ao buscar criativos: ' + criativosData.error);
    console.log('  ❌ ' + criativosData.error);
  } else if (criativos.length === 0) {
    warn('Nenhum criativo encontrado em L2');
    console.log('  ⚠️  Nenhum criativo');
  } else {
    const byStatus = {};
    for (const c of criativos) {
      const status    = readDropdown(F.criativos.statusPipeline, c) || 'Gerado';
      const formato   = readDropdown(F.criativos.formato, c);
      const campanha  = readRelation(F.criativos.campanha.id, c);
      const caption   = readText(F.criativos.caption, c);
      const hashtags  = readText(F.criativos.hashtags, c);
      const dataPub   = readText(F.criativos.dataPublicacao, c);
      const bufId     = readText(F.criativos.bufferPostId, c);

      byStatus[status] = (byStatus[status] || 0) + 1;

      console.log(`  🎨 [${c.id}] ${c.name}`);
      console.log(`     Status: ${status} | Formato: ${fmt(formato)} | Campanha: ${fmt(campanha)}`);
      console.log(`     Caption: ${fmt(caption)}`);
      console.log(`     Hashtags: ${hashtags ? '✓' : '—'} | DataPub: ${ts(dataPub)} | Buffer: ${fmt(bufId)}`);

      // Validações por criativo
      if (!campanha)    warn(`Criativo "${c.name}" sem campanha vinculada`);
      if (!caption)     warn(`Criativo "${c.name}" sem caption`);
      if (!hashtags)    warn(`Criativo "${c.name}" sem hashtags`);
    }

    console.log(`\n  📊 Por status: ${Object.entries(byStatus).map(([k,v]) => `${k}(${v})`).join(', ')}`);
    good(`${criativos.length} criativo(s) encontrado(s)`);
  }

  // 4. L2 — Pautas
  console.log('\n── 4. L2 PAUTAS ─────────────────────────────────');
  const pautasData = await api(`/list/${LISTS.pautas}/task?include_closed=true`);
  const pautas = pautasData.tasks || [];
  if (pautasData.error) {
    console.log('  ❌ ' + pautasData.error);
  } else {
    console.log(`  📋 ${pautas.length} pauta(s) no backlog`);
    if (pautas.length === 0) warn('Backlog de pautas vazio — considerar popular');
  }

  // 5. L0 — Conteúdo estratégico
  console.log('\n── 5. L0 ESTRATÉGICO ────────────────────────────');
  const [dnaData, icpData, ofertasData] = await Promise.all([
    api(`/list/${LISTS.dna}/task`),
    api(`/list/${LISTS.icp}/task`),
    api(`/list/${LISTS.ofertas}/task`),
  ]);
  const dnaCount     = (dnaData.tasks || []).length;
  const icpCount     = (icpData.tasks || []).length;
  const ofertasCount = (ofertasData.tasks || []).length;
  console.log(`  🧬 DNA:    ${dnaCount} item(s)    ${dnaCount === 0 ? '⚠️  vazio' : '✅'}`);
  console.log(`  👤 ICP:    ${icpCount} item(s)    ${icpCount === 0 ? '⚠️  vazio' : '✅'}`);
  console.log(`  🎁 Ofertas: ${ofertasCount} item(s)    ${ofertasCount === 0 ? '⚠️  vazio' : '✅'}`);
  if (dnaCount === 0)     warn('DNA (L0) vazio — dados estratégicos não populados');
  if (icpCount === 0)     warn('ICP (L0) vazio — perfil do aluno ideal não populado');
  if (ofertasCount === 0) warn('Ofertas (L0) vazia — planos não cadastrados');

  // 6. Journey Log (últimas 3 entradas)
  console.log('\n── 6. JOURNEY LOG (últimas 3) ───────────────────');
  const jlData = await api(`/list/${LISTS.journeyLog}/task?order_by=date_created&reverse=true&limit=3`);
  const logs = (jlData.tasks || []).slice(0, 3);
  if (logs.length === 0) {
    console.log('  — nenhum registro');
  } else {
    for (const l of logs) {
      console.log(`  📝 ${l.name}`);
    }
  }

  // ── Resumo final ──────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('   RESUMO');
  console.log('══════════════════════════════════════════════════');

  if (ok.length)       { console.log('\n✅ OK:');       ok.forEach(m => console.log(m)); }
  if (warnings.length) { console.log('\n⚠️  AVISOS:');  warnings.forEach(m => console.log(m)); }
  if (issues.length)   { console.log('\n❌ PROBLEMAS:'); issues.forEach(m => console.log(m)); }

  const saude = issues.length === 0
    ? warnings.length === 0 ? '🟢 SAUDÁVEL' : '🟡 AVISOS'
    : '🔴 COM PROBLEMAS';
  console.log(`\n  Estado geral: ${saude}`);
  console.log('══════════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('Erro fatal no check:', e.message);
  process.exit(1);
});
