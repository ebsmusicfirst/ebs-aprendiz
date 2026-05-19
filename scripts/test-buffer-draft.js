#!/usr/bin/env node
/**
 * Cria UM DRAFT (NÃO publica) no Buffer para validar pipeline completo.
 * Usa as 5 imagens do showcase nano-banana (URLs raw.githubusercontent.com).
 *
 * Uso: node scripts/test-buffer-draft.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const buffer = require('./buffer-api');

const envPath = path.join(__dirname, '..', '.env');
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
});

const TOKEN      = process.env.BUFFER_ACCESS_TOKEN;
const CHANNEL_ID = '6a0b6029090476fb99338257';  // @aprendiz.ebs
const REPO       = 'ebsmusicfirst/ebs-aprendiz';
const BRANCH     = 'master';

// URLs públicas das 5 imagens nano-banana (já no GitHub via commits anteriores)
const IMAGE_URLS = [
  `https://raw.githubusercontent.com/${REPO}/${BRANCH}/slides/nano-banana-showcase/01-guitarra-sozinho.png`,
  `https://raw.githubusercontent.com/${REPO}/${BRANCH}/slides/nano-banana-showcase/02-desempenho-escolar.png`,
  `https://raw.githubusercontent.com/${REPO}/${BRANCH}/slides/nano-banana-showcase/03-jeito-pra-musica.png`,
  `https://raw.githubusercontent.com/${REPO}/${BRANCH}/slides/nano-banana-showcase/04-aula-particular.png`,
  `https://raw.githubusercontent.com/${REPO}/${BRANCH}/slides/nano-banana-showcase/05-pratica-10min.png`
];

// Buffer free não suporta firstComment — hashtags vão no fim do caption.
const CAPTION = `Showcase Vera × Nano Banana — pipeline visual EBS Aprendiz.

5 cenas geradas com prompts cinematográficos da agente Vera, renderizados em 3:4 portrait pelo Gemini 2.5 Flash Image.

Custo total da bateria: ~US$ 0,20.

✦ Aqui em Corbélia, no EBS Aprendiz, ensinamos com método.
✦ Vagas presenciais — Av. Minas Gerais, 57, Centro.

@aprendiz.ebs

.
.
.
#aprenderviolão #aulasdeviolão #corbeliapr #ebsaprendiz #aprendizadomusical #metodomusical #musicaparafilhos`;

(async () => {
  console.log('🔵 Buffer — criando DRAFT (sem publicar)\n');
  console.log(`Channel: @aprendiz.ebs (${CHANNEL_ID})`);
  console.log(`Imagens: ${IMAGE_URLS.length} (carrossel)`);
  console.log(`Caption: ${CAPTION.substring(0, 80)}…\n`);

  try {
    const post = await buffer.createPost({
      token:     TOKEN,
      channelId: CHANNEL_ID,
      text:      CAPTION,
      imageUrls: IMAGE_URLS,
      draft:     true  // ← KEY: salva como draft, NÃO publica
    });
    console.log('✅ Draft criado com sucesso!');
    console.log(`   Post ID: ${post.id}`);
    console.log(`   Status:  ${post.status}`);
    console.log(`   Texto:   ${(post.text || '').substring(0, 60)}…`);
    console.log(`   Criado:  ${post.createdAt || '?'}`);
    console.log(`\n📱 Verifique em: https://publish.buffer.com/drafts`);
    console.log(`   (Buffer deve mostrar o draft com as 5 imagens em carrossel)`);
    console.log(`\n🗑️  Para deletar: node -e "require('./scripts/buffer-api').deletePost({ token:'${'$'}{BUFFER_ACCESS_TOKEN}', postId:'${post.id}' })"`);
  } catch (err) {
    console.error('❌', err.message);
    if (err.graphqlErrors) console.error('   Detalhes:', JSON.stringify(err.graphqlErrors, null, 2));
    process.exit(1);
  }
})();
