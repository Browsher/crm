# Publicação manual após integração no Git

A integração das PRs e a publicação em produção são decisões separadas. Para permitir os merges autorizados sem publicar automaticamente o CRM, o `vercel.json` contém este controle versionado:

```json
"git": {
  "deploymentEnabled": {
    "main": false
  }
}
```

Em consulta somente de leitura realizada em 28/10/2026, o projeto Vercel do CRM estava conectado ao GitHub, com `main` como branch de produção e atribuição automática de domínios habilitada. Sem esse controle, commits e merges na `main` poderiam iniciar uma publicação automática pela integração Git.

## Efeito da regra

- Commits e merges na `main` deixam de acionar deployments automáticos pela integração Git da Vercel quando essa configuração estiver presente na branch.
- As demais branches não recebem bloqueio nesta regra. A Vercel considera `true` para branches não especificadas; previews continuam sujeitos às demais configurações do projeto.
- O merge continua sendo uma integração de código. Uma publicação manual, inclusive por CLI, permanece uma operação separada e exige sua própria autorização. Esta alteração não executa uma publicação.

O controle atua sobre os gatilhos de deployment da integração Git. Não desativa globalmente a Vercel, não altera configurações externas e não constitui garantia sobre outros caminhos de publicação. Para voltar a permitir o gatilho Git automático da `main`, uma mudança explícita e revisada pode remover o bloqueio ou mudar seu valor para `true`.

Fonte: [documentação oficial de `git.deploymentEnabled` da Vercel](https://vercel.com/docs/project-configuration/git-configuration), consultada em 28/10/2026.
