# Plano: ficha de empresa do gestor

Executar com TDD e uma revisão independente final, conforme processo acordado.
Spec: `docs/superpowers/specs/2026-09-14-empresa-perfil-gestor-design.md`.

1. Criar testes de integração em `tests/integracao/empresa-perfil-gestor.test.ts`
   para leitura autorizada, campos, grupos, posse/reserva, retorno e vazio.
   Observar RED, implementar `src/features/empresas/perfil.ts`, obter GREEN.
2. Testar link em `app/empresas/linha.test.tsx` e página nova em
   `app/empresas/[id]/page.test.tsx`. Implementar rota e apresentação com
   componentes existentes, consulta administrativa e histórico já existente.
   Passar consulta da lista à linha para preservar volta, sem URL livre.
3. Adicionar jornada `tests/e2e/empresa-perfil-gestor.spec.ts`: acesso pelo nome,
   dados/histórico, voltar, negação ao vendedor e capturas responsivas.
4. Testes focados durante o trabalho. Uma rodada completa com dois workers
   unitários nesta máquina, integração Docker, build/E2E, lint e typecheck.
   Revisão independente, PR contra main, CI e validação visual antes do merge.

Preservar arquivos locais alheios. Sem migração, teste na Railway ou alteração
das ações de atendimento. Não iniciar edição cadastral nesta fatia.

## Execução

- RED observado no módulo de consulta inexistente e depois no link ausente e
  na página inexistente. GREEN: 73 testes focados de Empresas/consulta.
- Unitários completos: 909 passaram, um pulado, inventário de 910; executado
  com dois workers em cópia temporária do gerador, sem alterar configuração.
- Integração completa Docker: 465 passaram, um pulado.
- Typecheck, lint e convenções de migração verdes. Build isolado inclui
  `/empresas/[id]`. Capturas 1280/390 nos dois temas em test-results.
- Revisão independente sem achados bloqueantes. Cobertura declarada: não há
  teste específico de responsável desativado/descanso; ausência de escrita
  verifica contatos e a consulta usa apenas SELECT. E2E cobre volta com busca
  e página; os parsers dos demais filtros são os já existentes.
- 39 jornadas Chromium passaram. Banco `teste_b05c60abecba` removido pelo
  harness. Aviso anterior `destination stream closed early` reapareceu em
  jornadas antigas sem falha de teste; essas telas não foram alteradas.
