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

<!-- próximas regras aqui -->