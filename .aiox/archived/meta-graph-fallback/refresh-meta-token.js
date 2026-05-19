#!/usr/bin/env node
/**
 * EBS Aprendiz — Meta/Instagram Long-Lived Token Refresher
 *
 * Renova o token IGAA (Instagram Business Login) — válido por 60 dias.
 * Pode ser chamado manualmente ou pela GitHub Action `refresh-meta-token.yml`.
 *
 * Comportamento:
 *   - Lê `META_ACCESS_TOKEN` do ENV ou do `.env`
 *   - Chama o endpoint de refresh: GET graph.instagram.com/refresh_access_token
 *   - Valida a resposta e o novo token via /me
 *   - Atualiza `.env` localmente (modo local)
 *   - Imprime JSON estruturado no stdout (para parsing por workflows)
 *   - Atualiza `.meta-token-state.json` com timestamp do refresh
 *
 * Uso:
 *   node scripts/refresh-meta-token.js                # refresca + atualiza .env
 *   node scripts/refresh-meta-token.js --check        # só verifica validade, sem refresh
 *   node scripts/refresh-meta-token.js --json         # apenas JSON no stdout (modo CI)
 *
 * Exit codes:
 *   0 — sucesso (refrescou ou validou)
 *   1 — token inválido / expirado / erro de rede
 *   2 — token muito novo para refrescar (<24h)
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ARGS       = process.argv.slice(2);
const CHECK_ONLY = ARGS.includes('--check');
const JSON_MODE  = ARGS.includes('--json');

const BASE_DIR   = path.resolve(__dirname, '..');
const ENV_PATH   = path.join(BASE_DIR, '.env');
const STATE_PATH = path.join(BASE_DIR, '.meta-token-state.json');

// ── Logger (mute se --json) ───────────────────────────────────────────────────

const log = JSON_MODE ? () => {} : (...args) => console.error(...args);

// ── Load env ──────────────────────────────────────────────────────────────────

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const env = {};
  fs.readFileSync(ENV_PATH, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#\s=][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  });
  return env;
}

const envFile = loadEnv();
const TOKEN   = process.env.META_ACCESS_TOKEN || envFile.META_ACCESS_TOKEN || '';

if (!TOKEN) {
  console.error('❌ META_ACCESS_TOKEN não encontrada (nem em ENV nem em .env)');
  process.exit(1);
}

if (!TOKEN.startsWith('IGAA')) {
  console.error('❌ Token não é Instagram Business Login (IGAA...). Refresh só funciona para tokens IGAA.');
  console.error('   Para tokens EAA (System User), use o fluxo de Business Manager — esse não precisa refresh.');
  process.exit(1);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    }).on('error', reject);
  });
}

// ── Token state (last refresh tracking) ───────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

// ── Update .env ───────────────────────────────────────────────────────────────

function updateEnv(newToken) {
  if (!fs.existsSync(ENV_PATH)) return false;
  let content = fs.readFileSync(ENV_PATH, 'utf-8');
  if (/^META_ACCESS_TOKEN=/m.test(content)) {
    content = content.replace(/^META_ACCESS_TOKEN=.*$/m, `META_ACCESS_TOKEN=${newToken}`);
  } else {
    content += `\nMETA_ACCESS_TOKEN=${newToken}\n`;
  }
  fs.writeFileSync(ENV_PATH, content, 'utf-8');
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  log('🔍 Verificando token atual…');

  // 1. Valida token via /me
  const meRes = await get(`https://graph.instagram.com/me?fields=id,username,account_type&access_token=${TOKEN}`);
  if (meRes.status !== 200) {
    const errMsg = meRes.body && meRes.body.error ? meRes.body.error.message : JSON.stringify(meRes.body).substring(0, 200);
    if (JSON_MODE) console.log(JSON.stringify({ ok: false, reason: 'token_invalid', error: errMsg }));
    else console.error(`❌ Token inválido ou expirado: ${errMsg}`);
    process.exit(1);
  }

  const { username, account_type, id } = meRes.body;
  log(`   ✅ Conectado: @${username} (${account_type})`);

  // 2. State tracking
  const state = loadState();
  const lastRefresh = state.last_refresh ? new Date(state.last_refresh) : null;
  const hoursSinceRefresh = lastRefresh ? (Date.now() - lastRefresh.getTime()) / 3600000 : Infinity;
  const daysSinceRefresh  = hoursSinceRefresh / 24;
  const daysRemaining     = lastRefresh ? Math.max(0, 60 - daysSinceRefresh) : null;

  log(`   📅 Último refresh: ${lastRefresh ? lastRefresh.toISOString() : 'desconhecido'}`);
  if (daysRemaining !== null) {
    log(`   ⏳ Dias restantes (estimativa): ${daysRemaining.toFixed(1)}`);
  }

  // 3. Modo --check: só valida, não refresca
  if (CHECK_ONLY) {
    const result = {
      ok: true,
      username,
      account_type,
      ig_user_id: id,
      last_refresh: lastRefresh ? lastRefresh.toISOString() : null,
      days_remaining_estimate: daysRemaining,
      action: 'check_only',
    };
    if (JSON_MODE) console.log(JSON.stringify(result));
    else log('✅ Token válido (modo --check, não refrescado)');
    process.exit(0);
  }

  // 4. Regra do Meta: token precisa ter ≥24h para refrescar
  if (hoursSinceRefresh < 24 && lastRefresh) {
    const result = {
      ok: false,
      reason: 'too_recent',
      hours_since_refresh: hoursSinceRefresh.toFixed(1),
      message: 'Token foi refrescado há menos de 24h — Meta exige ≥24h entre refreshes',
    };
    if (JSON_MODE) console.log(JSON.stringify(result));
    else console.error(`⚠️  Refresh muito recente (${hoursSinceRefresh.toFixed(1)}h atrás). Meta exige ≥24h.`);
    process.exit(2);
  }

  // 5. Refresh
  log('🔄 Chamando endpoint de refresh…');
  const refreshRes = await get(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${TOKEN}`
  );

  if (refreshRes.status !== 200 || !refreshRes.body.access_token) {
    const errMsg = refreshRes.body && refreshRes.body.error
      ? refreshRes.body.error.message
      : JSON.stringify(refreshRes.body).substring(0, 200);
    if (JSON_MODE) console.log(JSON.stringify({ ok: false, reason: 'refresh_failed', error: errMsg }));
    else console.error(`❌ Refresh falhou: ${errMsg}`);
    process.exit(1);
  }

  const newToken  = refreshRes.body.access_token;
  const expiresIn = refreshRes.body.expires_in;
  const newExpiry = new Date(Date.now() + expiresIn * 1000);

  log(`   ✅ Novo token recebido (${newToken.substring(0, 10)}…)`);
  log(`   📅 Expira em: ${newExpiry.toISOString()} (${Math.round(expiresIn / 86400)} dias)`);

  // 6. Atualizar .env
  const envUpdated = updateEnv(newToken);
  if (envUpdated) log('   💾 .env atualizado');
  else log('   ⚠️  .env não existe — pulando atualização local');

  // 7. Salvar state
  saveState({
    last_refresh: new Date().toISOString(),
    expires_at: newExpiry.toISOString(),
    expires_in_seconds: expiresIn,
    username,
    account_type,
    ig_user_id: id,
  });
  log('   💾 .meta-token-state.json atualizado');

  // 8. Output JSON
  const result = {
    ok: true,
    action: 'refreshed',
    username,
    account_type,
    ig_user_id: id,
    new_token: newToken,
    expires_at: newExpiry.toISOString(),
    expires_in_seconds: expiresIn,
    expires_in_days: Math.round(expiresIn / 86400),
  };
  if (JSON_MODE) console.log(JSON.stringify(result));
  else log('✅ Refresh completo.');
  process.exit(0);
})().catch(err => {
  if (JSON_MODE) console.log(JSON.stringify({ ok: false, reason: 'exception', error: err.message }));
  else console.error('❌ Erro inesperado:', err.message);
  process.exit(1);
});
