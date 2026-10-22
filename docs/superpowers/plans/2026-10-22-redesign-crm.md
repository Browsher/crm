# Redesenho completo do CRM: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o visual aprovado a todas as áreas do CRM com componentes
shadcn e abas SmoothUI/21st, preservando o funcionamento real.

**Architecture:** Migrar primeiro tokens e componentes compartilhados mantendo
compatibilidade com os consumidores. Depois redesenhar cada área sobre consultas,
ações e guardas existentes, com composições em `src/components/crm` e `app/`.
Serviços, regras, banco e permissões não são reimplementados.

**Tech Stack:** Next.js 16.3.8 App Router, React 19.2.8, TypeScript, Tailwind 4,
shadcn/Radix, SmoothUI/Base UI/Motion, Vitest e Playwright, npm.

**Spec:** `docs/superpowers/specs/2026-10-22-redesign-crm-design.md`.

## Global Constraints

- Base inicial main `b62cfa6a4b04c2346dbfff8471f54e1421185394`; worktree
  `C:/Users/ADM/.codex/worktrees/crm-redesign/crm`, branch `codex/redesign-crm`.
- Português, aspas simples, sem ponto e vírgula no TypeScript, sem travessão na UI.
- `features/` não importa outra `features/`; componentes comuns em `components`,
  infraestrutura em `server` e regras comuns em `lib` conforme o projeto.
- npm e package-lock; sem `--force`, `--legacy-peer-deps` ou atualização geral da stack.
- Preservar RLS, `pode_escrever()`, guardas, ações, limites, filtros e contratos.
- Retornos por data, sem hora; Meu dia somente atrasados/hoje; Funil só avança à
  próxima etapa; WhatsApp somente visualização.
- Dados, CTAs e campos reais prevalecem sobre exemplos do protótipo.
- Claro/escuro/Sistema; 390/820/1280/1440 px; toque mínimo 44 px, corpo 14 px,
  campos 16 px no celular. Paleta e demais valores estão fixados na spec.
- TDD RED antes do GREEN. Tests de comportamento e navegador, sem snapshots de
  CSS como única evidência. Manter testes antigos e atualizar só apresentação.
- Antes de arquivo novo em `app/`, ler inteiro o vizinho citado na tarefa.
- Branch/PR contra main, sem empilhar. Sem merge, deploy ou migração de banco
  implícitos nesta execução. Sem copiar alterações em andamento de outros chats.
- No PowerShell, comandos com argumentos repassados usam `--%`: por exemplo,
  `npm run test:unit --% -- src/components/ui/controles.test.tsx`.

## Review Focus

1. Rascunho em andamento ao alternar ficha/aba/empresa: preservar ou confirmar
   descarte conforme a proteção atual. Teste novo da tarefa 4.
2. Portal em tema escuro/Sistema e retorno de foco ao fechar: tema e teclado
   íntegros mesmo fora do shell. Testes das tarefas 1 e 2.
3. Razão social, bairro e anotações extensos ou ausentes: sem overflow nem ação
   escondida. Dados de estresse nas tarefas 3, 4, 6 e 8.
4. Sessão/posse revogada ou senha provisória durante interação: apresentar a
   negativa real e manter os dados recuperáveis. Testes das tarefas 3 e 4.
5. Navegação entre áreas após importar CSS e alterar tema: nenhum estilo residual
   ou filtro perdido no build de produção. Jornada da tarefa 9.

## Mapa de arquivos e contratos

- `app/globals.css`: entrada global, tokens Tailwind e tema resolvido.
- `src/styles/ui.css`: ponte temporária `--ui-*` e estilos legados ainda usados.
- `src/components/ui/*`: primitivas oficiais adaptadas; manter as APIs existentes.
- `src/components/ui/tabs.tsx`: exports `TabsRoot`, `TabsList`, `TabsTab`,
  `TabsPanel`, `TabsIndicator` da fonte SmoothUI identificada na spec; auxiliar
  `src/components/ui/tabs-indicador.ts` se exigido pelo registro consultado.
- `src/components/crm/tema.tsx`: `TemaCrm = 'light' | 'dark' | 'system'`,
  `useTemaCrm(): TemaCrm` e novo `TemaCrmProvider({ children })`; controle do tema
  pode usar `useControleTemaCrm(): { tema: TemaCrm; definirTema(tema: TemaCrm): void }`.
- `src/components/crm/cabecalho-pagina.tsx`: `CabecalhoPagina({ titulo,
  descricao?, acoes?, className? })`, com strings e ReactNode para ações.
- `src/components/crm/estado-vazio.tsx`: `EstadoVazio({ titulo, descricao,
  acao? })`, composição apresentacional sem consultar dados.
- `src/components/crm/acesso.tsx` e `acesso.module.css`: composição de login e
  troca de senha, recebe `{ titulo, descricao, children: ReactNode }`.
- Shell mantém assinatura `ShellCrm({ children, nome, papel, area })`.
  `CaminhoCrm` mantém `{ area: string; titulo: string }` e destinos reais.
- Páginas e painéis mantêm seus tipos de props e seus serviços. Não criar um
  modelo de dados único que reduza as diferenças de autorização entre telas.
- `NOTICE-componentes-ui.md`: fontes externas, licença MIT e adaptações.

## Task 1: primitivas, tokens e galeria

**Arquivos:** modificar `components.json`, `package.json`, `package-lock.json`,
`app/globals.css`, `app/layout.tsx`, `src/styles/ui.css`, componentes existentes
em `src/components/ui/`, `app/design/galeria.tsx`, `galeria.module.css` e os
testes vizinhos. Criar primitivas usadas de Sheet/Sidebar/Breadcrumb/Table,
`tabs.tsx`, `tabs-indicador.ts`, `tabs.dom.test.tsx` e `NOTICE-componentes-ui.md`.

**Consome:** configuração/aliases atuais e fontes da spec.
**Produz:** primitivas compatíveis, tokens comuns e exports de Tabs do mapa.

- [ ] Escrever RED em `src/components/ui/tabs.dom.test.tsx`: duas abas com painéis
  distintos; clique e setas + Enter ativam o painel correto; apenas aba ativa
  entra no Tab; conteúdo sem foco perdido. Acrescentar ao E2E `design.spec.ts`
  caso de portal escuro com texto e botão contrastantes e foco devolvido.
- [ ] Rodar os testes novos e registrar a falha por componente/comportamento
  ausente, antes de instalar/escrever o componente que os satisfaz.
- [ ] Consultar MCP shadcn/Context7 e fonte do 21st; obter somente os itens usados.
  Conferir peers antes de instalar. Preservar variantes `success`, `warning`,
  `danger`, NativeSelect, refs, `asChild`, `theme`, `showCloseButton` e estados.
- [ ] Implementar os tokens da spec e a ponte `--ui-*`. Atualizar a galeria para
  demonstrar estados reais, temas, labels, textos longos e foco. Não incluir
  barra de troca de papel nem dados do protótipo fora da galeria.
- [ ] GREEN: `npm run test:unit --% -- src/components/ui app/design` e typecheck.
  Quando o harness E2E estiver preparado, executar `npm run test:e2e` e conferir
  a galeria no build de produção. Commit só com a verificação adequada verde.

## Task 2: shell, tema e composições compartilhadas

**Arquivos:** `src/components/crm/shell.tsx`, `shell.module.css`, `tema.tsx`,
`caminho.tsx`, testes `shell*`/`caminho*`; criar `cabecalho-pagina.tsx`,
`estado-vazio.tsx` e testes semânticos; modificar `app/layout.tsx` se o provider
precisar ficar na raiz. Usar como moldes os arquivos atuais do mesmo diretório.

**Consome:** primitivas/tokens da tarefa 1.
**Produz:** contratos do mapa e shell compartilhado preservando props públicas.

- [ ] RED: testar grupos ativos em `/empresas/grupos` sem ativar também Empresas;
  menu vendedor sem administração; saída POST; Sheet abre/fecha por teclado e
  retorna foco; tema aplicado ao portal e compatibilidade de `useTemaCrm()`.
- [ ] Rodar `npm run test:unit --% -- src/components/crm` e conferir as falhas novas.
- [ ] Implementar Sidebar/Sheet e breadcrumb com rotas reais e identidades da
  sessão. Gestor ganha o atalho Grupos; essa é a mudança deliberada no teste
  antigo que proibia esse link. Não alterar guardas para fazer link funcionar.
- [ ] Criar as composições do mapa. Centralizar o tema preservando Sistema e
  hidratação inicial. Se persistir preferência, testar valor inválido, reload e
  troca de preferência do sistema; a falta de armazenamento não quebra a UI.
- [ ] GREEN: suíte do diretório e E2E de navegação/tema em 390 e 1440 px, incluindo
  rota de gestor acessada por vendedor; conferir capturas antes do commit.

## Task 3: login e senha provisória

**Arquivos:** criar `src/components/crm/acesso.tsx`, `acesso.module.css` e teste;
modificar `app/login/page.tsx`, `formulario.tsx`, `app/trocar-senha/page.tsx`,
`formulario.tsx`; criar testes DOM vizinhos; estender `tests/e2e/autenticacao.spec.ts`.
Ler esses quatro arquivos e os testes de autenticação antes de editar.

**Consome:** componentes da tarefa 1 e composição Acesso do mapa.
**Produz:** autenticação visualmente integrada, sem mudar ações ou campos reais.

- [ ] RED: senha provisória continua exigindo troca; erro preserva e-mail e campo
  editável; nomes longos não estouram em 390 px; envio pendente bloqueia duplicata.
- [ ] Rodar os testes novos; usar mocks das ações no padrão de `usuarios.dom.test.tsx`.
- [ ] Implementar o layout aprovado, labels, autocomplete e os textos reais,
  mantendo `useActionState`, actions e a autoridade do banco intactos.
- [ ] GREEN: testes dos formulários, E2E de autenticação, typecheck e capturas
  de login/troca em claro/escuro e celular. Commit da tarefa.

## Task 4: prospecção, Meu dia, Carteira e Funil

Esta tarefa tem quatro entregas revisáveis, na ordem abaixo, cada uma com RED,
GREEN e commit próprio. Todas compartilham o formulário real de contato.

**Arquivos comuns:** `src/features/contato/formulario.tsx`, `linha-do-tempo.tsx`
e testes; nenhuma alteração nos serviços, regras ou funções SQL.
**Consome:** shell, tokens, cabeçalhos, campos e Tabs das tarefas 1/2.
**Produz:** layouts reais de vendedor com contratos de props atuais.

- [ ] **4A, RED:** ampliar testes `app/fila/formulario.dom.test.tsx` e
  `src/features/contato/formulario.test.tsx` para rascunho ao alternar contexto,
  perda de posse/expiração e duplicata bloqueada. Rodar antes de implementar.
  Ler `app/fila/formulario.tsx`, `rascunhos.tsx`, `src/features/contato/formulario.tsx`
  e os formulários de `app/fila/localizar/` inteiros.
- [ ] **4A, GREEN:** redesenhar `app/fila/page.tsx`, `grupos.tsx`, `cartao.tsx`,
  `formulario.tsx`, `campos-reserva.tsx`, `shell.tsx`, `etapas.tsx`, CSS vizinhos e
  as composições de `app/fila/localizar/`. Manter origem dos grupos, consultas,
  filtros, recentes, paginação, campos de contato e tratamento de expiração.
  Rodar unidades de `app/fila`/`src/features/contato` e jornadas consulta,
  reserva, prospecção/grupos e retorno combinado. Capturar e commitar.
- [ ] **4B, RED:** ampliar `app/meu-dia/painel.dom.test.tsx`: alternância móvel
  lista/ficha conserva seleção e rascunho; retorno futuro segue ausente; empresa
  removida por posse negada sai da contagem sem esconder motivo. Rodar RED.
- [ ] **4B, GREEN:** adaptar `app/meu-dia/page.tsx`, `painel.tsx`, `filtros-form.tsx`
  e `meu-dia.module.css`; tabs só sobre conteúdo autorizado. Testes da área e
  jornada `tests/e2e/meu-dia.spec.ts`, capturas e commit.
- [ ] **4C, RED:** em `app/carteira/lista.test.tsx` e `[id]/ficha.dom.test.tsx`,
  provar filtros no destino/retorno, próxima ação e histórico real; nenhuma
  coluna inventa compra ausente. Rodar os testes novos.
- [ ] **4C, GREEN:** redesenhar `app/carteira/lista.tsx`, `page.tsx`, `filtros-form.tsx`,
  `[id]/ficha.tsx`, `[id]/page.tsx`, `registrar-venda.tsx` e CSS vizinhos. Preservar
  mensagens, rascunho e confirmação da venda. Testes da área e E2E de Carteira,
  capturas e commit.
- [ ] **4D, RED:** ampliar `app/funil/quadro.dom.test.tsx` e `modal.dom.test.tsx`
  para botão e drag apenas à próxima etapa, textos longos e confirmação da venda.
  Rodar antes de modificar.
- [ ] **4D, GREEN:** adaptar `app/funil/page.tsx`, `quadro.tsx`, `modal.tsx`,
  `funil.module.css`; preservar as três etapas e meios alternativos ao drag.
  Testes da área e E2E `funil.spec.ts`, capturas e commit.

## Task 5: gestão e usuários

**Arquivos:** `app/gestao/page.tsx`, `loading.tsx`, `error.tsx`, `gestao.module.css`;
`app/usuarios/tabela.tsx`, `linha.tsx`, `formulario-criar.tsx`, `senha.tsx`,
`usuarios.module.css`, `vendedores/[id]/page.tsx`, `perfil.module.css` e testes.
Ler o formulário atual de criar usuário e senha antes de substituir marcação.

**Consome:** componentes e composições das tarefas 1/2.
**Produz:** administração com mesmas consultas e ações de gestor.

- [ ] RED: senha provisória continua mostrada uma vez; própria conta sem rebaixar
  ou desativar; ações com falha preservam contexto; números ausentes não viram
  zero fictício no dashboard. Rodar testes novos em `app/usuarios`/`app/gestao`.
- [ ] Implementar os layouts de resumo/equipe/atividade, tabela responsiva,
  filtros, menus e diálogos com campos reais, mantendo handlers atuais.
- [ ] GREEN: testes das duas áreas, E2E `gestao.spec.ts`, `usuarios-visual.spec.ts`
  e `perfil-vendedor.spec.ts`; claro/escuro/celular. Commit da tarefa.

## Task 6: empresas, grupos, importação e fichas

**Arquivos:** páginas/composições e CSS de `app/empresas/`, `[id]/`, `grupos/`,
`grupos/[id]/`, `importar/`, com seus testes. Em particular `lista.tsx`, `linha.tsx`,
`formulario.tsx`, `paginacao.tsx`, `grupos/controles.tsx`, `metadados.tsx`,
`importar/formulario.tsx`, `etapas-importacao.tsx` e `relatorio.tsx`.
Ler esses formulários e seus testes DOM antes de editar.

**Consome:** tokens/controles/shell; contratos de importação e grupos já existentes.
**Produz:** cadastros e conferência no novo padrão sem alterar contrato de arquivo.

- [ ] RED: filtros e página preservados após ficha; erro de conferência conserva
  arquivo/contexto e token atual; descrição extensa e metadados ausentes cabem
  em 390 px; desativar grupo confirma o impacto real. Rodar testes novos da área.
- [ ] Implementar tabelas/registros móveis, filtros e fichas com dados autorizados.
  Grupos usam Importar planilha e as ações existentes; não criar endpoint para
  o CTA fictício Novo grupo do protótipo. Manter metadados reais e leitura prévia.
- [ ] GREEN: unidades de `app/empresas` e E2E de empresas, filtros, Excel,
  grupos/importação e ficha do gestor. Capturas e commit.

## Task 7: WhatsApp e configuração

**Arquivos:** `app/whatsapp/page.tsx`, `painel.tsx`, `visao-geral.tsx`,
`midia-mensagem.tsx`, `error.tsx`, `whatsapp.module.css`,
`configuracao/page.tsx`, `formulario.tsx`, `configuracao.module.css` e testes;
criar `tests/e2e/whatsapp-visual.spec.ts` e dados locais se necessário.
Ler os testes DOM existentes de painel, mídia e configuração inteiros.

**Consome:** shell e controles; serviços de leitura e ações de configuração atuais.
**Produz:** conversas/contexto e formulários reais no novo padrão.

- [ ] RED: alternar conversa móvel tem Voltar e preserva rolagem/contexto;
  carregamento parcial, mídia indisponível e fonte sem vínculo têm mensagens
  distintas; configuração falha sem perder vendedor/instância. Rodar testes novos.
- [ ] Implementar três áreas no desktop, sequência no celular e máscaras atuais
  de credenciais. Sem composer, envio, marcação de leitura ou dado inventado.
- [ ] GREEN: testes de `app/whatsapp`, novo E2E com serviços controlados no padrão
  do harness local, capturas claro/escuro/celular e commit da tarefa.

## Task 8: integração das rotas novas e revisão de cobertura

**Arquivos:** inventário da spec; se já na main, páginas de `/empresas/busca`,
`/fila/buscar`, suas composições compartilhadas e testes vizinhos. Não copiar
arquivos do checkout ativo de outra branch.

- [ ] Comparar branch e main atualizadas e listar todas as páginas visíveis.
  Se a busca entrou, ler sua spec e os componentes reais antes de planejar a
  mudança local. Acrescentar testes RED de filtros, erro, limite e paginação.
- [ ] Aplicar o padrão apenas sobre a implementação integrada; GREEN nos testes
  da área e suas jornadas. Se ainda não entrou, documentar a pendência exata de
  integração e retirar qualquer alegação de cobertura dessas rotas na entrega.
- [ ] Confirmar que cada rota do inventário tem captura ou justificativa de
  composição já coberta; incluir erro, vazio, nomes extensos e ausência de dados.
  Commit apenas dos arquivos desta tarefa quando houver alteração.

## Task 9: verificação da aplicação real e PR

**Arquivos:** criar `tests/e2e/redesign-crm.spec.ts`; ajustar somente seletores e
expectativas de apresentação deliberadamente alteradas nas jornadas existentes.
Atualizar este plano com evidências e limitar a limpeza ao CSS que perdeu consumidores.

- [ ] RED de uma jornada contínua: login vendedor, Meu dia, atendimento com
  rascunho, Funil, Carteira e saída; gestor, Empresas/Grupos, Usuários, WhatsApp.
  Alternar tema e viewport, abrir/fechar portal e voltar com filtros intactos.
  Não criar cadastro fictício em produção para conseguir uma captura.
- [ ] Implementar apenas correções necessárias para GREEN da jornada. Remover
  estilos e dependências sem consumidor, com busca de imports antes de retirar.
- [ ] Executar `npm run typecheck`, `npm run lint`, `npm run db:checar`,
  `npm run test:unit`, `npm run test:integracao`, `npm run build:e2e`,
  `npm run test:e2e --% -- --sem-build` e `git diff --check`.
- [ ] Executar a revisão atualizada Web Design Guidelines e registrar achados
  por arquivo/linha. Rever contraste e capturas após o build de produção.
- [ ] Solicitar revisão independente da branch inteira, corrigir achados
  acionáveis com RED/GREEN e repetir somente os checks afetados, além dos
  exigidos pelo CI. Registrar comandos e resultados, sem afirmar aprovação
  funcional por capturas do protótipo.
- [ ] Atualizar o PR rascunho contra main com o resultado final, validação e
  limitações. Anexar o PR ao chat. Aguardar CI no SHA enviado; sem merge automático.

## Revisão do plano e execução

Cobertura revisada contra cada linha do inventário da spec e os cinco riscos.
As tarefas usam contratos existentes; as novas composições têm interfaces no
mapa, e cada entrega de vendedor tem seu ciclo e commit próprios.
A revisão independente da especificação concluiu: **Nada importante pendente**.

Recomendação: execução nativa nesta conversa, tarefa por tarefa, com revisão
independente final. Os contratos de tema/controles são compartilhados por muitas
telas e esse formato reduz o custo de coordenação e mantém uma única migração.
A alternativa é execução por subagentes, com implementação e revisão de cada
tarefa em contextos separados. Revisar o plano e definir o método antes de
iniciar o código, conforme a skill writing-plans.
