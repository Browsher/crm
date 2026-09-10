# Validação no Postgres 18

Escopo aprovado na conversa de 2026-09-10: validar em Postgres 18 isolado,
colocar a validação no CI e preservar o banco local em Postgres 17.

O CI usa hoje postgres:17; a Railway usa a versão maior 18. Restaurar um
backup em 18 não prova as regras de autorização exercitadas pela suíte.

O serviço de banco do job catraca passa para postgres:18. O nome do job
permanece igual para preservar a proteção da branch. Uma asserção de integração
consulta server_version_num e compara com PG_VERSAO_ESPERADA quando definida.
No CI ela vale 18; sem a variável, desenvolvimento local continua permitido.

Validação local: container descartável, porta própria somente em loopback,
sem volumes do CRM. Rodar integração, unidade, typecheck, lint e checagem de
migrações. Build e jornadas Playwright também devem passar no CI com PG18.
Um controle negativo contra PG17 deve falhar quando a versão esperada é 18.

Não atualizar o container de desenvolvimento nem aplicar migrações na Railway.
Não prometer equivalência de TLS, extensões ou configuração do provedor: esta
fatia valida compatibilidade com a versão maior, não replica toda a Railway.
Atualizar somente os trechos de dívida afetados, preservando registros históricos.
