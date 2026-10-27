# Busca de empresas

## Ativação

1. Aplicar migrações pendentes pelo procedimento normal de implantação do CRM. A aquisição nasceu em 0038/0039; a integração atual inclui 0040–0046. A 0043 acrescenta consulta pessoal, a 0044 amplia filtros e protege documentos de sócios, e a 0046 registra a Casa dos Dados e bloqueia repetição na base global.
2. Configurar CASA_DOS_DADOS_API_KEY no ambiente do servidor com a chave da Casa dos Dados. Nunca usar prefixo NEXT_PUBLIC_, commitar a chave ou informar em logs.
3. Como gestor, abrir Empresas → Busca de empresas e definir limite diário por vendedor. Zero é o padrão. O limite do CRM não consulta nem representa o saldo de créditos da conta.
4. Como vendedor, abrir Prospecção → Banco de empresas → Buscar novas empresas. Google tem o acesso Planejar buscas na mesma central.

Em 27/10/2026, a migração 0046 foi aplicada na Railway após backup criptografado conferido. Uma consulta real autorizada retornou e importou uma empresa para Junior. O saldo aferido passou de 2.000 para 1.999 créditos. A validação de entrega usou as funções nativas com identidade RLS do vendedor; isso não equivale a uma jornada autenticada no navegador online. O limite temporário foi restaurado para zero. A publicação do novo cliente é registrada em [produção Vercel](producao-vercel.md).

## Uso

O formulário tem seis cartões: atividade/nome, localização, perfil, capital/abertura, contatos e resultados. Somente o primeiro inicia aberto. Palavras, CNAEs e naturezas aceitam múltiplos códigos separados por vírgula. CNAEs e naturezas jurídicas usam os códigos diretamente, sem consultas auxiliares. As regiões são brasileiras, em Estado > Cidade > Bairro; não há CEP na aquisição. Sem região selecionada, usa Brasil; sem cidade, o estado; sem bairro, a cidade inteira.

Situação inicia em ativa e pode ser alterada, assim como portes, matriz/filial, capital, abertura, DDD e contatos. O regime disponível é optante pelo Simples Nacional; os demais regimes e o contato telefone OU email não têm equivalente nesta API. MEI deve ser pesquisado separado dos outros portes. Capital mínimo/máximo aceita reais inteiros, sem centavos, conforme o contrato do fornecedor. Quantidade é de 1 a 100, dentro do limite diário; a página começa em 1 e o servidor deriva o deslocamento. Sugerir nome usa Nicho · Bairro · Cidade/UF. A pré-contagem foi retirada: não há endpoint gratuito de contagem documentado neste contrato.

A API recebe listas globais de UF, município e bairro, sem pares entre eles. Só combinações que preservam exatamente as regiões selecionadas são enviadas. Estados inteiros, cidades no mesmo estado e combinações retangulares com os mesmos bairros são aceitos. Regiões cruzadas ou bairros diferentes por cidade são recusados antes da cota e da rede, com orientação para separar as pesquisas.

A exclusão de empresas visualizadas na conta do fornecedor é fixa. Na importação, o banco confere CNPJ, telefone principal, telefones cadastrais e email contra a base global e contra o lote. A base global privada não é enviada ao fornecedor. Essa rechecagem ocorre com bloqueio transacional para impedir corrida entre importações e outros cadastros.

Confira o resultado e marque as empresas para importar. Empresas sem telefone válido permanecem no histórico; não entram na fila. Na Casa dos Dados, empresa ou contato repetido fica sinalizado e não pode ser selecionado/importado. Importações históricas CNPJ.biz conservam seu comportamento anterior. Reimportar a mesma seleção da mesma busca é idempotente. A seleção não registra interesse comercial e não assume carteira. Use Prospectar esta lista para seguir o atendimento existente.

A ficha mostra situação, porte, abertura, endereço e detalhes empresariais da origem, separados do cadastro manual. O complemento conserva a primeira consulta importada. O endereço recebido continua visível mesmo sem correspondência na base de CEP. Na consulta pessoal, a localização pode vir dos dados cadastrais ou da região da coleta; a consulta legada mantém sua base de CEP.

Vendedores veem nome e função dos sócios. Documentos e representantes ficam em tabela própria com RLS de gestor e componente servidor exclusivo do gestor. O JSON de buscas e as fichas compartilhadas são sanitizados no banco, antes de chegarem ao navegador.

## Google

Planejar buscas abre o planejamento semanal, com edição de dias futuros, critérios opcionais e espelhamento. Consultar empresas do Google abre a consulta pessoal com origem Google. Execução, planilha, três lotes de até 50 candidatas e regra de sexta às 17h estão em [operação do agente](agente-google-crm.md). Listas compartilhadas antigas continuam no caminho legado explícito.

Localizar empresas reúne entregas Google, importações próprias do banco e carteira existente, sem repetir empresas. Origem é escolhida na central. Nicho restringe bairros disponíveis, Mais filtros abre o cartão adicional e Enter recolhe os filtros. Situação aparece em tag por empresa. A próxima reserva conserva o escopo pessoal e usa o contexto atômico da fila.

## Limites e falhas

Cota por vendedor em empresas solicitadas no dia de São Paulo. A reserva acontece antes da rede e permanece em falhas, porque a cobrança externa pode ter ocorrido. Não há retry automático. O UUID da operação impede nova chamada ao repetir a mesma submissão.

Busca sem confirmação permanece no histórico. Recarregar consulta só lê o banco. Confira a conta do fornecedor antes de iniciar outra consulta quando houver timeout ou falha de persistência. Pausa impede novas consultas e importações; resultado já solicitado pode ser preservado. Mudança de papel e desativação são verificadas pelo banco.

O histórico do vendedor contém somente suas buscas; o gestor vê as últimas 50 de todos, critérios, retornos e grupo criado. A consulta pessoal pagina 20 empresas únicas e autorizadas. Não há rotina de limpeza automática de buscas nesta entrega.

## Contrato e testes

Contrato atual: [Pesquisa avançada Casa dos Dados](https://docs.casadosdados.com.br/pesquisa-avan%C3%A7ada-de-empresas-16579062e0), consultado em 27/10/2026. POST /v5/cnpj/pesquisa?tipo_resultado=completo. O resultado simples não contém o conjunto de contatos necessário. O cliente não usa mais CNPJ.biz para novas consultas; dados históricos e o normalizador de fixtures legadas são preservados.

A resposta completa real confirmou contato_telefonico (ddd/numero/completo), contato_email (email/valido), situacao_cadastral.situacao_atual, data_abertura com horário, endereço e quadro societário. A normalização remove dados não usados, ignora emails marcados inválidos e jamais inclui mei.cpf no DTO. Não se infere Lucro Real de uma empresa não optante pelo Simples. A devolução de telefone/email não comprova WhatsApp ou interesse comercial.

Cliente HTTP com timeout de 25 segundos para a operação, limite de resposta de 2 MB, sem redirects, cache ou retries. Chave enviada no header api-key somente para https://api.casadosdados.com.br. Telefones e email não são prova de canal validado ou interesse comercial.

Testes unitários cobrem contrato HTTP, filtros e idempotência do serviço; integração cobre RLS, concorrência, pausas e importação; jornada no navegador cobre as duas fontes, conferência, ficha e pausa do gestor. Harness E2E zera CASA_DOS_DADOS_API_KEY e CNPJ_BIZ_API_KEY herdadas e aceita apenas chave fictícia e banco/mock loopback. Email, disparos, campanhas e assinaturas de catálogo permanecem adiados.

Na ficha pública, telefones ficam ocultos até haver posse ou reserva vigente. O gestor tem leitura administrativa. O histórico de uma busca própria preserva os dados obtidos naquela consulta.

## Validação da entrega

Em 2026-10-22, no checkout limpo do commit 2e2f155: 1.326 testes unitários passaram, um ignorado; 604 de integração passaram, um ignorado. Lint, typecheck e checagem de migrações passaram. No checkout de trabalho, build E2E e 11 jornadas afetadas passaram, incluindo Google, importação CNPJ.biz, pausa do gestor, Prospecção, reserva e Carteira. Nenhum crédito externo usado. As falhas prévias de prosa em CONTINUIDADE-CODEX.md e lint em .artifact-work são de arquivos locais fora da branch e foram preservadas.

Jornada da feature: npm run test:e2e -- --sem-build tests/e2e/busca-empresas.spec.ts, após npm run build:e2e.


## Validação Casa dos Dados em 27/10/2026

A operação persistente aa837162-0f27-41b9-b4a9-8843238ef64b solicitou uma empresa com CNAE principal 4755502, ATIVA, Brás, São Paulo/SP e telefone disponível. Uma chamada HTTP completa retornou uma empresa, um telefone, um email e dois sócios. O corpo real foi guardado criptografado e normalizado sem refazer a compra. A importação criou uma empresa e um vínculo em grupo próprio do Junior; a repetição criou zero empresas e manteve o grupo. O gestor vê a busca e os dois sócios protegidos; os outros dois vendedores não veem a busca nem a empresa na consulta pessoal. Junior recebe somente nome e função dos sócios.

Hashes dos 43 cadastros anteriores, quatro usuários, 11 linhas de fila, duas negociações, uma venda, dois grupos e 43 vínculos anteriores coincidiram após a operação. O limite de Junior voltou ao valor inicial zero; os demais não foram habilitados. O saldo aferido após a única compra foi 1.999 créditos. A ativação de novas buscas segue os limites definidos pelo gestor, separada do saldo do fornecedor.
