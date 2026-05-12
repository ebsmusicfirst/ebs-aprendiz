/**
 * EBS Aprendiz — Meta Graph API Helpers
 * Módulo compartilhado usado pelo dashboard e pelo post-carousel.js
 */

const https = require('https');

const API_VERSION = 'v21.0';
const BASE_URL    = `https://graph.facebook.com/${API_VERSION}`;

// ─────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data    = new URLSearchParams(body).toString();
    const urlObj  = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj  = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
    };
    const req = https.request(options, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─────────────────────────────────────────
// URL pública dos slides via raw.githubusercontent.com
// ─────────────────────────────────────────

function slideUrl(slidePath, githubRepo, githubRef = 'main') {
  return `https://raw.githubusercontent.com/${githubRepo}/${githubRef}/${slidePath}`;
}

// ─────────────────────────────────────────
// Meta Graph API — Publicação
// ─────────────────────────────────────────

async function createSlideContainer(imageUrl, igUserId, accessToken) {
  const res = await httpPost(`${BASE_URL}/${igUserId}/media`, {
    image_url: imageUrl,
    is_carousel_item: 'true',
    access_token: accessToken,
  });
  if (!res.body.id) throw new Error(`Falha ao criar slide container: ${JSON.stringify(res.body)}`);
  return res.body.id;
}

/**
 * Cria o container do carrossel.
 * @param {object} opts - { published: bool (default true) }
 */
async function createCarouselContainer(childIds, caption, igUserId, accessToken, opts = {}) {
  const params = {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption: caption,
    access_token: accessToken,
  };
  // Para containers "preparados" (não publicar ainda)
  if (opts.published === false) {
    params.published = 'false';
  }
  const res = await httpPost(`${BASE_URL}/${igUserId}/media`, params);
  if (!res.body.id) throw new Error(`Falha ao criar carousel container: ${JSON.stringify(res.body)}`);
  return res.body.id;
}

async function publishCarousel(containerId, igUserId, accessToken) {
  const res = await httpPost(`${BASE_URL}/${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: accessToken,
  });
  if (!res.body.id) throw new Error(`Falha ao publicar: ${JSON.stringify(res.body)}`);
  return res.body.id;
}

// ─────────────────────────────────────────
// Fluxo completo: criar containers + publicar
// ─────────────────────────────────────────

async function postCarouselNow(carousel, igUserId, accessToken, githubRepo, githubRef, log) {
  log = log || console.log;

  log(`📋 Carrossel: ${carousel.id} — "${carousel.title}"`);

  // 1. Slide containers
  const childIds = [];
  for (const slidePath of carousel.slides) {
    const url = slideUrl(slidePath, githubRepo, githubRef);
    log(`  📤 Upload: ${url}`);
    const id = await createSlideContainer(url, igUserId, accessToken);
    childIds.push(id);
    log(`     container_id: ${id}`);
  }

  // 2. Carousel container
  const caption = `${carousel.caption}\n\n${carousel.hashtags}`;
  log(`  🎠 Criando container do carrossel...`);
  const carouselContainerId = await createCarouselContainer(childIds, caption, igUserId, accessToken);
  log(`     carousel_container_id: ${carouselContainerId}`);

  // 3. Publicar
  log(`  🚀 Publicando...`);
  const postId = await publishCarousel(carouselContainerId, igUserId, accessToken);
  log(`  ✅ Publicado! Post ID: ${postId}`);

  return { postId, carouselContainerId };
}

// ─────────────────────────────────────────
// Preparar containers sem publicar (para agendamento)
// ─────────────────────────────────────────

async function prepareCarouselContainers(carousel, igUserId, accessToken, githubRepo, githubRef, log) {
  log = log || console.log;

  log(`📋 Preparando: ${carousel.id}`);

  const childIds = [];
  for (const slidePath of carousel.slides) {
    const url = slideUrl(slidePath, githubRepo, githubRef);
    log(`  📤 Upload: ${url}`);
    const id = await createSlideContainer(url, igUserId, accessToken);
    childIds.push(id);
  }

  const caption = `${carousel.caption}\n\n${carousel.hashtags}`;
  log(`  🎠 Criando container (não publicado)...`);
  const containerId = await createCarouselContainer(childIds, caption, igUserId, accessToken, { published: false });
  log(`     container_id: ${containerId}`);

  return containerId;
}

// ─────────────────────────────────────────
// Buscar posts publicados na conta Instagram
// ─────────────────────────────────────────

async function fetchIgPosts(igUserId, accessToken, limit = 20) {
  const fields = [
    'id', 'caption', 'media_type', 'media_url', 'thumbnail_url',
    'timestamp', 'like_count', 'comments_count', 'permalink',
  ].join(',');

  const url = `${BASE_URL}/${igUserId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
  const res = await httpGet(url);

  if (res.body.error) throw new Error(res.body.error.message || JSON.stringify(res.body.error));
  return res.body;
}

// Para carrossel: busca os filhos (children) de um post
async function fetchCarouselChildren(mediaId, accessToken) {
  const url = `${BASE_URL}/${mediaId}/children?fields=id,media_url&access_token=${accessToken}`;
  const res = await httpGet(url);
  return res.body;
}

// ─────────────────────────────────────────
// Informações da conta
// ─────────────────────────────────────────

async function fetchAccountInfo(igUserId, accessToken) {
  const url = `${BASE_URL}/${igUserId}?fields=id,username,name,followers_count,media_count&access_token=${accessToken}`;
  const res = await httpGet(url);
  if (res.body.error) throw new Error(res.body.error.message || JSON.stringify(res.body.error));
  return res.body;
}

module.exports = {
  slideUrl,
  createSlideContainer,
  createCarouselContainer,
  publishCarousel,
  postCarouselNow,
  prepareCarouselContainers,
  fetchIgPosts,
  fetchCarouselChildren,
  fetchAccountInfo,
};
