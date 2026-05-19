/**
 * Buffer API wrapper — Buffer GraphQL API ("Beta", 2026)
 *
 * Endpoint:  https://api.buffer.com/2/graphql
 * Auth:      Authorization: Bearer <token>
 * Token:     Personal API Key (gerada em publish.buffer.com/settings/api)
 *
 * NÃO use a v1 REST API (api.bufferapp.com/1) — é legado, rejeita Personal Keys
 * com mensagem enganosa "OIDC tokens are not accepted".
 *
 * Substitui meta-api.js como camada de publicação.
 */
'use strict';

const https = require('https');

const ENDPOINT = {
  hostname: 'api.buffer.com',
  path:     '/2/graphql',
  port:     443
};

// ────────────────────────────────────────────────────────────────────────────
// Low-level GraphQL call
// ────────────────────────────────────────────────────────────────────────────

function gqlRequest(token, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req  = https.request({
      hostname: ENDPOINT.hostname,
      path:     ENDPOINT.path,
      port:     ENDPOINT.port,
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent':     'EBS-Aprendiz-Dashboard/1.0'
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = JSON.parse(raw); }
        catch { return reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${raw.substring(0, 200)}`)); }

        if (data.errors && data.errors.length) {
          const msg = data.errors.map(e => e.message).join(' | ');
          const err = new Error(`Buffer GraphQL: ${msg}`);
          err.graphqlErrors = data.errors;
          err.statusCode    = res.statusCode;
          return reject(err);
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${raw.substring(0, 200)}`));
        }
        resolve(data.data);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ────────────────────────────────────────────────────────────────────────────
// High-level helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verifica token e retorna info da conta + organizations.
 * Use como health-check no startup do dashboard.
 */
async function getAccount(token) {
  const q = `{
    account {
      id email name timezone createdAt
      organizations { id name }
    }
  }`;
  const data = await gqlRequest(token, q);
  return data.account;
}

/**
 * Lista canais conectados na organization.
 * @param {string} token
 * @param {string} organizationId
 */
async function listChannels(token, organizationId) {
  const q = `query Channels($input: ChannelsInput!) {
    channels(input: $input) {
      id name service serviceId timezone avatar
    }
  }`;
  const data = await gqlRequest(token, q, { input: { organizationId } });
  return data.channels;
}

/**
 * Cria post — pode ser draft, scheduled ou shareNow.
 *
 * @param {Object} opts
 * @param {string} opts.token
 * @param {string} opts.channelId       — ID Buffer do canal (ex: '6a0b6029090476fb99338257' p/ @aprendiz.ebs)
 * @param {string} opts.text            — caption
 * @param {string[]} opts.imageUrls     — URLs públicas das imagens (ex: raw.githubusercontent.com/...). Multi-imagem = carrossel.
 * @param {string} [opts.dueAt]         — ISO timestamp UTC para agendar (ex: '2026-05-20T22:00:00Z'). Se omitido + draft=false, vai pra queue.
 * @param {boolean} [opts.draft=true]   — DEFAULT true por segurança. False = agendar/publicar de verdade.
 * @param {string} [opts.firstComment]  — primeiro comentário (hashtags, etc)
 * @param {boolean} [opts.shareNow=false] — publicar imediatamente em vez de agendar/enfileirar
 * @returns {Promise<{id, status, dueAt, url}>}
 */
async function createPost({ token, channelId, text, imageUrls, dueAt, draft = true, firstComment, shareNow = false }) {
  if (!channelId)            throw new Error('createPost: channelId é obrigatório');
  if (!text || !text.trim()) throw new Error('createPost: text é obrigatório');
  if (!imageUrls || !imageUrls.length) throw new Error('createPost: imageUrls precisa ter pelo menos 1 URL');

  // Buffer IG aceita até 10 imagens em carrossel
  if (imageUrls.length > 10) {
    throw new Error(`createPost: Instagram aceita até 10 imagens por carrossel (recebeu ${imageUrls.length})`);
  }

  // Instagram aceita só 'post' | 'story' | 'reel' via API — Buffer auto-detecta carrossel
  // pela quantidade de assets. Não use 'carousel' literal (erro: "does not support carousel").
  const igType = 'post';

  // Decidir mode + schedulingType
  let mode = 'customScheduled';
  if (draft)         mode = 'addToQueue';      // saveToDraft=true vence; mode é só placeholder
  else if (shareNow) mode = 'shareNow';
  else if (!dueAt)   mode = 'addToQueue';      // sem data = vai pra fila

  const input = {
    channelId,
    text,
    schedulingType: 'automatic',  // Buffer publica sozinho (vs 'notification' = só lembra)
    mode,
    saveToDraft: draft,
    assets: imageUrls.map(url => ({ image: { url } })),
    metadata: {
      instagram: {
        type: igType,
        shouldShareToFeed: true,
        ...(firstComment ? { firstComment } : {})
      }
    },
    ...(dueAt && !draft && !shareNow ? { dueAt } : {})
  };

  const m = `mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id status dueAt text createdAt } }
      ... on InvalidInputError { message }
      ... on UnauthorizedError { message }
      ... on NotFoundError { message }
      ... on LimitReachedError { message }
      ... on UnexpectedError { message }
      ... on RestProxyError { message }
    }
  }`;

  const data = await gqlRequest(token, m, { input });
  const result = data.createPost;
  if (!result) throw new Error('createPost: resposta vazia');
  if (result.message) throw new Error(`Buffer rejeitou createPost: ${result.message}`);
  if (!result.post)   throw new Error('createPost: sucesso sem post (resposta inesperada)');
  return result.post;
}

/**
 * Edita um post existente.
 */
async function editPost({ token, postId, text, dueAt }) {
  const m = `mutation EditPost($input: EditPostInput!) {
    editPost(input: $input) {
      ... on PostActionSuccess { post { id status dueAt text } }
      ... on InvalidInputError { message }
      ... on UnauthorizedError { message }
      ... on NotFoundError { message }
    }
  }`;
  const input = { id: postId };
  if (text !== undefined) input.text = text;
  if (dueAt !== undefined) input.dueAt = dueAt;
  const data = await gqlRequest(token, m, { input });
  if (data.editPost?.message) throw new Error(`Buffer rejeitou editPost: ${data.editPost.message}`);
  return data.editPost?.post;
}

/**
 * Deleta post (útil para reverter draft de teste).
 */
async function deletePost({ token, postId }) {
  const m = `mutation DeletePost($input: DeletePostInput!) {
    deletePost(input: $input) {
      ... on DeletePostSuccess { post { id status } }
      ... on VoidMutationError { message }
    }
  }`;
  const data = await gqlRequest(token, m, { input: { id: postId } });
  if (data.deletePost?.message) throw new Error(`Buffer rejeitou deletePost: ${data.deletePost.message}`);
  return data.deletePost?.post;
}

/**
 * Lista posts (útil para auditoria).
 * @param {string} token
 * @param {string} organizationId
 * @param {string[]} [channelIds] — filtro opcional
 */
async function listPosts({ token, organizationId, channelIds }) {
  const q = `query Posts($input: PostsInput!) {
    posts(input: $input) {
      edges { node { id status dueAt text createdAt } }
    }
  }`;
  const input = { organizationId };
  if (channelIds && channelIds.length) input.filter = { channelIds };
  const data = await gqlRequest(token, q, { input });
  return (data.posts?.edges || []).map(e => e.node);
}

// ────────────────────────────────────────────────────────────────────────────
module.exports = {
  gqlRequest,
  getAccount,
  listChannels,
  createPost,
  editPost,
  deletePost,
  listPosts,
  ENDPOINT
};

// ────────────────────────────────────────────────────────────────────────────
// CLI quick-test: node scripts/buffer-api.js
// ────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
  }
  const TOKEN = process.env.BUFFER_ACCESS_TOKEN;
  if (!TOKEN) { console.error('❌ BUFFER_ACCESS_TOKEN ausente no .env'); process.exit(1); }

  (async () => {
    console.log('🔵 Buffer API — health check\n');
    try {
      const account = await getAccount(TOKEN);
      console.log(`✅ Account: ${account.name} <${account.email}>`);
      console.log(`   ID: ${account.id}`);
      console.log(`   Orgs: ${account.organizations.map(o => `${o.name} (${o.id})`).join(', ')}\n`);

      const orgId = account.organizations[0].id;
      const channels = await listChannels(TOKEN, orgId);
      console.log(`✅ Channels conectados (${channels.length}):`);
      channels.forEach(c => {
        console.log(`   · ${c.service.padEnd(12)} ${c.name.padEnd(25)} channelId=${c.id}`);
      });

      const posts = await listPosts({ token: TOKEN, organizationId: orgId, channelIds: [channels[0].id] });
      console.log(`\n✅ Últimos posts no canal ${channels[0].name} (${posts.length}):`);
      posts.forEach(p => {
        const d = p.dueAt ? new Date(p.dueAt).toISOString() : 'sem data';
        console.log(`   · ${p.id} [${p.status}] @ ${d} — "${(p.text || '').substring(0, 50)}"`);
      });
    } catch (err) {
      console.error('❌', err.message);
      if (err.graphqlErrors) console.error('   GraphQL details:', JSON.stringify(err.graphqlErrors, null, 2));
      process.exit(1);
    }
  })();
}
