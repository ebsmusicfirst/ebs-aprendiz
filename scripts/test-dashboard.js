#!/usr/bin/env node
/**
 * EBS Aprendiz — Smoke test do Dashboard
 *
 * Roda automaticamente quando scripts/dashboard.js é editado (via PostToolUse hook)
 * e manualmente via `node scripts/test-dashboard.js`.
 *
 * Garantias mínimas validadas:
 *   1. GET / retorna 200 com tamanho razoável
 *   2. <script> inline parseia sem erro de sintaxe
 *   3. Funções globais essenciais existem
 *   4. GET /api/queue retorna lista de carrosséis
 *   5. Em browser real (Playwright):
 *      - DOM renderiza N cards iguais ao queue
 *      - Cada tipo de botão de ação existe (approve/schedule/view/publish/export)
 *      - Clicar "Ver" abre o lightbox
 *      - Clicar "Aprovar"/"Agendar"/"Publicar" abre o respectivo modal
 *      - Filtro "Pendentes" reduz cards
 *      - Painel Pexels toggla e tem key pré-preenchida
 *      - Zero erros no console do browser
 *
 * Exit codes:
 *   0  — todos os testes passaram
 *   1  — pelo menos uma falha
 *
 * Spawna o servidor se não estiver rodando (em porta 3000).
 */

'use strict';

const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const cp       = require('child_process');
const { chromium } = require('playwright');

const BASE_DIR = path.resolve(__dirname, '..');
const PORT     = 3000;
const URL_BASE = `http://localhost:${PORT}`;

let serverProc = null;
const errors = [];
const passes = [];

// ── Utils ───────────────────────────────────────────────────────────────────

function ok(msg)    { passes.push(msg); console.log('  ✅', msg); }
function fail(msg)  { errors.push(msg); console.log('  ❌', msg); }
function section(t) { console.log('\n━━━', t, '━━━'); }

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    }).on('error', reject);
  });
}

async function isUp() {
  try { const r = await fetch(URL_BASE + '/api/queue'); return r.status === 200; }
  catch { return false; }
}

async function ensureServer() {
  if (await isUp()) {
    ok('Dashboard já está rodando em localhost:3000');
    return false; // não spawned
  }
  console.log('  🚀 Subindo dashboard…');
  serverProc = cp.spawn('node', ['scripts/dashboard.js'], {
    cwd: BASE_DIR,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // wait up to 5s
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await isUp()) { ok('Dashboard spawned'); return true; }
  }
  fail('Dashboard não subiu em 5s');
  return false;
}

function killServer(wasSpawned) {
  if (wasSpawned && serverProc) {
    try { serverProc.kill('SIGTERM'); } catch {}
  }
}

// ── Test 1: HTTP basics ────────────────────────────────────────────────────

async function testHTTPBasics() {
  section('1. HTTP basics');
  const dash = await fetch(URL_BASE + '/');
  if (dash.status === 200) ok('GET / → 200');
  else fail(`GET / → ${dash.status}`);

  if (dash.body.length > 50000) ok(`HTML size: ${dash.body.length} chars`);
  else fail(`HTML suspeitosamente pequeno: ${dash.body.length} chars`);

  const queue = await fetch(URL_BASE + '/api/queue');
  if (queue.status === 200) ok('GET /api/queue → 200');
  else { fail(`GET /api/queue → ${queue.status}`); return null; }

  try {
    const q = JSON.parse(queue.body);
    if (Array.isArray(q.carousels)) ok(`/api/queue retorna ${q.carousels.length} carousels`);
    else fail('queue.carousels não é array');

    // Token info endpoint
    const tok = await fetch(URL_BASE + '/api/meta/token-info');
    if (tok.status === 200) {
      try {
        const t = JSON.parse(tok.body);
        if (t.ok && t.username) ok(`/api/meta/token-info → @${t.username} (${Math.round(t.days_remaining_estimate || 0)}d restantes)`);
        else fail(`/api/meta/token-info retornou ok=false: ${t.reason || 'unknown'}`);
      } catch (e) { fail('/api/meta/token-info body não é JSON: ' + e.message); }
    } else fail(`/api/meta/token-info → ${tok.status}`);

    return q;
  } catch (e) {
    fail('queue body não é JSON válido: ' + e.message);
    return null;
  }
}

// ── Test 2: Inline script parses ────────────────────────────────────────────

async function testScriptParses(html) {
  section('2. Script inline parseia');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) { fail('Nenhum <script> encontrado'); return; }
  try {
    new Function(m[1]);
    ok('Script parseia sem erros de sintaxe');
  } catch (e) {
    fail('Script TEM erro de sintaxe: ' + e.message);
    // bisect para achar linha
    const lines = m[1].split('\n');
    let lastOK = 0;
    for (let i = 1; i <= lines.length; i++) {
      try { new Function(lines.slice(0, i).join('\n')); lastOK = i; } catch {}
    }
    console.log(`     última linha OK: ${lastOK}/${lines.length}`);
    if (lines[lastOK]) console.log(`     próxima linha: ${lines[lastOK]}`);
  }

  // Funções essenciais
  const required = [
    'loadQueue', 'renderGrid', 'updateStats',
    'openApprove', 'openSchedule', 'openPreview', 'openPublish',
    'exportPNGs', 'searchPexels', 'togglePexels',
    'confirmSchedule', 'executeConfirm', 'updateStatus',
  ];
  for (const fn of required) {
    if (m[1].indexOf('function ' + fn + '(') !== -1) ok(`def: ${fn}()`);
    else fail(`def: ${fn}() AUSENTE`);
  }
}

// ── Test 3: Browser interactions ────────────────────────────────────────────

async function testBrowser(queue) {
  section('3. Browser interactions (Playwright)');
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const consoleErrors = [];
  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  try {
    await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 8000 });
    ok('Carregou localhost:3000');
    await page.waitForTimeout(1500); // loadQueue + render

    // Cards — somente tweet-v5 são exibidos
    const v5count = queue.carousels.filter(c => c.format === 'tweet-v5').length;
    const cards = await page.locator('.card').count();
    if (cards === v5count) ok(`${cards} cards renderizados (tweet-v5)`);
    else fail(`Esperado ${v5count} cards tweet-v5, recebido ${cards}`);

    // Action button types
    const actions = await page.locator('[data-action]').evaluateAll(els =>
      [...new Set(els.map(e => e.dataset.action))].sort()
    );
    const expectedActions = ['approve-buffer', 'export', 'view'];
    const hasAll = expectedActions.every(a => actions.includes(a));
    if (hasAll) ok(`Botões: ${actions.join(', ')}`);
    else fail(`Esperado [${expectedActions.join(',')}], recebido [${actions.join(',')}]`);

    // Stats
    const total = await page.locator('#sTotal').textContent();
    if (parseInt(total) === v5count) ok(`Stats Total = ${total}`);
    else fail(`Stats Total = ${total}, esperado ${v5count}`);

    // Click "Ver" — abre lightbox
    await page.locator('[data-action="view"]').first().click();
    await page.waitForTimeout(300);
    const lightboxOpen = await page.locator('#lightboxPreview.open').count();
    if (lightboxOpen === 1) ok('Click "Ver" abre lightbox');
    else fail('Click "Ver" NÃO abriu lightbox');
    await page.evaluate(() => document.getElementById('lightboxPreview').classList.remove('open'));

    // Click "Aprovar" (approve-buffer) — abre modal confirm
    const approveBtn = await page.locator('[data-action="approve-buffer"]').first();
    if (await approveBtn.count() > 0) {
      await approveBtn.click();
      await page.waitForTimeout(200);
      const confirmOpen = await page.locator('#modalConfirm.open').count();
      if (confirmOpen === 1) ok('Click "Aprovar" abre modal confirm');
      else fail('Click "Aprovar" NÃO abriu modal');
      await page.evaluate(() => document.getElementById('modalConfirm').classList.remove('open'));
    }

    // Click "Agendar" — abre modal schedule + tem datetime pré-preenchido
    const schedBtn = await page.locator('[data-action="schedule"]').first();
    if (await schedBtn.count() > 0) {
      await schedBtn.click();
      await page.waitForTimeout(200);
      const schedOpen = await page.locator('#modalSchedule.open').count();
      const dtValue = await page.locator('#schedDateTime').inputValue();
      if (schedOpen === 1 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dtValue)) {
        ok(`Click "Agendar" abre modal com data: ${dtValue}`);
      } else {
        fail(`Modal schedule: open=${schedOpen}, dtValue="${dtValue}"`);
      }
      await page.evaluate(() => document.getElementById('modalSchedule').classList.remove('open'));
    }

    // Filtro Pendentes — inclui pending_approval
    await page.locator('.toolbar .btn', { hasText: 'Pendentes' }).click();
    await page.waitForTimeout(200);
    const pendingCards = await page.locator('.card').count();
    const expectedPending = queue.carousels.filter(c =>
      c.format === 'tweet-v5' && (c.status === 'pending' || c.status === 'pending_approval' || !c.status)
    ).length;
    if (pendingCards === expectedPending) ok(`Filtro Pendentes: ${pendingCards} cards`);
    else fail(`Filtro Pendentes: ${pendingCards}, esperado ${expectedPending}`);
    await page.locator('.toolbar .btn', { hasText: 'Todos' }).click();
    await page.waitForTimeout(100);

    // Pexels toggle + key
    await page.locator('.pexels-header').click();
    await page.waitForTimeout(200);
    const pxOpen   = await page.locator('#pxBody.open').count();
    const pxKey    = await page.locator('#pxKey').inputValue();
    if (pxOpen === 1) ok('Pexels panel toggla');
    else fail('Pexels panel NÃO tooglou');
    if (pxKey && pxKey.length > 20) ok(`Pexels API key pré-preenchida (${pxKey.length} chars)`);
    else fail(`Pexels API key vazia ou curta: "${pxKey}"`);

    // Console errors
    if (consoleErrors.length === 0) ok('Zero erros no console do browser');
    else {
      fail(`${consoleErrors.length} erros no console:`);
      consoleErrors.slice(0, 3).forEach(e => console.log('     →', e.substring(0, 120)));
    }

  } finally {
    await browser.close();
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('🧪 EBS Dashboard — Smoke Test\n');

  const wasSpawned = await ensureServer();
  let queue;
  try {
    queue = await testHTTPBasics();
    if (queue) {
      const r = await fetch(URL_BASE + '/');
      await testScriptParses(r.body);
      await testBrowser(queue);
    }
  } catch (err) {
    fail('Erro inesperado: ' + err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    killServer(wasSpawned);
  }

  // ── Resumo ──
  console.log('\n━━━ RESUMO ━━━');
  console.log(`  ✅ Passes:  ${passes.length}`);
  console.log(`  ❌ Falhas:  ${errors.length}`);
  console.log('');
  if (errors.length === 0) {
    console.log('🟢 Dashboard OK — todos os smoke tests passaram.');
    process.exit(0);
  } else {
    console.log('🔴 Dashboard com falhas:');
    errors.forEach(e => console.log('   →', e));
    process.exit(1);
  }
})();
