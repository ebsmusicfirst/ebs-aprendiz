# AUDIT COMPLETO — Dashboard EBS Aprendiz
**Data:** 2026-05-14  
**Status:** ⚠️ PROBLEMAS ENCONTRADOS

---

## 🔴 PROBLEMAS IDENTIFICADOS

### 1. **Botão "Visualizar" Desaparecendo**
- **Local:** `renderGrid()` linha 409
- **Causa:** CSS `.card-actions` com `flex-wrap: wrap` + botões largos causam quebra de linha
- **Impacto:** Botão fica oculto em telas menores
- **Solução:** Aumentar tamanho dos cards ou redesenhar layout

### 2. **Função openApprove() sem Modal**
- **Local:** linha 428-430
- **Problema:** `openApprove()` chama `updateStatus()` sem confirmação
- **Risco:** Aprovação acidental sem feedback
- **Solução:** Adicionar confirmação visual

### 3. **window.open() Bloqueado pelo Navegador**
- **Local:** `openPreview()` linha 425
- **Problema:** `window.open()` é bloqueado por pop-up blockers
- **Impacto:** Usuário não consegue visualizar carrosséis
- **Solução:** Usar modal interno ou nova tab via navegação

### 4. **Agendamento sem Validação de Fuso Horário**
- **Local:** `confirmSchedule()` linha 455
- **Problema:** `datetime-local` usa fuso local do navegador, não BRT fixo
- **Risco:** Publicações no horário errado em fuso diferente
- **Solução:** Converter para BRT explicitamente ou usar UTC

### 5. **Sem Feedback de Ação**
- **Local:** Após Aprovar/Publicar/Agendar
- **Problema:** Nenhuma notificação visual (toast/alert)
- **Impacto:** Usuário não sabe se ação funcionou
- **Solução:** Adicionar toast notifications

### 6. **Falta Integração com Meta Graph API**
- **Local:** `confirmPublish()` linha 450
- **Problema:** Botão "Publicar" atualiza apenas status local, não publica realmente
- **Impacto:** Carrosséis não são enviados ao Instagram
- **Solução:** Implementar chamada ao /api/carousel/{id}/publish (requer meta-api.js)

### 7. **Queue.json não Persiste Agendamentos**
- **Local:** Após clicar "Agendar"
- **Problema:** `scheduled_for` é salvo, mas sem validação
- **Risco:** Formato inválido pode quebrar sistema
- **Solução:** Validar formato ISO 8601 antes de salvar

### 8. **Sem Proteção contra Dupla-Clique**
- **Local:** Todos os botões de ação
- **Problema:** Duplo clique = múltiplas requisições
- **Impacto:** Estados inconsistentes
- **Solução:** Desabilitar botão durante requisição

---

## ✅ VERIFICAÇÃO — RECURSOS PRONTOS?

| Recurso | Status | Notas |
|---------|--------|-------|
| Dashboard HTML | ✅ Pronto | Carrega e renderiza corretamente |
| Queue.json | ✅ Pronto | Estrutura válida, 7 carrosséis registrados |
| Botões Aprovar | ⚠️ Incompleto | Sem confirmação, sem feedback |
| Botões Agendar | ⚠️ Incompleto | Sem validação de fuso horário |
| Botões Publicar | ❌ Não Pronto | Não integrado com Meta Graph API |
| Modal Agendamento | ✅ Funcional | HTML/JS corretos, mas sem validação |
| Modal Publicação | ✅ Funcional | HTML/JS corretos, mas sem integração |
| Visualização Carrosséis | ❌ Quebrado | window.open() bloqueado, botão desaparece |
| Persistência de Status | ✅ Pronto | Salva em queue.json via PATCH |
| Atualização em Tempo Real | ✅ Funcional | setInterval(loadQueue, 5000) ativo |

---

## 📋 CHECKLIST PARA CORRIGIR

- [ ] Redesenhar `.card-actions` para 2 linhas (Aprovar/Agendar em cima, Publicar/Visualizar embaixo)
- [ ] Adicionar modal de confirmação antes de Aprovar
- [ ] Implementar modal interno para Visualizar (lightbox)
- [ ] Validar `scheduled_for` em formato ISO 8601
- [ ] Adicionar toast notifications para sucesso/erro
- [ ] Adicionar disclaimer: "Publicar não está integrado com Meta (ainda)"
- [ ] Desabilitar botões durante requisição
- [ ] Testar agendamento com diferentes fusos horários
- [ ] Documentar flow completo de aprovação → agendamento → publicação

---

## 🎯 RECOMENDAÇÃO FINAL

**PARA PRODUÇÃO (QA + Agendamento):**
- ✅ Dashboard é funcional PARA APROVAR e AGENDAR carrosséis
- ✅ Dados são salvos corretamente em queue.json
- ✅ Preview funciona (com correção do modal interno)
- ⚠️ Publicação real requer integração com Meta API (próxima fase)

**PRÓXIMOS PASSOS:**
1. Corrigir UI (layout dos botões, visualização)
2. Adicionar modals de confirmação
3. Implementar toast notifications
4. **DEPOIS:** Exportar PNGs + Supabase + Meta API

---

## 📊 IMPACTO DOS PROBLEMAS

| Problema | Bloqueia QA? | Bloqueia Agendamento? | Bloqueia Publicação? |
|----------|--------------|----------------------|----------------------|
| Botão Visualizar | ❌ Não | ❌ Não | ❌ Não |
| Sem Confirmação | ❌ Não | ❌ Não | ❌ Não |
| window.open | ✅ Sim | ❌ Não | ❌ Não |
| Fuso Horário | ❌ Não | ⚠️ Sim | ⚠️ Sim |
| Sem Meta Integration | ❌ Não | ❌ Não | ✅ Sim |

**Conclusão:** Dashboard está **80% pronto para QA e agendamento**, mas precisa de polimento para produção.
