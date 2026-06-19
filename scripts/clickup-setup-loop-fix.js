/**
 * clickup-setup-loop-fix.js — Correção da Fase 1
 *
 * PUT /field não persiste options no ClickUp free.
 * Estratégia: DELETE campo + POST novo com todas as options.
 *
 * Antes de deletar, salva valores existentes nos criativos para re-aplicar.
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const MAP  = require('./clickup-map.json');

const BASE  = 'https://api.clickup.com/api/v2';
const TOKEN = process.env.CLICKUP_API_KEY;

async function api(method, endpoint, body) {
  const r = await fetch(BASE + endpoint, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let d = {};
  try { d = JSON.parse(text); } catch {}
  if (d && d.err) throw new Error(`ClickUp: ${d.err} (${d.ECODE || '?'}) — ${text.substring(0, 200)}`);
  return d;
}

async function getFields(listId) {
  const d = await api('GET', `/list/${listId}/field`);
  return d.fields || [];
}

/** Lê o valor de um dropdown em uma task */
async function readTaskDropdown(taskId, fieldId) {
  const d = await api('GET', `/task/${taskId}`);
  const cf = (d.custom_fields || []).find(f => f.id === fieldId);
  return cf && cf.value !== undefined ? cf : null;
}

/** Seta valor de dropdown via POST /task/:id/field/:fieldId */
async function setTaskDropdown(taskId, fieldId, optionId) {
  await api('POST', `/task/${taskId}/field/${fieldId}`, { value: optionId });
}

/** Recria um dropdown com novas options (delete + create) */
async function recreateDropdown(listId, fieldId, fieldName, allOptions) {
  // 1. Deletar o campo atual
  console.log(`  ↳ Deletando campo "${fieldName}" (${fieldId})...`);
  try {
    await api('DELETE', `/list/${listId}/field/${fieldId}`);
    console.log(`  ↳ Deletado`);
  } catch (e) {
    console.warn(`  ↳ DELETE falhou (${e.message}) — tentando continuar`);
  }

  // 2. Criar novo campo com todas as options
  console.log(`  ↳ Recriando "${fieldName}" com ${allOptions.length} options...`);
  await api('POST', `/list/${listId}/field`, {
    name: fieldName,
    type: 'drop_down',
    type_config: { options: allOptions.map(n => ({ name: n })) }
  });

  // 3. Re-buscar para pegar IDs gerados
  const fields = await getFields(listId);
  const newField = fields.find(f => f.name === fieldName);
  if (!newField) throw new Error(`Campo "${fieldName}" não encontrado após recriação`);

  const opts = newField.type_config && newField.type_config.options || [];
  const opMap = {};
  for (const o of opts) {
    if (o.name && o.id) opMap[o.name] = o.id;
  }

  console.log(`  ↳ Novo ID: ${newField.id}`);
  console.log(`  ↳ Options: ${Object.keys(opMap).join(', ')}`);
  return { newFieldId: newField.id, opMap };
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('   ClickUp Setup Loop — Fase 1 (FIX)');
  console.log('══════════════════════════════════════════════════\n');

  // ── 1. Criativos: salvar estado atual antes de deletar ──
  console.log('1. Salvando estado atual dos criativos...');
  const criatFieldId = MAP.fields.criativos.statusPipeline.id;

  // Buscar todos os criativos (custom_fields sempre vêm no response do ClickUp)
  const criatTasks = await api('GET', `/list/${MAP.lists.criativos}/task`);
  const tasks = criatTasks.tasks || [];
  const savedValues = [];
  for (const t of tasks) {
    const cf = (t.custom_fields || []).find(f => f.id === criatFieldId);
    if (cf && cf.value !== undefined) {
      // value pode ser o option_id (uuid) ou o option name
      const optName = cf.type_config && cf.type_config.options
        ? (cf.type_config.options.find(o => o.orderindex === cf.value || o.id === cf.value) || {}).name
        : null;
      savedValues.push({ taskId: t.id, taskName: t.name, optName, rawValue: cf.value });
      console.log(`  ↳ ${t.name} (${t.id}) → "${optName || cf.value}"`);
    }
  }
  if (savedValues.length === 0) console.log('  ↳ Nenhuma task com statusPipeline definido');

  // ── 2. Recriar statusPipeline (Criativos) ──
  console.log('\n2. Recriando statusPipeline (Criativos)...');
  const allPipelineOptions = [
    'Gerado', 'Em Aprovacao', 'Em Revisão', 'Aprovado', 'Agendado', 'Postado'
  ];
  const { newFieldId: newPipelineId, opMap: pipelineOpMap } = await recreateDropdown(
    MAP.lists.criativos,
    criatFieldId,
    MAP.fields.criativos.statusPipeline.name || 'Status Pipeline',
    allPipelineOptions
  );

  // 3. Restaurar valores nos criativos
  if (savedValues.length > 0) {
    console.log('\n3. Restaurando valores dos criativos...');
    for (const sv of savedValues) {
      const optId = pipelineOpMap[sv.optName];
      if (optId) {
        await setTaskDropdown(sv.taskId, newPipelineId, optId);
        console.log(`  ↳ ${sv.taskName} → "${sv.optName}" (${optId})`);
      } else {
        console.warn(`  ↳ ${sv.taskName} — opção "${sv.optName}" não encontrada no novo campo`);
      }
    }
  }

  // ── 4. Recriar statusPauta (Pautas) ──
  console.log('\n4. Recriando statusPauta (Pautas)...');
  const pautasFieldId = MAP.fields.pautas.statusPauta.id;
  const allPautaOptions = [
    'Backlog', 'Em Refinamento', 'Aprovada p/ Criar', 'Em Produção', 'Produzida'
  ];
  const { newFieldId: newPautaId, opMap: pautaOpMap } = await recreateDropdown(
    MAP.lists.pautas,
    pautasFieldId,
    MAP.fields.pautas.statusPauta.name || 'Status Pauta',
    allPautaOptions
  );

  // ── 5. Atualizar clickup-map.json ──
  console.log('\n5. Atualizando clickup-map.json...');

  MAP.fields.criativos.statusPipeline.id = newPipelineId;
  MAP.fields.criativos.statusPipeline.options = pipelineOpMap;

  MAP.fields.pautas.statusPauta.id = newPautaId;
  MAP.fields.pautas.statusPauta.options = pautaOpMap;

  fs.writeFileSync(
    path.join(__dirname, 'clickup-map.json'),
    JSON.stringify(MAP, null, 2),
    'utf8'
  );
  console.log('  ✅ clickup-map.json atualizado');

  // ── Resumo ──
  console.log('\n══════════════════════════════════════════════════');
  console.log('   FASE 1 (FIX) CONCLUÍDA');
  console.log('══════════════════════════════════════════════════');
  console.log('\nPautas:    ' + Object.keys(pautaOpMap).join(' → '));
  console.log('Criativos: ' + Object.keys(pipelineOpMap).join(' → '));
  console.log('\nIDs atualizados no clickup-map.json');
}

run().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
