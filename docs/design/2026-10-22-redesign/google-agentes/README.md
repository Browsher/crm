# Agentes por vendedor e sincronização

Desenho aprovado e implementado inline na branch `codex/redesign-crm`, a
partir de `7b92660`. Cada vendedor tem agente próprio; gestores compartilham
equipe e arquivo Google Sheets. Os próximos cinco dias de segunda a sexta
avançam sem copiar critérios ou mover o histórico.

O espelho confirma a revisão por leitura do Google. A execução conserva
executor e pedido até a publicação, com motor/validação compartilhados em
fila. A prévia usa somente serviços locais fictícios.

Referências: [desenho](../../../superpowers/specs/2026-10-22-google-agentes-vendedores-planilha-design.md),
[operação](../../../operacao/agente-google-crm.md),
[banco](../../../db/0041.md), [validação](validacao.md).
