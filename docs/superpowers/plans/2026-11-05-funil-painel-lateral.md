# Funil com painel lateral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Entregar a etapa 1 do Funil conforme a prévia aprovada.
**Architecture:** A lateral e os pop-ups separam conteúdo de confirmação. O banco autoriza e registra o retorno ao Funil atomicamente. A interface atualiza a leitura e conserva a intenção durante falhas.
**Tech Stack:** Next.js, TypeScript, React, CSS, PostgreSQL, Vitest, Chromium.
**Spec:** docs/superpowers/specs/2026-11-05-funil-painel-lateral-design.md.

## Global Constraints

Branch codex/funil-painel-lateral baseada em 594e6e0. Testes em banco local descartável. Sem deploy, merge, fornecedores reais ou alteração em dados de produção. Disparo Git da Vercel desabilitado para a branch. Preservar RLS e autoridade SQL, idempotência e lock existentes, arquivo geral e fluxos fora do Funil. Não alterar dependências ou CI.

## Review Focus

- Arquivo de outra origem ou dono, cliente e ciclo antigo não podem retornar.
- A segunda aba ou a resposta perdida não pode criar nova negociação nem restaurar agenda.
- Voltar, Escape, trocar card e fechar não podem descartar edição sem decisão.
- Confirmação deve anteceder operação; animação exige sucesso atual e respeita movimento reduzido.
- URL de negociação, foco, teclado, dados cadastrais e leitura autorizada sobrevivem à mudança de apresentação.

### Task 1 — Arquivo do Funil e comando Devolver

**Ownership:** nova migração 0061 e docs/db/0061.md, src/lib/funil-arquivo.ts, src/features/funil/consulta.ts, src/server/atendimento/operacoes.ts, app/funil/acoes.ts, integração específica. Não editar page/quadro/modal/CSS.

**Interfaces:** ArquivoFunilRecente = { empresaId: string; negociacaoId: string; nome: string; arquivadaEm: string; versao: number }. listarSemInteresseFunil(usuarioId): Promise<ArquivoFunilRecente[]>; devolverFunilAcao(FormData com empresaId, negociacaoId, versao, chave): Promise<EstadoAcaoDevolver> com resultado discriminado de ResultadoAtendimento e aviso pós-sucesso opcional. Quadro não depende de ID novo retornado, atualiza por leitura.

- [ ] Red: duas origens, dois vendedores, >3 recentes, negociação encerrada, cliente e ciclo obsoleto, reenvio/concorrência.
- [ ] Green: registrar operação distinta reutilizando o lock/recibo. Identificar proveniência pelo arquivamento positivo do Funil do ciclo/versão atual. Preservar funções e políticas existentes. Verificação no banco antes de devolver.
- [ ] Migração, tipos, lint e integração focada.

### Task 2 — Layout, painéis e confirmações do Funil

**Ownership:** app/funil/{page,quadro,modal,funil.module.css}. Componentes necessários no Funil e painel comum/estilos de shell. Adaptar empresa-dialogo apenas para extrair conteúdo reutilizável, preservando os outros consumidores. Testes unitários/DOM associados ao Funil e painel. Não editar migração ou APIs da Task 1.

- [ ] Red: dois botões com destinos laterais, seleção acessível, ausência de modal de conteúdo, pop-up em arquivamento e guardas de saída.
- [ ] Green: painel direito altura inteira desktop, cards compactos iguais, nome, próximo passo e data, lateral em fluxo no celular. Negociação versão 1; modal somente para venda, descarte e Sem interesse. Conservar URL inicial, foco e guardas ao trocar de painel. Mostrar últimas três e recuperação do comando Devolver fora do recorte. Drag com alvo compacto, confirmação e animação de sucesso.
- [ ] Unitário/DOM e lint/typecheck. Ações concorrentes e replay de venda/arquivamento continuam protegidos.

### Task 3 — Jornadas e entrega

- [ ] Ajustar testes E2E existentes aos novos nomes/escopos, preservando asserções de negócio e de destino. Adicionar fluxos de teclado/toque, geometria, animação/redução, perda de resposta e Devolver.
- [ ] Revisão independente e CI de PR completos no commit final. Nenhum merge ou deploy.
