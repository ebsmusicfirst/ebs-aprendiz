#!/usr/bin/env node
/**
 * EBS Aprendiz — Teste de Geração de Imagem via Gemini / Imagen 4
 *
 * Testa a API do Google AI Studio para geração de imagens.
 * Uso: node scripts/test-gemini-image.js [modelo] [prompt]
 *
 * Modelos disponíveis:
 *   imagen-4.0-generate-001       (qualidade máxima)
 *   imagen-4.0-fast-generate-001  (rápido/barato — padrão para testes)
 *   imagen-4.0-ultra-generate-001 (ultra qualidade)
 *   nano-banana-pro-preview        (modelo proprietário "nanobanana")
 *   gemini-3.1-flash-image-preview (Gemini nativo)
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

// Load .env manually (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY não encontrada no .env');
  process.exit(1);
}

const MODEL  = process.argv[2] || 'imagen-4.0-fast-generate-001';
const PROMPT = process.argv[3] || 'Young teenager deeply focused learning to play electric guitar in a music studio, warm ambient lighting, authentic expression of concentration and joy, portrait orientation, photorealistic, professional photography style, shallow depth of field';

const OUT_DIR = path.join(__dirname, '..', 'tmp', 'gemini-test');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── API Call ──────────────────────────────────────────────────────────────────

const isImagen   = MODEL.startsWith('imagen');
const isGemini   = !isImagen; // everything else uses generateContent

const endpoint   = isImagen
  ? `/v1beta/models/${MODEL}:predict`
  : `/v1beta/models/${MODEL}:generateContent`;

const body = isImagen
  ? JSON.stringify({
      instances: [{ prompt: PROMPT }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '3:4',   // portrait — melhor para Instagram
        safetyFilterLevel: 'BLOCK_ONLY_HIGH',
        personGeneration: 'ALLOW_ADULT',
      }
    })
  : JSON.stringify({
      contents: [{ role: 'user', parts: [
        { text: PROMPT + '\n\nGenerate an image.' }
      ]}],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        candidateCount: 1,
      }
    });

console.log(`🎨 Gerando imagem com ${MODEL}...`);
console.log(`📝 Prompt: ${PROMPT.substring(0, 80)}...`);

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: endpoint + '?key=' + API_KEY,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  }
};

const req = https.request(options, (res) => {
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');

    if (res.statusCode !== 200) {
      console.error(`❌ HTTP ${res.statusCode}:`);
      try {
        const err = JSON.parse(raw);
        console.error(JSON.stringify(err, null, 2));
      } catch {
        console.error(raw.substring(0, 500));
      }
      process.exit(1);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('❌ Resposta não é JSON válido:', raw.substring(0, 200));
      process.exit(1);
    }

    // ── Extrair imagem base64 ────────────────────────────────────────────────

    let b64 = null;
    let mimeType = 'image/png';

    if (isImagen) {
      // Imagen response format
      const pred = data.predictions && data.predictions[0];
      if (!pred) {
        console.error('❌ Sem predictions na resposta:');
        console.error(JSON.stringify(data, null, 2));
        process.exit(1);
      }
      if (pred.bytesBase64Encoded) {
        b64 = pred.bytesBase64Encoded;
        mimeType = pred.mimeType || 'image/png';
      } else if (pred.image && pred.image.imageBytes) {
        b64 = pred.image.imageBytes;
        mimeType = pred.image.mimeType || 'image/png';
      } else {
        console.error('❌ Formato de imagem não reconhecido. Resposta:');
        console.error(JSON.stringify(pred, null, 2));
        process.exit(1);
      }
    } else {
      // Gemini response format
      const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      if (!parts) {
        console.error('❌ Sem candidates/parts na resposta:');
        console.error(JSON.stringify(data, null, 2));
        process.exit(1);
      }
      const imgPart = parts.find(p => p.inlineData && p.inlineData.data);
      if (!imgPart) {
        console.error('❌ Sem inlineData na resposta. Parts recebidas:');
        parts.forEach(p => console.error(' -', JSON.stringify(Object.keys(p))));
        process.exit(1);
      }
      b64 = imgPart.inlineData.data;
      mimeType = imgPart.inlineData.mimeType || 'image/png';
    }

    // ── Salvar imagem ────────────────────────────────────────────────────────

    const ext  = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(OUT_DIR, `test-${MODEL.replace(/\./g, '_')}-${ts}.${ext}`);

    fs.writeFileSync(file, Buffer.from(b64, 'base64'));

    console.log(`\n✅ Imagem salva: ${file}`);
    console.log(`   Modelo: ${MODEL}`);
    console.log(`   Tamanho: ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
    console.log(`   Mime: ${mimeType}`);
    console.log(`\n📂 OUTPUT:${file}`);
  });
});

req.on('error', e => {
  console.error('❌ Erro de rede:', e.message);
  process.exit(1);
});

req.write(body);
req.end();
