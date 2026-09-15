# Plano: perfil do vendedor

Spec: `docs/superpowers/specs/2026-09-14-perfil-vendedor-design.md`.
Executar com TDD e uma revisão independente final.

1. Testes de integração em `tests/integracao/perfil-vendedor.test.ts`: recusa
   de papéis/alvos, contagens coerentes com dashboard, autoria versus posse,
   reservas fora da carteira, paginação e limite de atividade. Implementar
   `src/features/gestao/perfil-vendedor.ts` com uma instrução SQL/snapshot.
2. Teste RED do link em Usuários e da ausência de link no dashboard e da nova página. Implementar
   `app/usuarios/vendedores/[id]/page.tsx` e CSS no padrão existente. Compor os
   rótulos de contato na página, sem importação entre features.
3. E2E com dados próprios em `tests/e2e/perfil-vendedor.spec.ts`: link real,
   leitura, ausência de ações/links para empresas, retorno e acesso negado.
   Capturas 390/1280 claro/escuro.
4. Testes focados durante a implementação. Uma rodada completa com dois
   workers unitários, integração, build e navegador. Revisão independente,
   PR e CI. Preservar arquivos locais alheios e aguardar validação visual.

## Evidências de execução

- RED observado na importação da consulta/página ausente e no link do dashboard.
- Focados: 4 testes de integração e 9 unitários verdes após implementação.
- Rodada completa: typecheck, lint e db:checar verdes; 914 unitários + 1
  pulado (inventário 915), 469 de integração + 1 pulado, build:e2e verde
  e 41 jornadas de navegador verdes em banco temporário local.
- Unitários executados com dois workers para limitar concorrência local;
  sem alteração de timeout ou configuração do projeto.
- Revisão independente final sem achados concretos de autorização,
  métricas, paginação ou fluxo. Carteira não inclui reservas.
- Capturas 390/1280 em claro/escuro; transições desativadas apenas na captura
  para registrar as cores finais. Nenhuma mudança de tema em produção.
- PR aguarda validação visual antes do merge. Sem migração nesta fatia.

## Ajuste de entrada solicitado pelo usuário

Acesso movido para Ver perfil em Usuários; dashboard sem link. Rota movida
para /usuarios/vendedores/[id], com Voltar para Usuários e menu dessa área.
Dois testes RED confirmaram o link ausente em Usuários e o link indevido
no dashboard; após correção, 11 testes focados passaram.
