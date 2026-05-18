#!/usr/bin/env node
/**
 * Teste: gemini-2.5-flash-image aceita imageConfig.aspectRatio?
 * Tenta 3 variações de onde colocar o param para descobrir qual funciona.
 */
'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const envPath = path.join(__dirname, '..', '.env');
fs.readFileSync(envPath,'utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim();});
const KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-image';
const PROMPT = 'Medium shot, vertical portrait. Adult brazilian woman around 35 teaching classical guitar to a child in a simple home music studio in Corbélia, golden hour warm light through window. Photorealistic, documentary style. Clean background — no text, no signs.';

const OUT_DIR = path.join(__dirname, '..', 'tmp', 'aspect-test');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 3 variações de payload
const variants = [
  {
    name: 'A_imageConfig_in_generationConfig',
    body: {
      contents: [{ role:'user', parts:[{ text: PROMPT }] }],
      generationConfig: {
        responseModalities: ['IMAGE','TEXT'],
        candidateCount: 1,
        imageConfig: { aspectRatio: '3:4' }
      }
    }
  },
  {
    name: 'B_imageConfig_top_level',
    body: {
      contents: [{ role:'user', parts:[{ text: PROMPT }] }],
      generationConfig: { responseModalities:['IMAGE','TEXT'], candidateCount: 1 },
      imageConfig: { aspectRatio: '3:4' }
    }
  },
  {
    name: 'C_aspectRatio_in_generationConfig',
    body: {
      contents: [{ role:'user', parts:[{ text: PROMPT }] }],
      generationConfig: {
        responseModalities: ['IMAGE','TEXT'],
        candidateCount: 1,
        aspectRatio: '3:4'
      }
    }
  }
];

function call(body){
  return new Promise((resolve,reject)=>{
    const json = JSON.stringify(body);
    const req = https.request({
      hostname:'generativelanguage.googleapis.com',
      path:`/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(json)}
    },res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));
      res.on('end',()=>{
        const raw=Buffer.concat(chunks).toString('utf8');
        if(res.statusCode!==200) return reject(new Error(`HTTP ${res.statusCode}: ${raw.substring(0,400)}`));
        let d; try{d=JSON.parse(raw);}catch{return reject(new Error('non-json'));}
        const parts = d.candidates?.[0]?.content?.parts;
        if(!parts) return reject(new Error('no parts: '+raw.substring(0,200)));
        const img = parts.find(p=>p.inlineData?.data);
        if(!img) return reject(new Error('no inlineData'));
        resolve({ b64: img.inlineData.data, mime: img.inlineData.mimeType||'image/png'});
      });
    });
    req.on('error',reject);
    req.write(json); req.end();
  });
}

function readDims(buf){
  if(buf[0]===0x89&&buf[1]===0x50){return {w:buf.readUInt32BE(16),h:buf.readUInt32BE(20)};}
  if(buf[0]===0xff&&buf[1]===0xd8){
    let i=2;while(i<buf.length){if(buf[i]===0xff&&[0xc0,0xc1,0xc2].includes(buf[i+1])){return {h:buf.readUInt16BE(i+5),w:buf.readUInt16BE(i+7)};}const len=buf.readUInt16BE(i+2);if(!len||len<2)break;i+=2+len;}
  }
  return {w:0,h:0};
}

(async()=>{
  for(const v of variants){
    process.stdout.write(`Test ${v.name}... `);
    try{
      const start=Date.now();
      const {b64,mime} = await call(v.body);
      const ext = mime.includes('jpeg')?'jpg':'png';
      const fp = path.join(OUT_DIR, `${v.name}.${ext}`);
      const buf = Buffer.from(b64,'base64');
      fs.writeFileSync(fp, buf);
      const {w,h} = readDims(buf);
      const ratio = (w/h).toFixed(2);
      const ok = Math.abs(w/h - 0.75) < 0.05;
      console.log(`${ok?'✅':'⚠️'} ${w}x${h} ratio=${ratio} ${Date.now()-start}ms`);
    }catch(e){
      console.log(`❌ ${e.message.substring(0,160)}`);
    }
  }
})();
