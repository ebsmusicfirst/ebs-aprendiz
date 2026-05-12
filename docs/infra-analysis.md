# EBS Aprendiz — Infraestrutura & Arquitetura de Automação

**Data:** 2026-05-11
**Status:** ✅ Arquitetura definida — implementação em andamento

---

## Decisão Arquitetural

> **Criação e validação acontecem aqui, com os agentes.**
> **O n8n é exclusivamente o motor de postagem.**

Diferente do projeto `sobreviver-com-a-musica` (onde o n8n também cria o conteúdo),
no EBS Aprendiz toda a criação, curadoria e aprovação é feita em sessões com os agentes AIOX.
O n8n apenas executa o agendamento e publicação do que já está aprovado.

---

## Arquitetura Geral

```
╔══════════════════════════════════════════════╗
║         FASE 1 — CRIAÇÃO (Agentes AIOX)      ║
║                                              ║
║  @analyst → @ux-design-expert                ║
║      ↓                                       ║
║  /instagram-carousel (HTML + PNG)            ║
║      ↓                                       ║
║  @qa → validação de brand compliance         ║
║      ↓                                       ║
║  Alex aprova → Supabase: fila de postagem    ║
╚══════════════════════════════════════════════╝
                    ↓
         [Fila de carrosséis aprovados]
         Supabase: content_briefs (approved)
         Storage: PNGs 1080×1350px prontos
                    ↓
╔══════════════════════════════════════════════╗
║         FASE 2 — POSTAGEM (n8n)              ║
║                                              ║
║  Cron diário → busca próximo da fila         ║
║      ↓                                       ║
║  Meta Graph API → publica @aprendiz.ebs      ║
║      ↓                                       ║
║  Supabase: marca como published              ║
║      ↓                                       ║
║  Coleta métricas (após 24h)                  ║
╚══════════════════════════════════════════════╝
```

---

## Fase 1 — Criação com Agentes

### Workflow: `docs/workflows/carousel-creation.yaml`

| Etapa | Agente | O que faz |
|-------|--------|-----------|
| 1 | `@aiox-master` | Define tema, categoria, objetivo, público |
| 2 | `@analyst` | Pesquisa fonte de autoridade, valida dados |
| 3 | `@ux-design-expert` | Hook, estrutura dos slides, copy por slide |
| 4 | `/instagram-carousel` | Gera HTML + exporta PNG 1080×1350px |
| 5 | `@qa` | Checklist 10 pontos brand compliance EBS |
| 6 | Alex | Aprovação final → envia para fila |

### Modelo de trabalho em lote
- Criar **semanas de conteúdo de uma vez** (7–14 carrosséis por sessão)
- Organizar por categoria para variedade: EDU → MOT → MET → INS → SOC...
- Fila no Supabase garante postagem contínua mesmo sem novas sessões

### Categorias de temas
Ver: `docs/temas-carrosseis.md`

`EDU` Educação & Benefícios · `MET` Método EBS · `INS` Instrumentos
`SOC` Prova Social · `MOT` Motivacional · `TEC` Técnico Acessível
`CAP` Captação Direta · `BAS` Bastidores

---

## Fase 2 — Postagem com n8n

### O n8n faz APENAS:
1. Cron diário no horário definido
2. Consulta Supabase: próximo `content_briefs` com `status = approved`
3. Pega os PNGs do Supabase Storage
4. Publica no Instagram via Meta Graph API
5. Atualiza status: `published` + salva `meta_post_id`
6. Coleta métricas 24h depois

### O n8n NÃO faz:
- ❌ Pesquisa de temas
- ❌ Geração de copy
- ❌ Criação de imagens
- ❌ QA de conteúdo
- ❌ Decisões editoriais

### Workflow n8n (simplificado)
```json
Trigger: Cron
  → Supabase: SELECT * FROM content_briefs
              WHERE status = 'approved'
              AND client_id = 'ebs-aprendiz'
              ORDER BY scheduled_for ASC
              LIMIT 1
  → IF nenhum: enviar email alerta "fila vazia"
  → Supabase Storage: baixar PNGs do carrossel
  → Meta Graph API: criar container de carrossel
  → Meta Graph API: publicar
  → Supabase: UPDATE status = 'published', meta_post_id, published_at
  → Cron +24h: coletar métricas
```

---

## Stack de Infraestrutura

| Serviço | Uso no EBS | Status |
|---------|-----------|--------|
| **n8n** (Railway) | Motor de postagem | ✅ Rodando |
| **Supabase** | Fila de conteúdo + métricas | ✅ Configurado |
| **Supabase Storage** | PNGs aprovados | ⚠️ Configurar bucket `ebs-aprendiz` |
| **Meta Graph API** | Publicação @aprendiz.ebs | ⚠️ Tokens EBS pendentes |
| **Resend** | Alerta "fila vazia" para Alex | ✅ Configurado |
| **Claude API** | Agentes de criação | ⚠️ Key vazia no .env |
| **EXA Search** | @analyst — pesquisa de fontes | ✅ Configurado |
| **Apify** | @analyst — scraping de referências | ✅ Configurado |

---

## O que falta para ir ao ar

### 🔴 Bloqueadores críticos

| # | Item | Status | Valor |
|---|------|--------|-------|
| 1 | `META_IG_USER_ID` do @aprendiz.ebs | ✅ Obtido | `17841459660352099` |
| 2 | `META_FB_PAGE_ID` do @aprendiz.ebs | ✅ Obtido | `329616873564067` |
| 3 | `META_ACCESS_TOKEN` do @aprendiz.ebs | ✅ Obtido (**permanente**) | Ver `.env` |
| 4 | `ANTHROPIC_API_KEY` | ⚠️ Pendente | console.anthropic.com → API Keys |

> ⚠️ O access token atual é de **curta duração** (~1-2h). Antes de ativar o n8n,
> trocar por token de longa duração (60 dias) via:
> `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=TOKEN`

### Outras páginas EBS disponíveis (para expansão futura)

| Página | FB Page ID | IG User ID |
|--------|-----------|-----------|
| **Aprendiz.EBS** ← principal | `329616873564067` | `17841459660352099` |
| Ouro.EBS | `494213060443064` | `17841470286044033` |
| STAGE EBS | `235581092981893` | `17841460037035192` |
| Estúdio Black Space | `574832915913130` | `17841441380457823` |

### 🟡 Configuração

| # | Item | Esforço |
|---|------|---------|
| 4 | Criar bucket `ebs-aprendiz` no Supabase Storage | Baixo |
| 5 | Cadastrar EBS como `client` no Supabase | Baixo |
| 6 | Adaptar workflow n8n para postagem simples | Médio |
| 7 | Script de upload de PNGs aprovados para Supabase Storage | Médio |

### 🟢 Já pronto

- [x] n8n rodando no Railway
- [x] Supabase com schema multi-tenant
- [x] EXA, Apify, Resend configurados
- [x] Design system EBS documentado
- [x] Workflow de criação com agentes definido
- [x] 8 categorias de temas + 20+ temas no backlog
- [x] Carrossel 01 aprovado (EDU-beneficios-musica-01)

---

## Ordem de Execução Recomendada

```
AGORA:
  1. Resolver os 3 bloqueadores críticos (Meta tokens + Anthropic key)
  2. Criar 7–14 carrosséis em lote (1 semana de conteúdo)
  3. Configurar bucket Supabase Storage

DEPOIS:
  4. Script de upload PNGs → Supabase Storage
  5. Adaptar workflow n8n para postagem EBS
  6. Testar em modo simulado
  7. Ativar publicação real
```

---

## Referências

- Projeto base: `G:\Outros computadores\Meu laptop\sobreviver-com-a-musica`
- Workflow de criação: `docs/workflows/carousel-creation.yaml`
- Temas e categorias: `docs/temas-carrosseis.md`
- Brand brief: `docs/brand-brief-v1.md`

---

*EBS Aprendiz — Infra & Architecture · Orion (aiox-master)*
