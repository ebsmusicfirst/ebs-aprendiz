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
