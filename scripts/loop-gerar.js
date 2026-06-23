/**
 * loop-gerar.js — Loop Gerador de Carrosséis
 *
 * Ciclo: LÊ estado → DECIDE próxima pauta → GERA HTML → EXPORTA PNGs → REGISTRA no ClickUp
 *
 * Entrada : Pautas com status "Aprovada p/ Criar" no ClickUp
 * Saída   : Criativo registrado como "Em Aprovação" no ClickUp (Alex aprova lá)
 *
 * IMPORTANTE: Este script NÃO publica nem agenda nada. A publicação só ocorre
 * APÓS aprovação explícita de Alex, via loop-publicar.js.
 *
 * Uso: node scripts/loop-gerar.js
 *      node scripts/loop-gerar.js --dry-run   (apenas lista pautas, sem gerar)
 */

'use strict';
require('dotenv').config();

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const { execSync } = require('child_process');
const cu      = require('./clickup.js');

const DRY_RUN   = process.argv.includes('--dry-run');
const STATE_FILE = path.join(__dirname, '..', 'STATE.md');

// ── Anthropic API (claude-sonnet-4-6) ────────────────────────
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

function callClaude(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const d = JSON.parse(raw);
          if (d.error) return reject(new Error(`Anthropic: ${d.error.message}`));
          resolve(d.content[0].text);
        } catch (e) {
          reject(new Error(`JSON parse error: ${raw.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Leitura / escrita do STATE.md ─────────────────────────────
function lerState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  const text = fs.readFileSync(STATE_FILE, 'utf8');
  const obj = {};
  const m = text.match(/```json\n([\s\S]*?)\n```/);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }
  return obj;
}

function salvarState(state) {
  const agora = new Date().toISOString();
  const content = `# STATE — Loop EBS Aprendiz
> Atualizado: ${agora}

\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`
`;
  fs.writeFileSync(STATE_FILE, content, 'utf8');
}

// ── Geração de HTML via Claude ────────────────────────────────
const SYSTEM_GERAR_CAROUSEL = `
Você é um gerador de carrosséis para o Instagram do EBS Aprendiz — escola de música em Corbélia, PR.

FORMATO: tweet-v4 (estilo post do X/Twitter)
- Visual: fundo cinza #F2F2F2, cards brancos, fonte 24px+, sem imagens
- Slides: capa + 4-6 slides de conteúdo + 1 CTA final (total 6-8 slides)
- Tom: mentor experiente, direto, sem promessas de "aprender rápido"
- Público: pais de crianças 7-12 anos, adolescentes, adultos em Corbélia-PR
- Handle: @aprendiz.ebs — NUNCA @ebsmusicfirst
- PROIBIDO: revelar preços, prometer "aprenda em X dias", gírias pesadas

OUTPUT: retorne SOMENTE um JSON com esta estrutura (sem markdown, sem explicação):
{
  "titulo": "slug-do-arquivo",
  "caption": "texto do post no Instagram — DEVE começar com sinal local (ex: 'Tá em Corbélia?', 'Em Corbélia...', 'Aqui em Corbélia,') — sem preço, max 300 chars",
  "hashtags": "#ebsaprendiz #escolademusica #corbeliapr",
  "slides": [
    { "tipo": "capa", "headline": "...", "sub": "..." },
    { "tipo": "conteudo", "headline": "...", "corpo": "..." },
    ...
    { "tipo": "cta", "headline": "...", "acao": "Garanta sua vaga" }
  ]
}
`;

async function gerarConteudo(pauta, regras) {
  const framework = cu.readDropdown(cu.FIELDS.pautas.framework, pauta) || regras.framework || 'Cheat Sheet / Checklist';
  const pilar     = cu.readDropdown(cu.FIELDS.pautas.pilar, pauta) || 'A — Metáfora';

  const prompt = `
Crie um carrossel para o Instagram do EBS Aprendiz com base na pauta abaixo.

PAUTA: ${pauta.name}
FRAMEWORK: ${framework}
PILAR VISUAL: ${pilar}
${regras.regrasCaption ? `REGRAS DE CAPTION: ${regras.regrasCaption}` : ''}
${regras.hashtagsBase ? `HASHTAGS BASE: ${regras.hashtagsBase}` : ''}
${regras.cta ? `CTA: ${regras.cta}` : ''}

Aplique o framework "${framework}" para estruturar os slides.
Retorne SOMENTE o JSON, sem markdown.
`;

  const raw = await callClaude(SYSTEM_GERAR_CAROUSEL, prompt);

  // Extrai JSON mesmo se vier com markdown
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude não retornou JSON válido');
  return JSON.parse(match[0]);
}

// ── Montagem do HTML tweet-v4 ─────────────────────────────────
function montarHTML(dados, logoB64) {
  const slides = dados.slides.map((s, i) => {
    if (s.tipo === 'capa') {
      return `
  <div class="x-slide">
    <div class="x-slide-inner capa">
      <p class="x-headline">${escapar(s.headline)}</p>
      ${s.sub ? `<p class="x-sub">${escapar(s.sub)}</p>` : ''}
    </div>
  </div>`;
    }
    if (s.tipo === 'cta') {
      return `
  <div class="x-slide">
    <div class="x-slide-inner cta">
      ${logoB64 ? `<img class="logo-cta" src="data:image/png;base64,${logoB64}" alt="EBS">` : ''}
      <p class="x-headline">${escapar(s.headline)}</p>
      <p class="x-acao">${escapar(s.acao)}</p>
      <p class="x-handle">@aprendiz.ebs</p>
    </div>
  </div>`;
    }
    return `
  <div class="x-slide">
    <div class="x-slide-inner">
      <p class="x-headline">${escapar(s.headline)}</p>
      ${s.corpo ? `<p class="x-corpo">${escapar(s.corpo)}</p>` : ''}
    </div>
  </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #e6e9ed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.x-frame {
  width: 420px; height: 525px;
  background: #F2F2F2;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
}
.x-slide {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  position: absolute; top: 0; left: 0;
  background: #F2F2F2;
}
.x-slide-inner {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 40px 36px;
  width: 380px; min-height: 440px;
  display: flex; flex-direction: column; justify-content: center; gap: 16px;
}
.x-headline {
  font-size: 26px; font-weight: 700; line-height: 1.3;
  color: #0f1923;
}
.x-sub, .x-corpo {
  font-size: 20px; line-height: 1.5; color: #374151;
}
.x-slide-inner.capa .x-headline { font-size: 30px; }
.x-slide-inner.cta { align-items: center; text-align: center; }
.x-slide-inner.cta .x-headline { font-size: 24px; }
.x-acao {
  font-size: 18px; font-weight: 600; color: #D4A017;
  border: 2px solid #D4A017; border-radius: 8px;
  padding: 10px 20px; margin-top: 8px;
}
.x-handle { font-size: 16px; color: #6b7280; margin-top: 8px; }
.logo-cta { width: 80px; margin-bottom: 16px; }
.x-header, .x-dots, .x-nav { display: none; }
</style>
</head>
<body>
<div class="x-frame">
${slides}
</div>
<script>
// navegação básica para preview
let idx = 0;
const slides = document.querySelectorAll('.x-slide');
slides.forEach((s,i) => s.style.display = i===0 ? 'flex' : 'none');
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' && idx < slides.length-1) { slides[idx].style.display='none'; slides[++idx].style.display='flex'; }
  if (e.key === 'ArrowLeft'  && idx > 0)               { slides[idx].style.display='none'; slides[--idx].style.display='flex'; }
});
</script>
</body>
</html>`;
}

function escapar(t) {
  return String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Export PNGs via Playwright ────────────────────────────────
async function exportarPNGs(htmlFile, outputDir) {
  const { chromium } = require('playwright');
  const slideW = 420, slideH = 525;
  const scale  = 1080 / slideW;

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page    = await browser.newPage();
  await page.setViewportSize({ width: slideW, height: slideH, deviceScaleFactor: scale });
  await page.goto(`file:///${htmlFile.replace(/\\/g, '/')}`);
  await page.waitForLoadState('networkidle');

  // Detecta quantidade de slides
  const count = await page.evaluate(() => document.querySelectorAll('.x-slide').length);
  if (count === 0) throw new Error('Nenhum .x-slide encontrado no HTML');

  const pngs = [];
  for (let i = 0; i < count; i++) {
    await page.evaluate(idx => {
      document.querySelectorAll('.x-slide').forEach((s,j) => {
        s.style.display = j === idx ? 'flex' : 'none';
      });
    }, i);
    const dest = path.join(outputDir, `slide_${i + 1}.png`);
    await page.screenshot({ path: dest, fullPage: false });
    pngs.push(dest);
  }

  await browser.close();
  return pngs;
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('   Loop Gerador — EBS Aprendiz');
  console.log(`   ${new Date().toLocaleString('pt-BR')}`);
  if (DRY_RUN) console.log('   [DRY RUN — nenhuma modificação]');
  console.log('══════════════════════════════════════════════════\n');

  // 1. LER ESTADO
  const state = lerState();
  console.log('Estado atual:', state.ultimaRodada || 'primeira rodada');

  // 2. BUSCAR PAUTAS APROVADAS
  console.log('\nBuscando pautas "Aprovada p/ Criar"...');
  const pautas = await cu.listPautasAprovadas();
  console.log(`  Encontradas: ${pautas.length}`);

  if (pautas.length === 0) {
    console.log('\n✅ Nenhuma pauta aprovada. Loop encerrado.');
    state.ultimaRodada = new Date().toISOString();
    state.proximaAcao  = 'Aguardar Alex aprovar pautas no ClickUp (status: Aprovada p/ Criar)';
    salvarState(state);
    return;
  }

  // Processa uma pauta por rodada (princípio do loop: 1 unidade por vez)
  const pauta = pautas[0];
  console.log(`\nProcessando: "${pauta.name}" (${pauta.id})`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] Pauta seria processada aqui.');
    return;
  }

  // 3. HERDAR REGRAS DA CAMPANHA
  const campanhaField = (pauta.custom_fields || []).find(f => f.id === cu.FIELDS.pautas.campanha.id);
  const campanhaId    = campanhaField && campanhaField.value && campanhaField.value[0];
  const regras        = campanhaId ? await cu.getCampanhaRegras(campanhaId) : {};
  console.log(`  Campanha: ${campanhaId || 'nenhuma'}`);

  // 4. GERAR CONTEÚDO VIA CLAUDE
  console.log('  Gerando conteúdo via Claude...');
  let dados;
  try {
    dados = await gerarConteudo(pauta, regras);
  } catch (e) {
    console.error('  ❌ Erro ao gerar conteúdo:', e.message);
    state.erros = (state.erros || []);
    state.erros.push({ pauta: pauta.id, erro: e.message, ts: new Date().toISOString() });
    salvarState(state);
    process.exit(1);
  }

  const slug = dados.titulo || pauta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  console.log(`  Título gerado: ${slug} (${dados.slides.length} slides)`);

  // 5. MONTAR HTML
  let logoB64 = '';
  const logoPath = path.join(__dirname, '..', 'ASSETS', 'logo-ebs-aprendiz.png');
  if (fs.existsSync(logoPath)) logoB64 = fs.readFileSync(logoPath).toString('base64');

  const htmlContent = montarHTML(dados, logoB64);
  const htmlDir  = path.join(__dirname, '..', 'carrosseis');
  const htmlFile = path.join(htmlDir, `${slug}.html`);
  fs.mkdirSync(htmlDir, { recursive: true });
  fs.writeFileSync(htmlFile, htmlContent, 'utf8');
  console.log(`  HTML salvo: carrosseis/${slug}.html`);

  // 6. EXPORTAR PNGs
  console.log('  Exportando PNGs...');
  const pngDir  = path.join(__dirname, '..', 'slides', slug);
  const pngs    = await exportarPNGs(htmlFile, pngDir);
  console.log(`  ${pngs.length} PNGs exportados → slides/${slug}/`);

  // 7. REGISTRAR NO CLICKUP
  console.log('  Registrando no ClickUp como "Em Aprovação"...');
  const criativo = await cu.createCriativo({
    title:      slug,
    formato:    'Carrossel',
    programa:   'EBS Aprendiz',
    plataforma: 'Instagram',
    caption:    dados.caption,
    hashtags:   dados.hashtags || regras.hashtagsBase || '',
    agente:     'loop-gerar',
    campanhaId,
    pautaId:    pauta.id,
    herdar:     false,
  });
  // Mover para "Em Aprovação" (createCriativo cria como "Gerado")
  await cu.updateStatus(criativo.id, 'Em Aprovacao');
  console.log(`  ✅ Criativo ${criativo.id} — status: Em Aprovação`);

  // 7b. ADICIONAR PREVIEW DOS SLIDES NA DESCRIÇÃO
  const GITHUB_RAW = 'https://raw.githubusercontent.com/ebsmusicfirst/ebs-aprendiz/master/slides';
  const descLines = [`**Preview — ${slug}** (${pngs.length} slides)\n`];
  for (let i = 1; i <= pngs.length; i++) {
    descLines.push(`![Slide ${i}](${GITHUB_RAW}/${slug}/slide_${i}.png)`);
  }
  await cu.updateTaskDescription(criativo.id, descLines.join('\n'));
  console.log(`  ✅ Preview dos slides adicionado à descrição do ClickUp`);

  // 8. ATUALIZAR STATUS DA PAUTA
  await cu.updateStatusPauta(pauta.id, 'Em Produção');
  console.log(`  ✅ Pauta ${pauta.id} → Em Produção`);

  // 9. ATUALIZAR STATE
  state.ultimaRodada = new Date().toISOString();
  state.ultimoCriativo = { id: criativo.id, slug, pautaId: pauta.id };
  state.proximaAcao  = `Alex aprovará "${slug}" no ClickUp. Quando aprovado, rodar loop-publicar.js.`;
  state.aprendizados = `Gerado "${slug}" com ${dados.slides.length} slides via framework "${cu.readDropdown(cu.FIELDS.pautas.framework, pauta) || 'padrão'}"`;
  salvarState(state);

  console.log('\n══════════════════════════════════════════════════');
  console.log(`   CONCLUÍDO: "${slug}"`);
  console.log('   Próximo: Alex aprova no ClickUp → rodar loop-publicar.js');
  console.log('══════════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
