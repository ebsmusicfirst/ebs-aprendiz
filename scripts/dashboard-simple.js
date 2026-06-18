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
    .empty { grid-column: 1/-1; text-align: center; padding: 60px 28px; color: rgba(240,237,232,0.4); }
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
    <span class="stat-label">PUBLICADOS</span>
    <span class="stat-value" id="sPublished">—</span>
  </div>
</div>

<div class="tabs">
  <div class="tab active" onclick="setTab('queue', this)">📋 Fila</div>
  <div class="tab" onclick="setTab('info', this)">ℹ️ Info</div>
</div>

<div class="toolbar">
  <button class="btn active" onclick="setFilter('all', this)">Todos</button>
  <button class="btn" onclick="setFilter('pending', this)">Pendentes</button>
  <button class="btn" onclick="setFilter('published', this)">Publicados</button>
  <div style="flex: 1;"></div>
  <button class="btn" onclick="loadQueue()">↻ Atualizar</button>
</div>

<div class="grid" id="grid"></div>

<script>
var carousels = [];
var filter = 'all';

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
  const published = carousels.filter(c => c.status === 'published').length;

  document.getElementById('sTotal').textContent = total;
  document.getElementById('sPending').textContent = pending;
  document.getElementById('sApproved').textContent = approved;
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

  grid.innerHTML = list.map(c => \`
    <div class="card" onclick="openCarousel('\${c.id}')" style="cursor: pointer;">
      <div class="card-id">\${c.id}</div>
      <div class="card-title">\${c.title || 'Sem título'}</div>
      <div class="card-status status-\${c.status || 'pending'}">\${c.status || 'pendente'}</div>
      <div style="font-size: 11px; color: rgba(240,237,232,0.4); margin-top: 4px;">Clique para visualizar ➜</div>
    </div>
  \`).join('');
}

function setFilter(f, el) {
  filter = f;
  document.querySelectorAll('.toolbar .btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderGrid();
}

function setTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

function openCarousel(carouselId) {
  window.open('/carousel/' + carouselId, '_blank', 'width=1080,height=1350,left=100,top=100');
}

loadQueue();
setInterval(loadQueue, 10000);
</script>

</body>
</html>`);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔════════════════════════════════════╗');
  console.log('  ║  EBS Aprendiz — Dashboard Simple   ║');
  console.log('  ╚════════════════════════════════════╝');
  console.log('');
  console.log('  🌐 http://localhost:' + PORT);
  console.log('  ✅ Carregando fila do queue.json');
  console.log('');
  console.log('  Ctrl+C para encerrar');
  console.log('');
});
