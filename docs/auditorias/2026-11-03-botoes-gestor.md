# Auditoria de ações do gestor

Data: 03/11/2026. Método: leitura de código e dos nomes/assertivas dos testes existentes. Escopo: `app/empresas/**`, `app/usuarios/**`, `app/gestao/**`, `app/whatsapp/**` e componentes/actions chamados por essas telas. Nenhuma integração, envio, busca paga, mutação de usuário ou execução de teste foi disparada. Este documento não comprova funcionamento em navegador ou produção.

Foram lidos `PREFERENCIAS.md` e `REGRAS.md`. O grafo Graphify não existe neste checkout; não foi instalado nem gerado, respeitando o escopo de leitura. Referências de linha correspondem ao working tree desta auditoria.

## Critérios

- **L**: handler/destino existe e é coerente por leitura. Ainda requer execução isolada para comprovar comportamento real.
- **B**: defeito de destino ou cobertura de navegação confirmado pelo código.
- **U**: incoerência de experiência confirmada; prioridade/solução depende do desenho aprovado.
- **P**: hipótese ou comportamento que depende de verificação no navegador. Não é bug confirmado.

Cada linha abaixo representa uma ação distinta; botões repetidos em linhas de dados compartilham a mesma ação parametrizada. Campos são inventariados quando alteram filtro, seleção ou payload. Fechar, Escape e clique externo dos diálogos são agrupados quando têm o mesmo efeito.

## Achados priorizados

| ID | Prioridade / classe | Evidência e consequência | Ajuste especificado / aceite |
|---|---|---|---|
| G01 | P2 / B | `app/empresas/arquivadas/page.tsx:17` chama `listarGrupos(..., 1, true)`; `src/features/empresas/grupos.ts:54` aplica `LIMIT 50`. A tela renderiza todos os retornados sem paginação de listas (`:21-28`); a paginação em `:33` é somente de empresas. A 51ª lista arquivada e seguintes não têm caminho pela listagem. | Paginar listas arquivadas com parâmetro separado da página de empresas e preservar os dois estados. Aceite com mais de 50 listas arquivadas, inclusive ida ao detalhe e volta. Não afirmar que há esse volume no banco real. |
| G02 | P2 / B | `app/empresas/arquivadas/page.tsx:32` reutiliza `<Lista linhas={r.linhas} />`. O vazio de `app/empresas/lista.tsx:15-17` mostra “Ver todas” para `/empresas`, a base ativa, embora o usuário esteja consultando o arquivo. Uma busca arquivada sem resultado troca de universo ao recuperar. | Tornar explícito o caminho de recuperação da lista e usar `/empresas/arquivadas` com rótulo “Limpar busca do arquivo”. Aceite mantém a pessoa no arquivo e remove apenas o termo. |
| G03 | P2 / B | O mesmo reuso omite `consulta` (`arquivadas/page.tsx:32`). A ficha gerada em `lista.tsx:22` não recebe termo/página. A ficha arquivada sempre volta para `/empresas/arquivadas` sem query (`app/empresas/[id]/page.tsx:37`). A lista paginada filtrada se perde em toda ida à ficha. | Transportar origem e query ao detalhe; o retorno deve recuperar termo e página do arquivo. Aceite: arquivo com busca e página 2 → ficha → voltar mantém ambos. |
| G04 | P2 / U | Links à ficha a partir de grupo (`app/empresas/grupos/[id]/page.tsx:46`), entrega Google (`app/fila/google/entrega.tsx:44`) e WhatsApp (`app/whatsapp/painel.tsx:249,266`) enviam somente o ID. O botão da ficha volta à lista global em `app/empresas/[id]/page.tsx:37,42`. O detalhe existe, mas a tarefa de origem desaparece. | Padronizar origem interna validada para voltar ao grupo/pedido/conversa com seus filtros. Aceite por origem, incluindo reload do detalhe. Não aceitar URL externa arbitrária em parâmetro de retorno. |
| G05 | P2 / U | Lista Google cria detalhes sem vendedor/estado (`app/empresas/google/page.tsx:63`; `app/fila/google/entregas.tsx:19`). A volta no detalhe reconstrói só `semana=dia` (`app/empresas/google/[id]/page.tsx:17`). Filtragem por vendedor e situação é descartada. | Preservar semana, vendedor e situação na ida, paginação do detalhe e volta. Aceite compara URL e resultados antes/depois. |
| G06 | P2 / U | Arquivo → “Ver lista” (`arquivadas/page.tsx:25`) abre detalhe cujo breadcrumb aponta a `/empresas/grupos?pagina=1` (`grupos/[id]/page.tsx:34`), lista de grupos ativos; o botão secundário vai ao arquivo, mas perde query. | Breadcrumb e volta devem refletir Arquivo → Lista arquivada, com query de origem. Aceite não atravessa a base ativa para voltar. |
| G07 | P3 / U | `app/usuarios/tabela.tsx:20-22` guarda filtros somente em estado local; “Ver perfil” navega a `/usuarios/vendedores/:id` (`:47`) e “Voltar para Usuários” usa `/usuarios` (`vendedores/[id]/page.tsx:31`). A volta explícita reinicializa a busca/filtros. | Persistir filtros na URL ou estado de navegação estável e devolver ao mesmo recorte. Aceite após ida ao perfil, retorno e reload. |
| G08 | P3 / U | WhatsApp oferece duas ações para o mesmo `/empresas/:id`: “Ver empresa” no cabeçalho e “Abrir ficha da empresa” no contexto (`painel.tsx:249,266`). Empresas também oferece “Ver empresa” modal e “Ficha administrativa” página (`lista.tsx:21-22`). O primeiro par é duplicação; o segundo são destinos diferentes com distinção técnica pouco explicada. | Definir uma ação principal por contexto; se mantida duplicação por responsividade, usar rótulo consistente. Na listagem, decidir rótulos que comuniquem consulta rápida versus histórico/gestão. Não remover ação sem considerar layout móvel. |
| G09 | P3 / P | `FormularioLimite` usa campos não controlados, action nativa e mensagem de erro (`app/empresas/busca/limite.tsx:14-21`), diferente do formulário de vínculo que preserva explicitamente FormData ao falhar (`whatsapp/configuracao/formulario.tsx:20-24`). O teste existente de limite simula somente sucesso. | Verificar no navegador se retorno de erro mantém limite editado e checkbox. Se houver reset, preservar rascunho por abordagem consistente com vínculo. Aceite cobre falha de validação, falha de transporte, retry e revalidação. Não classificado como bug sem reprodução. |
| G10 | P3 / P | Actions de usuários e grupos convertem falhas de domínio em mensagens, mas exceções de infraestrutura propagam (`usuarios/acoes.ts:23-30,50-60`; `grupos/acoes.ts:16-30,40-51`; repositório de grupos relança em `src/features/empresas/grupos.ts:118,150`). Os formulários não têm catch local. | Injetar falha isolada e verificar boundary, preservação de rascunho e caminho de retomada. Se a tela perder contexto, retornar falha sanitizada com orientação de conferir estado antes de repetir mutação incerta. Não alegar duplicação efetiva sem execução. |

Não foi identificado, neste escopo e por leitura, botão renderizado sem handler ou link apontando a rota inexistente. Não foi identificado formulário de mutação sem action. O formulário Google sem `action` explícita (`google/page.tsx:47`) usa GET para a própria rota; seu destino é determinável. A retirada de importação manual é intencional e protegida, não um botão quebrado.

## Inventário: Empresas, arquivo e ficha

| Ação / controle | Referência | Destino/efeito e feedback atual | Esperado / status |
|---|---|---|---|
| Arquivo | `app/empresas/page.tsx:29,44` | Link `/empresas/arquivadas`; aparece também no estado de filtro inválido. | Abrir consulta histórica; L. |
| Busca de empresas | `app/empresas/page.tsx:29,44` | Link `/empresas/busca`; limites e histórico, sem executar fornecedor. | Abrir gestão de aquisição; L. |
| Listas de empresas | `app/empresas/page.tsx:29,44` | Link `/empresas/grupos`. | Abrir origens compartilhadas; L. |
| Campo de busca | `app/empresas/formulario.tsx:76` | `q`, até 100 caracteres; submetido por Buscar/Enter. | Filtrar nome/CNPJ na página 1; L. |
| CNAE | `app/empresas/formulario.tsx:87` | Select `cnae`; aplicado ao submeter. | Combinar com demais filtros; L. |
| Estado | `app/empresas/formulario.tsx:39-48,87` | Limpa cidade/bairro e faz `requestSubmit`; mantém os demais campos. | Recalcular dependentes e reiniciar página; L. |
| Cidade | `app/empresas/formulario.tsx:39-48,87` | Desabilitada sem UF; limpa bairro e submete. | Respeitar dependência UF → cidade; L. |
| Bairro | `app/empresas/formulario.tsx:87` | Desabilitado sem cidade; aplicado ao submeter. | Restringir bairro da cidade escolhida; L. |
| Buscar | `app/empresas/formulario.tsx:34-36,67,71` | Intercepta GET, monta URL com FormData e `router.push`; não envia página anterior. Sem indicador pending local. | Mostrar resultados/erro de consulta; L; velocidade/foco P. |
| Limpar filtros | `app/empresas/formulario.tsx:51-54,72` | Reset visual em clique comum e Link `/empresas`; clique modificado mantém comportamento nativo. | Limpar recorte; L. |
| Recuperar filtro inválido/erro/vazio | `app/empresas/page.tsx:32,49`; `lista.tsx:15` | Links globais `/empresas`. | Coerente em ativas; L. No arquivo, B G02. |
| Anterior / Próxima | `app/empresas/paginacao.tsx:11,21` | `enderecoEmpresas` preserva termo e quatro filtros; limites aparecem desabilitados. | Navegar recorte sem mutação; L. |
| Ver empresa | `app/empresas/lista.tsx:21`; `src/components/crm/card-empresa.tsx:16` | `setReferencia` abre `EmpresaDialogo`, action `lerDetalhesEmpresaAcao`. Loading, erro sanitizado, retry; mudança/fechamento invalida resposta antiga. | Consulta rápida, sem assumir atendimento; L. |
| Fechar consulta / tentar novamente | `src/components/crm/empresa-dialogo.tsx:17,35` | Fecha pelo Dialog ou repete leitura incrementando tentativa; restaura foco se origem existir. | Recuperar sem consulta paga; L; foco real P. |
| Ficha administrativa | `app/empresas/lista.tsx:22` | `/empresas/:id` mais query de `consulta`, quando recebida. | Abrir histórico e voltar ao recorte; L em ativas; B G03 no arquivo; U G08. |
| Empresas ativas | `app/empresas/arquivadas/page.tsx:20` | Link `/empresas`. | Troca explícita de universo; L. |
| Ver lista arquivada | `app/empresas/arquivadas/page.tsx:25` | `/empresas/grupos/:id`; apenas as primeiras 50 listas são carregadas. | Abrir histórico e voltar ao arquivo; B G01; U G06. |
| Busca / Consultar arquivo | `app/empresas/arquivadas/page.tsx:29` | GET `/empresas/arquivadas?q=...`, reinicia página. | Buscar só arquivadas; L. |
| Anterior / Próxima do arquivo | `app/empresas/arquivadas/page.tsx:18,34-36` | URL mantém `q`; sem efeitos de dados. | Preservar termo; L. |
| Voltar para empresas na ficha | `app/empresas/[id]/page.tsx:37,42` | Ativas recompõem filtros/página; arquivadas voltam à raiz do arquivo. | Preservar origem; B G03 / U G04. |
| Abas Dados / Histórico | `src/components/crm/abas-ficha.tsx:7` | Tabs locais, ambas montadas, começa em Dados. Sem escrita. | Teclado e conteúdo correspondente; L; navegação assistiva P. |
| Ver coleta na ficha | `src/components/crm/historico-google.tsx:10` | `/empresas/google/:pedidoId`. | Abrir a origem comercial; L; volta à ficha não preservada, U G04. |
| Endereço antigo de importação | `app/empresas/importar/page.tsx:5-6`; `acao.ts:15-17` | Guarda gestor e redirect `/empresas`; action antiga retorna desativação e não processa arquivo. | Não voltar a permitir importação por aba antiga; L. |

A ficha do gestor é de consulta: não há botão de ligar, salvar atendimento, enviar WhatsApp, editar cadastro, vender ou arquivar. Telefones/e-mails na ficha são texto. Isso corresponde ao desenho de consulta observado, não uma falha de destino. Sócios também são dados sem controle de escrita.

## Inventário: Busca de empresas

| Ação / controle | Referência | Destino/efeito e feedback atual | Esperado / status |
|---|---|---|---|
| Voltar para Empresas | `app/empresas/busca/page.tsx:27` | `/empresas`. | Retornar à consulta ativa; L. |
| Editar limite diário | `app/empresas/busca/limite.tsx:17` | Campo numérico 0–10000, obrigatório; payload `limite`. | Preparar limite por vendedor; L; preservação no erro P G09. |
| Pausar buscas | `app/empresas/busca/limite.tsx:18` | Checkbox `pausado`; só persiste ao salvar. | Bloquear novas aquisições/importações conforme regra do repositório; L por encadeamento, efeito real P. |
| Salvar limite | `app/empresas/busca/limite.tsx:19`; `acoes.ts:9-22` | Guarda gestor; `definirLimite`, revalida busca gestora e vendedor. Botão/campos disabled e “Salvando…”; erro/sucesso inline. | Persistir, confirmar e permitir retry; L; G09 pendente. |
| Ver busca | `src/components/crm/historico-buscas.tsx:12`; `busca-dialogo.tsx:21-46` | Action vinculada ao ID, abre Dialog e carrega conteúdo persistido. Closing invalida resposta; reabrir lê de novo. | Consultar sem repetir aquisição nem consumir limite; L. |
| Tentar novamente do modal | `src/components/crm/busca-dialogo.tsx:45` | Repete `lerDetalheBuscaAcao`; erro sanitizado e loading. | Retry somente de leitura; L. |
| Filtros usados (abrir/fechar) | `app/empresas/busca/conteudo.tsx:23`; `src/components/crm/card-detalhes.tsx:12` | Toggle local de detalhes com `aria-expanded` e região. | Expandir critérios sem executar busca; L. |
| Ver mais / Ver menos da empresa retornada | `src/components/crm/empresa-encontrada.tsx:24` | Toggle local de dados cadastrais. | Mais dados sem mutação/consulta paga; L. |
| Ver lista importada | `app/empresas/busca/page.tsx:38`; `conteudo.tsx:35` | `/empresas/grupos/:grupoId`, só se houver vínculo. | Abrir grupo correspondente; L; origem da busca perdida na volta, U G04/G06. |
| URL histórica `?busca=` | `app/empresas/busca/page.tsx:24-25,33` | Lê busca no servidor; inexistente vira 404; continua suportada além do modal. | Deep link de leitura; L; duplicação de apresentação existe, não duplicação de execução. |

`lerDetalheBuscaAcao` autentica antes da leitura (`detalhe-acao.tsx:14-24`), usa papel da sessão e dispensa limite de vendedor para gestor. A interface do gestor não oferece “repetir busca” nem importar resultados manualmente. Estado reservada orienta fechar e reabrir; falha mostra motivo e não reenvia fornecedor automaticamente (`conteudo.tsx:29-30`).

## Inventário: listas de empresas

| Ação / controle | Referência | Destino/efeito e feedback atual | Esperado / status |
|---|---|---|---|
| Arquivo / Google / Todas as empresas | `app/empresas/grupos/page.tsx:17` | `/empresas/arquivadas`, `/empresas/google`, `/empresas`. | Acesso explícito aos três destinos; L. |
| Consultar coletas do Google / primeira página | `app/empresas/grupos/page.tsx:25-27` | Vazio real aponta Google; página além do fim aponta `/empresas/grupos`. | Recuperação específica; L. |
| Ver lista | `app/empresas/grupos/page.tsx:34` | `/empresas/grupos/:id?gruposPagina=:pagina`. | Preservar página da listagem; L. |
| Paginação das listas / empresas do grupo | `app/empresas/grupos/apresentacao.tsx:12-20` | Preserva `gruposPagina` no detalhe; anteriores/próximas disabled nos extremos. | Manter duas paginações independentes; L. |
| Voltar às listas em recusa | `app/empresas/grupos/[id]/page.tsx:30` | `/empresas/grupos`; recurso ausente usa 404. | Saída recuperável; L. |
| Breadcrumb Listas de empresas | `app/empresas/grupos/[id]/page.tsx:34` | `/empresas/grupos?pagina=:gruposPagina`. | Correto em lista ativa; U G06 em arquivada. |
| Todas as empresas / Arquivo de empresas | `app/empresas/grupos/[id]/page.tsx:36` | Escolhe universo pelo estado arquivado. | Abrir universo correto; L; query origem perdida, U. |
| Renomear | `app/empresas/grupos/controles.tsx:15,22-24` | Abre diálogo e campo nome controlado de até 100 caracteres. | Editar nome antes de confirmar; L. |
| Desativar grupo / Reativar grupo | `app/empresas/grupos/controles.tsx:16,22-24` | Abre confirmação com retrato do impacto e aviso sobre carteiras, reservas e outras listas. | Explicar alcance da mutação; L. |
| Cancelar / fechar diálogo | `app/empresas/grupos/controles.tsx:38-40,56` | Fecha sem action; durante pending não há X, Escape/clique externo bloqueados e Cancelar disabled. | Evitar duplo envio e fechamento acidental; L; foco real P. |
| Salvar nome / Confirmar situação | `app/empresas/grupos/controles.tsx:33-36,45-57`; `acoes.ts:10-31` | `alterarGrupoAcao` guarda gestor e valida tipo; renomeia ou altera situação; revalida grupos/fila; sucesso fecha. Erro de domínio permanece no diálogo; botão pending disabled. | Confirmar uma mutação e permitir correção; L; exceção infraestrutura P G10. |
| Corrigir contexto da lista | `app/empresas/grupos/metadados.tsx:21` | `<details>` local revela formulário. | Expandir editor sem mutação; L. |
| Resumo / origem / critérios | `app/empresas/grupos/metadados.tsx:27-31` | Textareas controlados; resumo/origem obrigatórios; critérios opcional. Limites aparecem em ajuda, validados no servidor, sem `maxLength` no campo. | Informar limites e preservar rascunho; L; melhoria de prevenção de erro. |
| Salvar contexto | `app/empresas/grupos/metadados.tsx:23,34-38`; `acoes.ts:34-53` | Valida 500/500/2000, guarda gestor, atualiza e revalida consumidores. Fieldset disabled em pending; sucesso e erro inline. | Conservar dados após erro e mostrar novo contexto; L; exceção P G10. |
| Voltar à primeira página do grupo | `app/empresas/grupos/[id]/page.tsx:42` | Detalhe sem `pagina`, mantém `gruposPagina`. | Recuperar página fora do intervalo; L. |
| Nome da empresa | `app/empresas/grupos/[id]/page.tsx:46` | Ficha `/empresas/:id`. | Abrir cadastro; U G04 pela volta. |
| Outras listas | `app/empresas/grupos/[id]/page.tsx:53` | Outro grupo com mesma origem `gruposPagina`. | Abrir origem alternativa; L; não preserva grupo anterior como breadcrumb. |

Grupos arquivados suprimem renomeação, situação e editor de contexto (`grupos/[id]/page.tsx:35,37`). Não há “Reativar” disponível no arquivo histórico. Ausência é intencional e tem teste.

## Inventário: Google do gestor

| Ação / controle | Referência | Destino/efeito e feedback atual | Esperado / status |
|---|---|---|---|
| Ver semana atual (semana inválida/vazio) | `app/empresas/google/page.tsx:25,55` | `/empresas/google`, remove semana e filtros. | Recuperar semana válida; L. |
| Ver listas compartilhadas | `app/empresas/google/page.tsx:35` | `/empresas/grupos`. | Consultar origens compartilhadas; L. |
| Pausar / retomar novas buscas | `app/empresas/google/controle-agente.tsx:11-16`; `acoes.ts:7-22` | Envia vendedor e inverso de pausado; guarda gestor, valida booleano, `definirAgente`, revalida três rotas. Indisponível e pending disabled, mensagens inline. | Pausar novas execuções, deixando iniciadas concluir conforme ajuda; L; efeito real do agente P. |
| Semana anterior / próxima | `app/fila/google/entregas.tsx:22-33` | Desloca sete dias; mantém vendedor/estado em URL. | Navegar semana mantendo filtros; L. |
| Select vendedor / situação | `app/empresas/google/page.tsx:47-51` | Campos GET; semana oculta mantida. | Recortar equipe e estado; L. |
| Aplicar filtros | `app/empresas/google/page.tsx:47` | GET na própria rota com semana/vendedor/estado. Sem indicador pending local. | Aplicar recorte; L; percepção de loading P. |
| Sincronizar novamente | `app/empresas/google/page.tsx:59`; `app/fila/google/sincronizar.tsx:10-19`; `acoes.ts:60-68` | Só em plano não sincronizado. Autentica usuário, verifica `podeSincronizar`; chama `sincronizarPedido`, que pode escrever na planilha externa; revalida três rotas. Pending, erro e sucesso inline. | Retry de sincronização, não coleta de empresas; L por leitura. Integração externa não exercitada. |
| Ver pedido | `app/empresas/google/page.tsx:63` | `/empresas/google/:id`. | Abrir histórico solicitado; L; U G05. |
| Ver empresas e histórico | `app/fila/google/entregas.tsx:19` | Mesmo detalhe do pedido, na seção entregas. | Acesso contextual ao mesmo destino; L; duplicação justificada por seção, U G05. |
| Ver planejamento nos vazios | `app/fila/google/entregas.tsx:12`; `entrega.tsx:37` | Semana atual na lista vazia; semana do plano no detalhe vazio. | Retornar a planejamento coerente; L; filtros não preservados U G05. |
| Voltar para planejamentos | `app/empresas/google/[id]/page.tsx:17` | `/empresas/google?semana=:dia`. | Retornar recorte de origem; U G05. |
| Ver critérios / evidências / dados da origem | `app/fila/google/entrega.tsx:31,35,46` | `<details>` locais; não fazem chamada externa. Evidências/dados brutos só no gestor. | Inspecionar dados e comprovação sem mutação; L. |
| Arquivo original / validado / resultado da rodada | `app/fila/google/entrega.tsx:33,35` | Google Drive em nova aba com ID codificado e `rel=noreferrer`. | Abrir comprovante; L; existência/permissão do arquivo P. Não acessado. |
| Ver ficha e histórico | `app/fila/google/entrega.tsx:44` | `/empresas/:id` só com `empresa_id`. | Abrir empresa confirmada; U G04 pela volta. |
| Página anterior / próxima dos resultados | `app/fila/google/entrega.tsx:49-52`; `app/empresas/google/[id]/page.tsx:13-14` | `?pagina=`, limitada a 1–100 pelo parser. | Paginar resultados; L; contexto de origem não transportado U G05. |

## Inventário: usuários e perfil do vendedor

| Ação / controle | Referência | Destino/efeito e feedback atual | Esperado / status |
|---|---|---|---|
| Buscar usuário / papel / situação | `app/usuarios/tabela.tsx:20-29,36-38` | Estado local combina filtros por nome/email, papel e atividade. | Recorte imediato sem consulta externa; L; retorno U G07. |
| Limpar filtros (painel/vazio) | `app/usuarios/tabela.tsx:32,35,51` | Limpa os três estados. | Recuperar lista; L. |
| Novo usuário | `app/usuarios/formulario-criar.tsx:16-19` | Abre diálogo local. | Criar acesso de forma explícita; L. |
| Nome / email / papel novo | `app/usuarios/formulario-criar.tsx:36-40` | Inputs controlados e radios nativos; disabled pending. | Payload preservado para correção; L. |
| Criar usuário | `app/usuarios/formulario-criar.tsx:27-30,35,43`; `acoes.ts:21-33` | Guarda gestor, valida no serviço, cria senha provisória, revalida lista; sucesso mostra senha uma vez, erro inline. | Criar e entregar senha manualmente; L; infraestrutura P G10. |
| Cancelar/fechar criação | `app/usuarios/formulario-criar.tsx:17,31-32,43` | Fecha sem enviar; desmontagem descarta segredo. Pending bloqueia Cancelar/Escape/exterior/X. | Evitar submissão acidental e manter segredo efêmero; L. |
| Ver perfil | `app/usuarios/tabela.tsx:47` | Só vendedor ativo; `/usuarios/vendedores/:id`. | Abrir perfil autorizado; L; filtros perdidos U G07. |
| Nova senha provisória | `app/usuarios/tabela.tsx:47`; `linha.tsx:15,31,42-46` | Abre confirmação. Action nova_senha invalida credencial/sessões por serviço; mostra senha após sucesso. | Expor consequência antes de confirmar; L por cadeia de código; DB real não alterado. |
| Tornar gestor / Tornar vendedor | `app/usuarios/linha.tsx:16,32,44` | Confirma com novo papel em hidden; servidor revalida autorização e repositório. | Alterar papel do alvo indicado; L. |
| Desativar / Reativar | `app/usuarios/linha.tsx:17,33`; `src/features/usuarios/regras.ts:16-18` | Regras ocultam ações próprias e só reativar aparece para inativo; confirmado por action. | Não editar própria autoridade; L. |
| Confirmar ação da linha | `app/usuarios/linha.tsx:23-29,46`; `acoes.ts:39-79` | Allowlist de quatro ações, guarda gestor, revalida `/usuarios`; erro inline; sucesso fecha salvo senha pendente de entrega. | Uma ação por confirmação e foco restaurado; L; infraestrutura P G10. |
| Cancelar/fechar ação | `app/usuarios/linha.tsx:37-39,46`; `tabela.tsx:52-54` | Bloqueia durante pending; restaura foco ao acionador ou à busca se linha sumir. | Cancelar sem mutação; L; foco assistivo real P. |
| Copiar senha | `app/usuarios/senha.tsx:8-11,17` | Clipboard API; sucesso em status; falha orienta copiar manualmente. | Nunca depender só de clipboard; L. |
| Concluir senha | `app/usuarios/senha.tsx:17` | Fecha diálogo e desmonta segredo; não envia email. | Confirmar leitura e descartar exibição; L. |
| Voltar para Usuários | `app/usuarios/vendedores/[id]/page.tsx:31` | `/usuarios`. | Voltar à lista; U G07. |
| Atualizar perfil | `app/usuarios/vendedores/[id]/page.tsx:29,32` | `<a>` para mesma rota com página atual. | Atualizar leitura sem escrita; L. |
| Primeira página / Anterior / Próxima do perfil | `app/usuarios/vendedores/[id]/page.tsx:44,53-54` | URL de perfil com `pagina`; vazio fora do intervalo oferece reset. | Navegar vínculos; L. |

Empresas e atendimentos do perfil são texto sem link por decisão explícita em `app/usuarios/vendedores/[id]/page.test.tsx:17`. Não tratá-los como botões mortos. O dashboard também não torna nomes de vendedores clicáveis no código atual.

## Inventário: Gestão

| Ação / controle | Referência | Destino/efeito e feedback atual | Esperado / status |
|---|---|---|---|
| Atualizar | `app/gestao/page.tsx:31` | Âncora `/gestao` recarrega dashboard; somente leitura. | Obter estado recente da equipe; L. |
| Tentar novamente no erro | `app/gestao/error.tsx:13` | Âncora `/gestao`, tenta novamente a leitura inteira. Não revela erro interno. | Recuperar falha; L; indisponibilidade real P. |

KPIs, equipe e atividade recente não são controles no código. O estado sem vendedor sugere Usuários em texto e não oferece atalho; é decisão atual testada em `app/gestao/page.test.tsx:12`, não handler ausente.

## Inventário: WhatsApp e vínculos

| Ação / controle | Referência | Destino/efeito e feedback atual | Esperado / status |
|---|---|---|---|
| Configurar vendedores | `app/whatsapp/page.tsx:20` | `/whatsapp/configuracao`; troca de rota descarta filtro atual. | Abrir gestão de vínculos; L; retorno contextual U G04. |
| Todos / filtro por vendedor | `app/whatsapp/visao-geral.tsx:27-28` | `/whatsapp` ou `?vendedor=:id`; servidor resolve fontes autorizadas e componente tem chave por filtro. | Não misturar conversas de fontes; L; integração real P. |
| Buscar conversa | `app/whatsapp/painel.tsx:178-183,216` | Filtra só conversas carregadas por nome, empresa, telefone e mensagem. Não altera seleção atual. | Busca local com alcance declarado; L; manter chat selecionado apesar de filtro é comportamento testado, não bug inferido. |
| Todas / Sem resposta / Não cadastradas | `app/whatsapp/painel.tsx:174-176,219` | Estado local combina com busca; pendente exclui grupos/broadcast; ausência exige cadastro ausente confirmado. | Filtrar recorte carregado; L. |
| Selecionar conversa | `app/whatsapp/painel.tsx:229` | Muda ID selecionado e painel móvel; agrupamento usa fonte+conversa, não só telefone. | Abrir conversa correta sem envio; L. |
| Voltar para conversas | `app/whatsapp/painel.tsx:89-92,248-249` | Troca painel móvel e restaura foco; mantém seleção e histórico. | Voltar sem recarregar mensagens; L; viewport/foco real P. |
| Ver empresa / Abrir ficha da empresa | `app/whatsapp/painel.tsx:249,266` | Mesmo `/empresas/:id`; só cadastro único encontrado. | Abrir cadastro correto; U G04/G08. |
| Rolar lista/topo das mensagens | `app/whatsapp/painel.tsx:222-228,250-257` | Dispara carga de histórico com trava, cursores e âncora de rolagem; também há carga automática e refresh. | Não duplicar páginas nem perder posição; L; desempenho real P. |
| Tentar novamente no histórico | `app/whatsapp/painel.tsx:271`; `historico-acao.ts:16,40` | Repete página/cursores, mantém dados, botão disabled carregando; erro sanitizado. Autentica gestor antes de consultar Evolution. | Retomar consulta incompleta; L; sem envio de mensagem. |
| Tentar novamente na falha da rota | `app/whatsapp/error.tsx:13` | `reset()` do boundary. | Reexecutar render de leitura; L. |
| Carregar imagem / áudio / documento / tentar novamente | `app/whatsapp/midia-mensagem.tsx:30-52,59-61` | GET privado `/whatsapp/midia/:id?conversa=&fonte=`, com AbortController; trata 413, sessão e indisponibilidade; blob local. | Baixar sob demanda com autorização; L; integração real P. |
| Ampliar imagem / fechar | `app/whatsapp/midia-mensagem.tsx:63-72` | Dialog usa mesmo blob e devolve foco ao trigger padrão. | Ampliar sem novo download; L; visual real P. |
| Controles do áudio | `app/whatsapp/midia-mensagem.tsx:74` | `<audio controls>` sem autoplay; erro reabre tentativa. | Reproduzir/pausar/avançar no arquivo local; L; codec P. |
| Baixar documento | `app/whatsapp/midia-mensagem.tsx:75` | Âncora `download` do blob; nome sanitizado em `:57`. | Salvar arquivo privado carregado; L; comportamento do navegador P. |
| Voltar ao WhatsApp | `app/whatsapp/configuracao/page.tsx:12` | `/whatsapp`; não restaura vendedor anterior. | Voltar à consulta; L; contexto U G04. |
| Selecionar vendedor / informar instância | `app/whatsapp/configuracao/formulario.tsx:26-34` | Só vendedores ativos; instância obrigatória até 100; campos disabled se nenhum vendedor ou pending. | Escolher alvo real antes de persistir; L. |
| Salvar ou substituir vínculo | `app/whatsapp/configuracao/formulario.tsx:20-36`; `acoes.ts:29-57` | Preserva FormData no erro; guarda gestor, valida UUID/instância; consulta instância via `lerPaginaMensagens` antes de salvar; revalida consulta e configuração. Pending, erro e sucesso inline. | Informar substituição e validar instância; L; consulta externa não exercitada. Não cria/envia mensagem. |
| Remover vínculo | `app/whatsapp/configuracao/formulario.tsx:42-45`; `acoes.ts:59-71` | Envia ID do vínculo, remove sem consultar Evolution; botão pending disabled; sucesso/erro inline. Conexão e histórico preservados. | Desassociar apenas vínculo; L; reversibilidade exige nova associação, sem confirmação adicional no código. |

Não há compositor, botão Enviar, chamada de envio de WhatsApp ou edição de mensagem neste painel. A remoção é a ação do vínculo, não exclusão da instância Evolution. Essas distinções precisam permanecer nos mockups.

## Cobertura existente e lacunas

Os testes abaixo foram localizados e lidos por busca/trechos, não executados nesta tarefa. Um arquivo de teste existente não comprova o estado atual do serviço externo.

| Área | Evidência de cobertura existente | Lacuna relevante para esta auditoria |
|---|---|---|
| Empresas ativas | `app/empresas/formulario.dom.test.tsx` cobre dependências, reset de página, novas props e clique modificado; `paginacao.test.tsx` conserva termo e quatro selects; `lista.test.tsx:37` conserva contexto da ficha. | Não cobre origem no arquivo e retornos provenientes de grupos/Google/WhatsApp. |
| Ficha do gestor | `app/empresas/[id]/page.test.tsx` cobre volta filtrada, inexistente e falha de histórico; `tests/e2e/empresa-perfil-gestor.spec.ts` existe; `socios-gestor.test.tsx` cobre guarda e separação dos documentos. | Ida/volta a partir de todas as origens e subabas, histórico indisponível com retry visível. |
| Arquivo | `app/empresas/arquivadas/page.test.tsx:14` cobre paginação das empresas com busca; `tests/e2e/arquivo-legado.spec.ts` existe. | Mais de 50 listas, vazio de busca continua no arquivo, arquivo → ficha → volta e breadcrumb de lista arquivada. |
| Busca | `app/empresas/busca/detalhe-acao.test.tsx` cobre sessão, identidade, leitura protegida e ausência de nova consulta; `limite.dom.test.tsx` só simula sucesso/revalidação. `src/components/crm/busca-dialogo.dom.test.tsx` existe. | Falha do limite preserva rascunho; ler modal após estado reservada; erro de transporte e rota de retorno da lista importada. |
| Listas | `controles.dom.test.tsx` cobre cancelar, Escape, retry, foco e pending; `acoes.test.tsx` cobre guarda, erros de domínio e invalidação; `metadados.test.tsx` é renderização estática; `page.test.tsx` cobre páginas vazias, responsáveis e arquivo sem editor. | Falha de infraestrutura na mutação; sucesso/falha dinâmica do editor de metadados; fluxo completo de retorno a grupo e lista arquivada. |
| Google | `app/empresas/google/page.test.tsx:7` cobre filtros e ações renderizadas; `tests/e2e/google-agentes.spec.ts:46` cobre pausar/retomar e efeito no vendedor. Existem E2Es de planejamento/rodadas e integração de agentes/planilha. | Regresso conserva vendedor/estado, paginação conserva origem, links Drive com autorização real e falha de sincronização em ambiente isolado. |
| Usuários | `app/usuarios/usuarios.dom.test.tsx` cobre filtros, criação, erros, radios, segredo, clipboard, cancelamento e pending; `tests/e2e/usuarios-visual.spec.ts:12` cobre gestão com foco; `tests/integracao/usuarios.test.ts` e regras/serviço existem. | Volta do perfil conserva filtros; indisponibilidade infraestrutura durante mutação e conferência do resultado antes de retry. |
| Perfil vendedor | `app/usuarios/vendedores/[id]/page.test.tsx` cobre 404, 51 vínculos, página 2 e recuperação; E2E visual em `usuarios-visual.spec.ts:112`. | Regresso à lista filtrada. A ausência de links de empresa é explicitamente testada e não deve ser chamada de defeito. |
| Gestão | `app/gestao/page.test.tsx` cobre autorização, totais, vazios e falha; `estados.test.tsx` cobre loading e erro; `tests/e2e/gestao.spec.ts` existe. | Atualização e recuperação com serviço isoladamente indisponível; atalhos novos seriam proposta de produto. |
| WhatsApp | `painel.dom.test.tsx` tem cobertura extensa de fontes, cursores, busca, seleção, offline/visibilidade, âncora, retries e indicadores; `midia-mensagem.dom.test.tsx` cobre blob, ampliar, áudio/documento, erro, cancelamento e foco; `midia/[id]/route.test.tsx` cobre guarda e mídia privada; `configuracao/formulario.dom.test.tsx` e `acoes.test.tsx` cobrem preservar campos, validar instância, substituir e remover. | Ida à ficha e volta para a mesma conversa/fonte; downloads e codecs em browser real; disponibilidade/permissões Evolution não exercitadas aqui. |

## Aceites para os mockups e revisão em navegador

1. Mostrar a origem em todo detalhe e um retorno que preserve o recorte: empresa ativa, arquivo, grupo, pedido Google ou conversa.
2. Desenhar vazio do arquivo com ação de limpar apenas sua própria busca; reservar “Empresas ativas” à troca explícita de universo.
3. Separar paginação de listas arquivadas e paginação de empresas; cobrir volume acima de 50 e páginas fora do intervalo.
4. Conservar semana/vendedor/estado ao abrir pedido Google e ao paginar seus resultados.
5. Rotular ações de consulta rápida e ficha completa de modo consistente; avaliar repetição de ações na tela larga e na móvel.
6. Mostrar estado normal, pendente, sucesso, falha de domínio e falha de infraestrutura nas mutações; em falha incerta orientar conferir o resultado antes de reenviar.
7. Verificar em ambiente isolado foco de Dialog, Escape, pending, campos preservados, mídia, teclado, toque e navegação de voltar. Não chamar integrações reais para validar o mockup.

Esta auditoria especifica ajustes; não modifica componentes, regras de negócio, testes ou dados.
