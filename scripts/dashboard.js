/**
 * EBS Aprendiz — Dashboard de Aprovação e Publicação
 * Uso: node scripts/dashboard.js
 * Acesse: http://localhost:3000
 *
 * Funcionalidades:
 *   - Visualizar e aprovar carrosséis da fila
 *   - Ver posts publicados via Meta Graph API
 *   - Postar carrossel imediatamente pelo dashboard
 *   - Preparar containers no Meta e agendar publicação
 */

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const cp     = require('child_process');
const meta   = require('./meta-api');

const PORT       = 3000;
const BASE_DIR   = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(BASE_DIR, 'queue.json');
const SLIDES_DIR = path.join(BASE_DIR, 'slides');

// ─────────────────────────────────────────
// Carregar .env local
// ─────────────────────────────────────────

function loadDotEnv() {
  const envPath = path.join(BASE_DIR, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([^#\s=][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const ENV = loadDotEnv();
const IG_USER_ID   = ENV.META_IG_USER_ID   || process.env.META_IG_USER_ID   || '';
const ACCESS_TOKEN = ENV.META_ACCESS_TOKEN  || process.env.META_ACCESS_TOKEN  || '';

// Detectar repo e branch via git
function getGitInfo() {
  try {
    const remoteRaw = cp.execSync('git remote get-url origin', { cwd: BASE_DIR, encoding: 'utf-8' }).trim();
    const match = remoteRaw.match(/github\.com[:/](.+?)(\.git)?$/);
    const repo = match ? match[1] : '';
    const ref  = cp.execSync('git rev-parse --abbrev-ref HEAD', { cwd: BASE_DIR, encoding: 'utf-8' }).trim();
    return { repo, ref };
  } catch {
    return { repo: '', ref: 'main' };
  }
}

const GIT = getGitInfo();
const GITHUB_REPO = GIT.repo;
const GITHUB_REF  = GIT.ref;

// ─────────────────────────────────────────
// Helpers HTTP / JSON
// ─────────────────────────────────────────

function readQueue() {
  return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
}

function writeQueue(data) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(data, null, 2) + '\n');
}

function jsonRes(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

// ─────────────────────────────────────────
// API handlers
// ─────────────────────────────────────────

function handleGetSettings(res) {
  jsonRes(res, {
    hasCredentials: !!(IG_USER_ID && ACCESS_TOKEN),
    igUserId: IG_USER_ID ? IG_USER_ID.slice(0, 4) + '…' : null,
    githubRepo: GITHUB_REPO,
    githubRef: GITHUB_REF,
  });
}

function handleGetQueue(res) {
  const q = readQueue();
  jsonRes(res, q);
}

async function handlePatchCarousel(req, res, id) {
  const body = await parseBody(req);
  const q = readQueue();
  const idx = q.carousels.findIndex(c => c.id === id);
  if (idx === -1) return jsonRes(res, { error: 'não encontrado' }, 404);

  const allowed = ['status', 'scheduled_for', 'caption', 'hashtags'];
  allowed.forEach(k => { if (body[k] !== undefined) q.carousels[idx][k] = body[k]; });

  if (body.status === 'approved' && !q.carousels[idx].approved_at) {
    q.carousels[idx].approved_at = new Date().toISOString().split('T')[0];
  }
  if (body.status === 'pending') {
    delete q.carousels[idx].approved_at;
    delete q.carousels[idx].published_at;
    delete q.carousels[idx].meta_post_id;
    delete q.carousels[idx].meta_container_id;
  }
  writeQueue(q);
  jsonRes(res, { ok: true, carousel: q.carousels[idx] });
}

async function handlePostNow(req, res, id) {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    return jsonRes(res, { error: 'Credenciais Meta não configuradas no .env' }, 400);
  }
  if (!GITHUB_REPO) {
    return jsonRes(res, { error: 'Repositório Git não detectado' }, 400);
  }

  const q = readQueue();
  const carousel = q.carousels.find(c => c.id === id);
  if (!carousel) return jsonRes(res, { error: 'Carrossel não encontrado' }, 404);
  if (carousel.status === 'published') return jsonRes(res, { error: 'Carrossel já publicado' }, 400);

  const logs = [];
  const log  = (msg) => { console.log(msg); logs.push(msg); };

  try {
    let postId;
    if (carousel.meta_container_id) {
      log(`♻️  Publicando container pré-criado: ${carousel.meta_container_id}`);
      postId = await meta.publishCarousel(carousel.meta_container_id, IG_USER_ID, ACCESS_TOKEN);
    } else {
      const result = await meta.postCarouselNow(
        carousel, IG_USER_ID, ACCESS_TOKEN, GITHUB_REPO, GITHUB_REF, log
      );
      postId = result.postId;
    }

    carousel.status       = 'published';
    carousel.published_at = new Date().toISOString();
    carousel.meta_post_id = postId;
    delete carousel.meta_container_id;
    writeQueue(q);

    jsonRes(res, { ok: true, postId, logs });
  } catch (err) {
    logs.push(`❌ Erro: ${err.message}`);
    jsonRes(res, { error: err.message, logs }, 500);
  }
}

async function handlePrepare(req, res, id) {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    return jsonRes(res, { error: 'Credenciais Meta não configuradas no .env' }, 400);
  }
  if (!GITHUB_REPO) {
    return jsonRes(res, { error: 'Repositório Git não detectado' }, 400);
  }

  const body = await parseBody(req);
  const scheduledFor = body.scheduled_for; // ISO string

  const q = readQueue();
  const idx = q.carousels.findIndex(c => c.id === id);
  if (idx === -1) return jsonRes(res, { error: 'Carrossel não encontrado' }, 404);

  const carousel = q.carousels[idx];
  const logs = [];
  const log  = (msg) => { console.log(msg); logs.push(msg); };

  try {
    const containerId = await meta.prepareCarouselContainers(
      carousel, IG_USER_ID, ACCESS_TOKEN, GITHUB_REPO, GITHUB_REF, log
    );

    carousel.meta_container_id = containerId;
    carousel.status            = 'scheduled';
    carousel.scheduled_for     = scheduledFor || carousel.scheduled_for;
    if (!carousel.approved_at) carousel.approved_at = new Date().toISOString().split('T')[0];
    writeQueue(q);

    jsonRes(res, { ok: true, containerId, logs });
  } catch (err) {
    logs.push(`❌ Erro: ${err.message}`);
    jsonRes(res, { error: err.message, logs }, 500);
  }
}

async function handleGetIgPosts(res) {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    return jsonRes(res, { error: 'Credenciais Meta não configuradas' }, 400);
  }
  try {
    const data = await meta.fetchIgPosts(IG_USER_ID, ACCESS_TOKEN, 24);
    jsonRes(res, data);
  } catch (err) {
    jsonRes(res, { error: err.message }, 500);
  }
}

async function handleGetAccountInfo(res) {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    return jsonRes(res, { error: 'Credenciais Meta não configuradas' }, 400);
  }
  try {
    const data = await meta.fetchAccountInfo(IG_USER_ID, ACCESS_TOKEN);
    jsonRes(res, data);
  } catch (err) {
    jsonRes(res, { error: err.message }, 500);
  }
}

function handleServeSlide(req, res, slidePath) {
  const filePath = path.join(BASE_DIR, slidePath);
  if (!filePath.startsWith(BASE_DIR)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
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
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EBS Aprendiz — Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --gold:#D4A017;--gold-lt:#F0C040;--gold-dk:#A07810;
  --bg:#0A0A0A;--bg2:#141414;--bg3:#1E1E1E;--bg4:#282828;
  --border:rgba(255,255,255,0.07);
  --text:#F0EDE8;--muted:rgba(240,237,232,0.45);
  --green:#22c55e;--blue:#60a5fa;--amber:#D4A017;--red:#ef4444;--purple:#a78bfa;
}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'Space Grotesk',sans-serif;min-height:100vh;}

/* Header */
header{border-bottom:1px solid var(--border);padding:0 28px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:rgba(10,10,10,0.93);backdrop-filter:blur(12px);z-index:100;}
.logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;letter-spacing:-.3px;}
.logo-dot{width:7px;height:7px;border-radius:50%;background:var(--gold);}
.header-right{display:flex;align-items:center;gap:16px;}
.account-pill{display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:600;color:var(--muted);}
.account-pill .dot{width:6px;height:6px;border-radius:50%;background:var(--border);}
.account-pill.ok .dot{background:var(--green);}
.account-pill.ok{color:var(--text);}

/* Alert banner */
.cred-banner{padding:10px 28px;background:rgba(212,160,23,0.07);border-bottom:1px solid rgba(212,160,23,0.15);font-size:12px;color:var(--amber);display:none;align-items:center;gap:8px;}
.cred-banner.show{display:flex;}
.cred-banner a{color:var(--gold-lt);text-decoration:underline;cursor:pointer;}

/* Stats */
.stats-bar{display:flex;gap:1px;background:var(--border);border-bottom:1px solid var(--border);}
.stat-item{flex:1;padding:14px 20px;background:var(--bg2);display:flex;flex-direction:column;gap:3px;}
.stat-label{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);}
.stat-value{font-size:22px;font-weight:700;line-height:1;}
.sv-total{color:var(--text);}
.sv-approved{color:var(--green);}
.sv-scheduled{color:var(--purple);}
.sv-published{color:var(--blue);}
.sv-pending{color:var(--amber);}

/* Tabs */
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);padding:0 28px;}
.tab{padding:14px 18px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;letter-spacing:-.1px;}
.tab:hover{color:var(--text);}
.tab.active{color:var(--text);border-bottom-color:var(--gold);}

/* Toolbar */
.toolbar{padding:16px 28px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.filter-btn{padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.5px;cursor:pointer;transition:all .15s;}
.filter-btn:hover{background:var(--bg3);color:var(--text);}
.filter-btn.active{background:var(--gold);color:#0A0A0A;border-color:var(--gold);}
.spacer{flex:1;}
.icon-btn{padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:inherit;font-size:11px;cursor:pointer;transition:all .15s;}
.icon-btn:hover{background:var(--bg3);color:var(--text);}

/* Grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;padding:0 28px 48px;}

/* Card */
.card{background:var(--bg2);border:1px solid var(--border);border-radius:11px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s,transform .15s;}
.card:hover{border-color:rgba(212,160,23,0.18);transform:translateY(-1px);}
.card.status-approved{border-color:rgba(34,197,94,0.18);}
.card.status-published{border-color:rgba(96,165,250,0.18);}
.card.status-scheduled{border-color:rgba(167,139,250,0.2);}
.card.status-rejected{border-color:rgba(239,68,68,0.12);opacity:.65;}

/* Thumb strip */
.thumb-strip{position:relative;display:flex;gap:2px;height:118px;overflow:hidden;background:#000;cursor:pointer;}
.thumb-strip img{flex:1;height:100%;object-fit:cover;object-position:top;min-width:0;transition:opacity .2s;}
.thumb-strip:hover img{opacity:.82;}
.thumb-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0);transition:background .2s;pointer-events:none;}
.thumb-strip:hover .thumb-overlay{background:rgba(0,0,0,0.32);}
.preview-icon{color:#fff;font-size:26px;opacity:0;transition:opacity .2s;}
.thumb-strip:hover .preview-icon{opacity:1;}
.slide-badge{position:absolute;top:7px;right:7px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);border-radius:20px;padding:2px 9px;font-size:10px;font-weight:600;color:#fff;}

/* Card body */
.card-body{padding:14px;display:flex;flex-direction:column;gap:10px;flex:1;}
.card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}
.card-title{font-size:13px;font-weight:600;line-height:1.3;flex:1;}
.card-id{font-size:9px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:2px;}

/* Status badges */
.badge{flex-shrink:0;padding:3px 9px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;}
.badge-approved{background:rgba(34,197,94,.12);color:var(--green);}
.badge-pending{background:rgba(212,160,23,.12);color:var(--amber);}
.badge-published{background:rgba(96,165,250,.12);color:var(--blue);}
.badge-scheduled{background:rgba(167,139,250,.12);color:var(--purple);}
.badge-rejected{background:rgba(239,68,68,.1);color:var(--red);}

/* Caption */
.caption-preview{font-size:11px;color:var(--muted);line-height:1.5;max-height:48px;overflow:hidden;position:relative;}
.caption-preview::after{content:'';position:absolute;bottom:0;left:0;right:0;height:20px;background:linear-gradient(transparent,var(--bg2));}

/* Schedule row */
.schedule-row{display:flex;align-items:center;gap:7px;}
.sched-label{font-size:10px;font-weight:600;letter-spacing:.4px;color:var(--muted);white-space:nowrap;}
.sched-input{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-family:inherit;font-size:11px;outline:none;transition:border-color .15s;}
.sched-input:hover{border-color:rgba(212,160,23,.3);}
.sched-input:focus{border-color:var(--gold);}
.sched-input::-webkit-calendar-picker-indicator{filter:invert(.65);cursor:pointer;}

/* Action buttons */
.card-actions{display:flex;gap:6px;margin-top:auto;}
.btn{padding:7px 10px;border-radius:6px;border:none;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;letter-spacing:.1px;white-space:nowrap;}
.btn:disabled{opacity:.38;cursor:default;}
.btn-approve{flex:1;background:rgba(34,197,94,.1);color:var(--green);border:1px solid rgba(34,197,94,.18);}
.btn-approve:not(:disabled):hover{background:rgba(34,197,94,.18);}
.btn-post-now{flex:1;background:var(--gold);color:#0A0A0A;border:1px solid var(--gold);}
.btn-post-now:hover{background:var(--gold-lt);}
.btn-schedule{flex:1;background:rgba(167,139,250,.1);color:var(--purple);border:1px solid rgba(167,139,250,.18);}
.btn-schedule:hover{background:rgba(167,139,250,.18);}
.btn-pending{background:rgba(212,160,23,.08);color:var(--amber);border:1px solid rgba(212,160,23,.15);}
.btn-pending:hover{background:rgba(212,160,23,.15);}
.btn-reject{background:rgba(239,68,68,.07);color:var(--red);border:1px solid rgba(239,68,68,.12);}
.btn-reject:hover{background:rgba(239,68,68,.14);}
.btn-save{background:var(--bg3);color:var(--muted);border:1px solid var(--border);font-size:10px;}
.btn-save:hover{background:var(--bg4);color:var(--text);}
.btn-save.saved{color:var(--green);border-color:rgba(34,197,94,.25);}

/* Published meta info */
.pub-info{font-size:10px;color:var(--muted);display:flex;flex-direction:column;gap:3px;padding:6px 8px;background:var(--bg3);border-radius:6px;}
.pub-info span{display:flex;align-items:center;gap:5px;}
.pub-info a{color:var(--blue);text-decoration:none;}
.pub-info a:hover{text-decoration:underline;}

/* Scheduled info */
.sched-info{font-size:10px;color:var(--purple);display:flex;align-items:center;gap:5px;padding:5px 8px;background:rgba(167,139,250,.06);border-radius:6px;border:1px solid rgba(167,139,250,.1);}

/* ── Instagram tab ────────────────────────────── */
.ig-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;padding:0 28px 48px;}
.ig-card{background:var(--bg2);border:1px solid var(--border);border-radius:9px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s;cursor:pointer;}
.ig-card:hover{border-color:rgba(212,160,23,.2);}
.ig-thumb{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;background:var(--bg3);}
.ig-thumb-placeholder{width:100%;aspect-ratio:4/5;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--border);}
.ig-meta{padding:10px 12px;display:flex;flex-direction:column;gap:4px;}
.ig-type{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.ig-date{font-size:10px;color:var(--muted);}
.ig-stats{display:flex;gap:10px;margin-top:2px;}
.ig-stat{font-size:10px;color:var(--muted);display:flex;align-items:center;gap:3px;}
.ig-caption-snippet{font-size:11px;color:var(--text);line-height:1.4;margin-top:3px;max-height:34px;overflow:hidden;}

/* Loading states */
.ig-loading{grid-column:1/-1;text-align:center;padding:60px 28px;color:var(--muted);font-size:14px;}
.spinner{display:inline-block;width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite;margin-right:10px;vertical-align:middle;}
@keyframes spin{to{transform:rotate(360deg)}}

/* Empty state */
.empty-state{grid-column:1/-1;text-align:center;padding:72px 28px;color:var(--muted);}
.empty-state h3{font-size:16px;margin-bottom:6px;}
.empty-state p{font-size:13px;}

/* ── Modal base ──────────────────────────────── */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:200;align-items:center;justify-content:center;padding:20px;}
.modal-overlay.open{display:flex;}
.modal{background:var(--bg2);border:1px solid var(--border);border-radius:14px;width:100%;max-width:440px;overflow:hidden;}
.modal-header{padding:18px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.modal-title{font-size:15px;font-weight:700;}
.modal-close{width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.modal-close:hover{background:var(--bg3);color:var(--text);}
.modal-body{padding:20px;}
.modal-footer{padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;}
.btn-primary{padding:8px 20px;border-radius:7px;background:var(--gold);color:#0A0A0A;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;}
.btn-primary:hover{background:var(--gold-lt);}
.btn-primary:disabled{opacity:.5;cursor:default;}
.btn-secondary{padding:8px 16px;border-radius:7px;background:transparent;color:var(--muted);border:1px solid var(--border);font-family:inherit;font-size:13px;cursor:pointer;transition:all .15s;}
.btn-secondary:hover{background:var(--bg3);color:var(--text);}

/* Post-now progress */
.log-box{background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:monospace;font-size:11px;line-height:1.8;color:var(--muted);max-height:200px;overflow-y:auto;white-space:pre-wrap;}
.log-box .ok{color:var(--green);}
.log-box .err{color:var(--red);}

/* Schedule modal extras */
.form-group{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
.form-label{font-size:11px;font-weight:600;letter-spacing:.5px;color:var(--muted);}
.form-input{background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:9px 12px;color:var(--text);font-family:inherit;font-size:13px;outline:none;width:100%;}
.form-input:focus{border-color:var(--gold);}
.form-input::-webkit-calendar-picker-indicator{filter:invert(.65);cursor:pointer;}
.form-note{font-size:11px;color:var(--muted);line-height:1.5;}

/* ── Lightbox ────────────────────────────────── */
.lb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:300;align-items:center;justify-content:center;}
.lb-overlay.open{display:flex;}
.lb{position:relative;display:flex;align-items:center;gap:18px;max-height:90vh;}
.lb-img-wrap{position:relative;height:80vh;aspect-ratio:4/5;border-radius:10px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.8);}
.lb-img-wrap img{width:100%;height:100%;object-fit:cover;}
.lb-counter{position:absolute;bottom:14px;right:14px;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;color:#fff;}
.lb-nav{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;}
.lb-nav:hover{background:rgba(255,255,255,.12);}
.lb-nav:disabled{opacity:.2;cursor:default;}
.lb-close{position:absolute;top:-48px;right:0;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.lb-close:hover{background:rgba(255,255,255,.12);}
.lb-side{max-width:260px;display:flex;flex-direction:column;gap:14px;}
.lb-title{font-size:15px;font-weight:700;line-height:1.3;}
.lb-caption{font-size:12px;color:var(--muted);line-height:1.6;max-height:180px;overflow-y:auto;white-space:pre-wrap;}
.lb-hashtags{font-size:11px;color:var(--gold);line-height:1.7;word-break:break-word;}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:11px 18px;font-size:12px;font-weight:500;color:var(--text);transform:translateY(16px);opacity:0;transition:all .22s;z-index:9999;max-width:300px;pointer-events:none;}
.toast.show{transform:translateY(0);opacity:1;}
.toast.success{border-color:rgba(34,197,94,.3);color:var(--green);}
.toast.error{border-color:rgba(239,68,68,.3);color:var(--red);}
.toast.info{border-color:rgba(96,165,250,.3);color:var(--blue);}

::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:var(--bg);}
::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px;}
</style>
</head>
<body>

<header>
  <div class="logo">
    <div class="logo-dot"></div>
    EBS Aprendiz
  </div>
  <div class="header-right">
    <div class="account-pill" id="accountPill">
      <div class="dot"></div>
      <span id="accountLabel">verificando...</span>
    </div>
  </div>
</header>

<div class="cred-banner" id="credBanner">
  ⚠️ Credenciais Meta não encontradas no <code>.env</code>. Adicione <code>META_IG_USER_ID</code> e <code>META_ACCESS_TOKEN</code> para habilitar postagem.
</div>

<div class="stats-bar">
  <div class="stat-item"><span class="stat-label">Total</span><span class="stat-value sv-total" id="sTotal">—</span></div>
  <div class="stat-item"><span class="stat-label">Aprovados</span><span class="stat-value sv-approved" id="sApproved">—</span></div>
  <div class="stat-item"><span class="stat-label">Agendados</span><span class="stat-value sv-scheduled" id="sScheduled">—</span></div>
  <div class="stat-item"><span class="stat-label">Publicados</span><span class="stat-value sv-published" id="sPublished">—</span></div>
  <div class="stat-item"><span class="stat-label">Pendentes</span><span class="stat-value sv-pending" id="sPending">—</span></div>
</div>

<div class="tabs">
  <div class="tab active" onclick="switchTab('queue',this)">📋 Fila de Conteúdo</div>
  <div class="tab" onclick="switchTab('instagram',this)">📸 Publicados no Instagram</div>
</div>

<!-- ── Tab: Fila ────────────────────────────── -->
<div id="tabQueue">
  <div class="toolbar">
    <button class="filter-btn active" onclick="setFilter('all',this)">Todos</button>
    <button class="filter-btn" onclick="setFilter('pending',this)">Pendentes</button>
    <button class="filter-btn" onclick="setFilter('approved',this)">Aprovados</button>
    <button class="filter-btn" onclick="setFilter('scheduled',this)">Agendados</button>
    <button class="filter-btn" onclick="setFilter('published',this)">Publicados</button>
    <div class="spacer"></div>
    <button class="icon-btn" onclick="loadQueue()">↻ Atualizar</button>
  </div>
  <div class="grid" id="grid"></div>
</div>

<!-- ── Tab: Instagram ───────────────────────── -->
<div id="tabInstagram" style="display:none">
  <div class="toolbar">
    <div class="spacer"></div>
    <button class="icon-btn" onclick="loadIgPosts(true)">↻ Atualizar</button>
  </div>
  <div class="ig-grid" id="igGrid">
    <div class="ig-loading"><span class="spinner"></span>Carregando posts...</div>
  </div>
</div>

<!-- ── Modal: Post Now ──────────────────────── -->
<div class="modal-overlay" id="modalPostNow">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">🚀 Postar Agora</span>
      <button class="modal-close" onclick="closeModal('modalPostNow')">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px;" id="postNowDesc"></p>
      <div class="log-box" id="postNowLog" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal('modalPostNow')" id="postNowCancelBtn">Cancelar</button>
      <button class="btn-primary" id="postNowConfirmBtn" onclick="executePostNow()">Confirmar e Publicar</button>
    </div>
  </div>
</div>

<!-- ── Modal: Agendar ───────────────────────── -->
<div class="modal-overlay" id="modalSchedule">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">📅 Preparar e Agendar via Meta</span>
      <button class="modal-close" onclick="closeModal('modalSchedule')">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:12px;color:var(--muted);margin-bottom:16px;" id="schedDesc">
        Os slides serão enviados ao Meta agora e o carrossel ficará pronto para publicar na data escolhida.
        O GitHub Actions irá publicar automaticamente no horário agendado.
      </p>
      <div class="form-group">
        <label class="form-label">Data e horário de publicação</label>
        <input type="datetime-local" class="form-input" id="schedDateTime">
        <span class="form-note">Horário local (Corbélia, BRT = UTC-3)</span>
      </div>
      <div class="log-box" id="schedLog" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal('modalSchedule')" id="schedCancelBtn">Cancelar</button>
      <button class="btn-primary" id="schedConfirmBtn" onclick="executePrepare()">Preparar Containers</button>
    </div>
  </div>
</div>

<!-- ── Lightbox ─────────────────────────────── -->
<div class="lb-overlay" id="lbOverlay" onclick="closeLbOverlay(event)">
  <div class="lb">
    <div style="position:relative">
      <button class="lb-close" onclick="closeLb()">✕</button>
      <div class="lb-img-wrap">
        <img id="lbImg" src="" alt="">
        <div class="lb-counter" id="lbCounter">1/7</div>
      </div>
    </div>
    <button class="lb-nav" id="lbPrev" onclick="lbNav(-1)">&#8249;</button>
    <button class="lb-nav" id="lbNext" onclick="lbNav(1)">&#8250;</button>
    <div class="lb-side" id="lbSide"></div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// ── State ─────────────────────────────────────
var carousels = [];
var igPosts   = [];
var filter    = 'all';
var activeTab = 'queue';
var hasCredentials = false;
var postNowId  = null;
var scheduleId = null;
var lbSlides = [];
var lbIdx    = 0;

// ── Init ──────────────────────────────────────
(function init() {
  checkSettings();
  loadQueue();
})();

// ── Settings ──────────────────────────────────
function checkSettings() {
  fetch('/api/settings').then(function(r){return r.json();}).then(function(s){
    hasCredentials = s.hasCredentials;
    var pill = document.getElementById('accountPill');
    var lbl  = document.getElementById('accountLabel');
    if (s.hasCredentials) {
      pill.classList.add('ok');
      lbl.textContent = '@aprendiz.ebs';
      loadAccountInfo();
    } else {
      lbl.textContent = 'sem credenciais';
      document.getElementById('credBanner').classList.add('show');
    }
  }).catch(function(){});
}

function loadAccountInfo() {
  fetch('/api/ig/account').then(function(r){return r.json();}).then(function(d){
    if (d.username) {
      var lbl = document.getElementById('accountLabel');
      lbl.textContent = '@' + d.username + (d.followers_count ? ' · ' + fmtNum(d.followers_count) + ' seguidores' : '');
    }
  }).catch(function(){});
}

// ── Tabs ──────────────────────────────────────
function switchTab(tab, el) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  document.getElementById('tabQueue').style.display     = tab === 'queue'     ? '' : 'none';
  document.getElementById('tabInstagram').style.display = tab === 'instagram' ? '' : 'none';
  if (tab === 'instagram' && igPosts.length === 0) loadIgPosts(false);
}

// ── Queue ─────────────────────────────────────
function loadQueue() {
  fetch('/api/queue').then(function(r){return r.json();}).then(function(d){
    carousels = d.carousels || [];
    updateStats();
    renderGrid();
  }).catch(function(e){ showToast('Erro ao carregar fila', 'error'); });
}

function updateStats() {
  var total     = carousels.length;
  var approved  = carousels.filter(function(c){return c.status==='approved';}).length;
  var scheduled = carousels.filter(function(c){return c.status==='scheduled';}).length;
  var published = carousels.filter(function(c){return c.status==='published';}).length;
  var pending   = carousels.filter(function(c){return !c.status||c.status==='pending';}).length;
  document.getElementById('sTotal').textContent     = total;
  document.getElementById('sApproved').textContent  = approved;
  document.getElementById('sScheduled').textContent = scheduled;
  document.getElementById('sPublished').textContent = published;
  document.getElementById('sPending').textContent   = pending;
}

function setFilter(f, el) {
  filter = f;
  document.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('active');});
  if (el) el.classList.add('active');
  renderGrid();
}

function renderGrid() {
  var grid = document.getElementById('grid');
  var list = filter === 'all' ? carousels
    : carousels.filter(function(c){return (c.status||'pending')===filter;});

  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><h3>Nenhum carrossel</h3><p>Mude o filtro ou adicione conteúdo ao queue.json.</p></div>';
    return;
  }
  grid.innerHTML = list.map(renderCard).join('');
}

function renderCard(c) {
  var status = c.status || 'pending';
  var badgeClass = {approved:'badge-approved',pending:'badge-pending',published:'badge-published',scheduled:'badge-scheduled',rejected:'badge-rejected'}[status] || 'badge-pending';
  var badgeLabel = {approved:'Aprovado',pending:'Pendente',published:'Publicado',scheduled:'Agendado',rejected:'Rejeitado'}[status] || status;

  var slides = c.slides || [];
  var thumbs = slides.slice(0,4).map(function(s){
    return '<img src="/'+s+'" alt="" onerror="this.style.display=\'none\'">';
  }).join('');

  var captionText = (c.caption||'').replace(/\\n/g,' ').substring(0,110);
  var schedVal = c.scheduled_for
    ? (c.scheduled_for.includes('T') ? c.scheduled_for.substring(0,16) : c.scheduled_for+'T09:00')
    : '';

  var isPublished = status === 'published';
  var isScheduled = status === 'scheduled';
  var isApproved  = status === 'approved';
  var isPending   = status === 'pending' || !status;

  var actionsHtml = '';

  if (isPublished) {
    actionsHtml = '<div class="pub-info">'
      + '<span>📅 ' + (c.published_at ? c.published_at.substring(0,10) : '—') + '</span>'
      + (c.meta_post_id ? '<span>🔗 Post ID: '+c.meta_post_id+'</span>' : '')
      + '<button class="btn btn-pending" style="margin-top:4px;font-size:10px;" onclick="setStatus(\''+c.id+'\',\'pending\')">Resetar para pendente</button>'
      + '</div>';
  } else if (isScheduled) {
    actionsHtml = '<div class="sched-info">📅 Agendado: ' + (schedVal ? schedVal.replace('T',' ') : c.scheduled_for || '?') + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:4px;">'
      + '<button class="btn btn-post-now" onclick="openPostNow(\''+c.id+'\')">🚀 Publicar agora</button>'
      + '<button class="btn btn-pending" onclick="setStatus(\''+c.id+'\',\'pending\')">↩</button>'
      + '</div>';
  } else if (isApproved) {
    actionsHtml = '<div class="schedule-row">'
      + '<span class="sched-label">Agendar</span>'
      + '<input type="datetime-local" class="sched-input" id="sd-'+c.id+'" value="'+schedVal+'">'
      + '<button class="btn btn-save" id="sdb-'+c.id+'" onclick="saveScheduleLocal(\''+c.id+'\')">OK</button>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-post-now" onclick="openPostNow(\''+c.id+'\')">🚀 Postar Agora</button>'
      + '<button class="btn btn-schedule" onclick="openScheduleModal(\''+c.id+'\')">📅 Agendar</button>'
      + '<button class="btn btn-pending" title="Voltar a pendente" onclick="setStatus(\''+c.id+'\',\'pending\')">↩</button>'
      + '</div>';
  } else {
    // pending / rejected
    actionsHtml = '<div class="schedule-row">'
      + '<span class="sched-label">Agendar</span>'
      + '<input type="datetime-local" class="sched-input" id="sd-'+c.id+'" value="'+schedVal+'">'
      + '<button class="btn btn-save" id="sdb-'+c.id+'" onclick="saveScheduleLocal(\''+c.id+'\')">OK</button>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-approve" onclick="setStatus(\''+c.id+'\',\'approved\')">✓ Aprovar</button>'
      + '<button class="btn btn-reject" title="Rejeitar" onclick="setStatus(\''+c.id+'\',\'rejected\')">✕</button>'
      + '</div>';
  }

  return '<div class="card status-'+status+'" id="card-'+c.id+'">'
    + '<div class="thumb-strip" onclick="openLb(\''+c.id+'\')">'
    + thumbs
    + '<div class="thumb-overlay"><span class="preview-icon">⊙</span></div>'
    + '<span class="slide-badge">'+slides.length+' slides</span>'
    + '</div>'
    + '<div class="card-body">'
    + '<div class="card-top"><div><div class="card-id">'+c.id+'</div><div class="card-title">'+(c.title||'Sem título')+'</div></div>'
    + '<span class="badge '+badgeClass+'">'+badgeLabel+'</span></div>'
    + '<div class="caption-preview">'+captionText+'</div>'
    + actionsHtml
    + '</div></div>';
}

// ── Status actions ────────────────────────────
function setStatus(id, status) {
  fetch('/api/carousel/'+encodeURIComponent(id), {
    method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({status:status})
  }).then(function(r){return r.json();}).then(function(d){
    if (d.error) throw new Error(d.error);
    var idx = carousels.findIndex(function(c){return c.id===id;});
    if (idx!==-1) Object.assign(carousels[idx], d.carousel);
    updateStats(); renderGrid();
    var labels = {approved:'Aprovado ✓',pending:'Pendente',rejected:'Rejeitado'};
    showToast(labels[status]||status, 'success');
  }).catch(function(e){ showToast('Erro: '+e.message,'error'); });
}

function saveScheduleLocal(id) {
  var input = document.getElementById('sd-'+id);
  var btn   = document.getElementById('sdb-'+id);
  if (!input) return;
  fetch('/api/carousel/'+encodeURIComponent(id), {
    method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({scheduled_for: input.value || null})
  }).then(function(r){return r.json();}).then(function(d){
    if (d.error) throw new Error(d.error);
    var idx = carousels.findIndex(function(c){return c.id===id;});
    if (idx!==-1) carousels[idx].scheduled_for = input.value || null;
    if (btn){btn.classList.add('saved');btn.textContent='✓';}
    showToast('Data salva no queue.json', 'success');
  }).catch(function(e){ showToast('Erro: '+e.message,'error'); });
}

// ── Post Now modal ────────────────────────────
function openPostNow(id) {
  postNowId = id;
  var c = carousels.find(function(x){return x.x===id;})||carousels.find(function(x){return x.id===id;});
  var title = c ? c.title : id;
  document.getElementById('postNowDesc').textContent = 'Publicar "'+title+'" agora no @aprendiz.ebs?';
  document.getElementById('postNowLog').style.display = 'none';
  document.getElementById('postNowLog').innerHTML = '';
  document.getElementById('postNowConfirmBtn').disabled = false;
  document.getElementById('postNowConfirmBtn').textContent = 'Confirmar e Publicar';
  document.getElementById('postNowCancelBtn').textContent = 'Cancelar';
  document.getElementById('modalPostNow').classList.add('open');
}

function executePostNow() {
  if (!postNowId) return;
  var logBox = document.getElementById('postNowLog');
  var btn    = document.getElementById('postNowConfirmBtn');
  var cancelBtn = document.getElementById('postNowCancelBtn');

  btn.disabled = true;
  btn.textContent = 'Publicando...';
  logBox.style.display = 'block';
  logBox.innerHTML = '<span class="spinner"></span> Iniciando...\\n';

  fetch('/api/carousel/'+encodeURIComponent(postNowId)+'/post-now', {method:'POST'})
    .then(function(r){return r.json();})
    .then(function(d){
      if (d.logs) {
        logBox.innerHTML = d.logs.map(function(l){
          if (l.includes('✅')||l.includes('ok')) return '<span class="ok">'+esc(l)+'</span>';
          if (l.includes('❌')||l.includes('Erro')) return '<span class="err">'+esc(l)+'</span>';
          return esc(l);
        }).join('\\n');
      }
      if (d.error) {
        logBox.innerHTML += '\\n<span class="err">❌ '+esc(d.error)+'</span>';
        btn.disabled = false; btn.textContent = 'Tentar novamente';
        showToast('Erro ao publicar: '+d.error, 'error');
        return;
      }
      logBox.innerHTML += '\\n<span class="ok">✅ Post ID: '+esc(d.postId)+'</span>';
      btn.textContent = 'Fechar';
      btn.disabled = false;
      btn.onclick = function(){ closeModal('modalPostNow'); };
      cancelBtn.style.display = 'none';
      // Atualiza o carrossel local
      var idx = carousels.findIndex(function(c){return c.id===postNowId;});
      if (idx!==-1){
        carousels[idx].status='published';
        carousels[idx].published_at=new Date().toISOString();
        carousels[idx].meta_post_id=d.postId;
      }
      updateStats(); renderGrid();
      showToast('Publicado com sucesso! 🎉','success');
    })
    .catch(function(e){
      logBox.innerHTML += '\\n<span class="err">❌ '+esc(e.message)+'</span>';
      btn.disabled = false; btn.textContent = 'Tentar novamente';
      showToast('Erro de conexão','error');
    });
}

// ── Schedule modal ────────────────────────────
function openScheduleModal(id) {
  scheduleId = id;
  var c = carousels.find(function(x){return x.id===id;});
  var defaultDt = '';
  if (c && c.scheduled_for) {
    defaultDt = c.scheduled_for.includes('T') ? c.scheduled_for.substring(0,16) : c.scheduled_for+'T09:00';
  } else {
    var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    tomorrow.setHours(9,0,0,0);
    defaultDt = tomorrow.toISOString().substring(0,16);
  }
  document.getElementById('schedDateTime').value = defaultDt;
  document.getElementById('schedLog').style.display = 'none';
  document.getElementById('schedLog').innerHTML = '';
  document.getElementById('schedConfirmBtn').disabled = false;
  document.getElementById('schedConfirmBtn').textContent = 'Preparar Containers';
  document.getElementById('schedCancelBtn').textContent = 'Cancelar';
  document.getElementById('modalSchedule').classList.add('open');
}

function executePrepare() {
  if (!scheduleId) return;
  var dt  = document.getElementById('schedDateTime').value;
  if (!dt) { showToast('Selecione uma data e horário','error'); return; }

  var logBox = document.getElementById('schedLog');
  var btn    = document.getElementById('schedConfirmBtn');
  var cancelBtn = document.getElementById('schedCancelBtn');

  btn.disabled = true;
  btn.textContent = 'Enviando ao Meta...';
  logBox.style.display = 'block';
  logBox.innerHTML = '<span class="spinner"></span> Criando containers no Meta...\\n';

  fetch('/api/carousel/'+encodeURIComponent(scheduleId)+'/prepare', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({scheduled_for: dt})
  })
    .then(function(r){return r.json();})
    .then(function(d){
      if (d.logs) {
        logBox.innerHTML = d.logs.map(function(l){
          if (l.includes('✅')||l.includes('container_id')) return '<span class="ok">'+esc(l)+'</span>';
          if (l.includes('❌')) return '<span class="err">'+esc(l)+'</span>';
          return esc(l);
        }).join('\\n');
      }
      if (d.error) {
        logBox.innerHTML += '\\n<span class="err">❌ '+esc(d.error)+'</span>';
        btn.disabled = false; btn.textContent = 'Tentar novamente';
        showToast('Erro: '+d.error,'error');
        return;
      }
      logBox.innerHTML += '\\n<span class="ok">✅ Container ID: '+esc(d.containerId)+'</span>';
      logBox.innerHTML += '\\n<span class="ok">📅 Agendado para: '+dt.replace('T',' ')+'</span>';
      btn.textContent = 'Fechar';
      btn.disabled = false;
      btn.onclick = function(){ closeModal('modalSchedule'); };
      cancelBtn.style.display = 'none';
      var idx = carousels.findIndex(function(c){return c.id===scheduleId;});
      if (idx!==-1){
        carousels[idx].status='scheduled';
        carousels[idx].scheduled_for=dt;
        carousels[idx].meta_container_id=d.containerId;
      }
      updateStats(); renderGrid();
      showToast('Agendado! O GitHub Actions publica no horário.','info');
    })
    .catch(function(e){
      logBox.innerHTML += '\\n<span class="err">❌ '+esc(e.message)+'</span>';
      btn.disabled = false; btn.textContent = 'Tentar novamente';
      showToast('Erro de conexão','error');
    });
}

// ── Instagram posts ───────────────────────────
function loadIgPosts(forceRefresh) {
  var grid = document.getElementById('igGrid');
  if (igPosts.length && !forceRefresh) { renderIgGrid(); return; }
  grid.innerHTML = '<div class="ig-loading"><span class="spinner"></span>Buscando posts no Instagram...</div>';

  fetch('/api/ig/posts').then(function(r){return r.json();}).then(function(d){
    if (d.error) throw new Error(d.error);
    igPosts = d.data || [];
    renderIgGrid();
  }).catch(function(e){
    grid.innerHTML = '<div class="empty-state"><h3>Erro ao buscar posts</h3><p>'+esc(e.message)+'</p></div>';
  });
}

function renderIgGrid() {
  var grid = document.getElementById('igGrid');
  if (!igPosts.length) {
    grid.innerHTML = '<div class="empty-state"><h3>Nenhum post encontrado</h3><p>A conta ainda não tem posts ou as credenciais são inválidas.</p></div>';
    return;
  }
  grid.innerHTML = igPosts.map(function(p){
    var imgUrl = p.media_url || p.thumbnail_url || '';
    var thumb = imgUrl
      ? '<img class="ig-thumb" src="'+imgUrl+'" alt="" onerror="this.parentNode.innerHTML=\'<div class=ig-thumb-placeholder>🖼️</div>\'">'
      : '<div class="ig-thumb-placeholder">🖼️</div>';
    var dt = p.timestamp ? new Date(p.timestamp).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    var typeLabel = {CAROUSEL_ALBUM:'Carrossel',IMAGE:'Imagem',VIDEO:'Vídeo'}[p.media_type] || p.media_type || '—';
    var caption = (p.caption||'').substring(0,60) + ((p.caption||'').length>60?'…':'');
    var permalink = p.permalink ? ' <a href="'+p.permalink+'" target="_blank" style="color:var(--blue);font-size:10px;text-decoration:none;">↗ Ver</a>' : '';
    return '<div class="ig-card" onclick="'+(p.permalink?'window.open(\''+p.permalink+'\',\'_blank\')':'')+'"">'
      + thumb
      + '<div class="ig-meta">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;">'
      + '<span class="ig-type">'+typeLabel+'</span>'+permalink+'</div>'
      + '<span class="ig-date">'+dt+'</span>'
      + '<div class="ig-stats">'
      + (p.like_count!=null?'<span class="ig-stat">❤️ '+fmtNum(p.like_count)+'</span>':'')
      + (p.comments_count!=null?'<span class="ig-stat">💬 '+fmtNum(p.comments_count)+'</span>':'')
      + '</div>'
      + (caption?'<div class="ig-caption-snippet">'+esc(caption)+'</div>':'')
      + '</div></div>';
  }).join('');
}

// ── Lightbox ──────────────────────────────────
function openLb(id) {
  var c = carousels.find(function(x){return x.id===id;});
  if (!c || !c.slides || !c.slides.length) return;
  lbSlides = c.slides; lbIdx = 0;
  document.getElementById('lbSide').innerHTML =
    '<div class="lb-title">'+(c.title||c.id)+'</div>'
    + '<div class="lb-caption">'+(c.caption||'').replace(/\\\\n/g,'\\n')+'</div>'
    + '<div class="lb-hashtags">'+(c.hashtags||'')+'</div>';
  document.getElementById('lbOverlay').classList.add('open');
  updateLb();
  document.addEventListener('keydown', lbKey);
}
function updateLb() {
  document.getElementById('lbImg').src = '/'+lbSlides[lbIdx];
  document.getElementById('lbCounter').textContent = (lbIdx+1)+' / '+lbSlides.length;
  document.getElementById('lbPrev').disabled = lbIdx===0;
  document.getElementById('lbNext').disabled = lbIdx===lbSlides.length-1;
}
function lbNav(d) { lbIdx=Math.max(0,Math.min(lbSlides.length-1,lbIdx+d)); updateLb(); }
function lbKey(e) { if(e.key==='ArrowLeft')lbNav(-1);if(e.key==='ArrowRight')lbNav(1);if(e.key==='Escape')closeLb(); }
function closeLbOverlay(e) { if(e.target===document.getElementById('lbOverlay'))closeLb(); }
function closeLb() { document.getElementById('lbOverlay').classList.remove('open'); document.removeEventListener('keydown',lbKey); }

// ── Modal helpers ─────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // Reset post-now button
  if (id==='modalPostNow') {
    var btn = document.getElementById('postNowConfirmBtn');
    btn.onclick = executePostNow; btn.disabled = false; btn.textContent = 'Confirmar e Publicar';
    document.getElementById('postNowCancelBtn').style.display='';
  }
  if (id==='modalSchedule') {
    var btn2 = document.getElementById('schedConfirmBtn');
    btn2.onclick = executePrepare; btn2.disabled = false; btn2.textContent = 'Preparar Containers';
    document.getElementById('schedCancelBtn').style.display='';
  }
}

// ── Helpers ───────────────────────────────────
function fmtNum(n) { return n>=1000?(n/1000).toFixed(1)+'k':n; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

var toastTimer;
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show'+(type?' '+type:'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3200);
}
</script>
</body>
</html>`;

// ─────────────────────────────────────────
// HTTP Server
// ─────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');

  // Dashboard HTML
  if (method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // Settings
  if (method === 'GET' && pathname === '/api/settings') { handleGetSettings(res); return; }

  // Queue
  if (method === 'GET' && pathname === '/api/queue') { handleGetQueue(res); return; }

  // Carousel PATCH
  const patchMatch = method === 'PATCH' && pathname.match(/^\/api\/carousel\/(.+)$/);
  if (patchMatch) { await handlePatchCarousel(req, res, decodeURIComponent(patchMatch[1])); return; }

  // Post Now
  const postNowMatch = method === 'POST' && pathname.match(/^\/api\/carousel\/(.+)\/post-now$/);
  if (postNowMatch) { await handlePostNow(req, res, decodeURIComponent(postNowMatch[1])); return; }

  // Prepare (schedule)
  const prepareMatch = method === 'POST' && pathname.match(/^\/api\/carousel\/(.+)\/prepare$/);
  if (prepareMatch) { await handlePrepare(req, res, decodeURIComponent(prepareMatch[1])); return; }

  // Instagram posts
  if (method === 'GET' && pathname === '/api/ig/posts') { await handleGetIgPosts(res); return; }

  // Account info
  if (method === 'GET' && pathname === '/api/ig/account') { await handleGetAccountInfo(res); return; }

  // Slide images
  if (method === 'GET' && pathname.startsWith('/slides/')) { handleServeSlide(req, res, pathname); return; }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  const credStatus = (IG_USER_ID && ACCESS_TOKEN) ? '✅ Credenciais Meta OK' : '⚠️  Sem credenciais Meta (.env)';
  const gitStatus  = GITHUB_REPO ? `✅ ${GITHUB_REPO} (${GITHUB_REF})` : '⚠️  Git repo não detectado';
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║   EBS Aprendiz — Dashboard v2         ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');
  console.log('  🌐  http://localhost:' + PORT);
  console.log('  ' + credStatus);
  console.log('  ' + gitStatus);
  console.log('');
  console.log('  Ctrl+C para encerrar');
  console.log('');
});
