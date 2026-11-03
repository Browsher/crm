# Simplificação dos fluxos e avisos do CRM — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implementar a navegação aprovada, o acesso unificado a Sem interesse e os avisos em Faixa compacta, comprovando recuperação de comandos e preservação de contexto nos dois papéis.

**Architecture:** Reutilizar RPCs e RLS atuais. Separar confirmação da gravação de leitura do destino. Armazenar comandos de venda na sessão antes do envio; recuperação fica fora de cards que podem desaparecer. Construir retornos a partir de contratos locais fechados, nunca de URL arbitrária. Componentes embutidos preservam contexto.

**Tech Stack:** Next16.4.1, React19.2.8, TypeScript, npm, Vitest, PostgreSQL18 e Playwright existentes no lockfile.

**Spec:** ../specs/2026-11-03-simplificacao-fluxos-crm-design.md
**Mapas:** ../../auditorias/2026-11-03-botoes-{vendedor,gestor,comuns}.md e handoff correspondente.

## Global Constraints

- Workspace: C:/Users/ADM/.codex/worktrees/crm-fluxos-comerciais/crm
- Branch: codex/simplificar-crm-fluxos; documentação inicial25ccae0; base main0cdafb0.
- Sem interesse é situação comercial; converter apresentação em disponibilidade=sem_interesse, sem nova origem persistida.
- Manter ação individual Sem interesse, recuperação de comandos e arraste para a próxima etapa.
- Faixa compacta já escolhida; retirar mínimo artificial286px, usar tokens, texto completo e ações semânticas.
- Não alterar papéis, RLS, posse, critérios de negociação, idempotência, agenda ou retenção. Sem migração ou dependência nova prevista.
- features não importa de outra feature; contratos comuns em lib/server.
- Somente dados e serviços locais descartáveis no harness; nenhum teste contra contas, coletas ou integrações reais.
- TDD e revisão separada por lote; terminar em PR contra main com CI verde, sem merge/publicação.
- Distinção explícita entre defeito no código, melhoria solicitada e hipótese reproduzida/não reproduzida.

## Review Focus

1. Gravação confirmada seguida de falha ao ler destino, limpar armazenamento ou executar callback: conservar confirmação, nunca incentivar segundo registro.
2. Resposta perdida e reload quando a negociação/empresa já saiu da lista: recuperação visível fora do card, mesma chave/alvo/payload.
3. Replay antigo depois de outra aba vender, arquivar ou retomar: ler situação autorizada atual após RPC, sem exigir contexto anterior à chamada.
4. Origem do arquivo e filtros independentes ao atravessar ficha/grupo/coleta/conversa: não cair na base ativa nem escolher outra conversa como se fosse a desejada.
5. Fechar/Cancelar/Escape/Voltar com rascunho, comando desconhecido ou pending: distinguir dados locais de gravação transmitida; não apagar comando incerto.

## Preparação e estado inicial

- [x] Instalar npm ci do lockfile e confirmar suíte unitária base.
- [x] Usar PostgreSQL18 local dedicado, em diretório e porta exclusivos; criar bancos descartáveis pelo harness.
- [x] Ler guias locais Next de server-actions/use-router/forms antes de alterar esses contratos.
- [x] Registrar progresso/decisões no ledger próprio desta execução; não usar artefatos de outros planos.
- [x] Verificar branch imediatamente antes de cada commit. Git e escrita neste workspace exigem execução aprovada fora do sandbox deste chat; não mudar configuração global ou assumir propriedade do chat original.
- [x] Não escrever produto antes de concluir este plano.

## Task 1: Faixa compacta compartilhada

**Files:** src/components/crm/estado-vazio.tsx, composicoes.module.css, estado-vazio.dom.test.tsx; novo tests/e2e/avisos-compactos.spec.ts; expectativas de footer em app/carteira/lista.test.tsx, app/usuarios/usuarios.dom.test.tsx, app/empresas/page.test.tsx.
**Interfaces:** conservar Props/AcaoEstadoVazio, nivelTitulo e variantes link/local/submit; só modificar composição e CSS.
- [x] Red: teste visual da Carteira vazia com altura natural inferior ao antigo286px; ação/título/descrição presentes; texto longo completo e sem overflow em390/820/1280.
- [x] Preservar testes DOM de semântica, submitter/name/value, disabled e ausência de interativos aninhados; atualizar somente expectativas de rodapé obsoletas.
- [x] Implementar faixa baixa, ícone pequeno, texto e ação alinhados, ação podendo quebrar linha no celular; remover mínimo e margin-top:auto.
- [x] Green: testes DOM focados e E2E visual em ambiente isolado, claro/escuro e teclado.
- [x] Revisão de spec/qualidade separada, corrigir e commitar.

## Task 2: Pós-registro autenticado e rascunho correto

**Files:** novo src/lib/pos-registro.ts; novo src/server/atendimento/pos-registro.ts; src/features/contato/{acao,formulario,rascunho}.ts[x]; app/fila/{formulario,cartao}.tsx; app/fila/atendimento/acoes.ts; consumidores embutidos e testes correspondentes.
**Interfaces:** DestinoContato = permanecer | funil com negociacaoId | sem_interesse. DestinoEmpresaAtual é separado: atendimento com empresaId | funil com negociacaoId | carteira com empresaId | sem_interesse | indisponivel. LeituraDestino<T> separa destino de falha posterior. Server expõe lerDestinoContato(usuarioId,empresaId,resultadoValidado) e lerDestinoEmpresaAtual(usuarioId,empresaId), compartilhando leitura autenticada depois da RPC. Para contato, interesse/retorno com negociação ativa atual abre Funil; cliente ou demais resultados permanecem, e situação atual Sem interesse abre o recorte. Iniciar/retomar usa o segundo contrato, pois pode precisar de atendimento ou Carteira. Sucesso confirmado inclui a leitura separada. onSaved recebe empresaId e confirmação; callbacks embutidos podem ignorar segundo argumento. rascunhoAlterado(atual,inicial=rascunhoInicial(false)).
- [x] Red: interessado/retorno usa replace para negociação autorizada; cliente/sem negociação permanece; erro não navega; modal/ficha permanecem no contexto.
- [x] Red: RPC ocorre antes da leitura atual; replay vendido/arquivado/retomado usa estado atual; leitura posterior lançando devolve sucesso com aviso; limpar A não apaga B.
- [x] Red: acompanhamento intocado está limpo; editar/reverter e comando pendente respeitam baseline de abertura.
- [x] Implementar confirmação/consulta em blocos distintos. Não deixar falha de callback/limpeza virar envio desconhecido. URL local construída pelo consumidor de rota, com filtros preservados.
- [x] Iniciar/retomar em card conserva o contrato de persistência existente (crm:acao-empresa:v1:<empresa>); em replay, destino vem de leitura atual autenticada, sem leitura prévia bloqueando RPC.
- [x] Green: unidade/DOM focados e integração contato-replay-editor/atendimento-autoridade.
- [x] Revisão separada e commit.

- [x] Corrigir fechamento do deep-link: aguardar popstate, uma navegação, URL sem negociacao, filtros/hash preservados e reload sem reabrir; abertura manual atualiza dados. Minor de rearmar guarda ao voltar ao resumo fica explicitamente na Task4.

## Task 3: Sem interesse unificado com compatibilidade

**Files:** app/fila/central.tsx; app/fila/localizar/{page,pessoal,navegacao}.ts[x]; src/lib/prospeccao-pessoal.ts; app/fila/sem-interesse/{page,lista}.tsx; novo componente de recuperação legada no Localizar; app/funil/{quadro,page,card-sem-interesse}.tsx e testes.
**Interfaces:** normalizar origem visual sem_interesse para disponibilidade=sem_interesse antes do parser; domínio mantém enum de aquisição atual. Localizar recebe usuarioId autenticado para recuperar crm:retomar-arquivo:v1:<usuarioId>.
- [ ] Red: quarta opção da central; URL canônica; seleção visível; limpar conserva situação; nome/CNPJ/nicho/endereço/página sobrevivem à ida/volta.
- [ ] Red: rota antiga autentica antes de redirect; conserva parâmetros válidos, erro visível nos inválidos.
- [ ] Red: recuperação legada fora da grade, sem empresa visível e após reload, sem replay automático; bloqueia novas retomadas enquanto comando desconhecido; payload/chave idênticos e segregação de usuário.
- [ ] Implementar painel compatível conservando chave antiga até resposta terminal; usar contrato de destino da Task2 após confirmação.
- [ ] Retirar card separado/área de descarte/hover/instrução antiga do Funil. Conservar ação individual, persistência/Confirmar envio anterior e gate de leitura total.ok enquanto o contrato de consulta não mudar.
- [ ] Green: DOM central/localizar/quadro/compatibilidade e E2E sem-interesse.
- [ ] Revisão separada e commit.

## Task 4: Venda recuperável e primeira venda na Carteira

**Files:** novo src/lib/venda-envio.ts e testes; servidor de pós-venda em server; app/funil/{modal,quadro,acoes}.tsx/ts; app/carteira/{registrar-venda,venda-acao,[id]/ficha,[id]/page}.tsx/ts e testes.
**Interfaces:** ComandoVenda inclui usuarioId,empresaId,chave,entrada{valor,data,observacao} e primeira{negociacaoId}|recompra. Persistir antes de transmitir, recuperar por ator, limpar somente chave confirmada. Resultado confirmado não inventa repetida ausente na RPC.
- [ ] Red: resposta perdida, desmontagem/reload e confirmação usam mesmos dados/chave; armazenamento indisponível impede transmissão; payload desconhecido não pode ser corrigido.
- [ ] Red: Funil vazio ainda oferece confirmar venda anterior mesmo sem detalheAcao; não usar lerNegociacao aberta como pré-condição de replay.
- [ ] Red: confirmação de primeira venda abre ficha autorizada; recompra mantém ficha/filtros; leitura posterior falha não anuncia gravação falha.
- [ ] Implementar recuperação fora do modal/card, segregada por usuário; congelar dados durante desconhecido; descarte apenas de rascunho não enviado ou recusa conclusiva explícita.
- [ ] Resolver empresa pelo vínculo/venda autorizados no servidor, não por empresaId de storage; preservar precedência das RPCs existentes e nenhuma mutação extra.
- [ ] Reproduzir/corrigir Minor de Task2: reverter, pedir Voltar ao resumo durante retirada da sentinela e editar antes do popstate deve rearmar proteção no próximo Voltar.
- [ ] Green: DOM/modal/ficha/envio, integração funil-comandos/vendas-carteira e jornada de resposta perdida+reload verificando contagem no banco.
- [ ] Revisão separada e commit.

## Task 5: Google acessível e proteção de edições

**Files:** app/fila/google/{page,planejamento,criterios,espelhar,entregas,[id]/page}.tsx; guarda compartilhada mínima em lib/componentes se necessária; testes existentes e E2E google-planejamento.
**Interfaces:** histórico com aba=entregas e mesma semana; baseline de edição capturado na abertura; controller recebe dirty/pending dos filhos.
- [ ] Red: caminho visível Empresas recebidas e histórico; ida/volta/paginação mantêm semana.
- [ ] Red: fechar intocado não pergunta; editar/Cancelar/Escape/fora/Voltar exige decisão; continuar mantém campos; descartar não grava; pending bloqueia fechamento.
- [ ] Proteger links internos e histórico do navegador seguindo a guarda existente da ficha, sem guarda global indiscriminada.
- [ ] Aplicar critérios atualiza apenas rascunho semanal; erro conserva seleções; espelhamento enviado não é anunciado como cancelado.
- [ ] Green: DOM e E2E com mocks de Sheets/Google, sem integração externa.
- [ ] Revisão separada e commit.

## Task 6: Arquivo gerencial, grupos e retorno contextual

**Files:** novo src/lib/retorno-gestor.ts e testes; app/empresas/{lista,arquivadas/page,[id]/page,grupos/[id]/page,paginacao}.tsx; grupos/paginacao; entregas/coletas gerenciais e componentes compartilhados.
**Interfaces:** funções puras lerRetornoGestor(entrada:string|string[]|undefined):ContextoRetornoGestor|null, serializarRetornoGestor(contexto):string e urlRetornoGestor(contexto):string. Parâmetro de transporte retorno, conteúdo limitado e sem segredos. ContextoRetornoGestor é união fechada de origens internas (empresas/arquivo/grupo/coleta/WhatsApp); parser e serializador puros com limites, UUIDs e páginas validados, recusando externos/duplicados/controles. Callers usam URLs locais reconstruídas. Google e WhatsApp adicionam seus campos fechados nas tarefas respectivas.
- [ ] Red: 51 listas arquivadas, gruposPagina independente de pagina; busca/limpeza/paginadores conservam os parâmetros apropriados.
- [ ] Red: arquivo filtrado página2→ficha→voltar preserva recorte; vazio limpa somente q; página fora do fim oferece primeira página sem inventar total.
- [ ] Red: grupo arquivado→ficha→grupo mantém origem do arquivo; breadcrumb não cruza para ativas.
- [ ] Red: coleta com semana/vendedor/estado→página2→ficha→voltar mantém consulta; ficha Histórico→coleta→Histórico mantém aba.
- [ ] Implementar props opcionais nos componentes compartilhados de entrega/abas preservando defaults de vendedor. Autorizar cada leitura independentemente do contexto.
- [ ] Green: parsers/URLs, páginas/listas, integrações necessárias e E2E de arquivo/contexto.
- [ ] Revisão separada e commit.

## Task 7: Retorno à conversa correta do gestor

**Files:** app/whatsapp/{page,visao-geral,painel,configuracao/page}.tsx; retorno-gestor da Task6 e testes.
**Interfaces:** contexto WhatsApp validado preserva vendedor,busca,categoria,fonteId+conversa,painel móvel; não persistir mensagens/segredos/seleção de mutação.
- [ ] Red: fontes distintas com mesmo telefone/conversa não se confundem; abrir ficha e voltar/reload conserva recorte e seleção.
- [ ] Red: alvo em página posterior aguarda carga existente; fonte removida/conversa ausente não cai silenciosamente na primeira conversa.
- [ ] Implementar retorno contextual e de configuração, com limites de parâmetros; sem integração nova nem promessa de rolagem exata.
- [ ] Conferir duplicação de acessos G08 no celular/desktop; manter ação principal e rótulos consistentes sem retirar acesso necessário.
- [ ] Green: painel DOM e E2E com Evolution de teste.
- [ ] Revisão separada e commit.

## Task 8: Usuários, autenticação e controles comuns

**Files:** app/usuarios/{page,tabela,vendedores/[id]/page}.tsx; src/components/crm/{shell,caminho}.tsx; app/trocar-senha/{page,formulario}.tsx; logout se reprodução exigir; administrativos de grupos/limites somente conforme reproduções.
- [ ] Red: filtros de usuários entram na URL e voltam do perfil/paginação/reload; não transportar senha provisória nem seleção administrativa.
- [ ] Implementar breadcrumbs de atendimento/consulta Sem interesse e contexto gerencial da Task6.
- [ ] Como melhoria de UX autorizada pelo pedido atual, oferecer Trocar senha no shell; Sair POST na troca obrigatória; Voltar ao CRM somente na voluntária. Preservar guardas/sucesso em /.
- [ ] Reproduzir C04/G09/G10 isoladamente (lento, falha antes da escrita e resposta perdida). Corrigir se reproduzido, sem anunciar hipótese como bug nem incentivar repetição de mutação desconhecida.
- [ ] Proteger alterações não salvas também nos editores administrativos relevantes (usuários, metadados de grupos, limite, vínculo WhatsApp), preservando bloqueio pending existente. Guardar só intenção/estado em memória para senha; nunca persistir segredos.
- [ ] Auditar C05/C06 pelos consumidores; não mudar tipo padrão de todos os Button ou travas sem evidência de falha.
- [ ] Green: DOM shell/caminho/usuários/auth/admin, integrações de autorização e jornadas em contas fictícias.
- [ ] Revisão separada e commit.

## Task 9: Validação integrada e entrega

**Files:** testes E2E novos/revisados, documentação de validação com matriz rastreável dos três mapas.
- [ ] Executar typecheck, lint, db:checar, unitários, integrações, build sem env e E2E completos do projeto.
- [ ] Jornadas isoladas com dados persistidos conferidos: interesse/retorno, Sem interesse/retomar, primeira venda/recompra/replay, arquivo51listas, ida/volta por origem, Google histórico/edição, usuários e autenticação.
- [ ] Browser: 390/820/1280px, claro/escuro, teclado/foco, vazio/preenchido, cancelamentos, pending, erros e resposta perdida. Capturar evidência local e apontar limites reais.
- [ ] Revisão final independente de código e segurança contextual; corrigir e testar regressões relevantes.
- [ ] Atualizar ledger e matriz separando confirmado, melhoria, hipótese reproduzida/não reproduzida.
- [ ] Conferir branch/working tree, commits, push somente da branch autorizada e criar PR contra main com descrição verificável.
- [ ] Acompanhar CI até verde; não mergear nem publicar.

### Complementos obrigatórios da verificação final

- [ ] Antes de push, vercel.json deve desabilitar deployment automático somente desta branch codex/simplificar-crm-fluxos, preservando main:false e demais configurações. Nenhuma publicação manual.
- [ ] Exercitar hipótese de busca Banco com resposta perdida e reload no mock: conferir recuperação/histórico e cota, sem presumir duplicação.
- [ ] Reexecutar suíte global do HEAD final com carga local limitada; registrar timeout histórico e warning Vite preexistente separadamente de regressões.
