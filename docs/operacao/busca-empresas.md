# Busca de empresas

## Ativação

1. Aplicar migrações pendentes pelo procedimento normal de implantação do CRM. Esta entrega adiciona 0038 e 0039.
2. Configurar CNPJ_BIZ_API_KEY no ambiente do servidor com a chave da conta CNPJ.biz. Nunca usar prefixo NEXT_PUBLIC_, commitar a chave ou informar em logs.
3. Como gestor, abrir Empresas → Busca de empresas e definir limite diário por vendedor. Zero é o padrão. O limite do CRM não consulta nem representa o saldo de créditos da conta.
4. Como vendedor, abrir Prospecção → Buscar empresas → Busca do banco de dados.

Esta implementação não foi ativada em produção. A validação usa dados sintéticos e bancos locais descartáveis; nenhuma chamada paga foi feita.

## Uso

Nomeie a lista e combine palavra no nome e/ou CNAE com UF obrigatória e os filtros opcionais de cidade, bairro, porte, matriz/filial e contato. Somente empresas ativas. CNAE principal aceita sete dígitos ou máscara; o servidor resolve o atividade_id do fornecedor antes da listagem. Cidade usa o nome completo esperado pela API. Quantidade de 1 a 100, dentro do limite diário. Pular resultados usa offset da API, começando em zero.

Confira o resultado e marque as empresas para importar. Empresas sem telefone válido permanecem no histórico; não entram na fila. CNPJ já cadastrado é vinculado ao grupo, preservando cadastro e responsável. A seleção não registra interesse comercial e não assume carteira. Use Prospectar esta lista para seguir o atendimento existente.

A ficha mostra situação, porte, abertura e endereço da origem, separados do cadastro manual. O complemento conserva a primeira consulta importada. O endereço recebido continua visível mesmo sem correspondência na base de CEP; os filtros geográficos internos existentes continuam baseados na base de CEP.

## Google

Busca no Google mostra grupos ativos com vínculos reais em empresa_origem_google. O agente diário existente e seu agendamento não são alterados. Ele deve continuar importando pelo fluxo já utilizado e preservar google_place_id para identificação automática da fonte. Listas antigas sem esse identificador continuam em Ver todas as listas de prospecção.

Não há scheduler novo nem alegação de que o CRM verifica a execução diária do agente. A data mostrada é a importação do grupo, não a última execução do agente.

## Limites e falhas

Cota por vendedor em empresas solicitadas no dia de São Paulo. A reserva acontece antes da rede e permanece em falhas, porque a cobrança externa pode ter ocorrido. Não há retry automático. O UUID da operação impede nova chamada ao repetir a mesma submissão.

Busca sem confirmação permanece no histórico. Recarregar consulta só lê o banco. Confira a conta CNPJ.biz antes de iniciar outra consulta quando houver timeout ou falha de persistência. Pausa impede novas consultas e importações; resultado já solicitado pode ser preservado. Mudança de papel e desativação são verificadas pelo banco.

O histórico do vendedor contém somente suas buscas; o gestor vê as últimas 50 de todos, critérios, retornos e grupo criado. A opção Google mostra até 100 grupos recentes ativos. Não há rotina de limpeza automática de buscas nesta entrega.

## Contrato e testes

Contrato público [CNPJ.biz V2](https://cnpj.biz/docs-api), [OpenAPI consultado em 2026-10-22](https://cdn.cnpj.biz/api-docs/openapi.yaml?v=1780667809). EmpresaListagem tem formato diferente do endpoint por CNPJ. Não usar a API do CRM interno do CNPJ.biz para esta aquisição.

Cliente HTTP com timeout de 25 segundos para a operação, limite de resposta de 2 MB, sem redirects, cache ou retries. Chave enviada em Authorization Bearer somente para a origem fixa oficial. Telefones e email não são prova de canal validado ou interesse comercial.

Testes unitários cobrem contrato HTTP, filtros e idempotência do serviço; integração cobre RLS, concorrência, pausas e importação; jornada no navegador cobre as duas fontes, conferência, ficha e pausa do gestor. Harness E2E zera CNPJ_BIZ_API_KEY herdada. Email, disparos, campanhas e assinaturas de catálogo permanecem adiados.

Na ficha pública, telefones ficam ocultos até haver posse ou reserva vigente. O gestor tem leitura administrativa. O histórico de uma busca própria preserva os dados obtidos naquela consulta.

## Validação da entrega

Em 2026-10-22, no checkout limpo do commit 2e2f155: 1.326 testes unitários passaram, um ignorado; 604 de integração passaram, um ignorado. Lint, typecheck e checagem de migrações passaram. No checkout de trabalho, build E2E e 11 jornadas afetadas passaram, incluindo Google, importação CNPJ.biz, pausa do gestor, Prospecção, reserva e Carteira. Nenhum crédito externo usado. As falhas prévias de prosa em CONTINUIDADE-CODEX.md e lint em .artifact-work são de arquivos locais fora da branch e foram preservadas.

Jornada da feature: npm run test:e2e -- --sem-build tests/e2e/busca-empresas.spec.ts, após npm run build:e2e.