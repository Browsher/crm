# Dívida técnica da fundação

Achados da auditoria de 2026-09-08 que não entraram na fatia 0a.1. Pegar
quando doer. Ao resolver, apagar daqui.

## Invariantes sem teste

- `PG_SSL=off` é aceito para qualquer host. Nada impede desligar TLS contra
  a Railway. Com login, expõe token de sessão, não só a senha do papel.
- Checador não procura `PASSWORD` nem `ALTER ROLE ... LOGIN` em migração.
- Guarda de `BYPASSRLS` em `pool.ts` sem controle negativo.
- CHECK de `nome` não vazio, UNIQUE de `email`, `atualizado_por` forjado no
  INSERT: sem teste.
- Nenhum teste chama `obterPool()` ou `conectarVerificado()` sem argumento.
  O caminho que a aplicação usa nunca rodou.

## Código sem cobertura

- `scripts/db/*.mts` inteiros. O CI roda `db:checar` e `db:pendentes`, nunca
  `db:aplicar`, `db:seed:gestor` ou `db:senha`.
- `ssl.ts` com `PG_SSL_CA` como caminho de arquivo. Nenhum handshake TLS de
  verdade acontece em teste.
- `seed.ts`: e-mail repetido estoura `23505` como exceção, fora do contrato
  `{ ok, motivo }`.
- `situacao` com divergentes nunca é asserido.

## Segurança e operação

- `db:senha` recebe a senha em `argv`: visível em histórico e `ps`. Não
  repetir o padrão no seed com senha.
- Harness grava senha `'teste'` em `app_conexao`, papel global do cluster.
  Se `.env.test.local` apontar para a Railway, roda lá. Nenhuma conferência
  de host.
- Não existe primitiva de conexão sem identidade; `obterPool` e
  `conectarVerificado` são exportados. A fronteira `comoUsuario` é convenção,
  sem lint.
- Contrato de erro cobre só `42501` e `afetadas: 0`. Login vai precisar de
  `23505`.
- "Gestor não se rebaixa" tem contorno: gestor cria segundo gestor, que
  altera o primeiro. Decidir se importa.
- Catálogo (`pg_proc.prosrc`, `pg_policies`) legível por qualquer papel.
  Normal no Postgres; registrado como reconhecimento possível.

## Ferramental

- Sem projeto Vitest para React. `jsdom` e plugin instalados, não
  configurados.
- Next 16 usa `proxy.ts`, não `middleware.ts`. Portar o guarda do crm-ch,
  não copiar.
