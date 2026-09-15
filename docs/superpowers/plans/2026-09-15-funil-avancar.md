# Avanço sequencial do Funil

**Goal:** Aplicar o ajuste aprovado: arrastar somente para a próxima etapa no desktop; botão equivalente no modal/mobile, sem voltar ou pular.

**Architecture:** Drag nativo, sem pacote novo, em largura mínima 1024px com ponteiro preciso. Quadro destaca apenas destino permitido, bloqueia envio simultâneo e restaura estado se falhar. Clique segue abrindo modal. Modal usa botão com destino explícito; última etapa não oferece avanço. Banco mantém autoridade e verifica etapa anterior sob lock.

**Tech Stack:** Componentes atuais, React, PostgreSQL, Vitest e Playwright.

Escopo aprovado na conversa em 15/09/2026. Venda e devolução mantêm confirmação. Migração 0030, pois 0029 já foi aplicada localmente. Nenhuma edição de migração anterior, nenhum acesso de escrita à Railway. Ajuste no PR46 aberto; merge continua dependendo de aprovação visual.

- [x] RED: banco recusa retrocesso, salto e repetição; concorrência avança uma única vez. Helper e action recusam transição adulterada.
- [x] GREEN: helper em lib/comercial, guarda da action, migração0030 substitui apenas funil_etapa_definir, preservando locks/autorização.
- [x] RED/GREEN modal sem select, avanço único e ausência de avanço na última etapa. Quadro com drag desktop, resposta de erro preservando etapa e clique normal abrindo modal.
- [x] Navegador: arraste válido, salto/retrocesso recusados, celular sem arraste e botão acessível por teclado. Atualizar fixtures/listas de migração e inventário quando necessário.
- [x] Testes focados, integração, build/E2E, uma revisão independente final; atualizar PR e CI. Aplicar 0030 somente no Docker local para que localhost permaneça compatível.

Verificação: 936 unitários + 1 pulado; 486 integrações + 1 pulada; 42 E2E. Typecheck/build/db:checar aprovados; lint sem erros (um aviso em artefato local não versionado). Uma revisão independente sem achados. Migração0030 aplicada no Docker local com invariantes ok. CI do novo commit será conferido antes de concluir a entrega; merge continua pendente de aprovação visual.
