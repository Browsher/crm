# Validação local de Meu dia e histórico comercial

Data: 05/11/2026. Branch `codex/meu-dia-cards`, produto inicialmente em `d6009e3`, main de referência `a96ccbe`. Esta validação usa exclusivamente empresas e usuários fictícios no harness `scripts/e2e/run.mts`, banco descartável `teste_<id>`, papel `app_teste` e PostgreSQL 18 local em `localhost:5432`, configurado por `.env.test`.

O [levantamento de fontes dos históricos](2026-11-05-historicos-crm.md) delimita os eventos e os recortes de cada consumidor. O histórico comercial compartilhado não constitui uma auditoria completa de mudanças de etapa e operações.

## Ambiente e identificação

- Node 24, Next.js 16.4.1, Playwright/Chromium do lockfile do projeto.
- Build segura por `npm run build:e2e`, que neutraliza variáveis externas e escreve `.next-e2e`. Nenhum build comum com segredos locais foi usado.
- Build após os dois ajustes de produto: `PI6S2uhg0ekyEg60qfwyg`, concluída antes da rodada focada iniciada em 05/11/2026 às 14:57, horário de São Paulo.
- SHA256 de `app/meu-dia/painel.tsx`: `45979e651ca734b582975f57785a70a972b0a8b3020305485826103607ff92c8`.
- SHA256 de `app/meu-dia/meu-dia.module.css`: `e191d9675e49350136e9616f7c2307e1957136d7b6e3bb98baf8dd7b00ac1cbd`.
- Desktop de 1440 × 900 e celular de 390 × 900, temas claro e escuro. Jornadas antigas mantêm seus tamanhos adicionais.
- Python dos testes offline: CPython 3.14.3 instalado pelo uv. Seu diretório entra somente no ambiente do processo filho; nenhuma configuração global foi alterada.

## Jornadas verificadas

- Cards de mesma altura, ausência de seleção e de leitura inicial de histórico; atrasados, hoje, amanhã, próxima semana, próximo mês e retorno fora do mês. As datas são civis de São Paulo, sem depender do fuso da máquina.
- Vazio da agenda distinto de pesquisa sem resultado; empresa sem data e arquivada ficam fora da agenda, e a empresa de outro vendedor permanece inacessível.
- Retorno, Dados, Voltar, Histórico e Negociação preservam o contexto. O retorno não duplica Registrar atendimento. O editor comum usa Próximo passo, Atendimento e Histórico.
- Cliente retorna à agenda preservando `nome`, `retorno` e `periodo`. Registrar primeira venda pelo Meu dia abre a ficha autorizada na Carteira.
- Histórico com nota longa integral, autor ausente, atividade sem ligação, venda com data efetiva distinta da data do registro, filtros e expansão por teclado. Expandir todos afeta apenas o filtro ativo.
- Falha de leitura oferece Tentar novamente. A troca A para B para A durante leitura lenta descarta a resposta velha de B e reinicia a expansão de A.
- Rascunho em aba inativa protege pesquisa enviada por Enter, filtros, navegação, Sair voluntário, Back e beforeunload. Menu móvel também permanece coberto pela jornada do Funil.
- Resposta de venda perdida depois de `route.fetch()` confirmar o commit: reload preserva o comando; replay pelo controle compacto com outra negociação aberta reutiliza a chave, bloqueia Back e beforeunload durante a espera e mantém a empresa B selecionada. Consulta administrativa do banco temporário confirma apenas uma venda.
- Resposta de arquivamento perdida depois do commit: reload conserva o comando; recuperação pelo outro consumidor reutiliza a chave. A versão, o instante de arquivo e a agenda cancelada permanecem idênticos; há uma única operação de arquivo e uma única negociação encerrada.
- Sucesso normal de arquivo invalida as rotas reais. Navegar por links entre Funil e Meu dia, com cache previamente preenchido e remontagem, não restaura o card nem a agenda cancelada.
- A privacidade continua conferida no conteúdo serializado e no DOM. Os detalhes autorizados são expandidos antes de verificar visibilidade; recolher detalhes não é usado como prova de ausência de informação proibida.

## Ajustes de produto encontrados no navegador

1. A primeira venda confirmada no Meu dia permanecia nessa rota. O callback tratava o texto de sucesso antes do resultado com destino autenticado. O ajuste prioriza esse resultado, segue a navegação autenticada já usada no Funil e mantém uma mensagem de recuperação quando a leitura de destino falha. Uma regressão DOM e uma jornada real cobrem o caso.
2. O shell já reservava a largura da lateral, enquanto o CSS local acrescentava outra reserva. A regressão E2E mediu uma faixa morta de 418,39 px; a margem local redundante foi removida. A asserção exige que o grid chegue à lateral com apenas o espaçamento normal da página, além de conferir ausência de rolagem horizontal.

## Ponto adiado da Tarefa 3

O hook de arquivo limpa a intenção persistida e emite a atualização do store mesmo se a instância emissora já desmontou; nesse caso, retorna `null` ao chamador antigo, impedindo que ele atualize estado desmontado. Não foi alterada essa semântica.

A conclusão é delimitada: a jornada suportada de navegação/remontagem foi exercitada com ações e invalidação reais de `/funil` e `/meu-dia`, inclusive com cache de navegação preenchido antes do arquivo. O consumidor remontado mostra o estado confirmado e não restaura a agenda. A navegação voluntária durante envio pendente é protegida pelas guardas. Isso não afirma entrega de aviso de sucesso a um emissor artificialmente desmontado por código externo; a triagem final desse caso continua com o revisor da branch.

## Verificações

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Código 0 na rodada final após ajustes de testes |
| `npm run lint` | Código 0 na rodada final após ajustes de testes |
| `npm run db:checar` | Código 0, convenções de migração ok |
| DOM de Meu dia após ajuste | 40 testes passaram |
| Unidade completa | Código 0 na rodada sequencial: 244 arquivos, 2561 testes passaram e 1 ignorado, 476,47 s |
| Integração completa | Código 0: 91 arquivos e 829 testes passaram, 371,62 s, incluindo versão PostgreSQL 18 |
| `npm run build:e2e` | Código 0 |
| E2E completo | Primeira global: 170 passaram e 2 falhas de seletor; correção validada com 4/4 no arquivo afetado. Global final pendente no checkpoint |
| Documentação `src/docs.test.ts` | Código 0: 243 verificações no checkpoint; repetir após atualização documental final |

A unidade completa teve uma rodada anterior concorrente com 2557 testes aprovados, 3 timeouts e 1 ignorado. Os três arquivos afetados passaram isolados (22 testes, 240,72 s); a rodada completa seguinte passou com um worker e sem checks pesados concorrentes. Os limites de tempo e assertions foram mantidos. O teste ignorado é específico de Linux (`src/e2e-processos.test.ts:49`), em uma execução Windows. Permanece o aviso do Vite sobre import dinâmico sem extensão estática em `src/server/diretivas.test.ts`; esse arquivo não foi alterado nesta tarefa.

A integração completa revelou uma expectativa antiga que excluía futuros em `vendas-carteira.test.ts`. Após autorização do controlador, somente o nome do cenário e a expectativa de agenda foram atualizados, preservando vínculo, negociação e autorização. O primeiro focal teve um timeout de hook inalterado durante longa indisponibilidade observada do processo; a repetição idêntica passou 8/8 em 5,65 s. A rodada global final passou 829/829. O teste de versão, antes ignorado porque `PG_VERSAO_ESPERADA` estava ausente, foi habilitado com `18` somente no processo filho da rodada final. Nenhum limite de tempo foi aumentado.

A primeira rodada de `--sem-build` encontrou um artefato anterior às mudanças de produto. Seus 7 testes passaram, mas essa execução foi descartada como evidência do código atual. A build segura foi refeita antes de registrar o red das jornadas antigas.

A rodada focada ampliada depois dos ajustes de produto executou 41 testes: 36 passaram e 5 falharam. Os novos cenários de histórico, guardas, venda, replay de arquivo/venda e remontagem passaram; as falhas remanescentes foram tratadas. A primeira rodada E2E global executou 172 cenários: 170 passaram e dois falharam porque o seletor Próximo passo também identificava o novo tabpanel. O teste passou a buscar o textbox real; o arquivo inteiro passou 4/4 em 31,2 s. A rodada global final ainda está pendente neste checkpoint. Nenhum timeout ou assertion de produto foi afrouxado.

## Capturas

Capturas locais geradas pelo Playwright, com dados sintéticos, em [pasta de evidências](../design/2026-11-05-meu-dia/):

- `cards-{light,dark}-{1440,390}.png`: cards sem seleção inicial.
- `retorno-{light,dark}-{1440,390}.png`: leitura do retorno.
- `dados-{light,dark}-{1440,390}.png`: dados da empresa.
- `negociacao-{light,dark}-{1440,390}.png`: editor comum e rodapé lado a lado.
- `historico-{light,dark}-{1440,390}.png`: nota longa e atividade autorizada.
- `replay-venda-empresa-b.png`: confirmação de venda anterior sem trocar a negociação atual.

## Conferência independente do controlador

Executada em 05/11/2026 na build `PI6S2uhg0ekyEg60qfwyg`, porta local 3110, banco descartável `teste_a8c6bc56d6fe`, contas sintéticas `meudiae2e`, `funile2e` e `gestore2e`. O banco foi removido e o servidor/mocks foram encerrados com código 0 antes dos checks globais seguintes.

O controlador abriu e mediu a página em Chrome dedicado. A ferramenta de captura interativa deixou de responder; as chamadas foram canceladas. A conferência foi concluída com Chromium do projeto via Playwright e inspeção efetiva das quatro imagens locais. O resultado foi PASS nos cenários abaixo:

- Desktop 1440 × 1000, escuro: 18 cards de 201 px, entrada sem seleção/lateral; com retorno aberto, main de 826,6 px, lista de 762,6 px e intervalo de 32 px até a lateral. Sem rolagem horizontal.
- Histórico recolhido, expansão da nota completa, resultado, data/hora de Brasília, retorno histórico de 22/10/2026 e autoria ausente explícita.
- Dados → Voltar restaura Histórico; ArrowLeft volta ao Próximo passo; Escape fecha e devolve o foco ao botão Abrir retorno.
- Próximos / Mês que vem preserva query e exibe o retorno de 01/12/2026.
- Celular 390 × 844, touch e claro: entrada sem seleção, histórico expansível, documento e painel de 390 px, duas ações legíveis no rodapé e ausência de transbordamento.
- Funil desktop escuro: três abas sem Resumo, Voltar interno, Registrar venda e Sem interesse lado a lado.
- Gestor: ficha de empresa expande o histórico autorizado; perfil de vendedor carrega a região de atividade. O roteiro manual não afirma ter testado o limite de 20 registros.

As mutações e perdas de resposta foram verificadas pelos E2E do implementador, não repetidas nesse roteiro independente. As imagens inspecionadas foram copiadas para a pasta de evidências: `manual-meu-dia-desktop-escuro.png`, `manual-meu-dia-celular-claro.png`, `manual-funil-desktop-escuro.png` e `manual-gestor-historico-claro.png`.

Este documento acompanha um checkpoint de código/testes/evidências com E2E global final ainda pendente. Revisão final da branch e checks de PR seguem sob responsabilidade do controlador. Este documento não declara push, PR, merge ou publicação.
