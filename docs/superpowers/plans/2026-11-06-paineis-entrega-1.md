# Primeira entrega dos painéis do CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a base compartilhada aprovada a Meu dia e Funil, com menu interno, ações fixas e recuperação dos fluxos atuais.

**Architecture:** Evoluir PainelLateralCrm e reutilizar as máquinas de estado, consultas e formulários existentes. A migração é aditiva no contêiner até os quatro consumidores atuais serem adaptados; nenhuma alteração de domínio, SQL ou armazenamento é necessária. Apresentação compartilhada não recebe autoridade para enviar, descartar, arquivar ou navegar: essas decisões continuam nos donos atuais.

**Tech Stack:** Node 24, Next.js 16.4.1, React 19.2.8, TypeScript, CSS Modules e componentes UI existentes, Vitest/jsdom, Playwright e PostgreSQL 18 temporário no harness.

**Spec:** docs/superpowers/specs/2026-11-05-padronizacao-paineis-crm-design.md. Ler também docs/design/2026-11-06-revisao-final/README.md e o inventário 2026-11-05-inventario-paineis-crm.md.

## Global Constraints

- No desktop: clamp(380px, 47vw, 520px), com limite de 520 px. Até 820 px: A aprovada, painel em tela inteira, acima da barra do CRM, com um único cabeçalho da tarefa.
- Uma lateral por vez; menu interno para várias seções; tarefas curtas diretas. Sem Resumo na Negociação.
- Cabeçalho e rodapé fora da rolagem. Corpo rolável; botões de ação com mínimo de 40 px no desktop e 44 px no celular; pares com larguras iguais. Não mudar globalmente Button ou a identidade visual.
- Voltar interno no cabeçalho; Fechar no primeiro nível; não repetir Voltar ao retorno no rodapé.
- Confirmar, descartar e Sem interesse continuam em pop-up central A: alvo destacado, consequência e ações. Preservar o foco neutro e os comandos dos donos atuais.
- Preservar também Fechar mantendo rascunho já existente no Funil e Fechar mantendo envio da venda incerta; não reduzir as exceções reais aos dois botões de um exemplo.
- Nenhuma dependência nova, migração, alteração de RLS, DTO, regra comercial, chave de sessão ou protocolo de idempotência.
- Não substituir FormularioContato, useEnvioVenda ou useEnvioArquivo por um formulário/hook novo que replique a lógica.
- Dados e usuários isolados; sem produção, buscas pagas ou integrações reais. Usar exclusivamente o harness e suas guardas de host local.
- Implementação e revisão em agentes separados por etapa, conforme preferência preservada. Cada executor é informado de sua responsabilidade e de que não deve reverter trabalho alheio.
- Branch codex/ a partir da main conferida; PR contra main com CI catraca verde. Sem merge ou publicação. A autorização deste chat é para preparar o plano; revisar o plano antes de executar.

## Review Focus

1. Redimensionar com edição ou envio ativo não remonta o editor, perde o comando ou libera uma segunda gravação. Coberto na tarefa 1 e nos cenários das tarefas 3/4.
2. Confirmação central sobre painel móvel mantém seu próprio foco; Escape cancela a confirmação, sem fechar o painel por baixo. Coberto nas tarefas 1, 3 e 4.
3. Resposta tardia de A após abrir B não exibe dados privados, fecha B ou reabre seleção. Coberto na tarefa 2 e na regressão da tarefa 4.
4. Replay após resposta perdida/reload mantém chave, versão, entrada e alvo, inclusive comando iniciado por outro consumidor. Coberto na tarefa 3 e na regressão da tarefa 4.
5. Ações fora do corpo rolável continuam pertencendo ao formulário certo, com validação e Enter; consumidores antigos do formulário não mudam. Coberto na tarefa 3 e na tarefa 4.

## Base conferida e escopo

Em 06/11/2026, o conector GitHub retornou main em d830a53c84bd1137e0808c6bfab4466127fe75de, PR #73. git diff dessa base contra app/, src/, tests/, scripts/, .github/ e os manifests locais não apresentou diferenças. A branch codex/padroes-paineis-mockups contém somente documentação/mockups, com consolidação em 4f53cd4 antes deste plano. Conferir novamente a main antes da execução; não presumir que a medição continuará atual.

Dentro desta entrega: contêiner, menu, avisos/estados e confirmação apresentacionais; Meu dia; navegação/atendimento/venda do Funil; invólucro de DadosEmpresaPainel e arquivo Sem interesse que essas áreas já usam.

Fora: agrupamento completo dos dados em três menus e sua migração nas listas, Banco, Google, ficha lateral da Carteira, usuários/perfil, mídia WhatsApp e textos de Listas. São entregas posteriores. Nesta etapa DadosEmpresaPainel ganha somente a base e o rodapé comum, com seu conteúdo e suas consultas atuais. A primeira venda continua indo à rota autenticada da ficha atual da Carteira; não antecipar a futura ficha lateral.

Não reabrir o desenho de cards, filtros Todos/Atrasos/Hoje/Próximos, três etapas do Funil ou animação da lixeira. Preservar esses comportamentos.

## Fontes a ler antes de editar

- src/components/crm/painel-lateral.tsx, painel-lateral.module.css, painel-lateral.dom.test.tsx e shell.module.css.
- src/components/crm/descarte-edicao.tsx: manter seus contratos de links, Back e beforeunload; não substituir a confirmação nativa do navegador.
- app/meu-dia/retorno-painel.tsx, painel.tsx, meu-dia.module.css, agenda.ts e painel.dom.test.tsx.
- app/funil/modal.tsx inteiro, arquivo-lateral.tsx, quadro.tsx, negociacao.module.css, funil.module.css e respectivos testes DOM.
- src/features/contato/formulario.tsx inteiro, formulario.test.tsx, rascunho.ts; src/lib/use-envio-venda.ts e venda-envio.ts.
- src/components/crm/empresa-dialogo.tsx, empresa.module.css, empresa-dialogo.dom.test.tsx; historico-comercial.tsx e seus testes.
- src/components/ui/dialog.tsx e sheet.tsx como referência de foco e confirmações, sem criar um segundo sistema concorrente de diálogo.
- scripts/e2e/run.mts, tests/e2e/ambiente.ts, vitest.config.mts e .github/workflows/ci.yml.

### Tarefa 1: contêiner comum com rolagem e apresentação móvel

**Files:**
- Modify: src/components/crm/painel-lateral.tsx; painel-lateral.module.css; shell.module.css.
- Create: src/components/crm/use-painel-movel.ts; use-painel-movel.dom.test.tsx.
- Test: src/components/crm/painel-lateral.dom.test.tsx.

**Interfaces:**
- Consumes: props atuais de PainelLateralCrm, incluindo aoFechar, rotuloFechar e fecharBloqueado; os callbacks continuam sendo a autoridade.
- Produces: adicionar rodape?: ReactNode e ocupado?: boolean a PainelLateralCrm. Transitoriamente nas tarefas 1-3, rodape undefined mantém a composição legada; rodape null ativa a base comum sem ações; um nó ativa a base com rodapé separado. Após migrar os quatro consumidores, a tarefa 4 remove o fallback e undefined passa a equivaler a null, sem mudar a assinatura opcional. ocupado controla somente aria-busy do corpo, não decide se pode fechar.
- Produces: data-painel-composicao="padrao", data-painel-corpo e data-painel-rodape para delimitar as regiões e medir no navegador. Preservar data-painel-lateral e os IDs existentes.
- Produces: usePainelMovel(raiz: RefObject<HTMLElement | null>, ativo: boolean): void. Isola foco/rolagem do fundo somente em painel comum até 820 px, sem remontar children; restaura os estados que ele próprio alterou no cleanup.

- [ ] **Step 1: escrever testes que falham para o contrato novo.** No harness DOM existente, renderizar conteúdo longo e rodape com Salvar. Adicionar testes nomeados 'rodapé comum fica fora do corpo', 'modo móvel muda sem remontar editor' e 'confirmação central prevalece sobre a guarda do painel'. Asserções estruturais:

```tsx
expect(painel.querySelector('[data-painel-corpo]')?.contains(salvar)).toBe(false)
expect(painel.querySelector('[data-painel-rodape]')?.contains(salvar)).toBe(true)
expect(corpo.getAttribute('aria-busy')).toBe('true')
expect(montagensDoEditor).toBe(1) // após 821 -> 820 -> 821
```

Simular matchMedia com eventos change. No desktop, preservar aside sem aria-modal e o fundo utilizável. No móvel, o fundo coberto não participa da navegação por foco; Tab/Shift+Tab ficam no painel ativo, respeitando um Dialog central aberto. O teste de cleanup deve conservar inert/overflow que já existiam antes. Não verificar geometria em jsdom; essa parte pertence à tarefa 4.

- [ ] **Step 2: rodar e confirmar falha pelas expectativas novas.** Executar npm run test:unit -- src/components/crm/painel-lateral.dom.test.tsx src/components/crm/use-painel-movel.dom.test.tsx. O vermelho deve vir da ausência do slot/guarda novo, sem desativar os testes legados.

- [ ] **Step 3: implementar o contêiner e a guarda.** Para a composição comum, flex em coluna com altura 100dvh; cabeçalho/rodapé flex:none e corpo min-height:0/overflow:auto. A lateral é fixa à direita em todas as larguras; até 820 px usa 100vw; acima usa a largura aprovada. Usar os tokens atuais e safe-area no rodapé. Preservar o foco inicial no título e não executar aoFechar se fecharBloqueado.

A guarda móvel mantém a árvore do editor estável e libera a confirmação central para controlar seu próprio foco. Não alternar entre árvores Sheet/aside que desmontem um envio. Não tornar a navegação de fundo inerte no desktop. Restaurar apenas os atributos/estilos de fundo que esta instância modificou; não interceptar a saída nativa já guardada pelos donos.

Em shell.module.css, reservar a largura aprovada a partir de 821 px somente quando houver painel de composição comum. Manter a regra legada de 1121 px para consumidores ainda não migrados; não sobrescrever a largura nova com o clamp antigo de 420 px. Não adicionar largura de imagem nesta entrega.

- [ ] **Step 4: rodar os testes da tarefa e typecheck.** Esperado: todos aprovados, inclusive o teste atual de painel não modal no desktop, Voltar e bloqueio de Escape. Comandos: o da Step 2 e npm run typecheck.

- [ ] **Step 5: registrar e revisar a etapa.** Conferir branch codex/ imediatamente antes do commit. Commit sugerido: feat(crm): cria composição comum dos painéis. Revisor separado recebe diff, spec, testes executados e riscos de foco/resize. Resolver achados antes da tarefa 2.

### Tarefa 2: menu, estados e Meu dia na base comum

**Files:**
- Create: src/components/crm/menu-painel.tsx; estado-painel.tsx; painel-comum.module.css; painel-conteudo.dom.test.tsx.
- Modify: app/meu-dia/retorno-painel.tsx; painel.tsx; meu-dia.module.css.
- Modify: src/components/crm/empresa-dialogo.tsx; empresa.module.css, somente DadosEmpresaPainel e seu invólucro.
- Modify: src/components/crm/historico-comercial.tsx; src/features/contato/linha-do-tempo.tsx; src/lib/historico-comercial.ts, apenas apresentação/filtro controlável, sem nova consulta.
- Test: src/components/crm/historico-comercial.dom.test.tsx; src/features/contato/venda-historico.test.tsx.
- Test: app/meu-dia/painel.dom.test.tsx; painel.test.tsx; src/components/crm/empresa-dialogo.dom.test.tsx.

**Interfaces:**
- Consumes: rodape/ocupado e regiões da tarefa 1; callbacks e contexto anteriores de PainelMeuDia.
- Produces: MenuPainelCrm({ rotulo, itens }), com itens readonly de { id: string; titulo: string; descricao?: string; desabilitado?: boolean; aoAbrir: (gatilho: HTMLButtonElement) => void }. Renderizar nav com botões normais, sem role menu/tab ou protocolo de setas artificial. O id informado é estável para restaurar foco.
- Produces: EstadoPainelCrm({ tipo, titulo, descricao }), com tipo 'carregando' | 'vazio' | 'erro' | 'indisponivel' | 'pendente' | 'incerto' | 'sucesso'. Somente apresentação: faixa compacta, símbolo e texto; nenhuma consulta/comando/CTA embutido. Erro anuncia alert; os demais status. A ação fica no rodapé do dono.
- Preserves: AbaRetorno 'passo' | 'historico', aoMudarAba e contexto anterior, mesmo que agora representem navegação de seções. Não é necessário renomear o contrato interno para retirar as abas visuais.
- Produces: em src/lib/historico-comercial.ts, FiltroHistoricoComercial = 'todos' | 'atendimentos' | 'vendas' e filtrarEventosHistorico(eventos: readonly EventoHistoricoComercial[], filtro: FiltroHistoricoComercial): EventoHistoricoComercial[]. Reutilizar o predicado atual, sem mutação dos eventos.
- Produces: HistoricoComercial e LinhaDoTempo aceitam controleFiltro?: { valor: FiltroHistoricoComercial; aoMudar: (valor: FiltroHistoricoComercial) => void } e conteudoVazio?: ReactNode. Sem essas props, consumidores atuais conservam filtro interno e vazio atual. Exportar eventosDeContatos(contatos: readonly Contato[]): EventoHistoricoComercial[] de linha-do-tempo.tsx, extraindo a projeção existente sem novos campos; ela continua uma composição neutra, não uma action/use server. Não importar um helper de execução marcado use client em páginas de servidor.

- [ ] **Step 1: escrever regressões de navegação e composição.** Adaptar o harness existente: início sem seleção, Próximo passo direto, menu com Dados da empresa e Histórico e apenas Negociação ou o Atendimento autorizado no rodapé. Adicionar teste 'menu troca seção sem perder o contexto' e manter os testes de A -> B -> A, respostas tardias, perda de vínculo e replay. Asserções esperadas, usando montar/abrir/clicar já existentes:

```tsx
await montar()
expect(host.querySelector('[data-painel-lateral]')).toBeNull()
await abrir('Aurora')
expect(host.querySelector('[role="tablist"]')).toBeNull()
expect(host.textContent).toContain('Próximo passo')
await clicar('Histórico')
expect(host.querySelector('[data-painel-lateral] button')?.textContent).toBe('Voltar')
```

Nos testes compartilhados, comprovar menu com IDs/foco estáveis e estado sem botão artificial. Adicionar teste de filtro sem resultados: manter os filtros visíveis, mostrar Ver todos no rodapé, voltar a todos sem nova consulta e conservar os eventos. No Funil, filtrar Vendas nunca deve fabricar ou carregar vendas de outra fonte. DadosEmpresaPainel deve manter rodapeComercial fora do corpo, sem alterar a referência de cadastro/busca nem a consulta.

- [ ] **Step 2: rodar para confirmar o vermelho.** npm run test:unit -- app/meu-dia/painel.dom.test.tsx app/meu-dia/painel.test.tsx src/components/crm/painel-conteudo.dom.test.tsx src/components/crm/empresa-dialogo.dom.test.tsx. Incluir também src/components/crm/historico-comercial.dom.test.tsx e src/features/contato/venda-historico.test.tsx. As falhas esperadas são abas antigas, contrato de filtro controlado ausente e rodapé ainda dentro da região rolável.

- [ ] **Step 3: implementar apresentação e adaptar Meu dia.** Próximo passo aparece diretamente na entrada, com Dados/Histórico no menu; Histórico é seção interna com Voltar. Não duplicar Dados da empresa no rodapé. Negociação permanece no rodapé quando já autorizada; cliente/tentativa preserva Atendimento com urlFichaDoMeuDia e todos os filtros.

Preservar a consulta atual que reconcilia a disponibilidade do vínculo ao abrir o retorno, seu retry e o descarte de respostas antigas. Não remover essa leitura por parecer apenas conteúdo do Histórico. Voltar do Histórico retorna ao início; navegar daí para Dados registra essa origem real. Dados direto do card volta ao card sem selecionar retorno. Não manter testes que exijam um botão de Dados no rodapé do Histórico, pois a localização aprovada mudou; manter as verificações equivalentes de contexto/foco nos caminhos oferecidos.

No Histórico do retorno, controlar o filtro no dono do painel e usar a mesma projeção de contatos e filtrarEventosHistorico para determinar o vazio. Com eventos existentes e filtro sem resultados, conteudoVazio recebe a faixa específica e o rodapé mostra Ver todos; ao limpar, volta à composição comercial autorizada. Com histórico realmente vazio, mostrar orientação de primeiro registro, sem criar um CTA artificial. A identidade da empresa/eventos reseta o filtro a todos, conforme o contrato atual; não criar cache por empresa ou consultar dados adicionais. Consumidores sem as novas props mantêm a apresentação atual.

RetornoPainel adota rodape; remover regras locais concorrentes de altura 80dvh, breakpoint 650 e rolagens extras. DadosEmpresaPainel adota rodape={rodapeComercial ?? null}; retirar suas regras locais de altura/rodapé sem alterar EmpresaDialogo ou o agrupamento cadastral, que fica na entrega 2. Nenhum novo painel é empilhado. Em painéis sem ação autorizada, passar rodape null.

- [ ] **Step 4: verificar a tarefa.** Rodar Step 2 mais npm run typecheck. Esperado: início sem chamadas de histórico antes de abrir empresa, retry novo, remoção por perda de posse, filtros/rota intactos, foco no gatilho reconstruído e nenhuma alteração nas guardas reais de venda/arquivo. Asserções de tab/setas passam a botões/Tab/Enter; não enfraquecer asserções de dados e autorização.

- [ ] **Step 5: registrar e revisar.** Commit sugerido: feat(crm): aplica menu e base comum ao Meu dia. Revisor separado confere principalmente origem, filtros, foco, ausência de seleção automática e Dados sem consulta adicional. Resolver antes da tarefa 3.

### Tarefa 3: Funil, atendimento e venda com ações fora da rolagem

**Files:**
- Create: src/components/crm/confirmacao-painel.tsx; confirmacao-painel.dom.test.tsx.
- Modify: src/components/crm/painel-comum.module.css, criado na tarefa 2.
- Modify: app/funil/modal.tsx; negociacao.module.css; arquivo-lateral.tsx; funil.module.css; quadro.tsx apenas composição/callbacks de apresentação necessários.
- Modify: src/features/contato/formulario.tsx, extensão opcional de apresentação; sem mudança nas actions/rascunho.
- Test: app/funil/modal.dom.test.tsx; quadro.dom.test.tsx; src/features/contato/formulario.test.tsx.
- Create: src/features/contato/formulario-rodape.dom.test.tsx.
- Regression reference: src/lib/use-envio-venda.dom.test.tsx; app/funil/use-envio-arquivo.dom.test.tsx; app/meu-dia/painel.dom.test.tsx.

**Interfaces:**
- Preserves: PainelNegociacaoProps e PedirFecharNegociacao. Não mudar o contrato fechar(aviso?, venda?) ou quem aplica leituraDestino.
- Produces: leitura local 'menu' | 'passo' | 'historico', com modo de tarefa 'atendimento' | 'venda'. Ampliar Modo/PedidoDescarte existentes para registrar a origem exata da tarefa, sem criar outra máquina de envio ou entradas de histórico para cada seção.
- Produces: FormularioContato recebe destinoAcoes?: HTMLElement | null. undefined mantém o footer atual para todos os consumidores antigos; null solicita apresentação externa aguardando o alvo; HTMLElement hospeda as mesmas ações num portal. O formulário recebe ID estável baseado em useId e o submit externo aponta a esse ID por form, sem copiar lógica de submit. Não aninhar footer dentro de footer.
- Produces: ConfirmacaoPainelCrm({ titulo, descricao, alvo, acoes, children? }), todos ReactNode exceto titulo:string. Compõe Header/alvo destacado/descrição/erro opcional/Footer dentro do DialogContent existente. Não abre diálogo nem administra foco, estado, confirmação ou descarte.

- [ ] **Step 1: escrever testes que falham para o menu e os slots.** No harness real de modal.dom.test.tsx, manter montar/clicar/escapar e usar editorReal.ativo para verificar FormularioContato real. Testes novos: 'negociação começa no menu', 'tarefa volta à seção de origem', 'ações externas continuam no formulário certo', 'viewport não remonta envio', 'confirmação central não fecha o painel', 'retry repete somente a leitura autorizada' e 'telefone tardio não reabre seção ou empresa'. Asserções mínimas:

```tsx
expect(painel.querySelector('[role="tablist"]')).toBeNull()
expect(painel.textContent).not.toContain('Resumo')
expect(submit.form).toBe(formulario)
expect(painel.querySelector('[data-painel-corpo]')?.contains(submit)).toBe(false)
expect(comandoDepois.chave).toBe(comandoAntes.chave)
expect(comandoDepois.entrada).toEqual(comandoAntes.entrada)
expect(comandoDepois.alvo).toEqual(comandoAntes.alvo)
```

Os aliases painel/formulario/submit são os nós do teste de slot; comandoAntes/Depois são lidos pela API existente lerComandoVenda no teste de replay. Preparar promessa controlada e provar que resize/Tab/Enter/clique repetido não disparam segundo envio. No retry, rejeitar a primeira detalheAcao, acionar Tentar novamente e observar duas leituras, sem transmissão de venda/contato; atrasar telefoneAcao, sair da seção e comprovar que sua resolução não reabre o editor. No teste do formulário sem destinoAcoes, manter as ações no local legado e o contrato de submit atual.

- [ ] **Step 2: rodar e confirmar falhas novas.** npm run test:unit -- app/funil/modal.dom.test.tsx app/funil/quadro.dom.test.tsx src/features/contato/formulario.test.tsx src/features/contato/formulario-rodape.dom.test.tsx src/components/crm/confirmacao-painel.dom.test.tsx.

- [ ] **Step 3: implementar o menu e adaptar as tarefas sem reescrever os comandos.** Entrada da negociação no menu Atendimento e próximo passo / Histórico; leitura de passo/histórico mantém Registrar venda e Sem interesse no rodapé. O Histórico usa controleFiltro/conteudoVazio da tarefa 2 e filtrarEventosHistorico sobre eventosDaNegociacao(detalhe), nunca sobre outra fonte de contatos/vendas. Filtro vazio oferece Ver todos no rodapé e restaura as ações ao limpar, sem nova leitura. Atendimento e próximo passo abre o combinado e o botão Registrar atendimento. Somente este último chama atender/telefoneAcao, como no fluxo atual. Voltar da leitura vai ao menu; Voltar de edição pede a guarda e retorna à leitura de origem. Registro de dados da empresa permanece fora da negociação.

Manter o editor montado enquanto rascunho/envio precisam sobreviver, mesmo fora da seção ativa; não usar key de seção que reinicie useActionState. Preservar pedidoTelefone, vivo, sentinelas, dirty, fecharRef, bloqueio de arraste e useGuardaNavegacaoEdicao. Atualizar referências de foco que eram de abas para entradas do menu e gatilhos da tarefa.

Em FormularioContato, renderizar as ações existentes em destinoAcoes com createPortal de react-dom somente quando fornecido. Usar um div de ações dentro do footer comum; o submit externo tem form apontando ao form real e mantém sua action. Nenhum novo FormData, callback de gravação ou chave é criado pela mudança visual. Ao ocultar a seção, remover só a apresentação de ações, sem destruir o editor pendente. No formulário de venda local, associar Conferir venda ao seu form estável e colocar Cancelar/Conferir no rodapé conforme a origem, preservando a confirmação.

Loading/erro/indisponível usam EstadoPainelCrm. Retry da leitura de detalhe ou telefone repete a leitura autorizada, sem limpar rascunho ou aceitar resposta antiga; manter identificadores de requisição. Erros de campos continuam junto do formulário. Venda incerta mostra os dados de venda.comando.entrada, o alvo e a empresa do comando, sem confundir com os campos de outro editor aberto. Verificar registro reutiliza venda.enviar() sem novo comando; o nome de UX não cria endpoint de status. Manter Fechar mantendo envio e a política atual do cabeçalho, sem tratar ausência de resposta como recusa conclusiva.

Aplicar ConfirmacaoPainelCrm ao descarte/venda do Funil e ConfirmarArquivamento. O dono conserva DialogContent, tema, refs/foco e callbacks. Alvo de venda contém empresa, valor e data efetiva; Corrigir/Cancelar mantém os campos. Preservar Fechar mantendo rascunho onde atualmente oferecido e jamais apagar envio desconhecido. PainelArquivo usa o rodapé comum para Ver todos, preservando até três registros do próprio Funil, Devolver, recuperação, animação somente após sucesso novo e movimento reduzido. Não alterar SQL, elegibilidade ou o link do arquivo geral.

- [ ] **Step 4: verificar a tarefa e a compatibilidade.** Rodar Step 2 mais npm run test:unit -- src/lib/use-envio-venda.dom.test.tsx app/funil/use-envio-arquivo.dom.test.tsx app/meu-dia/painel.dom.test.tsx e npm run typecheck. Esperado: replay com a mesma identidade/versão/entrada, comandos de outros consumidores preservados, rascunhos em seção inativa protegidos, confirmação sem duplicidade e destino de primeira venda fornecido pela resposta autenticada. Nenhuma ação de outro consumidor é liberada só porque a apresentação mudou.

- [ ] **Step 5: registrar e revisar.** Commit sugerido: feat(crm): organiza negociação e ações no painel comum. Revisor separado lê os fluxos reais, não só snapshots. Foco da revisão: propriedade do form externo, remount, telefonia tardia, perda de vínculo, sentinela/Back e replay após reload. Resolver antes da tarefa 4.

### Tarefa 4: jornadas reais isoladas, regressão e PR revisável

**Files:**
- Create: tests/e2e/paineis-comuns.spec.ts.
- Modify: src/components/crm/painel-lateral.tsx; painel-lateral.module.css; shell.module.css; painel-lateral.dom.test.tsx, somente para retirar a compatibilidade de layout transitória após os quatro consumidores migrarem.
- Modify: tests/e2e/meu-dia.spec.ts; funil-painel-lateral.spec.ts; funil.spec.ts; historico-comercial.spec.ts, nos acessos às abas que viraram menu.
- Inspect/adapt only affected references: tests/e2e/redesign-crm.spec.ts; fluxo-comercial-unificado.spec.ts; leituras-recuperacao-final.spec.ts e demais ocorrências de getByRole('tab') ligadas aos painéis alterados. Abas de outras páginas não mudam.
- Preserve/run: tests/e2e/venda-recuperacao.spec.ts e testes de integração de Funil/agenda/arquivo/contato existentes.
- Create: docs/auditorias/2026-11-06-paineis-entrega-1-validacao.md, somente com evidência realmente executada.

**Interfaces:**
- Consumes: APIs/seletores de região das tarefas 1-3 e harness existente scripts/e2e/run.mts.
- Produces: evidência de geometria, navegação, semântica de gravação e regressão na branch; PR contra main com CI catraca verde. Sem ambiente de produção e sem migração.

- [ ] **Step 1: completar as jornadas de aceitação.** Usar usuários/empresas temporários pelo harness, seguindo funil-painel-lateral.spec.ts e os helpers criarUsuarioComSenha/vincularEmpresaTeste. Não usar credenciais ou env de produção. Testar 390x844, 820x900, 821x900, 1024x768 e 1440x900, em claro/escuro. Asserções de geometria:

```ts
const limite = width <= 820 ? width : Math.min(520, Math.max(380, width * .47))
expect(Math.abs(box.width - limite)).toBeLessThanOrEqual(1)
expect(box.y).toBe(0)
expect(Math.abs(box.height - height)).toBeLessThanOrEqual(1)
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
```

Provar cabeçalho/rodapé na viewport antes e depois de rolar o corpo; leitura de texto longo não cria rolagem horizontal. No celular, Enter/Tab/Shift+Tab e confirmação central permanecem no contexto acessível. No desktop, o quadro continua utilizável sem um modal central de conteúdo. Em 820/821 com nota e envio pendente, os campos e a promessa mantêm identidade.

Atualizar as jornadas de Meu dia para o caminho real aprovado: início -> retorno -> Histórico -> Voltar -> Dados -> Negociação -> Voltar, restaurando a origem disponível e o foco, sem criar uma seleção vizinha. Preservar cliente/tentativa com nome, retorno e período no destino atual. Falha de histórico, troca A/B e perda de posse não serializam dados de outro vendedor.

- [ ] **Step 2: testar envio lento e resposta perdida no harness.** Bloquear/liberar a resposta em rota local ou usar a infraestrutura dos testes venda-recuperacao.spec.ts e funil-painel-lateral.spec.ts. Registrar chave/entrada/alvo e versão antes da falha; fazer reload e replay explícito; confirmar uma única venda/contato/retomada, sem duplicação de evento ou animação. Confirmar que replay de outra empresa não fecha o editor atual. Não suprimir falhas com retry genérico do teste.

- [ ] **Step 3: retirar a compatibilidade transitória e executar a regressão.** Confirmar que RetornoPainel, PainelNegociacao, PainelArquivo e DadosEmpresaPainel adotaram rodape. Remover a ramificação de layout legado no contêiner e no shell; na API final, omitir rodape equivale a não ter ações, com base comum. Não retirar o fallback inline de FormularioContato, pois seus demais consumidores ainda o usam. Ajustar os testes de compatibilidade de layout sem perder as asserções de foco, Voltar e bloqueio. Se um teste de aceitação revelar desvio, reproduzir o vermelho antes da correção mínima e verificar o verde. Comandos previstos após implementação:

```text
npm run test:unit
npm run test:integracao
npm run typecheck
npm run lint
npm run db:checar
npm run test:e2e -- tests/e2e/paineis-comuns.spec.ts tests/e2e/meu-dia.spec.ts tests/e2e/funil-painel-lateral.spec.ts tests/e2e/historico-comercial.spec.ts tests/e2e/venda-recuperacao.spec.ts
```

O script E2E confere host local, cria banco teste_* com app_teste, usa mocks e encerra os recursos temporários. Não executar contra .env de produção nem trocar essas guardas. Para a rodada final, npm run build:e2e e npm run test:e2e -- --sem-build, como o CI atual. Esperado: todas as suites aprovadas, sem testes pulados para acomodar o layout. Instalar dependências/navegador somente se necessário, conforme o projeto; não introduzir outro gerenciador.

- [ ] **Step 4: revisão manual e registro de evidência.** Conferir a aplicação servida pelo ambiente isolado, nos temas e tamanhos acima, incluindo toque, teclado, conteúdo longo, erro, fechamento, rascunho, envio lento e resposta perdida. Para teclado virtual e barras do navegador móvel, registrar o dispositivo efetivamente usado; emulação de viewport sozinha não comprova esses casos. Não usar produção para preencher essa lacuna. Salvar capturas/relatório de teste pertinentes e registrar resultados, limitações e testes executados no documento de validação.

- [ ] **Step 5: revisão final, PR e encerramento da entrega.** Revisor final separado confere diff completo e a matriz da spec contra o plano, com os riscos de Review Focus. A auto-revisão do executor não substitui essa revisão. Corrigir achados; conferir branch codex/ antes de commitar; abrir PR contra main; acompanhar e corrigir CI até catraca verde. Descrever o que mudou, o que ficou para entregas posteriores e a evidência real. Não fazer merge nem publicar. Não declarar teclado virtual/dispositivo físico validado se não foi ensaiado; registrar a pendência real.

## Auto-revisão deste plano

Cobertura: base/largura/móvel na tarefa 1; menus/estados e Meu dia na tarefa 2; negociação/formulários/confirmações/arquivo na tarefa 3; integração e regressão na tarefa 4. Cada caso de Review Focus tem tarefa responsável e teste observável. Agrupamento de cadastro, Banco, Google, Carteira, gestor e WhatsApp estão explicitamente fora, sem migração silenciosa.

As props existentes de navegação e os contratos de comando foram conservados; rodape/ocupado, MenuPainelCrm, EstadoPainelCrm, destinoAcoes e ConfirmacaoPainelCrm são adições planejadas, não APIs já disponíveis. A transição de rodape undefined para null/nó é explícita durante os commits; a tarefa 4 retira o fallback transitório. Ao final, os quatro consumidores atuais usam a base comum e o formulário compartilhado mantém seu modo inline nos consumidores externos.

Os passos de testes definem nomes e assertivas; os trechos usam o harness existente ou aliases dos nós descritos. O plano não copia a implementação inteira nem cria testes que espelham CSS. Geometria é verificada no navegador e comandos no harness real. A ordem é sequencial; não implementar etapas concorrentes que compartilhem esses arquivos.

## Situação e handoff

Plano preparado para revisão do usuário, mantendo a escolha anterior de agentes separados para implementar e revisar cada etapa. Nenhum arquivo de produto alterado e nenhum teste de produto/CI executado nesta preparação. Depois da revisão do plano, iniciar a tarefa 1 em worktree de implementação e branch codex/ própria a partir da main conferida, preservando esta documentação como referência. Merge e publicação ficam fora da entrega.

## Verificação da preparação

Preparação por leitura de código, medição da main pelo conector GitHub e auto-revisão de cobertura/assinaturas/testes. O código do produto permaneceu idêntico à main conferida. As verificações de produto descritas acima são critérios futuros, não resultados já obtidos.

Na preparação, npm run test:unit -- src/docs.test.ts aprovou os 280 testes de documentação e git diff --check não apontou problemas. Nenhum teste de produto, banco ou navegador foi executado nesta rodada de planejamento.
