# Busca de empresas

## Ativação

1. Aplicar migrações pendentes pelo procedimento normal de implantação do CRM. A aquisição nasceu em 0038/0039; a integração atual inclui 0040–0044. A 0043 acrescenta consulta pessoal e a 0044 amplia filtros e protege documentos de sócios.
2. Configurar CNPJ_BIZ_API_KEY no ambiente do servidor com a chave da conta CNPJ.biz. Nunca usar prefixo NEXT_PUBLIC_, commitar a chave ou informar em logs.
3. Como gestor, abrir Empresas → Busca de empresas e definir limite diário por vendedor. Zero é o padrão. O limite do CRM não consulta nem representa o saldo de créditos da conta.
4. Como vendedor, abrir Prospecção → Banco de empresas → Buscar novas empresas. Google tem o acesso Planejar buscas na mesma central.

Esta implementação não foi ativada em produção. A validação usa dados sintéticos e bancos locais descartáveis; nenhuma chamada paga foi feita.

## Uso

O formulário tem seis cartões: atividade/nome, localização, perfil, capital/abertura, contatos e resultados. Somente o primeiro inicia aberto. Palavras, CNAEs e naturezas aceitam múltiplos códigos separados por vírgula. O servidor resolve os IDs do fornecedor antes da listagem. As regiões são brasileiras, em Estado > Cidade > Bairro; não há CEP na aquisição. Sem região selecionada, usa Brasil; sem cidade, o estado; sem bairro, a cidade inteira.

Situação inicia em ativa e pode ser alterada, assim como portes, matriz/filial, regime, capital, abertura, DDD e contatos. Telefones/emails repetidos e exportadas na conta são exclusões fixas. Quantidade é de 1 a 100, dentro do limite diário; offset começa em zero. Sugerir nome usa Nicho · Bairro · Cidade/UF. Contar resultados usa o endpoint de contagem, sem listar empresas ou criar uma importação.

Confira o resultado e marque as empresas para importar. Empresas sem telefone válido permanecem no histórico; não entram na fila. CNPJ já cadastrado é vinculado ao grupo, preservando cadastro e responsável. A seleção não registra interesse comercial e não assume carteira. Use Prospectar esta lista para seguir o atendimento existente.

A ficha mostra situação, porte, abertura, endereço e detalhes empresariais da origem, separados do cadastro manual. O complemento conserva a primeira consulta importada. O endereço recebido continua visível mesmo sem correspondência na base de CEP. Na consulta pessoal, a localização pode vir dos dados cadastrais ou da região da coleta; a consulta legada mantém sua base de CEP.

Vendedores veem nome e função dos sócios. Documentos e representantes ficam em tabela própria com RLS de gestor e componente servidor exclusivo do gestor. O JSON de buscas e as fichas compartilhadas são sanitizados no banco, antes de chegarem ao navegador.

## Google

Planejar buscas abre o planejamento semanal, com edição de dias futuros, critérios opcionais e espelhamento. Consultar empresas do Google abre a consulta pessoal com origem Google. Execução, planilha, três lotes de até 50 candidatas e regra de sexta às 17h estão em [operação do agente](agente-google-crm.md). Listas compartilhadas antigas continuam no caminho legado explícito.

Localizar empresas reúne entregas Google, importações próprias do banco e carteira existente, sem repetir empresas. Origem é escolhida na central. Nicho restringe bairros disponíveis, Mais filtros abre o cartão adicional e Enter recolhe os filtros. Situação aparece em tag por empresa. A próxima reserva conserva o escopo pessoal e usa o contexto atômico da fila.

## Limites e falhas

Cota por vendedor em empresas solicitadas no dia de São Paulo. A reserva acontece antes da rede e permanece em falhas, porque a cobrança externa pode ter ocorrido. Não há retry automático. O UUID da operação impede nova chamada ao repetir a mesma submissão.

Busca sem confirmação permanece no histórico. Recarregar consulta só lê o banco. Confira a conta CNPJ.biz antes de iniciar outra consulta quando houver timeout ou falha de persistência. Pausa impede novas consultas e importações; resultado já solicitado pode ser preservado. Mudança de papel e desativação são verificadas pelo banco.

O histórico do vendedor contém somente suas buscas; o gestor vê as últimas 50 de todos, critérios, retornos e grupo criado. A consulta pessoal pagina 20 empresas únicas e autorizadas. Não há rotina de limpeza automática de buscas nesta entrega.

## Contrato e testes

Contrato público [CNPJ.biz V2](https://cnpj.biz/docs-api), [OpenAPI consultado em 2026-10-22](https://cdn.cnpj.biz/api-docs/openapi.yaml?v=1780667809). EmpresaListagem tem formato diferente do endpoint por CNPJ. Não usar a API do CRM interno do CNPJ.biz para esta aquisição.

Cliente HTTP com timeout de 25 segundos para a operação, limite de resposta de 2 MB, sem redirects, cache ou retries. Chave enviada em Authorization Bearer somente para a origem fixa oficial. Telefones e email não são prova de canal validado ou interesse comercial.

Testes unitários cobrem contrato HTTP, filtros e idempotência do serviço; integração cobre RLS, concorrência, pausas e importação; jornada no navegador cobre as duas fontes, conferência, ficha e pausa do gestor. Harness E2E zera CNPJ_BIZ_API_KEY herdada. Email, disparos, campanhas e assinaturas de catálogo permanecem adiados.

Na ficha pública, telefones ficam ocultos até haver posse ou reserva vigente. O gestor tem leitura administrativa. O histórico de uma busca própria preserva os dados obtidos naquela consulta.

## Validação da entrega

Em 2026-10-22, no checkout limpo do commit 2e2f155: 1.326 testes unitários passaram, um ignorado; 604 de integração passaram, um ignorado. Lint, typecheck e checagem de migrações passaram. No checkout de trabalho, build E2E e 11 jornadas afetadas passaram, incluindo Google, importação CNPJ.biz, pausa do gestor, Prospecção, reserva e Carteira. Nenhum crédito externo usado. As falhas prévias de prosa em CONTINUIDADE-CODEX.md e lint em .artifact-work são de arquivos locais fora da branch e foram preservadas.

Jornada da feature: npm run test:e2e -- --sem-build tests/e2e/busca-empresas.spec.ts, após npm run build:e2e.
