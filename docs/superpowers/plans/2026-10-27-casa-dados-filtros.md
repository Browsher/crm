# Plano: filtros adicionais Casa dos Dados

**Objetivo:** implementar os filtros escolhidos pelo usuário, preservando o formato histórico e a operação atual.
**Desenho:** docs/superpowers/specs/2026-10-27-casa-dados-filtros-design.md.
**Execução proposta:** nesta conversa, implementação direta com TDD e uma revisão independente final. A implementação depende da aprovação do desenho completo; ainda não iniciada.

## Arquivos e responsabilidades

- src/lib/banco-empresas.ts e novo teste: contrato e contradições, sem defaults inseridos em históricos.
- src/features/busca-empresas/filtros.ts e testes: resumo CNAE e validação antes da cota.
- src/server/casa-dados/filtros.ts e testes: tradução para a API e bloqueio de combinações inválidas.
- app/fila/buscar/formulario-completo.tsx: campos de CNAEs, abertura e exclusões nos cartões existentes; padrões dos componentes já presentes.
- src/components/crm/criterios-banco.tsx: apresentação fiel do histórico antigo e novo.
- db/migracoes/0047_casa_filtros_adicionais.sql, docs/db/0047.md: validação aditiva no banco, sem novo privilégio.
- tests/integracao/casa-filtros-adicionais.test.ts e listas de migrações existentes: autoridade SQL e compatibilidade.
- tests/e2e/busca-redesign.spec.ts, prospeccao-previa.spec.ts e cnpj-biz-mock.ts: jornada com payload de fornecedor capturado somente no mock e dados fictícios.
- docs/operacao/busca-empresas.md e producao-vercel.md: uso, revisão e implantação.

## Task1: contrato e mapeamento

1. RED: casos de CNAEs distintos/um lado vazio, últimos dias1/7/30, zero/fracionário/overflow, exclusões individuais/combinadas, períodos parciais/válidos/invertidos, conflitos com MEI/Simples positivos e abertura absoluta. Leitura antiga serializa sem chaves novas.
2. GREEN: opcionais estritos no schema, regras de coerência, fallback do CNAE e nome; API preserva arrays e períodos próprios, sem parâmetros não documentados.
3. RED/GREEN no serviço: reprovar novos combos antes de reservar cota/fetch; manter UUID idempotente.
4. Rodar suites banco-empresas, filtros, serviço e Casa com maxWorkers1. Registros de histórico antigos e cliente CNPJ de fixtures continuam válidos.

## Task2: autoridade SQL

1. RED: executar busca_empresa_reservar_casa com novos filtros em banco descartável; aceitar válidos e recusar tipos/keys/combos inválidos. Repetição mantém quantidade, cota e payload.
2. GREEN: criar0047 sem modificar SQL aplicado; aceitar opcionais apenas por whitelist, validar tudo e preservar o ramo anterior.
3. Incluir dados antigos sem campos novos e chamadas malformadas diretas. Verificar papel, pausa, cota e ausência de alterações em empresa/carteira.
4. Atualizar listas esperadas de migrações e docs0044 com ponteiro0047; convenções e invariantes sem GRANT novo.

## Task3: formulário e histórico

1. RED E2E: campos e rótulos novos, duas listas CNAE e respectivas entradas, modo de abertura limpando o outro, exclusões com suas datas, histórico e sugestão com só secundário.
2. GREEN: controles no formulário atual, limpar valores abandonados, explicar/bloquear contradições; manter Nome ou palavra-chave sem novas opções.
3. Mock local valida corpo e retorna fixture; nenhuma chamada ao fornecedor real. Chave fake e guardas de isolamento permanecem.
4. Capturas1920/390, claro/escuro, teclado; nenhuma rolagem horizontal ou campo oculto obrigatório inacessível.

## Task4: revisão e entrega

1. Rodar tipos, lint, db:checar e regressões afetadas. Revisão independente de delta completo; corrigir Critical/Important com RED/GREEN.
2. Guard de branch, commit/push na PR55 e CI completo da fonte exata; sem main/merge.
3. Novo backup criptografado e conferido. Snapshot de dados/limites antes da migração, aplicar só0047, conferir invariantes, dados e limites100 sem mutações comerciais.
4. Publicar fonte aprovada na Vercel correta, sem mudança de chave ou configuração de vendedores. Conferir source/READY/alias e login/guardas; autenticação online só se houver sessão real acessível.
5. Atualizar documentação e PR com testes, revisão, implantação e declaração de zero consultas pagas.

## Foco da revisão

- Opcionais não normalizam o JSON antigo e não quebram replay.
- Separação dos CNAEs não transforma códigos secundários em principais nem reaplica a opção legada de misturar atividades.
- Combos inválidos são recusados no TS e no banco, antes da cota/HTTP.
- Datas dos dois regimes não se cruzam; abertura relativa não perde a referência temporal no histórico.
- Implantação não restaura limites zero do ensaio antigo nem reutiliza o importador pago.
