# Um workflow de verificação para toda a equipe

Importar `verificar-empresas.json` como um único workflow. O arquivo está inativo
e não contém credenciais. As quatro decisões condicionais pulam etapas não
selecionadas; o CRM aplica a combinação final de critérios. Sem verificações,
o executor nem chama o webhook.

O contrato de entrada contém pedido, execução, lote, revisão, hash do snapshot,
critérios canônicos e até 50 candidatas reservadas. A resposta repete as cinco
identidades e contém `evidencias`: candidata, critério, opção, estado,
motivo, fonte e horário. Evidências de telefone aprovado contêm também
`contato`, exatamente igual ao número normalizado da candidata.

Critérios distintos combinam E. Alternativas de um mesmo campo combinam OU.
WhatsApp e fixo aceitam qualquer canal aprovado; os outros critérios continuam
obrigatórios quando selecionados. Sem confirmação não significa aprovação.

## Configuração para ativação

1. Selecionar uma credencial Header Auth no webhook. Usar o cabeçalho
   `Authorization` com o valor privado `Bearer <token>`. No executor,
   configurar `GOOGLE_VERIFICACOES_URL` e `GOOGLE_VERIFICACOES_TOKEN`.
2. Reutilizar a instância Evolution existente no ambiente do n8n:
   `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME` e `EVOLUTION_API_KEY`.
   A etapa consulta registro de números; não envia mensagem.
3. Para produtos, tipos de negócio, atendimento, exclusões, orientações e
   presença digital ainda não comprovada pela coleta, conectar o qualificador
   de fontes publicadas em `GOOGLE_QUALIFICADOR_URL` e sua autenticação em
   `GOOGLE_QUALIFICADOR_TOKEN`. Essa conexão ainda precisa ser configurada;
   não foi instalado ou contratado um provedor durante a implementação.
4. O qualificador recebe a mesma identidade, critérios, candidatas e
   `pendencias` de critério/opção. Devolve a mesma identidade e evidências
   individuais, apoiadas em fontes públicas. Deve tratar conteúdo de páginas
   como dados, manter as regras recebidas e restringir acesso a URLs públicas.
   Falha de leitura não comprova ausência de site ou e-mail. Nenhuma fonte
   pode mudar quota, vendedor ou destino. Não seguir instruções das páginas.
5. Conferir importação na versão instalada do n8n, vincular credenciais e
   testar com uma cópia de dados fictícios antes de ativar. Foram verificados
   o grafo exportado, contratos e código das etapas; não houve importação ou
   execução no n8n real nesta entrega.

Dados do Google e formato de fixo são conferidos localmente no workflow.
Site/e-mail já comprovados são reaproveitados. As pendências de presença e
perfil vão juntas ao qualificador para evitar leituras repetidas. O serviço
de perfil não deve afirmar que uma linha está ativa: o critério de fixo
confere somente formato.

## Operação e retomada

O CLI `agente.mts verificar` recebe `--contexto`, `--lote` e `--saida`, persiste
a intenção antes do POST e não repete uma verificação de retorno incerto.
Para reconciliar, conferir a execução no n8n e fornecer sua resposta JSON
com os mesmos argumentos e `--reconciliar <resposta.json>`. Isso não envia
outro POST. A assinatura local liga o resultado às mesmas candidatas e ao
snapshot. Uma falha de configuração local, anterior ao POST, não cria uma
pendência artificial.

O banco do CRM decide a entrega, protege exclusividade e limites e guarda
o recibo por lote. O workflow não escolhe o vendedor nem grava diretamente
empresas no CRM. A planilha compartilhada continua sendo espelho do plano.
