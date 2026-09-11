# Padrão visual do CRM

Estado: galeria aprovada pelo usuário em 11/09/2026, após os ajustes de cards,
avisos e diálogo descritos abaixo. Este padrão passa a ser a referência para
a aplicação visual na Fila. A galeria não altera as telas operacionais.

Referências lidas: fila-combinada.html da conversa; src/styles/theme.css,
src/styles/index.css e src/components/ui/button.tsx do shadcn-admin fornecido.
Regras de interação: 2026-09-10-fila-interface-design.md.

## Direção

Interface de trabalho para prospecção por telefone: dados legíveis, próxima ação
e estado da reserva fáceis de localizar. Tons neutros, bordas discretas, pouca
sombra. O botão principal concentra o contraste; cores indicam estados.

Manter a paleta neutra do protótipo aprovado. Do shadcn-admin, aproveitar a
consistência de variantes, foco, campos, menu lateral e temas. Não copiar menus
de funcionalidades inexistentes, router ou autenticação da referência.

## Cores semânticas

Um nome por finalidade, compartilhado pelos componentes. Cores literais ficam
na definição dos temas, não espalhadas nas páginas.

| Finalidade | Claro | Escuro |
|---|---|---|
| Fundo | #FFFFFF | #09090B |
| Superfície secundária e menu | #FAFAFA | #141416 |
| Texto principal | #18181B | #FAFAFA |
| Texto secundário | #63636E | #A1A1AA |
| Borda | #E4E4E7 | #3F3F46 |
| Botão principal | #18181B | #FAFAFA |
| Texto do botão principal | #FFFFFF | #18181B |
| Foco de teclado | #2563EB | #60A5FA |
| Sucesso: texto / fundo | #166534 / #F0FDF4 | #86EFAC / #052E16 |
| Atenção: texto / fundo | #92400E / #FFFBEB | #FCD34D / #451A03 |
| Erro: texto / fundo | #B91C1C / #FEF2F2 | #FCA5A5 / #450A0A |

Cor nunca é o único sinal. Exibir estado em texto: Disponível, Reservada para
você, Reserva expirada, Indisponível. Com outro vendedor vem em linha separada.
Não usar vermelho em Devolver: é um resultado normal do atendimento.

Definir os dois temas juntos, inicialmente acompanhando a preferência do sistema,
como no protótipo. Conferir contraste dos pares efetivamente usados na galeria,
inclusive foco e bordas de campos; a tabela não substitui essa verificação.

## Tipografia

Uma família: Segoe UI, system-ui, sans-serif, preservando o protótipo aprovado
e sem depender de download de fonte. Pesos 400, 500 e 600.

| Uso | Tamanho / altura de linha | Peso |
|---|---|---|
| Título da página | 28 / 36 px; 24 / 32 px no celular | 600 |
| Título de seção ou empresa | 18 / 26 px | 600 |
| Texto, campos e botões | 14 / 21 px | 400; ações 500 |
| Texto auxiliar | 12 / 18 px | 400 |
| Campos no celular | 16 / 24 px | 400 |

Rótulos em caixa normal, alinhados à esquerda. Não usar texto auxiliar para
informações essenciais como telefone, prazo e resultado da ligação. Números
do prazo usam algarismos de largura uniforme para evitar deslocamento.

## Medidas

- Escala de espaçamento: 4, 8, 12, 16, 24 e 32 px.
- Campos e botões comuns: altura mínima de 40 px no desktop; 44 px no toque.
- Espaço entre label e campo: 8 px. Entre campos: 16 px.
- Padding de card: 24 px no desktop e 16 px no celular.
- Raio: 6 px em campos e botões; 8 px em cards; 10 px em diálogos.
- Borda de 1 px; foco externo de 3 px com separação de 2 px, sem alterar layout.
- Sombra leve reservada a popovers e diálogos. Cards usam bordas.
- Ícones: 16 px junto a texto, 20 px em botão de ícone, sempre com nome acessível.

## Estrutura das páginas

Conteúdo de trabalho à esquerda, com largura máxima inicial de 1200 px; margem
interna de 24 px no desktop e 16 px no celular. Menu lateral de 240 px e cabeçalho
de 64 px como ponto de partida para a galeria, não como dimensões do protótipo.

No celular, navegação em menu recolhível e conteúdo em uma coluna. No registro,
empresa e telefone aparecem antes do formulário. No desktop, dados e formulário
podem ficar lado a lado quando houver espaço suficiente. Nunca esconder ações
necessárias para fazer caber o conteúdo ou depender de rolagem horizontal.

Usar apenas rotas existentes no menu, respeitando gestor e vendedor. A escolha
visual não concede permissão. As três etapas pertencem à área Fila.

## Variantes e estados

Botões: principal para a ação que avança o fluxo; contorno para ações secundárias;
discreto para navegação; destrutivo apenas quando a ação realmente o exigir.
Na consulta, Reservar para ligar ou Registrar resultado ocupa a hierarquia
principal conforme o estado; Próxima é secundária.

Cada componente deve demonstrar:

- Padrão e hover com diferença discreta de superfície.
- Foco visível por teclado, sem depender do mouse.
- Carregamento mantendo largura e rótulo de ação, bloqueando envio duplicado.
- Desabilitado com motivo próximo quando não for evidente.
- Somente leitura distinguido de desabilitado; anotações expiradas continuam
  editáveis/copiáveis, conforme o comportamento funcional já implementado.
- Erro junto ao campo, mensagem associada e valor preenchido preservado.
- Conteúdo vazio com explicação e ação pertinente, sem métricas fictícias.

Movimento somente como resposta à interação, cerca de 150 ms. Respeitar redução
de movimento. Sem animação decorativa de entrada para cada card.

## Componentes e composição

Primitivos shadcn/ui adaptados ao padrão: Button, Input, Textarea, Label, Select,
Badge, Alert, Dialog, Skeleton e elementos de navegação quando necessários.
Instalar apenas os usados. Estados e variações ficam no componente compartilhado.

Composições: campo com label/ajuda/erro, cabeçalho de página, estado vazio e shell.
Componentes da Fila: filtros, resumo da empresa, situação da reserva, indicadores
de etapas e formulário de resultado. Não duplicar Button ou Card por tela.

Não impor pastas de átomos/moléculas/organismos. Separar componentes básicos,
composições compartilhadas e componentes da funcionalidade. Features não importam
outras features; composição entre domínios permanece na camada app.

## Página de referência e aprovação

Antes de substituir as telas, mostrar uma página de componentes com:

1. Tipografia e cores em contexto de Fila, nos dois temas.
2. Botões e campos em todos os estados acima, incluindo textos longos.
3. Cards de empresa disponível, reservada, expirada e com outro vendedor.
4. Filtros de nome/CNAE/estado/cidade/bairro em desktop e celular.
5. Indicadores Puxar, Consultar e Registrar: voltar permitido, avanço por ação.
6. Reserva expirada com anotações e tentativa explícita, sem renovação automática.

Dados de demonstração identificados como exemplos; nenhuma escrita em banco real.
Validar visualmente, por teclado e em largura de 390 px; conferir contraste e
áreas de toque. Aprovação da galeria antecede a aplicação do padrão nas telas.

Próximo passo: especificação executável e plano da base de componentes com
Superpowers, seguido da galeria e de sua validação pelo usuário.

## Ajustes solicitados na validação da galeria

- Remover o rótulo Ausente do exemplo de empresa com outro vendedor.
- Alinhar as ações Ver exemplo no rodapé dos cards, independentemente do
  tamanho do conteúdo. Preservar alinhamento também ao expandir detalhes.
- Mostrar avisos e carregamento em contexto: busca com lista carregando/vazia,
  formulário com erro, tentativa de salvar e confirmação, e reserva expirada
  acima das anotações preservadas.
- Explicar o diálogo por uma ação da rotina: Próxima com anotações não salvas
  pede confirmação antes de descartá-las. A galeria apenas demonstra essa
  confirmação; não altera a Fila operacional.
