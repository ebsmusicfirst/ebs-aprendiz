/**
 * clickup-bootstrap.js — Syncra ClickOps Bootstrap
 * EBS Aprendiz — Domínio Conteúdo
 *
 * Materializa a arquitetura de 3 níveis da metodologia Syncra no ClickUp:
 *   L0 Estratégico  → DNA, ICP, Ofertas      (fonte da verdade, herda p/ baixo)
 *   L1 Tático       → Campanhas              (CONFIGURA o operacional)
 *   L2 Operacional  → Pautas, Criativos, Journey Log (nasce/morre com status)
 *
 * Princípio central: herança L1→L2. A Campanha (L1) configura os Criativos (L2)
 * — framework, regras de caption, hashtags-base, CTA. O Criativo aponta para a
 * Campanha via relacionamento (ou dropdown fallback no plano Free).
 *
 * Este script é REPLICÁVEL: rode-o para qualquer cliente novo (SaaS) trocando
 * apenas o CLICKUP_SPACE_ID. Gera scripts/clickup-map.json como fonte de verdade
 * dos IDs de estrutura — consumido por scripts/clickup.js.
 *
 * Uso:  node scripts/clickup-bootstrap.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.CLICKUP_API_KEY;
const SPACE_ID = process.env.CLICKUP_SPACE_ID;
const BASE = 'https://api.clickup.com/api/v2';
const MAP_PATH = path.join(__dirname, 'clickup-map.json');

if (!TOKEN || !SPACE_ID) {
  console.error('Faltam CLICKUP_API_KEY ou CLICKUP_SPACE_ID no .env');
  process.exit(1);
}

// ── HTTP helper ──────────────────────────────────────────────
async function api(method, pathStr, body) {
  const res = await fetch(BASE + pathStr, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (data && data.err) {
    throw new Error(`${data.err} (ECODE ${data.ECODE})`);
  }
  return data;
}

async function createFolder(name) {
  const f = await api('POST', `/space/${SPACE_ID}/folder`, { name });
  console.log(`  📁 Folder: ${name} (${f.id})`);
  return f.id;
}

async function createList(folderId, name) {
  const l = await api('POST', `/folder/${folderId}/list`, { name });
  // List creation às vezes retorna id undefined — re-busca por nome
  let id = l.id;
  if (!id) {
    const lists = await api('GET', `/folder/${folderId}/list`);
    const found = (lists.lists || []).find((x) => x.name === name);
    id = found && found.id;
  }
  console.log(`    📋 Lista: ${name} (${id})`);
  return id;
}

/**
 * Cria custom field e retorna { id, options } re-buscando da lista
 * (o POST de field retorna id undefined no ClickUp).
 */
async function createField(listId, def) {
  try {
    await api('POST', `/list/${listId}/field`, def);
  } catch (e) {
    console.warn(`      ⚠ Field "${def.name}" (${def.type}): ${e.message}`);
    return null;
  }
  // Re-busca para pegar o id e os option ids
  const fields = await api('GET', `/list/${listId}/field`);
  const f = (fields.fields || []).find((x) => x.name === def.name);
  if (!f) {
    console.warn(`      ⚠ Field "${def.name}" criado mas não encontrado no re-fetch`);
    return null;
  }
  const out = { id: f.id, type: f.type };
  if (f.type_config && Array.isArray(f.type_config.options)) {
    out.options = {};
    for (const o of f.type_config.options) out.options[o.name] = o.id;
  }
  console.log(`      ✓ Field: ${def.name} (${f.type})`);
  return out;
}

// ── Definições de custom fields por entidade ─────────────────
const STATUS_PIPELINE_CRIATIVO = {
  name: 'Status Pipeline',
  type: 'drop_down',
  type_config: {
    default: 0,
    options: [
      { name: 'Gerado',       orderindex: 0, color: '#87909e' },
      { name: 'Em Aprovacao', orderindex: 1, color: '#f8ae00' },
      { name: 'Aprovado',     orderindex: 2, color: '#1090e0' },
      { name: 'Agendado',     orderindex: 3, color: '#a875ff' },
      { name: 'Postado',      orderindex: 4, color: '#008844' },
    ],
  },
};

async function run() {
  console.log('\n🔧 Syncra ClickOps Bootstrap — EBS Aprendiz / Conteúdo\n');

  const map = {
    team: process.env.CLICKUP_TEAM_ID,
    space: SPACE_ID,
    folders: {},
    lists: {},
    fields: {},
  };

  // ── L0 — Estratégico ───────────────────────────────────────
  console.log('📐 L0 — Estratégico');
  map.folders.L0 = await createFolder('📐 L0 — Estratégico');
  map.lists.dna     = await createList(map.folders.L0, 'DNA - EBS');
  map.lists.icp     = await createList(map.folders.L0, 'ICP - Aluno Ideal');
  map.lists.ofertas = await createList(map.folders.L0, 'Ofertas');

  // DNA fields
  map.fields.dna = {};
  map.fields.dna.tipo = await createField(map.lists.dna, {
    name: 'Tipo', type: 'drop_down',
    type_config: { options: [
      { name: 'Missão', orderindex: 0 },
      { name: 'Tom de Voz', orderindex: 1 },
      { name: 'Invariante', orderindex: 2 },
      { name: 'Diferencial', orderindex: 3 },
      { name: 'Credencial', orderindex: 4 },
    ]},
  });

  // ICP fields
  map.fields.icp = {};
  map.fields.icp.faixa = await createField(map.lists.icp, {
    name: 'Faixa Etária', type: 'drop_down',
    type_config: { options: [
      { name: 'Criança (7-12)', orderindex: 0 },
      { name: 'Adolescente', orderindex: 1 },
      { name: 'Adulto', orderindex: 2 },
      { name: 'Pais/Responsáveis', orderindex: 3 },
    ]},
  });

  // Ofertas fields
  map.fields.ofertas = {};
  map.fields.ofertas.periodicidade = await createField(map.lists.ofertas, {
    name: 'Periodicidade', type: 'drop_down',
    type_config: { options: [
      { name: 'Mensal', orderindex: 0 },
      { name: 'Semestral', orderindex: 1 },
      { name: 'Anual', orderindex: 2 },
    ]},
  });

  // ── L1 — Tático ────────────────────────────────────────────
  console.log('\n🎯 L1 — Tático (configura o operacional)');
  map.folders.L1 = await createFolder('🎯 L1 — Tático');
  map.lists.campanhas = await createList(map.folders.L1, 'Campanhas');

  map.fields.campanhas = {};
  map.fields.campanhas.statusCampanha = await createField(map.lists.campanhas, {
    name: 'Status Campanha', type: 'drop_down',
    type_config: { options: [
      { name: 'Planejada', orderindex: 0, color: '#87909e' },
      { name: 'Ativa', orderindex: 1, color: '#1090e0' },
      { name: 'Encerrada', orderindex: 2, color: '#008844' },
    ]},
  });
  map.fields.campanhas.framework = await createField(map.lists.campanhas, {
    name: 'Framework Padrão', type: 'drop_down',
    type_config: { options: [
      { name: 'Cheat Sheet / Checklist', orderindex: 0 },
      { name: 'Desconstrução de Mito', orderindex: 1 },
      { name: 'Passo a Passo', orderindex: 2 },
      { name: 'Estudo de Caso', orderindex: 3 },
      { name: 'Amador vs Pro', orderindex: 4 },
    ]},
  });
  // Regras herdadas pelos Criativos
  map.fields.campanhas.regrasCaption = await createField(map.lists.campanhas, {
    name: 'Regras de Caption', type: 'text',
  });
  map.fields.campanhas.hashtagsBase = await createField(map.lists.campanhas, {
    name: 'Hashtags Base', type: 'text',
  });
  map.fields.campanhas.cta = await createField(map.lists.campanhas, {
    name: 'CTA Padrão', type: 'drop_down',
    type_config: { options: [
      { name: 'Fale conosco', orderindex: 0 },
      { name: 'Garanta sua vaga', orderindex: 1 },
      { name: 'Venha nos visitar', orderindex: 2 },
      { name: 'Sem CTA direto', orderindex: 3 },
    ]},
  });

  // ── L2 — Operacional ───────────────────────────────────────
  console.log('\n⚙️  L2 — Operacional (nasce/morre com status)');
  map.folders.L2 = await createFolder('⚙️ L2 — Operacional');
  map.lists.pautas     = await createList(map.folders.L2, 'Pautas');
  map.lists.criativos  = await createList(map.folders.L2, 'Criativos');
  map.lists.journeyLog = await createList(map.folders.L2, 'Journey Log');

  // Pautas fields
  map.fields.pautas = {};
  map.fields.pautas.statusPauta = await createField(map.lists.pautas, {
    name: 'Status Pauta', type: 'drop_down',
    type_config: { options: [
      { name: 'Backlog', orderindex: 0, color: '#87909e' },
      { name: 'Em Produção', orderindex: 1, color: '#f8ae00' },
      { name: 'Produzida', orderindex: 2, color: '#008844' },
    ]},
  });
  map.fields.pautas.framework = await createField(map.lists.pautas, {
    name: 'Framework Sugerido', type: 'drop_down',
    type_config: { options: [
      { name: 'Cheat Sheet / Checklist', orderindex: 0 },
      { name: 'Desconstrução de Mito', orderindex: 1 },
      { name: 'Passo a Passo', orderindex: 2 },
      { name: 'Estudo de Caso', orderindex: 3 },
      { name: 'Amador vs Pro', orderindex: 4 },
    ]},
  });
  map.fields.pautas.pilar = await createField(map.lists.pautas, {
    name: 'Pilar Visual', type: 'drop_down',
    type_config: { options: [
      { name: 'A — Metáfora', orderindex: 0 },
      { name: 'B — Diagrama/Save', orderindex: 1 },
      { name: 'C — Stop-scroll', orderindex: 2 },
    ]},
  });
  // Herança Pauta → Campanha
  map.fields.pautas.campanha = await createField(map.lists.pautas, {
    name: 'Campanha', type: 'list_relationship',
    type_config: { subcategory_id: map.lists.campanhas },
  });

  // Criativos fields (entidade central)
  map.fields.criativos = {};
  map.fields.criativos.formato = await createField(map.lists.criativos, {
    name: 'Formato', type: 'drop_down',
    type_config: { options: [
      { name: 'Carrossel', orderindex: 0 },
      { name: 'Reels', orderindex: 1 },
      { name: 'Story', orderindex: 2 },
      { name: 'Post Único', orderindex: 3 },
    ]},
  });
  map.fields.criativos.programa = await createField(map.lists.criativos, {
    name: 'Programa', type: 'drop_down',
    type_config: { options: [
      { name: 'EBS Aprendiz', orderindex: 0 },
      { name: 'Sobreviver com a Música', orderindex: 1 },
    ]},
  });
  map.fields.criativos.plataforma = await createField(map.lists.criativos, {
    name: 'Plataforma', type: 'drop_down',
    type_config: { options: [
      { name: 'Instagram', orderindex: 0 },
      { name: 'TikTok', orderindex: 1 },
    ]},
  });
  map.fields.criativos.dataPublicacao = await createField(map.lists.criativos, { name: 'Data de Publicação', type: 'date' });
  map.fields.criativos.caption       = await createField(map.lists.criativos, { name: 'Caption', type: 'text' });
  map.fields.criativos.hashtags      = await createField(map.lists.criativos, { name: 'Hashtags', type: 'short_text' });
  map.fields.criativos.agente        = await createField(map.lists.criativos, { name: 'Agente Gerador', type: 'short_text' });
  map.fields.criativos.bufferPostId  = await createField(map.lists.criativos, { name: 'Buffer Post ID', type: 'short_text' });
  map.fields.criativos.alcance       = await createField(map.lists.criativos, { name: 'Alcance', type: 'number' });
  map.fields.criativos.statusPipeline = await createField(map.lists.criativos, STATUS_PIPELINE_CRIATIVO);
  // Herança Criativo → Campanha (a relação central da metodologia)
  map.fields.criativos.campanha = await createField(map.lists.criativos, {
    name: 'Campanha', type: 'list_relationship',
    type_config: { subcategory_id: map.lists.campanhas },
  });
  // Rastreabilidade Criativo → Pauta
  map.fields.criativos.pauta = await createField(map.lists.criativos, {
    name: 'Pauta Origem', type: 'list_relationship',
    type_config: { subcategory_id: map.lists.pautas },
  });

  // ── Persistir mapa ─────────────────────────────────────────
  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2), 'utf8');
  console.log(`\n✅ Estrutura criada. Mapa salvo em scripts/clickup-map.json`);
  console.log('\nResumo:');
  console.log(`  L0: DNA(${map.lists.dna}) ICP(${map.lists.icp}) Ofertas(${map.lists.ofertas})`);
  console.log(`  L1: Campanhas(${map.lists.campanhas})`);
  console.log(`  L2: Pautas(${map.lists.pautas}) Criativos(${map.lists.criativos}) JourneyLog(${map.lists.journeyLog})`);
}

run().catch((e) => {
  console.error('\n❌ Bootstrap falhou:', e.message);
  process.exit(1);
});
