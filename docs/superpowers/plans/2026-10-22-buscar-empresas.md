# Buscar empresas com CNPJ.biz — plano de implementação

> Execução inline autorizada pelo usuário em 2026-10-22. Usar superpowers:executing-plans.

**Objetivo:** aquisição CNPJ.biz em Prospecção → Buscar empresas, ao lado dos resultados Google existentes.
**Spec:** docs/superpowers/specs/2026-10-22-buscar-empresas-design.md
**Stack:** Next 16.3, React 19, PostgreSQL, Vitest e Playwright existentes.

## Global Constraints

- Email adiado. Sem chamadas pagas nem implantação em produção.
- Preservar alterações locais alheias, fila, responsável, carteira e reservas existentes.
- Fronteira entre features: compartilhados em lib/server.
- TDD antes do produto. SQL imutável, LF, comentário apenas na primeira linha.
- Autoridade no banco, RLS e grants fechados. Testes só em bancos descartáveis locais.
- Segredo apenas no servidor, HTTP sem retries e sem redirects.
- Interface aproveita cores/tipografia/componentes atuais. Duas fontes, sem novo shell.
- Moldes obrigatórios lidos: app/usuarios/acoes.ts e formulario-criar.tsx; app/empresas/importar/acao.ts e formulario.tsx. Guias locais Next server-actions.md e forms.md.

### Task 1: Contrato e cliente CNPJ.biz

**Arquivos:** src/features/busca-empresas/tipos.ts e filtros.ts; src/server/cnpj-biz/cliente.ts e testes; src/lib/cnpj.ts com compatibilidade de empresas/cnpj.ts.
**Interfaces:** filtros normalizados, EmpresaEncontrada serializável, ResultadoBusca explícito, cliente.buscar(filtros). CNAE resolvido por atividade_id.
**Passos:**
1. Escrever testes de filtros/cliente para paginação, CNAE resolvido, formato real da listagem, contato ausente, erro e timeout sem retry.
2. Rodar npm exec vitest run -- --project unitario src/features/busca-empresas src/server/cnpj-biz. Expected: RED por módulos ausentes.
3. Implementar validação, normalização e cliente; rodar a mesma seleção. Expected: PASS.
4. Commit feat: adicionar cliente CNPJ.biz e filtros de busca.

### Task 2: Persistência, limites e importação

**Arquivos:** db/migracoes/0038_busca_empresas.sql; docs/db/0038.md; src/server/db/migracoes/invariantes.ts; src/features/busca-empresas/repositorio.ts; tests/integracao/busca-empresas.test.ts.
**Interfaces:** reservar(usuario,chave,nome,filtros) → ok/repetida/pausada/limite; concluir(id,resultado); importar(id,cnpjs) lê resultados persistidos. Tabelas busca_empresa, busca_empresa_limite, empresa_dados_cadastrais.
**Passos:**
1. Testes com comoUsuario real: isolamento, quota concorrente, repetição, pausa, senha provisória, persistência, importação, empresa existente preservada, sem telefone recusada, segunda importação idempotente.
2. Rodar npm exec vitest run -- --project integracao tests/integracao/busca-empresas.test.ts. Expected: RED pela ausência de objetos SQL.
3. Implementar migração, repositório e grants; rodar seleção e npm run db:checar. Expected: PASS.
4. Atualizar docs anteriores com ponteiro onde houver mudança de contrato. Commit feat: persistir buscas e importar empresas com limites.

### Task 3: Serviço, vendedor e gestor

**Arquivos:** src/features/busca-empresas/servico.ts, mensagens.ts e testes; app/fila/buscar/*; app/empresas/busca/*; links app/fila/page.tsx e app/empresas/page.tsx; src/components/crm/caminho.tsx; dados cadastrais compartilhados e fichas existentes.
**Interfaces:** serviço reserva antes de buscar; repetida retorna id sem HTTP; falha preservada; formulários enviam só filtros ou IDs. Repositório produz histórico, quota, resultados e listas Google. Exigir papel em cada action.
**Passos:**
1. Testes de orquestração com HTTP falso e repositório controlado; testes DOM de fontes, filtros, seleção e campos indisponíveis.
2. Rodar seleção unitária. Expected: RED antes dos módulos/componentes.
3. Implementar serviço, actions, formulários, histórico, limites e fichas. Expected: PASS na seleção + npm run typecheck + npm run lint.
4. Commit feat: disponibilizar busca de empresas na prospeccao.

### Task 4: Verificação completa e operação

**Arquivos:** tests/e2e/* apropriado aos padrões atuais; .env.example; docs/operacao/busca-empresas.md; tests/inventario-unitario.txt.
**Interfaces:** configuração de ambiente sem segredo público; caminho vendedor → fonte → busca persistida → seleção → grupo; gestor → limite/pausa.
**Passos:**
1. Cobrir caminho de UI com dados locais e testes de integração, sem rede externa.
2. Rodar npm run test:unit, npm run test:integracao, npm run typecheck, npm run lint, npm run db:checar, npm run test:inventario e build/e2e conforme runner existente. Expected: PASS, com falhas anteriores claramente separadas.
3. Revisão fresca do diff completo, corrigir problemas importantes com regressão.
4. Documentar chave, quotas, configuração do agente existente e limitações operacionais. Commit, push e abrir PR contra main, sem merge.

## Review Focus

Quota e autorização não podem depender do navegador. Repetir POST não pode emitir nova chamada paga. Importação não pode receber dados adulterados, sobrescrever cadastro existente, assumir carteira nem criar telefone fictício. Conferir o contrato EmpresaListagem e IDs de CNAE. Google deve mostrar sua origem com honestidade e não fingir agendamento. Segredo nunca aparece em client bundle, histórico ou mensagem de falha.
