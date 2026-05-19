# Meta Graph API — Fallback arquivado (2026-05-18)

Este diretório guarda os arquivos do pipeline de **refresh automático do token Meta IGAA** que estavam em desenvolvimento até 2026-05-16. Foram arquivados (não deletados) em 2026-05-18 quando o projeto decidiu migrar a camada de publicação para **Buffer**.

## Por que arquivar e não deletar

1. **Backup operacional:** se o Buffer falhar gravemente, podemos reativar este caminho em <1h reintegrando os arquivos
2. **Histórico técnico:** o approach "long-lived token + refresh em loop" é o único viável para contas IG Business Login (MEDIA_CREATOR account type) — vale documentar
3. **Aprendizado SaaS:** o setup chato (App Review da Meta, FB Page admin, App ID/Secret) é o motivo principal de termos migrado pra Buffer no modelo multi-cliente

## Conteúdo arquivado

| Arquivo | Função |
|---|---|
| `refresh-meta-token.yml` | GitHub Action que rodava nos dias 1 e 15 de cada mês, chamando o script Node |
| `refresh-meta-token.js` | Script Node que chama `oauth/access_token?grant_type=ig_refresh_token` e atualiza o GitHub Secret |

## Estado quando arquivado

- 80% pronto. Bloqueador final: PAT do GitHub do usuário precisava de permissão `Secrets:Read+Write` (só tinha Read). PAT foi revogado em 2026-05-18 sem ter sido corrigido.
- Script já testava token via `/debug_token` e mostrava dias restantes
- Workflow já mandava notificação por GitHub Issue em caso de falha

## Como reativar (se necessário)

1. Mover ambos arquivos de volta para localizações originais:
   - `.aiox/archived/meta-graph-fallback/refresh-meta-token.yml` → `.github/workflows/refresh-meta-token.yml`
   - `.aiox/archived/meta-graph-fallback/refresh-meta-token.js` → `scripts/refresh-meta-token.js`
2. Recriar Fine-Grained PAT em https://github.com/settings/personal-access-tokens com permissão **Repository → Secrets → Read and write** + **Actions → Read and write**
3. Adicionar o PAT como secret `META_REFRESH_PAT` no repo
4. Reativar o workflow no GitHub Actions (pode estar desabilitado após ficar 60 dias sem rodar)
5. Disparar manual com `gh workflow run refresh-meta-token.yml -f check_only=true` para validar

## Referência

- Decisão de migração: `.aiox/handoffs/session-state-2026-05-18.yaml`
- Memória estratégica: `~/.claude/projects/F--AIOX-PROJECTS-EBS-APRENDIZ/memory/project_publishing-platform-buffer.md`
- Memória técnica do refresh: `.aiox/handoffs/session-state-2026-05-16.yaml` (seção "Refresh automático do token Meta IGAA")
