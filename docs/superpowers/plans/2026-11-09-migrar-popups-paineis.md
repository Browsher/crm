# Migração dos pop-ups de conteúdo do CRM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar consultas e formulários que ainda abrem no centro em painéis laterais. As confirmações de ações e descarte usam o pop-up central.

**Architecture:** Compartilhar o cabeçalho, o corpo e o rodapé de PainelLateralCrm com uma variante de sobreposição para os fluxos que já usavam Dialog. Preservar a autoridade do componente atual sobre carregamento, envio e descarte. No Banco, o dono dos resultados alterna internamente entre a lista e a ficha da empresa.

**Tech Stack:** Next.js, React, TypeScript, componentes UI existentes, Vitest, Playwright.

**Spec:** [Padronização dos painéis](../specs/2026-11-05-padronizacao-paineis-crm-design.md), com a escolha do Banco de 09/11/2026. Base main `ff8731d49a4fa084532edd39374b01aedaaff868`.

## Global Constraints

- Um painel de conteúdo por vez. Cabeçalho e rodapé fora da rolagem. Largura desktop `clamp(380px, 47vw, 520px)`. Até 820 px, tela inteira e ações de pelo menos 44 px. Imagem ampliada conserva sua largura aprovada.
- Fechar no primeiro nível e Voltar nas etapas internas. Restaurar o foco, a aba, a origem e a posição pertinentes. Manter a confirmação central acima da lateral e o foco neutro nela.
- Preservar entradas diretas, fontes, autorização, consultas, regras de negócio, rascunhos, idempotência e recuperação dos comandos. Formulários mantêm campos, validação nativa e envio por Enter. Botões externos ao corpo usam o atributo `form`.
- Usar sessões, mídias e empresas fictícias no ambiente isolado. Usar PostgreSQL 18 de teste em 127.0.0.1:55432. Executar build e navegador com o harness existente.
- As páginas já completas e a navegação móvel do CRM conservam sua função. O trabalho abrange os pop-ups centrais de conteúdo em uso, inclusive a consulta de empresa demonstrada na galeria.
- Implementação e revisão independentes por etapa. Branch e PR contra main com CI verde. Merge e produção exigem autorização específica.

## Review Focus

- Um clique em Ver empresa dentro de resultados montados troca o conteúdo da única lateral. Voltar preserva a lista, a rolagem e um comando de inclusão em curso. Fechar o resultado e trocar de aba conserva seu estado fechado. Cobrir na tarefa 2.
- A resposta atrasada de uma busca, ficha ou imagem fechada não volta a aparecer no painel de outro alvo. Cobrir nas tarefas 2 e 6.
- Esc, clique de fundo, Cancelar e Voltar do navegador passam pelas guardas de edição e envio. A confirmação mantém a lateral montada. Cobrir nas tarefas 1, 3, 4 e 5.
- A senha provisória muda de confirmação para entrega lateral uma única vez, fica visível durante a entrega e sai do DOM ao fechar. Nenhuma escrita adicional em reload. Cobrir na tarefa 5.
- Erro e resultado incerto de venda ou espelhamento mantêm a entrada e o comando da operação original, conforme os contratos existentes. Cobrir nas tarefas 3 e 4.

### Task 1: Base para os diálogos que passam à lateral

**Files:** `src/components/ui/dialog.tsx`, `src/components/crm/painel-lateral.tsx`, `src/components/crm/painel-lateral.module.css`, `src/components/crm/painel-lateral.dom.test.tsx`.

**Interfaces:** Adicionar `lateral?: boolean` a DialogContent. Na variante lateral usar `data-slot="painel-lateral-content"` e as classes da moldura CRM, com o portal, tema e overlay existentes. Exportar `PainelSobrepostoCrm` ao lado de PainelLateralCrm. Ele consome o Dialog pai e as mesmas props de conteúdo, mais `onCloseAutoFocus` opcional com o tipo de DialogContent. A ação `aoFechar` recebe Fechar, Escape e clique de fundo, sob a guarda de `fecharBloqueado`. Manter `data-painel-lateral`, `data-painel-composicao="padrao"`, corpo e rodapé. Compartilhar a marcação e CSS da moldura. A variante sobreposta usa foco e isolamento do Radix. A variante existente preserva seu isolamento móvel.

- [ ] Cobrir em DOM a variante lateral com Dialog e uma confirmação simultânea. Asserções incluem título focado, uma moldura, um Dialog central, ação de fechamento sob guarda e retorno ao gatilho.
- [ ] Implementar a variante e verificar que as classes de centralização são exclusivas de DialogContent central.
- [ ] Rodar `npm run test:unit -- src/components/crm/painel-lateral.dom.test.tsx src/components/crm/use-painel-movel.dom.test.tsx` e typecheck. Revisar e commitar esta base.

### Task 2: Banco e consultas cadastrais

**Files:** `app/fila/buscar/{page,empresas-recentes,resultados}.tsx`, `app/fila/cartao.tsx`, `app/empresas/lista.tsx`, `app/empresas/busca/{conteudo,detalhe-acao}.tsx`, `src/components/crm/{busca-dialogo,historico-buscas-dialogo,historico-buscas,empresa-dialogo,empresa-detalhes}.tsx` e CSS pertinente. Testar as jornadas em `tests/e2e/{busca-popup,busca-redesign,busca-resposta-perdida,carrossel-empresas-banco,fluxo-comercial-unificado,leituras-recuperacao-final}.spec.ts` e outros consumidores encontrados pelo seletor atual.

**Interfaces:** Reutilizar `lerDetalheBuscaAcao(id)` e `lerDetalhesEmpresaAcao(referencia)`. `BuscaPainel` consome nome, conteúdo inicial opcional, ação de leitura existente, rótulo e abertura inicial. Expor conteúdo cadastral que o painel de busca possa renderizar dentro de sua moldura. Usar contexto client para Cartao encaminhar Ver empresa ao painel pai. ConteudoBusca e SociosGestor continuam no servidor. Manter a lista montada enquanto a ficha está aberta. Usar Tabs da UI para Buscar empresas e Histórico de buscas, com `keepMounted` para preservar o estado da busca. O histórico do gestor conserva seu consumidor e abre resultados/filtros autorizados na lateral. Renderizar filtros a partir de `ResumoBusca.filtros` e do resultado atual, reaproveitando os campos existentes.

- [ ] Adaptar os testes aos gatilhos, separando assertivas de painel e de confirmação. Verificar abertura automática após busca, aba de histórico, filtros do grupo, uma lateral em resultado → ficha → Voltar e consulta cadastral também no gestor.
- [ ] Substituir os pop-ups de histórico, resultados e dados. Manter metadados, status de processamento e erro, Concluir inclusão, Localizar minhas empresas, autorização e contadores. Exibir Filtros usados no card principal, inclusive no resultado atual. Mostrar a leitura do filtro na lateral. Reusar os campos cadastrais nos grupos Contato e localização, Cadastro e origem, Atividades e sócios nas consultas migradas. As páginas diretas preservam a composição atual.
- [ ] Confirmar foco no gatilho, rolagem preservada, retorno tardio sem troca de alvo e nenhuma chamada ao fornecedor na leitura, fechamento ou reload. Testar fechar os resultados e alternar as abas sem reabertura. Rodar DOM, typecheck e jornadas afetadas. Revisar e commitar.

### Task 3: Critérios e espelhamento Google

**Files:** `app/fila/google/{criterios,espelhar,planejamento}.tsx`, `app/fila/google/google.module.css`, `tests/e2e/google-planejamento.spec.ts` e testes DOM consumidores.

**Interfaces:** Manter `InformarEdicao`, `pedirFechar`, `onAplicar`, `copiarPlanoAcao`, `EstadoPlano` e os mesmos campos. Aplicar critérios altera o rascunho do dia. O espelho conserva revisão e seleção de origem/destino.

- [ ] Testar as três seções Empresas e produtos, Contatos e presença digital, Preferências e restrições. Entrar, editar, voltar, conferir valor e aplicar com o rodapé. Verificar descarte central com clique de fundo e Back, modo leitura e restauração do foco.
- [ ] Migrar para PainelSobrepostoCrm. Usar MenuPainelCrm nos critérios, com valores controlados preservados entre seções. O espelho abre o formulário direto em Origem, O que copiar e Destino. Associar rodapé ao formulário por ID. O submit interno de critérios interrompe a propagação React até o formulário semanal. Cobrir Aplicar e Enter sem gravação semanal.
- [ ] Executar jornada de envio lento e falha incerta do espelho, teclado, resolução móvel e a spec inteira de Google. Revisar e commitar.

### Task 4: Venda na Carteira

**Files:** `app/carteira/registrar-venda.tsx`, testes de Carteira e `tests/e2e/{venda-recuperacao,carteira-visual,leituras-recuperacao-final}.spec.ts`.

**Interfaces:** Manter RegistrarVenda e o dono de `useEnvioVenda`, `criarComandoVenda`, `transmitirVenda`, guardas e destino atual. Formulário lateral com Cancelar e Conferir venda. Reutilizar ConfirmacaoPainelCrm para confirmar venda e descartar. Manter campos montados enquanto a confirmação está aberta.

- [ ] Testar recompras pela ficha, conferência e descarte centrais, Cancelar volta para o formulário, retorno agendado, resposta perdida/reload com a mesma chave e proteção de Back durante envio.
- [ ] Migrar a composição e relacionar o submit do rodapé ao formulário. Capturar e restaurar foco após confirmação e fim da tarefa. Manter a trava síncrona e a remoção única da sentinela.
- [ ] Rodar os testes da Carteira e as jornadas de venda atuais. Revisar e commitar.

### Task 5: Criação de acesso, entrega de senha e renomeação

**Files:** `app/usuarios/{formulario-criar,linha,tabela,senha}.tsx`, `app/empresas/grupos/controles.tsx`, `tests/e2e/usuarios-conta-guardas.spec.ts`, testes DOM administrativos, jornadas de Listas e Usuários.

**Interfaces:** Manter ações de servidor e `useDescarteEdicao`. O fluxo de criação troca o formulário pela entrega de senha dentro da mesma lateral. Em Nova senha provisória, concluir a confirmação central e então mostrar a entrega lateral com o mesmo resultado em memória. As demais confirmações de usuário e ativação de grupo preservam a superfície central enquanto aguardam decisão. O aviso pós-gravação com Concluir passa à lateral. A transição foca a lateral. Fechar devolve foco ao gatilho ou à busca quando a linha saiu do filtro.

- [ ] Testar foco, guardas de criação e renomeação, envio lento, erro antes de gravar, resultado incerto e descarte. Testar passagem da confirmação de nova senha à lateral e remoção do texto sensível ao fechar, com credencial fictícia.
- [ ] Migrar formulários e recibo de senha à lateral. Manter cópia explícita e conclusão. Ajustar mensagem legada de ativação/desativação com base no comportamento de grupos vigente.
- [ ] Rodar testes administrativos e navegador nos dois papéis. Revisar e commitar.

### Task 6: Mídia, galeria e verificação final

**Files:** `app/whatsapp/midia-mensagem.tsx`, `app/whatsapp/whatsapp.module.css`, `app/design/galeria.tsx`, testes de mídia, galeria e jornada de superfícies.

**Interfaces:** Abrir a miniatura autorizada em PainelSobrepostoCrm. Mostrar imagem e legenda no corpo, com Ampliar imagem no rodapé. Voltar e Escape na ampliação recuperam o modo normal da mesma lateral. Na ampliação, usar a largura aprovada de até 1100 px no desktop e canvas de 720 px com rolagem horizontal limitada ao corpo. Demonstrar a consulta fictícia da galeria na lateral e manter a confirmação de descarte central.

- [ ] Testar mídia simulada, imagem e legenda, zoom e volta, abortar/liberar blob na troca de conversa, player e download atuais. Conferir a consulta fictícia e a confirmação da galeria.
- [ ] Migrar mídia e galeria. Varredura final de DialogContent, AlertDialogContent e diálogos nativos em app/src deve identificar apenas confirmações centrais e a base compartilhada. Conferir que mudanças de grupo, papel, acesso, venda, Sem interesse e descarte mantêm a confirmação.
- [ ] Conferir 1440 × 900, 821 px, 820 px e 390 × 844, teclado, tema e foco. Rodar tipos, lint, build e E2E no banco isolado. Revisão independente da etapa e da branch, abrir PR e aguardar CI.
