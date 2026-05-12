/**
 * EBS Aprendiz — Dashboard de Aprovação
 * Uso: node scripts/dashboard.js
 * Acesse: http://localhost:3000
 *
 * Servidor local sem dependências externas.
 * Permite aprovar, agendar e visualizar carrosséis antes de publicar.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT       = 3000;
const BASE_DIR   = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(BASE_DIR, 'queue.json');
const SLIDES_DIR = path.join(BASE_DIR, 'slides');

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function readQueue() {
  return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
}

function writeQueue(data) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(data, null, 2) + '\n');
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

// ─────────────────────────────────────────
// API handlers
// ─────────────────────────────────────────

function handleGetQueue(res) {
  const q = readQueue();
  // Enrich: add slide count per carousel
  q.carousels = q.carousels.map(c => ({
    ...c,
    _slideCount: c.slides ? c.slides.length : 0,
  }));
  json(res, q);
}

async function handlePatchCarousel(req, res, id) {
  const body = await parseBody(req);
  const q = readQueue();
  const idx = q.carousels.findIndex(c => c.id === id);
  if (idx === -1) return json(res, { error: 'não encontrado' }, 404);

  const allowed = ['status', 'scheduled_for', 'caption', 'hashtags'];
  allowed.forEach(k => {
    if (body[k] !== undefined) q.carousels[idx][k] = body[k];
  });

  // Se aprovando, registra approved_at
  if (body.status === 'approved' && !q.carousels[idx].approved_at) {
    q.carousels[idx].approved_at = new Date().toISOString().split('T')[0];
  }
  // Se voltando a pending, limpa campos de publicação
  if (body.status === 'pending') {
    delete q.carousels[idx].approved_at;
    delete q.carousels[idx].published_at;
    delete q.carousels[idx].meta_post_id;
  }

  writeQueue(q);
  json(res, { ok: true, carousel: q.carousels[idx] });
}

function handleServeSlide(req, res, slidePath) {
  // slidePath vem como /slides/EDU-.../slide_1.png
  const filePath = path.join(BASE_DIR, slidePath);
  // Segurança: garantir que o path fica dentro de BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': 'image/png' });
  fs.createReadStream(filePath).pipe(res);
}

// ─────────────────────────────────────────
// Dashboard HTML
// ─────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EBS Aprendiz — Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --gold:    #D4A017;
    --gold-lt: #F0C040;
    --gold-dk: #A07810;
    --bg:      #0A0A0A;
    --bg2:     #141414;
    --bg3:     #1E1E1E;
    --bg4:     #282828;
    --border:  rgba(255,255,255,0.07);
    --text:    #F0EDE8;
    --muted:   rgba(240,237,232,0.45);
    --approved:#22c55e;
    --pending: #D4A017;
    --published:#60a5fa;
    --rejected: #ef4444;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
    min-height: 100vh;
  }

  /* ── Header ── */
  header {
    border-bottom: 1px solid var(--border);
    padding: 0 32px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    background: rgba(10,10,10,0.92);
    backdrop-filter: blur(12px);
    z-index: 100;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.3px;
  }
  .logo-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--gold);
  }
  .header-tag {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: var(--muted);
    text-transform: uppercase;
  }

  /* ── Stats bar ── */
  .stats-bar {
    display: flex;
    gap: 1px;
    background: var(--border);
    border-bottom: 1px solid var(--border);
  }
  .stat-item {
    flex: 1;
    padding: 16px 24px;
    background: var(--bg2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
  }
  .stat-value {
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
  }
  .stat-value.approved  { color: var(--approved); }
  .stat-value.published { color: var(--published); }
  .stat-value.pending   { color: var(--pending); }

  /* ── Toolbar ── */
  .toolbar {
    padding: 20px 32px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .filter-btn {
    padding: 7px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .filter-btn:hover  { background: var(--bg3); color: var(--text); }
  .filter-btn.active { background: var(--gold); color: #0A0A0A; border-color: var(--gold); }
  .spacer { flex: 1; }
  .reload-btn {
    padding: 7px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .reload-btn:hover { background: var(--bg3); color: var(--text); }

  /* ── Grid ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
    padding: 0 32px 48px;
  }

  /* ── Card ── */
  .card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s, transform 0.15s;
  }
  .card:hover { border-color: rgba(212,160,23,0.2); transform: translateY(-1px); }
  .card.status-approved  { border-color: rgba(34,197,94,0.2); }
  .card.status-published { border-color: rgba(96,165,250,0.2); }
  .card.status-rejected  { border-color: rgba(239,68,68,0.15); opacity: 0.7; }

  /* Thumbnail strip */
  .thumb-strip {
    position: relative;
    display: flex;
    gap: 2px;
    height: 130px;
    overflow: hidden;
    background: #000;
    cursor: pointer;
  }
  .thumb-strip img {
    flex: 1;
    height: 100%;
    object-fit: cover;
    object-position: top;
    min-width: 0;
    transition: opacity 0.2s;
  }
  .thumb-strip:hover img { opacity: 0.85; }
  .thumb-strip-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0);
    transition: background 0.2s;
    pointer-events: none;
  }
  .thumb-strip:hover .thumb-strip-overlay { background: rgba(0,0,0,0.35); }
  .preview-icon {
    color: #fff;
    font-size: 28px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .thumb-strip:hover .preview-icon { opacity: 1; }
  .slide-count-badge {
    position: absolute;
    top: 8px; right: 8px;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(4px);
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
  }

  /* Card body */
  .card-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }
  .card-meta {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .card-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
    flex: 1;
  }
  .status-badge {
    flex-shrink: 0;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .badge-approved  { background: rgba(34,197,94,0.15);  color: var(--approved);  }
  .badge-pending   { background: rgba(212,160,23,0.15); color: var(--pending);  }
  .badge-published { background: rgba(96,165,250,0.15); color: var(--published); }
  .badge-rejected  { background: rgba(239,68,68,0.12);  color: var(--rejected); }

  .card-id {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1px;
    color: var(--muted);
    text-transform: uppercase;
  }

  /* Caption preview */
  .caption-preview {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
    max-height: 54px;
    overflow: hidden;
    position: relative;
  }
  .caption-preview::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 24px;
    background: linear-gradient(transparent, var(--bg2));
  }

  /* Schedule row */
  .schedule-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .schedule-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--muted);
    white-space: nowrap;
  }
  .schedule-input {
    flex: 1;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    color: var(--text);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s;
    outline: none;
  }
  .schedule-input:hover  { border-color: rgba(212,160,23,0.3); }
  .schedule-input:focus  { border-color: var(--gold); }
  .schedule-input::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }

  /* Action buttons */
  .card-actions {
    display: flex;
    gap: 8px;
    margin-top: auto;
  }
  .btn {
    flex: 1;
    padding: 8px 12px;
    border-radius: 7px;
    border: none;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.2px;
  }
  .btn-approve {
    background: rgba(34,197,94,0.12);
    color: var(--approved);
    border: 1px solid rgba(34,197,94,0.2);
  }
  .btn-approve:hover { background: rgba(34,197,94,0.2); }
  .btn-approve:disabled { opacity: 0.4; cursor: default; }

  .btn-pending {
    background: rgba(212,160,23,0.1);
    color: var(--gold);
    border: 1px solid rgba(212,160,23,0.2);
    flex: 0 0 auto;
    padding: 8px 10px;
  }
  .btn-pending:hover { background: rgba(212,160,23,0.18); }

  .btn-reject {
    background: rgba(239,68,68,0.08);
    color: var(--rejected);
    border: 1px solid rgba(239,68,68,0.15);
    flex: 0 0 auto;
    padding: 8px 10px;
  }
  .btn-reject:hover { background: rgba(239,68,68,0.15); }

  .btn-save-schedule {
    background: var(--bg3);
    color: var(--muted);
    border: 1px solid var(--border);
    flex: 0 0 auto;
    padding: 6px 12px;
    font-size: 11px;
  }
  .btn-save-schedule:hover { background: var(--bg4); color: var(--text); }
  .btn-save-schedule.saved { color: var(--approved); border-color: rgba(34,197,94,0.3); }

  /* Published info */
  .published-info {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .published-info span { display: flex; align-items: center; gap: 4px; }

  /* Empty state */
  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 80px 32px;
    color: var(--muted);
  }
  .empty-state h3 { font-size: 18px; margin-bottom: 8px; }
  .empty-state p  { font-size: 14px; }

  /* ── Lightbox ── */
  .lightbox-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    z-index: 1000;
    align-items: center;
    justify-content: center;
  }
  .lightbox-overlay.open { display: flex; }
  .lightbox {
    position: relative;
    display: flex;
    align-items: center;
    gap: 20px;
    max-height: 90vh;
  }
  .lightbox-img-wrap {
    position: relative;
    height: 80vh;
    aspect-ratio: 4/5;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,0.8);
  }
  .lightbox-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lightbox-counter {
    position: absolute;
    bottom: 16px;
    right: 16px;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
  }
  .lb-btn {
    width: 48px; height: 48px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.06);
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .lb-btn:hover  { background: rgba(255,255,255,0.12); }
  .lb-btn:disabled { opacity: 0.25; cursor: default; }
  .lb-close {
    position: absolute;
    top: -52px; right: 0;
    width: 36px; height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.06);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .lb-close:hover { background: rgba(255,255,255,0.14); }
  .lightbox-side {
    max-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--text);
  }
  .lb-title { font-size: 16px; font-weight: 700; line-height: 1.3; }
  .lb-caption {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.6;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
  }
  .lb-caption::-webkit-scrollbar { width: 3px; }
  .lb-caption::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .lb-hashtags {
    font-size: 11px;
    color: var(--gold);
    line-height: 1.7;
    word-break: break-word;
  }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 28px; right: 28px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    transform: translateY(20px);
    opacity: 0;
    transition: all 0.25s;
    z-index: 9999;
    max-width: 320px;
    pointer-events: none;
  }
  .toast.show {
    transform: translateY(0);
    opacity: 1;
  }
  .toast.success { border-color: rgba(34,197,94,0.3); color: var(--approved); }
  .toast.error   { border-color: rgba(239,68,68,0.3); color: var(--rejected); }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }
</style>
</head>
<body>

<!-- Header -->
<header>
  <div class="logo">
    <div class="logo-dot"></div>
    EBS Aprendiz
  </div>
  <span class="header-tag">Dashboard · @aprendiz.ebs</span>
</header>

<!-- Stats bar -->
<div class="stats-bar" id="statsBar">
  <div class="stat-item">
    <span class="stat-label">Total</span>
    <span class="stat-value" id="statTotal">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">Aprovados</span>
    <span class="stat-value approved" id="statApproved">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">Publicados</span>
    <span class="stat-value published" id="statPublished">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">Pendentes</span>
    <span class="stat-value pending" id="statPending">—</span>
  </div>
</div>

<!-- Toolbar -->
<div class="toolbar">
  <button class="filter-btn active" onclick="setFilter('all')">Todos</button>
  <button class="filter-btn" onclick="setFilter('pending')">Pendentes</button>
  <button class="filter-btn" onclick="setFilter('approved')">Aprovados</button>
  <button class="filter-btn" onclick="setFilter('published')">Publicados</button>
  <div class="spacer"></div>
  <button class="reload-btn" onclick="loadQueue()">↻ Atualizar</button>
</div>

<!-- Grid -->
<div class="grid" id="grid"></div>

<!-- Lightbox -->
<div class="lightbox-overlay" id="lightbox" onclick="closeLightbox(event)">
  <div class="lightbox">
    <div style="position:relative">
      <button class="lb-close" onclick="closeLightboxBtn()">✕</button>
      <div class="lightbox-img-wrap">
        <img id="lbImg" src="" alt="">
        <div class="lightbox-counter" id="lbCounter">1 / 7</div>
      </div>
    </div>
    <button class="lb-btn" id="lbPrev" onclick="lbNav(-1)">‹</button>
    <button class="lb-btn" id="lbNext" onclick="lbNav(1)">›</button>
    <div class="lightbox-side" id="lbSide"></div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
let allCarousels = [];
let currentFilter = 'all';
let lbSlides = [];
let lbIdx = 0;

// ── Data ──────────────────────────────────
async function loadQueue() {
  try {
    const res  = await fetch('/api/queue');
    const data = await res.json();
    allCarousels = data.carousels || [];
    updateStats();
    renderGrid();
  } catch(e) {
    showToast('Erro ao carregar fila: ' + e.message, 'error');
  }
}

function updateStats() {
  const total     = allCarousels.length;
  const approved  = allCarousels.filter(c => c.status === 'approved').length;
  const published = allCarousels.filter(c => c.status === 'published').length;
  const pending   = allCarousels.filter(c => c.status === 'pending' || (!c.status)).length;

  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statApproved').textContent  = approved;
  document.getElementById('statPublished').textContent = published;
  document.getElementById('statPending').textContent   = pending;
}

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderGrid();
}

// ── Render ────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('grid');
  const list = currentFilter === 'all'
    ? allCarousels
    : allCarousels.filter(c => (c.status || 'pending') === currentFilter);

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state"><h3>Nenhum carrossel encontrado</h3><p>Adicione carrosséis ao queue.json ou mude o filtro.</p></div>';
    return;
  }

  grid.innerHTML = list.map(c => renderCard(c)).join('');
}

function renderCard(c) {
  const status   = c.status || 'pending';
  const badgeMap = { approved:'badge-approved', pending:'badge-pending', published:'badge-published', rejected:'badge-rejected' };
  const labelMap = { approved:'Aprovado', pending:'Pendente', published:'Publicado', rejected:'Rejeitado' };
  const badge    = badgeMap[status] || 'badge-pending';
  const label    = labelMap[status] || status;

  const slides   = c.slides || [];
  const thumbs   = slides.slice(0, 4).map(s =>
    '<img src="/' + s + '" alt="" onerror="this.style.display=\'none\'">'
  ).join('');

  const captionShort = (c.caption || '').replace(/\\n/g, ' ').substring(0, 120);
  const scheduledVal = c.scheduled_for
    ? (c.scheduled_for.includes('T') ? c.scheduled_for.substring(0,16) : c.scheduled_for + 'T09:00')
    : '';

  const isPublished = status === 'published';

  return \`
  <div class="card status-\${status}" id="card-\${c.id}">
    <div class="thumb-strip" onclick="openLightbox('\${c.id}')">
      \${thumbs}
      <div class="thumb-strip-overlay">
        <span class="preview-icon">⊙</span>
      </div>
      <span class="slide-count-badge">\${slides.length} slides</span>
    </div>

    <div class="card-body">
      <div class="card-meta">
        <div>
          <div class="card-id">\${c.id}</div>
          <div class="card-title">\${c.title || 'Sem título'}</div>
        </div>
        <span class="status-badge \${badge}">\${label}</span>
      </div>

      <div class="caption-preview">\${captionShort}</div>

      \${isPublished ? \`
      <div class="published-info">
        <span>📅 Publicado em: \${c.published_at ? c.published_at.substring(0,10) : '—'}</span>
        \${c.meta_post_id ? \`<span>🔗 Post ID: \${c.meta_post_id}</span>\` : ''}
      </div>
      \` : \`
      <div class="schedule-row">
        <span class="schedule-label">Agendar</span>
        <input
          type="datetime-local"
          class="schedule-input"
          id="sched-\${c.id}"
          value="\${scheduledVal}"
          onchange="markSchedDirty('\${c.id}')"
        >
        <button class="btn btn-save-schedule" id="sched-btn-\${c.id}" onclick="saveSchedule('\${c.id}')">Salvar</button>
      </div>

      <div class="card-actions">
        <button class="btn btn-approve" onclick="setStatus('\${c.id}','approved')" \${status==='approved'?'disabled':''}>
          \${status === 'approved' ? '✓ Aprovado' : '✓ Aprovar'}
        </button>
        <button class="btn btn-pending" title="Voltar a pendente" onclick="setStatus('\${c.id}','pending')">⏸</button>
        <button class="btn btn-reject" title="Rejeitar" onclick="setStatus('\${c.id}','rejected')">✕</button>
      </div>
      \`}
    </div>
  </div>\`;
}

// ── Actions ───────────────────────────────
async function setStatus(id, status) {
  const statusLabel = { approved:'Aprovado', pending:'Pendente', rejected:'Rejeitado' };
  try {
    const res = await fetch('/api/carousel/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro');

    // Update local state
    const idx = allCarousels.findIndex(c => c.id === id);
    if (idx !== -1) Object.assign(allCarousels[idx], data.carousel);
    updateStats();
    renderGrid();
    showToast('Status atualizado: ' + (statusLabel[status] || status), 'success');
  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

function markSchedDirty(id) {
  const btn = document.getElementById('sched-btn-' + id);
  if (btn) { btn.classList.remove('saved'); btn.textContent = 'Salvar'; }
}

async function saveSchedule(id) {
  const input = document.getElementById('sched-' + id);
  if (!input) return;
  const val = input.value; // "2026-05-15T09:00"
  const btn = document.getElementById('sched-btn-' + id);

  try {
    const res = await fetch('/api/carousel/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_for: val || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro');

    const idx = allCarousels.findIndex(c => c.id === id);
    if (idx !== -1) allCarousels[idx].scheduled_for = val || null;

    if (btn) { btn.classList.add('saved'); btn.textContent = '✓'; }
    showToast('Agendamento salvo: ' + (val ? val.replace('T',' ') : 'removido'), 'success');
  } catch(e) {
    showToast('Erro ao salvar: ' + e.message, 'error');
  }
}

// ── Lightbox ──────────────────────────────
function openLightbox(id) {
  const c = allCarousels.find(x => x.id === id);
  if (!c || !c.slides || !c.slides.length) return;

  lbSlides = c.slides;
  lbIdx    = 0;

  // Side panel
  document.getElementById('lbSide').innerHTML = \`
    <div class="lb-title">\${c.title || c.id}</div>
    <div class="lb-caption">\${(c.caption || '').replace(/\\\\n/g, '\\n')}</div>
    <div class="lb-hashtags">\${c.hashtags || ''}</div>
  \`;

  document.getElementById('lightbox').classList.add('open');
  updateLb();
  document.addEventListener('keydown', lbKeydown);
}

function updateLb() {
  document.getElementById('lbImg').src     = '/' + lbSlides[lbIdx];
  document.getElementById('lbCounter').textContent = (lbIdx + 1) + ' / ' + lbSlides.length;
  document.getElementById('lbPrev').disabled = lbIdx === 0;
  document.getElementById('lbNext').disabled = lbIdx === lbSlides.length - 1;
}

function lbNav(dir) {
  lbIdx = Math.max(0, Math.min(lbSlides.length - 1, lbIdx + dir));
  updateLb();
}

function lbKeydown(e) {
  if (e.key === 'ArrowLeft')  lbNav(-1);
  if (e.key === 'ArrowRight') lbNav(1);
  if (e.key === 'Escape')     closeLightboxBtn();
}

function closeLightbox(e) {
  if (e.target === document.getElementById('lightbox')) closeLightboxBtn();
}

function closeLightboxBtn() {
  document.getElementById('lightbox').classList.remove('open');
  document.removeEventListener('keydown', lbKeydown);
}

// ── Toast ─────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); }, 3000);
}

// ── Init ──────────────────────────────────
loadQueue();
</script>
</body>
</html>`;

// ─────────────────────────────────────────
// HTTP Server
// ─────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed  = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method.toUpperCase();

  // CORS para dev local
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ── GET / → dashboard HTML
  if (method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // ── GET /api/queue
  if (method === 'GET' && pathname === '/api/queue') {
    handleGetQueue(res);
    return;
  }

  // ── PATCH /api/carousel/:id
  const carouselMatch = pathname.match(/^\/api\/carousel\/(.+)$/);
  if (method === 'PATCH' && carouselMatch) {
    const id = decodeURIComponent(carouselMatch[1]);
    await handlePatchCarousel(req, res, id);
    return;
  }

  // ── GET /slides/**  → serve PNG
  if (method === 'GET' && pathname.startsWith('/slides/')) {
    handleServeSlide(req, res, pathname);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║   EBS Aprendiz — Dashboard           ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');
  console.log('  🌐  http://localhost:' + PORT);
  console.log('  📁  queue.json: ' + QUEUE_PATH);
  console.log('  🖼️   slides:    ' + SLIDES_DIR);
  console.log('');
  console.log('  Ctrl+C para encerrar');
  console.log('');
});
