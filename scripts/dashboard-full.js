const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BASE_DIR = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(BASE_DIR, 'queue.json');

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
    html, body { width: 100%; height: 100%; }
    body {
      background: #0A0A0A;
      color: #F0EDE8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100vh;
    }
    header {
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding: 20px 28px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo { font-weight: 700; font-size: 14px; }
    .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: #D4A017; }
    .stats-bar {
      display: flex;
      gap: 1px;
      background: rgba(255,255,255,0.07);
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .stat-item {
      flex: 1;
      padding: 14px 20px;
      background: #141414;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .stat-label { font-size: 9px; font-weight: 700; color: rgba(240,237,232,0.5); }
    .stat-value { font-size: 20px; font-weight: 700; }
    .tabs {
      display: flex;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      padding: 0 28px;
    }
    .tab {
      padding: 14px 18px;
      font-size: 13px;
      color: rgba(240,237,232,0.5);
      cursor: pointer;
      border-bottom: 2px solid transparent;
    }
    .tab.active {
      color: #F0EDE8;
      border-bottom-color: #D4A017;
    }
    .toolbar {
      padding: 16px 28px;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.1);
      background: transparent;
      color: rgba(240,237,232,0.7);
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
    }
    .btn:hover {
      background: rgba(255,255,255,0.05);
      color: #F0EDE8;
    }
    .btn.active {
      background: #D4A017;
      color: #0A0A0A;
      border-color: #D4A017;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
      padding: 0 28px 48px;
    }
    .card {
      background: #141414;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 11px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card-id { font-size: 10px; color: rgba(240,237,232,0.4); font-weight: 600; text-transform: uppercase; }
    .card-title { font-size: 13px; font-weight: 600; }
    .card-status { font-size: 9px; padding: 3px 9px; border-radius: 20px; width: fit-content; }
    .status-pending { background: rgba(212,160,23,0.15); color: #D4A017; }
    .status-published { background: rgba(96,165,250,0.15); color: #60a5fa; }
    .status-approved { background: rgba(34,197,94,0.15); color: #22c55e; }
    .status-scheduled { background: rgba(167,139,250,0.15); color: #a78bfa; }
    .card-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .action-btn {
      padding: 6px 10px;
      border-radius: 5px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(212,160,23,0.1);
      color: #D4A017;
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
      flex: 1;
      min-width: 60px;
    }
    .action-btn:hover { background: rgba(212,160,23,0.2); }
    .action-btn.publish { background: rgba(60,165,250,0.1); color: #60a5fa; }
    .action-btn.publish:hover { background: rgba(60,165,250,0.2); }
    .empty { grid-column: 1/-1; text-align: center; padding: 60px 28px; color: rgba(240,237,232,0.4); }

    /* Modal */
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; }
    .modal.open { display: flex; }
    .modal-content {
      background: #141414;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 11px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .modal-title { font-size: 16px; font-weight: 700; }
    .modal-desc { font-size: 13px; color: rgba(240,237,232,0.7); line-height: 1.5; }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-label { font-size: 11px; font-weight: 600; color: rgba(240,237,232,0.6); }
    .form-input {
      background: #0A0A0A;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 8px 12px;
      color: #F0EDE8;
      font-size: 13px;
      font-family: inherit;
    }
    .form-input:focus { outline: none; border-color: #D4A017; }
    .modal-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .modal-actions button {
      flex: 1;
      padding: 10px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .btn-confirm {
      background: #D4A017;
      color: #0A0A0A;
    }
    .btn-confirm:hover { background: #E8B82D; }
    .btn-cancel {
      background: rgba(255,255,255,0.1);
      color: #F0EDE8;
    }
    .btn-cancel:hover { background: rgba(255,255,255,0.15); }
  </style>
</head>
<body>

<header>
  <div style="display: flex; align-items: center; gap: 8px;">
    <div class="logo-dot"></div>
    <div class="logo">EBS Aprendiz</div>
  </div>
</header>

<div class="stats-bar">
  <div class="stat-item">
    <span class="stat-label">TOTAL</span>
    <span class="stat-value" id="sTotal">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">PENDENTES</span>
    <span class="stat-value" id="sPending">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">APROVADOS</span>
    <span class="stat-value" id="sApproved">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">AGENDADOS</span>
    <span class="stat-value" id="sScheduled">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">PUBLICADOS</span>
    <span class="stat-value" id="sPublished">—</span>
  </div>
</div>

<div class="tabs">
  <div class="tab active" onclick="setTab('queue', this)">📋 Fila</div>
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

<!-- Modal Agendar -->
<div class="modal" id="modalSchedule">
  <div class="modal-content">
    <div class="modal-title">📅 Agendar Publicação</div>
    <div class="modal-desc" id="schedDesc"></div>
    <div class="form-group">
      <label class="form-label">Data e hora (BRT - Corbélia)</label>
      <input type="datetime-local" class="form-input" id="schedDateTime">
      <small style="color: rgba(240,237,232,0.4); font-size: 10px;">Horário sugerido: 19:00 BRT</small>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal('modalSchedule')">Cancelar</button>
      <button class="btn-confirm" onclick="confirmSchedule()">Agendar</button>
    </div>
  </div>
</div>

<!-- Modal Publicar Agora -->
<div class="modal" id="modalPublish">
  <div class="modal-content">
    <div class="modal-title">🚀 Publicar Agora</div>
    <div class="modal-desc" id="publishDesc"></div>
    <div style="font-size: 12px; color: rgba(212,160,23,0.8); background: rgba(212,160,23,0.1); padding: 10px; border-radius: 6px; border-left: 3px solid #D4A017;">
      ⚠️ O carrossel será publicado imediatamente no @aprendiz.ebs
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal('modalPublish')">Cancelar</button>
      <button class="btn-confirm" onclick="confirmPublish()">Confirmar Publicação</button>
    </div>
  </div>
</div>

<script>
var carousels = [];
var filter = 'all';
var currentId = null;

function loadQueue() {
  fetch('/api/queue')
    .then(r => r.json())
    .then(d => {
      carousels = d.carousels || [];
      updateStats();
      renderGrid();
    })
    .catch(e => alert('Erro: ' + e.message));
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
  const list = filter === 'all' ? carousels :
    carousels.filter(c => (c.status || 'pending') === filter);

  const grid = document.getElementById('grid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty">Nenhum carrossel</div>';
    return;
  }

  grid.innerHTML = list.map(c => {
    const status = c.status || 'pending';
    return \`
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div class="card-id">\${c.id}</div>
            <div class="card-title">\${c.title || 'Sem título'}</div>
          </div>
          <div class="card-status status-\${status}">\${status}</div>
        </div>
        <div class="card-actions">
          \${status === 'pending' ? \`
            <button class="action-btn" onclick="openApprove('\${c.id}')">✓ Aprovar</button>
          \` : ''}
          \${['pending', 'approved', 'scheduled'].includes(status) ? \`
            <button class="action-btn publish" onclick="openSchedule('\${c.id}')">📅 Agendar</button>
            <button class="action-btn publish" onclick="openPublish('\${c.id}')">🚀 Publicar</button>
          \` : ''}
          <button class="action-btn" onclick="openPreview('\${c.id}')">👁️ Visualizar</button>
        </div>
        \${c.scheduled_for ? \`<div style="font-size: 10px; color: #a78bfa;">📅 Agendado: \${c.scheduled_for.substring(0,16).replace('T', ' ')}</div>\` : ''}
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
  window.open('/carousel/' + id, '_blank', 'width=1100,height=1400');
}

function openApprove(id) {
  currentId = id;
  updateStatus('approved');
}

function openSchedule(id) {
  currentId = id;
  const c = carousels.find(x => x.id === id);
  document.getElementById('schedDesc').textContent = 'Agendar: ' + c.title;

  // Default: próximo dia às 19:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);
  document.getElementById('schedDateTime').value = tomorrow.toISOString().substring(0, 16);

  document.getElementById('modalSchedule').classList.add('open');
}

function openPublish(id) {
  currentId = id;
  const c = carousels.find(x => x.id === id);
  document.getElementById('publishDesc').textContent = 'Publicar agora: ' + c.title;
  document.getElementById('modalPublish').classList.add('open');
}

function confirmSchedule() {
  const dt = document.getElementById('schedDateTime').value;
  if (!dt) { alert('Selecione uma data'); return; }

  updateStatus('scheduled', dt);
  closeModal('modalSchedule');
}

function confirmPublish() {
  updateStatus('published');
  closeModal('modalPublish');
}

function updateStatus(status, scheduled_for = null) {
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
    if (idx !== -1) {
      carousels[idx] = d.carousel;
    }
    updateStats();
    renderGrid();
  })
  .catch(e => alert('Erro: ' + e.message));
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

loadQueue();
setInterval(loadQueue, 5000);
</script>

</body>
</html>`);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔════════════════════════════════════╗');
  console.log('  ║  EBS Aprendiz — Dashboard Full     ║');
  console.log('  ╚════════════════════════════════════╝');
  console.log('');
  console.log('  🌐 http://localhost:' + PORT);
  console.log('  ✅ Recursos: Aprovar, Agendar, Publicar');
  console.log('');
});
