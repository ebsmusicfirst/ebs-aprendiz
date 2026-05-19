#!/usr/bin/env node
/**
 * Gera 5 imagens nano-banana com prompts da Vera para showcase visual.
 * Output: slides/nano-banana-showcase/<slug>.png (1080-style portrait)
 *
 * Uso: node scripts/generate-showcase-images.js
 */
'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const envPath = path.join(__dirname, '..', '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
});
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('❌ GEMINI_API_KEY ausente'); process.exit(1); }

const MODEL = 'gemini-2.5-flash-image';

// Prompts da Vera — 5 cenas EBS diversas
const SCENES = [
  {
    slug: '01-guitarra-sozinho',
    title: 'Por que você não aprende guitarra sozinho',
    prompt: 'Close-up portrait, 3:4 vertical composition. Teenager around 16, alone in dimly-lit suburban bedroom in Brazil, sitting on the edge of an unmade bed with a worn electric guitar in lap, frustrated expression looking down at the fretboard, scattered guitar tabs and a smartphone showing a paused YouTube tutorial on the floor next to him. Single warm desk lamp as key light, cool blue evening light bleeding through a half-closed window. Shot on 50mm lens, shallow depth of field at f/2.0, photorealistic film grain, melancholic and slightly defeated mood. Clean background — no posters, no text on walls, no logos.'
  },
  {
    slug: '02-desempenho-escolar',
    title: 'Música e desempenho escolar',
    prompt: 'Medium shot, 3:4 vertical composition. Child around 9 years old, brazilian girl with simple home clothes, sitting at a wooden kitchen table after school, school notebook open on one side and a small classical guitar on the other, looking at the guitar with quiet curiosity while a pencil rests in her hand. Late afternoon golden hour light through a single window. Shot on 35mm lens, documentary photography style, Fuji film color palette, warm and hopeful mood. Clean background — no text on walls, no signs, no posters.'
  },
  {
    slug: '03-jeito-pra-musica',
    title: 'Como saber se meu filho leva jeito pra música',
    prompt: 'Wide shot from doorway perspective, 3:4 vertical composition. A brazilian mother around 38, framed slightly out of focus in the foreground at the edge of the doorway, watching her son around 7 years old who sits cross-legged on the living room floor, completely absorbed playing simple notes on a small electronic keyboard, his head tilted listening to the sound he just made. Warm Brazilian living room with simple decor, late golden hour light through the window. Shot on 50mm lens, shallow depth of field favoring the child, photorealistic, observational documentary mood, tender quiet wonder. Clean background — no text on walls, no signs, no posters, no logos.'
  },
  {
    slug: '04-aula-particular',
    title: 'Aulas online não funcionam pra iniciante',
    prompt: 'Medium two-shot, 3:4 vertical composition. Brazilian guitar teacher around 35 with kind eyes, sitting beside an adult student around 28 in a small home music studio in Corbélia, both holding acoustic guitars, the teacher reaching over to adjust the students hand position on the neck of the guitar with patient focus, the student looking down concentrated. Warm afternoon natural light from a single window left side. Shot on 50mm lens, photorealistic documentary style, intimate teaching moment. Clean background — no text, no signs, no posters.'
  },
  {
    slug: '05-pratica-10min',
    title: '10 minutos por dia vencem 2h no fim de semana',
    prompt: 'Macro detail shot, 3:4 vertical composition. Close-up of an adult hand pressing a chord on the fretboard of an acoustic guitar, fingers slightly worn, simple watch on wrist, the guitar resting on jeans-clad legs in a domestic setting. Soft morning window light from the side, shallow depth of field on the fingertips. Shot on 85mm macro lens at f/2.8, photorealistic film grain, focused calm dedication mood. Clean background — no text, no signs.'
  }
];

const OUT_DIR = path.join(__dirname, '..', 'slides', 'nano-banana-showcase');
fs.mkdirSync(OUT_DIR, { recursive: true });

function generate(scene) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: scene.prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        candidateCount: 1,
        imageConfig: { aspectRatio: '3:4' }
      }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${raw.substring(0, 300)}`));
        let d; try { d = JSON.parse(raw); } catch { return reject(new Error('non-json')); }
        const parts = d.candidates?.[0]?.content?.parts;
        if (!parts) return reject(new Error('no parts'));
        const img = parts.find(p => p.inlineData?.data);
        if (!img) return reject(new Error('no inlineData'));
        const ext = (img.inlineData.mimeType || '').includes('jpeg') ? 'jpg' : 'png';
        const fp  = path.join(OUT_DIR, `${scene.slug}.${ext}`);
        fs.writeFileSync(fp, Buffer.from(img.inlineData.data, 'base64'));
        resolve({ scene, file: fp, size: fs.statSync(fp).size });
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

(async () => {
  console.log(`🎬 Vera escreveu ${SCENES.length} prompts cinematográficos.`);
  console.log(`🍌 Gerando com ${MODEL}…\n`);
  for (const scene of SCENES) {
    const start = Date.now();
    process.stdout.write(`${scene.slug.padEnd(28)} … `);
    try {
      const { file, size } = await generate(scene);
      console.log(`✅ ${(size/1024).toFixed(0)}KB (${Date.now()-start}ms)`);
    } catch (e) {
      console.log(`❌ ${e.message.substring(0, 100)}`);
    }
  }
  console.log(`\n📁 Output: ${OUT_DIR}`);
})();
