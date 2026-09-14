# Plano do dashboard do gestor

> Executar com superpowers:executing-plans, TDD por entrega e uma revisão independente final.

**Objetivo:** implementar o desenho aprovado em `/gestao`.
**Spec:** `docs/superpowers/specs/2026-09-14-dashboard-gestor-design.md`.
**Arquitetura:** consulta única no contexto `comoUsuario`, autorizada por
`eh_gestor()`, com agregações SQL consistentes e apresentação servidora.
**Stack:** Next.js instalado, PostgreSQL, componentes locais, Vitest e Playwright.

## 1. Consulta autorizada

- [x] Criar `tests/integracao/gestao-dashboard.test.ts`: vendedores ativos,
  último retorno, contagem de contatos por autor, disponibilidade, zero e
  recusa de vendedor/inativo. Executar e observar RED antes de implementar.
- [x] Criar `src/features/gestao/consulta.ts`, com tipos exportados e consulta
  única para manter todas as contagens no mesmo snapshot. Sem importar outra
  feature e sem credencial administrativa. Datas no SQL em America/Sao_Paulo.
- [x] Executar o teste no harness local e conferir GREEN.

## 2. Tela

- [x] Escrever `app/gestao/page.test.tsx` para guardas, cards, rótulos,
  ausência de busca, estados vazios e atalhos administrativos; observar RED.
- [x] Atualizar `app/gestao/page.tsx` e `gestao.module.css`, preservando título
  Gestão e atalhos já usados nos testes. Adicionar loading/error acessíveis.
- [x] Cards em duas colunas, quatro totais, lista de atividade com dez itens,
  uma coluna no celular. Não criar links para perfil futuro.
- [x] Rodar testes focados e typecheck.

## 3. Verificação e entrega

- [x] Ampliar `tests/e2e/gestao.spec.ts` com cards reais, ausência de busca,
  atualização, estados e capturas 390/1280 claro/escuro. Usar fixture local.
- [x] Rodar inventário/unitários, integração, lint, db:checar e build/E2E.
- [x] Revisão independente final; corrigir achados e repetir checks afetados.
- [ ] Commit somente dos arquivos da fatia, PR contra main e CI no SHA final.
- [ ] Mostrar capturas ao usuário. Merge somente após validação visual.

Preservar PREFERENCIAS.md e todos os arquivos locais alheios. Nenhuma migração
prevista e nenhum teste ou demonstração na Railway.

## Evidências da execução

- Consulta: RED por módulo inexistente; GREEN nos cinco cenários originais.
  Fixture de meia-noite recebeu cast explícito date -> timestamp antes de
  AT TIME ZONE, pois a conversão implícita deslocava o horário da fixture.
- Tela: quatro testes RED antes da mudança e GREEN depois; dois testes de
  estados também criados antes dos componentes. Typecheck e lint verdes.
- Revisão independente sem achados bloqueantes. Reforçados totais com dois
  vendedores, valores reais no E2E, desativação e empate de horário no SQL.
- Integração completa: 459 passaram, um pulado. Depois dos dois casos
  adicionais, arquivo do dashboard: sete passaram.
- Unitários: 903 passaram, um pulado, inventário de 904. Duas rodadas com
  paralelismo padrão atingiram timeouts de 5s em arquivos anteriores
  (diretivas e leitura XLSX). Diretivas passou isoladamente; rodada completa
  passou com `--maxWorkers=2`, sem alterar timeouts, testes antigos ou CI.
- Build isolado de produção e 37 jornadas Chromium passaram. Capturas
  390/1280 nos dois temas em `test-results/gestao-*.png`.
- Banco do E2E `teste_6ce62cfc0148` removido pelo harness ao terminar.
  O aviso anterior `destination stream closed early` reapareceu nas jornadas
  de grupos/reserva, sem falha de teste; não houve alteração nessas telas.
