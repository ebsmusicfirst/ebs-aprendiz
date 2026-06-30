# Regras de Escrita Anti-AI — EBS Aprendiz

> **Objetivo:** que as publicações soem como uma pessoa real escreveu — não como
> texto gerado por IA. Vale para o corpo dos slides e para a caption.
>
> **Fonte de verdade operacional:** estas regras vivem no **ClickUp → L0 Estratégico
> → DNA → entrada "Tom de Voz"** (campo descrição). O `loop-gerar.js` lê o DNA em
> runtime e injeta no prompt. Este documento é a referência humana + a base do
> fallback hardcoded (`FALLBACK_TOM_DE_VOZ` em `scripts/loop-gerar.js`).
>
> **Origem:** formato tweet-v5 (2026-05-22). Incrementado com pesquisa web em
> 2026-06-30 (fontes no rodapé).

---

## Princípio central

IA escreve **liso, equilibrado e genérico**. Gente real escreve **específico, seco e
meio torto**. Quando em dúvida, prefira a frase que um professor cansado, que já viu
de tudo, escreveria — não a que um assistente entusiasmado escreveria.

A pesquisa confirma: **nenhum marcador isolado prova que é IA.** O que denuncia é o
*acúmulo* de padrões. Por isso as regras abaixo atacam vários eixos ao mesmo tempo.

---

## Os 3 tells mais confiáveis (priorize estes)

A literatura de detecção em 2025-2026 converge em três sinais que sobrevivem até a
reescrita — bem mais confiáveis que qualquer palavra solta:

### 1. Cadência uniforme (o tell nº 1)
IA escreve quase toda frase com 18-24 palavras, no mesmo ritmo metronômico. Humano
"explode" (*burstiness*): alterna frase curtíssima com frase longa que respira.
- ❌ Três frases seguidas do mesmo tamanho, formando um "retângulo" perfeito de texto.
- ✅ Uma frase de três palavras. Depois uma mais longa, que se estende e muda o ritmo antes de parar. Curto de novo.

### 2. "Não é X, é Y" (a fórmula mais batida)
A construção emblemática da IA: *"Não é sobre talento, é sobre método."* / *"Não só
ensina música, mas transforma vidas."* Aparece quase uma vez por parágrafo no texto
de IA. Mate a fórmula — diga a coisa direto.
- ❌ "Não é só uma aula. É uma jornada."
- ✅ "A aula tem método. Você evolui com trilha, não no escuro."

### 3. Tricolon / regra de três
Listas de três em paralelo, com ritmo casado: *"foco, disciplina e criatividade"*,
*"rápido, fácil e acessível"*. Um tricolon ocasional é elegante; três seguidos viram
assinatura de robô. Quebre o padrão — use dois, ou quatro, ou reescreva.

---

## Escrita — evitar (cheira a IA) × fazer (soa humano)

| ❌ Evitar | ✅ Fazer |
|---|---|
| Frases todas do mesmo tamanho | Alterna curta e longa. Quebra o ritmo de propósito. |
| "Não é X, é Y" / "Não só X, mas Y" | Diz a coisa direto, sem a antítese de efeito |
| Três adjetivos/frases em paralelo (tricolon) | Dois, ou quatro, ou nenhum |
| Preâmbulo de hedge: "É importante destacar que", "Vale ressaltar", "De modo geral" | Corta o preâmbulo. Vai direto ao ponto. |
| Fechamento boilerplate: "Em resumo", "Por fim", "No fim das contas, uma coisa é certa" | Termina meio cru, como conversa real |
| Verbo de marketing no lugar de "é": "representa um", "serve como", "marca uma" | Usa "é", "tem", "faz" |
| **Negrito** para dar ênfase | A palavra certa já enfatiza |
| Emoji decorativo no corpo | Zero emoji no texto dos slides |
| Bullet points dentro do slide | Texto corrido, parágrafos curtos |
| Abertura clichê: "Você sabia que", "Descubra", "Imagine", "No mundo de hoje", "Vamos mergulhar" | Entra com uma cena concreta |
| Genérico: "muitos têm dificuldade" | Específico: "travei seis meses no mesmo acorde" |
| Vocabulário pomposo (lista abaixo) | Coloquial real ("fala com a gente", "destravar") |

---

## Vocabulário PT-BR que denuncia IA

Evite estas palavras/expressões. Quando aparecerem, troque por concreto:

- **Metáforas infladas:** jornada, universo (de), mundo (de), leque de, uma gama de, repleto de, paisagem, ecossistema
- **Drama vazio:** transformador, revolucionário, poderoso, incrível, surpreendente, de tirar o fôlego, sem igual, incomparável, renomado
- **Verbos de palestra:** mergulhar, desvendar, descomplicar, desbloquear, potencializar, alavancar, otimizar, maximizar, elevar
- **Conectivos de IA:** além disso, ademais, outrossim, cada vez mais, mais do que nunca, afinal
- **Inflação de importância:** fundamental, essencial, crucial, peça-chave, pilar, verdadeiro/genuíno (como ênfase)

---

## Clichês específicos de escola de música (proibidos)

A IA adora estes — então eles gritam "post automático". Nunca use:

- "A música é uma linguagem universal"
- "Desbloqueie/liberte seu potencial musical"
- "Embarque nessa jornada musical"
- "Descubra o mundo da música"
- "Transforme sua vida através da música"
- "Mais do que tocar, é se expressar"
- "Onde a paixão encontra a técnica"

---

## O que mais funciona: primeira pessoa + experiência concreta

O antídoto mais forte contra "texto de robô" é **experiência específica em primeira
pessoa**. Exemplo do tweet-v5 que funcionou:

> *"Pratiquei guitarra sozinho por dois anos. Travei no mesmo acorde por seis meses.
> Não era falta de dedicação. Era que eu praticava a coisa errada, do jeito errado,
> sem ninguém para me dizer isso."*

Repare: número concreto (dois anos, seis meses), admissão de imperfeição, sem floreio,
sem emoji, sem negrito, frases de tamanhos diferentes.

---

## A nuance do em-dash (correção 2026-06-30)

A "histeria do em-dash" é parcialmente equivocada: o travessão **sozinho** não prova
IA, e detectores quase não pesam nisso. O que realmente entrega é a **fórmula** que
costuma vir com ele ("não é X — é Y") e a **cadência uniforme**.

Para o EBS, mantemos a regra prática de **evitar o em-dash como conectivo** — não por
ser prova de IA, mas porque ponto final dá o ritmo seco que queremos. Foque a energia
em matar a *fórmula* e variar o *comprimento das frases*, que valem muito mais.

---

## Apresentação visual (não parecer template de IA)

- **Sem imagens geradas por IA** — elas denunciam na hora. Formato tweet-v5/v4 é texto puro.
- Fundo neutro (cinza `#e6e9ed` ou branco `#F2F2F2`) + card — estética de print de rede social real.
- Fonte legível (22–24px), sem hierarquia visual exagerada de tamanhos/cores.
- Carrosséis curtos e densos (4–8 slides) valem mais que 10 slides "completos e perfeitos".
- Sem emoji estrutural (👉 como marcador, ✅ como checkmark) — é tell de IA.

---

## Invariantes da marca (continuam valendo)

Estas regras anti-AI **convivem** com as invariantes do EBS:

- Handle `@aprendiz.ebs` — nunca `@ebsmusicfirst`
- Nunca revelar preço no conteúdo
- Nunca prometer "aprender rápido / em X dias"
- Caption começa com sinal local de Corbélia ("Tá em Corbélia?", "Em Corbélia...")
- Sem gírias pesadas, sem palavrão, sem discriminação de gênero musical

---

## Checklist rápido antes de aprovar um texto

1. As frases têm todas o mesmo tamanho? → quebra o ritmo (curta + longa).
2. Tem "não é X, é Y" em algum lugar? → reescreve direto.
3. Tem três adjetivos/itens em paralelo? → corta para dois ou reescreve.
4. Abre com "Você sabia", "Descubra", "Imagine", "No mundo de hoje"? → cena concreta.
5. Tem preâmbulo de hedge ("é importante destacar") ou fechamento "em resumo"? → remove.
6. Tem palavra da lista de vocabulário inflado ou clichê de escola de música? → troca por concreto.
7. Tem negrito, emoji ou bullet no corpo? → remove.
8. Tem número/detalhe específico ou está genérico? → especifica.
9. Soa como vendedor animado ou como mentor que já viu de tudo? → o segundo.

---

## Fontes da pesquisa (2026-06-30)

- [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) — catálogo mais completo de marcadores
- [The Em-Dash Myth: What Actually Gives Away AI Writing — Duey AI](https://www.duey.ai/post/em-dash-ai-writing) — cadência uniforme e "não é X, é Y" como tells reais
- [Perplexity and Burstiness in Writing — Originality.AI](https://originality.ai/blog/perplexity-and-burstiness-in-writing) — variação de comprimento de frase
- [17 AI Writing Tells + Words Blacklist — Olivia Cal](https://www.oliviacal.com/post/ai-writing-tells) — blacklist e correções práticas
- [Walking Through AI's Most Overused Phrases — Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases)
- [Texto Gerado por IA em Português: Como Identificar — Hastewire](https://hastewire.com/pt/blog/texto-gerado-por-ia-em-portugues-como-identificar-facilmente) — marcadores em PT-BR
