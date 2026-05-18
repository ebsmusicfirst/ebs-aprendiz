#!/usr/bin/env node
/**
 * A/B Test — Imagen 4 Fast vs gemini-2.5-flash-image
 * Gera 3 prompts (escritos pela Vera) em ambos modelos para comparação visual.
 *
 * Uso: node scripts/ab-test-image-models.js
 * Output: tmp/ab-test/<theme>-<model>.{jpg|png}
 */
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Carregar .env ─────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('❌ GEMINI_API_KEY ausente'); process.exit(1); }

// ── Prompts da Vera ───────────────────────────────────────────────────────────
const PROMPTS = [
  {
    id: 'guitarra-sozinho',
    label: 'Por que você não aprende guitarra sozinho',
    prompt: 'Close-up portrait, 3:4 vertical composition. Teenager around 16, alone in dimly-lit suburban bedroom in Brazil, sitting on the edge of an unmade bed with a worn electric guitar in lap, frustrated expression looking down at the fretboard, scattered guitar tabs and a smartphone showing a paused YouTube tutorial on the floor next to him. Single warm desk lamp as key light, cool blue evening light bleeding through a half-closed window. Shot on 50mm lens, shallow depth of field at f/2.0, photorealistic film grain, melancholic and slightly defeated mood. Clean background — no posters, no text on walls, no logos.'
  },
  {
    id: 'desempenho-escolar',
    label: 'Música e desempenho escolar',
    prompt: 'Medium shot, 3:4 vertical composition. Child around 9 years old, brazilian girl with simple home clothes, sitting at a wooden kitchen table after school, school notebook open on one side and a small classical guitar on the other, looking at the guitar with quiet curiosity while a pencil rests in her hand. Late afternoon golden hour light through a single window. Shot on 35mm lens, documentary photography style, Fuji film color palette, warm and hopeful mood. Clean background — no text on walls, no signs, no posters.'
  },
  {
    id: 'jeito-pra-musica',
    label: 'Como saber se meu filho leva jeito pra música',
    prompt: 'Wide shot from doorway perspective, 3:4 vertical composition. A brazilian mother around 38, framed slightly out of focus in the foreground at the edge of the doorway, watching her son around 7 years old who sits cross-legged on the living room floor, completely absorbed playing simple notes on a small electronic keyboard, his head tilted listening to the sound he just made. Warm Brazilian living room with simple decor, late golden hour light through the window. Shot on 50mm lens, shallow depth of field favoring the child, photorealistic, observational documentary mood, tender quiet wonder. Clean background — no text on walls, no signs, no posters, no logos.'
  }
];

const MODELS = [
  { id: 'imagen-4.0-fast-generate-001', short: 'imagen-fast', kind: 'imagen' },
  { id: 'gemini-2.5-flash-image',       short: 'gemini-2_5', kind: 'gemini' }
];

const OUT_DIR = path.join(__dirname, '..', 'tmp', 'ab-test');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Chamada à API ─────────────────────────────────────────────────────────────
function callApi(model, prompt) {
  return new Promise((resolve, reject) => {
    const isImagen = model.kind === 'imagen';
    const endpoint = isImagen
      ? `/v1beta/models/${model.id}:predict`
      : `/v1beta/models/${model.id}:generateContent`;

    const body = isImagen
      ? JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '3:4',
            safetyFilterLevel: 'BLOCK_ONLY_HIGH',
            personGeneration: 'ALLOW_ADULT'
          }
        })
      : JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt + '\n\nGenerate an image.' }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'], candidateCount: 1 }
        });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: endpoint + '?key=' + API_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${raw.substring(0, 200)}`));
        let data; try { data = JSON.parse(raw); } catch { return reject(new Error('Resp não-JSON')); }
        let b64, mime;
        if (isImagen) {
          const p = data.predictions && data.predictions[0];
          if (!p) return reject(new Error('Sem predictions'));
          b64 = p.bytesBase64Encoded || (p.image && p.image.imageBytes);
          mime = p.mimeType || (p.image && p.image.mimeType) || 'image/png';
        } else {
          const parts = data.candidates?.[0]?.content?.parts;
          if (!parts) return reject(new Error('Sem candidates/parts'));
          const img = parts.find(p => p.inlineData && p.inlineData.data);
          if (!img) return reject(new Error('Sem inlineData'));
          b64 = img.inlineData.data;
          mime = img.inlineData.mimeType || 'image/png';
        }
        if (!b64) return reject(new Error('Sem dados de imagem'));
        resolve({ b64, mime });
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ── Executor ──────────────────────────────────────────────────────────────────
(async () => {
  const results = [];
  for (const p of PROMPTS) {
    for (const m of MODELS) {
      const filename = `${p.id}__${m.short}.${m.kind === 'gemini' ? 'jpg' : 'png'}`;
      const outPath  = path.join(OUT_DIR, filename);
      const start    = Date.now();
      try {
        const { b64, mime } = await callApi(m, p.prompt);
        const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
        const finalPath = outPath.replace(/\.(jpg|png)$/, `.${ext}`);
        fs.writeFileSync(finalPath, Buffer.from(b64, 'base64'));
        const sizeKb = (fs.statSync(finalPath).size / 1024).toFixed(0);
        const ms     = Date.now() - start;
        results.push({ theme: p.label, model: m.short, file: finalPath, sizeKb, ms, ok: true });
        console.log(`✅ ${p.id} × ${m.short} → ${path.basename(finalPath)} (${sizeKb}KB, ${ms}ms)`);
      } catch (err) {
        results.push({ theme: p.label, model: m.short, error: err.message, ok: false });
        console.log(`❌ ${p.id} × ${m.short} → ${err.message}`);
      }
    }
  }
  console.log('\n=== A/B SUMMARY ===');
  PROMPTS.forEach(p => {
    console.log(`\n📋 ${p.label}`);
    results.filter(r => r.theme === p.label).forEach(r => {
      if (r.ok) console.log(`   ${r.model.padEnd(12)} → ${r.file} (${r.sizeKb}KB, ${r.ms}ms)`);
      else      console.log(`   ${r.model.padEnd(12)} → ERRO: ${r.error}`);
    });
  });
})();
