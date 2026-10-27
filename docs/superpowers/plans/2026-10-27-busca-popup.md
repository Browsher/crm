# Plano: consulta de busca em pop-up

Spec: ../specs/2026-10-27-busca-popup-design.md
Execução local nesta conversa. Branch codex/redesign-crm, PR #55 existente.

1. RED: histórico deve renderizar botão em vez de navegação; detalhes devem expandir cards com CEP e informações persistidas sem documentos de sócios.
2. Implementar Dialog cliente com carregamento por action somente de leitura, proteção contra respostas atrasadas e erro com nova tentativa. Action exige usuário e usa repositorioBusca.ler com RLS; retorna conteúdo renderizado no servidor e controles existentes.
3. Reutilizar ResultadosBusca no Dialog e aprimorar EmpresaEncontradaDetalhes com cards shadcn expansíveis. Separar bloqueio de importação dos botões de leitura.
4. GREEN: testes de componente/action; E2E de abertura sem navegação/consulta paga, fechamento/foco, dados completos, vazio, gestor e importação. Verificar 1920x1080 e 390px, temas claro/escuro.
5. Revisão independente com contexto mínimo; corrigir achados. Typecheck, lint, unidade, build e jornadas relevantes. Commit na branch e atualizar PR; publicar o código após CI verde conforme fluxo já autorizado.

Riscos a verificar: consulta de outro vendedor negada por RLS; CPF ausente para vendedor; resposta atrasada ao fechar/reabrir; seleção e confirmação preservadas; pausa não bloqueia expansão; listagem de até 100 com nomes longos sem transbordamento.

## Verificação em andamento

- RED de histórico/expansão confirmado; GREEN em 8 testes novos de componente/action.
- Typecheck, build E2E e 6 jornadas de consulta/importação passaram. Lint sem erros; cinco avisos preexistentes em artefatos locais ignorados.
- Revisão independente sem achados críticos/importantes, um menor: cabeçalho podia ocupar espaço do X. Reproduzido no navegador (título terminou 16px além do limite); seletor CSS corrigido para preservar o espaço no desktop/mobile.
- Nenhuma consulta real ao fornecedor, migração ou alteração de limites.
- GREEN final: 6 jornadas no navegador, incluindo geometria do cabeçalho, claro/escuro em 1920x1080 e 390px. Revisão independente final sem achados restantes.
- A suíte geral identificou duas asserções antigas sobre endereço sempre renderizado e fieldset inteiro desabilitado. Atualizadas ao pedido de expansão por botão; seleção/importação continuam bloqueadas e a leitura permanece ativa. Os testes afetados passaram.

## Entrega

Concluída na fonte c9993c30dfd8d5488165a6491d4faf41693384fd. CI40541679880 aprovado: 1.722 unitários (2 ignorados), 713 integrações, 75 jornadas. Suíte local: 1.723 unitários (1 ignorado). Deployment dpl_Brn1P2QEkcPT3ddvThrV4PPHg1Gm READY, alias estável conferido e smoke sem autenticação aprovado. Sem migrações ou chamadas pagas. PR55 atualizada, sem merge. Revisão independente sem pendências.
