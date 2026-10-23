# Prospecção alinhada à prévia aprovada

A implementação de 23/10/2026 usa o mockup `prospeccao-google-espelhar-v10.html`
como referência de estrutura e comportamento. Os dados exibidos na prévia
local são fictícios e nenhuma integração real foi ativada.

| Prévia aprovada | CRM real |
| --- | --- |
| Central de atividades | `/fila` |
| Localizar empresas, origem escolhida na central | `/fila/localizar?origem=google` ou `origem=banco` |
| Banco de empresas com seis cartões | `/fila/buscar?fonte=banco` |
| Planejamento semanal, critérios e espelhamento | `/fila/google` |

O atendimento existente continua em `/fila?atendimento=1` e nos links de
reserva. URLs com grupo e a consulta legada explícita preservam as jornadas
antigas, sem voltar a ser a entrada principal da Prospecção.

Seguem os tokens claros/escuros do CRM, Segoe UI, corpo 14, título 28/36,
conteúdo máximo 1420 e controles shadcn existentes. Botões executam ações;
cartões de filtro têm título clicável, seta, aria-expanded e aria-controls.
Não se adicionou outra biblioteca visual.

Verificação visual automatizada em 1920×1080 e 390×844, nos dois temas,
em `tests/e2e/prospeccao-previa.spec.ts`. As capturas correspondem ao CRM
real com banco descartável e serviços simulados, não ao HTML do mockup.

Na validação final passaram 1.505 testes unitários (um ignorado), 68 jornadas
no navegador, build, lint, typecheck e checagem das convenções do banco.
Na integração, a rodada geral teve 670 aprovações; as cinco falhas eram listas
de migrações esperadas ainda sem 0043/0044. Após atualizar essas expectativas,
a reexecução dos cinco arquivos e do mock aprovou todos os 19 testes.

Os detalhes empresariais ficam separados de campos manuais; documentos de
sócios são restritos ao gestor no banco e em componente servidor exclusivo.
Operação e ativação: [busca de empresas](../../operacao/busca-empresas.md).
