# Compatibilidade com a busca CNPJ.biz

Conferência em 22/10/2026, após atualizar `origin/main`.

- Base da migração visual: main `b62cfa6a4b04c2346dbfff8471f54e1421185394`.
- Busca de empresas: [PR #56](https://github.com/Browsher/crm/pull/56), aberto e
  ainda não integrado, commit `b4ea0a2d0a7f8c72351e55b090070ea3761ebcaf`.
- O checkout compartilhado `C:/Users/ADM/projetos/crm` permaneceu intacto.
- `/fila/buscar` e `/empresas/busca` ainda não pertencem à main. Este PR de
  redesenho não declara que migrou ou validou essas duas rotas.

Os componentes públicos `Button`, `Input`, `Textarea`, `NativeSelect`, `Alert`
e a ponte `--ui-*` foram preservados. As telas da busca poderão consumir a
mesma base visual sem alterar suas ações, tipos ou serviços.

## Integração necessária após o PR #56

A simulação `git merge-tree --write-tree HEAD b4ea0a2d0a7f8c72351e55b090070ea3761ebcaf`
não altera o checkout. Ela encontrou um conflito de conteúdo em
`app/fila/page.tsx`, no cabeçalho que ganhou o atalho **Buscar empresas**.
Preservar esse atalho como mais uma ação de `CabecalhoPagina`, junto de
**Localizar empresa**. Não resolver o conflito escolhendo a versão inteira
de uma das branches.

As alterações de dados cadastrais em `app/empresas/[id]/page.tsx` foram
combinadas automaticamente pela simulação, mas exigem revisão semântica:
`DadosCadastrais` deve permanecer dentro do conteúdo autorizado da ficha,
na aba de dados. Manter também os dados nas fichas de Carteira e Localizar.

Conferir os seguintes pontos depois da integração real:

1. Preservar os novos destinos em `CaminhoCrm` e as ações de acesso à busca.
2. Aplicar superfícies e cabeçalhos aos arquivos de busca e componentes
   compartilhados indicados no PR #56. Não mudar campos, UUIDs ou FormData.
3. Preservar os cenários e a sanitização de `CNPJ_BIZ_API_KEY` no harness E2E,
   combinando-os com o mock local de WhatsApp deste PR.
4. Reexecutar as jornadas de busca, pausa/limite, Google, reserva e fichas,
   usando dados persistidos e fornecedor simulado.

Consultas pagas continuam exclusivas do servidor. O limite conta empresas
solicitadas no dia de São Paulo, inclusive falhas. Repetir uma operação não
pode renovar sua identificação nem cobrar novamente. Importação reaproveita
CNPJ existente sem sobrescrever dados manuais, posse, reserva ou carteira.
Empresas sem telefone válido permanecem impedidas de importar; a visibilidade
dos telefones continua sendo decidida pelo banco.

Este trabalho não aplica as migrações 0038/0039, não configura chave e não
libera limites. Email, campanhas e catálogo recorrente continuam adiados.
