# Design system atual do CRM

Data do levantamento: 27/10/2026. Estado: inventário da implementação e verificação de consistência. As diferenças registradas permanecem para decisão e correção em uma etapa posterior.

**Os elementos ainda não seguem integralmente o mesmo padrão.** Cores, fonte, navegação principal e componentes básicos têm uma base comum. Filtros, etiquetas, mensagens, campos de critérios do Google e a própria galeria apresentam diferenças. Há também um token sem definição e um aviso que usa cores fixas fora do tema.

## Versão e alcance

- Código examinado: `073a90af4a398f93b55a1a5e98ca3b173c4fa6f2`, ponta da branch `codex/redesign-crm` no levantamento.
- Fonte publicada de referência: `473f0df9377d33c305ba1ea63850b1c5790ab883`. A diferença até `073a90a` contém somente três documentos; a interface é a mesma.
- [PR 55](https://github.com/Browsher/crm/pull/55): aberto, em rascunho e sem merge na conferência. A `main` e o checkout de campanhas ainda não representam esta interface.
- Varredura: **137 arquivos TSX de aplicação e 31 arquivos CSS**, sem arquivos de teste, em `app/`, `src/components/`, `src/styles/` e `src/features/`. Há **27 arquivos de página** e **14 módulos de componentes básicos de UI**. As contagens representam arquivos e ocorrências no código, não quantidade de elementos renderizados ou cobertura de testes.
- Conferência manual dos componentes compartilhados e das composições de acesso, Meu dia, Prospecção, Banco de empresas, localização pessoal, planejamento Google, Carteira, Funil, Empresas, Listas, Gestão, Usuários e WhatsApp.
- Verificação das diferenças por leitura de código, cálculo dos pares de contraste e ensaios locais de CSS em Chromium com elementos fictícios: 1920 × 1080 sem toque, 390 × 844 com toque e 1280 × 900 com toque.

O ensaio local de CSS não executa as páginas autenticadas do CRM. A revisão completa de cada tela e estado no navegador, inclusive zoom e leitor de tela, continua pendente. Os registros anteriores de E2E e capturas são referências da entrega anterior; não foram executados novamente neste levantamento. Não houve consulta paga, alteração operacional, acesso ao banco de produção ou mudança visual da aplicação.

As referências de código abaixo são relativas à revisão auditada. Os links de fonte fixam essa revisão para que o documento continue verificável mesmo quando hospedado em uma branch diferente.

## Onde o sistema visual está definido

| Camada | Fonte atual | Responsabilidade |
| --- | --- | --- |
| Cores semânticas e temas | [src/styles/tokens.css][tokens] | Valores de claro, escuro e preferência do sistema. |
| Mapeamento Tailwind e base global | [app/globals.css][globals] | Utilitários semânticos, raios, fonte, foco, alturas mínimas, toque e redução de movimento. |
| Compatibilidade e estilos compartilhados | [src/styles/ui.css][ui] | Aliases `--ui-*`, controles, Badge, Alert, Dialog e tabelas responsivas. |
| Componentes básicos | `src/components/ui/` | Componentes shadcn adaptados, abas e utilitário de composição. |
| Composições do CRM | `src/components/crm/` | Shell, cabeçalho, breadcrumb real, fichas, buscas, etapas e estados. |
| Estilos das telas | `app/**/*.module.css` | Composição por tarefa e diversas variações ainda locais. |
| Configuração shadcn | `components.json` | Estilo `new-york`, base `zinc`, variáveis CSS, Lucide e aliases em `src/`. |
| Galeria existente | `app/design/` | Demonstrações com dados fictícios, exclusivas do gestor. |

A cadeia global é `app/globals.css` → `tokens.css` e `ui.css`. Classes utilitárias do Tailwind coexistem com CSS Modules e CSS compartilhado sem camada. Essa combinação exige conferir a cascata: uma declaração local não é necessariamente o valor final na tela.

Base técnica observada: Next.js 16.3.8, React/React DOM 19.2.8, Tailwind 4, `radix-ui`, `@base-ui/react`, `motion`, `lucide-react`, `class-variance-authority` e `tailwind-merge`.

## Cores e tokens semânticos atuais

Valores equivalentes a `#fff` foram escritos por extenso para facilitar a leitura. Esta tabela registra o código atual.

| Token | Uso | Claro | Escuro |
| --- | --- | --- | --- |
| `--canvas` | Fundo de trabalho | `#F5F6F8` | `#151B22` |
| `--background` | Superfície principal | `#FFFFFF` | `#1C242D` |
| `--foreground` | Texto principal | `#202A35` | `#E6EBEF` |
| `--surface-muted` | Superfície secundária | `#FAFBFC` | `#182029` |
| `--muted` | Fundo neutro de apoio | `#F0F3F5` | `#27323E` |
| `--muted-foreground` | Texto secundário | `#65707D` | `#A3AEB9` |
| `--border` | Borda estrutural | `#E1E5E9` | `#34404D` |
| `--input` | Borda de controle | `#8793A0` | `#657787` |
| `--primary` | Ação principal | `#17634D` | `#8FD0B9` |
| `--primary-foreground` | Texto sobre a primária | `#FFFFFF` | `#163C30` |
| `--ring` | Foco | `#17634D` | `#8FD0B9` |
| `--success` | Texto de sucesso | `#17634D` | `#A0D9BD` |
| `--success-background` | Fundo de sucesso | `#EDF6F1` | `#203D33` |
| `--warning` | Texto de atenção | `#8A5216` | `#EDC38B` |
| `--warning-background` | Fundo de atenção | `#FFF7E8` | `#403322` |
| `--destructive` | Erro e ação destrutiva | `#A44537` | `#EDB0A7` |
| `--destructive-foreground` | Texto sobre ação destrutiva | `#FFFFFF` | `#442C2A` |
| `--danger-background` | Fundo de erro | `#FFF1EF` | `#442C2A` |

Aliases existentes:

| Família | Mapeamento |
| --- | --- |
| Superfícies | `--card` e `--popover` → `--background`; respectivos `*-foreground` → `--foreground`. |
| Ações secundárias | `--secondary` e `--accent` → `--muted`; respectivos `*-foreground` → `--foreground`. |
| Navegação lateral | `--sidebar` → `--surface-muted`; texto → `--foreground`; seleção → `--success-background`; texto da seleção → `--primary`. O shell também aplica esses valores diretamente. |
| Compatibilidade de superfícies | `--ui-background` → `--background`; `--ui-surface` → `--surface-muted`; `--ui-foreground` → `--foreground`; `--ui-muted-foreground` → `--muted-foreground`. |
| Compatibilidade de controles | `--ui-border` → `--border`; `--ui-border-control` → `--input`; `--ui-primary` → `--primary`; `--ui-primary-foreground` → `--primary-foreground`; `--ui-focus` → `--ring`. |
| Compatibilidade de estados | `--ui-success`/`--ui-warning` e seus fundos → tokens de sucesso/atenção; `--ui-danger` → `--destructive`; `--ui-danger-background` → `--danger-background`. |
| Tailwind | `bg-background`, `text-foreground`, `bg-primary`, `border-border`, `border-input`, `ring-ring` e demais pares expostos em `@theme inline`; `brand` é alias de `primary`. |

Os 31 arquivos CSS não têm valores hexadecimais de cor fora de `tokens.css`. Há preto com transparência para sombra e sobreposição. A aplicação ainda tem utilitários de paleta fixa em TSX; portanto essa centralização dos hexadecimais não significa adesão completa aos tokens.

**Token ausente:** `--ui-muted` é usado em seis declarações e não é definido nem tem fallback. `--muted` existe, mas não é automaticamente o mesmo nome. Ver diferença D01.

### Contraste dos pares definidos

Cálculo pela luminância relativa sRGB, usando os valores hexadecimais dos tokens, opacidade integral, sem hover, sobreposições ou misturas. Os números verificam esses pares específicos; não certificam todas as combinações da interface.

| Par | Claro | Escuro |
| --- | --- | --- |
| Texto principal / superfície principal | 14,54:1 | 13,06:1 |
| Texto secundário / superfície principal | 5,04:1 | 6,95:1 |
| Texto secundário / fundo de trabalho | 4,66:1 | 7,68:1 |
| Texto da primária / primária | 7,17:1 | 6,90:1 |
| Sucesso / fundo de sucesso | 6,51:1 | 7,40:1 |
| Atenção / fundo de atenção | 5,98:1 | 7,45:1 |
| Erro / fundo de erro | 5,48:1 | 6,93:1 |
| Texto destrutivo / destrutivo | 6,03:1 | 6,93:1 |
| Borda de controle / superfície principal | 3,13:1 | 3,39:1 |
| Foco / superfície principal | 7,17:1 | 8,88:1 |

Os oito pares de texto acima superam 4,5:1. Os dois pares de controle/foco superam 3:1. A borda estrutural suave não é a borda destinada a identificar campos.

## Tipografia, espaçamento, tamanhos e ícones

| Elemento | Implementação atual |
| --- | --- |
| Fonte | `'Segoe UI', system-ui, sans-serif`; sem nova requisição de fonte. O aspecto depende da fonte disponível no dispositivo. |
| Corpo | 14 px / 21 px no `body` e em `.crm-ui`. |
| Título de página no shell | 28 px / 36 px, peso 650; até 820 px: 24 px / 32 px. |
| Título de seção e diálogo | Referência da galeria e Dialog: 18 px / 26 px, peso 600. Há seções reais em 16, 17 e 20 px. |
| Título de registro | Comum em 14 ou 16 px, peso 600; Últimas buscas tem escala própria. |
| Texto auxiliar | 12 px / 18 px na galeria e Badge. Telas também usam 10, 11 e 13 px. |
| Rótulos | `Label` usa 14 px/peso 500; filtros locais também usam 13 ou 14 px, com associações por `label` nativo. |
| Números comparáveis | `font-variant-numeric: tabular-nums` em contadores, datas e indicadores selecionados. Não há regra global para todos os números. |
| Espaçamento de referência | 4, 8, 12, 16, 24 e 32 px na especificação anterior. Não há escala de espaçamento semântica centralizada; os módulos também usam 6, 10, 14, 18, 20 e 22 px. |
| Raios expostos ao Tailwind | `sm` 4 px, `md` 6 px, `lg` 8 px, `xl` 10 px. `--radius: .5rem` também existe em tokens, mas os raios do `@theme` usam valores próprios. |
| Bordas | Em geral 1 px; foco e marcadores de estado têm espessuras próprias. |
| Sombras | Card básico sem sombra; controles shadcn usam `shadow-xs`; Dialog usa 0 16 px 40 px com preto a 20%; overlay usa preto a 55%. |
| Ícones | Lucide. Botões usam 16 px por padrão e 12 px em `xs`; navegação 18 px; marca 21 px; outros contextos usam 14, 17, 20, 22, 24 ou 28 px. |

Essas variações de ícone e título podem expressar hierarquia. Falta um contrato central que diga quais variantes usar em cada função.

### Alturas e áreas de interação

- `Button` declara alturas nominais de 24 px (`xs`), 32 px (`sm`), 36 px (padrão) e 40 px (`lg`). `app/globals.css:43` impõe mínimo de **40 px a todos os botões com `data-slot='button'`**. Os nomes das variantes, portanto, não representam alturas finais distintas abaixo de 40 px.
- Variantes de ícone têm larguras nominais de 24, 32, 36 e 40 px. A altura mínima global pode produzir um botão de ícone retangular no desktop.
- Até 820 px, ou com ponteiro principal de toque, os botões têm mínimo de **44 px**. Botões com `aria-label` também recebem largura mínima de 44 px.
- `Input` e `NativeSelect` têm mínimo global de 40 px no desktop e 44 px no celular/toque. Até 820 px, a base compartilhada usa fonte de 16 px, sujeita às sobrescritas locais. Acima de 820 px com ponteiro principal de toque, NativeSelect e Textarea mantêm 14 px: `.ui-control` prevalece sobre a regra global, e sua mídia de toque só altera a altura.
- `Textarea` combina classes shadcn e `.ui-control`. O CSS sem camada de `.ui-control` define mínimo de 40/44 px e padding de 8 × 12 px, sobrepondo parte das utilidades do componente. O tamanho final também depende de conteúdo, linhas e altura natural.
- O textarea próprio dos critérios do Google tem mínimo de 64 px e padding de 8 × 10 px; mantém fonte herdada de 14 px no ensaio de celular. A busca do WhatsApp usa `Input`, mas seu CSS local impõe 13 px, padding de 10 × 12 px e raio de 8 px, inclusive no celular.
- Checkboxes e radios são nativos. Há caixas de 16 px nos filtros do banco/Google e de 18 px nos limites/conferência. A área do rótulo precisa ser considerada separadamente do tamanho do desenho.

## Catálogo de componentes existentes

As contagens abaixo indicam arquivos TSX não destinados a testes que importam diretamente cada módulo, incluindo a galeria. Um componente compartilhado pode atender várias telas sem importação direta em cada uma.

| Elemento | Base e variantes atuais | Adoção direta | Consistência observada |
| --- | --- | --- | --- |
| Botões | `Button`: default, destructive, outline, secondary, ghost, link; tamanhos de texto e ícone; `asChild`. | 72 arquivos | Base compartilhada ampla; alturas globais alteram o significado dos tamanhos. |
| Campos | `Input`: tipos nativos, foco, erro e disabled por utilitários shadcn. | 21 arquivos | Não usa `.ui-control`, ao contrário de Select/Textarea; visual de somente leitura não é o mesmo. |
| Selects | `NativeSelect` com `.ui-control`; aparência nativa. | 15 arquivos | Há uma base comum. Não há componente de select customizado instalado. |
| Áreas de texto | `Textarea` com `.ui-control` e classes shadcn. | 6 arquivos | Critérios do Google têm outra implementação. |
| Rótulos | `Label` baseado em Radix; também há `label` nativo envolvendo o controle. | 6 arquivos | Associação semântica pode ser correta nos dois caminhos; estilo não é único. |
| Cards | `Card` e Header/Title/Description/Action/Content/Footer; raio 10 px e espaçamento nominal de 24 px. | 15 arquivos | CSS das telas altera composição, padding e raio. Cards de tarefas diferentes não precisam ter a mesma proporção. |
| Tabelas | `Table` e peças semânticas; wrapper com rolagem horizontal. | 7 arquivos | Convivem com tabela nativa de planejamento e de perfil do vendedor; há diferentes densidades e adaptações móveis. |
| Badges | `Badge`: default, success, warning, danger, outline; 12/18 px, raio 6 px, padding 2 × 8 px. | 11 arquivos | Google e WhatsApp também desenham etiquetas próprias. |
| Abas | `TabsRoot`, List, Tab, Panel e Indicator; underline, pill e segment. | 2 arquivos | Abas de ficha e galeria; navegação entre rotas usa links próprios. |
| Diálogos | `Dialog` Radix; tema explícito, título, descrição, footer e fechar; largura padrão até 512 px. | 16 arquivos | Base compartilhada; composições ampliam para 780, 900 ou 1240 px conforme conteúdo. |
| Menu móvel | `Sheet` Radix, acionado pelo shell. | 1 arquivo | Menu compartilhado e fechamento acessível; navegação desktop também é compartilhada. |
| Mensagens | `Alert`: default, success, warning e danger; título e descrição opcionais. | 20 arquivos | Também há mensagens em `p`/`div` com `role` e estilos locais. |
| Carregamento | `Skeleton`, com pulsação e redução global de movimento. | 2 arquivos | Galeria e carregamento da Gestão; outros fluxos usam textos e estados dos botões. |
| Breadcrumb básico | `Breadcrumb` e peças do registro shadcn. | 0 arquivos | O breadcrumb real é `CaminhoCrm`, com marcação própria. |

Não há módulos compartilhados `DropdownMenu`, `Tooltip`, `Popover`, `Checkbox`, `RadioGroup` ou `AlertDialog` em `src/components/ui/` nesta revisão. Ações de usuário ficam visíveis na tabela; confirmação usa `Dialog`. Sua ausência não obriga instalar esses componentes: a decisão depende de uma necessidade de interação e consistência.

As abas são a contribuição identificada do catálogo 21st: SmoothUI, adaptadas com Base UI e Motion. A fonte e as adaptações estão registradas em `docs/design/2026-10-22-redesign/fontes-componentes.json` e na especificação do redesign. Não houve nova obtenção paga de componentes.

Além dos componentes básicos, existem `ShellCrm`, `CabecalhoPagina`, `CaminhoCrm`, `AbasFicha`, `Etapas`, composições de busca/ficha e `EstadoVazio`. Este último está definido, mas não possui consumidores TSX nesta revisão; as telas constroem seus vazios localmente.

### Ocorrências nativas e exceções legítimas

A varredura encontra 36 inputs ocultos e 11 ocorrências de inputs visíveis nativos fora dos componentes de UI: oito checkboxes e três radios. São ocorrências de código; os laços podem renderizar várias opções. Não há campo de texto cru entre essas ocorrências.

Há dez ocorrências de `button` e duas de `table` fora de `src/components/ui/`, além do textarea do Google. Elas incluem registros selecionáveis, cards do Funil, etapas, expansores, conversas e ampliação de mídia. Esses elementos devem conservar sua semântica e área de interação; trocar todos por um botão de ação visual idêntico seria inadequado.

## Layouts, hierarquia e densidade

O shell real usa sidebar de **224 px**, recolhível para **76 px** acima de 820 px. Topbar tem mínimo de **60 px**. O conteúdo principal usa máximo de **1420 px**, padding de **30 × 32 px** e, até 820 px, **24 × 16 px**. No celular a navegação lateral abre em Sheet.

Módulos de página ainda declaram máximos de 1180, 1200, 1280 ou 1440 px. A regra `.conteudo main` do shell tem especificidade maior que uma simples `.pagina`, de modo que esses valores locais não comprovam diferenças efetivas de largura. O WhatsApp sobrescreve expressamente o shell com `main.pagina.pagina` para ocupar a área disponível. Trata-se de convivência de regras que precisa ser simplificada com cuidado.

| Área | Composição atual | Pontos a conferir ao padronizar |
| --- | --- | --- |
| Login e troca de senha | Apresentação lateral e formulário até 360 px; apresentação some até 820 px. | Mesmos Input, Button e Alert; respeitar o fluxo de senha provisória. |
| Meu dia | Lista de retornos e ficha; seleção destacada. Abaixo de 860 px, lista e ficha alternam com Voltar. | Filtro com superfície secundária e raio 12 px; rótulos e foco locais. |
| Carteira | Tabela no desktop e registros empilhados até 760 px; ficha com histórico. | Padding de células 20 × 16 px, diferente do padrão geral de registros. Há CSS antigo de cards que não é usado pela lista atual. |
| Prospecção | Central por tarefa, retomada e atendimento por etapas. | Preservar a reserva e o contexto; expansores e etapas são composições específicas. |
| Banco de empresas | Seis grupos recolhíveis de critérios, histórico em diálogo e Últimas buscas. | Paddings e rótulos locais; respeitar as exceções já aprovadas dos cards recentes. |
| Localizar empresas | Filtros principais/adicionais e resultados em cards. | Filtros com raio 8 px e padding 20 px; rótulos 13 px. |
| Google | Planejamento semanal em tabela, critérios em diálogo e entregas. | Campo de critérios próprio, etiquetas próprias e token ausente. A tabela preserva rolagem para a semana. |
| Funil | Quadro com três etapas, cards de negociação e diálogo. No celular, colunas empilhadas. | Manter alternativa por botão ao arraste; cards são registros de trabalho. |
| Empresas e Listas | Filtros, tabelas responsivas, paginação e fichas; importação por etapas. | Filtro de Empresas branco/raio 8 px; várias composições de vazio. |
| Gestão | Indicadores, pendências, equipe e atividade; loading/error próprios. | Mesmo padrão básico, mas vazio e mensagens ainda têm estilos locais. |
| Usuários e perfil | Tabela administrativa, filtros e diálogos; perfil com tabela própria. | Filtros com raio 12 px; tabela de perfil tem rolagem móvel e densidade própria. |
| WhatsApp | Lista, conversa e contexto; contexto some em larguras menores; alternância lista/conversa no celular. | Etiquetas e filtros em pílulas; layout amplo é uma variação funcional. |
| Galeria `/design` | Demonstração de controles, estados, cards, abas e atendimento fictício. | Shell próprio diferente do real; cobertura incompleta do sistema atual. |

### Contrato preservado de Últimas buscas

Até 11 empresas recentes e um último card **Ver todas buscas**. Exibe três cards quadrados no desktop, dois na faixa intermediária e um no celular. As quebras em 670 e 480 px são da largura do contêiner, não diretamente da janela. A partir de 1120 px de contêiner aparecem os dados ampliados; até 900 px há ajustes de densidade.

O título tem destaque, grupo de origem e textos em uma linha com reticências. Desktop amplo mostra nicho, endereço, porte, abertura e indicadores de telefone/e-mail. **Ver empresa** abre o resultado correspondente em diálogo. Essas escolhas são referência aprovada e não se estendem automaticamente a outros cards.

## Estados e acessibilidade

| Estado ou interação | O que existe | Consistência |
| --- | --- | --- |
| Claro, escuro e Sistema | Tokens em CSS, `color-scheme` e provider global com `data-theme`; o provider acompanha `prefers-color-scheme`. | Base comum. Tema fica em memória; não há persistência da escolha em armazenamento no provider. A galeria mantém escolha local própria. |
| Foco | Regra global de 3 px e componentes com rings; regras locais de 2 ou 3 px. | Visibilidade prevista, mas espessura/offset variam. Revisão completa da ordem de foco depende das páginas no navegador. |
| Diálogo | Radix, título/descrição e tema passado pelos consumidores; casos de restauração explícita de foco. | Base comum; verificar cada contexto e conteúdo longo na revisão visual. |
| Desabilitado | Opacidade de 50% em Input/Button; `.ui-control` usa 60% e fundo secundário; ações usam `disabled` durante pendência. | Tratamento visual diferente conforme o caminho CSS. |
| Somente leitura | Prop `readOnly`, texto explicativo em vários fluxos e fundo secundário em `.ui-control:read-only`. | Input não recebe essa classe. O seletor também alcança selects editáveis. |
| Carregamento | `aria-busy`, texto em botão e `role='status'`; Skeleton em Gestão/galeria. | Varia por fluxo; não há uma composição única para todos os carregamentos. |
| Vazio | Instruções e ação de recuperação em vários contextos. | Há vazio simples, tracejado, Card e componente compartilhado sem uso. |
| Erro | Alert danger, erros inline, `aria-invalid`, `role='alert'`, tentativa novamente em alguns fluxos. | Alguns erros usam estilos de vazio ou aviso; ver D02/D07. |
| Sucesso e atenção | Alert, Badge e texto com `role='status'` ou `role='alert'`. | Paleta comum; nem todas as mensagens usam a mesma composição. |
| Menu e navegação | Links, `aria-current`, botão de menu nomeado, Sheet e link de pular ao conteúdo. | Compartilhado no shell real; galeria tem outra implementação. |
| Movimento | Redução global de duração; abas usam `useReducedMotion`; módulos reduzem animação local. | Tratamento existente; confirmar o efeito combinado na revisão das páginas. |
| Textos longos | `min-width:0`, quebra de texto e reticências nos cards recentes. | Estratégias diferentes adequadas ao conteúdo; testar valores extremos por contexto. |
| Toque | Mínimos globais de 44 px para botões e controles identificados por `data-slot`. | Checkboxes/radios e textarea próprio precisam de contrato próprio. |

## Diferenças encontradas

Prioridade indica a ordem sugerida para uma futura padronização visual. Todos os itens abaixo estão **registrados e sem alteração de código**. Variações de composição não implicam falha de regra de negócio.

| ID | Prioridade | Evidência na revisão auditada | Diferença e efeito |
| --- | --- | --- | --- |
| D01 | Alta | `app/fila/google/google.module.css:7,66,68,83`; `src/components/crm/busca-empresas.module.css:6,21`; definições em `src/styles/ui.css:1` | `--ui-muted` não tem definição/fallback. Fundos de etiquetas, dados, totais e navegação de fontes não recebem a cor pretendida. O ensaio CSS confirmou fundo transparente na etiqueta neutra do Google. |
| D02 | Alta | `app/carteira/[id]/page.tsx:32` | O ramo de erro de consulta usa `border-amber-300 bg-amber-50` com texto herdado, enquanto os demais avisos usam tokens/Alert. O fundo não acompanha o tema escuro; o par final e seu contraste precisam de conferência visual. A mensagem também não tem `role='alert'`. |
| D03 | Alta | `app/fila/google/criterios.tsx:27`; `app/fila/google/google.module.css:42,43`; `app/whatsapp/painel.tsx:213`; `app/whatsapp/whatsapp.module.css:52`; `app/globals.css:49`; `src/styles/ui.css:87,92` | Campos escapam do padrão móvel. O textarea do Google tem implementação própria: no ensaio de 390 px ficou em 14 px, padding 8 × 10 px, foco de 2 px e mínimo de 64 px. A busca do WhatsApp usa Input, mas o CSS local manteve 13 px, padding 10 × 12 px e raio 8 px. Select/Textarea compartilhados usam 16 px até 820 px; em toque acima dessa largura mantêm 14 px e mínimo de 44 px. |
| D04 | Média | `app/meu-dia/meu-dia.module.css:4`; `app/carteira/carteira.module.css:4`; `app/usuarios/usuarios.module.css:5`; `app/empresas/empresas.module.css:5`; `app/fila/localizar/pessoal.module.css:1` | A mesma função de painel de filtros usa raios 12 ou 8 px, fundo secundário ou branco, padding 16 ou 20 px e rótulos 13 ou 14 px. Não há variante compartilhada que declare a escolha. |
| D05 | Média | `src/components/ui/badge.tsx:6`; `src/styles/ui.css:61`; `app/fila/google/google.module.css:7`; `app/whatsapp/whatsapp.module.css:26,27,30,56` | Indicadores de estado usam Badge e etiquetas locais com diferentes paddings, raios e fontes de 11/12 px. Diferenciar estado informativo, filtro pressionável e indicação de leitura exige variantes documentadas. |
| D06 | Média | `app/globals.css:29,43`; `src/components/ui/button.tsx:24`; `src/styles/tokens.css:34`; módulos de página | Tamanhos e raios não têm uma única fonte. Alturas `xs`/`sm` são elevadas pelo mínimo global; `--radius` não governa o mapa de raios; espaçamentos são repetidos em valores locais. Isso dificulta uma mudança previsível. |
| D07 | Média | `src/components/crm/estado-vazio.tsx:5`; `app/meu-dia/painel.tsx:172,185`; `app/empresas/page.tsx`; `app/gestao/gestao.module.css:35`; `app/usuarios/usuarios.module.css:24` | EstadoVazio não é utilizado; há vazios alinhados à esquerda/centro, com ou sem moldura, e erros usando estilo de vazio. Falta uma composição comum para mensagem, explicação e próxima ação. |
| D08 | Média | `app/design/galeria.module.css:1,12,17,62`; `src/components/crm/shell.module.css:1,20,37,52`; `app/design/galeria.tsx:37,138` | A galeria tem sidebar de 240 px, topbar de 64 px, conteúdo de 1200 px e menu móvel até 640 px; o shell real usa 224/60/1420/820 px. Não mostra tabela, conjunto de checkboxes/radios, todas as variantes/tamanhos, nem o carrossel atual. A amostra de tipografia usa elementos h2/h3 para exemplificar título de página/seção. |
| D09 | Média | `src/components/ui/input.tsx:10`; `src/components/ui/textarea.tsx:9`; `src/components/ui/native-select.tsx:5`; `src/styles/ui.css:57,58` | Campos não compartilham todos os estados. Input não recebe o fundo de somente leitura da classe `.ui-control`. No ensaio, um NativeSelect editável correspondeu a `:read-only` e recebeu `#FAFBFC`, igual ao textarea somente leitura, pois esse pseudoseletor também alcança select. |
| D10 | Média | `src/styles/ui.css:36`; `app/globals.css:42`; `app/funil/funil.module.css:19`; `app/fila/google/google.module.css:43`; `app/whatsapp/whatsapp.module.css:58` | Foco usa contornos de 2 ou 3 px e offsets de 2 a 4 px, além dos rings shadcn. Há visibilidade prevista; o acabamento ainda não é único. |
| D11 | Média | `app/fila/google/google.module.css:40,41`; `app/fila/buscar/banco.module.css:1`; `src/components/crm/busca-empresas.module.css:31,40`; `app/usuarios/usuarios.module.css:20` | Checkbox/radio sem componente visual comum: desenhos de 16/18 px e rótulos com mínimos de 32/40/44 px. A regra móvel dos controles com `data-slot` não resolve esses rótulos. É preciso verificar área clicável, foco e estado disabled em conjunto. |
| D12 | Baixa | `src/components/crm/shell.module.css:37`; `app/meu-dia/meu-dia.module.css:1`; `app/carteira/carteira.module.css:1`; `app/usuarios/usuarios.module.css:1` | Shell e módulos declaram regras concorrentes de largura/padding. O shell prevalece sobre `.pagina` simples; essa duplicação não comprova desalinhamento atual, mas torna futuras mudanças difíceis de prever. |
| D13 | Baixa | `docs/superpowers/specs/2026-10-22-redesign-crm-design.md`, seção Sistema visual; `src/styles/tokens.css:11`; `src/components/crm/shell.module.css:37` | A especificação anterior cita borda de controle clara `#AAB3BD` e largura aproximada de 1600 px. O código usa `#8793A0` e 1420 px. Este inventário registra a implementação; a especificação original foi preservada como decisão histórica. |
| D14 | Baixa | `app/gestao/loading.tsx:6`; `src/components/crm/busca-dialogo.tsx:44`; `app/fila/localizar/pessoal.tsx:48`; `app/usuarios/tabela.tsx:33`; `app/empresas/formulario.tsx:76` | Gestão usa `...` no carregamento e o diálogo usa `…`. Localização pessoal usa exemplo com reticências no placeholder; Usuários e Empresas usam descrições sem esse tratamento. Ajustar a convenção textual junto dos componentes evita regras próprias por tela. |

### Variações a preservar

- Proporção quadrada e truncamento de Últimas buscas são decisões aprovadas para esse componente.
- Funil em quadro, Meu dia em lista/ficha e WhatsApp em conversas respondem a tarefas diferentes.
- Tabela semanal pode manter rolagem; tabela de cadastro pode empilhar registros no celular.
- Pop-up amplo de consulta e confirmação curta precisam de tamanhos diferentes, com os mesmos tokens e estados básicos.
- Um botão que seleciona um registro não precisa ter a aparência de um CTA primário.
- CSS de cards antigos em Carteira não significa que a lista atual ainda usa esse desenho: `app/carteira/lista.tsx` renderiza Table.
- `text-neutral-600` e `text-amber-700` em consumidores antigos possuem remapeamento semântico no shell. Sua existência é dívida de migração; não prova, isoladamente, uma cor incorreta na tela.

## Verificação e próximos passos

A análise seguiu a orientação de `frontend-design`, a [documentação de temas do shadcn/ui](https://ui.shadcn.com/docs/theming), consultada via Context7, e as [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), consultadas em 27/10/2026. As convenções de texto do projeto em português prevalecem sobre convenções editoriais genéricas da referência.

Verificações deste levantamento:

1. Comparação das revisões e da ponta do PR 55; preservação do checkout principal e de suas alterações.
2. Varredura de todos os TSX/CSS do alcance descrito, imports dos 14 módulos de UI e referências/definições de variáveis CSS.
3. Cálculo de contraste dos dez pares listados, em claro e escuro, com os valores do arquivo de tokens.
4. Chromium headless, com HTML de ensaio e CSS da revisão auditada, sem Tailwind compilado ou aplicativo Next em execução. Primeiro, tokens/ui.css e CSS de Google mediram fonte, padding, mínimo, fundo e `:read-only` de Select/Textarea e etiqueta neutra em 1920 × 1080 e 390 × 844. Depois, as regras base de globals.css e o CSS do WhatsApp entraram em um segundo ensaio com as três dimensões citadas; `matchMedia` confirmou ponteiro de toque nos dois últimos cenários. Ele confirmou os campos de Google/WhatsApp e a exceção de fonte em toque acima de 820 px. Esses ensaios sustentam D01, D03 e a parte de Select em D09; não representam renderização completa dos componentes shadcn.
5. Conferência dos caminhos e das referências de fonte usados no documento.
6. Revisão independente somente leitura concluída: nenhum Critical, um Important sobre a descrição de fontes em celular/toque e apontamentos Minor de referências, nome de componente e evidência textual. O autor corrigiu esses pontos no documento e confirmou as exceções com o segundo ensaio de CSS; não houve segunda revisão independente. As contagens e os contrastes foram recalculados pelo revisor e coincidiram. Integridade UTF-8 sem BOM/controles, referências e suíte existente de prosa verificadas antes do registro da entrega.

A próxima etapa sugerida é revisar as diferenças D01 a D14, escolher quais serão corrigidas e escrever a especificação da padronização. A prévia navegável e a adoção por etapas vêm depois dessa decisão. Nenhum item desta lista autoriza mudança de domínio, consulta paga ou ação de produção.

Contratos preservados nas etapas seguintes: Casa dos Dados; inclusão automática das empresas elegíveis; cota por vendedor, histórico, UUID e deduplicação; RLS e documentos de sócios exclusivos do gestor; Google, planejamento pessoal, workflow universal e planilha compartilhada; gestão, usuários, reservas e Carteira. O vendedor continua vendo nome e função dos sócios.

Referências operacionais da mesma revisão: [busca de empresas][busca] e [produção Vercel][producao]. Referência visual anterior: [capturas e validação do redesign][referencia].

[tokens]: https://github.com/Browsher/crm/blob/073a90af4a398f93b55a1a5e98ca3b173c4fa6f2/src/styles/tokens.css
[globals]: https://github.com/Browsher/crm/blob/073a90af4a398f93b55a1a5e98ca3b173c4fa6f2/app/globals.css
[ui]: https://github.com/Browsher/crm/blob/073a90af4a398f93b55a1a5e98ca3b173c4fa6f2/src/styles/ui.css
[busca]: https://github.com/Browsher/crm/blob/073a90af4a398f93b55a1a5e98ca3b173c4fa6f2/docs/operacao/busca-empresas.md
[producao]: https://github.com/Browsher/crm/blob/073a90af4a398f93b55a1a5e98ca3b173c4fa6f2/docs/operacao/producao-vercel.md
[referencia]: https://github.com/Browsher/crm/blob/073a90af4a398f93b55a1a5e98ca3b173c4fa6f2/docs/design/2026-10-22-redesign/README.md
