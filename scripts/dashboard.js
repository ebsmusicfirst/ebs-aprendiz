const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const meta   = require('./meta-api');
const buffer = require('./buffer-api');

const PORT = 3000;
const BASE_DIR = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(BASE_DIR, 'queue.json');

// Logo base64 — loaded once at startup
let LOGO_B64 = '';
try {
  const lp = path.join(BASE_DIR, 'ASSETS', 'logo-ebs-aprendiz.png');
  if (fs.existsSync(lp)) {
    LOGO_B64 = 'data:image/png;base64,' + fs.readFileSync(lp).toString('base64');
  }
} catch (e) { /* no logo found */ }

function loadEnv() {
  const envPath = path.join(BASE_DIR, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([^#\s=][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const ENV = loadEnv();
const IG_USER_ID = ENV.META_IG_USER_ID || '';
const ACCESS_TOKEN = ENV.META_ACCESS_TOKEN || '';
const GEMINI_KEY = ENV.GEMINI_API_KEY || '';
const PEXELS_KEY = ENV.PEXELS_API_KEY || '';
const BUFFER_TOKEN     = ENV.BUFFER_ACCESS_TOKEN || '';
const BUFFER_CHANNEL_ID = ENV.BUFFER_CHANNEL_ID || '6a0b6029090476fb99338257';  // @aprendiz.ebs (default)
const BUFFER_ORG_ID     = ENV.BUFFER_ORG_ID     || '6a0b5f0a0a1190a848db82b1';  // My Organization

function getGitInfo() {
  try {
    const remoteRaw = cp.execSync('git remote get-url origin', { cwd: BASE_DIR, encoding: 'utf-8' }).trim();
    const match = remoteRaw.match(/github\.com[:/](.+?)(\.git)?$/);
    const repo = match ? match[1] : '';
    const ref = cp.execSync('git rev-parse --abbrev-ref HEAD', { cwd: BASE_DIR, encoding: 'utf-8' }).trim();
    return { repo, ref };
  } catch {
    return { repo: 'ebsmusicfirst/ebs-aprendiz', ref: 'main' };
  }
}

const GIT = getGitInfo();

function readQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8')); }
  catch (e) { return { carousels: [] }; }
}

function writeQueue(data) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(data, null, 2) + '\n');
}

function jsonRes(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ─── Auto-commit + push ───────────────────────────────────────────────────────
// Persiste mudanças no repo para o GitHub Actions enxergar.
// Falha silenciosa — não bloqueia a operação principal.

function gitAutoSync(message, paths) {
  try {
    const args = ['add', '--', ...paths];
    cp.execFileSync('git', args, { cwd: BASE_DIR, stdio: 'pipe' });

    // diff --cached --quiet retorna 0 se NÃO há mudanças → nothing to commit
    try {
      cp.execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: BASE_DIR, stdio: 'pipe' });
      return { committed: false, pushed: false, reason: 'no-changes' };
    } catch (_) {
      // exit 1 = há mudanças staged, segue
    }

    cp.execFileSync('git', ['commit', '-m', message], { cwd: BASE_DIR, stdio: 'pipe' });

    try {
      cp.execFileSync('git', ['push'], { cwd: BASE_DIR, stdio: 'pipe', timeout: 15000 });
      return { committed: true, pushed: true };
    } catch (pushErr) {
      const stderr = (pushErr.stderr || '').toString();
      return { committed: true, pushed: false, error: stderr.trim().split('\n').slice(-3).join(' | ') };
    }
  } catch (err) {
    const stderr = (err.stderr || '').toString();
    return { committed: false, pushed: false, error: stderr.trim() || err.message };
  }
}

// ─── Dashboard HTML ──────────────────────────────────────────────────────────
// Built once at startup so LOGO_B64 and PEXELS_KEY are embedded.

const LOGO_STYLE = LOGO_B64
  ? `background-image:url('${LOGO_B64}');background-size:auto 112%;background-position:center 5%;background-repeat:no-repeat;background-color:#000;`
  : 'background:#D4A017;';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>EBS Aprendiz — Dashboard</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0A0A0A; color:#F0EDE8; font-family:-apple-system,BlinkMacSystemFont,sans-serif; min-height:100vh; }

    /* ── Header ─────────────────────────────────── */
    header { border-bottom:1px solid rgba(255,255,255,0.1); padding:16px 28px; display:flex; align-items:center; gap:12px; }
    .logo-avatar { width:36px; height:36px; border-radius:50%; flex-shrink:0; ${LOGO_STYLE} }
    .logo { font-weight:700; font-size:14px; }
    .logo-sub { font-size:11px; font-weight:400; color:rgba(240,237,232,0.45); margin-left:4px; }

    /* ── Token Badge ─────────────────────────────── */
    .token-badge { display:flex; align-items:center; gap:6px; padding:6px 11px; border-radius:20px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); font-size:10px; font-weight:600; color:rgba(240,237,232,0.65); cursor:pointer; user-select:none; transition:background 0.15s; }
    .token-badge:hover { background:rgba(255,255,255,0.08); }
    .token-dot { width:7px; height:7px; border-radius:50%; background:rgba(240,237,232,0.3); flex-shrink:0; }
    .token-dot.ok { background:#22c55e; box-shadow:0 0 6px rgba(34,197,94,0.5); }
    .token-dot.warn { background:#facc15; box-shadow:0 0 6px rgba(250,204,21,0.5); }
    .token-dot.err { background:#ef4444; box-shadow:0 0 6px rgba(239,68,68,0.5); }

    /* ── Stats Bar ───────────────────────────────── */
    .stats-bar { display:flex; gap:1px; background:rgba(255,255,255,0.07); border-bottom:1px solid rgba(255,255,255,0.07); }
    .stat-item { flex:1; padding:14px 20px; background:#141414; display:flex; flex-direction:column; gap:5px; }
    .stat-label { font-size:9px; font-weight:700; color:rgba(240,237,232,0.5); letter-spacing:0.05em; }
    .stat-value { font-size:20px; font-weight:700; }

    /* ── Toolbar ─────────────────────────────────── */
    .toolbar { padding:16px 28px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .btn { padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:rgba(240,237,232,0.7); cursor:pointer; font-size:11px; font-weight:600; }
    .btn:hover { background:rgba(255,255,255,0.05); }
    .btn.active { background:#D4A017; color:#0A0A0A; border-color:#D4A017; }

    /* ── Pexels Panel ────────────────────────────── */
    .pexels-panel { margin:0 28px 20px; border:1px solid rgba(255,255,255,0.07); border-radius:10px; overflow:hidden; }
    .pexels-header { padding:11px 16px; background:#141414; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:rgba(240,237,232,0.65); user-select:none; }
    .pexels-header:hover { background:#191919; }
    .pexels-logo { color:#05A081; font-weight:800; font-size:14px; line-height:1; }
    .toggle-icon { margin-left:auto; opacity:0.45; font-size:10px; transition:transform 0.2s; }
    .pexels-body { display:none; padding:14px 16px; background:#0F0F0F; border-top:1px solid rgba(255,255,255,0.05); }
    .pexels-body.open { display:block; }
    .pexels-controls { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
    .pexels-input { flex:1; min-width:180px; background:#141414; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px 12px; color:#F0EDE8; font-size:12px; font-family:inherit; }
    .pexels-input:focus { outline:none; border-color:#05A081; }
    .pexels-key { width:220px; flex:none; font-family:monospace; font-size:10px; color:rgba(240,237,232,0.6); }
    .pexels-btn { padding:8px 16px; border-radius:6px; background:#05A081; color:#fff; border:none; cursor:pointer; font-size:11px; font-weight:700; white-space:nowrap; }
    .pexels-btn:hover { background:#048a6e; }
    .pexels-results { display:flex; gap:8px; flex-wrap:wrap; min-height:30px; }
    .pexels-thumb { width:100px; height:80px; object-fit:cover; border-radius:5px; cursor:pointer; opacity:0.85; transition:all 0.15s; border:2px solid transparent; }
    .pexels-thumb:hover { opacity:1; border-color:#05A081; transform:scale(1.03); }
    .pexels-hint { font-size:11px; color:rgba(240,237,232,0.35); padding:8px 0; }

    /* ── Imagen 4 Panel ──────────────────────────── */
    .imagen-panel { margin:0 28px 20px; border:1px solid rgba(212,160,23,0.2); border-radius:10px; overflow:hidden; }
    .imagen-header { padding:11px 16px; background:#141414; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:rgba(240,237,232,0.65); user-select:none; }
    .imagen-header:hover { background:#191919; }
    .imagen-logo { color:#D4A017; font-weight:800; font-size:15px; line-height:1; }
    .imagen-badge { font-size:9px; padding:2px 7px; border-radius:20px; background:rgba(212,160,23,0.12); color:#D4A017; flex-shrink:0; }
    .imagen-body { display:none; padding:14px 16px; background:#0F0F0F; border-top:1px solid rgba(255,255,255,0.05); }
    .imagen-body.open { display:block; }
    .imagen-presets { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
    .imagen-preset { padding:4px 10px; border-radius:20px; border:1px solid rgba(212,160,23,0.2); background:transparent; color:#D4A017; font-size:10px; cursor:pointer; font-family:inherit; transition:background 0.1s; }
    .imagen-preset:hover { background:rgba(212,160,23,0.1); }
    .imagen-prompt { width:100%; box-sizing:border-box; background:#141414; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px 12px; color:#F0EDE8; font-size:12px; font-family:inherit; resize:none; height:56px; line-height:1.4; margin-bottom:8px; }
    .imagen-prompt:focus { outline:none; border-color:#D4A017; }
    .imagen-controls { display:flex; gap:8px; margin-bottom:12px; align-items:center; }
    .imagen-model-select { flex:1; background:#141414; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:7px 10px; color:#F0EDE8; font-size:11px; font-family:inherit; }
    .imagen-gen-btn { padding:8px 18px; border-radius:6px; background:#D4A017; color:#0A0A0A; border:none; cursor:pointer; font-size:11px; font-weight:800; white-space:nowrap; flex-shrink:0; transition:background 0.15s; }
    .imagen-gen-btn:hover { background:#F0C040; }
    .imagen-gen-btn:disabled { opacity:0.45; cursor:not-allowed; }
    .imagen-results { display:flex; gap:10px; flex-wrap:wrap; min-height:30px; }
    .imagen-card { position:relative; border-radius:6px; overflow:hidden; flex-shrink:0; }
    .imagen-thumb { width:90px; height:113px; object-fit:cover; display:block; }
    .imagen-apply-btn { position:absolute; bottom:0; left:0; right:0; padding:4px 0; background:rgba(10,10,10,0.85); color:#D4A017; border:none; font-size:9px; font-weight:700; cursor:pointer; opacity:0; transition:opacity 0.15s; font-family:inherit; }
    .imagen-card:hover .imagen-apply-btn { opacity:1; }
    .imagen-hint { font-size:11px; color:rgba(240,237,232,0.35); padding:8px 0; }

    /* ── Card Grid ───────────────────────────────── */
    .grid { display:flex; flex-wrap:wrap; gap:14px; padding:0 28px 48px; }
    .empty { width:100%; text-align:center; padding:60px 28px; color:rgba(240,237,232,0.35); font-size:13px; }

    /* ── Card ────────────────────────────────────── */
    .card { background:#141414; border:1px solid rgba(255,255,255,0.07); border-radius:11px; overflow:hidden; width:280px; flex-shrink:0; display:flex; flex-direction:column; transition:border-color 0.2s; }
    .card:hover { border-color:rgba(255,255,255,0.14); }

    /* Iframe thumbnail */
    .card-preview { width:280px; height:350px; overflow:hidden; position:relative; background:#1a1a1a; flex-shrink:0; }
    .card-preview iframe { width:420px; height:525px; border:none; transform:scale(0.6667); transform-origin:top left; pointer-events:auto; display:block; }

    /* Card body */
    .card-body { padding:12px 14px 14px; display:flex; flex-direction:column; gap:8px; }
    .card-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .card-id { font-size:9px; color:rgba(240,237,232,0.35); font-weight:600; text-transform:uppercase; letter-spacing:0.03em; }
    .card-type { font-size:8px; padding:2px 7px; border-radius:10px; font-weight:700; }
    .type-tweet { background:rgba(29,155,240,0.15); color:#1D9BF0; }
    .type-editorial { background:rgba(212,160,23,0.12); color:#D4A017; }
    .card-title { font-size:12px; font-weight:600; line-height:1.45; color:#F0EDE8; }
    .card-status { font-size:9px; padding:3px 9px; border-radius:20px; width:fit-content; font-weight:700; }
    .status-pending { background:rgba(212,160,23,0.15); color:#D4A017; }
    .status-published { background:rgba(96,165,250,0.15); color:#60a5fa; }
    .status-approved { background:rgba(34,197,94,0.15); color:#22c55e; }
    .status-scheduled { background:rgba(167,139,250,0.15); color:#a78bfa; }
    .card-actions { display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px; }
    .action-btn { padding:6px 8px; border-radius:5px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.04); color:rgba(240,237,232,0.65); cursor:pointer; font-size:9px; font-weight:600; transition:all 0.15s; text-align:center; }
    .action-btn:hover { background:rgba(255,255,255,0.09); color:#F0EDE8; transform:translateY(-1px); }
    .action-btn.approve { background:rgba(34,197,94,0.1); color:#22c55e; border-color:rgba(34,197,94,0.18); }
    .action-btn.approve:hover { background:rgba(34,197,94,0.2); }
    .action-btn.sched { background:rgba(167,139,250,0.1); color:#a78bfa; border-color:rgba(167,139,250,0.18); }
    .action-btn.sched:hover { background:rgba(167,139,250,0.2); }
    .action-btn.publish { background:rgba(96,165,250,0.1); color:#60a5fa; border-color:rgba(96,165,250,0.18); }
    .action-btn.publish:hover { background:rgba(96,165,250,0.2); }
    .action-btn.export { background:rgba(245,158,11,0.1); color:#F59E0B; border-color:rgba(245,158,11,0.2); }
    .action-btn.export:hover { background:rgba(245,158,11,0.2); }
    .action-btn.export.has-slides { background:rgba(34,197,94,0.08); color:#22c55e; border-color:rgba(34,197,94,0.2); }
    .slides-info { font-size:8px; color:rgba(240,237,232,0.4); margin-top:2px; }
    .slides-info.missing { color:#F59E0B; }
    .card-date { font-size:9px; color:rgba(240,237,232,0.3); margin-top:2px; }

    /* ── Modal ───────────────────────────────────── */
    .modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:1000; align-items:center; justify-content:center; }
    .modal.open { display:flex; }
    .modal-content { background:#141414; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:24px; max-width:400px; width:90%; }
    .modal-title { font-size:16px; font-weight:700; margin-bottom:12px; }
    .modal-desc { font-size:13px; color:rgba(240,237,232,0.7); line-height:1.6; margin-bottom:18px; white-space:pre-line; }
    .form-group { display:flex; flex-direction:column; gap:6px; margin-bottom:16px; }
    .form-label { font-size:11px; font-weight:600; color:rgba(240,237,232,0.55); }
    .form-input { background:#0A0A0A; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px 12px; color:#F0EDE8; font-size:13px; font-family:inherit; }
    .form-input:focus { outline:none; border-color:#D4A017; }
    .modal-actions { display:flex; gap:8px; }
    .btn-confirm { flex:1; padding:10px; border-radius:6px; background:#D4A017; color:#0A0A0A; border:none; cursor:pointer; font-size:12px; font-weight:700; }
    .btn-confirm:hover { background:#E8B82D; }
    .btn-cancel { flex:1; padding:10px; border-radius:6px; background:rgba(255,255,255,0.1); color:#F0EDE8; border:none; cursor:pointer; font-size:12px; font-weight:600; }
    .btn-cancel:hover { background:rgba(255,255,255,0.16); }

    /* ── Toast ───────────────────────────────────── */
    .toast { position:fixed; bottom:24px; right:24px; background:#1E1E1E; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:12px 16px; font-size:12px; color:#F0EDE8; z-index:2000; opacity:0; transform:translateY(20px); transition:all 0.3s; max-width:340px; pointer-events:none; }
    .toast.show { opacity:1; transform:translateY(0); }
    .toast.success { border-color:rgba(34,197,94,0.35); color:#22c55e; }
    .toast.error { border-color:rgba(239,68,68,0.35); color:#ef4444; }

    /* ── Lightbox ────────────────────────────────── */
    .lightbox { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.96); z-index:1500; align-items:center; justify-content:center; }
    .lightbox.open { display:flex; }
    .lightbox-wrap { position:relative; width:460px; max-width:95vw; }
    .lightbox-wrap iframe { width:100%; height:80vh; border:none; border-radius:12px; display:block; }
    .lightbox-close { position:absolute; top:-42px; right:0; width:32px; height:32px; background:rgba(255,255,255,0.1); border:none; border-radius:50%; color:#F0EDE8; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; }
    .lightbox-close:hover { background:rgba(255,255,255,0.2); }

    /* ── AI Edit Row ─────────────────────────────── */
    .ai-edit-row { display:flex; gap:6px; padding:8px 14px 13px; border-top:1px solid rgba(255,255,255,0.05); margin-top:2px; align-items:flex-end; }
    .ai-textarea { flex:1; background:#0A0A0A; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; color:#F0EDE8; font-size:11px; font-family:inherit; resize:none; height:46px; line-height:1.4; overflow-y:auto; }
    .ai-textarea:focus { outline:none; border-color:rgba(212,160,23,0.45); }
    .ai-textarea::placeholder { color:rgba(240,237,232,0.22); font-style:italic; }
    .ai-btn { padding:0 11px; height:46px; border-radius:6px; background:rgba(212,160,23,0.11); color:#D4A017; border:1px solid rgba(212,160,23,0.22); cursor:pointer; font-size:10px; font-weight:700; white-space:nowrap; flex-shrink:0; transition:all 0.15s; }
    .ai-btn:hover:not(:disabled) { background:rgba(212,160,23,0.22); border-color:rgba(212,160,23,0.4); }
    .ai-btn:disabled { opacity:0.35; cursor:not-allowed; }
  </style>
</head>
<body>

<header>
  <div class="logo-avatar"></div>
  <div>
    <span class="logo">EBS Aprendiz</span>
    <span class="logo-sub">— Dashboard de Conteúdo</span>
  </div>
  <div style="flex:1"></div>
  <div class="token-badge" id="tokenBadge" title="Status do token Meta/Instagram" data-action="check-token">
    <span class="token-dot" id="tokenDot"></span>
    <span id="tokenLabel">Token: …</span>
  </div>
</header>

<div class="stats-bar">
  <div class="stat-item"><span class="stat-label">TOTAL</span><span class="stat-value" id="sTotal">—</span></div>
  <div class="stat-item"><span class="stat-label">PENDENTES</span><span class="stat-value" id="sPending">—</span></div>
  <div class="stat-item"><span class="stat-label">APROVADOS</span><span class="stat-value" id="sApproved">—</span></div>
  <div class="stat-item"><span class="stat-label">AGENDADOS</span><span class="stat-value" id="sScheduled">—</span></div>
  <div class="stat-item"><span class="stat-label">PUBLICADOS</span><span class="stat-value" id="sPublished">—</span></div>
</div>

<div class="toolbar">
  <button class="btn active" onclick="setFilter('all',this)">Todos</button>
  <button class="btn" onclick="setFilter('pending',this)">Pendentes</button>
  <button class="btn" onclick="setFilter('approved',this)">Aprovados</button>
  <button class="btn" onclick="setFilter('scheduled',this)">Agendados</button>
  <button class="btn" onclick="setFilter('published',this)">Publicados</button>
  <div style="flex:1"></div>
  <button class="btn" onclick="loadQueue()">↻ Atualizar</button>
</div>

<!-- Pexels Image Search Panel -->
<div class="pexels-panel">
  <div class="pexels-header" onclick="togglePexels()">
    <span class="pexels-logo">P</span>
    <span>Buscar Imagens — Pexels</span>
    <span class="toggle-icon" id="pxToggle">▼</span>
  </div>
  <div class="pexels-body" id="pxBody">
    <div class="pexels-controls">
      <input class="pexels-input" id="pxQuery" type="text" placeholder="ex: pessoa tocando guitarra, música, estúdio..." onkeydown="if(event.key==='Enter') searchPexels()">
      <input class="pexels-input pexels-key" id="pxKey" type="text" value="${PEXELS_KEY}" placeholder="API Key Pexels">
      <button class="pexels-btn" onclick="searchPexels()">🔍 Buscar</button>
    </div>
    <div class="pexels-results" id="pxResults">
      <div class="pexels-hint">Digite uma busca e pressione Enter — clique na imagem para copiar a URL.</div>
    </div>
  </div>
</div>

<!-- Imagen 4 AI Image Generation Panel -->
<div class="imagen-panel">
  <div class="imagen-header" onclick="toggleImagen()">
    <span class="imagen-logo">✦</span>
    <span>Gerar Imagens — IA</span>
    <span class="imagen-badge">IA</span>
    <div style="flex:1"></div>
    <span class="toggle-icon" id="imgToggle">▼</span>
  </div>
  <div class="imagen-body" id="imgBody">
    <div class="imagen-presets">
      <button class="imagen-preset" data-preset="teen-guitar">🎸 Jovem c/ guitarra</button>
      <button class="imagen-preset" data-preset="adult-keyboard">🎹 Adulto no teclado</button>
      <button class="imagen-preset" data-preset="recording-studio">🎤 Estúdio de gravação</button>
      <button class="imagen-preset" data-preset="child-guitar">🎼 Aula de violão</button>
      <button class="imagen-preset" data-preset="band-rehearsal">🎵 Banda ensaiando</button>
    </div>
    <textarea class="imagen-prompt" id="imgPrompt" placeholder="Descreva a imagem: ex. 'jovem aprendendo guitarra em aula de música, iluminação quente, expressão focada, retrato fotorrealista'"></textarea>
    <div class="imagen-controls">
      <select class="imagen-model-select" id="imgModel">
        <optgroup label="Gemini Nano Banana (recomendado)">
          <option value="gemini-2.5-flash-image" selected>🍌 Nano Banana ~US$0,04 (default)</option>
          <option value="nano-banana-pro-preview">💎 Nano Banana Pro ~US$0,13</option>
          <option value="gemini-3.1-flash-image-preview">✨ Nano Banana 2 preview ~US$0,07</option>
        </optgroup>
        <optgroup label="Imagen 4 (legado — bloqueia teen/child)">
          <option value="imagen-4.0-fast-generate-001">⚠️ Imagen 4 Fast ~US$0,03</option>
          <option value="imagen-4.0-generate-001">⚠️ Imagen 4 Standard ~US$0,04</option>
          <option value="imagen-4.0-ultra-generate-001">⚠️ Imagen 4 Ultra ~US$0,06</option>
        </optgroup>
      </select>
      <button class="imagen-gen-btn" id="imgGenBtn" data-action="generate-imagen">✦ Gerar</button>
    </div>
    <div class="imagen-results" id="imgResults">
      <div class="imagen-hint">Escolha um tema acima ou descreva a imagem desejada — depois clique em ✦ Gerar.</div>
    </div>
  </div>
</div>

<!-- Card Grid -->
<div class="grid" id="grid"></div>

<!-- Confirm Modal -->
<div class="modal" id="modalConfirm">
  <div class="modal-content">
    <div class="modal-title" id="confirmTitle"></div>
    <div class="modal-desc" id="confirmDesc"></div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal('modalConfirm')">Cancelar</button>
      <button class="btn-confirm" onclick="executeConfirm()">Confirmar</button>
    </div>
  </div>
</div>

<!-- Schedule Modal -->
<div class="modal" id="modalSchedule">
  <div class="modal-content">
    <div class="modal-title">📅 Agendar Publicação</div>
    <div class="modal-desc" id="schedDesc"></div>
    <div class="form-group">
      <label class="form-label">Data e hora de publicação</label>
      <input type="datetime-local" class="form-input" id="schedDateTime">
      <small style="color:rgba(240,237,232,0.35);font-size:10px;margin-top:4px;">Sugestão: 19:00 BRT — Corbélia-PR</small>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal('modalSchedule')">Cancelar</button>
      <button class="btn-confirm" onclick="confirmSchedule()">Agendar</button>
    </div>
  </div>
</div>

<!-- Lightbox Preview -->
<div class="lightbox" id="lightboxPreview">
  <div class="lightbox-wrap">
    <button class="lightbox-close" onclick="closeLightbox()">✕</button>
    <iframe id="previewFrame" src=""></iframe>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
var carousels = [];
var filter = 'all';
var currentId = null;
var confirmAction = null;
var pexelsOpen = false;

// ── Token status (Meta/Instagram) ────────────────────────────────────────────

function checkToken() {
  fetch('/api/meta/token-info')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var dot = document.getElementById('tokenDot');
      var lbl = document.getElementById('tokenLabel');
      if (!d.ok) {
        dot.className = 'token-dot err';
        lbl.textContent = 'Token: inválido';
        return;
      }
      var days = d.days_remaining_estimate;
      var cls = days > 30 ? 'ok' : days > 7 ? 'warn' : 'err';
      dot.className = 'token-dot ' + cls;
      var daysTxt = days === null ? '—' : Math.round(days) + 'd';
      lbl.textContent = '@' + d.username + ' · ' + daysTxt;
    })
    .catch(function() {
      document.getElementById('tokenDot').className = 'token-dot err';
      document.getElementById('tokenLabel').textContent = 'Token: erro';
    });
}

document.addEventListener('click', function(e) {
  if (e.target && (e.target.closest('[data-action="check-token"]'))) {
    showToast('🔄 Verificando token…');
    fetch('/api/meta/token-info?refresh=true')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok && d.action === 'refreshed') {
          showToast('✅ Token refrescado! +' + d.expires_in_days + ' dias', 'success');
        } else if (d.ok) {
          showToast('✅ Token válido (' + Math.round(d.days_remaining_estimate || 0) + 'd restantes)', 'success');
        } else {
          showToast('❌ ' + (d.reason || 'erro'), 'error');
        }
        checkToken();
      })
      .catch(function(e) { showToast('Erro: ' + e.message, 'error'); });
  }
});

// ── Data ─────────────────────────────────────────────────────────────────────

function loadQueue() {
  fetch('/api/queue').then(function(r) { return r.json(); }).then(function(d) {
    carousels = d.carousels || [];
    updateStats();
    renderGrid();
  }).catch(function(e) { showToast('Erro ao carregar: ' + e.message, 'error'); });
}

function updateStats() {
  var total = carousels.length;
  var pending  = carousels.filter(function(c) { return !c.status || c.status === 'pending'; }).length;
  var approved = carousels.filter(function(c) { return c.status === 'approved'; }).length;
  var scheduled= carousels.filter(function(c) { return c.status === 'scheduled'; }).length;
  var published= carousels.filter(function(c) { return c.status === 'published'; }).length;
  document.getElementById('sTotal').textContent    = total;
  document.getElementById('sPending').textContent  = pending;
  document.getElementById('sApproved').textContent = approved;
  document.getElementById('sScheduled').textContent= scheduled;
  document.getElementById('sPublished').textContent= published;
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderGrid() {
  var list = filter === 'all'
    ? carousels
    : carousels.filter(function(c) { return (c.status || 'pending') === filter; });

  var grid = document.getElementById('grid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty">Nenhum carrossel encontrado neste filtro.</div>';
    return;
  }

  grid.innerHTML = list.map(function(c) {
    var status = c.status || 'pending';
    var type   = c.type   || 'editorial';

    var typeBadge = type === 'tweet'
      ? '<span class="card-type type-tweet">Tweet</span>'
      : '<span class="card-type type-editorial">Editorial</span>';

    var dateStr = c.scheduled_for
      ? '📅 ' + c.scheduled_for.substring(0,16).replace('T', ' ')
      : (c.published_at ? '✅ ' + c.published_at.substring(0,10) : (c.created_at || ''));

    // Slides info — crítico para QA antes de agendar/publicar
    var slideCount = (c.slides && c.slides.length) || 0;
    var slidesInfo = slideCount > 0
      ? '<div class="slides-info">📦 ' + slideCount + ' PNGs exportados</div>'
      : '<div class="slides-info missing">⚠️ Sem PNGs — exporte antes de agendar/publicar</div>';

    // Action buttons — context-aware (event delegation via data-* attrs, no escape hell)
    var exportClass = slideCount > 0 ? 'action-btn export has-slides' : 'action-btn export';
    var exportLabel = slideCount > 0 ? '📦 Re-export' : '📦 Exportar';
    var exportBtn = status !== 'published'
      ? '<button class="' + exportClass + '" data-action="export" data-id="' + c.id + '">' + exportLabel + '</button>'
      : '<div></div>';

    var approveBtn = status === 'pending'
      ? '<button class="action-btn approve" data-action="approve" data-id="' + c.id + '">✓ Aprovar</button>'
      : '<div></div>';

    var schedBtn = ['pending','approved','scheduled'].indexOf(status) !== -1
      ? '<button class="action-btn sched" data-action="schedule" data-id="' + c.id + '">📅 Agendar</button>'
      : '<div></div>';

    var viewBtn = '<button class="action-btn" data-action="view" data-id="' + c.id + '">👁 Ver</button>';

    var publishBtn = ['pending','approved','scheduled'].indexOf(status) !== -1
      ? '<button class="action-btn publish" data-action="publish" data-id="' + c.id + '">🚀 Publicar</button>'
      : '<div></div>';

    return '<div class="card">'
      + '<div class="card-preview">'
      +   '<iframe src="/carousel/' + c.id + '" loading="lazy"></iframe>'
      + '</div>'
      + '<div class="card-body">'
      +   '<div class="card-meta">'
      +     '<span class="card-id">' + c.id + '</span>'
      +     typeBadge
      +   '</div>'
      +   '<div class="card-title">' + escapeHtml(c.title) + '</div>'
      +   '<div class="card-status status-' + status + '">' + status + '</div>'
      +   slidesInfo
      +   '<div class="card-actions">' + exportBtn + viewBtn + approveBtn + schedBtn + publishBtn + '<div></div>' + '</div>'
      +   '<div class="card-date">' + dateStr + '</div>'
      + '</div>'
      + '<div class="ai-edit-row">'
      +   '<textarea class="ai-textarea" data-ai-id="' + c.id + '" placeholder="O que mudar? Ex: muda o título, adiciona slide sobre prática diária..." rows="2"></textarea>'
      +   '<button class="ai-btn" data-action="ai-edit" data-id="' + c.id + '">✦ IA</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

// Escape HTML to prevent injection from titles
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function(ch) {
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch];
  });
}

// ── Event Delegation — Card Actions ──────────────────────────────────────────
// Attached once after DOM is ready (script is at end of body, so DOM is built).
document.addEventListener('click', function(e) {
  var btn = e.target.closest && e.target.closest('[data-action]');
  if (!btn) return;
  var id     = btn.getAttribute('data-id');
  var action = btn.getAttribute('data-action');
  if (!id || !action) return;
  if (action === 'approve')       openApprove(id);
  else if (action === 'schedule') openSchedule(id);
  else if (action === 'view')     openPreview(id);
  else if (action === 'publish')  openPublish(id);
  else if (action === 'export')   exportPNGs(id, btn);
  else if (action === 'ai-edit')  requestAIEdit(id, btn);
});

// ── Export PNGs ───────────────────────────────────────────────────────────────
function exportPNGs(id, btnEl) {
  var c = carousels.find(function(x) { return x.id === id; });
  if (!c) return;
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Exportando…'; }
  showToast('📸 Exportando PNGs de "' + c.title + '"... (pode levar 30s)');
  fetch('/api/carousel/' + encodeURIComponent(id) + '/export', { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.error) throw new Error(d.error);
      var msg = '✅ ' + d.slideCount + ' PNGs exportados';
      if (d.sync) {
        if (d.sync.pushed) msg += ' · git: pushed';
        else if (d.sync.committed) msg += ' · git: commit local (push falhou)';
        else if (d.sync.error) msg += ' · ⚠️ git: ' + d.sync.error.substring(0,40);
      }
      showToast(msg, 'success');
      loadQueue();
    })
    .catch(function(e) {
      showToast('❌ Export falhou: ' + e.message, 'error');
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = '📦 Exportar'; }
    });
}

// ── Filter ────────────────────────────────────────────────────────────────────

function setFilter(f, el) {
  filter = f;
  document.querySelectorAll('.toolbar .btn').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  renderGrid();
}

// ── Preview Lightbox ──────────────────────────────────────────────────────────

function openPreview(id) {
  document.getElementById('previewFrame').src = '/carousel/' + id;
  document.getElementById('lightboxPreview').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightboxPreview').classList.remove('open');
  setTimeout(function() { document.getElementById('previewFrame').src = ''; }, 300);
}

// ── Actions ───────────────────────────────────────────────────────────────────

function openApprove(id) {
  currentId = id;
  var c = carousels.find(function(x) { return x.id === id; });
  document.getElementById('confirmTitle').textContent = '✓ Aprovar Carrossel';
  document.getElementById('confirmDesc').textContent  = 'Aprovar:\\n' + c.title;
  confirmAction = function() { updateStatus('approved'); };
  document.getElementById('modalConfirm').classList.add('open');
}

function openSchedule(id) {
  currentId = id;
  var c = carousels.find(function(x) { return x.id === id; });
  // Aviso visual se ainda não tem slides exportados
  var warn = (!c.slides || !c.slides.length)
    ? '\\n\\n⚠️ Este carrossel ainda não tem PNGs exportados. O auto-publisher do GitHub Actions vai pular se não houver slides quando a hora chegar.'
    : '';
  document.getElementById('schedDesc').textContent = 'Agendar: ' + c.title + warn;
  // Pré-preenche com amanhã 19:00 LOCAL (horário do user)
  var d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  // datetime-local input precisa de YYYY-MM-DDTHH:mm em horário LOCAL (não UTC)
  var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
  var localStr = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
    + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  document.getElementById('schedDateTime').value = localStr;
  document.getElementById('modalSchedule').classList.add('open');
}

function openPublish(id) {
  currentId = id;
  var c = carousels.find(function(x) { return x.id === id; });
  document.getElementById('confirmTitle').textContent = '🚀 Publicar Agora';
  document.getElementById('confirmDesc').textContent  = 'Publicar: ' + c.title + '\\n\\n⚠️ O carrossel será enviado ao Instagram imediatamente.';
  confirmAction = function() { publishToInstagram(); };
  document.getElementById('modalConfirm').classList.add('open');
}

function executeConfirm() {
  if (confirmAction) confirmAction();
  closeModal('modalConfirm');
}

function confirmSchedule() {
  var dt = document.getElementById('schedDateTime').value;
  if (!dt) { showToast('Selecione uma data e hora', 'error'); return; }
  // datetime-local é LOCAL — converter para ISO UTC (com Z) para o backend / GitHub Actions
  var iso = new Date(dt).toISOString();
  updateStatus('scheduled', iso);
  closeModal('modalSchedule');
}

// ── API calls ─────────────────────────────────────────────────────────────────

function updateStatus(status, scheduled_for) {
  var body = { status: status };
  if (scheduled_for) body.scheduled_for = scheduled_for;
  fetch('/api/carousel/' + encodeURIComponent(currentId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.error) throw new Error(d.error);
    var idx = carousels.findIndex(function(c) { return c.id === currentId; });
    if (idx !== -1) carousels[idx] = d.carousel;
    updateStats();
    renderGrid();
    showToast('✅ Atualizado com sucesso!', 'success');
  })
  .catch(function(e) { showToast('❌ Erro: ' + e.message, 'error'); });
}

function publishToInstagram() {
  if (!currentId) return;
  showToast('🚀 Publicando…');
  fetch('/api/carousel/' + encodeURIComponent(currentId) + '/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.error) throw new Error(d.error);
    var idx = carousels.findIndex(function(c) { return c.id === currentId; });
    if (idx !== -1) {
      carousels[idx].status        = 'published';
      carousels[idx].published_at  = new Date().toISOString();
      carousels[idx].meta_post_id  = d.postId;
    }
    updateStats();
    renderGrid();
    showToast('✅ Publicado em @aprendiz.ebs! Post ID: ' + d.postId, 'success');
  })
  .catch(function(e) { showToast('❌ Erro ao publicar: ' + e.message, 'error'); });
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.classList.remove('show'); }, 3500);
}

// ── Pexels Search ─────────────────────────────────────────────────────────────

function togglePexels() {
  pexelsOpen = !pexelsOpen;
  document.getElementById('pxBody').classList.toggle('open', pexelsOpen);
  document.getElementById('pxToggle').textContent = pexelsOpen ? '▲' : '▼';
}

function searchPexels() {
  var q   = document.getElementById('pxQuery').value.trim();
  var key = document.getElementById('pxKey').value.trim();
  if (!q)   { showToast('Digite algo para buscar', 'error'); return; }
  if (!key) { showToast('API Key Pexels ausente', 'error'); return; }

  var res = document.getElementById('pxResults');
  res.innerHTML = '<div class="pexels-hint">Buscando…</div>';

  fetch('https://api.pexels.com/v1/search?query=' + encodeURIComponent(q) + '&per_page=24&orientation=portrait', {
    headers: { Authorization: key }
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (!d.photos || !d.photos.length) {
      res.innerHTML = '<div class="pexels-hint">Nenhuma imagem encontrada para "' + q + '".</div>';
      return;
    }
    res.innerHTML = d.photos.map(function(p) {
      var url = p.src.large2x || p.src.large || p.src.original;
      return '<img class="pexels-thumb"'
        + ' src="' + p.src.tiny + '"'
        + ' data-url="' + url + '"'
        + ' title="' + p.photographer + ' — clique para copiar URL"'
        + ' onclick="copyPexelsUrl(this)">';
    }).join('');
  })
  .catch(function(e) {
    res.innerHTML = '<div class="pexels-hint">Erro: ' + e.message + '</div>';
  });
}

function copyPexelsUrl(img) {
  var url = img.getAttribute('data-url');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function() {
      showToast('📋 URL copiada!', 'success');
      img.style.borderColor = '#05A081';
      setTimeout(function() { img.style.borderColor = ''; }, 2000);
    });
  } else {
    prompt('Copie a URL:', url);
  }
}

// ── Imagen 4 Panel ────────────────────────────────────────────────────────────

var imagenOpen = false;
var IMAGEN_PROMPTS = {
  'teen-guitar'      : 'Young adult in their early 20s deeply focused playing electric guitar in a cozy Brazilian music school studio, warm amber lighting, authentic candid expression, slightly smiling, portrait 3:4, photorealistic photography, bokeh background, professional quality',
  'adult-keyboard'   : 'Young adult playing keyboard piano in a music school studio, concentrated expression, warm natural lighting, hands on keys, portrait 3:4, photorealistic photography, authentic moment',
  'recording-studio' : 'Professional recording studio vintage microphone on stand with warm orange-gold bokeh lighting, guitars visible in background, music school atmosphere, no people, portrait 3:4, photorealistic, cinematic',
  'child-guitar'     : 'Adult teacher and adult student learning acoustic guitar together in a warm music classroom, guitars on wall background, focused authentic moment, warm lighting, portrait 3:4, photorealistic, music school',
  'band-rehearsal'   : 'Group of young adults rehearsing music together in a studio, guitars and drums, energy and focus, candid authentic moment, warm amber lighting, portrait orientation, photorealistic, music school'
};

function toggleImagen() {
  imagenOpen = !imagenOpen;
  document.getElementById('imgBody').classList.toggle('open', imagenOpen);
  document.getElementById('imgToggle').textContent = imagenOpen ? '▲' : '▼';
}

document.addEventListener('click', function(e) {
  if (e.target && e.target.classList.contains('imagen-preset')) {
    var key = e.target.getAttribute('data-preset');
    var p = IMAGEN_PROMPTS[key];
    if (p) { document.getElementById('imgPrompt').value = p; document.getElementById('imgPrompt').focus(); }
  }
  if (e.target && e.target.getAttribute('data-action') === 'generate-imagen') {
    generateImagen();
  }
  if (e.target && e.target.classList.contains('imagen-apply-btn')) {
    var fname = e.target.getAttribute('data-filename');
    applyImagenToCarousel(fname);
  }
});

function generateImagen() {
  var prompt = document.getElementById('imgPrompt').value.trim();
  var model  = document.getElementById('imgModel').value;
  if (!prompt) { showToast('Descreva a imagem antes de gerar', 'error'); return; }

  var btn = document.getElementById('imgGenBtn');
  btn.disabled = true; btn.textContent = '⏳ Gerando…';
  document.getElementById('imgResults').innerHTML = '<div class="imagen-hint">⏳ Gerando imagem com IA… aguarde 5-20s</div>';

  fetch('/api/imagen/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt, model: model })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.error) throw new Error(d.error);
    var res = document.getElementById('imgResults');
    if (res.querySelector('.imagen-hint')) res.innerHTML = '';
    var card = document.createElement('div');
    card.className = 'imagen-card';
    card.title = prompt.substring(0, 80);
    card.innerHTML = '<img class="imagen-thumb" src="' + d.url + '">'
      + '<button class="imagen-apply-btn" data-filename="' + d.filename + '">✦ Aplicar</button>';
    res.insertBefore(card, res.firstChild);
    showToast('✅ Imagem gerada!', 'success');
  })
  .catch(function(e) {
    document.getElementById('imgResults').innerHTML = '<div class="imagen-hint">❌ ' + e.message + '</div>';
    showToast('❌ ' + e.message, 'error');
  })
  .finally(function() { btn.disabled = false; btn.textContent = '✦ Gerar'; });
}

function applyImagenToCarousel(filename) {
  var id = window.prompt('ID do carrossel onde aplicar a imagem (ex: tweet-guitarra-sozinho-01):');
  if (!id || !id.trim()) return;
  showToast('Aplicando imagem ao carrossel...');

  fetch('/api/carousel/' + encodeURIComponent(id.trim()) + '/apply-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: filename })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.error) throw new Error(d.error);
    showToast('✅ Imagem aplicada! Recarregando miniatura…', 'success');
    var tid = id.trim();
    var iframes = document.querySelectorAll('.card-preview iframe');
    for (var i = 0; i < iframes.length; i++) {
      if (iframes[i].src.indexOf(tid) !== -1) {
        var el = iframes[i]; el.src = '';
        (function(f) { setTimeout(function() { f.src = '/carousel/' + tid; }, 300); })(el);
        break;
      }
    }
  })
  .catch(function(e) { showToast('❌ ' + e.message, 'error'); });
}

// ── AI Edit ───────────────────────────────────────────────────────────────────

function requestAIEdit(id, btnEl) {
  var textarea = document.querySelector('.ai-textarea[data-ai-id="' + id + '"]');
  var request  = textarea ? textarea.value.trim() : '';
  if (!request) { showToast('Descreva o que deve ser mudado antes de enviar', 'error'); return; }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳'; }
  showToast('🤖 Enviando à IA… (20-40s)');

  fetch('/api/carousel/' + encodeURIComponent(id) + '/ai-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: request })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.error) throw new Error(d.error);
    showToast('✅ IA aplicou as mudanças! Miniatura recarregando...', 'success');
    if (textarea) textarea.value = '';
    // Recarrega o iframe deste card
    var iframes = document.querySelectorAll('.card-preview iframe');
    for (var f = 0; f < iframes.length; f++) {
      if (iframes[f].src.indexOf(id) !== -1) {
        var iframe = iframes[f];
        iframe.src = '';
        (function(el) { setTimeout(function() { el.src = '/carousel/' + id; }, 200); })(iframe);
        break;
      }
    }
  })
  .catch(function(e) {
    showToast('❌ Erro da IA: ' + e.message, 'error');
  })
  .finally(function() {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '✦ IA'; }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadQueue();
setInterval(loadQueue, 30000);
checkToken();
setInterval(checkToken, 300000);  // re-check a cada 5min
</script>
</body>
</html>`;

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // GET /api/queue
  if (req.url === '/api/queue' && req.method === 'GET') {
    jsonRes(res, readQueue());
    return;
  }

  // GET /api/settings
  if (req.url === '/api/settings' && req.method === 'GET') {
    jsonRes(res, {
      hasCredentials: !!(IG_USER_ID && ACCESS_TOKEN),
      igUserId: IG_USER_ID ? IG_USER_ID.slice(0, 4) + '...' : '',
      githubRepo: GIT.repo,
      githubRef: GIT.ref
    });
    return;
  }

  // PATCH /api/carousel/:id  — update status / scheduled_for
  if (req.url.startsWith('/api/carousel/') && req.method === 'PATCH' && !req.url.endsWith('/publish') && !req.url.endsWith('/export')) {
    const id = decodeURIComponent(req.url.substring(14));
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        const queue  = readQueue();
        const idx    = queue.carousels.findIndex(c => c.id === id);
        if (idx === -1) { jsonRes(res, { error: 'Not found' }, 404); return; }
        if (update.status)        queue.carousels[idx].status        = update.status;
        if (update.scheduled_for) queue.carousels[idx].scheduled_for = update.scheduled_for;
        writeQueue(queue);
        const sync = gitAutoSync(`chore: ${update.status || 'update'} ${id}`, ['queue.json']);
        jsonRes(res, { ok: true, carousel: queue.carousels[idx], sync });
      } catch (e) {
        jsonRes(res, { error: e.message }, 400);
      }
    });
    return;
  }

  // POST /api/carousel/:id/export  — exporta PNGs do carrossel via Playwright
  if (req.url.startsWith('/api/carousel/') && req.url.endsWith('/export') && req.method === 'POST') {
    const id = decodeURIComponent(req.url.substring(14, req.url.length - 7));

    (async () => {
      const logs = [];
      const log  = msg => { console.log(msg); logs.push(msg); };

      try {
        log(`📸 Exportando PNGs: ${id}`);
        const out = cp.execFileSync('node', ['scripts/export-one.js', id], {
          cwd: BASE_DIR,
          encoding: 'utf-8',
          timeout: 120000,
        });
        out.split('\n').filter(Boolean).forEach(l => logs.push(l));

        const queue = readQueue();
        const carousel = queue.carousels.find(c => c.id === id);
        const slideCount = (carousel && carousel.slides) ? carousel.slides.length : 0;

        // Commit dos PNGs + queue.json atualizado
        const sync = gitAutoSync(`feat: export PNGs ${id} (${slideCount} slides)`, [
          `slides/${id}/`,
          'queue.json',
        ]);
        log(`💾 git sync: committed=${sync.committed} pushed=${sync.pushed}` + (sync.error ? ' err=' + sync.error : ''));

        jsonRes(res, { ok: true, slideCount, logs, sync, carousel });
      } catch (err) {
        const stderr = (err.stderr || '').toString();
        const stdout = (err.stdout || '').toString();
        log('❌ Erro: ' + (stderr.trim() || err.message));
        if (stdout) stdout.split('\n').filter(Boolean).forEach(l => logs.push(l));
        jsonRes(res, { error: stderr.trim() || err.message, logs }, 500);
      }
    })();
    return;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/carousel/:id/publish-buffer  — publish via Buffer GraphQL API
  // Query params: ?draft=true|false (default true, p/ segurança)
  //               ?dueAt=ISO timestamp (opcional, p/ schedule)
  // ────────────────────────────────────────────────────────────────────────────
  if (req.url.startsWith('/api/carousel/') && req.url.includes('/publish-buffer') && req.method === 'POST') {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const id     = decodeURIComponent(urlObj.pathname.substring(14).replace('/publish-buffer', ''));
    const draft  = urlObj.searchParams.get('draft') !== 'false';   // default true
    const dueAt  = urlObj.searchParams.get('dueAt') || null;

    if (!BUFFER_TOKEN) {
      jsonRes(res, { error: 'BUFFER_ACCESS_TOKEN não configurado no .env' }, 400);
      return;
    }

    (async () => {
      try {
        const queue    = readQueue();
        const carousel = queue.carousels.find(c => c.id === id);
        if (!carousel) { jsonRes(res, { error: 'Carrossel não encontrado' }, 404); return; }

        const logs = [];
        const log  = msg => { console.log(msg); logs.push(msg); };

        log(`🔵 [Buffer] ${draft ? 'DRAFT' : (dueAt ? 'SCHEDULED' : 'QUEUE')}: ${carousel.id}`);

        // Construir URLs públicas das imagens via raw.githubusercontent.com
        const imageUrls = (carousel.slides || []).map(slidePath =>
          `https://raw.githubusercontent.com/${GIT.repo}/${GIT.ref}/${slidePath}`
        );
        if (!imageUrls.length) throw new Error('Carrossel não tem slides — verifique queue.json');
        log(`📤 ${imageUrls.length} imagens via raw.githubusercontent.com`);

        // Buffer aceita até 10 imagens em carrossel IG
        if (imageUrls.length > 10) {
          throw new Error(`Buffer/Instagram aceitam até 10 imagens (carrossel tem ${imageUrls.length}). Reduza no queue.json.`);
        }

        const text = `${carousel.caption || ''}\n\n${carousel.hashtags || ''}`.trim();

        const post = await buffer.createPost({
          token:     BUFFER_TOKEN,
          channelId: BUFFER_CHANNEL_ID,
          text,
          imageUrls,
          draft,
          ...(dueAt && !draft ? { dueAt } : {})
        });

        // Atualizar queue.json
        carousel.buffer_post_id = post.id;
        carousel.buffer_status  = post.status;
        if (!draft) {
          carousel.status        = 'scheduled';
          carousel.scheduled_at  = post.dueAt || dueAt;
        } else {
          carousel.status = carousel.status || 'pending';
        }
        writeQueue(queue);

        log(`✅ Buffer post ${post.id} criado (status: ${post.status})`);
        log(`📱 Ver em: https://publish.buffer.com/drafts`);
        jsonRes(res, { ok: true, postId: post.id, status: post.status, draft, dueAt: post.dueAt, logs });
      } catch (err) {
        console.error(err);
        jsonRes(res, { error: err.message, logs: [err.message] }, 500);
      }
    })();
    return;
  }

  // POST /api/carousel/:id/publish  — publish to Instagram via Meta Graph API (legado)
  if (req.url.startsWith('/api/carousel/') && req.url.endsWith('/publish') && req.method === 'POST') {
    const id = decodeURIComponent(req.url.substring(14, req.url.length - 8));

    if (!IG_USER_ID || !ACCESS_TOKEN) {
      jsonRes(res, { error: 'Credenciais Meta não configuradas no .env' }, 400);
      return;
    }

    (async () => {
      try {
        const queue    = readQueue();
        const carousel = queue.carousels.find(c => c.id === id);
        if (!carousel) { jsonRes(res, { error: 'Carrossel não encontrado' }, 404); return; }

        const logs = [];
        const log  = msg => { console.log(msg); logs.push(msg); };

        log(`🚀 Publicando carrossel: ${carousel.id}`);

        const result = await meta.postCarouselNow(
          carousel, IG_USER_ID, ACCESS_TOKEN, GIT.repo, GIT.ref, log
        );

        carousel.status       = 'published';
        carousel.published_at = new Date().toISOString();
        carousel.meta_post_id = result.postId;
        writeQueue(queue);

        const sync = gitAutoSync(`chore: published ${carousel.id} (${result.postId})`, ['queue.json']);
        log(`✅ Publicado com sucesso! Post ID: ${result.postId}`);
        log(`💾 git sync: committed=${sync.committed} pushed=${sync.pushed}`);
        jsonRes(res, { ok: true, postId: result.postId, logs, sync });
      } catch (err) {
        console.error(err);
        jsonRes(res, { error: err.message, logs: [err.message] }, 500);
      }
    })();
    return;
  }

  // POST /api/carousel/:id/ai-edit  — edit carousel HTML via Claude API (claude-sonnet-4-5)
  if (req.url.startsWith('/api/carousel/') && req.url.endsWith('/ai-edit') && req.method === 'POST') {
    const id = decodeURIComponent(req.url.substring(14, req.url.length - 8));
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      (async () => {
        try {
          const { request } = JSON.parse(body);
          if (!request || !request.trim()) {
            jsonRes(res, { error: 'Campo "request" é obrigatório' }, 400);
            return;
          }

          const ANTHROPIC_KEY = ENV.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
          if (!ANTHROPIC_KEY) {
            jsonRes(res, { error: 'ANTHROPIC_API_KEY não configurada no .env' }, 400);
            return;
          }

          const htmlPath = path.join(BASE_DIR, 'carrosseis', id + '.html');
          if (!fs.existsSync(htmlPath)) {
            jsonRes(res, { error: `Carrossel não encontrado: ${id}` }, 404);
            return;
          }

          const rawHtml = fs.readFileSync(htmlPath, 'utf-8');

          // ── Extrai base64 para reduzir tokens ────────────────────────────────
          // Imagens base64 podem ter 60-100KB de texto — substituímos por placeholders
          // e reinjetamos depois de receber a resposta modificada.
          const b64Map = {};
          let b64Idx = 0;
          const strippedHtml = rawHtml.replace(/data:[^;,]{1,60};base64,[A-Za-z0-9+/=]+/g, match => {
            const key = `__B64_${++b64Idx}__`;
            b64Map[key] = match;
            return key;
          });

          const systemPrompt = [
            'Você é um especialista em carrosséis para Instagram do EBS Aprendiz.',
            '',
            'REGRAS INEGOCIÁVEIS DA MARCA:',
            '- Handle SEMPRE: @aprendiz.ebs — NUNCA @ebsmusicfirst',
            '- Endereço CTA: Av. Minas Gerais, 57 — Centro, Corbélia-PR',
            '- PROIBIDO: revelar preços, prometer aprendizado rápido/em N dias',
            '- Tom: mentor experiente e acessível, NUNCA vendedor',
            '- Cores da marca: #D4A017 (dourado primário), #0A0A0A (fundo escuro)',
            '',
            'REGRA DE SAÍDA — CRÍTICA:',
            'Retorne APENAS o HTML modificado. Sem markdown, sem explicações, sem ```.',
            'O output deve começar com <!DOCTYPE html> ou <html e ser um HTML completo e válido.',
            'Preserve todos os placeholders __B64_N__ exatamente como estão no HTML recebido.',
            'Aplique SOMENTE a mudança solicitada — preserve tudo mais intacto.',
          ].join('\n');

          const userMessage = `INSTRUÇÃO DE MUDANÇA:\n${request.trim()}\n\nHTML ATUAL DO CARROSSEL:\n${strippedHtml}`;

          console.log(`🤖 AI edit "${request.trim()}" → ${id} | stripped: ${strippedHtml.length} chars, ${b64Idx} imagem(ns) preservada(s)`);

          const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-5',
              max_tokens: 16000,
              system: systemPrompt,
              messages: [{ role: 'user', content: userMessage }],
            }),
          });

          const apiData = await apiResp.json();
          if (!apiResp.ok || apiData.type === 'error') {
            const errMsg = apiData.error?.message || JSON.stringify(apiData).substring(0, 200);
            throw new Error(`Claude API ${apiResp.status}: ${errMsg}`);
          }

          let newHtml = apiData.content?.[0]?.text || '';

          // Remove markdown fence caso a IA ignore a instrução
          newHtml = newHtml.replace(/^```html?\s*/i, '').replace(/\s*```\s*$/, '').trim();

          if (!newHtml.includes('<') || newHtml.length < 200) {
            throw new Error('IA retornou resposta inválida. Tente uma instrução mais específica.');
          }

          // Re-injeta imagens base64
          const finalHtml = newHtml.replace(/__B64_\d+__/g, key => b64Map[key] || key);

          // Backup do original
          const backupDir = path.join(BASE_DIR, 'carrosseis', '.backups');
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          const backupFile = path.join(backupDir, `${id}-${Date.now()}.html`);
          fs.copyFileSync(htmlPath, backupFile);

          // Salva HTML modificado
          fs.writeFileSync(htmlPath, finalHtml, 'utf-8');
          console.log(`✅ ${id} atualizado pela IA · backup: ${path.basename(backupFile)}`);

          jsonRes(res, { ok: true, id, model: 'claude-sonnet-4-5', request: request.trim() });
        } catch (err) {
          console.error('AI edit error:', err.message);
          jsonRes(res, { error: err.message }, 500);
        }
      })();
    });
    return;
  }

  // POST /api/imagen/generate  — gerar imagem via Google AI Studio (Imagen 4 OU Gemini Nano Banana)
  if (req.url === '/api/imagen/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      (async () => {
        try {
          const { prompt, model: modelId } = JSON.parse(body);
          if (!prompt || !prompt.trim()) {
            jsonRes(res, { error: 'Campo "prompt" é obrigatório' }, 400);
            return;
          }
          if (!GEMINI_KEY) {
            jsonRes(res, { error: 'GEMINI_API_KEY não configurada no .env' }, 400);
            return;
          }

          const usedModel = modelId || 'gemini-2.5-flash-image';
          const isImagen  = usedModel.startsWith('imagen-');
          const family    = isImagen ? 'Imagen' : 'Gemini';

          const endpoint = isImagen
            ? `/v1beta/models/${usedModel}:predict`
            : `/v1beta/models/${usedModel}:generateContent`;

          const apiBody = isImagen
            ? JSON.stringify({
                instances: [{ prompt: prompt.trim() }],
                parameters: {
                  sampleCount: 1,
                  aspectRatio: '3:4',
                  safetyFilterLevel: 'BLOCK_ONLY_HIGH',
                  personGeneration: 'ALLOW_ADULT',
                }
              })
            : JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt.trim() }] }],
                generationConfig: {
                  responseModalities: ['IMAGE', 'TEXT'],
                  candidateCount: 1,
                  imageConfig: { aspectRatio: '3:4' },
                }
              });

          console.log(`🎨 ${family} → model: ${usedModel} | prompt: ${prompt.trim().substring(0, 60)}…`);

          const apiRes = await fetch(
            `https://generativelanguage.googleapis.com${endpoint}?key=${GEMINI_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: apiBody,
            }
          );

          const apiData = await apiRes.json();
          if (!apiRes.ok) {
            const errMsg = apiData.error?.message || JSON.stringify(apiData).substring(0, 200);
            throw new Error(`${family} API ${apiRes.status}: ${errMsg}`);
          }

          // Extrair imagem — formato difere entre Imagen e Gemini
          let b64, mime;
          if (isImagen) {
            const pred = apiData.predictions && apiData.predictions[0];
            if (!pred) {
              throw new Error('Sem predictions na resposta — safety filter (palavras como "teenager"/"child") ou billing. Tente Gemini Nano Banana.');
            }
            b64  = pred.bytesBase64Encoded || (pred.image && pred.image.imageBytes);
            mime = pred.mimeType || (pred.image && pred.image.mimeType) || 'image/png';
          } else {
            const parts = apiData.candidates?.[0]?.content?.parts;
            if (!parts) throw new Error('Sem candidates/parts na resposta do Gemini');
            const imgPart = parts.find(p => p.inlineData && p.inlineData.data);
            if (!imgPart) throw new Error('Sem inlineData na resposta do Gemini (provável safety filter)');
            b64  = imgPart.inlineData.data;
            mime = imgPart.inlineData.mimeType || 'image/png';
          }
          if (!b64) throw new Error('Imagem não encontrada na resposta. Verifique o plano/billing do Google AI Studio.');

          // Salva em tmp/imagen/ (mantido para compat com arquivos antigos)
          const imgDir = path.join(BASE_DIR, 'tmp', 'imagen');
          fs.mkdirSync(imgDir, { recursive: true });
          const ext      = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
          const filename = `${Date.now()}.${ext}`;
          const imgPath  = path.join(imgDir, filename);
          fs.writeFileSync(imgPath, Buffer.from(b64, 'base64'));

          const sizeKb = (fs.statSync(imgPath).size / 1024).toFixed(1);
          console.log(`✅ Imagem gerada: ${filename} (${sizeKb} KB)`);

          jsonRes(res, { ok: true, filename, url: `/tmp-img/${filename}`, sizeKb, model: usedModel });
        } catch (err) {
          console.error('Image generate error:', err.message);
          jsonRes(res, { error: err.message }, 500);
        }
      })();
    });
    return;
  }

  // GET /tmp-img/:filename  — serve imagens geradas pela Imagen 4
  if (req.url.startsWith('/tmp-img/') && req.method === 'GET') {
    const filename = path.basename(decodeURIComponent(req.url.substring(9)));
    const imgPath  = path.join(BASE_DIR, 'tmp', 'imagen', filename);
    if (!fs.existsSync(imgPath)) {
      res.writeHead(404); res.end('Imagem não encontrada');
      return;
    }
    const ext      = filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    res.writeHead(200, { 'Content-Type': ext, 'Cache-Control': 'public, max-age=86400' });
    res.end(fs.readFileSync(imgPath));
    return;
  }

  // POST /api/carousel/:id/apply-image  — substitui imagem principal do carrossel
  if (req.url.match(/^\/api\/carousel\/[^/]+\/apply-image$/) && req.method === 'POST') {
    const id = decodeURIComponent(req.url.split('/')[3]);
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { filename } = JSON.parse(body);
        if (!filename) {
          jsonRes(res, { error: 'Campo "filename" é obrigatório' }, 400);
          return;
        }

        const imgPath = path.join(BASE_DIR, 'tmp', 'imagen', path.basename(filename));
        if (!fs.existsSync(imgPath)) {
          jsonRes(res, { error: `Imagem não encontrada: ${filename}` }, 404);
          return;
        }

        const htmlPath = path.join(BASE_DIR, 'carrosseis', id + '.html');
        if (!fs.existsSync(htmlPath)) {
          jsonRes(res, { error: `Carrossel não encontrado: ${id}` }, 404);
          return;
        }

        // Converte imagem para base64 URI
        const ext     = filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
        const imgB64  = 'data:' + ext + ';base64,' + fs.readFileSync(imgPath).toString('base64');

        let html = fs.readFileSync(htmlPath, 'utf-8');
        let replaced = 0;

        // Estratégia 1: background-image com URL Pexels/HTTP
        html = html.replace(
          /background(?:-image)?\s*:\s*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/gi,
          () => { replaced++; return `background-image: url('${imgB64}')`; }
        );

        // Estratégia 2: background-image com data:URI existente (substituir)
        if (!replaced) {
          html = html.replace(
            /background(?:-image)?\s*:\s*url\(['"]?data:[^'")\s]+['"]?\)/gi,
            () => { replaced++; return `background-image: url('${imgB64}')`; }
          );
        }

        // Estratégia 3: <img src="https://..."> (exceto avatar — não substituir imagem de 48px)
        if (!replaced) {
          html = html.replace(
            /<img([^>]*?)src="https?:\/\/(?!fonts)[^"]+\.(?:jpg|jpeg|png|webp)[^"]*"([^>]*?)>/gi,
            (m, pre, post) => {
              // Skip avatar (small 48px images in x-header)
              if (m.includes('width:48px') || m.includes('border-radius:50%')) return m;
              replaced++;
              return `<img${pre}src="${imgB64}"${post}>`;
            }
          );
        }

        if (!replaced) {
          jsonRes(res, { error: 'Nenhuma imagem substituível encontrada no carrossel. Use o campo ✦ IA para fazer a troca manualmente.' }, 400);
          return;
        }

        // Backup + salvar
        const backupDir = path.join(BASE_DIR, 'carrosseis', '.backups');
        fs.mkdirSync(backupDir, { recursive: true });
        const backupFile = path.join(backupDir, `${id}-${Date.now()}.html`);
        fs.copyFileSync(htmlPath, backupFile);
        fs.writeFileSync(htmlPath, html, 'utf-8');

        console.log(`🖼️ ${id} — imagem substituída (${replaced} ocorrência(s)) · backup: ${path.basename(backupFile)}`);
        jsonRes(res, { ok: true, id, filename, replaced });
      } catch (err) {
        console.error('apply-image error:', err.message);
        jsonRes(res, { error: err.message }, 500);
      }
    });
    return;
  }

  // GET /api/meta/token-info  — status do token Meta/Instagram (+ refresh opcional)
  if (req.url.startsWith('/api/meta/token-info') && req.method === 'GET') {
    (async () => {
      try {
        const wantRefresh = req.url.includes('refresh=true');
        const flags = wantRefresh ? ['--json'] : ['--check', '--json'];
        const out = cp.execFileSync('node', ['scripts/refresh-meta-token.js', ...flags], {
          cwd: BASE_DIR,
          env: { ...process.env, META_ACCESS_TOKEN: ENV.META_ACCESS_TOKEN || '' },
          encoding: 'utf-8',
          timeout: 15000,
        });
        const data = JSON.parse(out.trim());
        // Não vazar o token novo para o frontend
        if (data.new_token) data.new_token = data.new_token.substring(0, 10) + '…';
        jsonRes(res, data);
      } catch (err) {
        // Tenta parsear JSON do stdout mesmo em exit !=0
        try {
          const out = err.stdout && err.stdout.toString().trim();
          if (out) {
            const data = JSON.parse(out);
            jsonRes(res, data, 200);
            return;
          }
        } catch {}
        jsonRes(res, { ok: false, reason: 'script_error', error: err.message }, 500);
      }
    })();
    return;
  }

  // GET /carousel/:id  — serve carousel HTML file
  if (req.url.startsWith('/carousel/')) {
    const carouselId   = decodeURIComponent(req.url.substring(10));
    const carouselPath = path.join(BASE_DIR, 'carrosseis', carouselId + '.html');
    if (fs.existsSync(carouselPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(carouselPath, 'utf-8'));
      return;
    }
    res.writeHead(404);
    res.end('Carrossel não encontrado');
    return;
  }

  // GET /  — serve dashboard
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(DASHBOARD_HTML);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════╗');
  console.log('  ║  EBS Aprendiz — Dashboard                     ║');
  console.log('  ║  ✅ Miniaturas · Pexels · Aprovar · Publicar  ║');
  console.log('  ╚═══════════════════════════════════════════════╝');
  console.log('');
  console.log('  🌐  http://localhost:' + PORT);
  console.log('  📂  Carrosséis: ' + path.join(BASE_DIR, 'carrosseis'));
  console.log('');
});
