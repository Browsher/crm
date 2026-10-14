# Planilha base e validação de WhatsApp para prospecção

## Objetivo

Centralizar no Google Sheets todas as empresas coletadas no Google Maps, conservar seus endereços e fontes, reconhecer empresas já encontradas e consultar cada telefone único pela Evolution. O gestor revisa a base antes de enviar uma lista ao CRM. O workflow não envia mensagens.

## Estado verificado em 14/10/2026

- CRM online: 43 empresas da Mooca, todas com CEP. A referência OpenCEP 2.0.1 foi carregada na Railway com soma e contagem conferidas: 1.209.313 registros. Todas as 43 empresas resolvem rua, bairro e cidade; não foi necessário recriar cadastros ou alterar usuários.
- A coleta original preserva 45 empresas, incluindo duas sem telefone. Para todas há endereço completo, bairro, cidade, CEP, endereço do Maps e Place ID.
- As 43 empresas com telefone usam 42 números únicos. Consulta real na Evolution 2.3.7: 29 encontrados, 13 não encontrados e nenhum inconclusivo. Entre os encontrados há 12 fixos e 17 celulares. O número fixo apresentado pelo usuário foi encontrado.
- Evolution configurada e conectada. Credenciais permanecem em configuração privada, nunca na planilha ou no JSON exportado do workflow.
- Destino escolhido pelo usuário: Google Sheets na conta conectada Alexandre Melo. Não existe uma planilha base de prospecção com esse nome na pesquisa realizada.
- Workflow indicado: NxCO8HiaJmwqJ8jK, projeto mIsmhrUTAVI1ZPnf, n8n em https://primary-production-04eb.up.railway.app. A API respondeu 401 sem credencial. O acesso autenticado deve ser configurado antes de alterar esse workflow; outros workflows permanecem fora do escopo.

## Estrutura proposta da PLANILHA BASE

### Empresas

Uma linha por empresa, identificada por ID interno estável. Colunas: ID, Place ID, CNPJ opcional, nome, razão social, categoria/segmento, telefone publicado, telefone normalizado, e-mail conferido, site, endereço completo coletado, bairro, CEP, cidade, UF, link do Maps, fonte do endereço, coleta de origem, data da coleta, estado de revisão e observações.

A carga inicial conserva as 45 empresas. As duas sem telefone ficam pendentes. Dados originais e campos normalizados ficam separados. Nome semelhante, endereço ou telefone compartilhado não autorizam fundir duas empresas automaticamente.

### Telefones

Uma linha por número completo normalizado: país + DDD + número publicado. Colunas: número, tipo de linha, empresas associadas, quantidade de empresas, WhatsApp encontrado/não encontrado/inconclusivo/pendente, número ou JID retornado, verificado em, HTTP da consulta, motivo de pendência e revalidar.

A carga inicial tem 42 linhas e recebe os resultados reais já consultados. Telefone compartilhado referencia ambas as empresas, mas gera uma consulta. Número fixo conserva oito dígitos após o DDD. Nunca acrescentar ou retirar nove automaticamente para tentar obter um resultado positivo. Número sem DDD ou inválido fica pendente de correção.

### Coletas

Identificação da lista, fonte, região, termos pesquisados, data, arquivo de origem, empresas recebidas, novas/reencontradas, telefones novos e pendências. Repetir uma coleta não gera novas empresas ou telefones; ela acrescenta rastreabilidade da ocorrência.

## Regras de identificação e revisão

1. Place ID identifica a ocorrência do Google Maps; CNPJ, quando válido e disponível, permite reconhecer um cadastro existente.
2. Se essas duas identificações apontarem para empresas diferentes, parar a vinculação e marcar conflito para revisão do gestor.
3. Telefone normalizado é a chave da aba Telefones, não a identidade da empresa.
4. Novas coletas atualizam registros por chave e preservam a origem. Repetições no próprio arquivo são consolidadas antes da gravação.
5. Telefone associado a empresas distintas fica sinalizado. Não excluir cadastros já importados nem liberar duas abordagens automaticamente com base nessa duplicidade.
6. A v1 opera com uma importação por vez, escrita sequencial e conferência final de duplicidades. Não alterar o limite global de concorrência do n8n, pois isso afetaria outros workflows. Se for necessária entrada simultânea por vários processos, usar uma fila e armazenamento com unicidade transacional antes de oferecer essa garantia.
7. Planilha privada, compartilhamento adicional somente quando solicitado. Telefones, CNPJ e CEP são texto para conservar zeros e formato. Campos de estado recebem opções claras e filtros.

## Workflow n8n

Entrada manual de CSV do coletor → ler e validar campos → normalizar identificações e telefones → consultar registros existentes → consolidar empresas e telefones → consultar apenas números pendentes ou marcados para revalidação → atualizar a planilha → apresentar contagens e pendências.

A v1 recebe o formato da coleta Mooca e aceita um mapeamento documentado para novos coletores. Não depender do nome do arquivo para identificar duplicidades. A autenticação Google deve ter escrita somente na planilha escolhida, e a chave Evolution usa credencial do n8n.

A chamada é POST /chat/whatsappNumbers/{instance}, com o campo numbers e números completos. Processar lotes pequenos com intervalo. Somente exists booleano em resposta válida permite marcar encontrado/não encontrado. Timeout, erro HTTP, resposta incompleta ou instância desconectada são inconclusivos, com tentativas limitadas. Conservar data e retorno normalizado; não adivinhar o dono de uma conta pelo nome ou pela foto.

A validação confirma registro no WhatsApp no instante da consulta. Não confirma que a conta continua sendo da empresa nem que responderá. Revisão humana do contato empresarial continua separada desse resultado.

## Endereços no CRM

A resolução por CEP já foi corrigida operacionalmente. A planilha conserva também o endereço completo publicado, incluindo número e complemento quando presentes na fonte.

Para mostrar o endereço completo na ficha do CRM, ampliar a importação Google com campos opcionais de endereço publicado e link de origem, mantendo os modelos atuais compatíveis. Persistir a informação associada ao Place ID, com auditoria e autoridade do banco. Exibir a fonte para distinguir o endereço coletado da referência postal.

Para as 43 empresas já importadas, a conferência deve reconhecer os Place IDs existentes e oferecer atualização apenas dos endereços coletados. A confirmação acontece no fluxo autenticado do gestor, com pode_escrever() e sem usar postgres para contornar a autorização. Não sobrescrever responsável, reserva, notas, histórico, vendas, telefones ou CNPJ. Não inventar número/complemento a partir do CEP nem decompor texto ambíguo silenciosamente.

## Critérios de aceite e testes

- Base inicial conserva 45 empresas, duas sem telefone, 42 telefones únicos e as fontes/endereço completos.
- Resultados reais iniciais reconciliam 29 encontrados e 13 não encontrados; o fixo do exemplo permanece válido.
- Reprocessar o arquivo conserva as contagens; uma nova empresa com telefone já conhecido preserva a empresa e reutiliza a consulta.
- Conflito de CNPJ/Place ID e telefone compartilhado ficam visíveis e não provocam exclusão ou fusão silenciosa.
- API 429/5xx, desconexão, timeout e retorno incompleto não viram não encontrado.
- Credenciais não aparecem na planilha, nos exports, nos logs de validação ou no JSON do workflow.
- Endereço original e referência por CEP podem divergir sem que uma fonte seja silenciosamente apresentada como a outra.
- Ampliação do CRM segue TDD, testes de RLS/gestor, compatibilidade dos CSV anteriores, preview/confirmar e preservação dos dados comerciais. Código passa por branch e PR com CI verde antes da publicação.
- Workflow deve ser importado no alvo informado, testado manualmente e lido de volta antes de ser declarado instalado. A planilha nativa deve ser conferida após conversão e atualização.

## Sequência de execução

1. Correção operacional de CEP e consulta inicial de WhatsApp: concluídas e verificadas.
2. Revisão desta especificação pelo usuário; depois produzir o plano de implementação.
3. Criar a planilha nativa, povoar a base e validar contagens, vínculos e estrutura.
4. Montar e testar o workflow, configurar as credenciais no ambiente do usuário e instalar somente no workflow indicado.
5. Ampliar o contrato de endereço do CRM, testar e publicar por PR. Atualizar os endereços existentes pelo fluxo do gestor.

Nenhuma planilha externa foi criada e nenhum workflow foi alterado nesta etapa de desenho.
