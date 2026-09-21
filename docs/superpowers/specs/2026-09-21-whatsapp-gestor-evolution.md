# WhatsApp do gestor: decisões e piloto Evolution API

Status: regras de produto e escolha da Evolution API aprovadas. Piloto em andamento na Railway com o número empresarial existente. Uma primeira tela de leitura do CRM foi implementada em branch, mas ainda depende das credenciais no servidor e de validação com dados reais.

## Objetivo e conexão escolhida

O vendedor continua respondendo pelo WhatsApp Business no celular. O gestor acompanha mensagens no CRM, sem envio, edição ou exclusão de mensagens pelo painel.

Usar Evolution API no modo Baileys/WhatsApp Web, conforme escolha do usuário após discussão das alternativas. Esse modo não é a API oficial da Meta e envolve risco de desconexão, incompatibilidade e bloqueio. Não prometer captura completa ou recuperação de todo o histórico.

O usuário informou que removeu a conexão com a YCloud antes de iniciar este piloto. Em 21/09/2026, enviou uma mensagem de outro número ao WhatsApp Business e respondeu pelo celular; a consulta da Evolution passou a contar 590 mensagens. Falta conferir direção e conteúdo desses registros na API.

## Regras aprovadas

- Acesso exclusivo de gestor, com autorização no servidor e no banco conforme a fundação do CRM.
- Mockup aprovado: indicadores no topo, seleção por foto/nome do vendedor e Todos, lista de conversas à esquerda e chat somente leitura à direita.
- Conversas hoje: uma conversa por número empresarial e contato, com ao menos uma mensagem enviada ou recebida no dia civil de Brasília.
- Sem resposta: cliente aguardando vendedor, inclusive pendências anteriores. Mensagens consecutivas do cliente formam uma espera desde a primeira mensagem ainda não respondida.
- Tempo médio: esperas concluídas por respostas no dia selecionado, somando somente segunda a sexta, 9h às 18h, America/Sao_Paulo. Feriados não têm calendário especial nesta versão. Sem medições, mostrar texto em vez de zero.
- Todos agrega medições individuais, sem média das médias dos vendedores.
- Vendedores ativos hoje: vendedores que enviaram mensagem no dia; não representa presença online. Ao selecionar vendedor, substituir por Clientes respondidos hoje.
- Selecionar vendedor atualiza lista e indicadores.
- Conversas sem empresa no CRM aparecem e contam normalmente, com identificação Não cadastrada. Não criar empresa automaticamente.
- Telefone com vínculo único identifica a empresa. Duplicidade fica como Identificação pendente; gestor pode escolher o vínculo ou deixá-lo pendente.
- Mostrar etapa real do funil, Na carteira, Cadastrada ou Não cadastrada, conforme contexto do CRM. Escolher vínculo não transfere empresa nem altera etapa.
- A conversa pertence ao vendedor associado ao número conectado. Se empresa pertence a outro vendedor, informar esse responsável sem transferência automática.
- Desativados ficam fora de Todos e dos indicadores da equipe ativa; histórico preservado e acessível por Mostrar desativados.
- Textos, imagens, áudios e documentos quando disponíveis. Sem transcrição automática. Conteúdo indisponível preserva autoria e horário conhecidos.
- Nenhuma mensagem avança funil, registra venda ou conclui tarefa do Meu dia automaticamente.

## Primeira fatia: piloto na Railway

O usuário substituiu a proposta inicial de Docker local e número de teste por Railway e pelo mesmo número empresarial. O serviço `crm-whatsapp` usa a imagem `evoapicloud/evolution-api:v2.3.7`, um Postgres próprio, Redis próprio e volume de instâncias em `/evolution/instances`. O domínio público usa HTTPS e a chave da API fica nas variáveis da Railway; não registrar seu valor neste documento.

O número `NTV Box | Suporte` serve apenas para validar a integração. Não atribuir suas conversas a um vendedor. Depois, os perfis dos vendedores serão conectados em instâncias próprias da Evolution e cada instância poderá ser vinculada ao vendedor correspondente. A primeira tela do CRM lê somente a instância do piloto, sem calcular métricas de equipe com ela.

Evidência visual recebida em 21/09/2026: migrações Prisma concluídas; Redis pronto; servidor HTTP ativo na porta 8080; página inicial retornou status 200; Manager autenticado; instância `NTV Box - Suporte` apareceu como `Connected`, com 255 contatos, 131 chats e 587 mensagens contabilizados. Houve uma configuração intermediária com `Always Online`, `Read Messages` e `Read Status` ligados; na captura mais recente, após a confirmação "Settings applied successfully", os três aparecem desligados (botões cinza). `Sync Full History` também permanece desligado. Esses contadores indicam sincronização inicial, mas não provam completude do histórico, recebimento contínuo nem ausência de alterações de leitura. Nenhum evento chegou ao CRM nesta etapa.

Teste de mensagem em 21/09/2026: o usuário relatou que enviou de outro número para o WhatsApp Business e respondeu pelo celular, porém a tela `Chat` do Evolution Manager ficou sem contatos nem mensagens. O usuário confirmou a instância `Connected` e o contador `Messages` passou de 587 para 590 após o teste. Uma consulta autenticada de leitura a `POST /chat/findMessages/{instanceName}` retornou `messages.total = 590`, sem compartilhar chave nem conteúdo. Isso confirma que o backend disponibiliza mensagens pela API, apesar da tela vazia; ainda não foram verificados os IDs, direção, recência, conteúdo ou a marcação de leitura dos eventos de teste. Há relatos públicos de falhas de exibição no Manager v2.3.7, inclusive com mensagens presentes na API; o caso local é compatível com esse sintoma, sem causa interna comprovada.

Primeira fatia do CRM: `/whatsapp` consulta apenas a página mais recente (até 50 mensagens) de uma instância configurada por variáveis de ambiente, depois de exigir `gestor`. A tela agrupa as mensagens dessa amostra por conversa e não oferece envio nem alteração de estado. O total da API não representa a quantidade renderizada; histórico completo, mídias, sincronização contínua, indicadores e atribuição a vendedores ficam fora desta fatia. Testes usam registros fictícios. Falta configurar a chave exclusivamente no servidor do CRM e validar o formato da resposta real sem divulgá-la.

Antes de instalar, conferir a versão estável, licença, imagem e configuração na documentação e repositório oficiais do projeto; fixar versão em vez de usar latest. Não copiar configuração antiga sem validação.

Validar e registrar evidências para:

1. Vinculação da sessão pelo titular via QR Code: estado `Connected` observado; confirmar persistência após reinício.
2. Mensagem recebida e resposta enviada pelo celular chegando ao receptor local.
3. Identificação do número, contato, direção, ID e horário das mensagens; distinguir horário da mensagem do horário de recebimento do evento.
4. Imagem, áudio e documento nos dois sentidos, quando suportados.
5. Repetição e ordem invertida de eventos sem duplicar conversa ou distorcer indicadores.
6. Reinício e perda de conexão: recuperação observável e identificação de lacunas; não presumir recuperação completa.
7. Não marcar mensagens como lidas nem enviar respostas automaticamente: os controles `readMessages`, `readStatus` e `alwaysOnline` apareceram desligados; falta medir com conversa controlada.

Sucesso do piloto comprova somente as condições testadas. Histórico inicial, mídias antigas e recuperação após desconexão devem ter limites registrados.

## Proteção e arquitetura propostas

- Credenciais da Evolution e sessão vinculada somente no servidor, fora de logs, commits e navegador.
- O painel somente leitura é uma restrição do CRM; a sessão Evolution possui capacidades adicionais que precisam permanecer isoladas.
- Receptor autenticado, limites de payload, validação de eventos e deduplicação antes de persistir.
- Não registrar payloads reais completos em relatórios ou fixtures. Usar conteúdo fictício no piloto.
- Adaptador Evolution separado das regras de domínio para permitir trocar a integração.
- Respeitar a fronteira features: compartilhado em lib ou server, sem importação entre features.
- Persistência definitiva, mídia privada, retenção e vínculo histórico número/vendedor serão detalhados depois do piloto.

## Pendências antes da implementação definitiva

- Quantidade futura de números e relação entre instâncias e vendedores; o piloto usa o número de suporte sem vínculo com vendedor.
- Orçamento da Railway, armazenamento e backup. A conta apresentou aviso de cobrança pendente durante o preparo do serviço.
- Retenção de mensagens/mídias, tratamento de edição/exclusão, grupos e respostas automáticas.
- Normalização de números e identificadores sem telefone, sem adivinhar vínculos.
- Definição precisa de Clientes respondidos hoje e de atribuição quando um número troca de vendedor.
- Sinalização de indicadores incompletos durante falhas de sincronização.

## Sequência proposta

1. Piloto técnico isolado e relatório de resultados.
2. Fechar especificação técnica com base nas evidências e pendências.
3. Banco, autorização, recepção e testes locais com TDD.
4. Painel do mockup conectado aos dados e testes de interface.
5. Revisão, CI, PR e validação antes de produção.

## Referências consultadas na pesquisa da conversa

- https://github.com/evolution-foundation/evolution-api
- https://github.com/evolution-foundation/evolution-docs/blob/main/docs/02-Configuration/Webhooks.md
- https://github.com/WhiskeySockets/Baileys#disclaimer

As referências documentam capacidades, não comprovam o funcionamento no ambiente deste CRM. Os testes automatizados do adaptador usam respostas fictícias; a validação com conteúdo real da Evolution ainda não foi executada pelo agente.
