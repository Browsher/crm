# Redesenho completo do CRM

Estado: direção visual aprovada pelo usuário em 22/10/2026 após a prévia
navegável. Esta especificação registra a direção e os limites da migração para
revisão antes da implementação. Stack, dados e regras operacionais permanecem os
do CRM. Skills aplicadas: Frontend Design e Web Design Guidelines.

## Intenção e aprovação

O usuário pediu substituir os elementos de todo o CRM usando shadcn como base,
com componentes do 21st quando fizerem sentido, e redesenhar também os layouts.
Aprovou a prévia com áreas de vendedor e gestor, login, temas claro/escuro e
versão de celular. Não foi aprovada uma nova regra de negócio.

Referência visual versionada: `../../design/2026-10-22-redesign/`.
As capturas e a relação das fontes acompanham esta especificação. O protótipo
usa dados fictícios; nenhum texto ou número de demonstração vira dado real.

O novo padrão substitui as escolhas visuais do documento
`2026-09-11-padrao-visual.md`. Seus requisitos operacionais continuam válidos.

## Resultado esperado

- Uma linguagem comum para todas as telas, incluindo login e troca de senha.
- shadcn/ui como base real dos componentes compartilhados, com código no repo.
- Hierarquia por tarefa: agenda com lista e ficha, Funil em quadro, cadastros em
  tabelas e WhatsApp em conversas com contexto da empresa.
- Componentes e estados utilizáveis em claro, escuro e Sistema, por teclado e
  em telas de 390, 820, 1280 e 1440 pixels.
- Mesmos serviços, ações, guardas, permissões, filtros e regras de posse atuais.

## Limites

Não criar migração SQL, endpoint, métrica, regra de venda, novo papel ou nova
permissão para sustentar o visual. Não importar backend de um template.
Filtros e paginação continuam usando os contratos e parâmetros das rotas atuais.
Não adicionar busca global, calendário semanal, tags, notificações, agenda futura
ou envio de WhatsApp. A lista e o histórico continuam mostrando apenas o que a
consulta autorizada de cada tela fornece.

O protótipo mostrou alguns exemplos que precisam seguir os contratos reais:

- Grupos nascem pela importação; o CTA real é **Importar planilha**, não uma
  nova operação de criar grupo sem importação. Renomear/desativar/reativar seguem
  em `app/empresas/grupos/controles.tsx`.
- A Carteira mantém os dados que `ListaCarteira` recebe hoje. A coluna ilustrada
  de última compra só pode aparecer se o contrato atual já fornecer esse dado;
  o redesenho não amplia a consulta para reproduzir um exemplo fictício.
- A barra da prévia que alterna Gestor/Vendedor é uma ferramenta de avaliação.
  Ela não existe na aplicação. O papel vem da sessão autorizada.
- Contatos preservam todos os resultados, campos, mensagens, regras de
  obrigatório e mecanismos de rascunho atuais. O formulário reduzido da prévia
  não é um novo contrato de atendimento. Retornos continuam por data, sem hora.
- O layout do WhatsApp continua somente para visualização e preserva mídias,
  origem, cursores, carregamento parcial e limites do histórico existentes.

## Base e convivência com outros trabalhos

Worktree dedicado `crm-redesign`, branch `codex/redesign-crm`, criado a partir de
`origin/main`, SHA inicial `b62cfa6a4b04c2346dbfff8471f54e1421185394`.
As mudanças de campanhas e busca CNPJ.biz observadas na branch
`codex/campanhas-email` não são copiadas, revertidas nem incluídas neste PR.

Antes de cada etapa e antes da integração, atualizar a comparação com a main e
inventariar novas rotas. Se a busca de empresas já tiver sido integrada, as
rotas `/empresas/busca` e `/fila/buscar` e as composições compartilhadas dessa
feature recebem o mesmo padrão, mantendo limites e serviços da implementação
integrada. Se continuarem em outra branch, registrar essa dependência de
integração e não alegar cobertura dessas rotas nesta entrega.

Nenhum commit direto na main. PR sempre contra main, sem PR empilhado. A etapa
de documentação e a implementação podem continuar no mesmo PR rascunho.

## Sistema visual

Decisões de construção propostas a partir da prévia aprovada:

| Papel | Claro | Escuro |
|---|---|---|
| Fundo de trabalho | `#F5F6F8` | `#151B22` |
| Superfície | `#FFFFFF` | `#1C242D` |
| Texto principal | `#202A35` | `#E6EBEF` |
| Texto secundário | `#65707D` | `#A3AEB9` |
| Borda estrutural | `#E1E5E9` | `#34404D` |
| Borda de controle | `#AAB3BD` | `#657787` |
| Primária | `#17634D` | `#8FD0B9` |
| Texto na primária | `#FFFFFF` | `#163C30` |

Sucesso usa verde; atraso/atenção usa âmbar; erro usa vermelho. Texto acompanha
a cor. Devolver continua ação operacional normal. As variantes semânticas
existentes de Badge e Alert são preservadas.

Segoe UI, system-ui, sans-serif, sem nova requisição de fonte. Corpo 14/21 px,
campos 14/21 px no desktop e 16/24 px no celular; metadados de 12 px e títulos de
página de 28/36 px, reduzidos a 24/32 px no celular. Informação necessária para
a ação nunca usa o tratamento de metadado. Números comparáveis usam algarismos
de largura uniforme. Manter títulos funcionais: Meu dia, Prospecção, Funil
comercial, Minha carteira, Gestão, Empresas, Usuários e WhatsApp.

Espaçamentos 4, 8, 12, 16, 24 e 32 px. Campos/botões com mínimo de 40 px no
desktop e 44 px no toque. Raios 6 px em controles, 8 a 10 px em superfícies e
diálogos. Bordas expressam agrupamento; sombra fica em sobreposições.
O destaque memorável é a seleção contínua entre retorno e ficha, sem animação
decorativa nem cards de métricas sem dados.

## Shell e navegação

Sidebar de aproximadamente 224 px, recolhível no desktop e apresentada em Sheet
no celular. Área de conteúdo com largura fluida até cerca de 1600 px, padding
de 24 a 36 px no desktop e 16 px no celular. Limites são pontos de partida da
composição; corrigir overflow pela largura dos filhos, não escondendo ações.

Cabeçalho compacto com breadcrumb, tema e identidade do usuário. Logout continua
form POST para `/sair`. O menu tem nomes acessíveis mesmo quando recolhido.
Sheet com fechamento por Escape, contenção e retorno de foco ao acionador.

Vendedor: Meu dia, Prospecção, Funil e Carteira. Gestor: Gestão, Empresas,
Grupos, Usuários e WhatsApp. O atalho para Grupos é aprovado como reorganização
visual de uma rota existente que já exige gestor; não amplia permissões.
Reutilizar `CaminhoCrm` e seus destinos reais; não trocar navegação por `div`
clicável nem recriar o roteador da prévia.

Manter o controle Sistema/Claro/Escuro disponível. A implementação pode
centralizar o controle para manter o tema entre telas, preservando `TemaCrm`,
`useTemaCrm()` e a prop `theme` dos diálogos durante a migração. Preferência
persistida, se adotada, não pode causar HTML inicial divergente nem quebrar
Sistema. Essa decisão técnica e o nome da chave ficam com o implementador.

## Componentes e dependências

Manter aliases de `components.json`: UI em `@/src/components/ui`, utilitário
`cn` em `@/src/lib/ui-utils`. Usar o registro oficial shadcn e adaptar imports,
aspas e ponto e vírgula ao padrão do projeto. Não executar init com sobrescrita
global nem atualizar todos os componentes automaticamente.

Base: Button, Input, Textarea, Label, NativeSelect, Badge, Alert, Card, Dialog,
Skeleton, Sidebar/Sheet, Breadcrumb e Table conforme o uso real. DropdownMenu e
Tooltip entram quando necessários ao menu e à identificação de controles.
Não instalar data grid ou calendário completo para trocar marcação de tabela e
campo de data que já funcionam. Preservar variantes e props usadas pelos
consumidores existentes, inclusive refs, `asChild`, `theme` e `showCloseButton`.

Componente do 21st selecionado: abas SmoothUI encontradas em
https://preview.21st.dev/@educalvolpz/components/animated-tabs,
com fonte pública https://smoothui.dev/r/animated-tabs.json.
O código efetivamente obtido usa Base UI e Motion e está relacionado no manifesto
de fontes da referência visual. Adaptar nomes/estilo e usar em fichas onde há
conteúdo de dados e histórico para alternar. Não carregar código no servidor que
deveria ser apenas cliente. Respeitar redução de movimento e navegação por
teclado. Não mudar o conteúdo acessível por alternar a aba.

Dependências admitidas, apenas quando usadas: `radix-ui`, `lucide-react`,
`@base-ui/react`, `motion` e dependências de estilo exigidas pelo registro
selecionado. Instalar via npm, conferir peers e gravar o lockfile. Manter React
e React DOM alinhados. Pacotes Radix individuais só saem quando não houver mais
imports. A escolha da versão exata cabe ao implementador após conferir os peers.
Incluir atribuição MIT das fontes externas e registrar as adaptações.

CSS: tokens semânticos compatíveis com Tailwind 4 no ponto global da aplicação,
CSS Modules para composições. Durante a migração, mapear `--ui-*` aos tokens
novos para manter consumidores funcionando; remover só após inventariar usos.
Portais precisam receber o tema real. Conferir build de produção porque a ordem
dos estilos pode diferir de `next dev`, conforme o guia local do Next 16.3.8.

## Inventário de layouts

| Rotas | Composição e comportamento preservado |
|---|---|
| `/login`, `/trocar-senha` | Identidade visual do login aprovado; formulários reais, validação, senha provisória e primeiro acesso intactos. |
| `/meu-dia` | Lista de retornos e ficha lateral; no celular, lista e ficha em sequência com Voltar. Somente atrasados e de hoje. Filtros, rascunhos e reconciliação preservados. |
| `/fila` | Listas elegíveis, busca/consulta e contexto de atendimento. Usar origem e disponibilidade reais dos grupos. Mesmas ações, etapas e reserva. |
| `/fila/localizar`, `/fila/localizar/[id]` | Filtros, resultados, paginação, recentes e ficha; telefone e atendimento conforme autorização existente. |
| `/funil` | Três etapas reais: Primeiro contato, Em negociação, Proposta enviada. Preservar drag desktop apenas à próxima etapa e alternativa por botão. Modal e venda com confirmação. |
| `/carteira`, `/carteira/[id]` | Lista de clientes em tabela no desktop e registros empilhados no celular. Ficha com dados, histórico e compras disponíveis. Preservar filtros no retorno e registrar venda pelo fluxo real. |
| `/gestao` | Resumo real da equipe, pendências e atividade recente. Sem gráficos ou percentuais fictícios. |
| `/usuarios`, `/usuarios/vendedores/[id]` | Busca/filtro, tabela, perfil e administração. Senha mostrada uma vez; ações sobre a própria conta continuam limitadas. |
| `/empresas`, `/empresas/[id]` | Filtros atuais, tabela responsiva, paginação e ficha cadastral com dados autorizados. |
| `/empresas/importar` | Arquivo, conferência, confirmação e relatório; token e validações reais preservados. Voltar e corrigir sem perder contexto. |
| `/empresas/grupos`, `/empresas/grupos/[id]` | Origem, metadados, contagens e controles reais de importação. Card/tabela conforme os dados reais; ações e impacto mantidos. |
| `/whatsapp`, `/whatsapp/configuracao` | Conversas com contexto, filtros e mídias. No celular lista e conversa em sequência. Configuração mantém formulários, segredos mascarados e estados reais. |
| `/design` | Galeria do novo padrão com demonstrações identificadas; permanece exclusiva do gestor e sem escritas reais. |
| `/`, `/sair` | Preservar redirecionamento por papel e saída POST; não criar tela decorativa. |

Estados de vazio, carregamento, erro, negado e somente leitura recebem o padrão
nas páginas que já os apresentam. Não tratar erro de infraestrutura como lista
vazia nem ocultar motivo de bloqueio. Textos extensos, CNPJ/nome ausentes e mídia
indisponível precisam continuar legíveis.

## Critérios de aceite e verificação

- TDD em toda mudança de comportamento/componente: teste falha antes da
  implementação. Não substituir testes funcionais por snapshots de classe CSS.
- Jornadas existentes passam; ajustar apenas expectativas de apresentação
  deliberadamente alteradas, nunca diminuir uma proteção para o visual caber.
- Teclado: menu, filtros, tabs, tabela, diálogos, Escape e retorno de foco.
- Contraste conferido nas combinações efetivas; foco visível e estado além da
  cor. Metas de contraste: 4,5:1 para texto comum e 3:1 para controles/foco.
- 390/820/1280/1440 px, claro/escuro/Sistema, nomes e anotações longos,
  sem rolagem horizontal da página nem ação escondida.
- Nenhum texto, número, conta ou contato fictício do protótipo em produção.
- Build, typecheck, lint, checador de migrações, unidades, integrações e E2E
  apropriados passam. Banco de teste descartável, sem alteração na Railway.
- Revisão Web Design Guidelines com fonte atual; achados por arquivo/linha
  corrigidos ou explicitamente documentados. Revisão independente final.
- PR contra main com CI verde e capturas da aplicação real. A aprovação da
  prévia não é uma alegação de integração, deploy ou validação da aplicação real.

## Decisões delegadas ao implementador

Nomes internos de composições, distribuição entre utilitários Tailwind e CSS
Modules, variantes exatas de Sidebar/Sheet, pequeno ajuste de espaçamento para
conteúdo real e versão compatível dos pacotes. Usar o padrão e as jornadas do
vizinho antes de criar arquivo novo em `app/`. Não redesenhar modelos de domínio.
