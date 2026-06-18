#!/usr/bin/env node
/**
 * PostToolUse Hook — EBS Aprendiz
 *
 * Dispara automaticamente APÓS toda edição em scripts/dashboard.js
 * Executa o smoke test completo (scripts/test-dashboard.js) e injeta
 * o resultado no contexto da sessão via hookSpecificOutput.
 *
 * Registrado em: .claude/settings.local.json → PostToolUse (matcher: Edit|Write)
 *
 * Stdin format (Claude Code PostToolUse hook):
 * { "session_id", "hook_event_name": "PostToolUse", "tool_name", "tool_input", "tool_response", "cwd" }
 *
 * Stdout format:
 * { "hookSpecificOutput": { "hookEventName": "PostToolUse", "additionalContext": "..." } }
 */

'use strict';

const cp   = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Verifica se o evento é uma edição ao dashboard.js.
 * O matcher do settings.json já filtra por Edit|Write — aqui cheamos o path.
 */
function isDashboardEdit(input) {
  const toolName = (input.tool_name || '').trim();
  if (!['Edit', 'Write'].includes(toolName)) return false;

  const toolInput = input.tool_input || {};
  const filePath  = (toolInput.file_path || '').replace(/\\/g, '/');

  return filePath.includes('scripts/dashboard.js');
}

/**
 * Executa o smoke test e retorna resultado.
 * Timeout de 80s (o hook tem 90s de budget).
 */
function runSmokeTest() {
  return new Promise((resolve) => {
    const proc = cp.spawn(process.execPath, ['scripts/test-dashboard.js'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });

    // Safety timeout — se o test-dashboard.js travar, não bloqueamos indefinidamente
    const killTimer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ code: -1, stdout, stderr: stderr + '\n[TIMEOUT: smoke test excedeu 80s]' });
    }, 80000);

    proc.on('close', code => {
      clearTimeout(killTimer);
      resolve({ code, stdout, stderr });
    });

    proc.on('error', err => {
      clearTimeout(killTimer);
      resolve({ code: -1, stdout: '', stderr: err.message });
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const input = await readStdin();

  // Sair silenciosamente se não for edição do dashboard
  if (!isDashboardEdit(input)) {
    process.exit(0);
    return;
  }

  process.stderr.write('[post-dashboard-test] dashboard.js editado — iniciando smoke test...\n');

  const result = await runSmokeTest();

  const passed  = result.code === 0;
  const status  = passed ? '🟢 PASSOU' : '🔴 FALHOU';

  // Filtrar linhas relevantes do output
  const lines = result.stdout.split('\n');
  const summaryLines = lines.filter(l =>
    l.includes('✅') || l.includes('❌') || l.includes('━━━') ||
    l.includes('Passes') || l.includes('Falhas') || l.includes('RESUMO')
  );

  const summaryText = summaryLines.length > 0
    ? summaryLines.join('\n')
    : result.stdout.slice(-800);  // fallback: últimas 800 chars

  const errorHint = !passed && result.stderr
    ? `\nSTDERR: ${result.stderr.slice(0, 300)}`
    : '';

  const additionalContext = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `🧪 AUTO-TEST: dashboard.js foi editado`,
    `   Smoke Test: ${status} (exit code: ${result.code})`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    summaryText,
    errorHint,
    passed
      ? '\n✅ Dashboard OK — pode continuar com segurança.'
      : '\n⚠️  Dashboard com falhas — revisar antes de agendar/publicar.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  const out = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext,
    },
  };

  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

// Safety timeout global — hook nunca pode bloquear a sessão
const globalTimer = setTimeout(() => { process.exit(0); }, 88000);
globalTimer.unref();

main().catch(() => process.exit(0));
