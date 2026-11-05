# Meu dia e histórico expansível Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar Meu dia com cards compactos, filtros de período, painéis por abas e histórico comercial em linha do tempo expansível.

**Architecture:** Manter as consultas e as máquinas de comando existentes. O histórico terá um renderer comum com adaptadores por fonte; Meu dia reutilizará o editor de negociação e o painel de dados do Funil. A agenda incluirá datas futuras sem migração, preservando o ponteiro da tarefa vigente.

**Tech Stack:** Next.js 16.4.1, React 19.2.8, TypeScript, tokens/componentes atuais, Vitest e Playwright, PostgreSQL local isolado. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-11-05-meu-dia-cards-design.md`
**Fontes verificadas:** `docs/auditorias/2026-11-05-historicos-crm.md`
**Branch/base:** `codex/meu-dia-cards`, `a96ccbe`. Execução escolhida: implementador e revisor separados por tarefa; revisão final da branch.

## Global Constraints

- “A página inicia sem empresa selecionada. A leitura do histórico só começa quando o vendedor abre uma empresa.”
- “Filtros Todos, Atrasos, Hoje e Próximos.” “A referência é a data atual de America/Sao_Paulo.”
- “A página e o painel não têm aba nem bloco Resumo.”
- “Em Próximo passo e Histórico da negociação, o rodapé traz Registrar venda e Sem interesse lado a lado, inclusive no celular.”
- “O retorno não oferece um segundo botão Registrar atendimento.”
- “Os eventos começam recolhidos e a opção Expandir todos opera sobre o filtro ativo, conforme a prévia aprovada.”
- “O componente comum não amplia consultas nem permissões.”
- Preservar RLS, autorização, versão, idempotência, agenda_contato_id, recuperação de resposta perdida e destinos autenticados.
- Sem migração, buscas pagas, integrações reais, merge ou publicação. Somente dados fictícios/bancos temporários locais.
- TypeScript com aspas simples e sem ponto e vírgula; nenhuma importação de uma feature por outra feature.
- Rascunhos e envios pendentes são protegidos em troca de aba/painel, Voltar, Fechar, Escape e navegação.
- Histórico de consultas Google, buscas e conversas WhatsApp, além de um novo feed de operações/etapas, ficam fora desta entrega; preservar os blocos atuais.

## Review Focus

1. Datas próximas da meia-noite de Brasília e da virada de semana/mês/ano precisam do mesmo dia de referência no SQL e nos filtros (Tarefa 2).
2. A → B → A durante leitura lenta não pode reapresentar o histórico de A anterior nem a resposta atrasada de B (Tarefas 1 e 4).
3. Rascunho/contato pendente em aba inativa continua protegido, inclusive ao abrir confirmação de Sem interesse (Tarefa 3).
4. Resposta de venda perdida, reload e retomada pelo outro consumidor reutilizam a mesma chave e não criam segunda venda (Tarefas 3, 4 e 6).
5. Autoria ausente, contato de antigo responsável, nota longa e data histórica vencida não autorizam acesso adicional nem viram agenda atual (Tarefas 1 e 5).

## Estrutura e responsabilidade

| Unidade | Responsabilidade |
| --- | --- |
| `src/lib/historico-comercial.ts` | DTO visual neutro; não consulta nem importa features |
| `src/components/crm/historico-comercial.tsx` e `.module.css` | Linha do tempo expansível, filtros, expansão e estados vazios |
| `src/features/contato/linha-do-tempo.tsx` | Adaptar Contato[] ao renderer comum, preservando o contrato público |
| `src/lib/agenda-periodos.ts` | Dia civil de Brasília e limites dos períodos |
| `app/meu-dia/agenda.ts`, `filtros-form.tsx`, `page.tsx` | Parsing, URLs, consulta/seleção de agenda e filtros |
| `app/funil/use-envio-arquivo.ts` | Extrair somente envio persistido e recuperação de arquivamento |
| `app/funil/modal.tsx` | Editor comum com abas, guardas e rodapé |
| `app/meu-dia/painel.tsx` | Cards sem seleção automática e composição das laterais |
| Adaptadores dos demais consumidores | Remover renders divergentes sem ampliar suas fontes |

### Task 1: Histórico comercial comum

**Files:** criar `src/lib/historico-comercial.ts`, `src/components/crm/historico-comercial.tsx`, `src/components/crm/historico-comercial.module.css`, `src/components/crm/historico-comercial.dom.test.tsx`; modificar `src/features/contato/linha-do-tempo.tsx` e `src/features/contato/venda-historico.test.tsx`.

**Interfaces:** exportar `EventoHistoricoComercial` com `id: string`, `natureza: 'contato' | 'atividade_sem_ligacao' | 'venda'`, `titulo: string`, `criadoEm: string` (instante ISO), `autor: string | null`, `nota: string | null`, `resultado?: string`, `proximoPasso?: { descricao: string; data: string | null }`, `venda?: { centavos: string; data: string }`, `empresa?: string`. Exportar `HistoricoComercial({ eventos, rotulo? }: { eventos: EventoHistoricoComercial[]; rotulo?: string })`. Preservar `LinhaDoTempo({ contatos }: { contatos: Contato[] })` como adaptador reutilizável.

- [ ] Escrever regressões DOM: quatro registros inicialmente recolhidos; cabeçalho mantém título/data/hora/autor; Enter expande o evento focado; anotação longa aparece completa só nos detalhes; nota ausente, tipo desconhecido e atividade sem ligação permanecem legíveis.
- [ ] Cobrir filtros Todos/Atendimentos/Vendas, Expandir/Recolher todos apenas no filtro ativo, nenhum evento de venda no filtro de atendimentos e vice-versa, e troca da empresa sem reaproveitar expansão de outra identidade. “Atendimentos” inclui atividades sem ligação.
- [ ] Cobrir venda de 04/11 registrada em 05/11/2026, centavos em texto, instante `2026-11-05T01:30:00Z` exibido em 04/11 às 22:30 em Brasília, autor nulo como “Autor não informado” e data civil do retorno preservada sem badge de atraso atual.
- [ ] Rodar `node node_modules/vitest/vitest.mjs run --project unitario src/components/crm/historico-comercial.dom.test.tsx src/features/contato/venda-historico.test.tsx`; confirmar falha ligada ao contrato novo.
- [ ] Implementar com `details/summary` sem duplicar área clicável, tokens atuais e foco visível. Usar o ResumoVenda existente. Manter a ordem recebida; o adaptador usa ROTULO/ehTipo e distingue atividade de contato, sem truncar nota nem inventar autor.
- [ ] Repetir o comando, confirmar PASS, revisar diff e fazer commit `feat(crm): padroniza histórico comercial expansível`. Preparar relatório/diff para revisor independente antes da tarefa seguinte.

### Task 2: Agenda futura, períodos e destinos de volta

**Files:** criar `src/lib/agenda-periodos.ts` e `src/lib/agenda-periodos.test.ts`; modificar `src/server/atendimento/consulta.ts`, `app/meu-dia/agenda.ts`, `app/meu-dia/filtros-form.tsx`, `app/meu-dia/page.tsx`, `src/features/contato/destino.ts`; atualizar `app/meu-dia/agenda.test.tsx`, `src/features/contato/destino.test.ts`, `tests/integracao/agenda-atendimento.test.ts` e `tests/integracao/leituras-atendimento-final.test.ts`.

**Interfaces:** `FiltrosMeuDia = { nome: string; retorno: '' | 'atrasado' | 'hoje' | 'proximos'; periodo: '' | 'amanha' | 'semana_que_vem' | 'mes_que_vem' }`. Exportar `PeriodoAgenda = '' | 'amanha' | 'semana_que_vem' | 'mes_que_vem'`, `dataCivilSaoPaulo(agora: Date): string` e `limitesPeriodoAgenda(hoje: string, periodo: PeriodoAgenda): { inicio: string; fim: string | null }` no lib; FiltrosMeuDia usa esse tipo, sem importar app no lib. `filtrarAgenda(linhas, filtros, hoje: string)`; `lerAgendaAtendimento(usuarioId: string, hoje?: string)` mantém o resultado atual. O dia de referência calculado uma vez na página passa à consulta e ao filtro.

- [ ] Testes de parsing: rejeitar arrays/repetições, nome >120 e valores fora das listas; reconhecer periodo somente com proximos e normalizar para vazio nos demais; continuar ignorando chaves externas não usadas pelo formulário.
- [ ] Testes de datas com referência explícita: Amanhã = 06/11/2026 quando hoje é 05/11; Semana que vem = 09–15/11, incluindo domingo; Mês que vem = 01–31/12; cobrir 31/12, fevereiro bissexto e instante anterior à meia-noite de Brasília. Período vazio começa amanhã e não tem limite final.
- [ ] Testes de agenda: Todos inclui atrasados/hoje/futuros, exclui sem_data, ordena data/nome/id no grupo; novos filtros cruzam pesquisa sem acento; contar listas efetivas sem subtração duplicada. URL da Carteira e destinoDeVolta preservam periodo, sem aceitar host externo, hash, parâmetros repetidos ou chaves extras.
- [ ] Rodar `node node_modules/vitest/vitest.mjs run --project unitario src/lib/agenda-periodos.test.ts app/meu-dia/agenda.test.tsx src/features/contato/destino.test.ts` e confirmar a falha esperada.
- [ ] Renomear o parâmetro interno somenteDevidas para somenteComAgenda e trocar o recorte SQL para agenda com data não nula, mantendo arquivo e indisponibilidade fora. Acrescentar referência civil opcional ao leitor interno para classificar atraso/hoje/futuro pelo mesmo dia da página; callers sem referência preservam now() de Brasília. Não alterar a origem agenda_contato_id nem os leitores de Carteira.
- [ ] Implementar períodos com aritmética de dia civil e UTC ao meio-dia, sem assumir fuso do host; ampliar predicates da página/LinhaMeuDia para futuro e manter enum de apresentação “proximos” separado de situacaoRetorno “futuro”.
- [ ] Atualizar controles de filtro para Todos/Atrasos/Hoje/Próximos e o seletor adicional, com pesquisa e destinos reconstruídos por URLSearchParams.
- [ ] Rodar unitários focados e os dois arquivos de integração via `node node_modules/vitest/vitest.mjs run --project integracao tests/integracao/agenda-atendimento.test.ts tests/integracao/leituras-atendimento-final.test.ts`, somente com banco local. Confirmar PASS, commit `feat(meu-dia): inclui retornos futuros e períodos` e revisão independente.

### Task 3: Editor comum por abas e comando de Sem interesse

**Files:** modificar `app/funil/modal.tsx`, `app/funil/quadro.tsx`, `app/funil/funil.module.css`, `app/funil/negociacao.module.css`, `src/components/crm/painel-lateral.tsx`, `src/components/crm/empresa-dialogo.tsx`; criar `app/funil/use-envio-arquivo.ts` e teste DOM; atualizar `app/funil/modal.dom.test.tsx`, `app/funil/quadro.dom.test.tsx`, `src/components/crm/painel-lateral.dom.test.tsx`. Estender `src/features/contato/formulario.tsx` com `onCancel?: () => void` e `rotuloSalvar?: string`, preservando o botão atual quando ausentes; cobrir nos testes do formulário. No editor comum, usar Salvar atendimento/Cancelar no rodapé do formulário, com Cancelar passando pela mesma guarda de descarte.

**Interfaces:** PainelLateralCrm ganha `rotuloFechar?: 'Fechar' | 'Voltar'`, default Fechar, repassado por DadosEmpresaPainel sem mudar callbacks existentes. PainelNegociacao mantém `id, usuarioId, fechar, fecharRef, bloqueada, aoMudarBloqueioDeArraste`; `aoPedirArquivar` passa a receber o NegociacaoDetalhe já autorizado. Criar `useEnvioArquivo(usuarioId: string)`, com `comando: {linha: NegociacaoResumo; chave: string} | null`, `pendente: boolean`, `aviso: string`, `enviar(linha: NegociacaoResumo): Promise<EstadoFunil | null>` e `recuperar(): Promise<EstadoFunil | null>`. O transporte emite o resultado; confirmação, animação e remoção visual continuam com o consumidor.

- [ ] Regressões DOM: abas Próximo passo/Atendimento/Histórico, inicial Próximo passo, nenhum Resumo, botões Registrar venda e Sem interesse lado a lado em passo/histórico. Histórico usa Tarefa 1 com adapter próprio, autor “Você” somente porque a fonte filtra criado_por pelo ator.
- [ ] Testar formulário montado somente na primeira abertura real de Atendimento; preservar montagem/rascunho ao visitar outra aba, sem capturar versão prematuramente. Contato pendente em sessionStorage bloqueia descarte mesmo com Histórico ativo.
- [ ] Testar Voltar interno ao passo, saída pelo fecharRef com callback somente após remover sentinela, foco no controle de origem, e confirmação de descarte antes de arquivar/trocar painel. A confirmação de Sem interesse continua central.
- [ ] Testar comando de arquivo salvo antes da transmissão, mesma chave após falha/reload, storage indisponível sem novo envio, resposta repetida/atual=false sem remover empresa incorreta e recuperação por ambos os consumidores.
- [ ] Rodar `node node_modules/vitest/vitest.mjs run --project unitario app/funil/modal.dom.test.tsx app/funil/quadro.dom.test.tsx app/funil/use-envio-arquivo.dom.test.tsx src/components/crm/painel-lateral.dom.test.tsx`, observar falha específica e extrair apenas persistência/replay da máquina atual do Quadro. Conservar a chave `crm:funil:arquivo:v1:<usuario>`, validações, classificação dos resultados e liveness. Quadro mantém suas três recentes, devolução e animação.
- [ ] Reorganizar o editor existente sem criar máquina paralela de contato/venda. Os campos da empresa ficam no painel de dados. Derivar o dirty de todos os rascunhos/envios, independentemente da aba ativa; guardas também cobrem botões do rodapé.
- [ ] Rodar testes DOM indicados e `src/lib/use-envio-venda.dom.test.tsx`; confirmar PASS, commit `feat(funil): organiza negociação em abas e ações fixas` e revisão independente.

### Task 4: Meu dia com cards e painéis sem seleção inicial

**Files:** modificar `app/meu-dia/painel.tsx`, `app/meu-dia/meu-dia.module.css`, `app/meu-dia/page.tsx`, `app/meu-dia/painel.test.tsx`, `app/meu-dia/painel.dom.test.tsx`; criar `app/meu-dia/retorno-painel.tsx` para composição da lateral se a divisão reduzir a responsabilidade do painel de lista.

**Interfaces:** PainelMeuDia acrescenta `usuarioId: string` e recebe linhas/agenda já incluindo futuro. Estado discriminado: nenhum, retorno(empresaId, aba), dados(empresaId, contextoAnterior), negociacao(empresaId, negociacaoId, contextoAnterior). Nenhuma seleção implícita. Retorno usa LinhaDoTempo, DadosEmpresaPainel e PainelNegociacao/fecharRef já definidos; confirmação/envio de arquivo usa a Tarefa 3.

- [ ] Escrever testes: zero seleção e zero pedido inicial de histórico; cards iguais com duas ações; abrir/fechar não altera rota; fechar retoma foco; trocar filtro limpa seleção; atualizar props não escolhe outra empresa.
- [ ] Fixar A → B → A com respostas fora de ordem e falha seguida de retry; empresa sem permissão some das listas efetivas e contagens reconciliam sem reintrodução em props atrasadas.
- [ ] Fixar mapa de Voltar: Histórico do retorno → Próximo passo; Dados → painel/aba que abriu; Negociação no passo → contexto anterior; outras abas da negociação → passo. Sem Voltar ao retorno no rodapé e sem Registrar atendimento duplicado no retorno.
- [ ] Cliente já convertido segue atendimento da Carteira com de=meu-dia, nome, retorno e periodo. Negociação aberta usa editor comum. Arquivo/venda confirmado fecha a seleção correspondente; refresh não abre card vizinho.
- [ ] Rodar testes e confirmar falhas. Substituir master-detail por grid compacto. Rodapé do retorno tem Dados da empresa e Negociação (ou caminho autorizado de atendimento para cliente). Manter carregamento por identidade, sem busca antecipada de históricos.
- [ ] Implementar rodapé acessível e conteúdo rolável com tokens atuais, até 390px, sem altura do card depender de nomes longos ou da expansão dos dados.
- [ ] Repetir testes unitários/DOM de Meu dia e `historico-acao.test.tsx`; confirmar PASS, commit `feat(meu-dia): abre retornos em painéis laterais` e revisão independente.

### Task 5: Adotar o padrão nos demais históricos comerciais

**Files:** modificar `app/carteira/[id]/ficha.tsx`, `app/empresas/[id]/page.tsx`, `app/usuarios/vendedores/[id]/page.tsx` e seus estilos somente para remover renders mortos; manter `app/fila/formulario.tsx` usando LinhaDoTempo. Criar testes de adaptação em `app/carteira/[id]/historico.test.tsx`, `app/empresas/[id]/historico.test.tsx` e `app/usuarios/vendedores/[id]/historico.test.tsx` quando não houver equivalente cobrindo a integração visual.

**Interfaces:** fontes Contato[] usam LinhaDoTempo. A atividade do vendedor adapta sua lista existente para EventoHistoricoComercial, preenchendo empresa e autoria do vendedor selecionado autorizado, mantendo o limite de 20. Não chamar lerHistorico genérico no Funil.

- [ ] Testar mesmos campos comerciais em Carteira/gestor/atendimento, notas completas, ausência de dado e venda distinta de contato. A atividade de vendedor mantém a empresa em cada registro e não inventa vendas que sua fonte não recebe.
- [ ] Preservar estados de erro/vazio e blocos de coletas/arquivo legado. Confirmar que renders não mostram agenda atual como se fosse o próximo passo do contato histórico.
- [ ] Rodar unitários focados para observar falha; substituir renders por adaptadores comuns, conservando carregamento, consultas e mensagens específicas.
- [ ] Rodar regressões de autorização existentes: `tests/integracao/contato-historico.test.ts`, `meu-dia-historico.test.ts`, `funil-base.test.ts` e `funil-agenda-upgrade.test.ts`. Acrescentar caso com contato de autor anterior: genericamente visível somente quando RLS permite, nunca no DTO do Funil do outro vendedor; sem venda/nota adicional serializada para ele.
- [ ] Confirmar PASS, commit `refactor(crm): unifica apresentação dos históricos comerciais` e revisão independente.

### Task 6: Jornadas integradas, revisão final e PR

**Files:** atualizar `tests/e2e/dados-meu-dia.ts`, `tests/e2e/meu-dia.spec.ts`, `tests/e2e/funil-painel-lateral.spec.ts` e `tests/e2e/funil.spec.ts`; criar `tests/e2e/historico-comercial.spec.ts`; salvar evidências em `docs/design/2026-11-05-meu-dia/` e `docs/auditorias/2026-11-05-meu-dia-validacao.md`. Ajustar asserções antigas que excluíam futuras e pressupunham seleção inicial.

- [ ] Semear dados fictícios por caminhos autorizados do harness: atrasado/hoje/amanhã/próxima semana/próximo mês, fora do mês, sem data, arquivada, vínculo indisponível, cliente, nota longa/sem autor/atividade e venda com data diferente do registro.
- [ ] Provar Meu dia → retorno → dados → Voltar → negociação → atendimento, edição e guardas; interesse/retorno abre negociação correta; venda inicial abre ficha correta na Carteira; voltar do cliente preserva todos os filtros.
- [ ] Perder resposta após commit de venda, reload e recuperação da mesma chave, validar uma venda no banco. Repetir para arquivamento, garantindo cancelamento de agenda sem efeitos duplicados. Não simular sucesso só no navegador sem conferir dados.
- [ ] Validar histórico expandido por teclado, filtros/expandir todos, vazio, erro/retry e leitura lenta. Cobrir desktop 1440px e celular 390px, temas claro/escuro, textos longos e rodapés lado a lado sem rolagem horizontal.
- [ ] Usar somente harness local `scripts/e2e/run.mts`, que exige host local, app_teste e banco teste_<id>; manter mocks/segredos de produção desabilitados. O esquema e os dados reais não entram nos testes.
- [ ] Executar `npm run typecheck`, `npm run lint`, `npm run db:checar`, `npm run test:unit`, `npm run test:integracao`, `npm run build:e2e`, `node --import tsx scripts/e2e/run.mts --sem-build`. A rodada de baseline por tarefa é focada; esta é a verificação completa antes da PR. Cada comando deve terminar com código 0.
- [ ] Conferir manualmente no navegador o fluxo completo contra o servidor isolado, documentando versão, dados, viewport, tema e os cenários realmente executados, com capturas das telas principais.
- [ ] Preparar diff completo e relatórios para revisão independente da branch; resolver achados importantes e repetir apenas os checks afetados pelas correções, além dos exigidos pelo CI.
- [ ] Commit das evidências, push da branch e PR contra main com problema/comportamento final, validações e pendências reais. Aguardar os checks obrigatórios verdes. Não fazer merge nem publicar.

## Resultado esperado e limites

Uma PR entrega os cards de Meu dia, agenda futura, editor por abas e o mesmo histórico expansível nos seis consumidores comerciais. A aparência é comum; a visibilidade de dados continua sendo a de cada consulta. O levantamento de fontes acompanha a entrega e explicita que o histórico ainda não é uma auditoria completa de operações/etapas.

## Estado do plano

- Desenho Meu dia aprovado em 05/11/2026.
- Linha do tempo expansível aprovada em 05/11/2026.
- Builder check do desenho ampliado: nothing important left.
- Auto-revisão: cobertura dos requisitos, interfaces, casos de falha e fronteiras de autorização conferidos. A implementação será organizada em commits revisáveis por tarefa.
- Verificação documental: executar src/docs.test.ts antes do commit; não representa validação do produto.
- Implementação de produto ainda não iniciada.
- Revisão do plano pelo usuário pendente, conforme writing-plans; preservar a execução por agentes separados já escolhida.
