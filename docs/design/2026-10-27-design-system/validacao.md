# Validação da adoção do design system

Registro iniciado em 27/10/2026, atualizado em 28/10/2026. Referência visual: [HTML aprovado](../design-system-padrao.html). O [levantamento anterior](../design-system-atual.md) registra a revisão histórica, não o estado de cada consumidor após a adoção. O [plano de execução](../../superpowers/plans/2026-10-27-padronizacao-elementos-crm.md) organiza as dez tarefas; este documento registra a implementação e o alcance das evidências locais.

## Situação

As dez tarefas tiveram implementação e revisão focadas aprovadas. A tarefa 10 foi reaprovada após a correção do retorno da configuração e do recorte de foco da lista, no produto local `17554c1fe3ba8e9a9ddd82aa77d13a96b363c15e`. A onda única de correções finais resultou no produto local `ee2ff9592649117bd16c5eb2d0451ec000fe92cd`, aprovado no E2E completo e na revisão independente de código, incluindo o escopo final. A revisão independente do conjunto, incluindo o suplemento documental, foi aprovada no HEAD `61cb5ee769c878bf42ecde9f14df61615ef9f107`, com Critical 0, Important 0 e Minor aberto 0. Esta reconciliação posterior dos três documentos ainda aguarda revisão própria do lote D; a aprovação anterior não a antecipa. Publicação continua fora do plano e sem autorização.

A execução adotou implementação e revisão por agentes distintos, tarefa por tarefa, sob coordenação central, com verificações pesadas sequenciais. A base local incorpora a interface recente e o HTML aprovado; o Ruling 1 justifica a implementação antes da integração remota. Esse era o estado anterior à integração. Em 28/10/2026, as PRs 55/60 e os lotes A/B/C estão integrados na main. O lote D está preparado localmente sobre `5feb4df3152bafaf1d35aab01cbaa9a0760b0865`; PR, CI remoto, revisão humana e merge deste lote permanecem pendentes. Este é o checkpoint na preparação deste commit; o resultado definitivo será registrado na PR e no registro de integração, sem antecipar o resultado dos gates.

A base da tarefa 10 é `83a2b8886768bdb23fd80bd7717d386b6c5bda1f`, na branch local `codex/adotar-design-system`. Não houve merge, push, PR ou deploy nesta tarefa. A execução usa `.env.test`, bancos descartáveis e serviços locais simulados, sem dados ou credenciais de produção.

## Integração confirmada em 28/10/2026

Os resultados abaixo são próprios de cada lote integrado; os 104 E2E do fechamento local anterior não são resultado de CI remoto do lote D.

| Entrega | Merge confirmado na main | CI remoto confirmado |
| --- | --- | --- |
| PR 55, interface e proteção de publicação manual | `204a5272b85accda76a02ab2c2a7a92385e20371` | CI e revisão concluídos antes do merge. |
| PR 60, documentação e HTML | `e6e1024a8ef5af1a49cd5ad0026bf73b25309320` | CI concluído; merge manual pelo usuário resolveu o bloqueio anterior de autorrevisão. |
| PR 61, lote A | `0acac602d0792d28a8743d0a6f2abab81d8777c4` | Run `40708232142`, head `2f12ca016163972fd61fd5e11c0a2c8028359ca9`: 1769 unidades aprovadas/2 skips, 724 integrações e 84 E2E aprovados. |
| PR 62, lote B | `6b5d703b4f33dded3c3c8fe0081e356108feae32` | Run `40712768226`, head `826e9c1f8ab1c6538d931c614f597b15bf92d974`: 1776 unidades aprovadas/2 skips, 724 integrações e 88 E2E aprovados. |
| PR 63, lote C | `5feb4df3152bafaf1d35aab01cbaa9a0760b0865` | Run `40716994573`, head `d8a6fb9109ce985305e4dda62fe713c12daf9fba`: 1783 unidades aprovadas/2 skips, 724 integrações e 92 E2E aprovados. |
| Lote D | Preparado localmente; não integrado | PR, CI remoto, revisão humana e merge pendentes; nenhuma contagem futura é declarada aprovada. |

Tipos, lint, convenções de migração e build passaram em cada um dos CIs finais de A/B/C. A tentativa inicial de CI do lote A, run `40703196598` no head `97d1fa51ede242697c1b21c3389370f32f1d66f3`, falhou: 82 E2E aprovados e dois ENOENT por ausência do HTML de referência. Foi uma rodada reprovada, seguida de reconciliação documental e novo CI após o merge manual da PR 60, com as comparações preservadas; os Rulings 8 e 9 registram esse custo.

A proteção versionada em `vercel.json` e o [procedimento de publicação manual](../../operacao/publicacao-manual-git.md) são herdados da main. A leitura da API Vercel após o merge C, em 28/10/2026, confirmou o deployment de produção `dpl_8a3jRGKywRjoSar6da7EoArMmPn2` em READY, inalterado. Não houve alteração de configurações externas nem publicação do lote D.

Foram observados 17 alertas de dependências do GitHub (2 críticos, 7 altos, 7 moderados e 1 baixo), ainda sem triagem. Não houve mudança de dependências neste trabalho; a triagem fica para acompanhamento separado, sem atribuição de causa.

## Diferenças do levantamento e evidências

A tabela mapeia cada diferença histórica ao resultado implementado e à sua verificação focada. “Concluído” qualifica a verificação citada, não uma certificação de toda a aplicação.

| Diferença | Adoção e evidência focada concluída | Limite ou contexto | Commits locais de referência |
| --- | --- | --- | --- |
| D01, token neutro ausente | Fundação: alias `--ui-muted` definido; controles e superfícies em claro/escuro. Tarefa 1: 15 unitários e 17 E2E. | Aliases de compatibilidade continuam disponíveis onde há consumidor. | `6a288dc` |
| D02, erro da Carteira | Erro passa a usar Alert danger com mensagem e recuperação. Tarefa 2: 48 unitários e 7 E2E. | Erro de infraestrutura continua distinto de vazio. | `8cd6c14` |
| D03, campos em celular/toque | Fundação normaliza 40/44 px e 14/16 px; Google adota Textarea comum; WhatsApp elimina override de 13 px, raio 8 e foco 2. Tarefas 1, 6 e 10. | WhatsApp mede CSS real em seis larguras e em toque de 1280 px; não ensaia aparelhos físicos. | `6a288dc`, `15bc396`, `2a643ff` |
| D04, filtros concorrentes | PainelFiltros compartilhado e adoção nas áreas, com formulário permanecendo no consumidor. Tarefa 3: 21 unitários e 9 E2E, mais um caso focado de seção 18/26. | PainelFiltros não cria outro form; busca e transporte nativo são preservados. O agrupamento de rótulo/campo do Google gestor foi corrigido na onda final. | `9ea7241`, `ee2ff959` |
| D05, etiquetas e filtros | Badge informativo compartilhado; Google e WhatsApp o adotam. WhatsApp mantém filtros como Button com `aria-pressed`. Tarefas 3, 6 e 10. | Filtros e opções de vendedor continuam controles/navegação; Badge não ganha ação. | `6a288dc`, `9ea7241`, `15bc396`, `2a643ff` |
| D06, medidas concorrentes | Tokens de espaçamento, campo, card e raio governam os componentes comuns. Tarefa 1: unidades, CSS computado e build. | Bolhas de conversa, avatar e coluna contextual têm geometria própria da tarefa. | `6a288dc` |
| D07, vazios | EstadoVazio usa Card, título, explicação e ação opcional; adoção em Carteira e demais áreas, inclusive WhatsApp. Tarefas 2 a 10. | “Puxar a próxima empresa” mantém `/fila`; vazios informativos podem omitir ação. | `8cd6c14`, `34ffa43`, `64b203a`, `83a2b88`, `2a643ff` |
| D08, galeria e shell | Galeria alinhada ao shell e acrescida de exemplos de controles/tabelas. Tarefa 4: 31 unitários, 21 passes E2E e dois cenários afetados depois da correção. | Não houve corrida única de 22/22 nessa tarefa. Abas SmoothUI/Base UI/Motion e shadcn foram preservados. | `c7c4fce` |
| D09, estados dos campos | Input, Textarea e NativeSelect preservam semântica nativa; somente leitura aplica-se aos campos apropriados. Fundação e adoção Google/configuração. | NativeSelect já tinha o contrato necessário; sua correção foi no CSS comum. | `6a288dc` |
| D10, foco | Contorno único de 3 px, afastado 3 px, sem ring simultâneo; correção na origem do shell e retirada dos overrides locais. Tarefas 1, 2, 4 e 10. | WhatsApp confirma foco na busca/filtros e retorno à conversa/miniatura nas jornadas locais; os ensaios não certificam leitor de tela, zoom ou outros motores. | `6a288dc`, `8cd6c14`, `c7c4fce`, `17554c1` |
| D11, escolhas nativas | Choice mantém checkbox/radio nativos, rótulo e área clicável nas adoções. Prospecção: nove unitários; Google: 12; Administração: 41; Acesso: 11; Atendimento: 79 antes da rodada de revisão. | Fontes, limites, papéis, cotas e payloads comerciais permanecem os existentes. | `e3398e4`, `15bc396`, `34ffa43`, `64b203a`, `c250a33` |
| D12, largura/padding | Shell centraliza limites e módulos removem concorrências substituídas. Tarefas 4, 7, 8 e 9. | WhatsApp conserva largura ampla intencional, fora do limite comum de 1420 px. | `c7c4fce`, `34ffa43`, `64b203a`, `c250a33` |
| D13, documento histórico | Inventário e HTML preservados; este registro acrescenta a situação da adoção e o alcance dos ensaios. | A especificação anterior continua histórica; borda clara atual `#8793A0` e conteúdo comum de 1420 px. | `2a643ff` e esta consolidação documental |
| D14, mensagens | Carregamento, erro, vazio e sucesso seguem componentes e mensagens contextualizadas em português. Tarefas 4 a 10. | Não se reescrevem placeholders contratuais nem se acrescentam ações só por uniformidade editorial. | `c7c4fce` a `17554c1`, por área |

Evidências adicionais aprovadas nas tarefas anteriores: Prospecção preservou três/duas/uma colunas por contêiner e 11 empresas mais “Ver todas buscas”; Google teve oito E2E finais nas três jornadas; Administração teve 11 E2E e medição adicional de contraste; Acesso teve cinco E2E e capturas administrativas. Atendimento teve 21 E2E antes da rodada de revisão e, após correções, 26 unitários e cinco casos afetados, incluindo três caminhos de foco e submit nativo. Esses números descrevem rodadas distintas e não devem ser somados como uma suíte ampla única.

## WhatsApp e configuração

Os testes `painel.dom.test.tsx`, `midia-mensagem.dom.test.tsx` e `configuracao/formulario.dom.test.tsx` cobrem seleção, histórico/cursores/fontes, falhas recuperáveis, identificação longa/ausente, mídia sob demanda, retorno de foco, payload de vínculo/remoção e conservação dos campos. O teste `whatsapp-visual.spec.ts` usa as páginas reais e o serviço WhatsApp local, sem renderização SSR improvisada.

A busca conserva o nome acessível “Buscar conversa”, placeholder “Nome, telefone ou mensagem” e descrição de alcance. As etiquetas comerciais e a indicação de leitura são informativas; filtros mantêm `aria-pressed`. Abrir empresa continua Link. O diálogo conserva o tema, reserva espaço para fechar e devolve foco à miniatura. Áudio permanece sem autoplay; documento conserva download; nenhuma ação de envio foi acrescentada.

Após a revisão da tarefa 10, “Voltar ao WhatsApp” usa Button por `asChild`, conservando Link e destino `/whatsapp`, com alvo de 40/44 px. A lista reserva espaço para o foco externo de 3 px com afastamento de 3 px; primeira e última conversa tiveram o contorno medido nos quatro lados do scroller, em 1280/390/320 px e nos dois temas. Os quatro novos casos tiveram RED de alvo de 21 px e recorte de 6 px, seguido de GREEN; a revisão confirmou ambos os achados resolvidos no commit `17554c1`.

A configuração conserva as operações e permissões de gestor existentes. Campos e valores sobrevivem a falha recuperável; sucesso usa Alert com `role="status"`, erro usa Alert danger. O ensaio real salva vínculo sintético, confirma duplicidade com outro vendedor e remove o vínculo no banco descartável. Nenhum segredo é apresentado ou incluído nas capturas; detalhes privados de erro continuam ocultos.

As medições focadas incluem claro/escuro em 1920, 1280, 1200, 820, 390 e 320 px, busca 14/16 px, raio 6, foco 3/3, alvos 40/44, nome longo e contato sem identificação, geometria interna da lista/cabeçalho e do diálogo, seleção, reabertura, imagem e mídia indisponível. A configuração mede 1280, 820, 390 e 320 px, além de toque em 1280 px. `matchMedia` confirma o ponteiro de toque; os controles comuns não recebem correções locais para simular o resultado.

## Comandos e alcance

Comandos focados da tarefa 10:

```text
npm run test:unit -- app/whatsapp/painel.dom.test.tsx app/whatsapp/midia-mensagem.dom.test.tsx app/whatsapp/configuracao/formulario.dom.test.tsx
npm run typecheck
npm run lint
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/whatsapp-visual.spec.ts
npm run test:e2e -- --sem-build tests/e2e/design-system.spec.ts --grep "smoke visual320"
npm run test:unit -- src/docs.test.ts
```

Resultados focados CONCLUÍDOS: 39/39 unitários de WhatsApp/configuração e 201/201 verificações de prosa, executados juntos como 240/240 em quatro arquivos; typecheck, lint e build:e2e com saída zero. A primeira entrega teve WhatsApp visual 8/8; depois da correção de revisão, foram 12/12 em corrida única de 36,2 s e 39/39 unidades afetadas no produto `17554c1`. O smoke320 passou 1/1 em 14,4 s, com 30 visitas (15 áreas em dois temas). As rodadas distintas não são somadas como uma suíte única.

O smoke adicional de 320 px visita, em leitura e nos dois temas, Gestão, Empresas, Listas, Usuários, Google do gestor, Design, WhatsApp/configuração; e Meu dia, Prospecção, Banco, Localizar, Google do vendedor, Funil e Carteira. Reutiliza a preparação idempotente e as contas do harness existente. Confere rota, título, reflow e controles principais contidos. A rolagem horizontal interna aprovada do planejamento não é tratada como overflow do documento. Não altera senha nem executa ações comerciais.

## Capturas selecionadas

Quatro imagens foram selecionadas dos ensaios locais com dados fictícios e animações desativadas. As duas da Carteira documentam a adoção focada da tarefa 2; as do WhatsApp documentam a tarefa 10 após a correção de revisão. São evidências dessas condições, sem representação de produção. As demais capturas e relatórios permanecem no workspace ignorado; não foram copiados em massa.

- [Carteira vazia, 1280 px, claro](capturas/carteira-vazia-1280-claro.png): Card, descrição e CTA semântico para /fila, na tarefa 2.
- [Carteira vazia, 390 px, escuro](capturas/carteira-vazia-390-escuro.png): mesma próxima ação no celular, na tarefa 2.
- [WhatsApp, 1920 px, claro](capturas/whatsapp-1920-claro.png): composição ampla, filtros e estado informativo, na tarefa 10.
- [Retorno da configuração, 390 px, escuro](capturas/whatsapp-retorno-390-escuro.png): alvo comum e foco 3/3, após a revisão da tarefa 10.

Os testes versionados de [design system](../../../tests/e2e/design-system.spec.ts) e [WhatsApp](../../../tests/e2e/whatsapp-visual.spec.ts) reproduzem as verificações; imagem isolada não comprova interação, permissões ou cobertura integral.

## Decisões recuperáveis

As seis decisões originais e as três decisões de integração acrescentadas abaixo consolidam os Rulings do registro local de execução, com seus motivos e custos caso estejam erradas:

1. Implementar localmente sobre a interface recente antes da integração externa. As PRs 55/60 ainda estavam abertas; R-021 proíbe empilhar PRs, não desenvolver localmente. Custo: rebase e adaptação à main antes de integrar. Não autoriza merge/publicação.
2. Regularizar NativeSelect como Verify. O TSX já possuía contrato e classe necessários; o ajuste era no CSS comum e foi medido no componente real. Custo: possível omissão de caso específico, mitigada por E2E e revisão final; não produzir hunk artificial.
3. Antecipar na tarefa 2 o afastamento de foco do link no shell para 3 px. O E2E do CTA provou que a regra do shell prevalecia; corrigir a origem evitou override temporário em EstadoVazio. Custo: efeito global nos links, coberto pelo caso focado e revisão final de teclado.
4. Interpretar mapas Modify como responsabilidade de inspeção, mantendo mudanças textualmente obrigatórias. Carteira CSS já entregava o resultado por composição e conservava consumidor de aviso. Custo: omitir consumidor, mitigado por evidência por área e revisão funcional; não editar apenas para criar diff.
5. Permitir omissão de ação em vazio informativo de consulta. A especificação/API opcional e as ações existentes de cabeçalho/paginação tornam redundante um segundo botão. Custo: usuário pode usar a atualização do cabeçalho; mudança é reversível e não altera dados. O CTA obrigatório da Carteira permanece.
6. Acrescentar a EstadoVazio o modo de submit nativo com `name`, `value` e estado desabilitado, preservando Link/callback. A fila já dependia do submitter nas guardas; callback imperativo ou botão oculto complicaria o transporte. Custo: regressão nas guardas/consumidores, mitigada por testes FormData, jornadas de reserva e tipos. Nenhuma action/regra de domínio mudou.

7. Proteger a publicação manual antes do merge da PR 55. A descoberta do vínculo Git da Vercel exigiu `git.deploymentEnabled.main=false` em `vercel.json` e o procedimento `docs/operacao/publicacao-manual-git.md`; branches omitidas mantêm os previews conforme configurados. Custo se errado: publicação por Git pode ocorrer ou um deploy Git esperado pode ser bloqueado. Mitigação: validação/revisão da configuração e confirmação pela API de produção inalterada após os merges. Não houve alteração de configurações externas.
8. Preparar inicialmente o lote A como rascunho somente de código/testes enquanto o merge da PR 60 estava bloqueado pela autorrevisão, excluindo expressamente seus três documentos. O transporte preservou o código, mas a suposição de independência documental dos testes estava errada: duas comparações usavam `readFileSync` do HTML aprovado. Custo realizado: uma rodada de CI reprovada por dois ENOENT e reconciliação posterior da documentação; a tentativa não foi declarada sucesso. A fonte validada permaneceu preservada.
9. Preservar as comparações com a referência e manter o lote A em rascunho com CI reprovado até resolver a documentação, sem duplicar HTML, ignorar/enfraquecer asserções ou contornar a rejeição de merge. Custo: o lote não pôde ser considerado pronto para merge até a PR 60 integrar e o CI ser reexecutado. O merge manual da PR 60 pelo usuário resolveu o bloqueio; a reconciliação restaurou os metadados planejados do lote A e o HTML herdado, com os testes intactos, antes do novo CI aprovado.

## Resultados do fechamento local em 28/10/2026

Resultados executados pelo controlador, com logs locais e `verification-results.json` preservados no workspace:

| Verificação | Resultado confirmado | Revisão e condição |
| --- | --- | --- |
| Unidade completa | Saída 0; 200 arquivos; 1793 passes e 1 skip; 171,14 s | Head `2a643ff`. Após o ajuste local de Link/CSS, as 39 unidades afetadas e os 12 E2E WhatsApp passaram em `17554c1`; a unidade inteira não foi repetida. |
| Integração completa | Saída 0; 69 arquivos aprovados e 1 ignorado; 723 passes e 1 skip; 210,15 s | Head `17554c1`, bancos locais descartáveis. |
| Typecheck e lint | Saída 0; repetidos depois da onda única | Produto local `ee2ff959`. |
| db:checar | Saída 0 | Head `17554c1`; a onda final não alterou SQL ou banco. |
| Build E2E | Saída 0; repetido depois da onda única | Build do produto `ee2ff959`, usado na nova execução completa. |
| E2E completo, primeira rodada | NÃO APROVADA; 97 passes/5 falhas, total 102; saída 1; 8,0 min | Head/build `17554c1`; rodada e artefatos preservados. |
| Correções finais, verificação focada | Saída 0; 6/6 casos; 49,5 s | Head `ee2ff959`; dois casos Google nos dois temas e quatro casos de seletores, com payload e jornadas preservados. |
| E2E completo, repetição final | Saída 0; 104 passes, 0 falhas e 0 skips; 6,8 min | Head/build `ee2ff959`, fixture do dia 28/10. Banco `teste_82be7b690108` removido e porta 3100 sem servidor ao terminar. |
| Revisão final e Web Interface Guidelines | Código e escopo final CONCLUÍDOS | Revisão independente ampla e revisão dos cinco arquivos de `ee2ff959` aprovadas; Minor Google resolvido, sem regressão nem Critical/Important/Minor de produto aberto. O suplemento e a revisão ampla foram aprovados em `61cb5ee`; a reconciliação documental posterior do lote D aguarda revisão própria. |

As verificações locais descritas estão concluídas nas revisões e condições da tabela. O smoke de 320 px e as medições focadas acrescentam cobertura de geometria/teclado nos cenários executados, sem certificação de toda combinação possível. O relatório consolidado já registrou a aprovação documental em `61cb5ee`, junto aos resultados de código nas condições executadas acima. Esta atualização de integração ainda não recebeu a revisão própria do lote D.

Na primeira rodada E2E, o controlador identificou cinco falhas: Meu dia exibiu corretamente “Atrasado” após a fixture de 27/10 atravessar a meia-noite; três seletores antigos dependiam de article literal ou de “Limpar filtros” sem escopo; e o filtro de Usuários por trecho de e-mail também alcançava outra conta. Esses resultados não foram tratados como aprovação. A onda única ajustou os quatro testes aos alvos exatos e corrigiu o Minor do Google; Meu dia não foi alterado. A repetição integral com fixture do dia 28 aprovou os 104 casos, incluindo a ordem compartilhada e os cinco cenários antes afetados.

A correção Google em `ee2ff959` agrupou Label e NativeSelect como irmãos dentro de cada div do PainelFiltros, mantendo formulário GET, names, opções, valores, semana, consulta e permissão de gestor. Os dois testes reais confirmaram gap de 8 px, empilhamento e largura em 820 px, mínimos de 40/44 px, FormData exato, query aplicada e próxima semana com vendedor/estado preservados, nos dois temas. Houve uma tentativa RED inválida por nickname desatualizado da fixture, registrada como tal; após corrigir a preparação do teste, o RED válido mediu gap de -40/-44 px antes da alteração de produto. O GREEN focado teve 6/6, incluindo as quatro jornadas de seletores sem enfraquecer seus contratos. Unidade e integração completas não foram repetidas nessa onda de apresentação/testes.

Observação não impeditiva: o servidor registrou “The destination stream closed early.”, digest `3236477580`, três vezes no E2E completo final; as jornadas ao redor passaram e a execução terminou com saída zero. A causa não foi confirmada. O evento também existiu na primeira rodada, mas não nos logs focados da onda de correção. Não houve supressão do log nem alteração de produto para ocultá-lo; não se declara o aviso resolvido.

Unidade, integração e E2E completo final não tiveram o aviso NO_COLOR/FORCE_COLOR após remover ambas as variáveis do processo. Permaneceram o aviso preexistente de importação dinâmica do Vite em `src/server/diretivas.test.ts` e o stdout de métricas de importação. Esses ruídos não motivaram alteração de produto.

## Limites aceitos do escopo (Declined)

A revisão de código e o fechamento local aceitaram explicitamente os seis limites abaixo; eles delimitam as conclusões destas evidências:

1. Internals sem alteração de contrato não receberam nova auditoria completa. As guardas, ações, serviços e políticas existentes foram preservados, com os ensaios de regressão descritos; isso não equivale a reauditar integralmente cada implementação interna.
2. Operações reais, serviços pagos e produção ficaram excluídos. As verificações usam dados fictícios, mocks e bancos locais descartáveis, sem credenciais ou operações de produção.
3. Não há certificação integral de leitor de tela, zoom, aparelhos físicos, outros motores de navegador ou contraste não medido. Houve medições de viewport, foco e pares reais selecionados, incluindo os controles da ficha no escuro em 390 px com contraste 13,059:1 e opacidade 1. As metas de 4,5:1 para texto e 3:1 para controles/foco não são uma alegação sobre todos os pares da aplicação; hex de token isolado não certifica a tela.
4. Os gates de integração de A/B/C foram concluídos, com CI próprio aprovado e merges humanos confirmados; PRs 55/60 também estão integradas. Para D, PR, CI remoto, revisão humana e merge permanecem pendentes. Publicação continua fora do plano e requer solicitação própria; nenhuma publicação da adoção é declarada.
5. Português e placeholders contratuais foram preservados. As preferências do usuário e os contratos existentes prevaleceram sobre convenções editoriais genéricas das Guidelines.
6. A galeria oferece exemplos concretos dos componentes usados; não constitui catálogo exaustivo de toda combinação ou biblioteca. Shadcn e as abas SmoothUI/Base UI/Motion foram mantidos; não se acrescentou dependência ou pacote sem necessidade.

Não foram ensaiados leitor de tela, zoom real de navegador nem produção. As medições de viewport não equivalem a esses ensaios. A implementação e validação locais estão concluídas dentro desses limites; a aprovação documental anterior está registrada em `61cb5ee`, enquanto a revisão desta reconciliação e os checkpoints externos do lote D permanecem com o controlador e o usuário.

O histórico anterior permanece recuperável: a rodada combinada de `npm test` na tarefa 3 foi inconclusiva e interrompida, embora o arquivo afetado tenha passado isoladamente 14/14; a baseline tinha timeout do probe Windows, seguido de 15/15 focados. A possibilidade conhecida de duplicar usuário na fixture de Gestão após reinício de worker por falha não foi mascarada por mudanças de produto.
