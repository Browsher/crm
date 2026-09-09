
Regra de fronteira: `features/` não importa de outra `features/`. Se precisar,
o que é comum sobe para `lib/` ou `server/`.

## Como trabalhamos aqui

- Feature grande (2+ arquivos ou regra de negócio): brainstorm e spec antes
  do código, pelas skills do Superpowers.
- Feature pequena: direto, mas com teste.
- TDD: teste falhando primeiro. Sempre.
- Branch + PR. Nunca commit na main — ela é protegida.

## Preferências e regras

Leia `PREFERENCIAS.md` e `REGRAS.md` na raiz antes de trabalhar. Se algo
específico deste projeto conflitar com eles, o projeto ganha, mas avise que
houve conflito.

## Contexto de domínio

- Dois papéis: `gestor` e `vendedor`. Gestor cria usuário, gera senha
  provisória, muda papel, desativa e reativa, por `/usuarios`. Vendedor não
  administra ninguém.
- Senha provisória: gerada pelo sistema, mostrada uma vez, nunca guardada.
  Quem a recebe é obrigado a trocar no primeiro acesso; até trocar, o banco
  nega escrita (`pode_escrever()`). Perdeu: o gestor gera outra, que derruba
  a anterior e as sessões da pessoa.
- Ninguém edita a própria linha em `usuario` (política). Gestor não se
  rebaixa nem se desativa; outro gestor pode.
- A autoridade é do banco (RLS e funções definidoras), não do TypeScript.
  Ver `docs/db/fundacao.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
