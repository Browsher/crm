# CRM

CRM para uma equipe de cinco vendedores por telefone. Next.js, TypeScript,
Postgres com RLS. A autoridade sobre quem vê o quê está no banco, não no código.

## Subir

```bash
npm ci
npm run db:subir                      # Postgres 17 em Docker
cp .env.example .env.local            # e ajuste a senha local
npm run db:aplicar                    # migrações + invariantes
npm run db:senha -- app_conexao <senha-local>
npm run db:seed:gestor -- "Seu Nome" voce@dominio
npm run dev
```

## Testar

```bash
npm test                # unitário + integração (precisa do container)
npm run test:unit
npm run test:integracao
npm run db:checar       # convenções das migrações, sem banco
```

Os testes de integração criam um banco por arquivo no container e o derrubam
no fim. O CI faz o mesmo com `services: postgres`.

## Banco na Railway

Aplicar migração em produção é manual, da sua máquina, com
`.env.railway.local` (ignorado pelo git):

```bash
ALVO=railway npm run db:pendentes     # só lê
ALVO=railway npm run db:aplicar
```

O PR roda a conferência somente-leitura contra a Railway e falha se uma
migração aplicada foi alterada.

## Por quê

`docs/db/fundacao.md` explica a fundação: papéis, identidade por transação,
regras de migração, TLS até a Railway. Cada migração tem seu
`docs/db/NNNN.md`. A spec completa está em `docs/superpowers/specs/`.
