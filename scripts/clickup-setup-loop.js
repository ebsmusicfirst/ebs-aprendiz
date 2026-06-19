/**
 * clickup-setup-loop.js — Fase 1 da implementação do Loop
 *
 * Ajusta a estrutura do ClickUp para suportar o loop autônomo:
 *   1. Adiciona "Em Refinamento" e "Aprovada p/ Criar" ao statusPauta (Pautas)
 *   2. Adiciona "Em Revisão" ao statusPipeline (Criativos)
 *   3. Cria campo "Notas de Revisão" (text) em Criativos
 *   4. Atualiza scripts/clickup-map.json com novos IDs
 *
 * Uso: node scripts/clickup-setup-loop.js
 */

require('dotenv').config();
const fs  = require('fs');
const MAP = require('./clickup-map.json');

const BASE  = 'https://api.clickup.com/api/v2';
const TOKEN = process.env.CLICKUP_API_KEY;
const LISTS = MAP.lists;

// ── HTTP ──────────────────────────────────────────────────────
async function api(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (d && d.err) throw new Error(`ClickUp: ${d.err} (${d.ECODE || '?'})`);
  return d;
}

/** Busca todos os custom fields de uma lista */
async function getFields(listId) {
  const d = await api('GET', `/list/${listId}/field`);
  return d.fields || [];
}

/** Recria um dropdown adicionando novas options às existentes */
async function addDropdownOptions(fieldId, listId, newOptions) {
  // Busca o field atual para pegar type_config completo
  const fields = await getFields(listId);
  const field  = fields.find(f => f.id === fieldId);
  if (!field) throw new Error(`Field ${fieldId} não encontrado na lista ${listId}`);

  const existing = (field.type_config && field.type_config.options) || [];
  const existingNames = existing.map(o => o.name);

  // Filtra apenas as novas que ainda não existem
  const toAdd = newOptions.filter(n => !existingNames.includes(n));
  if (toAdd.length === 0) {
    console.log(`  ↳ Nenhuma nova option para adicionar (${newOptions.join(', ')} já existem)`);
    return existing;
  }

  // Tenta adicionar via PUT do campo com type_config atualizado
  const updatedOptions = [
    ...existing,
    ...toAdd.map(name => ({ name }))
  ];

  try {
    await api('PUT', `/field/${fieldId}`, {
      type_config: { options: updatedOptions }
    });
    console.log(`  ↳ PUT /field/${fieldId} OK — adicionadas: ${toAdd.join(', ')}`);
  } catch (e) {
    console.warn(`  ↳ PUT falhou (${e.message}) — tentando via type_config no POST...`);
    // Fallback: algumas versões do ClickUp Free precisam do endpoint diferente
    await api('POST', `/list/${listId}/field`, {
      name: field.name,
      type: 'drop_down',
      type_config: { options: updatedOptions }
    });
    console.log(`  ↳ Recriado via POST — adicionadas: ${toAdd.join(', ')}`);
  }

  // Re-busca para pegar os IDs gerados pelo ClickUp
  const updated = await getFields(listId);
  const updatedField = updated.find(f => f.id === fieldId || f.name === field.name);
  return (updatedField && updatedField.type_config && updatedField.type_config.options) || updatedOptions;
}

/** Cria um campo de texto simples, se não existir */
async function ensureTextField(listId, fieldName) {
  const fields = await getFields(listId);
  const existing = fields.find(f => f.name === fieldName);
  if (existing) {
    console.log(`  ↳ Campo "${fieldName}" já existe (${existing.id})`);
    return existing;
  }

  await api('POST', `/list/${listId}/field`, {
    name: fieldName,
    type: 'text',
  });
  console.log(`  ↳ Campo "${fieldName}" criado`);

  // Re-busca para pegar o ID
  const updated = await getFields(listId);
  return updated.find(f => f.name === fieldName);
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('   ClickUp Setup Loop — Fase 1');
  console.log('══════════════════════════════════════════════════\n');

  // ── 1. Pautas: adicionar "Em Refinamento" e "Aprovada p/ Criar" ──
  console.log('1. Pautas — adicionando status ao statusPauta...');
  const pautasFieldId = MAP.fields.pautas.statusPauta.id;
  const pautasOptions = await addDropdownOptions(
    pautasFieldId,
    LISTS.pautas,
    ['Em Refinamento', 'Aprovada p/ Criar']
  );

  // Constrói mapa nome → id
  const pautasOpMap = {};
  for (const o of pautasOptions) {
    if (o.name && o.id) pautasOpMap[o.name] = o.id;
  }
  console.log(`  ✅ statusPauta agora: ${Object.keys(pautasOpMap).join(', ')}\n`);

  // ── 2. Criativos: adicionar "Em Revisão" ao statusPipeline ──
  console.log('2. Criativos — adicionando "Em Revisão" ao statusPipeline...');
  const criatFieldId = MAP.fields.criativos.statusPipeline.id;
  const criatOptions = await addDropdownOptions(
    criatFieldId,
    LISTS.criativos,
    ['Em Revisão']
  );

  const criatOpMap = {};
  for (const o of criatOptions) {
    if (o.name && o.id) criatOpMap[o.name] = o.id;
  }
  console.log(`  ✅ statusPipeline agora: ${Object.keys(criatOpMap).join(', ')}\n`);

  // ── 3. Criativos: criar campo "Notas de Revisão" ──
  console.log('3. Criativos — criando campo "Notas de Revisão"...');
  const notasField = await ensureTextField(LISTS.criativos, 'Notas de Revisão');
  console.log(`  ✅ notasRevisao id: ${notasField?.id}\n`);

  // ── 4. Atualizar clickup-map.json ──
  console.log('4. Atualizando clickup-map.json...');

  // Merge options existentes com novas (preserva IDs conhecidos)
  const mergeOptions = (existing, newMap) => {
    return { ...existing, ...newMap };
  };

  MAP.fields.pautas.statusPauta.options = mergeOptions(
    MAP.fields.pautas.statusPauta.options,
    pautasOpMap
  );

  MAP.fields.criativos.statusPipeline.options = mergeOptions(
    MAP.fields.criativos.statusPipeline.options,
    criatOpMap
  );

  if (notasField?.id) {
    MAP.fields.criativos.notasRevisao = {
      id: notasField.id,
      type: 'text'
    };
  }

  fs.writeFileSync(
    require('path').join(__dirname, 'clickup-map.json'),
    JSON.stringify(MAP, null, 2),
    'utf8'
  );
  console.log('  ✅ clickup-map.json atualizado\n');

  // ── Resumo ──
  console.log('══════════════════════════════════════════════════');
  console.log('   FASE 1 CONCLUÍDA');
  console.log('══════════════════════════════════════════════════');
  console.log('\nNovos estados disponíveis:');
  console.log('  Pautas:    Backlog → Em Refinamento → Aprovada p/ Criar → Em Produção → Produzida');
  console.log('  Criativos: Gerado → Em Aprovacao → Em Revisão → Aprovado → Agendado → Postado');
  console.log('\nNovo campo:');
  console.log('  criativos.notasRevisao — texto livre para feedback do Alex\n');
}

run().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
