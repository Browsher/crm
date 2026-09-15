# Plano: vendas e agenda

**Goal:** Compra posterior na Carteira e eventos de venda no histórico, corrigindo retorno combinado perdido.
**Architecture:** PostgreSQL como autoridade; validação comum em lib; feature vendas independente; composição de histórico por UNION, sem contato fictício. Componente de venda no perfil usa padrões atuais.
**Tech Stack:** Next/React, PostgreSQL, Vitest/Playwright existentes.

- [x] RED/GREEN retorno: tipos/regras/formulário e teste real reserva→retornar_depois→Funil/Meu dia. Guarda do banco para tipo/desfecho coerentes e data exigida. Sem recuperação automática de dados antigos.
- [x] RED/GREEN vendas: migração0031 com comando carteira_venda_registrar; testes de autorização, idempotência, concorrência e tarefa preservada. Parser comum em lib/venda; reexport de funil mantém consumidor existente.
- [x] RED/GREEN histórico: contato/historico.ts compõe venda com dados opcionais tipados; render em ficha, agenda, linha-do-tempo e empresa gestor. Não alterar contagem de contatos/dashboard para contar vendas como ligações.
- [x] RED/GREEN UI e action: app/carteira/venda-acao.ts e registrar-venda.tsx, botão no perfil só de cliente, confirmação/erro/rascunho/idempotência. Campos iguais ao Funil.
- [ ] Jornada navegador completa: Prospecção com retorno hoje, Funil, venda, Carteira com nova compra e histórico, Meu dia preservado. Revisão independente final, suítes finais, PR/CI. Atualização local somente com preflight e invariantes.

## Verificação local em 15/09/2026

946 testes unitários inventariados, suíte concluída pelo gerador (inclui um pulado). Integração:493 passaram e1 pulado. Navegador:43 passaram. Build E2E, typecheck e db:checar aprovados. Lint sem erros, um aviso preexistente em .artifact-work/analyze_gs1_result.mjs.

Revisão independente sem achados P1/P2. Acrescentados testes de retorno futuro e autorização revogada durante espera pelo lock. Hipótese de corrida entre history.back e refresh não reproduzida: ambas as vendas aparecem no histórico na jornada real após salvar. Capturas carteira-venda-390.png e carteira-historico-vendas.png conferidas visualmente.

Migração0031 aplicada apenas em localhost:5432/crm após preflight das duas URLs; invariantes ok. Railway não alterada. PR e validação visual do usuário pendentes.
