# EBS Aprendiz — Quality Gate de Carrosséis

> Checklist obrigatório do **@qa (Quinn)** antes de aprovar qualquer carrossel para agendamento ou publicação no @aprendiz.ebs.
> Versão 1 — 2026-05-15

Esta lista é o portão de qualidade entre **rascunho** e **approved**. Quinn aplica este checklist após o Dex (autor) entregar o HTML. Falhas em itens críticos bloqueiam aprovação.

---

## 1. Identidade de Marca (CRÍTICO)

- [ ] **Handle correto:** `@aprendiz.ebs` (programa) — NUNCA `@ebsmusicfirst` (estúdio)
- [ ] **Logo:** avatar circular com a logo oficial EBS Aprendiz, sem o texto "music first" visível
- [ ] **Nome exibido:** "Aprendiz.ebs" ou "EBS Aprendiz" — consistente com posts anteriores
- [ ] **Selo verificado azul:** presente no header dos carrosséis tweet (estilo X)
- [ ] **Cores:** dourado primário `#D4A017` para acentos; fundo `#0A0A0A` (editorial) ou `#F2F2F2` (tweet)

## 2. Tom de Voz (CRÍTICO)

O tom deve ser **mentor experiente + acessível**. Equilibra emoção/motivação com postura de escola séria.

- [ ] Sem promessas de "aprenda em 7 dias" / "rápido" / "fácil" — proibidas
- [ ] Sem gírias pesadas ou linguagem muito informal
- [ ] Sem palavrões ou baixo calão
- [ ] Sem discriminar gênero musical (ex: "rock é melhor que sertanejo")
- [ ] Frases diretas e curtas, não corporativas
- [ ] Português BR natural — sem traduções ruins

## 3. Estratégia de CTA (CRÍTICO — regra-mãe)

> **O EBS NÃO É UMA LANCHONETE.** Conteúdo majoritariamente de valor. CTA pontual e estratégico, não em todo post.

### Regra de proporção
Para cada **5 posts publicados em sequência**, no máximo **2 devem ter CTA direto** ("Fale com a gente", "Garanta sua vaga", "Vagas abertas").

- [ ] Verifiquei os últimos 4 posts publicados no @aprendiz.ebs
- [ ] Este post mantém a proporção: contar se os 4 anteriores + este = no máximo 40% com CTA direto
- [ ] Se este post É CTA: vale a pena? (sazonalidade, fim de mês, ciclo de matrículas)
- [ ] Se este post NÃO é CTA: o último slide ainda traz uma chamada suave (CTA implícito), não corporativa

### CTAs aceitáveis
- ✅ "Fale com a gente" + endereço
- ✅ "Quer aprender? A gente ensina desde a primeira aula" + endereço
- ✅ "Vagas limitadas. Garanta a sua" + endereço
- ✅ CTA implícito: "O que muda tudo não é quanto você pratica — é como"

### CTAs proibidos
- ❌ "COMPRE AGORA"
- ❌ Lista de planos com preços
- ❌ "Última chance!" (apela demais)
- ❌ Mais de um CTA no mesmo carrossel

### Conteúdo sem CTA — preferido
- Educativo puro (benefícios da música, neurociência, dicas técnicas)
- Curiosidade / mito-busting
- História da escola, depoimentos de alunos
- Resultados / progressão (mostra valor sem vender)

## 4. Preço (PROIBIDO no conteúdo)

- [ ] **Nenhum valor R$** aparece em slide ou caption
- [ ] **Nenhum plano** (mensal/semestral/anual) é listado
- [ ] Preços ficam exclusivamente para conversa privada após o lead chegar

## 5. Estrutura do Carrossel

- [ ] **Slide 1 = hook** que para o scroll (pergunta, número surpresa, afirmação ousada)
- [ ] **Slides 2-6 = desenvolvimento** progressivo de UM tema (não pula de assunto)
- [ ] **Slide final = fechamento** com CTA (forte ou suave conforme regra § 3)
- [ ] **7 slides total** (padrão EBS) — variar só com justificativa clara

## 6. Caption Instagram

- [ ] Caption alinhada com o conteúdo do carrossel (não genérica)
- [ ] Endereço da escola incluído: `Av. Minas Gerais, 57 — Centro, Corbélia-PR`
- [ ] Hashtags presentes (10-15) misturando:
  - 3-4 institucionais (`#aprendizebs #ebs #corbelia #escolademusica`)
  - 5-7 do tema do post
  - 2-3 amplas (`#aprendermusica #musica`)
- [ ] Tom da caption casa com tom do carrossel
- [ ] Quebras de linha duplas (`\n\n`) entre parágrafos

## 7. Verificação Técnica (antes de publicar)

- [ ] PNGs exportados em `slides/<id>/` (visível como **📦 N PNGs exportados** no dashboard)
- [ ] PNGs commitados no repo (auto-commit do dashboard cobre isso)
- [ ] queue.json com `status="approved"` ou `"scheduled"` e `scheduled_for` em **ISO UTC** com `Z`
- [ ] Imagens (se houver) com licença válida (Pexels grátis ou nano-banana próprio)
- [ ] Avatar carrega corretamente (preview do dashboard mostra o avatar EBS)

## 8. Visual / Diagramação

- [ ] Texto não escapa do limite do slide (sem corte/overflow)
- [ ] Hierarquia tipográfica clara (peso 700 para destaque, 400 para corpo)
- [ ] Contraste suficiente (texto legível sobre o fundo)
- [ ] Emojis usados com parcimônia (3-5 por carrossel inteiro, não em todo slide)
- [ ] Slide 7 (CTA) tem a logo visível ou referência forte à marca

## 9. Localidade (DIFERENCIAL EBS)

- [ ] Tom direto sobre Corbélia quando faz sentido: "Aqui em Corbélia", "Venha nos visitar"
- [ ] Endereço completo no slide CTA ou caption
- [ ] Não esconde que é presencial em Corbélia (vira filtro natural do lead)

## 10. Verificação de Imagem — delegada à @imagem-curator (Iris)

> Quinn chama Iris automaticamente durante o gate. Iris emite veredicto separado que é incorporado ao gate final de Quinn.

### O que Iris verifica (via screenshots Playwright):

| Critério | Severidade |
|---|---|
| Relevância (tema ligado a música/aprendizado) | BLOCK |
| Qualidade técnica (nitidez, resolução, sem artifacts) | BLOCK |
| Composição visual (área para texto, ponto focal) | CONCERNS |
| Contraste do texto sobre imagem | BLOCK |
| Fit de marca EBS (premium, autêntico, não genérico) | CONCERNS |
| Licença (Pexels/Unsplash/própria = OK; Getty sem licença = BLOCK) | BLOCK |
| Pessoas naturais (se houver) | CONCERNS |
| Sem watermarks visíveis | BLOCK |
| Adequação de conteúdo (público 7+) | BLOCK |
| Orientação/formato (portrait ou adaptado 4:5) | CONCERNS |

### Como Quinn aciona Iris:

```
# Durante o gate de um carrossel:
@imagem-curator
*review-images <carouselId>
```

### Temas de imagem IDEAIS para o EBS:
- ✅ Criança/adolescente tocando instrumento com expressão genuína
- ✅ Adulto em aula de guitarra, violão, teclado
- ✅ Estúdio de gravação, microfone, equipamentos
- ✅ Grupo de alunos, banda, performance
- ✅ Instrumento com boa iluminação e composição

### Temas a EVITAR:
- ❌ Escritório corporativo, tecnologia abstrata
- ❌ Natureza sem relação com música
- ❌ Stock photos de sorriso forçado genérico
- ❌ Qualquer imagem com watermark

---

## Decisão do Gate

| Falha em | Decisão |
|---|---|
| Qualquer item da seção 1 (Identidade) | **BLOCK** — corrigir antes de aprovar |
| Qualquer item da seção 2 (Tom) | **BLOCK** — reescrever |
| Regra de proporção CTA (seção 3) | **BLOCK** — alternar com post de valor |
| Mostra preço (seção 4) | **BLOCK** — remover |
| Estrutura (seção 5) | **CONCERNS** — pode aprovar com nota |
| Caption (seção 6) | **CONCERNS** — ajuste rápido |
| Técnico (seção 7) | **WAIT** — exportar/commitar e retornar |
| Visual (seção 8) | **CONCERNS** — ajuste se grave |
| Localidade (seção 9) | **PASS** — recomendação, não bloqueio |
| Imagem/BLOCK da Iris (seção 10) | **BLOCK** — trocar imagem antes de aprovar |
| Imagem/CONCERNS da Iris (seção 10) | **CONCERNS** — nota no gate, aprovar com atenção |

**Output do gate:** `PASS / CONCERNS / WAIT / BLOCK`

- **PASS** → status="approved"
- **CONCERNS** → status="approved" com nota no commit
- **WAIT** → status="pending" + razão técnica
- **BLOCK** → status="rascunho" + ação corretiva

---

## Como Quinn aplica este checklist

```
@qa
*review-carousel <id>
```

Quinn lê:
1. `carrosseis/<id>.html`
2. `queue.json` (caption, hashtags, slides exportados)
3. Últimos 4 posts publicados (para validar regra de CTA)
4. Aciona `@imagem-curator` → `*review-images <id>` para seção 10

E emite gate unificado: veredicto de Quinn (seções 1-9) + veredicto de Iris (seção 10).
Gate final é o mais restritivo dos dois.
