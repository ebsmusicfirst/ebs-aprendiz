#!/usr/bin/env node
/**
 * EBS Aprendiz — Instagram Feed Checker (via Navegador)
 *
 * Abre o Chrome via Playwright, navega até @aprendiz.ebs,
 * captura screenshot do feed e retorna:
 *   - Quantidade de posts visíveis no grid
 *   - URLs dos posts
 *   - Screenshot salvo em tmp/
 *
 * Usage:
 *   node scripts/check-instagram-browser.js
 *   node scripts/check-instagram-browser.js --headless   (sem abrir janela)
 *   node scripts/check-instagram-browser.js --post <N>   (abre post N do grid)
 *
 * Exit codes:
 *   0  — verificação concluída (mesmo que a conta não carregue — veja output)
 *   1  — erro fatal (Playwright não instalado, etc.)
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const { chromium } = require('playwright');

// ── Config ───────────────────────────────────────────────────────────────────

const IG_PROFILE_URL  = 'https://www.instagram.com/aprendiz.ebs/';
const SCREENSHOT_DIR  = path.resolve(__dirname, '..', 'tmp', 'instagram');
const HEADLESS        = process.argv.includes('--headless');
const OPEN_POST_IDX   = (() => {
  const i = process.argv.indexOf('--post');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) - 1 : -1;
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function checkInstagram() {
  console.log('\n📸 EBS Aprendiz — Verificação do Instagram via navegador');
  console.log(`   Perfil: @aprendiz.ebs (${IG_PROFILE_URL})`);
  console.log(`   Modo:   ${HEADLESS ? 'headless' : 'janela visível'}\n`);

  ensureDir(SCREENSHOT_DIR);

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: HEADLESS ? 0 : 300,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const ctx = await browser.newContext({
    // User-agent realista para evitar bloqueio do Instagram
    userAgent: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'AppleWebKit/537.36 (KHTML, like Gecko)',
      'Chrome/124.0.0.0 Safari/537.36',
    ].join(' '),
    viewport: { width: 1280, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  const page = await ctx.newPage();

  // Captura erros de console e rede para diagnóstico
  const consoleErrs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrs.push(msg.text());
  });

  let result = { success: false, postCount: 0, posts: [], screenshotPath: null };

  try {
    // ── Navega até o perfil ──────────────────────────────────────────────────
    console.log('🌐 Abrindo perfil...');
    await page.goto(IG_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Aceita cookies se aparecer (Instagram EU banner)
    try {
      const cookieBtn = page.locator('button:has-text("Allow"), button:has-text("Accept"), button:has-text("Aceitar")').first();
      if (await cookieBtn.isVisible({ timeout: 3000 })) {
        await cookieBtn.click();
        console.log('   Cookie banner aceito.');
      }
    } catch {}

    // Fecha modal de login se aparecer
    try {
      const dismissBtn = page.locator('[aria-label="Close"], button:has-text("Not Now"), button:has-text("Agora não")').first();
      if (await dismissBtn.isVisible({ timeout: 3000 })) {
        await dismissBtn.click();
        console.log('   Modal de login fechado.');
      }
    } catch {}

    // Aguarda carregamento do grid
    await page.waitForTimeout(3000);

    // ── Screenshot do perfil ─────────────────────────────────────────────────
    const screenshotFile = path.join(SCREENSHOT_DIR, `profile-${timestamp()}.png`);
    await page.screenshot({ path: screenshotFile, fullPage: false });
    result.screenshotPath = screenshotFile;
    console.log(`📁 Screenshot: ${screenshotFile}`);

    // ── Extrai informações do grid ───────────────────────────────────────────
    const pageTitle  = await page.title();
    const pageUrl    = page.url();

    // Tenta pegar posts (múltiplos seletores — Instagram muda o DOM regularmente)
    const postLocators = [
      'article a[href*="/p/"]',
      'div[style*="flex-direction: row"] a[href*="/p/"]',
      'a[href*="/p/"]',
    ];

    let postLinks = [];
    for (const sel of postLocators) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        postLinks = await page.locator(sel).evaluateAll(els =>
          els.map(el => el.getAttribute('href')).filter(Boolean)
        );
        break;
      }
    }

    // Dedup + filtra slugs de posts (não reels, não highlights)
    const unique = [...new Set(postLinks)].filter(u => u.match(/^\/p\//));

    result.success   = true;
    result.postCount = unique.length;
    result.posts     = unique.map(u => `https://www.instagram.com${u}`);

    // ── Output ───────────────────────────────────────────────────────────────
    console.log(`\n✅ Página carregada: ${pageTitle}`);
    console.log(`   URL atual: ${pageUrl}`);
    console.log(`   Posts encontrados no grid: ${result.postCount}`);

    if (result.posts.length > 0) {
      console.log('\n🔗 Posts (mais recentes primeiro):');
      result.posts.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
    } else {
      console.log('\n⚠️  Nenhum post encontrado. Possíveis causas:');
      console.log('   - Instagram exigiu login para ver o perfil');
      console.log('   - Conta privada ou sem posts');
      console.log('   - Seletor CSS mudou (cheque o screenshot)');
    }

    if (consoleErrs.length > 0) {
      console.log(`\n⚠️  ${consoleErrs.length} erros de console (pode indicar bloqueio):`);
      consoleErrs.slice(0, 3).forEach(e => console.log('   →', e.substring(0, 120)));
    }

    // ── Abre post específico se --post N foi passado ──────────────────────────
    if (OPEN_POST_IDX >= 0 && result.posts[OPEN_POST_IDX]) {
      const postUrl = result.posts[OPEN_POST_IDX];
      console.log(`\n🖼️  Abrindo post ${OPEN_POST_IDX + 1}: ${postUrl}`);
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      const postShot = path.join(SCREENSHOT_DIR, `post-${OPEN_POST_IDX + 1}-${timestamp()}.png`);
      await page.screenshot({ path: postShot, fullPage: false });
      console.log(`📁 Screenshot post: ${postShot}`);
    }

  } catch (err) {
    console.error(`\n❌ Erro durante verificação: ${err.message}`);
    result.error = err.message;

    // Screenshot do estado atual (para diagnóstico)
    try {
      const errShot = path.join(SCREENSHOT_DIR, `error-${timestamp()}.png`);
      await page.screenshot({ path: errShot });
      console.log(`📁 Screenshot de erro: ${errShot}`);
    } catch {}
  } finally {
    if (!HEADLESS) {
      console.log('\n⏳ Janela aberta por 12s para visualização...');
      await page.waitForTimeout(12000);
    }
    await browser.close();
  }

  return result;
}

// ── Entry point ───────────────────────────────────────────────────────────────

checkInstagram()
  .then(result => {
    console.log('\n━━━ RESUMO ━━━');
    console.log(`  Posts no feed @aprendiz.ebs: ${result.postCount}`);
    if (result.screenshotPath) console.log(`  Screenshot:                  ${result.screenshotPath}`);
    console.log('');
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('\n❌ FATAL:', err.message);
    console.error('   Playwright instalado? Rode: npx playwright install chromium');
    process.exit(1);
  });
