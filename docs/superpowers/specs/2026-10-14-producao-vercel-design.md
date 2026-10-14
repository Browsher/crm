# Preparação do CRM para Vercel e Postgres na Railway

Data: 14/10/2026. Escopo aprovado na conversa: concluir grupos/CNPJ opcional, preparar produção para vendedores no celular, limpar testes sem backup e importar Mooca. Hospedagem escolhida pelo usuário: Vercel. O PR #50 foi integrado na main como 0c7585161ee858810b75a707a727b016a016869d.

## Resultado esperado

O site é executado pela Vercel, em HTTPS, e usa exclusivamente o Postgres já hospedado na Railway. O computador do gestor e o Docker local ficam apenas para desenvolvimento e testes. Sessões, permissões e reservas continuam no banco.

## Alteração limitada ao fluxo existente

- Atualizar Next e eslint-config-next de 16.3.4 para 16.3.8, patch indicado para GHSA-vcvr-r3jv-pc5j, mantendo React e as demais dependências.
- Fixar Node 24.x para corresponder ao CI e ao runtime disponível na Vercel.
- Reutilizar o pool por processo/URL e registrar o pool com attachDatabasePool do @vercel/functions somente quando VERCEL=1. Isso permite liberar conexões ociosas antes da suspensão de funções.
- PG_POOL_MAX é opcional, inteiro entre 1 e 10, padrão 10. Produção usará 2 por processo. O limite por pool não equivale a um limite global entre instâncias; o papel app_conexao permanece limitado a 20 conexões.
- Manter TLS verificado com CA inline e nome postgres.railway.internal pelo proxy público. A aplicação usa app_conexao, sem SUPERUSER/BYPASSRLS. A URL administrativa fica fora da Vercel.
- Manter leitura preguiçosa de env, build sem banco e comprovante de importação assinado por IMPORTACAO_CONFERENCIA_SEGREDO no servidor.

## Dados e operação

A inspeção remota somente leitura encontrou zero empresas, contatos, grupos, reservas, negociações e vendas; há um gestor ativo com senha provisória pendente. Não há vendedores ou base de testes remota para apagar. Aplicar apenas as migrações já integradas, sem recriar schemas ou remover CEP, migrações, credenciais ou configurações.

A base local tem registros de teste, mas não será publicada nem sincronizada com a Railway. A limpeza local fica depois da validação online, conforme a ordem aprovada. Não produzir backup dos registros de teste. Arquivos originais da coleta Mooca e documentos do projeto permanecem preservados.

Importar as 43 linhas prontas somente pelo fluxo autorizado de gestor, depois de ele trocar a senha provisória. Não contornar pode_escrever nem inserir dados diretamente como postgres. As duas linhas sem telefone continuam em pendencias.csv. Vendedores reais dependem dos nomes e e-mails fornecidos pelo gestor.

## Publicação

Decisão atualizada em 14/10/2026: o usuário recusou ativar Pro agora e autorizou publicar o projeto para testes no Hobby. Essa autorização substitui o bloqueio de publicação do planejamento inicial. Manter a conta no plano existente e o Postgres CRM CH na Railway. Importação real e operação comercial ficam para depois da validação desse ambiente pelo gestor.

Configurar secrets somente em Production. Previews comuns não devem escrever na base operacional. Testar a versão candidata de produção antes de liberar o endereço aos vendedores. O domínio inicial pode ser o endereço vercel.app; domínio próprio não é pré-requisito.

## Verificação

TDD no ajuste de env/pool, controles de URL diferente e fechamento/recriação do pool, validação de PG_POOL_MAX e do registro exclusivo na Vercel. Testes unitários, integração, CI com Next atualizado, build sem env e jornadas existentes em 390/820/1280. Na hospedagem: HTTPS, cookie Secure/HttpOnly, acesso ao Postgres com app_conexao, troca de senha, grupos e acesso negativo de vendedor à administração.

Fontes: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j ; https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package ; https://vercel.com/docs/limits/fair-use-guidelines ; docs/db/fundacao.md.
## Execução validada em 14/10/2026

Publicação de testes pronta, conexão restrita validada, limpeza local e atalho online concluídos. O usuário autorizou explicitamente a troca de senha de app_conexao, mantendo a senha do gestor. Login autenticado e jornadas privadas online aguardam o primeiro acesso do gestor, que exige troca da senha provisória. Evidências e próximos passos em docs/operacao/producao-vercel.md.
