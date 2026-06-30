# Regras de Escrita Anti-AI — EBS Aprendiz

> **Objetivo:** que as publicações soem como uma pessoa real escreveu — não como
> texto gerado por IA. Vale para o corpo dos slides e para a caption.
>
> **Fonte de verdade operacional:** estas regras vivem no **ClickUp → L0 Estratégico
> → DNA → entrada "Tom de Voz"** (campo descrição). O `loop-gerar.js` lê o DNA em
> runtime e injeta no prompt. Este documento é a referência humana + a base do
> fallback hardcoded (caso o ClickUp falhe).
>
> **Origem:** formato tweet-v5 (sessão 2026-05-22), auditado contra marcadores
> típicos de IA. Reforçado e formalizado em 2026-06-30.

---

## Princípio central

IA escreve **liso, equilibrado e genérico**. Gente real escreve **específico, seco e
meio torto**. Quando em dúvida, prefira a frase que um professor cansado, que já viu
de tudo, escreveria — não a que um assistente entusiasmado escreveria.

---

## Escrita — o que evitar (cheira a IA) × o que fazer

| ❌ Evitar (cheira a IA) | ✅ Fazer (soa humano) |
|---|---|
| Travessão/em-dash (—) como conectivo | Ponto final. Começa outra frase. |
| **Negrito** para dar ênfase | Sem negrito. A palavra certa já enfatiza. |
| Emojis decorativos no corpo | Zero emoji no texto dos slides |
| Bullet points / listas numeradas no slide | Texto corrido, em parágrafos curtos |
| Aberturas de IA: "Você sabia que...", "Descubra...", "Imagine..." | Entra direto no assunto, de preferência com uma cena concreta |
| "Vamos lá!", "incrível!", "transformador!" (entusiasmo forçado) | Tom seco, de quem viveu aquilo |
| Genérico: "muitas pessoas têm dificuldade" | Específico: "travei no mesmo acorde por seis meses" |
| Frases simétricas, todas do mesmo tamanho | Tamanhos irregulares. Uma curta. Depois uma mais longa que respira. |
| Vocabulário pomposo ("potencializar", "jornada de aprendizado") | Coloquial real ("fala com a gente", "destravar") |
| Conclusão redondinha que amarra tudo | Pode terminar meio cru, como conversa real |
| "Não é sobre X, é sobre Y" (fórmula batida de IA) | Diz a coisa direto, sem a antítese de efeito |

---

## Primeira pessoa e experiência concreta

O que mais derruba a sensação de "texto de robô" é **experiência específica em primeira
pessoa**. Exemplo do tweet-v5 que funcionou:

> *"Pratiquei guitarra sozinho por dois anos. Travei no mesmo acorde por seis meses.
> Não era falta de dedicação. Era que eu praticava a coisa errada, do jeito errado,
> sem ninguém para me dizer isso."*

Repare: número concreto (dois anos, seis meses), admissão de imperfeição, sem floreio,
sem emoji, sem negrito, frases de tamanhos diferentes.

---

## Apresentação visual (não parecer template de IA)

- **Sem imagens geradas por IA** — elas denunciam na hora. Formato tweet-v5/v4 é texto puro.
- Fundo neutro (cinza `#e6e9ed` ou branco `#F2F2F2`) + card — estética de print de rede social real.
- Fonte legível (22–24px), sem hierarquia visual exagerada de tamanhos/cores.
- Carrosséis curtos e densos (4–8 slides) valem mais que 10 slides "completos e perfeitos".

---

## Invariantes da marca (continuam valendo)

Estas regras anti-AI **convivem** com as invariantes do EBS (não as substituem):

- Handle `@aprendiz.ebs` — nunca `@ebsmusicfirst`
- Nunca revelar preço no conteúdo
- Nunca prometer "aprender rápido / em X dias"
- Caption começa com sinal local de Corbélia ("Tá em Corbélia?", "Em Corbélia...")
- Sem gírias pesadas, sem palavrão, sem discriminação de gênero musical

---

## Checklist rápido antes de aprovar um texto

1. Tem travessão como conectivo? → troca por ponto.
2. Tem negrito ou emoji no corpo? → remove.
3. Abre com "Você sabia", "Descubra", "Imagine"? → reescreve com cena concreta.
4. As frases têm todas o mesmo tamanho? → quebra o ritmo.
5. Tem número/detalhe específico ou está genérico? → especifica.
6. Soa como vendedor animado ou como mentor que já viu de tudo? → o segundo.
