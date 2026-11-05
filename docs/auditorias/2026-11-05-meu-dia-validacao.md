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

O hook de arquivo limpa a intenção persistida e emite a atualização do store mesmo se a instância emissora já desmontou; nesse caso, retorna `null` ao chamador antigo. Essa semântica não foi alterada.

Além da jornada versionada de navegação após sucesso, um cenário local adicional e ignorado foi executado pelo mesmo harness seguro, depois do E2E global. Primeiro, foram visitados Meu dia e Funil para preencher o cache de navegação. O arquivamento foi iniciado pela lixeira do Funil; a resposta HTTP real foi retida somente depois de o backend confirmar o commit. Ainda com a resposta retida, um link real levou ao Meu dia e o elemento `main` anterior ficou desconectado do DOM (`isConnected=false`). O comando continuou armazenado e o botão de recuperação do novo consumidor permaneceu desabilitado durante o envio.

Após liberar a resposta original, o store ficou limpo. A empresa arquivada permaneceu ausente e a empresa B continuou visível no Meu dia, no Funil previamente visitado e ao remontar Meu dia. O teste observou um envio HTTP. O banco confirmou uma operação de arquivo, uma negociação encerrada, um contato e zero vendas. A versão passou de 4 para 6 no commit e permaneceu em 6 após a resposta e a navegação; o instante de arquivo permaneceu idêntico e `agenda_contato_id` continuou nulo. O cenário passou 1/1 em 4,9 s, com código 0, na mesma build `PI6S2uhg0ekyEg60qfwyg`; o banco `teste_90d90414d32a` foi removido.

Essa evidência sustenta a ausência de regressão funcional nesse caminho real de sucesso após desmontagem do emissor. O Quadro não tem uma guarda própria que proíba toda navegação durante esse arquivamento; não se afirma essa proteção. As guardas de rascunho e replay externo estão limitadas aos cenários de formulário e consumidores efetivamente testados. Também não se promete entregar um aviso ao chamador já desmontado. O cenário adicional permanece fora da suíte versionada e não amplia consultas ou permissões.

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
| E2E completo | Código 0: 172/172 passaram em 13,2 min no checkpoint congelado `8366a5f`; banco removido |
| Documentação `src/docs.test.ts` | Código 0: 243 verificações; repetido após o fechamento documental |

A unidade completa teve uma rodada anterior concorrente com 2557 testes aprovados, 3 timeouts e 1 ignorado. Os três arquivos afetados passaram isolados (22 testes, 240,72 s); a rodada completa seguinte passou com um worker e sem checks pesados concorrentes. Os limites de tempo e assertions foram mantidos. O teste ignorado é específico de Linux (`src/e2e-processos.test.ts:49`), em uma execução Windows. Permanece o aviso do Vite sobre import dinâmico sem extensão estática em `src/server/diretivas.test.ts`; esse arquivo não foi alterado nesta tarefa. No E2E, o Node também avisou que `NO_COLOR` foi ignorado porque `FORCE_COLOR` estava definido. Os dois avisos foram preservados, sem alterar produto ou configuração para suprimi-los.

A integração completa revelou uma expectativa antiga que excluía futuros em `vendas-carteira.test.ts`. Após autorização do controlador, somente o nome do cenário e a expectativa de agenda foram atualizados, preservando vínculo, negociação e autorização. O primeiro focal teve um timeout de hook inalterado durante longa indisponibilidade observada do processo; a repetição idêntica passou 8/8 em 5,65 s. A rodada global final passou 829/829. O teste de versão, antes ignorado porque `PG_VERSAO_ESPERADA` estava ausente, foi habilitado com `18` somente no processo filho da rodada final. Nenhum limite de tempo foi aumentado.

A primeira rodada de `--sem-build` encontrou um artefato anterior às mudanças de produto. Seus 7 testes passaram, mas essa execução foi descartada como evidência do código atual. A build segura foi refeita antes de registrar o red das jornadas antigas.

A rodada focada ampliada depois dos ajustes de produto executou 41 testes: 36 passaram e 5 falharam. Os novos cenários de histórico, guardas, venda, replay de arquivo/venda e remontagem passaram; as falhas remanescentes foram tratadas. A primeira rodada E2E global executou 172 cenários: 170 passaram e dois falharam porque o seletor Próximo passo também identificava o novo tabpanel. O teste passou a buscar o textbox real; o arquivo inteiro passou 4/4 em 31,2 s. A rodada global final passou os 172 cenários no checkpoint congelado `8366a5f`, com código 0; o banco `teste_2129d3fe3bed` foi removido. Nenhum timeout ou assertion de produto foi afrouxado.

## Capturas

Capturas locais geradas pelo Playwright, com dados sintéticos, em [pasta de evidências](../design/2026-11-05-meu-dia/):

- `cards-{light,dark}-{1440,390}.png`: cards sem seleção inicial.
- `retorno-{light,dark}-{1440,390}.png`: leitura do retorno.
- `dados-{light,dark}-{1440,390}.png`: dados da empresa.
- `negociacao-{light,dark}-{1440,390}.png`: editor comum e rodapé lado a lado.
- `historico-{light,dark}-{1440,390}.png`: nota longa e atividade autorizada.
- `replay-venda-empresa-b.png`: confirmação de venda anterior sem trocar a negociação atual.
- `arquivo-apos-desmontagem.png`: agenda coerente após resposta de arquivo entregue com o emissor anterior já desmontado.

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

O checkpoint `8366a5f` recebeu revisão própria da Tarefa 6 com resultado Approved, sem achados Critical ou Important. Todos os gates locais finais passaram; a atualização seguinte altera somente documentação e capturas regeneradas pelo E2E. Revisão geral da branch e checks de PR seguem sob responsabilidade do controlador. Este documento não declara push, PR, merge ou publicação.


## Rodada final dos dois achados da revisão geral

Correção com base em `a90837a38d7bebdd07fe300615d4dd735c4c402e`, na mesma branch `codex/meu-dia-cards`:

- Dados da empresa agora recebe um rodapé comercial opcional apenas nesta composição. Negociação existente abre o editor comum na mesma lateral e Voltar restaura Dados e seu gatilho; clientes e tentativas agendadas sem negociação seguem o Atendimento autorizado da Carteira, com `nome`, `retorno` e `periodo` preservados. Dados aberto pelo card usa Voltar para fechar com foco no card; Dados aberto pelo Histórico restaura essa aba. Outros consumidores cadastrais conservam a composição anterior.
- Empresas conhecidas como indisponíveis voltaram a bloquear novas vendas, Atendimento, avanço e Sem interesse, conforme os controles anteriores à reorganização. O Histórico continua acessível por clique e teclado; a confirmação da venda anterior preserva alvo, chave e entrada. O bloqueio não reutiliza indiscriminadamente `dirty`, mantendo os diálogos de descarte.

A rodada TDD começou com seis falhas pertinentes e um replay aprovado; após a correção e a cobertura adicional de guardas, os três DOM afetados passaram 97/97. Outros quatro arquivos adjacentes passaram 53/53. Tipos, lint e 243 verificações documentais passaram. A build segura `npm run build:e2e` terminou com código 0 e gerou `OZHH6iwu2bkYUVuBaH0ET`; a primeira candidata permaneceu congelada durante essas verificações. O ajuste de alcance descrito abaixo exige outro artefato.

O harness `scripts/e2e/run.mts --sem-build` executou os três arquivos afetados (Meu dia, Funil e Histórico comercial): 19/19 passaram em 1,4 min, código 0, um worker Chromium, banco temporário `teste_8450d3794d2d` removido. A execução usou o PostgreSQL18 local fornecido pelo controlador, contas fictícias e mocks. Cobriu 1440/390, claro/escuro, foco e teclado, Dados → Negociação → Dados → Histórico, Dados direto com rascunho/descarte, os dois destinos de Atendimento com filtros, indisponibilidade conhecida desde a abertura e Histórico expansível sem telefone/formulário/escritas novas. O replay após perda de resposta manteve a mesma chave e uma única venda no banco; em Dados de cliente, clique e Enter no link Atendimento ficaram bloqueados durante o envio. Depois da confirmação da própria empresa, conserva-se o comportamento anterior de fechar o painel sem selecionar vizinho.

As evidências globais de 2561 unidades, 829 integrações e 172 E2E registradas acima pertencem ao checkpoint anterior. Esta rodada executou apenas verificações afetadas; CI completo e revisão focada final seguem sob responsabilidade do controlador. Nenhum push, PR, merge ou deploy foi realizado nesta rodada.

Novas capturas pertinentes nesta build: `indisponivel-{light,dark}-{1440,390}.png` e `replay-venda-dados-cliente.png`, na pasta de evidências já vinculada. Recapturas automáticas de históricos e retornos sem mudança de comportamento foram descartadas para manter suas evidências anteriores.


Após conferir a captura de replay em Dados de cliente, a expectativa final do teste foi tornada mais precisa: aguardar o fechamento já existente após confirmação da própria empresa e a ausência de seleção automática. Sem alterar fonte ou build, esse único cenário foi repetido pelo harness: 1/1 passou em 5,6 s, código 0, banco `teste_cd3aa29c84fe` removido. A documentação atualizada passou novamente nas 243 verificações.


A conferência independente dessa candidata encontrou o rodapé de Dados fora da viewport, após o cadastro longo. Antes do commit, quatro regressões reais de geometria falharam com a build `OZHH6iwu2bkYUVuBaH0ET`: claro/escuro × 1440/390, extremidade inferior da ação em 2096/2056 px para viewport de 1000 px, medida antes de qualquer rolagem ou clique. Harness com código 1; banco `teste_e7f202f621c0` removido. Não se declara aprovação ou captura manual válida dessa tentativa.

O próprio achado de Dados foi completado com layout opcional de corpo cadastral rolável e rodapé persistente, sem alterar consumidores sem rodapé. A regressão exige posição dentro da viewport antes de qualquer rolagem, mantém essa posição depois de rolar o cadastro, confere Origem alcançável e ativa a negociação por Enter. O novo artefato e a prova final de navegador são registrados a seguir; os 19+1 E2E da primeira candidata não são reclassificados como prova desse ajuste de layout.


Na fonte final, tipos, lint e os 97 DOM afetados passaram novamente. A nova build segura `UPJ5Jr1xkRI7IedLrTmOx` terminou com código 0 e substituiu a candidata anterior. A rodada final repetiu os três arquivos de navegador: **23/23 passaram em 1,3 min**, código 0, na mesma build e com a fonte congelada. O banco temporário `teste_29c109eb5b65` foi removido e os processos encerrados. As quatro regressões novas conferem o rodapé dentro da viewport antes de rolar ou clicar, cadastro com rolagem própria e posição do rodapé idêntica depois de rolar até Origem. Os outros 19 cenários também passaram nesse layout final, incluindo contexto, foco, rascunho/descarte, pendências e replay.

As capturas `dados-{light,dark}-{1440,390}.png` foram atualizadas para esse layout e `dados-rodape-{light,dark}-{1440,390}.png` mostram o fim do cadastro com a ação comercial persistente. A inspeção efetiva das imagens de celular claro e desktop escuro confirmou o cabeçalho Voltar, o cadastro rolável e o botão Negociação no rodapé visível.


### Conferência independente desta fonte final

O controlador repetiu o roteiro `manual-final-fixes.mts` na build `UPJ5Jr1xkRI7IedLrTmOx`, sem modificar suas assertivas após a correção de geometria. Resultado PASS em 05/11/2026, porta local 3110, conta fictícia `meudiae2e`, banco descartável `teste_035dc629e121`. O processo manual 37260 terminou com código 0; banco removido e servidor/mocks encerrados.

Foram observados desktop 1440 × 1000 escuro e celular 390 × 844 com touch/claro: Dados pelo card usando Enter, cabeçalho Voltar, cadastro carregado e ação Negociação habilitada no rodapé com caixa dentro da viewport antes de qualquer clique/rolagem. Enter abriu a negociação correta na mesma rota; Voltar restaurou Dados/foco na ação comercial e o Voltar seguinte fechou para a lista/foco no card. No desktop, Retorno/Histórico → Dados → Negociação → Dados → Histórico preservou contexto; Escape voltou ao Próximo passo e depois à lista/foco em Abrir retorno. Sem transbordamento horizontal.

O controlador inspecionou efetivamente as duas capturas finais, copiadas como `final-manual-dados-desktop-escuro.png` e `final-manual-dados-celular-claro.png` na pasta de evidências. Confirmou conteúdo legível, rolagem própria do cadastro e rodapé persistente visível. Esse roteiro não repetiu indisponibilidade, escritas, perda de resposta ou replay; esses casos pertencem à prova do implementador descrita acima. A evidência global anterior não foi reclassificada como execução desta fonte.
