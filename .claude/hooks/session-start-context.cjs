#!/usr/bin/env node
/**
 * SessionStart Hook — EBS Aprendiz
 *
 * Roda automaticamente no início de TODA sessão Claude Code.
 * Injeta o contexto crítico no system prompt para o agente não perder memória.
 *
 * Carrega:
 *   1. .aiox/handoffs/INDEX.md         — índice canonical de todos os handoffs
 *   2. handoff mais recente (max date) — descobertos em multiple locations
 *   3. queue.json status summary       — pipeline atual
 *   4. estado real Instagram vs queue  — alerta de dessincronia (se aplicável)
 *
 * Stdin format (Claude Code SessionStart hook):
 * { "session_id", "cwd", "hook_event_name": "SessionStart", "source": "startup|resume|clear|compact" }
 *
 * Stdout format:
 * { "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "..." } }
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ── Discover handoffs in ALL known locations ────────────────────────────────

function findHandoffs() {
  const found = [];

  // Location 1: .aiox/handoffs/*.yaml
  const aioxDir = path.join(PROJECT_ROOT, '.aiox', 'handoffs');
  if (fs.existsSync(aioxDir)) {
    for (const f of fs.readdirSync(aioxDir)) {
      if (f.startsWith('session-state-') && f.endsWith('.yaml')) {
        const m = f.match(/(\d{4}-\d{2}-\d{2})/);
        if (m) found.push({ date: m[1], path: path.join(aioxDir, f), kind: 'yaml' });
      }
    }
  }

  // Location 2: docs/handoff-*.md
  const docsDir = path.join(PROJECT_ROOT, 'docs');
  if (fs.existsSync(docsDir)) {
    for (const f of fs.readdirSync(docsDir)) {
      if (f.startsWith('handoff-') && (f.endsWith('.md') || f.endsWith('.yaml'))) {
        const m = f.match(/(\d{4}-\d{2}-\d{2})/);
        if (m) found.push({ date: m[1], path: path.join(docsDir, f), kind: 'narrative' });
      }
    }
  }

  return found.sort((a, b) => b.date.localeCompare(a.date)); // desc by date
}

// ── Read INDEX.md ────────────────────────────────────────────────────────────

function readIndex() {
  const p = path.join(PROJECT_ROOT, '.aiox', 'handoffs', 'INDEX.md');
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

// ── Queue summary ────────────────────────────────────────────────────────────

function queueSummary() {
  const qp = path.join(PROJECT_ROOT, 'queue.json');
  if (!fs.existsSync(qp)) return null;
  try {
    const q = JSON.parse(fs.readFileSync(qp, 'utf-8'));
    const counts = { total: q.carousels.length };
    for (const c of q.carousels) {
      counts[c.status] = (counts[c.status] || 0) + 1;
    }
    const types = { tweet: 0, editorial: 0 };
    for (const c of q.carousels) {
      types[c.type || 'editorial']++;
    }
    return { counts, types };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Build context payload ───────────────────────────────────────────────────

function buildContext() {
  const handoffs = findHandoffs();
  const index    = readIndex();
  const queue    = queueSummary();

  const sections = [];

  sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  sections.push('🗂️  EBS APRENDIZ — CONTEXTO AUTO-CARREGADO');
  sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  sections.push('');
  sections.push('Este bloco é injetado automaticamente por session-start-context.cjs.');
  sections.push('Conteúdo do projeto que VOCÊ DEVE conhecer antes de qualquer trabalho.');
  sections.push('');

  // ── INDEX ──
  if (index) {
    sections.push('═══ 1. ÍNDICE DE HANDOFFS (.aiox/handoffs/INDEX.md) ═══');
    sections.push('');
    sections.push(index);
    sections.push('');
  } else {
    sections.push('⚠️  INDEX.md AUSENTE — criar em .aiox/handoffs/INDEX.md ASAP');
    sections.push('');
  }

  // ── Handoffs disponíveis ──
  sections.push('═══ 2. HANDOFFS DESCOBERTOS (sorted desc) ═══');
  sections.push('');
  if (handoffs.length === 0) {
    sections.push('Nenhum handoff encontrado.');
  } else {
    for (const h of handoffs) {
      const rel = path.relative(PROJECT_ROOT, h.path).replace(/\\/g, '/');
      sections.push(`  • ${h.date} — ${rel} (${h.kind})`);
    }
  }
  sections.push('');

  // ── Most recent handoff (full content) ──
  if (handoffs.length > 0) {
    const recent = handoffs[0];
    const rel = path.relative(PROJECT_ROOT, recent.path).replace(/\\/g, '/');
    sections.push(`═══ 3. HANDOFF MAIS RECENTE — ${rel} ═══`);
    sections.push('');
    try {
      const content = fs.readFileSync(recent.path, 'utf-8');
      // Limit to first 6000 chars to avoid bloating
      sections.push(content.length > 6000
        ? content.substring(0, 6000) + '\n\n[...truncado — abra o arquivo para mais]'
        : content);
    } catch (e) {
      sections.push('Erro ao ler: ' + e.message);
    }
    sections.push('');
  }

  // ── Queue summary ──
  if (queue && !queue.error) {
    sections.push('═══ 4. ESTADO ATUAL DA QUEUE (queue.json) ═══');
    sections.push('');
    sections.push(`  Total: ${queue.counts.total}`);
    for (const [status, count] of Object.entries(queue.counts)) {
      if (status === 'total') continue;
      sections.push(`  ${status}: ${count}`);
    }
    sections.push(`  Por tipo: tweet=${queue.types.tweet}, editorial=${queue.types.editorial}`);
    sections.push('');
    sections.push('  ⚠️  ATENÇÃO: queue.json pode estar dessincronizado do Instagram real.');
    sections.push('     Verifique a verdade do feed via scripts/check-instagram.js antes de assumir.');
    sections.push('');
  }

  // ── Protocolos ──
  sections.push('═══ 5. PROTOCOLOS MANDATÓRIOS ═══');
  sections.push('');
  sections.push('  ✓ Leu o INDEX e o handoff mais recente acima');
  sections.push('  ✓ Antes de editar scripts/dashboard.js: tenha em mente que vai rodar smoke test');
  sections.push('  ✓ Depois de editar scripts/dashboard.js: rodar `node scripts/test-dashboard.js`');
  sections.push('  ✓ Antes de afirmar estado do Instagram: rodar `node scripts/check-instagram.js`');
  sections.push('  ✓ Ao final da sessão: atualizar handoff em .aiox/handoffs/session-state-YYYY-MM-DD.yaml');
  sections.push('  ✓ Ao final da sessão: atualizar INDEX.md com entrada cronológica nova');
  sections.push('');
  sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return sections.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  try {
    const additionalContext = buildContext();
    const out = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
    };
    process.stdout.write(JSON.stringify(out));
    process.exit(0);
  } catch (err) {
    // Fail open — don't block session if hook errors
    process.stderr.write('session-start-context hook error: ' + err.message + '\n');
    process.exit(0);
  }
}

main();
