# Buscar empresas na Prospecção

Data: 2026-10-22. Escopo autorizado pelo usuário: implementar somente aquisição CNPJ.biz no CRM; Google usa o agente diário existente. O disparador de email fica para uma etapa futura.

## Experiência

O vendedor abre Prospecção → Buscar empresas. Há duas fontes: Busca no Google e Busca do banco de dados. Google oferece as listas já importadas pelo agente existente; esta entrega não cria nem modifica o agendamento dele. Banco de dados usa a API CNPJ.biz V2, com chave exclusivamente no servidor.

O vendedor nomeia a lista e escolhe UF, cidade, bairro, CNAE, palavras da razão social/nome fantasia, porte, tipo de estabelecimento e disponibilidade de contato. Apenas empresas ativas nesta primeira entrega. Pode solicitar de 1 a 100 empresas por página e informar o deslocamento para continuar uma busca. CNAE é resolvido para atividade_id pela API; não confundir seu código com o identificador interno do fornecedor.

A busca é uma operação explícita, autenticada, com identificador único. Trocar de tela e voltar não consome novamente créditos: os resultados e critérios ficam salvos. Exibimos histórico das últimas buscas e detalhamento de cada resultado, incluindo empresas sem telefone. A importação seleciona resultados persistidos pelo identificador, nunca recebe cadastro arbitrário do navegador. Sem telefone válido, a empresa permanece na conferência. Nenhum telefone fictício é criado.

Importar cria um grupo de prospecção reutilizando a infraestrutura atual. Empresas existentes são identificadas pelo CNPJ e apenas vinculadas ao grupo; não sobrescrever cadastro nem responsável, reserva, carteira, contato ou negociação. Adquirir uma empresa não significa interesse comercial. O vendedor segue o atendimento e reserva já existentes.

## Gestor

Em Empresas → Busca de empresas, o gestor acompanha as últimas buscas, quantidade solicitada/retornada/importada, vendedor, filtros e erros. Configura por vendedor um limite diário de empresas solicitadas e uma pausa. Sem limite configurado, a busca está bloqueada. A chave é configurada por variável CNPJ_BIZ_API_KEY; o painel só mostra configurada/pendente e nunca seu valor.

A quota é local do CRM, em empresas solicitadas, não uma afirmação sobre a tarifação do fornecedor. Reserva atômica antes do HTTP; requisições concorrentes não ultrapassam o limite. Falhas e timeout mantêm a reserva por prudência: não sabemos se o fornecedor cobrou. Não há repetição automática. Virada do dia em America/Sao_Paulo. Pausar bloqueia novas consultas e importações; uma resposta em andamento ainda pode ser preservada.

## Campos

Preservar CNPJ, razão social, nome fantasia, email, telefone, CEP e CNAE existentes. Guardar complemento cadastral associado à empresa: situação, porte, data de abertura, endereço recebido (logradouro, número, complemento, bairro, cidade e UF), telefones adicionais, origem e data da consulta. Exibir esses dados na conferência e nas fichas existentes, identificados como dados do CNPJ.biz. Não trazer documentos de sócios nem dados desnecessários. Telefone da Receita não implica WhatsApp validado.

Chamadas pagas de desenvolvimento e configuração em produção não fazem parte da validação: usar respostas sintéticas segundo o contrato público. A conexão real dependerá da chave no ambiente.

## Arquitetura e segurança

Feature busca-empresas, cliente HTTP server-only, funções SQL definidoras com search_path fechado e RLS. Autorização no banco: usuário ativo, senha definitiva, papel vendedor para aquisição, gestor para administração; leitura de buscas próprias ou todas pelo gestor. Sem concessão de escrita direta nas tabelas de busca. Importação atômica com o mesmo advisory lock das importações existentes. Guardas e validação também nas Server Actions.

Busca idempotente pelo UUID: repetição não emite HTTP adicional; resultado pendente pode ser recarregado, mas não automaticamente repetido. Persistir filtros normalizados e resultado limitado a 100 empresas e tamanho HTTP limitado. Falhas mostram motivos estáveis sem ecoar corpo do fornecedor/chave. Fetch com timeout, cache no-store e redirect error.

Contrato verificado em 2026-10-22: [documentação oficial](https://cnpj.biz/docs-api) e [OpenAPI oficial](https://cdn.cnpj.biz/api-docs/openapi.yaml?v=1780667809). Base https://cnpj.biz/api/v2; POST /atividades/buscar e /empresas/listar-com-dados, Bearer, listas diretas. EmpresaListagem usa telefones string[] e atividades_principal string[]; difere do endpoint por CNPJ.

## Escolhas de implementação

Decisões do implementador: limite inicial zero; quota conservadora solicitada; importação seletiva em grupo compartilhado, sem assumir carteira; dados cadastrais suplementares separados do cadastro manual; Google identificado pelos vínculos reais empresa_origem_google, com acesso às listas existentes se ainda não houver vínculo. Preservar a interface e os temas atuais, com formulário à esquerda e contexto de uso à direita, resultados em lista responsiva e seleção explícita.

## Critérios de aceite

- Duas fontes acessíveis por Buscar empresas na Prospecção.
- Google usa dados existentes, sem criar agente.
- Filtros e mapeamento seguem o contrato oficial.
- Vendedor consulta e importa dentro dos limites; gestor acompanha e pausa.
- Persistência, idempotência, concorrência, deduplicação e permissões cobertas por integração local.
- Dados incompletos continuam visíveis; sem telefone não entram na fila.
- Fichas mostram os campos adicionais e origem.
- Nenhuma campanha ou envio de email nesta entrega.
