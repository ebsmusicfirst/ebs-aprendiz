#!/usr/bin/env node
/**
 * Style exploration: 4 direções artísticas pro mesmo tema (guitarra-sozinho).
 * Output: slides/style-exploration/<style>.png
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
const MODEL = 'gemini-2.5-flash-image';

const STYLES = [
  {
    slug: 'A-editorial-illustration',
    label: 'Editorial Illustration (NYTimes/New Yorker)',
    prompt: 'Editorial magazine illustration, 3:4 vertical composition. Teenage boy around 16 alone in a dimly-lit bedroom playing an electric guitar with frustrated expression, sitting on bed edge. Flat color palette limited to deep navy blue, warm cream white, gold accent and burnt amber tones — no photographic detail. Simplified geometric shapes, bold negative space, slight screen-printed texture. Style of Christoph Niemann meets Malika Favre, editorial sophistication. Strictly NOT photorealistic, NOT photographic, NOT 3D render. Pure illustration only.'
  },
  {
    slug: 'B-risograph-print',
    label: 'Risograph Print (indie zine)',
    prompt: 'Risograph print poster, 3:4 vertical composition. Teenager around 16 alone in a suburban Brazilian bedroom holding an electric guitar, frustrated melancholic mood. Two-color riso overprint: golden yellow and deep navy ink only, nothing else. Visible halftone dot pattern, slight color registration offset between layers, grainy uncoated paper texture. Bold flat shapes, slight imperfection in the print, indie zine aesthetic. NOT photorealistic, NOT digital painting, NOT smooth — must look hand-printed.'
  },
  {
    slug: 'C-cinematic-duotone',
    label: 'Cinematic + Duotone (foto tratada)',
    prompt: 'Cinematic film still, 3:4 vertical composition. Teenage boy around 16 alone in dimly-lit Brazilian bedroom with electric guitar in lap, frustrated mood. Heavy two-tone color grade: rich golden amber for highlights and inky deep navy for shadows ONLY — no other colors visible. Cinematic anamorphic framing, subtle lens flare, heavy filmic grain. A24 movie aesthetic, like a Sofia Coppola film still. Photographic base but heavily graphically treated.'
  },
  {
    slug: 'D-vintage-music-poster',
    label: 'Vintage Music Poster (Saul Bass / Blue Note)',
    prompt: 'Vintage 1960s music school screen-printed poster, 3:4 vertical composition. Stylized teenage figure holding electric guitar in silhouette, slightly slumped pose suggesting struggle and yearning. Screen-printed look: limited 4-color flat palette (warm cream background, mustard gold, deep burnt brown, ink black), bold geometric shapes, abstracted human figure, visible ink texture and slight registration imperfection. Saul Bass meets Blue Note Records cover aesthetic. Strictly NOT photorealistic, NOT contemporary digital art.'
  }
];

const OUT_DIR = path.join(__dirname, '..', 'slides', 'style-exploration');
fs.mkdirSync(OUT_DIR, { recursive: true });

function generate(style) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: style.prompt }] }],
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
        const d = JSON.parse(raw);
        const parts = d.candidates?.[0]?.content?.parts;
        const img = parts?.find(p => p.inlineData?.data);
        if (!img) return reject(new Error('no inlineData'));
        const ext = (img.inlineData.mimeType || '').includes('jpeg') ? 'jpg' : 'png';
        const fp = path.join(OUT_DIR, `${style.slug}.${ext}`);
        fs.writeFileSync(fp, Buffer.from(img.inlineData.data, 'base64'));
        resolve({ style, file: fp, size: fs.statSync(fp).size });
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

(async () => {
  console.log(`🎨 Style exploration — ${STYLES.length} estilos × tema "guitarra-sozinho"\n`);
  for (const s of STYLES) {
    const start = Date.now();
    process.stdout.write(`${s.slug.padEnd(30)} … `);
    try {
      const { size } = await generate(s);
      console.log(`✅ ${(size/1024).toFixed(0)}KB (${Date.now()-start}ms)`);
    } catch (e) {
      console.log(`❌ ${e.message.substring(0, 100)}`);
    }
  }
  console.log(`\n📁 ${OUT_DIR}`);
})();
