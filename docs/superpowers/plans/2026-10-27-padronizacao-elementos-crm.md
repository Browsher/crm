# Plano de implementação do design system do CRM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Aplicar o padrão visual aprovado aos elementos do CRM, preservando dados, permissões, fluxos e contexto de cada tarefa.

**Architecture:** Evoluir os componentes reais em src/components/ui e as composições em src/components/crm, depois migrar os consumidores por área. Tokens e estados compartilhados definem o acabamento; CSS Modules organizam cada tela. O HTML é a referência de aparência, e os contratos atuais da aplicação continuam definindo seu funcionamento.

**Tech Stack:** Next.js App Router 16.3.8, React 19.2.8, TypeScript, Tailwind 4, shadcn/ui adaptado, Radix, Base UI/Motion nas abas existentes, Lucide, npm, Vitest e Playwright.

**Spec:** [HTML aprovado](../../design/design-system-padrao.html), revisão 97619516457fe28d414fe54371f6610514ca1628. Aprovação do usuário em 27/10/2026. [Inventário e diferenças D01–D14](../../design/design-system-atual.md). A aprovação é da referência visual; dados e ações simuladas do HTML não substituem contratos de negócio.

**Situação em 28/10/2026:** dez implementações e revisões focadas concluídas, até `17554c1`, seguidas da onda única de correções finais `ee2ff959`. Ajuste final reaprovado; E2E completo com 104 passes/0 falhas/0 skips em 6,8 min e revisão ampla/Guidelines de código concluídos. Revisão ampla do conjunto e documental aprovada em `61cb5ee`, com Critical 0, Important 0 e Minor aberto 0. PRs 55/60 e lotes A/B/C integrados; D preparado localmente sobre a main `5feb4df3152bafaf1d35aab01cbaa9a0760b0865`, com PR, CI remoto, revisão humana e merge pendentes. Esta reconciliação documental ainda aguarda revisão própria; publicação permanece fora do plano e sem autorização. O [registro de validação](../../design/2026-10-27-design-system/validacao.md) discrimina resultados, revisões, capturas e limites. Este plano começou como planejamento em 27/10/2026; os checkpoints abaixo distinguem ações locais e integrações remotas comprovadas.

## Global Constraints

- Os mapas Modify indicam os alvos de responsabilidade a inspecionar e alterar quando necessário ao resultado descrito. Uma mudança específica exigida no texto continua obrigatória. Quando o resultado vem do componente/CSS compartilhado e um alvo já preserva seu contrato, registrar a evidência e a ausência de alteração no relatório; não produzir hunk artificial apenas para cumprir a lista.

- Usar os pares claro/escuro do HTML e do inventário. Primária #17634D/#8FD0B9; superfície #FFFFFF/#1C242D; fundo #F5F6F8/#151B22; texto #202A35/#E6EBEF; borda de controle #8793A0/#657787.
- Fonte Segoe UI, system-ui, sans-serif. Corpo 14/21 px; título de página 28/36 px e 24/32 px no celular; seção 18/26 px; título de card 16/24 px; auxiliar 12/18 px.
- Controles com mínimo 40 px no desktop e 44 px até 820 px ou com pointer:coarse. Campos com fonte 16 px nesses dois últimos cenários, inclusive em telas largas com toque. Textarea com mínimo padrão de 96 px, conservando rows, conteúdo, cópia e redimensionamento.
- Espaçamentos: 4, 8, 12, 16, 24 e 32 px. Raio de controle 6 px; card e diálogo 10 px; painéis auxiliares 8 px. Card com borda sólida de 1 px e sem sombra; sombra reservada a sobreposições. Padding do card de 24 px no desktop e 20 px até 820 px, conforme o HTML.
- Foco com um contorno de 3 px, afastado 3 px, usando ring. Evitar outline e ring simultâneos. Respeitar prefers-reduced-motion e manter o significado dos estados escrito.
- Estado vazio em Card, com título e explicação. Quando houver próxima ação pertinente ao estado, apresentá-la padronizada no rodapé; vazios informativos de consulta podem omitir a ação, conforme o contrato opcional de EstadoVazio e a especificação de estados com próxima ação. Navegação continua Link; ação local continua button. Na Carteira, conservar título, explicação e “Puxar a próxima empresa”, com destino /fila.
- Últimas buscas: até 11 empresas e último card “Ver todas buscas”; proporção quadrada, 3/2/1 por contêiner, reticências em uma linha e dados ampliados no desktop. Preservar quebras de contêiner 670/480 px e enriquecimento a partir de 1120 px. Outros cards têm proporção adequada à tarefa.
- Shell: sidebar 224 px, recolhida 76 px; topbar mínima 60 px; conteúdo até 1420 px com padding 30/32 px, e 24/16 px até 820 px. WhatsApp pode ocupar toda a largura, como hoje.
- Tabela comum: células confortáveis com padding 16 px; variante compacta 12 px somente quando necessária ao conteúdo. Registros comuns empilham até 600 px, conforme a referência; planejamento semanal e perfil podem conservar rolagem. Não acrescentar preferência global de densidade.
- Manter APIs e semântica dos componentes: refs, asChild, name, value/defaultValue, checked/defaultChecked, disabled, readOnly, aria-invalid, aria-describedby e tema dos portais.
- Preservar Casa dos Dados, inclusão automática, cota 100/dia por vendedor, UUID, histórico, deduplicação e RLS. Vendedor vê nome/função dos sócios; documentos continuam exclusivos do gestor.
- Preservar Google, planejamento pessoal, workflow universal, planilha compartilhada, reservas, Carteira, Funil e administração de usuários. Meu dia continua exibindo atrasados e hoje. Não criar calendário, tags, métricas, permissões ou ações de envio.
- Preservar interações atuais: alternância lista/ficha do Meu dia, rascunhos, confirmação de descarte e datas. O HTML demonstra componentes; não amplia formulários ou operações.
- Manter shadcn instalado e abas SmoothUI/Base UI/Motion. Componentes adicionais do 21st só entram com necessidade concreta e avaliação posterior. Esta adoção não exige consulta paga, pacote novo ou atualização de dependências.
- Português, ações com nomes consistentes e sem travessões. Falha de infraestrutura tem apresentação de erro; não aparece como estado vazio.
- TypeScript sem ponto e vírgula e com aspas simples; npm e package-lock existentes; TDD para comportamento/semântica. Não substituir testes por snapshots de classes.
- Validar com dados sintéticos e harness local. Não alterar serviços pagos, workflow/planilha/agentes, credenciais, cotas operacionais ou banco de produção.
- Branch e PR contra main, CI verde antes de merge. Publicação e promoção em produção ficam fora deste plano.

## Base correta e integração

Histórico conferido em 27/10/2026, preservado como contexto da escolha de execução:

| Referência | Estado observado | Consequência |
| --- | --- | --- |
| main | b62cfa6a4b04c2346dbfff8471f54e1421185394 | Ainda contém a interface anterior. |
| PR 55 / codex/redesign-crm | Aberta, rascunho, ponta 073a90af4a398f93b55a1a5e98ca3b173c4fa6f2 | Contém a interface recente e as funções a preservar. |
| Fonte publicada | 473f0df9377d33c305ba1ea63850b1c5790ab883 | A diferença até 073a90a é documental. |
| PR 60 / codex/design-system-atual | Documentação e HTML; ponta 9761951 antes deste plano | Não contém a implementação recente da PR 55. |

**Recomendação original, histórica, antes da escolha de execução:** integrar PRs 55 e 60 pelo fluxo normal de revisão/CI, com aprovação para essa integração, e criar o checkout de implementação a partir da main atualizada. Este planejamento não executa merges.

**Decisão executada (Ruling 1):** a implementação local isolada partiu da interface recente, com o HTML e a documentação aprovados, sem esperar a integração remota das PRs 55/60. R-021 proíbe PRs empilhadas, não desenvolvimento local. O custo se essa antecipação estiver errada é rebase e adaptação à main antes de integrar. O estado remoto/local foi conferido antes da implementação; a branch usada foi `codex/adotar-design-system`. Naquele momento, PRs 55/60 continuavam abertas, a main observada era antiga e nenhum merge ou deploy estava autorizado. A integração posterior foi autorizada separadamente; publicação continua fora do plano.

Conferir os conteúdos relevantes da base, incluindo tokens, carrossel e inclusão automática. Não exigir que 073a90a seja ancestral da main: squash muda a ancestralidade. Se houver alterações posteriores ao levantamento, atualizar os arquivos/testes afetados do plano.

Integração conforme R-021: não empilhar PRs. Cada lote parte da main após a integração do anterior e contém somente suas alterações. Em 28/10/2026, PR 55 foi integrada em `204a5272b85accda76a02ab2c2a7a92385e20371`, PR 60 em `e6e1024a8ef5af1a49cd5ad0026bf73b25309320`, A/PR 61 em `0acac602d0792d28a8743d0a6f2abab81d8777c4`, B/PR 62 em `6b5d703b4f33dded3c3c8fe0081e356108feae32` e C/PR 63 em `5feb4df3152bafaf1d35aab01cbaa9a0760b0865`. A/B/C tiveram CI próprio aprovado e merge manual pelo usuário. D está preparado localmente dessa última base; seus gates externos permanecem pendentes. O registro de validação discrimina heads, runs, contagens reais e a tentativa inicial reprovada de A, seguida de reconciliação após o merge manual de 60, sem enfraquecer testes.

## Review Focus

1. Nomes extensos, dados ausentes e descrições longas: texto legível e ações alcançáveis, sem rolagem horizontal da página. Testes nas tarefas 3, 5, 7 e 10.
2. Tema explícito diferente do sistema, troca de rota e portais: campos, selects, abas e diálogos mantêm o tema, inclusive em toque amplo. Testes nas tarefas 1 e 4.
3. Rascunho, filtros e empresa selecionada: sobreposições e mudanças de apresentação não perdem contexto; respostas atrasadas não sobrescrevem a seleção. Testes nas tarefas 4, 5, 6 e 9.
4. Permissão, pausa, somente leitura e falha: preservar distinção vazio/erro/negado e o bloqueio de escrita existente. Testes nas tarefas 2, 5, 8 e 10.
5. Ordem dos estilos no build de produção e em navegação contínua: o componente conserva medidas depois de visitar outra área. Testes nas tarefas 1, 4 e no fechamento.

## Entregas e ordem

Método executado: implementação e revisão por agentes distintos, tarefa por tarefa, com coordenação central e revisões independentes por área; testes pesados em sequência. Cada tarefa teve teste falhando → mudança mínima → teste passando → captura → commit, com correções de revisão quando necessárias. A implementação dos lotes ocorreu na branch local, conforme Ruling 1; A/B/C já concluíram PR/CI/revisão humana e integração; os gates de D permanecem pendentes.

| Lote | Tarefas | Resultado visível |
| --- | --- | --- |
| A · Base e primeiro uso | 1 a 4 | Controles uniformes, card da Carteira corrigido, listagem piloto e galeria com componentes reais. |
| B · Prospecção | 5 e 6 | Banco de empresas, localização e Google com o mesmo padrão. |
| C · Administração | 7 e 8 | Gestão, Empresas, Listas, importação, Usuários e acesso padronizados. |
| D · Atendimento | 9 e 10 | Meu dia, Funil, fichas e WhatsApp consistentes; revisão final. |

A primeira melhoria direta de tela foi o estado vazio da Carteira, depois da fundação dos componentes e tokens comuns.

## Mapa das diferenças

| Diferença | Tarefa responsável |
| --- | --- |
| D01 · Token ui-muted ausente | 1 |
| D02 · Aviso fixo fora do tema | 2 |
| D03 · Campos Google/WhatsApp | 1, 6 e 10 |
| D04 · Filtros diferentes | 3 e adoção nas tarefas 5 a 10 |
| D05 · Etiquetas locais | 3, 5, 6, 7 e 10 |
| D06 · Medidas e raios concorrentes | 1 |
| D07 · Vazios e erros | 2 e adoção nas demais áreas |
| D08 · Galeria diferente | 4 |
| D09 · Somente leitura e select | 1 |
| D10 · Foco | 1 e 4 |
| D11 · Checkboxes e radios | 5, 6, 8 e 9 |
| D12 · Layout duplicado | 4 e limpeza por consumidor |
| D13 · Referência documental | 1 e fechamento |
| D14 · Mensagens e placeholders | 2, 4 e migração por área |

---

### Tarefa 1: Fundação visual e controles

**Files**
- Modify: src/styles/tokens.css, src/styles/ui.css, app/globals.css.
- Modify: src/components/ui/button.tsx, src/components/ui/input.tsx, src/components/ui/textarea.tsx, src/components/ui/label.tsx, src/components/ui/card.tsx.
- Verify: src/components/ui/native-select.tsx. O componente já encaminha a classe ui-control e suas props/ref; a correção visual desta tarefa fica no CSS compartilhado, com teste do componente real. Não exige alteração artificial de TSX.
- Test: src/components/ui/controles.test.tsx.
- Create/Test: tests/e2e/design-system.spec.ts.

**Interfaces**
- Preservar exports e props React atuais de Button, Input, Textarea, NativeSelect, Label e Card.
- Produzir tokens com os nomes do HTML: --space-1/2/3/4/6/8, --radius-control, --radius-card, --radius-panel, --control-height, --field-size e --card-padding.
- Produzir --ui-muted: var(--muted). Manter os demais --ui-* até migrar seus consumidores.
- No novo E2E, helper local entrar(page: Page, apelido: 'gestore2e' | 'designsystemvazioe2e'): Promise<void>, seguindo tests/e2e/design.spec.ts. A conta vazia nasce em beforeAll com criarUsuarioComSenha(bancoGruposDoHarness(), 'vendedor', 'designsystemvazioe2e', 'Senha-e2e-2026'), apenas no banco descartável.

**Nome do caso principal a acrescentar ou estender:** controles mantêm tema e medidas em desktop e toque.

- [x] Escrever testes de semântica e CSS computado. Exemplo na galeria autenticada:

~~~ts
await page.getByLabel('Tema da galeria').selectOption('light')
await expect(page.getByLabel('Estado', { exact: true }))
  .toHaveCSS('background-color', 'rgb(255, 255, 255)')
await expect(page.getByLabel('Telefone com erro', { exact: true }))
  .toHaveCSS('min-height', '40px')
~~~

Cobrir select habilitado com fundo normal; Input/Textarea readOnly com fundo secundário; aria-describedby; clique no label; disabled e link asChild sem button aninhado. Em contexto hasTouch: true, 1280×900, campos têm fonte 16 px e mínimo 44 px; textarea pode ser maior.

- [x] Rodar RED: npm run test:unit -- src/components/ui/controles.test.tsx. Rodar npm run build:e2e e npm run test:e2e -- --sem-build tests/e2e/design-system.spec.ts. Esperar falha nas novas expectativas, não na preparação/autenticação.
- [x] Centralizar tokens e remover a disputa entre .ui-control e utilitários de altura/foco. Restringir somente leitura a input[readonly]/textarea[readonly]. Manter xs/sm/default por compatibilidade, com mínimo 40 px e diferença de padding; ícones ficam quadrados 40/44 px. lg tem mínimo 44 px. Retirar sombras estáticas de campos/botões para seguir a referência plana.
- [x] Rodar GREEN, typecheck e lint. Pela abrangência global, rodar design.spec.ts e redesign-crm.spec.ts com build de produção, conferindo temas e navegação contínua. Salvar capturas 1920×1080 e 390×844.
- [x] Commit: feat(ui): unificar tokens e controles do design system.

### Tarefa 2: Cards de estado e primeiro uso na Carteira

**Files**
- Modify: src/components/crm/estado-vazio.tsx, src/components/crm/composicoes.module.css.
- Modify: app/carteira/lista.tsx, app/carteira/[id]/page.tsx.
- Verify: app/carteira/carteira.module.css. Os estados migrados usam a composição compartilhada; o CSS antigo ainda atende o aviso de filtros inválidos em page.tsx e fica preservado até a migração dos filtros.
- Test: app/carteira/lista.test.tsx.
- Create/Test: src/components/crm/estado-vazio.dom.test.tsx.
- Extend/Test: tests/e2e/design-system.spec.ts.

**Interfaces**
- EstadoVazio({ titulo, descricao, acao, icone, nivelTitulo }): ReactElement; titulo/descricao string, icone?: LucideIcon, nivelTitulo?: 2 | 3, padrão 2.
- AcaoEstadoVazio = { rotulo: string; href: string; aoAcionar?: never } | { rotulo: string; aoAcionar: () => void; href?: never; desabilitada?: boolean }.
- acao é opcional. Os dois membros de AcaoEstadoVazio aceitam variante?: 'default' | 'outline', padrão default. Início de prospecção usa default; recuperação de filtros usa outline. O componente aplica Button; o consumidor fornece texto e destino/ação. O arquivo atual não tem consumidores e recebe a primeira adoção nesta tarefa.

**Nome do caso principal a acrescentar ou estender:** estado vazio usa card e ação semântica sem elementos interativos aninhados.

- [x] Criar teste jsdom para a composição. Depois de renderizar EstadoVazio com a ação de navegação, conferir:

~~~ts
const link = host.querySelector('a[href="/fila"]')
expect(link?.getAttribute('data-slot')).toBe('button')
expect(link?.closest('[data-slot="card-footer"]')).not.toBeNull()
expect(host.querySelector('a button, button a')).toBeNull()
~~~

Cobrir ação local acionada uma vez, ausência de ação, h2/h3 e texto longo. Em ListaCarteira, distinguir carteira vazia de filtro sem resultado e preservar rota/rótulos/filtros. No E2E da conta vazia, verificar card sólido, raio 10 px e navegação/foco do CTA.

- [x] Rodar RED: npm run test:unit -- src/components/crm/estado-vazio.dom.test.tsx app/carteira/lista.test.tsx; rodar a jornada focada após build E2E.
- [x] Compor EstadoVazio com CardHeader, título, CardDescription e CardFooter/Button. Aplicar à Carteira vazia e ao filtro sem resultado. Trocar o aviso amber fixo de app/carteira/[id]/page.tsx por Alert semântico com role de erro, mantendo texto/condição.
- [x] Rodar GREEN, carteira-visual.spec.ts e design-system.spec.ts. Conferir rota da ficha, filtros e distinção de vazio; capturar os dois estados em claro/escuro.
- [x] Commit: feat(ui): padronizar estados vazios e aplicar na Carteira.

### Tarefa 3: Filtros, tabelas e badges

**Files**
- Create: src/components/crm/painel-filtros.tsx.
- Modify: src/components/crm/composicoes.module.css, src/styles/ui.css, src/components/ui/table.tsx, src/components/ui/badge.tsx.
- Modify: app/carteira/filtros-form.tsx, app/carteira/lista.tsx, app/carteira/carteira.module.css.
- Create/Test: src/components/crm/painel-filtros.test.tsx.
- Test: app/carteira/lista.test.tsx, src/components/ui/controles.test.tsx, tests/e2e/carteira-visual.spec.ts, tests/e2e/design-system.spec.ts.

**Interfaces**
- PainelFiltros({ children, acoes, descricao, className }): ReactElement; children/acoes: ReactNode, descricao?: ReactNode, className?: string.
- O painel compõe Card; não cria form. O Form existente continua dono de action, method, key, submit, estado e parâmetros.
- Table conserva props HTML. crm-registros identifica adaptação para registros empilhados; não forçar esse modo na tabela semanal.
- Badge conserva default/success/warning/danger/outline; significado e texto das situações continuam nos consumidores.

**Nome do caso principal a acrescentar ou estender:** Carteira conserva filtros ao abrir e voltar da ficha.

- [x] Testar painel com um único formulário, campos e ações. Na Carteira, filtrar/abrir/voltar deve conservar nome/UF/retorno. Conferir caption/cabeçalhos, labels móveis, empresa longa e ausência de dados com Ver cliente alcançável.
- [x] Rodar RED dos testes focados e novas expectativas visuais em carteira-visual/design-system.
- [x] Extrair a moldura dos filtros e adotar tabela com células 16 px; migrar o empilhamento comum para 600 px, mantendo rótulos. Remover overrides locais de raio/fundo/padding substituídos pela base. Badge informativo usa 12/18 px e raio 6 px.
- [x] Rodar GREEN, typecheck e lint; conferir 600/601/760/820 px, além de 1920 e 390 px, filtros, volta do navegador e resultado vazio.
**Asserções e verificação focada**

Após filtrar Aurora, abrir e voltar, asserções da jornada:

~~~ts
expect(new URL(page.url()).searchParams.get('nome')).toBe('Aurora')
await expect(page.getByRole('link', { name: 'Ver cliente', exact: true })).toHaveCount(1)
~~~

~~~text
npm run test:unit -- src/components/crm/painel-filtros.test.tsx app/carteira/lista.test.tsx
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/carteira-visual.spec.ts tests/e2e/design-system.spec.ts
~~~

Esperado no GREEN: comandos com saída zero, casos novos executados e nenhuma falha. No RED, a falha precisa demonstrar o requisito antes da alteração.

- [x] Commit: feat(ui): padronizar filtros e registros da Carteira.

### Tarefa 4: Navegação, sobreposições e galeria real

**Files**
- Modify: src/components/crm/shell.tsx, src/components/crm/shell.module.css, src/components/crm/cabecalho-pagina.tsx, src/components/crm/composicoes.module.css.
- Modify: src/components/ui/tabs.tsx, src/components/ui/sheet.tsx, src/components/ui/dialog.tsx, src/styles/ui.css.
- Modify: app/design/page.tsx, app/design/galeria.tsx, app/design/galeria.module.css.
- Test: src/components/crm/shell.test.tsx, src/components/crm/shell.dom.test.tsx, src/components/crm/tema.dom.test.tsx, src/components/ui/tabs.dom.test.tsx.
- Test: app/design/page.test.tsx, app/design/galeria.test.tsx, tests/e2e/design.spec.ts, tests/e2e/redesign-crm.spec.ts, tests/e2e/design-system.spec.ts.

**Interfaces**
- ShellCrm conserva nome, papel, children e area; ampliar apenas area com 'design', título Design system e controle Tema do design system. A página continua exigindo gestor.
- Galeria() passa a renderizar conteúdo dentro do ShellCrm fornecido pela página, com os componentes reais e controlador de tema atual.
- AbasFicha conserva props e painéis keepMounted. DialogContent mantém theme, showCloseButton, className e handlers; larguras específicas de consulta continuam permitidas.

**Nome do caso principal a acrescentar ou estender:** galeria compartilha shell e tema sem perder rascunho no atendimento.

- [x] Testar o mesmo shell/tema entre Gestão e /design, exclusividade do gestor e nenhuma escrita após entrar na galeria. A fixture da guarda em page.test.tsx deve devolver usuarioId/nome/papel. Testar Tab/setas/Escape, tema do portal, retorno de foco e rascunho ainda presente depois de alternar abas.
- [x] Rodar RED de shell/galeria/tabs e jornadas de design/redesign-crm.
- [x] Unificar shell e cabeçalho nas medidas globais. A galeria conserva navegação local de seções no conteúdo, sem duplicar navegação principal. Completar controles/estados/tabelas/cards com componentes React; não embutir o HTML por iframe nem copiar seu JavaScript para o aplicativo.
- [x] Alinhar foco, espaçamento e superfícies de Tabs/Sheet/Dialog, mantendo Base UI/Motion e dimensões necessárias aos detalhes. Os menus do HTML são exemplos; não ocultar ações hoje visíveis em novos menus. Conservar o comportamento atual de tema entre rotas/Sistema; persistência nova após reload não é requisito desta adoção. Atualizar o seletor da tarefa 1 para Tema do design system quando a galeria usar o controle do shell, mantendo suas asserções.
- [x] Rodar GREEN e build E2E. Validar ordem de CSS ao navegar por Usuários, galeria, Carteira e Funil. Vendedor continua sem acesso a /design; a demonstração usa dados fictícios.
**Asserções e verificação focada**

Na jornada de atendimento, depois de digitar a nota e alternar a aba:

~~~ts
await page.getByRole('tab', { name: 'Histórico', exact: true }).click()
await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Rascunho preservado entre abas')
~~~

~~~text
npm run test:unit -- src/components/crm/shell.test.tsx src/components/crm/shell.dom.test.tsx src/components/crm/tema.dom.test.tsx src/components/ui/tabs.dom.test.tsx app/design/page.test.tsx app/design/galeria.test.tsx
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/design.spec.ts tests/e2e/design-system.spec.ts tests/e2e/redesign-crm.spec.ts
~~~

Esperado no GREEN: comandos com saída zero, casos novos executados e nenhuma falha. No RED, a falha precisa demonstrar o requisito antes da alteração.

- [x] Commit: feat(ui): alinhar shell e galeria ao padrao aprovado.
- [x] Fechar lote A com PR/capturas/CI e revisão do usuário antes do lote B. PR 61 integrada manualmente em `0acac602`; CI final run `40708232142` aprovado, após uma tentativa reprovada e reconciliação documental.

### Tarefa 5: Prospecção, Banco de empresas e localização

**Files**
- Create: src/components/ui/choice.tsx.
- Modify: app/fila/central.tsx, app/fila/central.module.css, app/fila/buscar/formulario-completo.tsx, app/fila/buscar/banco.module.css.
- Modify: app/fila/localizar/pessoal.tsx, app/fila/localizar/pessoal.module.css, app/fila/localizar/formulario.tsx.
- Modify: src/components/crm/busca-empresas.module.css, src/components/crm/fontes-busca.tsx, src/components/crm/empresa-encontrada.tsx.
- Modify: app/fila/buscar/empresas-recentes.module.css somente se necessário ao acabamento, preservando a composição.
- Create/Test: src/components/ui/choice.dom.test.tsx.
- Test: app/fila/buscar/formulario.dom.test.tsx, app/fila/localizar/pessoal.dom.test.tsx, src/components/crm/empresa-encontrada.dom.test.tsx.
- E2E: tests/e2e/busca-redesign.spec.ts, tests/e2e/busca-popup.spec.ts, tests/e2e/busca-empresas.spec.ts, tests/e2e/carrossel-empresas-banco.spec.ts, tests/e2e/prospeccao-previa.spec.ts.

**Interfaces**
- Choice(props: Omit<React.ComponentProps<'input'>, 'type'> & { type: 'checkbox' | 'radio' }): ReactElement; preservar ref, name, value, checked/defaultChecked, onChange, required, disabled e ARIA.
- Choice estiliza input nativo. Label/lógica pertencem ao consumidor; área conjunta mínima 44 px. Isso preserva os eventos e o transporte dos formulários atuais, sem dependência nova.
- Reutilizar PainelFiltros, EstadoVazio, Badge e base de controles; nenhum DTO, action ou serviço novo.

**Nome do caso principal a acrescentar ou estender:** Choice conserva transporte nativo e detalhes ignoram resposta atrasada.

- [x] Testar checkbox por clique no label/Espaço, radio por teclado/grupo e envio por FormData. Nos formulários, preservar exclusões, datas, contatos, regiões, UUID e valores ao abrir/recolher filtros. Se A responder depois de selecionar B, os detalhes continuam sendo de B.
- [x] Rodar RED das novas expectativas e testes focados. Reusar mocks e banco loopback do harness, que já limpa chaves dos fornecedores.
- [x] Migrar filtros, campos, estados e badges. Substituir inputs de escolha por Choice sem mudar handlers/valores. Manter os seis grupos do banco e os textos operacionais. Localização pessoal recebe a mesma base de card com ações próprias.
- [x] Preservar carrossel 3/2/1, até 11 empresas, última ação e detalhe selecionado. Não ampliar o resumo com contatos/documentos protegidos. Remover estilo local somente quando o componente/token comum assumir a função.
- [x] Rodar GREEN das cinco jornadas após build. Abrir histórico/detalhes, trocar tema e retomar inclusão não acrescentam aquisições no mock. Nome longo não sobrepõe a ação do card; capturas 1920/820/390 px.
**Asserções e verificação focada**

No teste de Choice, renderizar uma opção telefone marcada dentro de um form e conferir o transporte nativo antes e depois de alternar pelo input. Clique no label e teclado são casos adicionais:

~~~ts
expect(new FormData(form).getAll('contato')).toEqual(['telefone'])
checkbox.click()
expect(new FormData(form).getAll('contato')).toEqual([])
~~~

~~~text
npm run test:unit -- src/components/ui/choice.dom.test.tsx app/fila/buscar/formulario.dom.test.tsx app/fila/localizar/pessoal.dom.test.tsx src/components/crm/empresa-encontrada.dom.test.tsx
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/busca-redesign.spec.ts tests/e2e/busca-popup.spec.ts tests/e2e/busca-empresas.spec.ts tests/e2e/carrossel-empresas-banco.spec.ts tests/e2e/prospeccao-previa.spec.ts
~~~

Esperado no GREEN: comandos com saída zero, casos novos executados e nenhuma falha. No RED, a falha precisa demonstrar o requisito antes da alteração.

- [x] Commit: feat(ui): padronizar Banco de empresas e localizacao.

### Tarefa 6: Planejamento e entregas Google

**Files**
- Modify: app/fila/google/criterios.tsx, app/fila/google/planejamento.tsx, app/fila/google/espelhar.tsx, app/fila/google/entrega.tsx, app/fila/google/entregas.tsx.
- Modify: app/fila/google/google.module.css, app/empresas/google/page.tsx, app/empresas/google/[id]/page.tsx.
- Test: app/fila/google/planejamento.dom.test.tsx, app/fila/google/entrega.test.tsx, app/fila/google/entregas.test.tsx.
- E2E: tests/e2e/google-planejamento.spec.ts, tests/e2e/google-criterios-rodadas.spec.ts, tests/e2e/google-agentes.spec.ts.

**Interfaces**
- Componentes de critérios e planejamento conservam props/handlers. Textarea substitui a marcação local; Choice preserva opções/checked/onChange; Alert/Badge assumem avisos/etiquetas.
- Tabela semanal conserva finalidade, campos, bloqueio de dias e rolagem; não recebe empilhamento comum.

**Nome do caso principal a acrescentar ou estender:** critérios Google mantêm payload e medidas no toque amplo.

- [x] Testar que os critérios em edição são preservados conforme o comportamento atual; cancelar não aplica e salvar conserva payload. Em toque 1280×900, o textarea tem fonte 16 px. Valores e datas bloqueadas continuam corretos.
- [x] Rodar RED dos testes focados e das expectativas visuais da jornada Google.
- [x] Migrar campos, escolhas, avisos, etiquetas e cards; remover textarea/outline locais concorrentes. Preservar seleção do que espelhar, dias, revisões e estado das entregas.
- [x] Rodar GREEN das três jornadas com mock de planilha; nenhuma chamada adicional por mudança visual/cancelamento. Conferir dados ausentes, erro e pausa com os mesmos significados.
**Asserções e verificação focada**

Nos critérios, em contexto hasTouch: true e viewport 1280×900:

~~~ts
const campo = page.getByRole('dialog').locator('textarea').first()
await expect(campo).toHaveCSS('font-size', '16px')
await expect(campo).toHaveCSS('min-height', '96px')
~~~

~~~text
npm run test:unit -- app/fila/google/planejamento.dom.test.tsx app/fila/google/entrega.test.tsx app/fila/google/entregas.test.tsx
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/google-planejamento.spec.ts tests/e2e/google-criterios-rodadas.spec.ts tests/e2e/google-agentes.spec.ts
~~~

Esperado no GREEN: comandos com saída zero, casos novos executados e nenhuma falha. No RED, a falha precisa demonstrar o requisito antes da alteração.

- [x] Commit: feat(ui): alinhar planejamento e entregas Google.
- [x] Fechar lote B com PR/capturas/CI e revisão do usuário. PR 62 integrada manualmente em `6b5d703b`; CI próprio run `40712768226` aprovado.

### Tarefa 7: Gestão, Empresas, Listas e importação

**Files**
- Modify: app/gestao/page.tsx, app/gestao/loading.tsx, app/gestao/error.tsx, app/gestao/gestao.module.css.
- Modify: app/empresas/formulario.tsx, app/empresas/lista.tsx, app/empresas/linha.tsx, app/empresas/empresas.module.css, app/empresas/[id]/perfil.module.css.
- Modify: app/empresas/grupos/apresentacao.tsx, app/empresas/grupos/page.tsx, app/empresas/grupos/controles.tsx, app/empresas/grupos/[id]/page.tsx, app/empresas/grupos/grupos.module.css.
- Modify: app/empresas/importar/formulario.tsx, app/empresas/importar/relatorio.tsx, app/empresas/importar/importar.module.css.
- Modify: app/empresas/busca/conteudo.tsx, app/empresas/busca/limite.tsx apenas na apresentação.
- Test: app/gestao/estados.test.tsx, app/empresas/formulario.dom.test.tsx, app/empresas/grupos/controles.dom.test.tsx, app/empresas/importar/formulario.dom.test.tsx.
- E2E: tests/e2e/gestao.spec.ts, tests/e2e/empresas-visual.spec.ts, tests/e2e/empresas-filtros.spec.ts, tests/e2e/empresas-excel.spec.ts, tests/e2e/grupos-importacao.spec.ts.

**Interfaces**
- Reutilizar composições das tarefas 1–5. Preservar props/exports e a separação dos dados cadastrais e complementos de origem.
- Importação conserva arquivo, conferência, chave, etapas e relatório; parser, normalizador, repositório e migrações não mudam.

**Nome do caso principal a acrescentar ou estender:** Empresas conserva filtros e reflow com dados longos.

- [x] Testar filtros dependentes/paginação e retorno da ficha com contexto, arquivo inválido e conferência sem perder seleção. Loading, erro e zero registros permanecem distintos. Razão social longa e sócios ausentes continuam legíveis e autorizados.
- [x] Rodar RED das novas expectativas nas unidades e cinco jornadas existentes.
- [x] Migrar filtros/tabelas/cards/badges/mensagens. Aplicar Skeleton nos espaços já usados de carregamento e Alert danger nas falhas. Limpar moldura concorrente de página após conferir CSS computado no shell. Preservar indicadores reais da Gestão.
- [x] Rodar GREEN, typecheck e lint. Conferir desktop/celular, ações de gestão alcançáveis e dados sintéticos dos testes.
**Asserções e verificação focada**

Na consulta de Empresas, manter a seleção dependente e o rótulo acessível após a submissão:

~~~ts
await expect(page.getByLabel('Buscar empresas', { exact: true })).toBeVisible()
await expect(page.locator('main form form')).toHaveCount(0)
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
~~~

~~~text
npm run test:unit -- app/gestao/estados.test.tsx app/empresas/formulario.dom.test.tsx app/empresas/grupos/controles.dom.test.tsx app/empresas/importar/formulario.dom.test.tsx
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/gestao.spec.ts tests/e2e/empresas-visual.spec.ts tests/e2e/empresas-filtros.spec.ts tests/e2e/empresas-excel.spec.ts tests/e2e/grupos-importacao.spec.ts
~~~

Esperado no GREEN: comandos com saída zero, casos novos executados e nenhuma falha. No RED, a falha precisa demonstrar o requisito antes da alteração.

- [x] Commit: feat(ui): padronizar gestao e cadastros de empresas.

### Tarefa 8: Usuários, login e troca de senha

**Files**
- Modify: app/usuarios/tabela.tsx, app/usuarios/formulario-criar.tsx, app/usuarios/linha.tsx, app/usuarios/senha.tsx, app/usuarios/usuarios.module.css.
- Modify: app/usuarios/vendedores/[id]/page.tsx, app/usuarios/vendedores/[id]/perfil.module.css.
- Modify: app/login/formulario.tsx, app/trocar-senha/formulario.tsx, src/components/crm/acesso.module.css.
- Test: app/usuarios/usuarios.dom.test.tsx, app/login/formulario.dom.test.tsx.
- E2E: tests/e2e/usuarios-visual.spec.ts e jornada de senha provisória de tests/e2e/redesign-crm.spec.ts.

**Interfaces**
- Preservar formulários/actions e tipos Estado atuais. Choice assume a apresentação de radio; autenticação/geração de senha continuam no fluxo atual.
- Guardas e autoridade do banco permanecem intactas; esconder um botão não substitui autorização.

**Nome do caso principal a acrescentar ou estender:** vendedor continua sem acesso à administração de usuários.

- [x] Testar foco/erro/pendência de autenticação, radio do papel e diálogos administrativos. Senha provisória aparece uma vez; vendedor não administra; gestor não recebe ação para se desativar/rebaixar.
- [x] Rodar RED dos testes de apresentação e conservar as verificações funcionais.
- [x] Migrar filtros, tabela, badges, escolhas e mensagens. Manter autocomplete de usuário/senha, possibilidade de colar e cuidados com dados sensíveis. Ações de contexto usam Button; texto auxiliar conserva sua função.
- [x] Rodar GREEN e conferir portal escuro, cancelamento com retorno de foco e celular. Executar os testes existentes de autorização/usuários no fechamento; não mudar políticas para acomodar o visual.
**Asserções e verificação focada**

Ao autenticar como vendedor e tentar abrir /usuarios, conservar o redirecionamento de segurança:

~~~ts
await page.goto('/usuarios')
await expect(page).toHaveURL('/meu-dia')
await expect(page.getByRole('button', { name: 'Novo usuário', exact: true })).toHaveCount(0)
~~~

~~~text
npm run test:unit -- app/usuarios/usuarios.dom.test.tsx app/login/formulario.dom.test.tsx
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/usuarios-visual.spec.ts tests/e2e/redesign-crm.spec.ts
~~~

Esperado no GREEN: comandos com saída zero, casos novos executados e nenhuma falha. No RED, a falha precisa demonstrar o requisito antes da alteração.

- [x] Commit: feat(ui): alinhar usuarios e acesso ao design system.
- [x] Fechar lote C com PR/capturas/CI e revisão do usuário. PR 63 integrada manualmente em `5feb4df3`; CI próprio run `40716994573` aprovado.

### Tarefa 9: Meu dia, atendimento, Funil e fichas

**Files**
- Modify: app/meu-dia/painel.tsx, app/meu-dia/filtros-form.tsx, app/meu-dia/meu-dia.module.css.
- Modify: app/carteira/[id]/ficha.tsx, app/carteira/[id]/ficha.module.css, app/carteira/registrar-venda.tsx.
- Modify: app/funil/quadro.tsx, app/funil/modal.tsx, app/funil/funil.module.css.
- Modify: app/fila/cartao.tsx, app/fila/formulario.tsx, app/fila/atendimento.module.css.
- Modify: src/features/contato/formulario.tsx, src/features/contato/linha-do-tempo.tsx apenas nos componentes/estilos.
- Test: app/meu-dia/painel.dom.test.tsx, app/carteira/[id]/ficha.dom.test.tsx, app/funil/modal.dom.test.tsx, app/funil/quadro.dom.test.tsx.
- E2E: tests/e2e/meu-dia.spec.ts, tests/e2e/carteira-visual.spec.ts, tests/e2e/funil.spec.ts, tests/e2e/reserva.spec.ts, tests/e2e/redesign-crm.spec.ts.

**Interfaces**
- Preservar FormularioContato, Ficha, Quadro e ModalFunil e suas props atuais. Rascunho, empresaId, posse e callbacks não mudam de responsabilidade.
- Atendimento na empresa B continua usando B após selecionar A/B ou alternar abas. keepMounted conserva os campos.

**Nome do caso principal a acrescentar ou estender:** cancelar descarte preserva rascunho e empresa selecionada.

- [x] Testar rascunho/erro após mudar aba, cancelar descarte e retomar; filtros e seleção ao voltar. Conferir empresa do formulário, reserva expirada/sem escrita e alternativa por botão ao arraste.
- [x] Rodar RED dos testes visuais novos e manter regras/fluxos existentes.
- [x] Migrar molduras, vazios, Choice, campos, avisos e ações. Remover utilitários antigos que alteram raio/padding/fonte dos controles. Conservar lista/ficha, retornos, etapas reais do Funil, confirmação de venda e metadados disponíveis.
- [x] Rodar GREEN das cinco jornadas, com restauração de foco e notas longas em 1920/820/390 px. Contatos protegidos continuam dependendo da autorização existente.
**Asserções e verificação focada**

No diálogo de descarte, depois de preencher a nota e pedir cancelamento:

~~~ts
await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Rascunho que deve sobreviver')
~~~

~~~text
npm run test:unit -- app/meu-dia/painel.dom.test.tsx app/carteira/[id]/ficha.dom.test.tsx app/funil/modal.dom.test.tsx app/funil/quadro.dom.test.tsx
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/meu-dia.spec.ts tests/e2e/carteira-visual.spec.ts tests/e2e/funil.spec.ts tests/e2e/reserva.spec.ts tests/e2e/redesign-crm.spec.ts
~~~

Esperado no GREEN: comandos com saída zero, casos novos executados e nenhuma falha. No RED, a falha precisa demonstrar o requisito antes da alteração.

- [x] Commit: feat(ui): padronizar atendimento e fichas comerciais.

### Tarefa 10: WhatsApp e consolidação

**Files**
- Modify: app/whatsapp/painel.tsx, app/whatsapp/whatsapp.module.css, app/whatsapp/midia-mensagem.tsx, app/whatsapp/error.tsx.
- Modify: app/whatsapp/configuracao/formulario.tsx, app/whatsapp/configuracao/configuracao.module.css.
- Test: app/whatsapp/painel.dom.test.tsx, app/whatsapp/midia-mensagem.dom.test.tsx, app/whatsapp/configuracao/formulario.dom.test.tsx.
- E2E: tests/e2e/whatsapp-visual.spec.ts.
- Docs: docs/design/design-system-atual.md.
- Create/Docs: docs/design/2026-10-27-design-system/validacao.md, registro da adoção.

**Interfaces**
- Preservar PainelWhatsApp e suas props atuais de conversas, cursores, origens e mídia. Reutilizar Input, Badge, Button, Alert e Dialog.
- Filtro pressionável mantém aria-pressed; Badge continua informativo. Layout amplo e alternância lista/conversa permanecem.

**Nome do caso principal a acrescentar ou estender:** busca do WhatsApp usa campo comum e mantém seleção e foco.

- [x] Testar busca com 14 px no desktop e 16 px no toque/celular, raio/foco comum. Cobrir nome longo, conversa sem nome, mídia indisponível, seleção e retorno de foco ao fechar imagem. Nenhuma ação de envio nova.
- [x] Rodar RED dos testes focados e das novas expectativas de estilo.
- [x] Remover overrides locais da busca e padronizar etiquetas, estados e ações de ficha/configuração. Preservar controles de mídia, limites do histórico, filtros e segredos mascarados.
- [x] Rodar GREEN com mock local, typecheck e lint. Revisar --ui-*, valores repetidos e CSS sem consumidor; remover somente o que foi substituído e verificado.
**Asserções e verificação focada**

Depois de carregar a instância de teste e o painel de conversas, em celular/toque:

~~~ts
await expect(page.getByRole('searchbox', { name: 'Buscar conversa', exact: true })).toHaveCSS('font-size', '16px')
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
~~~

O rótulo existente é Buscar conversa e o placeholder é Nome, telefone ou mensagem. Conservar ambos; o teste usa o nome acessível do campo.

~~~text
npm run test:unit -- app/whatsapp/painel.dom.test.tsx app/whatsapp/midia-mensagem.dom.test.tsx app/whatsapp/configuracao/formulario.dom.test.tsx
npm run build:e2e
npm run test:e2e -- --sem-build tests/e2e/whatsapp-visual.spec.ts
~~~

Esperado no GREEN: comandos com saída zero, casos novos executados e nenhuma falha. No RED, a falha precisa demonstrar o requisito antes da alteração.

- [x] Commit: feat(ui): alinhar WhatsApp e concluir adocao visual.
- [ ] Fechar lote D somente após o protocolo final abaixo.

## Fechamento e critérios de conclusão

- [x] Rodar npm run test:unit, npm run typecheck, npm run lint e npm run db:checar. Unidade: 200 arquivos, 1793 passes/1 skip no head `2a643ff`; 39 unidades afetadas após a correção `17554c1`. Tipos/lint com saída zero repetidos em `ee2ff959`; db:checar aprovado em `17554c1`, sem mudança posterior de banco.
- [x] Rodar npm run test:integracao no banco descartável, mantendo as proteções locais. Preservar testes de usuários, identidade, Casa dos Dados, filtros adicionais, inclusão automática e prospecção pessoal. Não criar migração para alterar apresentação.
- [x] Rodar npm run build:e2e e npm run test:e2e -- --sem-build para a suíte completa. Resultado final no head `ee2ff959`: saída 0, 104 passes/0 falhas/0 skips em 6,8 min; primeira rodada não aprovada preservada no registro. O guia local do Next informa que a ordem de CSS pode diferir do desenvolvimento; validar build de produção.
- [x] Registrar as capturas e medições reais por papel autorizado, distribuídas nas tarefas: desktop, intermediárias, celular e reflow de 320 px; quebras 600/601 e contêineres 480/670/1120; toque amplo, temas, teclado e redução de movimento nos casos cobertos. As dimensões de referência foram 1920×1080, 1280×900, 820×900 e 390×844, além das alturas próprias dos ensaios. Quatro imagens foram selecionadas na validação; não se declara uma matriz exaustiva de áreas/aparelhos/motores.
- [x] Registrar os pares efetivamente medidos e seus limites de contraste: a ficha escura em 390 px confirmou contraste de 13,059:1 e opacidade 1; os ensaios e pares de tokens estão discriminados na validação. Metas: texto comum ≥4,5:1; controles/foco ≥3:1. Contraste não medido não recebe certificação integral, conforme limite Declined aceito; hex isolado não certifica a interface.
- [x] Fazer revisão Web Design Guidelines com fonte atual e revisão independente final de toda a adoção. Código e escopo final `ee2ff959` aprovados; revisão ampla do conjunto e suplemento documental aprovados em `61cb5ee`. Esta reconciliação posterior aguarda revisão própria do lote D. Incluir contexto, permissões, respostas atrasadas e falhas; registrar os achados e sua resolução.
- [x] Corrigir achados impeditivos com teste RED/GREEN e rever as verificações afetadas. Os achados por tarefa e o Minor Google final foram resolvidos e reaprovados; não há achado de produto aberto no escopo revisado. Não declarar conformidade integral de leitor de tela/zoom sem seus ensaios.
- [x] No registro de validação, mapear D01–D14 para implementação, testes, capturas e commit. Atualizar o inventário conforme a adoção e preservar o HTML aprovado como referência histórica.
- [ ] PR do lote D com CI verde, revisão humana, documentação final e merge. D está preparado localmente; nenhuma contagem futura de CI é declarada aprovada. A adoção termina quando todos os consumidores mapeados foram verificados, além dos componentes básicos.
- [ ] Publicação fora do plano e não realizada. O vínculo Git da Vercel foi identificado antes do merge 55; `git.deploymentEnabled.main=false` e o procedimento de publicação manual protegem essa condição, sem alteração de configurações externas. A API após o merge C confirmou produção inalterada. Implantação exige solicitação própria e fonte validada.

## Limites da implementação

Status do fechamento local: unidade, integração, tipos, lint, db e build aprovados nas revisões discriminadas na validação. A primeira rodada E2E teve cinco falhas e não foi aprovada; a onda única `ee2ff959` teve 6/6 focados e o E2E completo final 104/104, com fixture do dia 28. Revisão ampla/Guidelines de código e scoped final concluídos, sem achado de produto aberto. O servidor registrou três eventos de stream encerrado cedo no E2E final, com jornadas aprovadas; causa não confirmada, observação não impeditiva e não declarada resolvida. O suplemento documental e o conjunto foram aprovados em `61cb5ee`; esta reconciliação posterior aguarda revisão própria. Os seis Rulings originais, os três Rulings de integração e os seis limites Declined permanecem recuperáveis na validação. A/B/C têm checkpoints remotos concluídos; D mantém PR/CI/revisão humana/merge pendentes e publicação fora do plano. Os 17 alertas de dependências do GitHub (2 críticos, 7 altos, 7 moderados e 1 baixo) seguem sem triagem para acompanhamento separado, sem mudanças de dependências ou atribuição de causa.

Aprovar a aparência não autoriza esconder campos, reduzir controles de segurança, converter erro em vazio ou perder informação para fazer o layout caber. Se for necessário alterar action, DTO, repositório, serviço, SQL, cota, RLS, workflow ou planilha, registrar o motivo e reavaliar o escopo antes dessa mudança.

## Conferência do planejamento

- Cobertura: as 14 diferenças do inventário estão vinculadas às tarefas, e a referência HTML aprovada continua sendo a especificação visual.
- Passos: cada entrega separa teste, mudança, verificação e commit; arquivos e comandos estão indicados.
- Interfaces: EstadoVazio, PainelFiltros e Choice têm contratos definidos; consumidores preservam as APIs existentes.
- Revisão: os cinco riscos de Review Focus estão distribuídos nos testes das tarefas responsáveis.
- Proporção: os exemplos fixaram asserções e valores, e a implementação dos componentes foi executada nas dez tarefas; resultados e limites permanecem discriminados no registro de validação.

## Revisão do plano e escolha de execução

Escolha executada: implementação e revisão por agentes distintos em cada tarefa, seguidas de revisão independente do conjunto. As interfaces comuns foram estabilizadas no lote A e os consumidores adotados em sequência. As dez revisões focadas foram concluídas, inclusive a reaprovação do WhatsApp após a rodada de correção `17554c1`.

A revisão ampla/Guidelines e a revisão do escopo final, incluindo o suplemento documental, foram aprovadas em `61cb5ee` em 28/10/2026, sem Critical/Important/Minor aberto. Esta reconciliação documental aguarda revisão própria do lote D. PRs 55/60 e os lotes A/B/C estão integrados; D está preparado localmente, com PR, CI remoto, revisão humana e merge pendentes. A implementação não foi publicada. Esta atualização registra a execução do plano originalmente entregue em 27/10/2026, sem apagar suas restrições ou antecipar resultados pendentes.
