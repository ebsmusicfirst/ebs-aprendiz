/**
 * clickup.js — ClickUp Integration (Metodologia Syncra)
 * EBS Aprendiz — Domínio Conteúdo
 *
 * Backend de dados do pipeline de conteúdo, organizado em 3 níveis:
 *   L0 Estratégico  → DNA, ICP, Ofertas       (fonte da verdade)
 *   L1 Tático       → Campanhas               (CONFIGURA os criativos)
 *   L2 Operacional  → Pautas, Criativos, Journey Log
 *
 * HERANÇA (núcleo da metodologia): cada Criativo aponta para uma Campanha e
 * herda dela framework, regras de caption, hashtags-base e CTA. Mudou a
 * campanha → muda a regra para todos os criativos que a referenciam.
 *
 * Fonte de verdade dos IDs: scripts/clickup-map.json (gerado pelo bootstrap).
 * Token: .env (CLICKUP_API_KEY).
 */

require('dotenv').config();
const MAP = require('./clickup-map.json');

const BASE = 'https://api.clickup.com/api/v2';
const TOKEN = process.env.CLICKUP_API_KEY;

const LISTS = MAP.lists;
const F = MAP.fields; // F.criativos.formato.id, F.criativos.formato.options['Carrossel'], ...

// Status pipeline (option IDs do dropdown "Status Pipeline" em Criativos)
const STATUS = {
  GERADO:       F.criativos.statusPipeline.options['Gerado'],
  EM_APROVACAO: F.criativos.statusPipeline.options['Em Aprovacao'],
  EM_REVISAO:   F.criativos.statusPipeline.options['Em Revisão'],
  APROVADO:     F.criativos.statusPipeline.options['Aprovado'],
  AGENDADO:     F.criativos.statusPipeline.options['Agendado'],
  POSTADO:      F.criativos.statusPipeline.options['Postado'],
};

// ── HTTP ─────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (data && data.err) throw new Error(`ClickUp: ${data.err} (${data.ECODE})`);
  return data;
}

/**
 * Helper: monta {id, value} para dropdown a partir do nome da option.
 * Usado em custom_fields no CREATE de task (onde dropdowns funcionam por option id).
 */
function dd(fieldDef, optionName) {
  const optId = fieldDef.options && fieldDef.options[optionName];
  if (!optId) return null;
  return { id: fieldDef.id, value: optId };
}

/**
 * Seta um dropdown numa task EXISTENTE via endpoint dedicado.
 * (PUT /task com custom_fields NÃO persiste dropdowns — precisa do field endpoint.)
 */
async function setDropdown(taskId, fieldDef, optionName) {
  const optId = fieldDef.options && fieldDef.options[optionName];
  if (!optId) return;
  await api('POST', `/task/${taskId}/field/${fieldDef.id}`, { value: optId });
}

/** Seta valor de field simples (text/number/date) via endpoint dedicado. */
async function setFieldValue(taskId, fieldId, value) {
  await api('POST', `/task/${taskId}/field/${fieldId}`, { value });
}

/**
 * Lê o nome da option selecionada de um dropdown a partir da task.
 * O ClickUp retorna o value como orderindex (número) na leitura — resolve via
 * type_config.options[value], com fallback para option id (string).
 */
function readDropdown(fieldDef, task) {
  const f = (task.custom_fields || []).find((x) => x.id === fieldDef.id);
  if (!f || f.value == null) return null;
  if (typeof f.value === 'number') {
    const opt = f.type_config && f.type_config.options && f.type_config.options[f.value];
    return opt ? opt.name : null;
  }
  const entry = Object.entries(fieldDef.options || {}).find(([, id]) => id === f.value);
  return entry ? entry[0] : null;
}

/** Lê valor de field simples (text/number/date) a partir da task. */
function readField(fieldDef, task) {
  const f = (task.custom_fields || []).find((x) => x.id === fieldDef.id);
  return f ? f.value : null;
}

/** Atualiza a descrição markdown de uma task (usado para preview de slides). */
async function updateTaskDescription(taskId, markdownText) {
  await api('PUT', `/task/${taskId}`, { markdown_description: markdownText });
}

/** Seta um relationship field (add target task). Roda após criar a task. */
async function setRelationship(taskId, fieldId, targetTaskId) {
  if (!targetTaskId) return;
  await api('POST', `/task/${taskId}/field/${fieldId}`, {
    value: { add: [targetTaskId] },
  });
}

// ─────────────────────────────────────────────────────────────
// L1 — CAMPANHAS (configura os criativos)
// ─────────────────────────────────────────────────────────────

/**
 * Cria uma Campanha (entidade tática que configura criativos).
 * @param {Object} c
 * @param {string} c.title
 * @param {string} [c.framework]      - nome da option (ver map: campanhas.framework)
 * @param {string} [c.regrasCaption]  - regras herdadas pelos criativos
 * @param {string} [c.hashtagsBase]
 * @param {string} [c.cta]            - 'Fale conosco' | 'Garanta sua vaga' | ...
 * @param {string} [c.status]         - 'Planejada' | 'Ativa' | 'Encerrada'
 */
async function createCampanha(c) {
  const cf = [];
  const push = (x) => x && cf.push(x);
  push(dd(F.campanhas.statusCampanha, c.status || 'Planejada'));
  if (c.framework) push(dd(F.campanhas.framework, c.framework));
  if (c.cta) push(dd(F.campanhas.cta, c.cta));
  if (c.regrasCaption) cf.push({ id: F.campanhas.regrasCaption.id, value: c.regrasCaption });
  if (c.hashtagsBase) cf.push({ id: F.campanhas.hashtagsBase.id, value: c.hashtagsBase });

  const task = await api('POST', `/list/${LISTS.campanhas}/task`, {
    name: c.title,
    status: 'to do',
    custom_fields: cf,
  });
  await journalLog('campanha_criada', task.id, c.title, {});
  return task;
}

async function listCampanhas() {
  const d = await api('GET', `/list/${LISTS.campanhas}/task?include_closed=true`);
  return d.tasks || [];
}

async function getCampanha(taskId) {
  return api('GET', `/task/${taskId}`);
}

/**
 * HERANÇA: lê as regras de uma Campanha para aplicar a um Criativo.
 * Retorna { framework, regrasCaption, hashtagsBase, cta }.
 */
async function getCampanhaRegras(campanhaId) {
  const task = await getCampanha(campanhaId);
  return {
    framework:     readDropdown(F.campanhas.framework, task),
    cta:           readDropdown(F.campanhas.cta, task),
    regrasCaption: readField(F.campanhas.regrasCaption, task),
    hashtagsBase:  readField(F.campanhas.hashtagsBase, task),
  };
}

// ─────────────────────────────────────────────────────────────
// L0 — ESTRATÉGICO (DNA): governa o tom de toda geração de conteúdo
// ─────────────────────────────────────────────────────────────

/**
 * Lê o DNA Estratégico (L0) do cliente direto do ClickUp.
 * Cada entrada do DNA tem o resumo no `name` e regras detalhadas na descrição.
 * Indexa por Tipo (Missão | Tom de Voz | Invariante | Diferencial | Credencial).
 *
 * SaaS: nenhum conteúdo de marca é hardcoded — vem todo daqui, por list-ID
 * do cliente em clickup-map.json. Cliente N+1 só preenche o ClickUp dele.
 *
 * @returns {Promise<Object>} { missao, tomDeVoz, invariante, diferencial, credencial }
 *   onde cada valor é { resumo, detalhe }.
 */
async function getDnaEstrategico() {
  const d = await api('GET', `/list/${LISTS.dna}/task?include_closed=true`);
  const tasks = d.tasks || [];
  const tipoField = F.dna.tipo;

  const out = {};
  const slugByTipo = {
    'Missão': 'missao',
    'Tom de Voz': 'tomDeVoz',
    'Invariante': 'invariante',
    'Diferencial': 'diferencial',
    'Credencial': 'credencial',
  };

  for (const t of tasks) {
    const tipo = readDropdown(tipoField, t);
    const slug = slugByTipo[tipo];
    if (!slug) continue;
    // A descrição rica (regras detalhadas) pode não vir no list endpoint;
    // refetch individual garante text_content completo quando o resumo tem detalhe.
    let detalhe = (t.text_content || t.description || '').trim();
    if (!detalhe) {
      const full = await api('GET', `/task/${t.id}`).catch(() => null);
      if (full) detalhe = (full.text_content || full.description || '').trim();
    }
    out[slug] = { resumo: (t.name || '').trim(), detalhe };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// L2 — PAUTAS (backlog → alimenta agentes)
// ─────────────────────────────────────────────────────────────

async function createPauta(p) {
  const cf = [];
  const push = (x) => x && cf.push(x);
  push(dd(F.pautas.statusPauta, p.status || 'Backlog'));
  if (p.framework) push(dd(F.pautas.framework, p.framework));
  if (p.pilar) push(dd(F.pautas.pilar, p.pilar));

  const task = await api('POST', `/list/${LISTS.pautas}/task`, {
    name: p.title,
    status: 'to do',
    custom_fields: cf,
  });
  if (p.campanhaId) await setRelationship(task.id, F.pautas.campanha.id, p.campanhaId);
  await journalLog('pauta_criada', task.id, p.title, {});
  return task;
}

async function listPautas() {
  const d = await api('GET', `/list/${LISTS.pautas}/task?include_closed=true`);
  return d.tasks || [];
}

// ─────────────────────────────────────────────────────────────
// L2 — CRIATIVOS (entidade central)
// ─────────────────────────────────────────────────────────────

/**
 * Cria um Criativo. Se vier campanhaId, herda regras da campanha.
 * @param {Object} c
 * @param {string} c.title
 * @param {string} [c.formato]    - 'Carrossel' | 'Reels' | ...
 * @param {string} [c.programa]   - 'EBS Aprendiz' | ...
 * @param {string} [c.plataforma] - 'Instagram' | 'TikTok'
 * @param {string} [c.caption]
 * @param {string} [c.hashtags]
 * @param {string} [c.agente]
 * @param {number} [c.dataPublicacao] - timestamp ms
 * @param {string} [c.campanhaId] - task id da Campanha (herança)
 * @param {string} [c.pautaId]    - task id da Pauta de origem
 * @param {boolean} [c.herdar=true] - aplicar herança da campanha quando faltar caption/hashtags
 */
async function createCriativo(c) {
  let { caption, hashtags } = c;

  // HERANÇA: se aponta para campanha e faltam campos, herda dela
  if (c.campanhaId && c.herdar !== false) {
    const regras = await getCampanhaRegras(c.campanhaId);
    if (!hashtags && regras.hashtagsBase) hashtags = regras.hashtagsBase;
    // regrasCaption não substitui o caption (é diretriz), mas fica disponível ao agente
    c._regrasHerdadas = regras;
  }

  const cf = [];
  const push = (x) => x && cf.push(x);
  if (c.formato) push(dd(F.criativos.formato, c.formato));
  if (c.programa) push(dd(F.criativos.programa, c.programa));
  if (c.plataforma) push(dd(F.criativos.plataforma, c.plataforma));
  push(dd(F.criativos.statusPipeline, 'Gerado'));
  if (caption) cf.push({ id: F.criativos.caption.id, value: caption });
  if (hashtags) cf.push({ id: F.criativos.hashtags.id, value: hashtags });
  if (c.agente) cf.push({ id: F.criativos.agente.id, value: c.agente });
  if (c.dataPublicacao) cf.push({ id: F.criativos.dataPublicacao.id, value: c.dataPublicacao });

  const task = await api('POST', `/list/${LISTS.criativos}/task`, {
    name: c.title,
    status: 'to do',
    custom_fields: cf,
  });

  if (c.campanhaId) await setRelationship(task.id, F.criativos.campanha.id, c.campanhaId);
  if (c.pautaId) await setRelationship(task.id, F.criativos.pauta.id, c.pautaId);

  await journalLog('criativo_criado', task.id, c.title, { agente: c.agente, campanhaId: c.campanhaId });
  return task;
}

async function listCriativos(statusName) {
  const d = await api('GET', `/list/${LISTS.criativos}/task?include_closed=true`);
  let tasks = d.tasks || [];
  if (statusName) {
    tasks = tasks.filter((t) => readDropdown(F.criativos.statusPipeline, t) === statusName);
  }
  return tasks;
}

/** Lê o status atual (nome) do pipeline de um criativo. */
function statusDe(task) {
  return readDropdown(F.criativos.statusPipeline, task);
}

async function getCriativo(taskId) {
  return api('GET', `/task/${taskId}`);
}

/**
 * Move um Criativo no pipeline (atualiza dropdown Status Pipeline + status nativo).
 * @param {string} taskId
 * @param {string} statusName - 'Gerado' | 'Em Aprovacao' | 'Aprovado' | 'Agendado' | 'Postado'
 * @param {Object} [extra]   - { bufferPostId, dataPublicacao, alcance }
 */
async function updateStatus(taskId, statusName, extra = {}) {
  // Dropdown via endpoint dedicado (PUT /task com custom_fields não persiste dropdown)
  await setDropdown(taskId, F.criativos.statusPipeline, statusName);
  // Status nativo da task (open/closed) acompanha o pipeline
  const nativeStatus = statusName === 'Postado' ? 'complete' : 'to do';
  await api('PUT', `/task/${taskId}`, { status: nativeStatus });
  // Campos extras
  if (extra.bufferPostId) await setFieldValue(taskId, F.criativos.bufferPostId.id, extra.bufferPostId);
  if (extra.dataPublicacao) await setFieldValue(taskId, F.criativos.dataPublicacao.id, extra.dataPublicacao);
  if (extra.alcance != null) await setFieldValue(taskId, F.criativos.alcance.id, extra.alcance);

  await journalLog('status_change', taskId, null, { status: statusName, ...extra });
  return { id: taskId, status: statusName };
}

const aprovar           = (id) => updateStatus(id, 'Aprovado');
const moverParaRevisao  = (id) => updateStatus(id, 'Em Revisão');
const marcarAgendado    = (id, bufferPostId, dataPublicacao) => updateStatus(id, 'Agendado', { bufferPostId, dataPublicacao });
const marcarPostado     = (id, alcance) => updateStatus(id, 'Postado', { alcance });

async function updateCaption(taskId, caption) {
  await setFieldValue(taskId, F.criativos.caption.id, caption);
  await journalLog('caption_editada', taskId, null, {});
}

async function updateNotasRevisao(taskId, notas) {
  await setFieldValue(taskId, F.criativos.notasRevisao.id, notas);
  await journalLog('notas_revisao', taskId, null, { notas });
}

async function listPautasAprovadas() {
  const tasks = await listPautas();
  return tasks.filter(t => readDropdown(F.pautas.statusPauta, t) === 'Aprovada p/ Criar');
}

async function updateStatusPauta(taskId, statusName) {
  await setDropdown(taskId, F.pautas.statusPauta, statusName);
  await journalLog('pauta_status_change', taskId, null, { status: statusName });
}

// ─────────────────────────────────────────────────────────────
// JOURNEY LOG
// ─────────────────────────────────────────────────────────────
async function journalLog(event, taskId, title, data = {}) {
  const ts = new Date().toISOString();
  try {
    await api('POST', `/list/${LISTS.journeyLog}/task`, {
      name: `[${ts}] ${event} | ${title || taskId}`,
      description: JSON.stringify({ event, taskId, title, ...data }, null, 2),
      status: 'to do',
    });
  } catch (e) {
    console.warn('[ClickUp] Journal log falhou:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// MIGRAÇÃO — queue.json → ClickUp
// ─────────────────────────────────────────────────────────────
async function migrateFromQueue(queuePath, campanhaId) {
  const fs = require('fs');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const items = Array.isArray(queue) ? queue : queue.carousels || queue.items || [];

  const statusMap = {
    published: 'Postado', posted: 'Postado',
    scheduled: 'Agendado',
    pending_approval: 'Em Aprovacao', approved: 'Aprovado',
    draft: 'Gerado', pending: 'Gerado',
  };

  let ok = 0, fail = 0;
  for (const item of items) {
    const statusName = statusMap[item.status] || 'Gerado';
    try {
      const task = await createCriativo({
        title: item.id || item.file || item.title || 'Criativo',
        formato: 'Carrossel',
        programa: 'EBS Aprendiz',
        plataforma: 'Instagram',
        caption: item.caption || undefined,
        dataPublicacao: item.scheduledAt ? new Date(item.scheduledAt).getTime() : undefined,
        campanhaId,
        herdar: false,
      });
      if (statusName !== 'Gerado') {
        await updateStatus(task.id, statusName, {
          bufferPostId: item.bufferId || undefined,
        });
      }
      console.log(`  ✓ ${task.name} [${statusName}]`);
      ok++;
    } catch (e) {
      console.warn(`  ✗ ${item.id || item.file}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\nMigração: ${ok} criados, ${fail} falharam.`);
}

module.exports = {
  MAP, LISTS, FIELDS: F, STATUS,
  // L0 estratégico
  getDnaEstrategico,
  // campanhas
  createCampanha, listCampanhas, getCampanha, getCampanhaRegras,
  // pautas
  createPauta, listPautas, listPautasAprovadas, updateStatusPauta,
  // criativos
  createCriativo, listCriativos, getCriativo, statusDe,
  updateStatus, aprovar, moverParaRevisao, marcarAgendado, marcarPostado,
  updateCaption, updateNotasRevisao, updateTaskDescription,
  // leitura/escrita de fields
  readDropdown, readField, setDropdown, setFieldValue, setRelationship,
  // util
  journalLog, migrateFromQueue,
};
