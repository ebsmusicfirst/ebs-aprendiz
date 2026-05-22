#!/usr/bin/env node
/**
 * Gera os 15 carrosséis tweet-v5 (texto puro, sem imagens).
 * Uso: node scripts/generate-tweet-v5.js
 *
 * - Lê ASSETS/logo-ebs-aprendiz.png como base64
 * - Gera carrosseis/tweet-v5-*.html com 4 slides cada
 * - Escreve uma entrada em queue.json por carrossel (pending_approval)
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const BASE  = path.resolve(__dirname, '..');
const QUEUE = path.join(BASE, 'queue.json');

// ─── Logo base64 ──────────────────────────────────────────────────────────────
const logoPath = path.join(BASE, 'ASSETS', 'logo-ebs-aprendiz.png');
const LOGO_B64 = fs.existsSync(logoPath)
  ? 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
  : '';

// ─── Verified badge SVG ───────────────────────────────────────────────────────
const BADGE = '<svg width="17" height="17" viewBox="0 0 24 24"><path fill="#1D9BF0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>';

// ─── Template builder ─────────────────────────────────────────────────────────
function makeSlide(index, total, paragraphs) {
  const paras = paragraphs.map(p => '<p>' + p + '</p>').join('\n      ');
  return [
    '  <div class="x-slide">',
    '    <div class="slide-counter">' + (index + 1) + ' / ' + total + '</div>',
    '    <div class="tw-header">',
    '      <div class="tw-avatar"><img src="' + LOGO_B64 + '" alt="EBS"></div>',
    '      <div class="tw-names">',
    '        <div class="tw-name">EBS Aprendiz ' + BADGE + '</div>',
    '        <div class="tw-handle">@aprendiz.ebs</div>',
    '      </div>',
    '    </div>',
    '    <div class="tw-body">',
    '      ' + paras,
    '    </div>',
    '  </div>',
  ].join('\n');
}

function makeDots(total) {
  return Array.from({ length: total }, (_, i) =>
    '<span class="dot' + (i === 0 ? ' active' : '') + '"></span>'
  ).join('');
}

function buildHTML(id, titleAttr, slides) {
  const total = slides.length;
  const slideHtml = slides.map((s, i) => makeSlide(i, total, s)).join('\n\n');
  const dots = makeDots(total);

  return '<!DOCTYPE html>\n' +
'<html lang="pt-BR">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<title>EBS Aprendiz — ' + titleAttr + '</title>\n' +
'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet">\n' +
'<style>\n' +
'* { margin:0; padding:0; box-sizing:border-box; }\n' +
'body { background:#e6e9ed; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:40px 20px; font-family:\'Inter\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif; }\n' +
'.x-frame { width:420px; border-radius:14px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.18); background:#fff; }\n' +
'.carousel-viewport { width:420px; height:525px; overflow:hidden; cursor:grab; user-select:none; position:relative; }\n' +
'.carousel-viewport:active { cursor:grabbing; }\n' +
'.carousel-track { display:flex; height:100%; transition:transform .3s cubic-bezier(.25,.46,.45,.94); }\n' +
'.x-slide { min-width:420px; height:525px; background:#fff; position:relative; display:flex; flex-direction:column; padding:22px 20px 18px; }\n' +
'.slide-counter { position:absolute; top:14px; right:14px; background:rgba(0,0,0,0.45); color:#fff; font-size:11px; font-weight:500; padding:3px 10px; border-radius:20px; z-index:10; }\n' +
'.tw-header { display:flex; align-items:flex-start; gap:10px; margin-bottom:14px; flex-shrink:0; }\n' +
'.tw-avatar { width:46px; height:46px; border-radius:50%; background:#000; overflow:hidden; flex-shrink:0; }\n' +
'.tw-avatar img { width:100%; height:auto; object-fit:cover; object-position:center 55%; display:block; }\n' +
'.tw-names { display:flex; flex-direction:column; justify-content:center; }\n' +
'.tw-name { font-size:15px; font-weight:500; color:#0F1419; line-height:1.3; display:flex; align-items:center; gap:4px; }\n' +
'.tw-handle { font-size:14px; color:#536471; line-height:1.3; }\n' +
'.tw-body { font-size:22px; font-weight:400; line-height:1.55; color:#0F1419; flex:1; overflow:hidden; }\n' +
'.tw-body p { margin-bottom:18px; }\n' +
'.tw-body p:last-child { margin-bottom:0; }\n' +
'.x-dots { display:flex; justify-content:center; gap:5px; padding:9px 0 10px; background:#f7f7f7; border-top:1px solid #eee; }\n' +
'.dot { width:6px; height:6px; border-radius:50%; background:#ccc; transition:all .2s; }\n' +
'.dot.active { background:#D4A017; transform:scale(1.3); }\n' +
'.x-actions { display:flex; align-items:center; gap:18px; padding:10px 18px 12px; background:#fff; border-top:1px solid #EFF3F4; }\n' +
'.x-actions svg { width:20px; height:20px; opacity:.4; }\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="x-frame">\n' +
'<div class="carousel-viewport" id="vp">\n' +
'<div class="carousel-track" id="track">\n\n' +
slideHtml + '\n\n' +
'</div>\n' +
'</div>\n' +
'<div class="x-dots" id="dots">' + dots + '</div>\n' +
'<div class="x-actions">\n' +
'  <svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>\n' +
'  <svg viewBox="0 0 24 24" fill="none"><path d="M17 2l-10 10 10 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 12l4-4-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>\n' +
'  <svg viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>\n' +
'</div>\n' +
'</div>\n\n' +
'<script>\n' +
'var cur=0;\n' +
'var track=document.getElementById("track");\n' +
'var vp=document.getElementById("vp");\n' +
'var dots=document.querySelectorAll(".dot");\n' +
'var total=' + total + ';\n' +
'var startX=0;\n' +
'function goTo(n){cur=Math.max(0,Math.min(n,total-1));track.style.transform="translateX(-"+(cur*420)+"px)";dots.forEach(function(d,i){d.classList.toggle("active",i===cur);});}\n' +
'vp.addEventListener("pointerdown",function(e){startX=e.clientX;});\n' +
'vp.addEventListener("pointerup",function(e){var dx=e.clientX-startX;if(Math.abs(dx)>40){goTo(dx<0?cur+1:cur-1);}});\n' +
'</script>\n' +
'</body>\n' +
'</html>';
}

// ─── Carrossel data ────────────────────────────────────────────────────────────
// Cada entrada: { id, titleAttr, title, caption, hashtags, scheduledFor, slides[] }
// slides = array de arrays de parágrafos

const CAROUSELS = [
  {
    id: 'tweet-v5-tocar-de-ouvido-02',
    titleAttr: 'tocar de ouvido',
    title: 'Por que tocar de ouvido é uma armadilha',
    caption: 'Aprendi a primeira posição de Dm sozinho. Uma semana. Achei que tinha descoberto o jeito certo de aprender guitarra.\n\nNão tinha.\n\nTocar de ouvido vai te levar até certo ponto. Depois para. E a culpa não é sua.\n\n14 anos ensinando em Corbélia. O aluno que chega travado no mesmo ponto há meses — a primeira coisa que fazemos é olhar de fora.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR\n@aprendiz.ebs',
    hashtags: '#guitarra #violao #autodidata #aprendermusica #aprendizebs #ebs #corbelia #metodologia',
    slides: [
      ['Aprendi a primeira posição de Dm sozinho. Levei uma semana. Achei que tinha descoberto o jeito certo de aprender guitarra.'],
      ['Tocar de ouvido dá uma sensação de liberdade difícil de abrir mão. Você acha que está progredindo. Está. Mas só até certo ponto.'],
      ['Depois para. Não porque você ficou menos dedicado. Porque o ouvido não te ensina o que seus dedos estão errando.'],
      ['14 anos vendo isso em Corbélia. O aluno que chega travado no mesmo ponto há meses. O primeiro passo é sempre o mesmo: alguém olhando de fora. @aprendiz.ebs'],
    ]
  },
  {
    id: 'tweet-v5-pratica-10min-03',
    titleAttr: 'pratica 10 minutos',
    title: 'A prática de 10 minutos que muda tudo',
    caption: 'A maioria das pessoas acha que precisa de uma hora por dia para aprender instrumento.\n\nNão precisa.\n\nDez minutos focados, todo dia, com um objetivo específico. Isso supera uma hora de "vou ver no que dá".\n\nO problema não é o tempo. É saber o que praticar.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR\n@aprendiz.ebs',
    hashtags: '#pratica #metodologia #aprendermusica #violao #guitarra #aprendizebs #ebs #corbelia',
    slides: [
      ['A maioria das pessoas acha que precisa de uma hora por dia para aprender instrumento. Não precisa.'],
      ['Dez minutos focados, todos os dias, com um objetivo específico. Isso é mais efetivo do que uma hora de "vou ver no que dá".'],
      ['O problema não é o tempo. É que a maioria pratica sem saber o que está praticando. Toca a parte que já sabe. Evita a que não sabe.'],
      ['Na aula no EBS, você sai sabendo exatamente o que fazer nos próximos 7 dias. Não é vago. É um mapa. @aprendiz.ebs — Corbélia-PR'],
    ]
  },
  {
    id: 'tweet-v5-quanto-tempo-04',
    titleAttr: 'quanto tempo para tocar',
    title: 'Quanto tempo leva para tocar a música que você quer',
    caption: 'Essa é a pergunta que mais recebo: quanto tempo para tocar a música que eu quero?\n\nDepende da música. Mas com método e 10 minutos por dia: 4 a 8 semanas para a primeira música completa.\n\nSem método? Pode ser 6 meses para a mesma coisa. Ou não acontecer nunca.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR\n@aprendiz.ebs',
    hashtags: '#aprendermusica #tempo #metodo #violao #guitarra #aprendizebs #ebs #corbelia',
    slides: [
      ['Essa é a pergunta que mais recebo: "quanto tempo para tocar a música que eu quero?"'],
      ['Depende da música. Mas aluno com método, praticando 10 minutos por dia, toca a primeira música completa em 4 a 8 semanas.'],
      ['Sem método? Pode demorar 6 meses para a mesma coisa. Ou não acontecer nunca. Não porque o aluno é ruim. Porque o caminho não é claro.'],
      ['A diferença entre 6 semanas e 6 meses é o método. É o que ensinamos aqui em Corbélia desde 2011. @aprendiz.ebs'],
    ]
  },
  {
    id: 'tweet-v5-violao-ou-guitarra-05',
    titleAttr: 'violao ou guitarra',
    title: 'Violão ou guitarra — qual é mais fácil de aprender',
    caption: 'Todo mês alguém me pergunta: qual é mais fácil, violão ou guitarra?\n\nA resposta honesta: são instrumentos com dificuldades diferentes. O que importa é qual dos dois te motiva.\n\nInstrumento que motiva é instrumento que você pratica. Instrumento que você pratica é instrumento que você aprende.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR\n@aprendiz.ebs',
    hashtags: '#violao #guitarra #aprendermusica #escoladeinstrumento #aprendizebs #ebs #corbelia',
    slides: [
      ['Todo mês alguém me pergunta: qual é mais fácil de aprender, violão ou guitarra?'],
      ['A resposta honesta: são instrumentos diferentes com dificuldades diferentes. Violão acústico dói mais no começo. Guitarra elétrica é mais leve, mas o som exige equalização.'],
      ['O que importa de verdade é qual dos dois te motiva. Instrumento que motiva é instrumento que você pratica. Instrumento que você pratica é instrumento que você aprende.'],
      ['Aqui no EBS a gente orienta essa escolha na primeira conversa. Sem empurrar o que está na prateleira. Só o que faz sentido pra você. @aprendiz.ebs'],
    ]
  },
  {
    id: 'tweet-v5-criancas-musicos-06',
    titleAttr: 'criancas e musica',
    title: 'O que toda criança que virou bom músico tinha em casa',
    caption: 'Décadas de pesquisa em educação musical concordam: o fator decisivo não é talento. É o ambiente familiar.\n\nCriança cujos pais param o que estão fazendo para ouvir: "mostra o que você aprendeu".\n\nEsse gesto pesa mais do que horas extras de prática.\n\nNo EBS a gente faz a parte que depende da escola. A parte de vocês, pais, é insubstituível.\n\n@aprendiz.ebs — Corbélia-PR',
    hashtags: '#criancas #musica #educacaomusical #pais #aprendizebs #ebs #corbelia #musicainfantil',
    slides: [
      ['Décadas de pesquisa em educação musical concordam em um ponto: o fator decisivo não é talento. É o ambiente familiar.'],
      ['Criança cujos pais param o que estão fazendo para ouvir: "mostra o que você aprendeu". Esse gesto. Estudos mostram que isso pesa mais do que horas extras de prática.'],
      ['O instrumento mais caro do mundo não substitui isso. Nem o melhor professor. O apoio em casa é insubstituível.'],
      ['No EBS a gente faz a parte que depende da escola. A parte de vocês, pais, é o que nenhum professor pode fazer no lugar de vocês. @aprendiz.ebs — Corbélia-PR'],
    ]
  },
  {
    id: 'tweet-v5-escola-vs-youtube-07',
    titleAttr: 'escola vs youtube',
    title: 'Aprendi mais em 3 meses de aula do que em 2 anos de YouTube',
    caption: 'Aprendi mais guitarra em 3 meses de aula do que em 2 anos de YouTube. Não estou exagerando.\n\nO problema do YouTube não é o conteúdo. É que ninguém vê o que você está fazendo errado.\n\nYouTube te ensina músicas. Professor te ensina a tocar. São coisas diferentes.\n\n@aprendiz.ebs — Av. Minas Gerais, 57, Corbélia-PR',
    hashtags: '#youtube #aulademusica #presencial #violao #guitarra #aprendizebs #ebs #corbelia',
    slides: [
      ['Aprendi mais guitarra em 3 meses de aula do que em 2 anos de YouTube. Não estou exagerando.'],
      ['O problema do YouTube não é o conteúdo. O conteúdo é bom. O problema é que ninguém vê o que você está fazendo errado.'],
      ['Pulso torcido. Postura que vai gerar dor em 6 meses. Dedilhado que soa bonito mas é ineficiente. A câmera não detecta isso. O professor detecta na hora.'],
      ['14 anos em Corbélia vendo esse padrão. YouTube te ensina músicas. Professor te ensina a tocar. São coisas diferentes. @aprendiz.ebs'],
    ]
  },
  {
    id: 'tweet-v5-aluno-travado-08',
    titleAttr: 'aluno travado desbloqueou',
    title: 'Ficou 3 anos sozinho. Desbloqueou em 6 meses.',
    caption: 'Tivemos um aluno que ficou três anos praticando sozinho. Tocava bem algumas coisas. Mas travou.\n\nEm seis meses de aula ele tocou o que não conseguia nem imaginar antes.\n\nO que mudou não foi a dedicação. Essa ele sempre teve. Mudou a estrutura.\n\n@aprendiz.ebs — Av. Minas Gerais, 57, Corbélia-PR',
    hashtags: '#metodologia #aprendermusica #guitarra #violao #aprendizebs #ebs #corbelia #desbloqueio',
    slides: [
      ['Tivemos um aluno que ficou três anos praticando sozinho. Tocava bem algumas coisas. Mas travou. Não conseguia avançar.'],
      ['Em seis meses de aula ele tocou o que não conseguia nem imaginar antes. Não porque é talentoso. Porque agora tinha alguém vendo os erros e dando o próximo passo certo.'],
      ['O que mudou não foi a dedicação. Essa ele sempre teve. Mudou a estrutura. Alguém organizando o caminho.'],
      ['Esse perfil aparece toda semana aqui: dedicado, talentoso até, mas sem estrutura. E estrutura a gente fornece. @aprendiz.ebs — Corbélia-PR'],
    ]
  },
  {
    id: 'tweet-v5-teoria-musical-09',
    titleAttr: 'teoria musical',
    title: 'Preciso aprender teoria musical para tocar?',
    caption: 'Preciso aprender teoria musical para tocar?\n\nDepende do que você quer. Se quer tocar músicas que gosta: não. Se quer compor, improvisar, entender o que está tocando: sim.\n\nA maioria dos alunos absorve teoria naturalmente durante as aulas. Não é um obstáculo.\n\n@aprendiz.ebs — Corbélia-PR',
    hashtags: '#teorialmusical #aprendermusica #violao #guitarra #aprendizebs #ebs #corbelia #musica',
    slides: [
      ['Preciso aprender teoria musical para tocar? A resposta depende do que você quer.'],
      ['Se você quer tocar músicas que gosta: não. Você começa sem teoria e aprende o mínimo conforme aparece. Se você quer compor, improvisar, entender o que toca: sim.'],
      ['A maioria dos alunos começa sem teoria e vai absorvendo naturalmente durante as aulas. Não é uma matéria separada. É contexto.'],
      ['Aqui no EBS a teoria aparece quando precisa aparecer. Nunca como obstáculo. Sempre como ferramenta. @aprendiz.ebs — Corbélia-PR'],
    ]
  },
  {
    id: 'tweet-v5-talento-mito-10',
    titleAttr: 'talento e mito',
    title: 'Músicos que parecem ter nascido sabendo não nasceram',
    caption: 'Músicos que parecem ter nascido sabendo não nasceram. Você só não viu as 10.000 horas antes.\n\nO que existe é: quem começou mais cedo, quem teve melhor método, quem teve mais estrutura em casa.\n\nEntão não venha me dizer que seu filho não tem jeito pra música. Isso não existe.\n\n@aprendiz.ebs',
    hashtags: '#talento #mito #aprendermusica #musica #violao #guitarra #aprendizebs #ebs #corbelia',
    slides: [
      ['Músicos que parecem ter nascido sabendo não nasceram. Você só não viu as 10.000 horas antes.'],
      ['O que existe é: quem começou mais cedo. Quem teve melhor método. Quem teve mais estrutura em casa. Esses três fatores explicam quase toda diferença de nível que você vê.'],
      ['Talento como fator isolado, sem as outras três coisas, não vai longe. Já vi dezenas de casos: o "talentoso" que parou e o "sem talento" que superou.'],
      ['Então não venha me dizer que seu filho não tem jeito pra música. Isso não existe. O que existe é método ou falta dele. @aprendiz.ebs'],
    ]
  },
  {
    id: 'tweet-v5-adultos-aprendem-11',
    titleAttr: 'adultos aprendem musica',
    title: 'A crença de que adulto não aprende instrumento está errada',
    caption: 'A crença de que adulto não aprende instrumento é antiga e está errada.\n\nAdulto tem vantagens que criança não tem: foco, autonomia, sabe o que quer tocar, pratica com mais consistência.\n\nTemos alunos adultos que aprenderam guitarra do zero depois dos 40. Não é exceção. É regra quando tem método.\n\n@aprendiz.ebs — Corbélia-PR',
    hashtags: '#adultos #aprendermusica #guitarra #violao #aprendizebs #ebs #corbelia #nuncelatardedemais',
    slides: [
      ['A crença de que adulto não aprende instrumento é antiga e está errada.'],
      ['Adulto tem vantagens que criança não tem: foco, autonomia, sabe o que quer tocar, consegue praticar com mais consistência. O processo é diferente, não pior.'],
      ['O que muda em adultos é o tempo de aquecimento dos dedos e a necessidade de mais repetições para memória muscular. Isso é gerenciável.'],
      ['Temos alunos adultos que aprenderam guitarra do zero depois dos 40. Não é exceção. É regra quando tem método. @aprendiz.ebs — Corbélia-PR'],
    ]
  },
  {
    id: 'tweet-v5-postura-tendinite-12',
    titleAttr: 'postura e tendinite',
    title: 'A tendinite do guitarrista não aparece do dia para a noite',
    caption: 'A tendinite do guitarrista não aparece do dia para a noite. Vem acumulando durante meses de postura errada.\n\nEm aula presencial isso aparece na primeira semana. Corrigimos antes de virar hábito.\n\nJá atendi alunos com dor crônica nos pulsos por terem aprendido sozinhos. Isso não precisava acontecer.\n\n@aprendiz.ebs — Corbélia-PR',
    hashtags: '#tendinite #postura #guitarra #violao #saude #aprendizebs #ebs #corbelia #aulaspresenciais',
    slides: [
      ['A tendinite do guitarrista não aparece do dia para a noite. Vem acumulando durante meses de postura errada.'],
      ['Pulso torcido. Polegar pressionando demais o braço. Ombro levantado. São detalhes que um vídeo não corrige porque o vídeo não te vê.'],
      ['Em aula presencial isso aparece na primeira semana. Corrigimos antes de virar hábito. Hábito ruim na guitarra leva meses para desfazer.'],
      ['Já atendi alunos com dor crônica nos pulsos por terem aprendido sozinhos. Isso não precisava acontecer. @aprendiz.ebs — Corbélia-PR'],
    ]
  },
  {
    id: 'tweet-v5-plano-de-estudo-13',
    titleAttr: 'plano de estudo',
    title: 'Você sai da sua aula sabendo o que fazer nos próximos 7 dias?',
    caption: 'Você sai da sua aula sabendo o que fazer nos próximos 7 dias?\n\nSe não, você está improvisando a própria evolução. Talvez praticando o que já sabe. Talvez evitando o que é difícil.\n\nTodo aluno do EBS sai de cada aula com um plano para a semana. Específico.\n\n@aprendiz.ebs — Corbélia-PR',
    hashtags: '#planode estudo #metodologia #aprendermusica #violao #guitarra #aprendizebs #ebs #corbelia',
    slides: [
      ['Você sai da sua aula sabendo o que fazer nos próximos 7 dias? Sabe exatamente o que praticar, por quanto tempo e com que objetivo?'],
      ['Se não, você está improvisando a própria evolução. Talvez praticando o que já sabe. Talvez evitando o que é difícil.'],
      ['Aluno com plano claro evolui de forma diferente. Não mais rápido necessariamente. Mas em direção certa, sem desperdiçar tempo.'],
      ['Todo aluno do EBS sai de cada aula com um plano para a semana. Específico. Não "pratique um pouco de tudo". @aprendiz.ebs'],
    ]
  },
  {
    id: 'tweet-v5-aulas-online-14',
    titleAttr: 'aulas online nao funcionam',
    title: 'Tentei 3 cursos online antes de entrar numa escola presencial',
    caption: 'Tentei três cursos online de guitarra antes de entrar numa escola presencial. Aprendi músicas. Não aprendi a tocar.\n\nA diferença é sutil no começo e brutal depois de um ano.\n\nSem feedback em tempo real, você pratica os erros até eles virarem hábito.\n\n@aprendiz.ebs — Av. Minas Gerais, 57, Corbélia-PR',
    hashtags: '#cursoonline #presencial #guitarra #violao #aprendizebs #ebs #corbelia #aulasdemusica',
    slides: [
      ['Tentei três cursos online de guitarra antes de entrar numa escola presencial. Aprendi músicas. Não aprendi a tocar.'],
      ['A diferença é sutil no começo e brutal depois de um ano. Online você aprende o que a câmera consegue mostrar. Presencial você aprende o que os seus dedos precisam aprender.'],
      ['Sem feedback corrigindo em tempo real, você pratica os erros até eles virarem hábito. E hábito é o que mais demora para mudar.'],
      ['14 anos ensinando em Corbélia. Nunca vi aluno de curso online chegar pronto. Sempre tem alguma coisa para corrigir na base. @aprendiz.ebs'],
    ]
  },
  {
    id: 'tweet-v5-formacao-filhos-15',
    titleAttr: 'formacao dos filhos',
    title: 'Aprender música não é uma atividade extra',
    caption: 'Aprender música não é uma atividade extra. É uma das poucas que desenvolve foco, disciplina e sensibilidade ao mesmo tempo.\n\nCriança que aprende instrumento com método aprende a lidar com frustração de forma saudável.\n\nTemos vagas aqui em Corbélia.\n\n@aprendiz.ebs — Av. Minas Gerais, 57',
    hashtags: '#criancas #musicaparafilhos #educacao #aprendizebs #ebs #corbelia #desenvolvimentoinfantil #musica',
    slides: [
      ['Aprender música não é uma atividade extra. É uma das poucas que desenvolve foco, disciplina, coordenação e sensibilidade ao mesmo tempo.'],
      ['Criança que aprende instrumento com método aprende a lidar com frustração de forma saudável. Você trava num acorde. Você volta. Você pratica. E um dia soa certo.'],
      ['Isso não é só música. É uma habilidade de vida. E se aprende melhor entre os 7 e os 15 anos, quando o cérebro ainda é mais plástico.'],
      ['Temos vagas aqui em Corbélia. Se você está pensando em colocar seu filho numa escola de música, vale uma conversa. @aprendiz.ebs — Av. Minas Gerais, 57'],
    ]
  },
  {
    id: 'tweet-v5-14-anos-corbelia-16',
    titleAttr: '14 anos em corbelia',
    title: '14 anos ensinando em Corbélia — o que aprendi sobre aprender',
    caption: 'Abri o EBS Aprendiz em 2011 sem ter certeza de que ia durar um ano. 14 anos depois, ainda aqui.\n\nO que aprendi nesses 14 anos: música não é sobre talento. Nunca foi.\n\nÉ sobre ter alguém do lado certo na hora certa.\n\n@aprendiz.ebs — Av. Minas Gerais, 57, Centro, Corbélia-PR',
    hashtags: '#14anos #ebsaprendiz #corbelia #aprendizebs #ebs #escolademusica #musica #historia',
    slides: [
      ['Abri o EBS Aprendiz em 2011 sem ter certeza de que ia durar um ano. 14 anos depois, ainda aqui.'],
      ['O que aprendi nesses 14 anos: música não é sobre talento. Nunca foi. É sobre ter alguém do lado certo na hora certa.'],
      ['Todo aluno que travou e saiu tocando, todo adulto que achou que era tarde demais, toda criança que chorou no primeiro acorde e depois mostrou pra família orgulhosa.'],
      ['Se você está pensando em começar, ou em retomar, o lugar é aqui. Av. Minas Gerais, 57, Centro, Corbélia-PR. @aprendiz.ebs'],
    ]
  },
];

// ─── Gera datas a partir de amanhã (uma por dia, 22:00 UTC = 19:00 BRT) ─────
function getScheduledDates(count) {
  const dates = [];
  const base = new Date('2026-05-23T22:00:00.000Z');
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString());
  }
  return dates;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const dates = getScheduledDates(CAROUSELS.length);

// Gera HTMLs
for (let i = 0; i < CAROUSELS.length; i++) {
  const c = CAROUSELS[i];
  const html = buildHTML(c.id, c.titleAttr, c.slides);
  const htmlPath = path.join(BASE, 'carrosseis', c.id + '.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✅ HTML:', c.id);
}

// Atualiza queue.json
const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));

// Marca tweet-v5-guitarra-sozinho-01 como published (se ainda não estiver)
const v5idx = queue.carousels.findIndex(c => c.id === 'tweet-v5-guitarra-sozinho-01');
if (v5idx !== -1) {
  queue.carousels[v5idx].status       = 'published';
  queue.carousels[v5idx].published_at = queue.carousels[v5idx].published_at || new Date().toISOString();
  queue.carousels[v5idx].format       = 'tweet-v5';
  queue.carousels[v5idx].buffer_post_id = queue.carousels[v5idx].buffer_post_id || '6a109a7433262db6110104c9';
  console.log('✅ Marcado como published: tweet-v5-guitarra-sozinho-01');
} else {
  // Adiciona se não existe
  queue.carousels.push({
    id: 'tweet-v5-guitarra-sozinho-01',
    title: 'Pratiquei guitarra sozinho por dois anos',
    category: 'EDU',
    format: 'tweet-v5',
    type: 'tweet',
    status: 'published',
    published_at: new Date().toISOString(),
    buffer_post_id: '6a109a7433262db6110104c9',
    buffer_status: 'draft',
    caption: 'Dois anos praticando guitarra sozinho e eu travei no mesmo acorde por seis meses.',
    hashtags: '#guitarra #autodidata #metodo #aprendizebs #ebs #corbelia',
    slides: ['slides/tweet-v5-guitarra-sozinho-01/slide_1.png','slides/tweet-v5-guitarra-sozinho-01/slide_2.png','slides/tweet-v5-guitarra-sozinho-01/slide_3.png','slides/tweet-v5-guitarra-sozinho-01/slide_4.png'],
    created_at: '2026-05-22',
    approved_at: '2026-05-22'
  });
  console.log('✅ Adicionado: tweet-v5-guitarra-sozinho-01');
}

// Adiciona os 15 novos (se não existirem ainda)
for (let i = 0; i < CAROUSELS.length; i++) {
  const c = CAROUSELS[i];
  const exists = queue.carousels.findIndex(x => x.id === c.id);
  if (exists !== -1) {
    console.log('⏭  Já existe:', c.id);
    continue;
  }
  const slides = c.slides.map((_, si) => 'slides/' + c.id + '/slide_' + (si + 1) + '.png');
  queue.carousels.push({
    id: c.id,
    title: c.title,
    category: 'EDU',
    format: 'tweet-v5',
    type: 'tweet',
    status: 'pending_approval',
    scheduled_for: dates[i],
    approval_deadline: new Date(new Date(dates[i]).getTime() - 2 * 60 * 60 * 1000).toISOString(),
    caption: c.caption,
    hashtags: c.hashtags,
    slides,
    created_at: '2026-05-22',
  });
  console.log('✅ Adicionado:', c.id, '→', dates[i].substring(0, 16));
}

fs.writeFileSync(QUEUE, JSON.stringify(queue, null, 2) + '\n', 'utf8');
console.log('\n🎉 Pronto! ' + CAROUSELS.length + ' carrosséis gerados.');
console.log('📋 queue.json atualizado com ' + queue.carousels.length + ' entradas.');
