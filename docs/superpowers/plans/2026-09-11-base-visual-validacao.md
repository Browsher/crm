# Validação da galeria visual

Escopo: `/design`, restrita ao gestor. Exemplos fictícios em estado local.
As telas operacionais e o banco não recebem alterações nesta fatia.

## Evidências em execução

- RED no navegador, antes do novo build: as duas jornadas novas falharam
  pela ausência da galeria e da guarda de gestor; as 11 jornadas existentes passaram.
- Testes executados em Postgres 18 temporário, separado do banco do CRM.

## Contraste calculado

Razão calculada pela luminância relativa sRGB dos pares da especificação.
Esta medição cobre somente os pares abaixo, não declara conformidade integral
da interface. A inspeção no navegador confere sua aplicação real.

| Par de cores | Razão |
|---|---|
| Texto principal claro sobre fundo branco | 17,72:1 |
| Texto secundário claro sobre fundo branco | 5,93:1 |
| Texto secundário escuro sobre fundo escuro | 7,76:1 |
| Sucesso claro sobre seu fundo | 6,81:1 |
| Atenção clara sobre seu fundo | 6,84:1 |
| Erro claro sobre seu fundo | 5,91:1 |
| Sucesso escuro sobre seu fundo | 10,62:1 |
| Atenção escura sobre seu fundo | 10,39:1 |
| Erro escuro sobre seu fundo | 8,51:1 |
| Foco claro sobre fundo branco | 5,17:1 |
| Foco escuro sobre fundo escuro | 7,83:1 |

## Resultado final local

- Unitários: 645 passaram, 1 ignorado, em 70 arquivos.
- Integração: 404 passaram, 1 ignorado, em Postgres 18 temporário.
- Build de produção do harness E2E e TypeScript passaram, incluindo `/design`.
- Playwright: 17 jornadas passaram, incluindo as 11 anteriores e 6 da galeria.
  Conferidos gestor/vendedor/visitante, temas explícitos e sistema, filtros e
  estado vazio, texto preservado ao voltar, ausência de requisições de escrita,
  diálogo com foco preso/retornado e Escape, menu móvel e larguras 390/1000px.
- Imagens clara, escura, móvel e do diálogo inspecionadas. Corrigidos menu
  aparecendo no desktop, tipografia CSS inválida e respostas fora do contexto.
- Revisão independente e re-revisão dos ajustes sem achados restantes.

Uma execução concorrente ao build excedeu o prazo do teste já existente de
encerramento de processos. Repetição completa sem o build concorrente passou;
nenhum prazo de teste foi relaxado.

As bordas interativas usam `#71717A`, distintas das bordas decorativas de cards.
O menu móvel fechado deixa seus links invisíveis também para navegação por foco.
A aprovação visual do usuário antecede aplicar estes componentes à Fila.
