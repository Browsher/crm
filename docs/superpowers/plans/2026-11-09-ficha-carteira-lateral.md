# Ficha lateral da Carteira

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir a ficha completa do cliente em uma lateral sobre a Carteira e executar atendimento e recompra na mesma superfície.

**Architecture:** Manter a rota canônica `/carteira/[id]` e compartilhar a leitura autenticada entre a navegação a partir da lista e a entrada direta. Reaproveitar a moldura, o menu, a linha do tempo, as ações de atendimento e o envio de recompra. A ficha controla os níveis de leitura e as tarefas, com confirmação central.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Playwright e PostgreSQL 18 de teste.

**Spec:** [Abertura da ficha do cliente](../../design/2026-11-06-carteira-abertura-cliente/README.md) e [padronização dos painéis](../specs/2026-11-05-padronizacao-paineis-crm-design.md#carteira). A opção A foi aprovada em 06/11/2026.

## Global Constraints

- A lista mantém filtros, posição e gatilho ao voltar. O endereço canônico continua válido ao recarregar ou chegar do Meu dia e da primeira venda. O retorno de Meu dia usa a origem e os filtros validados.
- Lateral padrão de até 520 px e tela inteira até 820 px. Menu com Atendimento e próximo passo, Dados da empresa e Histórico. Registrar venda no rodapé quando permitido. Tarefas internas usam Voltar e as ações ficam no rodapé. Confirmações continuam centrais.
- Dados em Contato e localização, Cadastro e origem e Atividades e sócios. Usar os dados e fontes que já estão autorizados, incluindo Contato principal da Carteira. Preservar o filtro de histórico ao alternar entre leitura e tarefas.
- Manter critérios de cliente, permissões, RLS, estados de arquivo, retorno e os comandos persistidos de atendimento e venda. Entrada direta de outro vendedor continua 404. Nenhuma migração, integração ou busca paga para validar.
- Executar em branch e abrir PR com CI verde. Merge e publicação ficam para outra autorização.

## Review Focus

- Apertar Voltar do navegador durante uma edição suja ou em voo preserva a ficha até uma decisão. O fechamento explícito e a confirmação restauram o foco sem pular entradas do histórico.
- Reload e resposta perdida permitem recuperar exatamente o comando anterior. Recompra preserva a agenda e entrada da primeira venda abre o cliente correto.
- Abrir outra empresa não reaproveita dados, rascunhos visuais ou histórico da anterior. Consultas legadas de arquivo e entradas não-clientes preservam suas regras.
- Trocar de tamanho com a lateral ou confirmação aberta preserva ações acessíveis e mantém a página sem transbordamento. Teclado e tema seguem a base compartilhada.

### Task 1: Navegação e ficha completa

**Files:** `app/carteira/` (layout, lista, rotas de ficha e componentes), `app/fila/cartao.tsx` apenas se necessário para o link alternativo da lista, e testes DOM/unitários correspondentes.

**Interfaces:** Preservar `urlFicha(id, filtros)`, o retorno autorizado do Meu dia e `?venda=registrada`. Usar o mesmo compositor para a ficha do cliente por entrada direta e pela lista. Reaproveitar `useEnvioVenda` e a guarda do editor, sem duplicar o envio nem montar duas laterais de conteúdo. A rota atual já serve consultas autorizadas não-clientes e arquivo legado; preservar seus acessos.

- [ ] Escrever regressões DOM para o menu, mudança de níveis, filtro de histórico, tarefa de venda na mesma lateral e rascunho do atendimento protegido; executar e verificar o vermelho.
- [ ] Ligar a abertura da lista à ficha canônica sem perder o estado da lista. Usar navegação interceptada com retorno à lista montada e fallback direto sobre a Carteira, ou mecanismo equivalente comprovado no navegador.
- [ ] Compor Atendimento e próximo passo, três grupos de dados e linha do tempo com as fontes atuais. Inserir atendimento e recompra na mesma lateral, preservar comandos pendentes e manter as confirmações centrais.
- [ ] Rodar testes unitários e DOM da Carteira, tipos e lint, e entregar commit para revisão.

### Task 2: Jornadas da ficha e dos fluxos existentes

**Files:** `tests/e2e/carteira-visual.spec.ts`, `venda-recuperacao.spec.ts` e os testes existentes que entram na ficha por Carteira, Meu dia, Funil ou arquivo. Usar fixtures já isolados.

- [ ] Demonstrar abertura por Ver cliente e Abrir na carteira, filtros e rolagem ao fechar, Voltar do navegador e entrada canônica após reload. Manter teste de 404 e dados privados.
- [ ] Cobrir grupos, histórico com filtro persistido, atendimento e recompra em uma lateral, centralidade e foco das confirmações, rascunho, envio lento, erro e resposta perdida. Adaptar seletores legados somente onde a interação aprovada mudou.
- [ ] Conferir desktop, largura de 390 px, teclado e ambos os temas. Rodar os testes afetados com PostgreSQL local isolado e provedores simulados.
- [ ] Revisar a branch completa, abrir a PR e conferir todos os checks no commit submetido.
