/**
 * EBS Aprendiz — Gerador batch de carrosséis tweet
 *
 * Lê o template `tweet-guitarra-sozinho-01.html`, substitui:
 *   - Título da página
 *   - 7 textos de slide (cada um com sua imagem Pexels)
 *   - Texto do footer no slide final (CTA)
 * E grava 5 novos HTMLs em carrosseis/.
 *
 * Também adiciona entradas em queue.json com status="pending".
 *
 * Uso: node scripts/generate-tweet-batch.js
 */

const fs   = require('fs');
const path = require('path');

const BASE_DIR   = path.resolve(__dirname, '..');
const TEMPLATE   = path.join(BASE_DIR, 'carrosseis', 'tweet-guitarra-sozinho-01.html');
const OUT_DIR    = path.join(BASE_DIR, 'carrosseis');
const QUEUE_PATH = path.join(BASE_DIR, 'queue.json');

// ── DEFINIÇÃO DOS 5 CARROSSÉIS ───────────────────────────────────────────────

const carousels = [
  {
    id:    'tweet-aulas-online-nao-funcionam-02',
    title: 'Aulas online não funcionam pra iniciante',
    category: 'EDU',
    slides: [
      { text: 'Você comprou o curso online de música. Já se perdeu 2 vezes. Pausou no episódio 4.',                        img: 4709822 },
      { text: 'Aprender música é físico. É mão, postura, pressão do dedo, timing. Tela não vê.',                            img: 7520985 },
      { text: 'O cérebro aprende com erro corrigido na hora. Sem alguém olhando, você grava o erro como certo.',           img: 6863250 },
      { text: '"Online é flexível" virou eufemismo pra "sozinho de novo". Flexível por quê? Pra desistir mais fácil.',     img: 4350224 },
      { text: 'O segredo não está no professor mais charmoso da internet. Está no professor que vê você errar.',           img: 8198122 },
      { text: 'Por isso o EBS é presencial. Em Corbélia. Você senta com o Alex. Ele vê seu pulso, sua mão. Corrige.',     img: 1407322 },
    ],
    cta: 'Aulas presenciais em Corbélia-PR. Aqui o erro vira aprendizado na mesma aula. Av. Minas Gerais, 57.',
    footer7: 'Conheça o EBS →',
    caption: 'A indústria de cursos online vende uma promessa que não cumpre para iniciantes em música.\n\nNão é o vídeo que falha. É a falta de feedback corrigindo seu erro na hora.\n\nSeu pulso está torcido? A tela não vê. Sua postura vai criar tendinite? A tela não avisa. Você está pressionando errado o acorde? A tela não corrige.\n\nMúsica é físico. E física tem que ser ajustada por alguém presente.\n\nEm Corbélia há 14 anos. Presencial faz diferença.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR',
    hashtags: '#aprendizebs #ebs #corbelia #aulademusica #aprendermusica #violao #guitarra #cursoonline #presencial #musica',
  },
  {
    id:    'tweet-sem-tempo-sem-metodo-03',
    title: 'Você não está sem tempo. Você está sem método.',
    category: 'MOT',
    slides: [
      { text: '"Eu queria aprender música mas não tenho tempo." Mentira.',                                                 img: 7520989 },
      { text: 'Você tem 10 minutos por dia. Já checou Instagram hoje? Tem tempo.',                                          img: 4144096 },
      { text: 'Pesquisa: 10 minutos diários estruturados batem 2 horas só no fim de semana.',                              img: 6646984 },
      { text: 'A memória muscular se forma no SONO entre práticas curtas — não em sessões longas e esporádicas.',          img: 6173837 },
      { text: 'Quem tem método sabe o que praticar nos próximos 10 minutos. Quem não tem, fica olhando o instrumento.',    img: 6862459 },
      { text: 'O que falta não é tempo. É um plano. E uma pessoa que conhece o caminho te dizer o próximo passo.',         img: 2118045 },
    ],
    cta: 'No EBS você sai da aula sabendo exatamente o que praticar nos próximos 7 dias. Sem mistério.',
    footer7: 'Fale com o EBS →',
    caption: 'A frase "não tenho tempo" é a maior mentira que contamos a nós mesmos sobre música.\n\nVocê tem 10 minutos. Tem agora. Tem amanhã. Tem todo dia da semana.\n\nO problema nunca foi tempo. O problema é não saber o que fazer com esses 10 minutos.\n\nAluno do EBS sai da aula com um plano claro: hoje você pratica X, amanhã Y, na quarta combina os dois. Sem desperdício. Sem "ah, vou ver o que eu lembro".\n\nMétodo é o que transforma 10 minutos diários em alguém que toca.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR',
    hashtags: '#aprendizebs #ebs #corbelia #metodo #praticadiária #aprendermusica #violao #guitarra #disciplina #musica',
  },
  {
    id:    'tweet-jeito-pra-musica-04',
    title: 'Como saber se meu filho leva jeito pra música?',
    category: 'EDU',
    slides: [
      { text: '"Como saber se meu filho leva jeito pra música?" Eu te conto: ninguém leva.',                                img: 6862459 },
      { text: 'Talento musical não é gene. É exposição precoce + repetição estruturada + correção.',                        img: 4348078 },
      { text: 'Mozart começou aos 3 com o pai como professor. Não era "dom". Era ensino diário em casa.',                  img: 3771074 },
      { text: 'Estudos: crianças com 6 meses de aula estruturada superam crianças "com talento" sem aula.',                img: 8197531 },
      { text: 'O que diferencia? Os pais que apoiaram. Que viram o instrumento como sério, não brinquedo.',                 img: 4350224 },
      { text: 'Seu filho não precisa "ter o dom". Precisa de um método e de alguém que acredite. O resto vem.',             img: 1407322 },
    ],
    cta: 'Em Corbélia, crianças a partir de 7 anos. Sem teste de "talento". Só método. Av. Minas Gerais, 57.',
    footer7: 'Matricule no EBS →',
    caption: 'Pais, escutem: nenhuma criança "leva jeito" pra música. Esse mito desencoraja famílias inteiras.\n\nO que existe é: criança com exposição cedo + método consistente + apoio em casa.\n\nQuando você diz "meu filho não tem o dom", o que está dizendo é "eu desisti de descobrir". Toda criança pode tocar. Todo cérebro de criança aprende música se for ensinado.\n\nNo EBS Aprendiz, em Corbélia, recebemos crianças a partir de 7 anos. Sem teste de "talento". Sem entrevista de admissão. Só método.\n\nO único pré-requisito é vocês — pais e mães — toparem a jornada junto.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR',
    hashtags: '#aprendizebs #ebs #corbelia #criancasmusica #aulaparacriancas #mitomusical #talento #aprendermusica #pais #musicainfantil',
  },
  {
    id:    'tweet-3-sinais-professor-amador-05',
    title: '3 sinais de que seu professor é amador',
    category: 'EDU',
    slides: [
      { text: 'Já teve aula de música que parecia mais aleatória que estruturada?',                                         img: 7520989 },
      { text: 'Existe muito professor que toca bem mas nunca aprendeu a ENSINAR. São coisas diferentes.',                  img: 1407322 },
      { text: 'Sinal #1: Não tem um plano de evolução claro. "A gente vai vendo." Tradução: ele não sabe.',                img: 6173837 },
      { text: 'Sinal #2: Toca pra você o tempo todo. Aluno bom toca mais que o professor. Sempre.',                        img: 7520985 },
      { text: 'Sinal #3: Não te dá lição de casa específica. "Pratica o que viu hoje" = sem direção real.',                img: 4348078 },
      { text: 'Professor sério tem método. Plano de aula. Avaliação por nível. Se o seu não tem, não é falta sua.',        img: 2118045 },
    ],
    cta: 'No EBS o método é 5 níveis claros de progressão. Você sempre sabe onde está. Av. Minas Gerais, 57.',
    footer7: 'Conheça o método EBS →',
    caption: 'Esse post vai incomodar alguns professores. Tudo bem. Aluno merece saber a diferença.\n\nProfessor amador trava sua evolução de 3 jeitos:\n\n1️⃣ Sem plano = você não sabe onde está nem onde vai chegar.\n\n2️⃣ Tocando demais durante a aula = você paga pra assistir, não pra aprender.\n\n3️⃣ Lição de casa genérica = você pratica errado a semana toda.\n\nNo EBS, cada aluno tem um plano nos 5 níveis da trilha EBS. Cada aula gera lições específicas. Cada nível tem critério claro de avanço.\n\nNão é magia. É método. E método se sente desde a primeira aula.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR',
    hashtags: '#aprendizebs #ebs #corbelia #professordemusica #escolademusica #metodo #aulamusica #qualidade #aprendermusica #serio',
  },
  {
    id:    'tweet-criancas-musicos-bons-06',
    title: 'O que toda criança que virou músico bom tinha em comum',
    category: 'EDU',
    slides: [
      { text: 'Por que algumas crianças viram músicos bons e outras desistem? Pesquisei a resposta. Não é o que parece.',  img: 6862459 },
      { text: 'Procurei o "ingrediente secreto" em décadas de pesquisa. Não é talento. Não é instrumento caro.',           img: 8197531 },
      { text: 'É o pai ou mãe que tratou aquilo como SÉRIO desde o início. Que não desmarcou aula no impulso.',            img: 4348078 },
      { text: 'Estudos longitudinais: crianças cujos pais participam têm muito mais chance de continuar tocando aos 16.',  img: 3771074 },
      { text: 'Não precisa o pai saber música. Precisa o pai estar ali. Perguntar como foi. Ouvir a criança tocar.',       img: 6647037 },
      { text: 'A música precisa de palco em casa. Não público — só atenção. É isso que diferencia quem fica de quem larga.', img: 1407322 },
    ],
    cta: 'Em Corbélia, somos um espaço onde a criança aprende. Mas a constância é da família. Av. Minas Gerais, 57.',
    footer7: 'Faça parte →',
    caption: 'Pais, isso aqui é pra vocês.\n\nPesquisei décadas de literatura sobre crianças que viram músicos competentes. Esperava encontrar talento. Encontrei outra coisa.\n\nO fator decisivo era os pais. Não os pais que tocavam — os pais que ESTAVAM.\n\nQue perguntavam como foi a aula. Que paravam o que estavam fazendo pra ouvir o filho mostrar a música nova. Que não desmarcavam aula porque deu preguiça.\n\nO instrumento mais caro do mundo não substitui isso. O melhor professor do mundo não substitui isso.\n\nNo EBS Aprendiz, em Corbélia, fazemos nossa parte. A parte de vocês é insubstituível.\n\nAv. Minas Gerais, 57 — Centro, Corbélia-PR',
    hashtags: '#aprendizebs #ebs #corbelia #criancasemusica #pais #educacaomusical #aulaparacriancas #musica #família #apoio',
  },
];

// ── Template engine ──────────────────────────────────────────────────────────

const template = fs.readFileSync(TEMPLATE, 'utf-8');

function pexelsUrl(id) {
  return 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg?auto=compress&cs=tinysrgb&w=800&h=520&fit=crop';
}

function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function genHtml(carousel) {
  let html = template;

  // 1. Title
  html = html.replace(
    /<title>EBS Aprendiz —[^<]*<\/title>/,
    '<title>EBS Aprendiz — ' + escapeHTML(carousel.title) + '</title>'
  );

  // 2. Parse slides via regex — substituir 7 .x-slide
  // Cada slide tem este padrão:
  //   <div class="x-content"><p>TEXTO</p></div>
  //   <div class="slide-img-wrap"><img src="URL" ...>...</div>
  //   <div class="x-footer">... <span class="footer-swipe">FOOTER_TEXT</span></div>

  const allSlides = [
    ...carousel.slides,
    { text: carousel.cta, img: 7520985 }, // slide 7 — CTA (reusa imagem padrão)
  ];

  if (allSlides.length !== 7) {
    throw new Error(carousel.id + ': preciso de 6 slides + 1 CTA = 7 total, recebi ' + allSlides.length);
  }

  // Substituir <p>...</p> dentro de cada .x-content (1ª match → primeiro slide, etc.)
  let slideIdx = 0;
  html = html.replace(
    /(<div class="x-content">\s*<p>)([^<]+)(<\/p>\s*<\/div>)/g,
    function(match, open, _oldText, close) {
      if (slideIdx >= allSlides.length) return match;
      const text = escapeHTML(allSlides[slideIdx].text);
      slideIdx++;
      return open + text + close;
    }
  );

  // Substituir imagens
  let imgIdx = 0;
  html = html.replace(
    /<img src="https:\/\/images\.pexels\.com\/photos\/[^"]+"/g,
    function(match) {
      if (imgIdx >= allSlides.length) return match;
      const newSrc = pexelsUrl(allSlides[imgIdx].img);
      imgIdx++;
      return '<img src="' + newSrc + '"';
    }
  );

  // Substituir o último footer-swipe (slide 7 CTA)
  // Footer 1-6 = "Arrasta para o próximo →", footer 7 = personalizado
  // O original tem 6 "Arrasta…" + 1 "Fale com a gente →" → substituir só o último
  html = html.replace(
    /(<span class="footer-swipe">)Fale com a gente →(<\/span>)/,
    '$1' + escapeHTML(carousel.footer7) + '$2'
  );

  return html;
}

// ── Generate ─────────────────────────────────────────────────────────────────

console.log('🎨 Gerando ' + carousels.length + ' carrosséis tweet...\n');

for (const c of carousels) {
  const html    = genHtml(c);
  const outPath = path.join(OUT_DIR, c.id + '.html');
  fs.writeFileSync(outPath, html, 'utf-8');
  const sizeKB = (html.length / 1024).toFixed(1);
  console.log('  ✅ ' + c.id + '.html (' + sizeKB + ' KB)');
}

// ── Add to queue.json ────────────────────────────────────────────────────────

console.log('\n📋 Atualizando queue.json...');
const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
const today = new Date().toISOString().substring(0, 10);

const existingIds = new Set(queue.carousels.map(c => c.id));
let added = 0;

for (const c of carousels) {
  if (existingIds.has(c.id)) {
    console.log('  ⏭️  ' + c.id + ' já existe — pulando');
    continue;
  }
  queue.carousels.push({
    id: c.id,
    title: c.title,
    category: c.category,
    type: 'tweet',
    status: 'pending',
    scheduled_for: null,
    caption: c.caption,
    hashtags: c.hashtags,
    slides: [],
    created_at: today,
  });
  added++;
  console.log('  ➕ ' + c.id);
}

fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
console.log('\n✅ ' + added + ' novos carrosséis na queue. Total agora: ' + queue.carousels.length);
console.log('   Próximos passos:');
console.log('   1. Abra http://localhost:3000 — confira o preview');
console.log('   2. Clique 📦 Exportar em cada um (gera PNGs + commita)');
console.log('   3. Sky propõe o cronograma (via @social-manager)');
console.log('   4. Você aprova → agendar via dashboard');
