const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// Importar meta-api
const meta = require('./meta-api');

const PORT = 3000;
const BASE_DIR = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(BASE_DIR, 'queue.json');

// Carregar .env
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
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  } catch (e) {
    return { carousels: [] };
  }
}

function writeQueue(data) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(data, null, 2) + '\n');
}

function jsonRes(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/api/queue' && req.method === 'GET') {
    const queue = readQueue();
    jsonRes(res, queue);
    return;
  }

  if (req.url === '/api/settings' && req.method === 'GET') {
    jsonRes(res, {
      hasCredentials: true,
      igUserId: '1234...5678',
      githubRepo: 'ebsmusicfirst/ebs-aprendiz',
      githubRef: 'master'
    });
    return;
  }

  // PATCH carousel status
  if (req.url.startsWith('/api/carousel/') && req.method === 'PATCH') {
    const id = req.url.substring(14);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        const queue = readQueue();
        const idx = queue.carousels.findIndex(c => c.id === id);
        if (idx === -1) {
          jsonRes(res, { error: 'Not found' }, 404);
          return;
        }
        if (update.status) queue.carousels[idx].status = update.status;
        if (update.scheduled_for) queue.carousels[idx].scheduled_for = update.scheduled_for;
        writeQueue(queue);
        jsonRes(res, { ok: true, carousel: queue.carousels[idx] });
      } catch (e) {
        jsonRes(res, { error: e.message }, 400);
      }
    });
    return;
  }

  // POST carousel publish (Meta Graph API)
  if (req.url.startsWith('/api/carousel/') && req.url.endsWith('/publish') && req.method === 'POST') {
    const id = req.url.substring(14, req.url.length - 8);

    if (!IG_USER_ID || !ACCESS_TOKEN) {
      jsonRes(res, { error: 'Credenciais Meta não configuradas no .env' }, 400);
      return;
    }

    (async () => {
      try {
        const queue = readQueue();
        const carousel = queue.carousels.find(c => c.id === id);
        if (!carousel) {
          jsonRes(res, { error: 'Carrossel não encontrado' }, 404);
          return;
        }

        const logs = [];
        const log = (msg) => { console.log(msg); logs.push(msg); };

        log(`🚀 Publicando carrossel: ${carousel.id}`);

        const result = await meta.postCarouselNow(
          carousel, IG_USER_ID, ACCESS_TOKEN, GIT.repo, GIT.ref, log
        );

        carousel.status = 'published';
        carousel.published_at = new Date().toISOString();
        carousel.meta_post_id = result.postId;
        writeQueue(queue);

        log(`✅ Publicado com sucesso! Post ID: ${result.postId}`);
        jsonRes(res, { ok: true, postId: result.postId, logs });
      } catch (err) {
        console.error(err);
        jsonRes(res, { error: err.message, logs: [err.message] }, 500);
      }
    })();
    return;
  }

  // Serve carousel HTML files
  if (req.url.startsWith('/carousel/')) {
    const carouselId = req.url.substring(10);
    const carouselPath = path.join(BASE_DIR, 'carrosseis', carouselId + '.html');
    if (fs.existsSync(carouselPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(carouselPath, 'utf-8'));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Serve dashboard HTML
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>EBS Aprendiz — Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0A0A0A;
      color: #F0EDE8;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
    }
    header { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 20px 28px; display: flex; align-items: center; gap: 10px; }
    .logo { font-weight: 700; font-size: 14px; }
    .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: #D4A017; }
    .stats-bar { display: flex; gap: 1px; background: rgba(255,255,255,0.07); border-bottom: 1px solid rgba(255,255,255,0.07); }
    .stat-item { flex: 1; padding: 14px 20px; background: #141414; display: flex; flex-direction: column; gap: 5px; }
    .stat-label { font-size: 9px; font-weight: 700; color: rgba(240,237,232,0.5); }
    .stat-value { font-size: 20px; font-weight: 700; }
    .toolbar { padding: 16px 28px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .btn { padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(240,237,232,0.7); cursor: pointer; font-size: 11px; font-weight: 600; }
    .btn:hover { background: rgba(255,255,255,0.05); }
    .btn.active { background: #D4A017; color: #0A0A0A; border-color: #D4A017; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; padding: 0 28px 48px; }
    .card { background: #141414; border: 1px solid rgba(255,255,255,0.07); border-radius: 11px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    .card-id { font-size: 10px; color: rgba(240,237,232,0.4); font-weight: 600; text-transform: uppercase; }
    .card-title { font-size: 13px; font-weight: 600; }
    .card-status { font-size: 9px; padding: 3px 9px; border-radius: 20px; width: fit-content; font-weight: 600; }
    .status-pending { background: rgba(212,160,23,0.15); color: #D4A017; }
    .status-published { background: rgba(96,165,250,0.15); color: #60a5fa; }
    .status-approved { background: rgba(34,197,94,0.15); color: #22c55e; }
    .status-scheduled { background: rgba(167,139,250,0.15); color: #a78bfa; }
    .card-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
    .action-btn { padding: 7px 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1); background: rgba(212,160,23,0.1); color: #D4A017; cursor: pointer; font-size: 10px; font-weight: 600; transition: all 0.2s; }
    .action-btn:hover { background: rgba(212,160,23,0.2); transform: translateY(-1px); }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .action-btn.publish { background: rgba(60,165,250,0.1); color: #60a5fa; }
    .action-btn.publish:hover { background: rgba(60,165,250,0.2); }
    .action-btn.approve { background: rgba(34,197,94,0.1); color: #22c55e; }
    .action-btn.approve:hover { background: rgba(34,197,94,0.2); }
    .empty { grid-column: 1/-1; text-align: center; padding: 60px 28px; color: rgba(240,237,232,0.4); }

    /* Modal */
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; }
    .modal.open { display: flex; }
    .modal-content { background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 11px; padding: 24px; max-width: 400px; width: 90%; }
    .modal-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
    .modal-desc { font-size: 13px; color: rgba(240,237,232,0.7); line-height: 1.6; margin-bottom: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .form-label { font-size: 11px; font-weight: 600; color: rgba(240,237,232,0.6); }
    .form-input { background: #0A0A0A; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px; color: #F0EDE8; font-size: 13px; font-family: inherit; }
    .form-input:focus { outline: none; border-color: #D4A017; }
    .modal-actions { display: flex; gap: 8px; }
    .btn-confirm { flex: 1; padding: 10px; border-radius: 6px; background: #D4A017; color: #0A0A0A; border: none; cursor: pointer; font-size: 12px; font-weight: 600; }
    .btn-confirm:hover { background: #E8B82D; }
    .btn-cancel { flex: 1; padding: 10px; border-radius: 6px; background: rgba(255,255,255,0.1); color: #F0EDE8; border: none; cursor: pointer; font-size: 12px; font-weight: 600; }
    .btn-cancel:hover { background: rgba(255,255,255,0.15); }

    /* Toast */
    .toast { position: fixed; bottom: 24px; right: 24px; background: #1E1E1E; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #F0EDE8; z-index: 2000; opacity: 0; transform: translateY(20px); transition: all 0.3s; }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.success { border-color: rgba(34,197,94,0.3); color: #22c55e; }
    .toast.error { border-color: rgba(239,68,68,0.3); color: #ef4444; }

    /* Lightbox */
    .lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 1500; align-items: center; justify-content: center; }
    .lightbox.open { display: flex; }
    .lightbox-content { position: relative; width: 90%; max-width: 500px; }
    .lightbox iframe { width: 100%; height: 90vh; border: none; border-radius: 8px; }
    .lightbox-close { position: absolute; top: -40px; right: 0; width: 30px; height: 30px; background: rgba(255,255,255,0.1); border: none; border-radius: 50%; color: #F0EDE8; cursor: pointer; font-size: 18px; }
    .lightbox-close:hover { background: rgba(255,255,255,0.2); }
  </style>
</head>
<body>

<header>
  <div class="logo-dot"></div>
  <div class="logo">EBS Aprendiz — Dashboard</div>
</header>

<div class="stats-bar">
  <div class="stat-item"><span class="stat-label">TOTAL</span><span class="stat-value" id="sTotal">—</span></div>
  <div class="stat-item"><span class="stat-label">PENDENTES</span><span class="stat-value" id="sPending">—</span></div>
  <div class="stat-item"><span class="stat-label">APROVADOS</span><span class="stat-value" id="sApproved">—</span></div>
  <div class="stat-item"><span class="stat-label">AGENDADOS</span><span class="stat-value" id="sScheduled">—</span></div>
  <div class="stat-item"><span class="stat-label">PUBLICADOS</span><span class="stat-value" id="sPublished">—</span></div>
</div>

<div class="toolbar">
  <button class="btn active" onclick="setFilter('all', this)">Todos</button>
  <button class="btn" onclick="setFilter('pending', this)">Pendentes</button>
  <button class="btn" onclick="setFilter('approved', this)">Aprovados</button>
  <button class="btn" onclick="setFilter('scheduled', this)">Agendados</button>
  <button class="btn" onclick="setFilter('published', this)">Publicados</button>
  <div style="flex: 1;"></div>
  <button class="btn" onclick="loadQueue()">↻ Atualizar</button>
</div>

<div class="grid" id="grid"></div>

<!-- Modals -->
<div class="modal" id="modalConfirm">
  <div class="modal-content">
    <div class="modal-title" id="confirmTitle"></div>
    <div class="modal-desc" id="confirmDesc"></div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal('modalConfirm')">Cancelar</button>
      <button class="btn-confirm" id="confirmBtn" onclick="executeConfirm()">Confirmar</button>
    </div>
  </div>
</div>

<div class="modal" id="modalSchedule">
  <div class="modal-content">
    <div class="modal-title">📅 Agendar Publicação</div>
    <div class="modal-desc" id="schedDesc"></div>
    <div class="form-group">
      <label class="form-label">Data e hora de publicação</label>
      <input type="datetime-local" class="form-input" id="schedDateTime">
      <small style="color: rgba(240,237,232,0.4); font-size: 10px;">Horário sugerido: 19:00 BRT (Corbélia-PR)</small>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal('modalSchedule')">Cancelar</button>
      <button class="btn-confirm" onclick="confirmSchedule()">Agendar</button>
    </div>
  </div>
</div>

<div class="lightbox" id="lightboxPreview">
  <div class="lightbox-content">
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

function loadQueue() {
  fetch('/api/queue').then(r => r.json()).then(d => {
    carousels = d.carousels || [];
    updateStats();
    renderGrid();
  }).catch(e => showToast('Erro ao carregar: ' + e.message, 'error'));
}

function updateStats() {
  const total = carousels.length;
  const pending = carousels.filter(c => !c.status || c.status === 'pending').length;
  const approved = carousels.filter(c => c.status === 'approved').length;
  const scheduled = carousels.filter(c => c.status === 'scheduled').length;
  const published = carousels.filter(c => c.status === 'published').length;
  document.getElementById('sTotal').textContent = total;
  document.getElementById('sPending').textContent = pending;
  document.getElementById('sApproved').textContent = approved;
  document.getElementById('sScheduled').textContent = scheduled;
  document.getElementById('sPublished').textContent = published;
}

function renderGrid() {
  const list = filter === 'all' ? carousels : carousels.filter(c => (c.status || 'pending') === filter);
  const grid = document.getElementById('grid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty">Nenhum carrossel encontrado</div>';
    return;
  }

  grid.innerHTML = list.map(c => {
    const status = c.status || 'pending';
    return \`
      <div class="card">
        <div style="display: flex; justify-content: space-between;">
          <div><div class="card-id">\${c.id}</div><div class="card-title">\${c.title}</div></div>
          <div class="card-status status-\${status}">\${status}</div>
        </div>
        <div class="card-actions">
          \${status === 'pending' ? \`<button class="action-btn approve" onclick="openApprove('\${c.id}')">✓ Aprovar</button>\` : '<div></div>'}
          \${['pending', 'approved', 'scheduled'].includes(status) ? \`<button class="action-btn publish" onclick="openSchedule('\${c.id}')">📅 Agendar</button>\` : '<div></div>'}
          <button class="action-btn" onclick="openPreview('\${c.id}')">👁️ Ver</button>
          \${['pending', 'approved', 'scheduled'].includes(status) ? \`<button class="action-btn publish" onclick="openPublish('\${c.id}')">🚀 Publicar</button>\` : '<div></div>'}
        </div>
        \${c.scheduled_for ? \`<div style="font-size: 10px; color: #a78bfa; margin-top: 4px;">📅 \${c.scheduled_for.substring(0,16).replace('T', ' ')}</div>\` : ''}
      </div>
    \`;
  }).join('');
}

function setFilter(f, el) {
  filter = f;
  document.querySelectorAll('.toolbar .btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderGrid();
}

function openPreview(id) {
  currentId = id;
  document.getElementById('previewFrame').src = '/carousel/' + id;
  document.getElementById('lightboxPreview').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightboxPreview').classList.remove('open');
}

function openApprove(id) {
  currentId = id;
  const c = carousels.find(x => x.id === id);
  document.getElementById('confirmTitle').textContent = '✓ Aprovar Carrossel';
  document.getElementById('confirmDesc').textContent = 'Aprovar: ' + c.title;
  confirmAction = () => updateStatus('approved');
  document.getElementById('modalConfirm').classList.add('open');
}

function openSchedule(id) {
  currentId = id;
  const c = carousels.find(x => x.id === id);
  document.getElementById('schedDesc').textContent = 'Agendar: ' + c.title;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);
  document.getElementById('schedDateTime').value = tomorrow.toISOString().substring(0, 16);
  document.getElementById('modalSchedule').classList.add('open');
}

function openPublish(id) {
  currentId = id;
  const c = carousels.find(x => x.id === id);
  document.getElementById('confirmTitle').textContent = '🚀 Publicar Agora';
  document.getElementById('confirmDesc').textContent = 'Publicar: ' + c.title + '\\n⚠️ O carrossel será enviado ao Instagram imediatamente.';
  confirmAction = () => publishToInstagram();
  document.getElementById('modalConfirm').classList.add('open');
}

function publishToInstagram() {
  if (!currentId) return;

  fetch('/api/carousel/' + encodeURIComponent(currentId) + '/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
  .then(r => r.json())
  .then(d => {
    if (d.error) throw new Error(d.error);
    const idx = carousels.findIndex(c => c.id === currentId);
    if (idx !== -1) {
      carousels[idx].status = 'published';
      carousels[idx].published_at = new Date().toISOString();
      carousels[idx].meta_post_id = d.postId;
    }
    updateStats();
    renderGrid();
    showToast('✅ Publicado no @aprendiz.ebs! Post ID: ' + d.postId, 'success');
  })
  .catch(e => showToast('❌ Erro ao publicar: ' + e.message, 'error'));
}

function confirmSchedule() {
  const dt = document.getElementById('schedDateTime').value;
  if (!dt) { showToast('Selecione uma data e hora', 'error'); return; }
  updateStatus('scheduled', dt);
  closeModal('modalSchedule');
}

function executeConfirm() {
  if (confirmAction) confirmAction();
  closeModal('modalConfirm');
}

function updateStatus(status, scheduled_for = null) {
  const btn = document.querySelector('.action-btn');
  if (btn) btn.disabled = true;

  const body = { status };
  if (scheduled_for) body.scheduled_for = scheduled_for;

  fetch('/api/carousel/' + encodeURIComponent(currentId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(r => r.json())
  .then(d => {
    if (d.error) throw new Error(d.error);
    const idx = carousels.findIndex(c => c.id === currentId);
    if (idx !== -1) carousels[idx] = d.carousel;
    updateStats();
    renderGrid();
    showToast('✅ Atualizado com sucesso!', 'success');
  })
  .catch(e => showToast('❌ Erro: ' + e.message, 'error'));
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

loadQueue();
setInterval(loadQueue, 5000);
</script>

</body>
</html>`);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log('  ║  EBS Aprendiz — Dashboard (FINAL)      ║');
  console.log('  ║  ✅ QA + Agendamento + Visualização    ║');
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');
  console.log('  🌐 http://localhost:' + PORT);
  console.log('');
});
