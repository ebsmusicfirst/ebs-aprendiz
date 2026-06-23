# 🗂️ Índice de Handoffs — EBS Aprendiz

> **REGRA #1 de qualquer nova sessão**: leia este índice ANTES de qualquer trabalho.
> Handoffs do EBS Aprendiz vivem em **múltiplos diretórios** historicamente.
> Esta página é a fonte canônica de "onde procurar contexto".

---

## 📍 Localizações de handoffs/contexto (TODAS devem ser checadas)

| Caminho | Conteúdo | Frequência |
|---|---|---|
| **`.aiox/handoffs/`** | YAMLs estruturados de session-state | Por sessão Master |
| **`docs/handoff-*.md`** | Handoffs narrativos em markdown (mais legíveis) | Ad-hoc |
| **`docs/handoff-state.yaml`** | State único legado | Eventual |
| **`docs/brand-brief-v*.md`** | Identidade da marca, regras estáveis | Raramente muda |
| **`docs/qa-carousel-checklist.md`** | Quality gate criado 2026-05-15 | Estável |
| **`docs/temas-carrosseis.md`** | Backlog de temas e categorias | Atualizado por lote |
| **`docs/workflows/*.yaml`** | Pipelines (carousel-editorial-creation, etc.) | Raramente muda |
| **`C:/Users/.claude/projects/F--AIOX-PROJECTS-EBS-APRENDIZ/memory/MEMORY.md`** | Auto-memória persistente do Claude | Por sessão |
| **`.claude/skills/instagram-carousel-*/`** | Skills de geração | Quando muda template |
| **`.claude/skills/AIOX/agents/*/SKILL.md`** | Definições de agentes (inclui @maestro, @social-manager, @imagem-curator, @headline-writer) | Por agente novo |

---

## 📜 Histórico cronológico

### 2026-05-12 — Setup inicial Meta + dashboard
- **Arquivo:** `.aiox/handoffs/session-state-2026-05-12.yaml`
- **Highlights:** Page Access Token permanente (223 chars, EAA*) configurado e testado. 1 post publicado (EDU-01).
- **Agente:** @aiox-master

### 2026-05-14 — Migração de token + nova skill editorial
- **Arquivo:** `docs/handoff-2026-05-14.md` ← FÁCIL DE PERDER (fora do diretório padrão)
- **Highlights:**
  - Trocou Page Token EAA por **token de Test User IGAA** (181 chars) via "Configuração da API do Instagram"
  - 4 posts publicados em sequência (provavelmente teste)
  - **Estado REAL do Instagram:** só 1 post no feed (EDU-07) — outros 6 deletados pelo Alex
  - Criou skill `/instagram-carousel-editorial` + agentes @imagem-curator (Iris) e @headline-writer (Hugo)
  - Piloto MOT-talento-mito-08.html gerado, mas usuário disse "ficou ruim" — precisa iteração visual
  - ⚠️ **Alerta registrado:** "Token IGAA ainda não foi testado em publicação"

### 2026-05-15 — Removeu DeepSeek, criou QA checklist
- **Arquivo:** `.aiox/handoffs/session-state-2026-05-15.yaml`
- **Highlights:**
  - Removeu proxy DeepSeek, voltou 100% Anthropic
  - @qa e @analyst pinados em Opus 4.7
  - Bug fix do dashboard (event delegation no lugar de inline onclick)
  - Auto-publisher GitHub Action `*/15 * * * *`
  - Botão Exportar PNGs + auto-commit+push
  - QA checklist criado (`docs/qa-carousel-checklist.md`)
  - Atlas brainstormou 5 tweets, todos exportados e prontos
  - Criou @maestro e @social-manager
  - **Token IGAA falhou no primeiro teste real de publicação hoje** (Cannot parse access token)
- **Erro de processo identificado:** Não li `docs/handoff-2026-05-14.md`. Adicionei este INDEX para evitar repetição.

### 2026-06-23 — Campos custom nas 7 pautas + limpeza de títulos ← MAIS RECENTE
- **Arquivo:** `.aiox/handoffs/session-state-2026-06-23.yaml`
- **Highlights:**
  - Setados campos `framework`, `statusPauta` (Backlog) e `pilar` nas 7 pautas do backlog — via API ClickUp (ClickUp Unlimited ativo)
  - Títulos limpos: removido sufixo "— framework: X" que era workaround do FIELD_033
  - Verificado: `readDropdown(cu.FIELDS.pautas.framework, t)` retorna valor correto end-to-end
  - Pipeline `loop-gerar.js` pronto para herdar framework das pautas
- **Próximos passos:**
  1. Testar `npm run loop:gerar` com uma pauta em "Aprovada p/ Criar"
  2. Aprovar um criativo e observar Buffer/Action
  3. Injetar logo base64 nos tweet-v4 com `{{LOGO_B64}}`

### 2026-06-22 — Fix GitHub Action (package-lock + secrets contaminados)
- **Arquivo:** `.aiox/handoffs/session-state-2026-06-22.yaml`
- **Highlights:**
  - **Bug 1 resolvido:** `package-lock.json` estava no `.gitignore` — `npm ci` falhava no CI. Fix: removido do `.gitignore`, gerado e commitado.
  - **Bug 2 resolvido:** Secrets `CLICKUP_API_KEY` e `BUFFER_ACCESS_TOKEN` contaminados com banner do dotenvx (`◇` = char 9671 > 255). Causava erro ByteString ao usar como header HTTP. Fix: re-setados lendo direto do arquivo `.env` sem passar por Node/dotenvx.
  - **GitHub Action:** ✅ passando (run 27978443418, 19s)
  - **Lição gravada:** nunca usar `require('dotenv').config()` via stdout para `gh secret set` — dotenvx contamina com Unicode
- **Pendência:** ClickUp Unlimited ($7/mês) — aguardando Alex assinar para setar campos nas 14 pautas e testar `loop:gerar` end-to-end

### 2026-06-19 — Loop completo (Fases 1+2+3) + incidente Buffer cancelado
- **Arquivo:** `.aiox/handoffs/session-state-2026-06-19.yaml`
- **Highlights:**
  - **Incidente Buffer resolvido:** 10 posts ao ar sem aprovação → todos cancelados via API. Cron `post-daily.yml` desabilitado. Regra permanente gravada em memory.
  - **ClickUp 🟢 SAUDÁVEL:** L0 (DNA 5 / ICP 4 / Ofertas 3) + L1 (campanha ativa) + L2 (3 criativos + 14 pautas) populados via API
  - **Fase 1 — Campos ClickUp:** statusPipeline (6 opções) + statusPauta (5 opções) + notasRevisao criados. IDs em `clickup-map.json`
  - **Fase 2 — Scripts:** `loop-gerar.js` (pauta → HTML → PNGs → ClickUp "Em Aprovação") + `loop-publicar.js` (criativo "Aprovado" → Buffer → ClickUp "Agendado"). `STATE.md` criado.
  - **Fase 3 — GitHub Action:** `.github/workflows/loop-publicar.yml` ativo. Cron 06h + 18h BRT. Secrets `CLICKUP_API_KEY` + `BUFFER_ACCESS_TOKEN` registrados.
  - **Slides tweet-v4:** 3 × 8 PNGs exportados e commitados (`slides/tweet-v4-*/`)
  - **Pendência principal:** assinar ClickUp Unlimited ($7/mês) para eliminar limite FIELD_033 e setar campos nas 14 pautas do backlog
- **Próxima ação:** após assinar Unlimited → rodar `npm run loop:gerar` com pauta aprovada (teste end-to-end)

### 2026-06-18 — Housekeeping + Diagnóstico ClickUp + Arquitetura do Loop
- **Arquivo:** `.aiox/handoffs/session-state-2026-06-18.yaml`
- **Highlights:**
  - **P1 concluído:** Logo base64 injetado nos 3 tweet-v4 HTMLs
  - **P2 concluído:** 9 commits + push (690718d → f3da99e) — todo backlog de arquivos commitado
  - **P4 concluído:** .env limpo (26 vars CLICKUP_* obsoletas removidas)
  - **P9 parcial:** 24 PNGs exportados (8 slides × 3 carrosséis tweet-v4)
  - **export-carousel.js:** corrigido para suportar `.x-slide` (tweet-v4) além de `.slide`
  - **clickup-check.js:** script de diagnóstico criado — `npm run check`
  - **ClickUp space:** nome estava `null`, corrigido via API para "EBS Aprendiz"
  - **Loop arquitetado:** doutrina Loops/Goals aplicada ao pipeline EBS (NÃO implementado)
  - **Pendência principal:** implementar loop (Fases 1+2+3) — estimativa 1 sessão
  - 2 carrosséis tweet-v4 ainda não registrados no ClickUp (guitarra-sozinho, sem-tempo)

### 2026-06-11 — ClickUp Syncra L0/L1/L2 + carrosséis tweet-v4 (fundo branco)
- **Arquivo:** `.aiox/handoffs/session-state-2026-06-11.yaml`
- **Highlights:**
  - **Carrosséis tweet-v4 criados:** `tweet-v4-3-sinais-professor-05.html`, `tweet-v4-guitarra-sozinho-01.html`, `tweet-v4-sem-tempo-03.html` — fundo branco (`#F2F2F2` frame, `#FFFFFF` slides), sem seções de imagem, texto 24px+
  - ⚠️ Todos têm `{{LOGO_B64}}` no slide CTA — **injetar logo antes de exportar PNGs**
  - **ClickUp Syncra integration completa:** `scripts/clickup-bootstrap.js` + `scripts/clickup.js` + `scripts/clickup-map.json`
  - Arquitetura L0 Estratégico / L1 Tático / L2 Operacional materializada no ClickUp com herança L1→L2
  - Pipeline validado end-to-end: Gerado → Em Aprovação → Aprovado → Agendado → Postado
  - Journey Log funcionando
  - **Campanha ao vivo:** "Desconstrucao de Mitos Musicais" (86e1th44r) | **Criativo ao vivo:** 86e1th45d
  - **SEGURANÇA:** CLICKUP_API_KEY exposta no chat — rotacionar em ClickUp Settings > Apps
  - **Nada commitado** — próxima sessão deve commitar + injetar logo

### 2026-05-18 — Decisão estratégica: migrar publicação para Buffer
- **Arquivo:** `.aiox/handoffs/session-state-2026-05-18.yaml`
- **Highlights:**
  - **Decisão:** abandonar Meta Graph API direto para publicação; migrar para **Buffer free plan**
  - **Motivo composto:** (a) dor recorrente do refresh-token Meta a cada 60 dias; (b) reconhecimento de que EBS é piloto de SaaS multi-cliente e onboarding via Graph API não escala
  - **Alternativas avaliadas:** Ayrshare (caro p/ começar, US$149/mês) e Postiz (exige VPS 24/7, reavaliar com ≥20 clientes)
  - **Sem código nesta sessão** — apenas pesquisa, decisão e atualização de memória/handoffs
  - **Memórias estratégicas criadas:** `project_publishing-platform-buffer.md` (decisão + gatilhos de reavaliação) e `project_saas-pilot-context.md` (framing SaaS para futuras decisões)
- **Próximos passos:** integrar Buffer API ao dashboard, aposentar (sem deletar) refresh-meta-token.yml, escrever runbook de onboarding de cliente

### 2026-05-16 — Imagen 4 + Iris + refresh automático do token Meta
- **Arquivo:** `.aiox/handoffs/session-state-2026-05-16.yaml`
- **Highlights:**
  - **Hooks de Claude Code corrigidos:** SessionStart (carregava handoffs) + PostToolUse (smoke test automático) registrados em settings.local.json
  - **Iris (@imagem-curator) criada:** agente para QA visual de carrosséis via screenshots Playwright + 10 critérios
  - **Campo ✦ IA por card no dashboard:** edição livre via claude-sonnet-4-5 (sem precisar Claude Code aberto)
  - **Painel ✦ Gerar Imagens — Imagen 4:** geração de imagem via Google AI Studio (~US$0,03/img), 5 presets EBS, aplicar direto ao carrossel. Substitui Pexels para casos onde foto precisa ser exclusiva/contextualizada.
  - **Refresh automático do token Meta IGAA:** workflow mensal (dias 1 e 15), script com tracking de validade, badge no header do dashboard mostrando dias restantes
  - **Bug fix:** `\n` em template literal Node.js virava newline literal → JS quebrava no browser
  - **REGRA gravada no MEMORY:** sempre rodar `node scripts/test-dashboard.js` após qualquer edit em dashboard.js
- **Pendência crítica:** PAT do usuário criado sem permissão `Secrets:Write`. Precisa editar permissão para o workflow conseguir atualizar o secret automaticamente. (Detalhes no YAML.)
- **Security note:** PAT colado em texto plano no chat hoje. Rotacionar após validar.

---

## ⚠️ Verdades inconvenientes a NÃO esquecer

1. **queue.json está dessincronizado do Instagram real.** Diz que 6 estão publicados, mas só 1 (EDU-07) está no feed. Os outros foram deletados.

2. **O token atual (IGAA, Test User) não está confirmado como long-lived.** Pode ser long-lived (60 dias) que invalidou cedo, OU short-lived (1h) que durou 2h e foi confundido. Sem APP_ID + APP_SECRET no .env, não dá pra debugar via `/debug_token`.

3. **Existe piloto MOT-talento-mito-08.html pendente** desde ontem, com feedback "ficou ruim". Não foi iterado.

4. **Skill `/instagram-carousel-editorial`** existe mas eu (15/05) gerei os 5 novos tweets usando o template tweet antigo, não a editorial nova. Pode ser intencional (são tweet, não editorial), mas vale revisar.

---

## 🔁 Protocolo de início de sessão (a partir de agora)

```
1. Ler este INDEX.md
2. Ler o handoff mais recente (data MAX no histórico cronológico)
3. Ler MEMORY.md (auto-memória do Claude)
4. Listar `find docs -name "*handoff*"` para garantir que não há novos lugares
5. Confirmar estado da queue + estado real do Instagram (não confiar só no queue.json)
6. Só então começar trabalho
```

---

## 🔧 Como salvar contexto ao final da sessão (regra nova)

1. Atualizar `.aiox/handoffs/session-state-YYYY-MM-DD.yaml` com tudo da sessão
2. Atualizar este `INDEX.md` adicionando entrada cronológica
3. Atualizar `C:/Users/.claude/projects/.../memory/MEMORY.md` com pointers
4. Se descobrir nova localização de contexto, adicionar à tabela "Localizações"
