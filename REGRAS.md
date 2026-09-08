# Regras

Cada regra aqui nasceu de um tropeço real. Se não doeu, não entra.

Quando algo der errado, a pergunta é: **eu perceberia isso sozinho?**
Se sim, vira bilhete. Se não, vira catraca (hook ou CI).

---

## R-001 — Nada entra na main sem CI verde

O que aconteceu: eu commitava direto na main e só descobria o erro dias depois.
A regra: toda mudança passa por branch e PR. Merge só com CI verde.
Tipo: catraca
Onde: branch protection no GitHub + `.github/workflows/ci.yml`

---

## R-002 — Um gerenciador de pacotes só por projeto

O que aconteceu: o CI foi escrito para pnpm num projeto npm. Falhou em 13s
procurando um `pnpm-lock.yaml` que não existia.
A regra: o lockfile manda. `package-lock.json` = npm em tudo, inclusive no CI.
Tipo: bilhete

---

## R-003 — Peer dependency incompatível: sobe a versão, não força

O que aconteceu: `npm i -D vitest` quebrou porque o Vitest 5 exigia
`@types/node` 22+ e o projeto tinha 20.
A regra: subir o pacote antigo. Nunca `--force` nem `--legacy-peer-deps` —
eles escondem o conflito e quebram depois, num erro difícil de rastrear.
Tipo: bilhete

---

## R-004 — Não depender de tipo gerado pelo build no typecheck

O que aconteceu: `app/layout.tsx` usava `LayoutProps<"/">`, tipo que o Next
gera durante o build. No CI o build não roda, e o typecheck falhou.
A regra: tipar props na mão (`{ children: React.ReactNode }`) em vez de usar
tipo gerado, a não ser que o build rode antes no CI.
Tipo: catraca (o typecheck no CI já pega)

---

## R-005 — `Set-Content -Encoding utf8` no PowerShell gera BOM

O que aconteceu: o JSON de branch protection foi rejeitado pela API do GitHub
com "Problems parsing JSON" por causa do BOM no começo do arquivo.
A regra: para arquivo que vai para API ou parser, usar
`[System.IO.File]::WriteAllText()`.
Tipo: bilhete

---

## R-006 — PowerShell 5.1 engole o `--` em comandos com flags repassadas

O que aconteceu: `claude mcp add obsidian -- npx -y obsidian-mcp <path>`
falhou com "unknown option" porque o PowerShell descartou o `--` e passou
o `-y` para o próprio claude.
A regra: usar `--%` antes dos argumentos, ou rodar pelo Git Bash.
Tipo: bilhete

---

## R-007 — RESET ALL não restaura o papel no Postgres

O que aconteceu: o crm-ch usava RESET ALL no finally achando que devolvia o
papel. O parâmetro `role` é marcado com GUC_NO_RESET_ALL. Ficou seguro por
acidente porque SET LOCAL ROLE já volta sozinho no fim da transação.
A regra: RESET ROLE explícito, sempre, além do RESET ALL.
Tipo: catraca
Onde: teste de controle negativo em tests/integracao/identidade.test.ts

---

## R-008 — tsx trata .ts como CommonJS sem "type": "module"

O que aconteceu: os CLIs com await no topo do arquivo falharam.
A regra: script com top-level await usa extensão .mts.
Tipo: bilhete

---

## R-009 — senha dentro de URL não pode ter caractere de delimitação

O que aconteceu: senha gerada em Base64 tinha "/" e quebrou o parser de URL
do Node no CI, com "Invalid URL".
A regra: senha que vai em connection string é alfanumérica, ou
percent-encoded (@ = %40, / = %2F, # = %23, % = %25).
Tipo: bilhete


## R-010 — No PG 16+, NOINHERIT no papel não muda grant existente

O que aconteceu: a auditoria da fundação propôs `ALTER ROLE app_conexao NOINHERIT`
para app_conexao parar de herdar app_usuario. Verificado no container: o grant
continuou com `inherit_option = t` e a leitura sem SET ROLE seguiu funcionando.
Desde o PG 16 a herança mora no grant; o atributo do papel só define o padrão
de grants futuros.
A regra: herança se revoga no grant, com
`REVOKE INHERIT OPTION FOR <papel> FROM <membro>`. Conferir em
`pg_auth_members.inherit_option`, não em `pg_roles.rolinherit`.
Tipo: catraca
Onde: invariante em src/server/db/migracoes/invariantes.ts

---

## R-011 — Fim de linha muda a soma de migração; o .gitattributes vem antes da primeira migração

O que aconteceu: `db:pendentes` local acusou as seis migrações da fatia 0a como
alteradas na Railway. Diagnóstico inicial errado: "a normalização mudou a soma
na Railway". Conferindo soma a soma, a Railway e o índice do git estavam em
LF, iguais ao CI. Quem divergia era o disco local: `core.autocrlf=true` no
Windows fez o checkout em CRLF antes de o `.gitattributes` existir, e o runner
calcula a soma do byte em disco. Quase custou um `DROP SCHEMA` desnecessário.
A regra: (a) `.gitattributes` com `eol=lf` explícito para `db/migracoes/*.sql`
existe antes da primeira migração, nunca depois; (b) antes de concluir que a
soma mudou "no banco", comparar a soma gravada com o sha256 do índice
(`git show HEAD:arquivo`) e do disco, e ler `git ls-files --eol`; (c) disco em
CRLF se corrige apagando o arquivo e refazendo o checkout, não com migração
nova nem re-registro de soma.
Tipo: bilhete
Onde: `.gitattributes`

---

<!-- próximas regras aqui -->