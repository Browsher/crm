# Auditoria de botões comuns e autenticação

Data: 2026-11-03. Método: leitura do código presente no worktree. Nenhuma ação real, alteração de produto, instalação ou alteração de teste foi realizada. As referências de linha apontam para essa leitura; não representam validação em navegador.

Foram lidos `PREFERENCIAS.md` e `REGRAS.md`. Não havia `graphify-out/graph.json`; a inspeção seguiu diretamente pelos arquivos, sem criar grafo nem instalar ferramentas. O executável local `node_modules/.bin/vitest.cmd` não existe, portanto os testes abaixo foram apenas inspecionados.

## Achados para a próxima implementação

| ID | Prioridade | Evidência e efeito | Encaminhamento |
| --- | --- | --- | --- |
| C-01 | P2, usabilidade confirmada por leitura | `src/components/crm/caminho.tsx:7` a `:24` não mapeia `/fila/sem-interesse` nem `/fila/atendimento/[id]`. Nessas telas o breadcrumb termina em “Prospecção” marcado como página atual, embora sejam subpáginas. As telas existem em `app/fila/sem-interesse/page.tsx:10` e `app/fila/atendimento/[id]/page.tsx:11`. | Acrescentar níveis e destino de retorno apropriados; verificar os dois caminhos por teclado e mobile. Os botões próprios de voltar das páginas existem, portanto não é bloqueio completo de retorno. |
| C-02 | P2, lacuna de navegação confirmada; decisão de produto | `src/components/crm/shell.tsx:54` a `:56` mostra apenas tema e identidade. Nenhum link de trocar senha é oferecido no shell. `/trocar-senha` funciona por URL e por redirecionamento de senha provisória (`app/login/acao.ts:20`), mas não há acesso visível para a troca voluntária. | Definir local do comando “Trocar senha” no perfil/menu e testar entrada e retorno. A ausência é constatada; a exigência de disponibilizar essa ação precisa ser confirmada pelo produto. |
| C-03 | P2, lacuna de saída confirmada; decisão de produto | `app/trocar-senha/page.tsx:9` a `:11`, `app/trocar-senha/formulario.tsx:37` e `src/components/crm/acesso.tsx:6`: a tela só oferece “Trocar senha”; não há sair nem retorno. Usuário com senha provisória que precisa mudar de conta é reenviado a essa tela ao abrir `/` (`src/server/autenticacao/acesso.ts:13`). | Disponibilizar saída POST nessa tela; para troca voluntária, avaliar também retorno. Não chamar a ausência de falha de autenticação: é uma lacuna de navegação/recuperação. |
| C-04 | P3, risco a validar em navegador | `src/components/crm/shell.tsx:35`: “Sair” é formulário POST nativo sem pending, bloqueio de repetição ou feedback local. `app/sair/route.ts:10` espera o encerramento antes de apagar o cookie e redirecionar. | Em rede lenta/falha, verificar repetição e erro percebido. Se reproduzido, oferecer pending e recuperação. Não houve logout real nesta rodada. |
| C-05 | P3, contrato do componente; dependente dos consumidores | `src/components/crm/card-empresa.tsx:16`: ação comercial não recebe disabled/pending; cada clique chama `aoAcionar`. | Agente/tela consumidora deve verificar trava antes de iniciar/retomar. Ausência de trava no componente não prova dupla mutação: o callback pode bloquear a operação. |
| C-06 | P3, prevenção; sem submissão indevida comprovada | `src/components/ui/button.tsx:40` a `:58`: Button nativo não define `type` padrão. Os usos comuns auditados explicitam `type`, usam `asChild` ou são triggers de primitivas fora de formulário. | Considerar padrão `type="button"` para a variante nativa, preservando submits explícitos e links compostos. Não modificar em massa sem conferir consumidores. |

Nenhuma falha crítica de navegação/autenticação foi confirmada por esta leitura. Ausência de reprodução em navegador deve ser mantida explícita na consolidação.

## Mapa de ações únicas

Legenda: **L** = destino/efeito conferido por leitura; **N** = comportamento interativo ainda pendente no navegador. Botões repetidos no menu desktop/mobile aparecem uma única vez, com as duas superfícies registradas.

### Shell, tema e localização

| Controle / superfície | Destino ou efeito | Evidência | Estado |
| --- | --- | --- | --- |
| Marca “CRM”, desktop e menu mobile | `/`, que exige usuário e encaminha gestor para `/gestao`, vendedor para `/meu-dia` | `src/components/crm/shell.tsx:26`; `app/page.tsx:5` | L; N: confirmar menu após navegação |
| Meu dia, vendedor desktop/mobile | `/meu-dia` | `src/components/crm/shell.tsx:16` | L; N |
| Prospecção, vendedor desktop/mobile | `/fila` | `src/components/crm/shell.tsx:16` | L; N |
| Funil, vendedor desktop/mobile | `/funil` | `src/components/crm/shell.tsx:16` | L; N |
| Carteira, vendedor desktop/mobile | `/carteira` | `src/components/crm/shell.tsx:16` | L; N |
| Início, gestor desktop/mobile | `/gestao` | `src/components/crm/shell.tsx:17` | L; N |
| Empresas, gestor desktop/mobile | `/empresas` | `src/components/crm/shell.tsx:17` | L; N |
| Coletas do Google, gestor desktop/mobile | `/empresas/google` | `src/components/crm/shell.tsx:17` | L; N |
| Listas, gestor desktop/mobile | `/empresas/grupos` | `src/components/crm/shell.tsx:17` | L; N |
| Usuários, gestor desktop/mobile | `/usuarios` | `src/components/crm/shell.tsx:17` | L; N |
| WhatsApp, gestor desktop/mobile | `/whatsapp` | `src/components/crm/shell.tsx:17` | L; N |
| Clique nos itens de navegação mobile | Fecha estado do Sheet ao navegar; item atual recebe `aria-current` | `src/components/crm/shell.tsx:29` a `:32` | L; N: transição, foco e retorno |
| Recolher / expandir barra lateral | Alterna largura desktop; mantém nomes acessíveis, `aria-expanded` e `aria-controls` | `src/components/crm/shell.tsx:41`; `src/components/crm/shell.module.css:44` | L; N: 820/821 px e foco |
| Menu do CRM | Abre Sheet mobile; descrição e título acessíveis | `src/components/crm/shell.tsx:46` a `:51` | L; N: abrir/fechar, Tab, Escape, clique fora |
| Fechar menu | Fecha Sheet via primitiva; rótulo “Fechar” | `src/components/ui/sheet.tsx:67` | L; N |
| Ir para o conteúdo | Foca alvo `#conteudo-fila`, com `tabIndex=-1` | `src/components/crm/shell.tsx:39`, `:59` | L; N: primeiro Tab e rolagem |
| Tema: Sistema / Claro / Escuro | Atualiza provider global; Sistema acompanha `prefers-color-scheme`; não há persistência após reload no código | `src/components/crm/shell.tsx:55`; `src/components/crm/tema.tsx:14` a `:29` | L; N: contraste, portal, reload |
| Breadcrumb CRM | `/` | `src/components/crm/caminho.tsx:30` a `:34` | L; N |
| Breadcrumb da área | `/${area}` quando há nível adicional; sem nível adicional é texto atual | `src/components/crm/caminho.tsx:29` a `:34` | L; N; C-01 |
| Breadcrumb Busca no Google, vendedor | `/fila/google`, nos detalhes da busca | `src/components/crm/caminho.tsx:9` | L; N |
| Breadcrumb Coletas do Google, gestor | `/empresas/google`, nos detalhes da coleta | `src/components/crm/caminho.tsx:11` | L; N |
| Breadcrumb Listas | `/empresas/grupos`, nos detalhes da lista | `src/components/crm/caminho.tsx:17` | L; N |
| Breadcrumb Localizar empresa | `/fila/localizar`, no perfil de empresa | `src/components/crm/caminho.tsx:23` | L; N |
| Perfil/avatar | Apenas informação; não é botão nem abre menu | `src/components/crm/shell.tsx:56` | L; C-02 |

### Autenticação e guardas

| Controle / situação | Destino ou efeito | Evidência | Estado |
| --- | --- | --- | --- |
| Entrar | E-mail/senha obrigatórios; submit via action, pending desabilita botão e anuncia estado ocupado; erros em Alert; sucesso grava cookie | `app/login/formulario.tsx:13` a `:33`; `app/login/acao.ts:12` | L; N: inválido, erro, rede lenta, Enter/clique repetido |
| Entrar com senha definitiva / provisória | `/` ou `/trocar-senha` | `app/login/acao.ts:20` | L; N: conta fictícia isolada |
| Abrir login já autenticado | `/`, sem renderizar formulário | `app/login/page.tsx:9` | L; N |
| Trocar senha | Senha atual obrigatória, nova senha com mínimo 8 e máximo 128; pending bloqueia submit; erros em Alert; sucesso `/` | `app/trocar-senha/formulario.tsx:13` a `:38`; `app/trocar-senha/acao.ts:14` a `:23` | L; N: erro, sucesso e repetição em conta fictícia; C-03 |
| Trocar senha com token ausente/inválido | `/login` | `app/trocar-senha/acao.ts:13`, `:20`; `app/trocar-senha/page.tsx:7` | L; N |
| Sair, desktop/mobile | POST `/sair`, encerra sessão se houver token, apaga cookie, redirect 303 `/login` | `src/components/crm/shell.tsx:35`; `app/sair/route.ts:7` a `:12` | L; N; C-04 |
| Abrir área sem sessão | `/login`; proxy confere presença e guarda valida sessão | `proxy.ts:6`; `src/server/autenticacao/guarda.ts:17`; `src/server/autenticacao/acesso.ts:11` | L; N: cookie expirado/inválido |
| Sessão com senha provisória | `/trocar-senha`; a própria troca usa exigência `sessao` e é permitida | `src/server/autenticacao/acesso.ts:12` a `:13`; `app/trocar-senha/page.tsx:7` | L; N |
| Vendedor acessa gestão | Retorno `/` e depois `/meu-dia` | `src/server/autenticacao/acesso.ts:14`; `app/page.tsx:6` | L; N |
| Gestor acessa área comercial | `/gestao` | `src/server/autenticacao/acesso.ts:15` | L; N |

Guardas dos layouts: gestor em `app/gestao/layout.tsx:7`, `app/empresas/layout.tsx:7`, `app/usuarios/layout.tsx:7`, `app/whatsapp/layout.tsx:7`; vendedor em `app/fila/layout.tsx:7`, `app/carteira/layout.tsx:7`, `app/meu-dia/layout.tsx:7`, `app/funil/layout.tsx:6`. As destinations dos menus existem no inventário de páginas e os papéis são coerentes por leitura.

### Empresa e composições compartilhadas

| Controle | Destino ou efeito | Evidência | Estado |
| --- | --- | --- | --- |
| Ver empresa | Callback com referência, abre consulta informativa no consumidor | `src/components/crm/card-empresa.tsx:16` | L; N: foco e empresa correta |
| Iniciar / retomar atendimento | Callback com ID e versão opaca quando situação permite | `src/components/crm/card-empresa.tsx:11`, `:16`; `src/lib/empresa-visual.ts:25` a `:27` | L; N: bloqueio de repetição no pai; C-05 |
| Continuar atendimento | Callback contém `/fila/atendimento/{id}` | `src/lib/empresa-visual.ts:28` | L; N: navegação realizada pelo pai |
| Abrir na carteira | Callback contém `/carteira/{id}` | `src/lib/empresa-visual.ts:29` | L; N |
| Abrir no funil | Callback contém `/funil?negociacao={id}` | `src/lib/empresa-visual.ts:30` | L; N |
| Empresa indisponível/arquivada | Ação comercial é omitida; motivo aparece quando fornecido; Ver empresa permanece | `src/lib/empresa-visual.ts:23`, `:26`; `src/components/crm/card-empresa.tsx:13` | L; N: conferir dados concretos de cada estado |
| EmpresaDialogo: tentar novamente | Repete somente leitura após falha de infraestrutura; indisponibilidade por domínio mostra aviso sem retry | `src/components/crm/empresa-dialogo.tsx:26` a `:36` | L; N: erro e retry |
| EmpresaDialogo: fechar | Callback `aoFechar`, foco inicial no título e devolução ao elemento de origem se conectado; respostas antigas descartadas | `src/components/crm/empresa-dialogo.tsx:15` a `:17`, `:29`, `:31`; `src/components/ui/dialog.tsx:30` | L; N: Escape/clique fora/reabertura |
| BuscaDialogo: Ver busca / Ver resultados | Abre diálogo e carrega action de leitura; permite resultado inicial; protege contra resposta de abertura antiga | `src/components/crm/busca-dialogo.tsx:20` a `:40` | L; N |
| BuscaDialogo: Tentar novamente | Refaz leitura com aviso e `aria-busy`; botão de retry desaparece quando erro é limpo | `src/components/crm/busca-dialogo.tsx:22`, `:43` a `:45` | L; N: erro, repetição, reabertura |
| Ver histórico de buscas | Abre diálogo com conteúdo já recebido | `src/components/crm/historico-buscas-dialogo.tsx:12` a `:17` | L; N: diálogos sobrepostos e retorno de foco |
| Ver mais / Ver menos empresa encontrada | Expande/recolhe detalhes locais, com `aria-expanded` e `aria-controls` | `src/components/crm/empresa-encontrada.tsx:24` a `:28` | L; N |
| Card de detalhes, por exemplo Filtros usados | Alterna conteúdo local, sem submissão | `src/components/crm/card-detalhes.tsx:12` a `:15` | L; N |
| Abas Dados da empresa / Histórico | Alterna painéis mantendo montagem (`keepMounted`) | `src/components/crm/abas-ficha.tsx:7` | L; N: setas, Tab, foco e rascunhos |
| Estado vazio com ação de navegação | Link único composto por `asChild`, href do consumidor | `src/components/crm/estado-vazio.tsx:35` a `:36` | L; N: destinos no mapa da tela |
| Estado vazio com ação local | `type=button`, callback e disabled do consumidor | `src/components/crm/estado-vazio.tsx:37` | L; N |
| Estado vazio com submit | `type=submit`, transporta name/value e disabled do consumidor | `src/components/crm/estado-vazio.tsx:33` | L; N |
| Ver coleta, histórico Google | `/empresas/google/{pedidoId}`, usado na ficha do gestor | `src/components/crm/historico-google.tsx:10`; `app/empresas/[id]/page.tsx:70` | L; N |
| FontesBusca: Google / banco | `/fila/buscar?fonte=google` e `?fonte=banco`; não foi encontrado consumidor no app nesta leitura | `src/components/crm/fontes-busca.tsx:6` a `:7`; `app/fila/buscar/page.tsx:23` | L, componente sem uso encontrado; não contar como controle visível |

## Primitivas e semântica

`src/components/ui/button.tsx:50` usa botão nativo ou Slot em `asChild`; os links compostos lidos não criam botão dentro de link. Input, Textarea, NativeSelect e Choice preservam atributos nativos e labels dos consumidores (`input.tsx:6`, `textarea.tsx:6`, `native-select.tsx:5`, `choice.tsx:7`). Label é primitiva com transporte de props (`label.tsx:12`). Não há componente Form próprio nesse diretório.

Dialog e Sheet delegam comportamento modal a primitivas Radix; há nome acessível nos botões de fechar (`dialog.tsx:30`, `sheet.tsx:67`). Tabs delega os elementos interativos ao Base UI (`tabs.tsx:94`, `:118`, `:131`, `:146`); não foram tratados como botões nativos sem semântica. Nenhuma conclusão sobre API da biblioteca foi necessária para esta revisão de código, portanto Context7 não foi consultado.

Breadcrumb genérico compõe links com Slot e representa a página atual como `span` com `aria-current`; as reticências são decoração, não botão (`breadcrumb.tsx:40`, `:53`, `:87`). Não foi encontrado consumidor desse Breadcrumb: o CRM usa `CaminhoCrm`. Alert anuncia mensagens (`alert.tsx:18`). Card, Badge, Skeleton e Table são apresentação; a ação vem dos filhos, auditada nas telas/composições. As referências à UI são relativas a `src/components/ui/` neste parágrafo.

O CSS prevê foco global em links/botões/select e alvo mínimo de botão (`app/globals.css:42`, `:47`); o shell trata nomes ocultos acessíveis no modo recolhido, altura dos links no touch e troca mobile em 820 px (`src/components/crm/shell.module.css:50`, `:52`, `:65`, `:68`). Isso comprova intenção no código, não contraste, área clicável final nem ausência de clipping.

## Validação existente e próximos checks

Foram lidos testes que já cobrem menu/Escape/foco e recolhimento (`src/components/crm/shell.dom.test.tsx:10`), identidade de navegação (`shell.test.tsx:8`), foco/respostas antigas no diálogo (`empresa-dialogo.dom.test.tsx:13`, `:32`), payload dos cards (`card-empresa.dom.test.tsx:11`), tema (`tema.dom.test.tsx:15`), composição sem elementos aninhados (`src/components/ui/controles.test.tsx:20`) e teclado das abas (`src/components/ui/tabs.dom.test.tsx:41`). Não foram executados nesta rodada.

Próxima validação de navegador: desktop expandido/recolhido e mobile 390 px; Tab/Shift+Tab, Enter, Espaço, Escape e clique fora; foco ao fechar cada nível de diálogo; navegação por cada item dos dois papéis; erro/retry da empresa e busca; página atual nos breadcrumbs; tema nos portais; pending e repetição de login/troca/ações comerciais em ambiente fictício isolado. Logout e troca real de senha dependem desse ambiente; não devem ser exercitados em conta ou serviço real nesta auditoria.
