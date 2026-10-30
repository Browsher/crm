# Comprovante da conferência de importação

Atualização de 2026-10-30: a importação manual do gestor foi aposentada. A interface não apresenta formulário ou atalhos; o endereço antigo exige gestor e encaminha para Empresas. A ação antiga responde com recusa sem processar arquivos e a [migração 0059](db/0059.md) revoga a função exclusiva no banco. Nenhum cadastro ou lista existente é removido. Banco e Google continuam por seus caminhos próprios.

O runtime atual não usa o comprovante nem requer `IMPORTACAO_CONFERENCIA_SEGREDO` para esse fluxo. Não é necessário criar ou rotacionar esse segredo para a retirada. As instruções abaixo documentam o contrato histórico mantido pelas bibliotecas internas e seus testes; não habilitam a importação manual.

## Contrato histórico

O runtime antigo usava `IMPORTACAO_CONFERENCIA_SEGREDO`: 32 bytes aleatórios escritos em 64 caracteres hexadecimais, somente no servidor, sem prefixo `NEXT_PUBLIC_`, com a mesma chave em todas as instâncias. O valor não era versionado nem reutilizava senha de banco, DSN ou cookie.

A validação é preguiçosa, ao emitir/verificar o comprovante. Build sem configuração continua possível. Com segredo ausente ou inválido a conferência não produz autorização de confirmação; a confirmação falha fechada, sem gravar ou revelar o valor. Não há fallback para memória local ou outro segredo. Rotacionar a chave invalida comprovantes ainda abertos; o gestor precisa conferir novamente.

`src/features/empresas/conferencia.ts` usa um envelope versão 1 e HMAC-SHA256. Vincula gestor e toda a operação (chave, nome do grupo, nome do arquivo, SHA-256 dos bytes), mais posições aceitas e recusas de identidade já conferidas. O contexto vem do servidor. Campos ocultos e estado anterior do navegador não são autoridade. A assinatura cobre o objeto da operação inteiro, permitindo acrescentar campos futuros ao contrato sem esquecer seu vínculo; descrição, origem e critérios do grupo são normalizados no servidor e participam desse vínculo. Alterar esses metadados exige uma nova conferência e não permite reutilizar silenciosamente uma operação já confirmada.

`analisar` devolve `conferencia` com as posições aceitas. A Action assina esse retrato e o formulário reenvia o comprovante. `importar` reparseia os mesmos bytes e envia exatamente as linhas aprovadas ao SQL, conservando as recusas anteriores. Uma mudança percebida na classificação atual não pode retirar silenciosamente uma dessas linhas. O banco revalida os identificadores e recusa conflitos com rollback integral. O replay do mesmo pedido continua retornando seu resultado persistido antes de reavaliar o cadastro.

O comprovante não persiste dados na conferência. Seu envelope com até 5.000 linhas cabe no limite de transporte atual junto ao arquivo de até 1,5 MB. A seleção não ganha autorização de escrita: guarda de gestor, RLS, senha provisória e validações SQL continuam obrigatórias.

E2E e CI usam o runtime isolado de `tests/e2e/ambiente.ts`: o build remove qualquer segredo herdado e o servidor descartável conserva uma chave fixa de teste. Essa chave não é válida para uso operacional. Nenhum segredo ou ambiente de produção foi alterado nesta retirada.
