---
name: instagram-carousel-editorial
description: Carrosséis editoriais estilo "tweet jornalístico" — avatar de autor + headline impactante + imagem dominante. Estilo Posti Lab / The New Yorker / Medium. Use quando o briefing pedir "estilo tweet editorial", "headline + imagem grande", "tipo manchete" ou quando o referencial visual mostrar formato de post X com imagem de fundo.
---

# Instagram Carousel Editorial — Skill

> **Estilo:** Editorial Tweet (Posti Lab style)
> **Diferença do `/instagram-carousel-tweet`:** Aquele simula um post de tweet completo. Este é um **híbrido editorial** — autor verificado + headline jornalística + imagem dominante + indicador "1/N".
> **Formato final:** 1080×1350px PNG (Instagram carousel)

---

## Quando usar

✅ **USE este skill quando:**
- O referencial visual mostrar headline grande em negrito + imagem grande dominante
- O conteúdo for jornalístico / opinativo / provocativo (tipo coluna)
- O cliente pedir "tipo Posti Lab", "estilo editorial", "manchete + imagem"
- Houver um "autor" definido (especialista, fundador, persona)
- O objetivo for **autoridade + alcance viral** (storytelling longo)

❌ **NÃO use quando:**
- O conteúdo for puramente didático com listas (use `/instagram-carousel`)
- For uma simulação de tweet puro (use `/instagram-carousel-tweet`)
- Não houver imagens disponíveis (este skill **depende de imagens**)

---

## Anatomia do slide

```
┌─────────────────────────────────┐
│                          [1/11] │ ← Indicador (canto direito superior)
│                                 │
│  ⬤  Nome Autor ✓                │ ← Avatar + nome + selo verificado
│     @handle                     │
│                                 │
│  Headline em negrito,           │ ← Headline grande (32-44px serif/sans bold)
│  duas a três linhas,            │
│  impactante e provocativa       │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │      IMAGEM GRANDE      │    │ ← Imagem dominante (16:9 ou 4:3)
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  Powered by EBS Aprendiz    🔇 │ ← Footer
└─────────────────────────────────┘
```

---

## Workflow (alto-nível)

```
1. Briefing      → Tema + autor + público
2. Curadoria     → @imagem-curator busca imagens (11 imagens)
3. Headlines     → @headline-writer escreve 11 headlines
4. HTML          → Skill gera template com slides
5. QA            → @qa valida (tom, imagens, marca)
6. Export PNG    → npm run export (Playwright)
7. Postar        → Dashboard / Meta Graph API
```

---

## Inputs necessários

### 1. Briefing
```yaml
tema: "Por que crianças que aprendem música têm melhor desempenho escolar"
autor:
  nome: "Alex Pereira"
  handle: "@alexpereira.ebs"
  avatar: "ASSETS/avatar-alex.jpg"  # 200x200px
  verificado: true
publico: "Pais 30-50 anos"
tom: "Provocativo + autoridade"
quantidade_slides: 11
```

### 2. Headlines (vem do `@headline-writer`)
```yaml
slides:
  - n: 1
    headline: "Por que a geração Z matou a vida cultural: O colapso silencioso da educação musical."
    imagem: "slide_1.jpg"  # 1080x720px
  - n: 2
    headline: "Em 2010, 78% das escolas tinham aula de música. Hoje, apenas 23%."
    imagem: "slide_2.jpg"
  # ... até slide 11
```

### 3. Imagens (vem do `@imagem-curator`)
- 11 imagens 1080×720px ou 1200×800px
- Tema visual coerente (estética jornalística / documental)
- Sem texto sobreposto (texto vem do HTML)
- Fontes preferenciais: Unsplash, Pexels, Pixabay (sempre **licença CC0**)

---

## Cores e tipografia

### Cores
```css
--bg:           #F5F2EC   /* fundo claro editorial */
--bg-dark:      #0A0A0A   /* fundo escuro alternado */
--text-dark:    #1A1A1A   /* texto principal */
--text-muted:   #6B6560   /* legendas */
--accent:       #D4A017   /* EBS dourado — selo verificado + indicador */
--white:        #FFFFFF
```

### Tipografia
- **Headlines:** `Crimson Pro` (serif jornalística) **OU** `Inter` (sans bold)
- **Nome autor:** `Inter 600` 14px
- **Handle:** `Inter 400` 13px cinza
- **Indicador (1/11):** `Inter 600` 12px branco em pill escura
- **Powered by:** `Inter 400` 11px cinza

> **Importação:** sempre use Google Fonts inline:
> ```html
> <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
> ```

---

## Template HTML

> **Arquivo base:** `assets/template-editorial.html`
> Para criar um carrossel:
> 1. Copie o template
> 2. Substitua `{{headlines}}` e `{{images_base64}}`
> 3. Salve em `carrosseis/{categoria}-{tema}-{N}.html`

### Estrutura mínima de um slide
```html
<div class="slide light">
  <!-- Indicador slide -->
  <div class="slide-indicator">1/11</div>

  <!-- Author header -->
  <div class="author">
    <img class="avatar" src="data:image/jpeg;base64,..." alt="Avatar"/>
    <div>
      <div class="author-name">Alex Pereira <svg class="verified">...</svg></div>
      <div class="author-handle">@alexpereira.ebs</div>
    </div>
  </div>

  <!-- Headline -->
  <h1 class="headline">
    Por que a geração Z matou a vida cultural:
    O colapso silencioso da educação musical.
  </h1>

  <!-- Imagem -->
  <img class="hero-image" src="data:image/jpeg;base64,..." alt="..."/>

  <!-- Footer -->
  <div class="footer">
    <span class="powered">Powered by <strong>EBS Aprendiz</strong></span>
    <svg class="mute-icon">...</svg>
  </div>
</div>
```

---

## Variantes de slide

| Slide | Tipo | Conteúdo |
|-------|------|----------|
| 1 | **Hero** | Headline forte + imagem provocativa (parar scroll) |
| 2–3 | **Problema** | Dado contundente + imagem que reforça |
| 4–6 | **Aprofundamento** | Argumentos / fatos / fonte de autoridade |
| 7–8 | **Solução** | Mostra "o que fazer" — método, prática |
| 9 | **Prova social** | Exemplo real / depoimento curto |
| 10 | **Provocação final** | Pergunta direta ao leitor |
| 11 | **CTA** | Logo EBS + handle + endereço + call-to-action |

> **Importante:** O último slide (CTA) tem **layout diferente** — sem imagem dominante. Em vez disso: logo grande EBS + texto + endereço.

---

## Comandos disponíveis

```
*create-editorial-carousel — Cria um carrossel editorial novo
*list-editorials           — Lista carrosséis editoriais criados
*duplicate-editorial {id}  — Duplica um carrossel para variação
*help                      — Mostra esta ajuda
```

---

## Reaproveitamento de `instagram-carousel`

✅ **Reaproveitado:**
- Workflow base de export (`scripts/export-carousel.js`)
- Sistema de cores EBS (#D4A017, #0A0A0A, #F5F2EC)
- Naming convention (`carrosseis/{CAT}-{slug}-{N}.html`)
- Estrutura de slides em pasta `slides/{slug}/slide_N.png`
- Embed de logo via base64
- Workflow do dashboard (`scripts/dashboard.js`)

❌ **Não reaproveitado:**
- Layout antigo (light/dark alternados com texto puro)
- Tags de "tópico" e accent bars
- Sistema de lista com emojis

---

## Agentes especializados

Esta skill funciona em conjunto com:

- **`@imagem-curator`** — Curadoria de imagens (web search + Unsplash + validação licença)
- **`@headline-writer`** — Redação de headlines impactantes (frameworks: PAS, AIDA, hook viral)
- **`@qa`** — Validação final (tom EBS, marca, copyright)

---

## Exemplo de uso

```
Usuário: "Cria um carrossel editorial sobre como a música melhora o desempenho escolar"

@aiox-master:
  1. Coleta briefing (autor=Alex, público=pais, slides=11)
  2. Delega para @headline-writer → 11 headlines
  3. Delega para @imagem-curator → 11 imagens
  4. Usa skill instagram-carousel-editorial para gerar HTML
  5. Delega para @qa → validação
  6. Executa npm run export → PNGs
  7. Envia para fila de postagem
```

---

## Constraints

- **Nunca usar imagens com texto sobreposto** (texto vem do HTML)
- **Sempre validar licença das imagens** (CC0 / royalty-free preferido)
- **Nunca revelar preços** (regra global EBS)
- **Handle sempre `@aprendiz.ebs`** (no slide CTA — não nos slides editoriais que podem usar persona do autor)
- **Logo EBS sempre embed base64** (nunca caminho relativo)
- **Idioma:** Português (BR)
