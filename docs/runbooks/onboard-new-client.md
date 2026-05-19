# Runbook — Onboarding de cliente novo (SaaS EBS-style)

> **Objetivo:** levar um cliente novo do zero ao "primeiro carrossel publicado no Instagram" em **menos de 60 minutos**, sem código.
>
> **Versão:** 1.0 (2026-05-18) — primeira versão. Base do produto SaaS multi-cliente.
>
> **Contexto:** EBS Aprendiz é piloto; este runbook nasce dele e deve servir para qualquer escola/negócio que queira o mesmo pipeline.

---

## 🧭 Visão geral do pipeline

```
┌───────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐    ┌─────────┐
│ Conteúdo +    │───→│ Geração de   │───→│ Geração de │───→│ Aprovação│───→│ Buffer  │───→ Instagram
│ headline      │    │ slides HTML  │    │ PNGs       │    │ + agenda │    │ API     │
│ (@social-mgr) │    │ (skills)     │    │ (Playwright)│    │ (dashboard│   │ (publish)│
│               │    │              │    │            │    │ local)    │   │         │
└───────────────┘    └──────────────┘    └────────────┘    └──────────┘    └─────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Imagens IA   │
                     │ (Vera + Gemini)│
                     └──────────────┘
```

---

## ✅ Pré-requisitos do cliente

Antes de começar, confirme que o cliente tem:

| Item | Por quê | Tempo médio para obter |
|---|---|---|
| Conta Instagram **Business** ou **Creator** | Exigência da Meta para qualquer API de publicação | 5min (converter de pessoal) |
| Página Facebook | Meta exige IG estar vinculado a uma FB Page | 10min (criar nova) |
| Cliente é **admin** da FB Page | Necessário para conectar à Buffer/Meta | 0min (cliente já admin) |
| Domínio + email profissional | Buffer pede pra criar conta | 0min (já tem) |
| Cartão de crédito | Caso Buffer free não baste no futuro (US$5/canal/mês) | 0min |
| Identidade visual (logos, cores, fontes) | Brand brief específico do cliente | 30-60min (você coleta) |
| Lista de temas inicial (10-15) | Backlog de carrosséis pro primeiro mês | 30min (workshop com cliente) |

---

## 📋 Etapas (em ordem)

### 1. Conta Buffer + canal IG conectado · ~10min

**Por que primeiro:** Buffer é o único componente que depende de aprovação humana do cliente (ele precisa logar na sua conta IG).

```
Passos:
1. Acesse https://buffer.com e crie conta (free plan basta no início)
   ├── Email do cliente OU email da agência (decisão de governança)
   └── Plano: Free (3 canais, 10 posts/fila/canal) — atende piloto
2. Conecte o Instagram do cliente:
   ├── "Connect a channel" → Instagram Business
   ├── Login com credenciais Facebook do cliente
   ├── Buffer pede acesso à FB Page → autorizar
   └── Selecionar conta Instagram ligada à página
3. ✅ Confirme: o canal aparece em buffer.com com handle correto
```

**⚠️ Atenção sobre tokens Buffer:**
- O token que aparece nas configs da UI (`developers.buffer.com`) ou colado do navegador pode ser **OIDC** (token de sessão da UI), **não** access token de API
- Para uso programático, faça OAuth flow proper:
  - Criar app em `https://developers.buffer.com/`
  - Implementar redirect `/oauth2/authorize` → exchange code por `access_token`
  - O access token será longo (~50+ chars) e funciona no header `Authorization: Bearer <token>`
- **Sintoma de token errado:** HTTP 401 com mensagem "OIDC tokens are not accepted for direct API access"

### 2. Criar pasta do cliente · ~5min

Estrutura espelhada do EBS:

```bash
mkdir -p clients/<client-slug>/{ASSETS,carrosseis,slides,referencias,docs}
cp -r .claude/skills/AIOX clients/<client-slug>/.claude/
cd clients/<client-slug>
```

Arquivos essenciais a criar:

- `CLAUDE.md` — copy do EBS, ajustar identidade
- `docs/brand-brief-v1.md` — preencher com dados do cliente
- `queue.json` — `{ "carousels": [] }` vazio
- `.env` — `BUFFER_ACCESS_TOKEN=<client-token>`, `GEMINI_API_KEY=<shared>`, `PEXELS_API_KEY=<shared>`

### 3. Brand brief · ~30-60min (sessão com cliente)

Use o template de `docs/brand-brief-v1.md` (EBS) como base. Adapte:

- Nome, missão, fundador, localização, fundação
- Tom de voz (mentor? agressivo? técnico? lúdico?)
- Personas (idade, motivações, dor)
- Cores da marca (hexes)
- Logos (`ASSETS/logo-principal.png` em transparente + fundo escuro)
- Handle Instagram + endereço físico (se relevante)
- CTAs típicos
- **Proibições de conteúdo** (preço? promessas? gírias? gêneros específicos?)

### 4. Setup dos agentes específicos · ~20min

Os agentes genéricos (@dev, @qa, @architect) servem todos os clientes. Os customizados precisam ser adaptados:

- **@social-manager** — cadência editorial específica (ex: EBS = diária; cliente B talvez 3×/semana)
- **@imagem-curator (Iris)** — critérios visuais por brand (ex: EBS = minimalista; cliente B talvez maximalista)
- **@maestro** (ou equivalente específico do nicho) — copy gate técnico
- **@headline-writer (Hugo)** — pode reusar diretamente, ajusta exemplos

### 5. Skills de geração · ~5min

Reutilize sem alteração:
- `/instagram-carousel` (editorial)
- `/instagram-carousel-tweet` (tweet style)

Se o cliente precisar de estilo visual novo, crie nova skill espelhada.

### 6. Geração de imagens IA · zero esforço

Pipeline já funciona out-of-the-box com Vera + Gemini Nano Banana:
- `@visual-prompt *prompt-imagem <tema>` gera prompt cinematográfico
- Dashboard `/api/imagen/generate` chama `gemini-2.5-flash-image` ($0,04/img)
- Resultado 3:4 portrait nativo, sem safety filter problemático

**Custo:** ~$1,20/mês com 1 imagem/dia × 30 dias.

### 7. Dashboard local · ~5min

Cliente vai usar o seu dashboard remoto OU rodar local. Para SaaS multi-cliente, refatorar para `dashboard.js?client=<slug>` no futuro.

Por enquanto (piloto):
```
node scripts/dashboard.js
# Em outro terminal:
# Conectar à pasta do cliente:
cd clients/<client-slug> && BASE_DIR=$(pwd) node ../../scripts/dashboard.js
```

### 8. Primeira aprovação + publicação · ~10min

1. Cliente gera primeiro carrossel via skill
2. @qa + @imagem-curator validam
3. Cliente abre dashboard → aprova → agenda
4. Buffer publica no horário (você não precisa estar online)
5. ✅ Confirma post no IG do cliente

---

## 🎯 Critérios de "onboarding completo"

- [ ] Buffer conectado com canal IG correto
- [ ] Brand brief preenchido em `docs/brand-brief-v1.md`
- [ ] Pelo menos 1 carrossel gerado, aprovado e agendado
- [ ] Cliente recebeu acesso ao dashboard (URL + senha se aplicável)
- [ ] Cliente recebeu **lista de 10 temas iniciais** + workflow de aprovação

---

## ⏱️ Tempos médios (com cliente já preparado)

| Etapa | Tempo |
|---|---|
| Buffer + IG connect | 10min |
| Pasta + scaffold | 5min |
| Brand brief | 30-60min (depende do cliente) |
| Adaptação de agentes | 20min |
| Primeiro carrossel até IG | 10-20min |
| **TOTAL** | **~75-115min** |

Meta SaaS: chegar a **<45min** com automação dos passos 2, 4 e 7 (CLI ou web setup).

---

## 🚧 Pendências / TODOs do produto

- [ ] CLI `aiox new-client <slug>` que automatiza passos 2 e 7
- [ ] Dashboard multi-tenant (hoje é single-tenant EBS)
- [ ] Billing automatizado (Stripe + Buffer API por cliente)
- [ ] Self-service signup (cliente cria conta sem você)
- [ ] OAuth Buffer flow integrado (cliente conecta IG via clique único)
- [ ] White-label dashboard (logo do cliente em vez de "EBS Aprendiz")

---

## 📚 Referências

- Decisão Buffer: `~/.claude/projects/F--AIOX-PROJECTS-EBS-APRENDIZ/memory/project_publishing-platform-buffer.md`
- Contexto SaaS: `~/.claude/projects/F--AIOX-PROJECTS-EBS-APRENDIZ/memory/project_saas-pilot-context.md`
- Brand brief de referência: `docs/brand-brief-v1.md` (EBS Aprendiz)
- Pipeline visual: `.claude/skills/AIOX/agents/visual-prompt/SKILL.md` (Vera)
