# Empresas recentes: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** mostrar as dez últimas empresas abertas ou trabalhadas pelo usuário,
persistidas no banco, com sugestões disponíveis quando a lista estiver vazia.

**Architecture:** PostgreSQL guarda recência por usuário e empresa, limita a dez
e projeta somente o resumo já autorizado na consulta. Abrir perfil resumido não
reserva nem libera contatos. A interface compõe consulta e reserva existentes.

**Tech Stack:** PostgreSQL 18, Next.js, React, TypeScript, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-09-10-fila-interface-design.md, seção Recentes.

## Restrições

- Dez empresas por usuário, sem duplicação; nova interação sobe ao topo.
- Persistência entre computadores. Sem localStorage ou dados fictícios.
- Nome, nome fantasia, CNAE, cidade, UF, bairro e disponibilidade: mesma projeção
  de ResumoEmpresa. Nenhum telefone, email, contato ou histórico nessa projeção.
- Permissões atuais verificadas no banco. Abertura não altera reserva ou contato.
- Não importar uma feature em outra; composição na rota ou função interna SQL.
- TDD, branch e PR com CI verde; migração 0026, sem editar migrações aplicadas.
- Interface funcional nesta entrega; etapas e redesign na próxima fatia.

## Contratos fechados

SQL público:

```sql
SELECT * FROM empresa_perfil($1::uuid);
SELECT empresa_recente_registrar($1::uuid);
SELECT * FROM empresa_recentes();
SELECT * FROM empresa_sugestoes();
```

Perfil retorna zero ou uma linha; recentes e sugestões retornam até dez linhas
com as oito colunas de empresa_consultar. Registrar retorna boolean, false para
empresa inexistente. Identidade exclusivamente usuario_atual(). Leitura exige
pode_ler; registro exige pode_escrever. Falta de permissão gera 42501.

Tabela empresa_recente: id uuid PK, usuario_id, empresa_id, acessada_em;
UNIQUE(usuario_id, empresa_id), FKs,
RLS SELECT próprio e nenhuma escrita direta concedida. Função interna faz upsert
e remove excedentes sob o mesmo advisory por usuário da Fila (seed 25), usando
relógio após lock e ordem acessada_em DESC, empresa_id. FK de empresa pode obter
KEY SHARE implicitamente: lock separado causaria ciclo com contato/empresa.

Contato bem-sucedido atualiza recentes na mesma transação por trigger AFTER INSERT
de contato. Autor e empresa vêm da linha gravada. Falha/rollback não deixa recente.
Inicializar recentes pelos últimos contatos existentes de cada autor, máximo dez.
Não conceder funções internas a PUBLIC/app_usuario. Manter inventários atualizados.

TypeScript em src/features/prospeccao/recentes.ts:

```ts
type Falha = { ok: false; motivo: 'sem_permissao' }
type Lista = { ok: true; empresas: ResumoEmpresa[] } | Falha
listarRecentes(usuarioId: string): Promise<Lista>
listarSugestoes(usuarioId: string): Promise<Lista>
lerPerfil(usuarioId: string, empresaId: string): Promise<{ ok: true; empresa: ResumoEmpresa | null } | Falha>
registrarRecente(usuarioId: string, empresaId: string): Promise<{ ok: true; registrado: boolean } | Falha>
```

## Tarefa 1: banco e repositório

Arquivos: db/migracoes/0026_empresa_recentes.sql, docs/db/0026.md e ponteiros
0018/0024; src/features/prospeccao/recentes.ts; inventários invariantes/schema;
tests/integracao/empresas-recentes.test.ts.

- [x] Escrever testes isolados: primeiro recente, repetição sobe sem duplicar,
  onze empresas deixam dez, usuários distintos, disputa concorrente, contato e
  rollback, estado atual após reserva alheia, projeção sem campos privados,
  sugestões exclusivamente disponíveis, empresa inexistente e grants negados.
- [x] Observar RED antes da migração. Usar BancoDeTeste de ajuda.ts e padrões
  de prospeccao-consulta.test.ts; concorrência com conexões distintas.
- [x] Implementar contratos SQL e repositório acima, com funções pequenas.
  Compartilhar projeção SQL internamente se necessário, sem ampliar SELECT empresa.
- [x] Executar testes até GREEN; rodar db:checar e typecheck; revisar grants,
  locks e efeitos sobre contato. Documentar objetos alterados e backfill.

## Tarefa 2: perfil resumido e lista inicial

Arquivos: app/fila/localizar/page.tsx, resultados.tsx;
app/fila/localizar/[id]/page.tsx e registrar-visita.tsx; testes vizinhos.
Ler os vizinhos localizar/page.tsx, reservar.tsx, formulario.tsx, e guias Next
locais de page, use-client e Link antes de editar.

- [x] Testar link Ver perfil em cada resultado e indicação correta de recentes
  ou sugestões sem filtros; busca filtrada não se mistura aos recentes.
- [x] Sem filtros chamar listarRecentes; lista vazia chama listarSugestoes.
  Reusar Resultados e Reservar com contexto atual. Sem sugestões, estado vazio.
- [x] Criar perfil resumido /fila/localizar/[id], validar UUID e tratar ausente
  como 404. Renderizar o mesmo resumo com disponibilidade atual e ação existente
  de reservar quando elegível; preservar filtros no retorno e na reserva.
- [x] Registrar abertura por ação POST no mount do perfil, nunca no GET/render
  ou prefetch. Repetição é upsert, não duplica. Efeito também no atendimento ativo
  e ficha da carteira, após leitura autorizada. Validar UUID na ação e identidade
  por exigir. Erro de gravação deve ter aviso, sem ocultar o perfil.
- [x] Revalidar /fila/localizar após registro de visita e de contato para atualizar
  recentes ao voltar; perfil e resumo não copiam snapshots de contatos antigos.
- [x] Testar render e ações; nenhum form aninhado ou navegação que perca rascunho.

## Tarefa 3: jornadas e entrega

Arquivos: tests/e2e/recentes.spec.ts e fixtures em dados-recentes.ts se necessário;
scripts/e2e/run.mts integra apenas dados sintéticos no banco temporário.

- [x] Navegador: sem recentes mostra sugestões; abrir perfil não reserva nem mostra
  telefone; voltar mostra recente; nova sessão do mesmo usuário conserva lista;
  outro usuário não herda lista; contato aparece no topo; repetir não duplica.
- [x] Rodar suíte completa, typecheck, lint, db:checar, build e E2E, revisar conjunto.
- [ ] PR contra main, CI verde, merge no commit revisado; backup antes de aplicar
  0026 local e Railway; conferir invariantes e nenhuma pendência.

## Decisões de execução

Ruling: perfil resumido funcional entra nesta fatia para dar consumidor real ao
evento de abertura já aprovado. Não antecipar o redesign das três etapas.
Ruling: inicializar pelos contatos existentes atende o histórico já real do CRM;
sem backfill, os clientes trabalhados antes da entrega desapareceriam dos recentes.
Ruling: manter checkout normal em branch, conforme o fluxo existente do usuário.
Ruling: revisão identificou lock implícito de FK no upsert. Recentes usa advisory
25 compartilhado com reserva/contato, adquirido antes da FK, evitando inversão.
Ruling: PK UUID simples mais UNIQUE do par segue a catraca existente sem ampliá-la.
Contatos administrativos sem criado_por são ignorados pelo trigger e backfill.
Backfill agrupa usuário/empresa antes de selecionar as dez últimas empresas.

## Validação local concluída

105 arquivos de teste passaram: 1033 testes verdes e 1 ignorado. Onze jornadas
Playwright passaram com build fresco. Typecheck, lint e db:checar passaram.
Revisão independente aprovou SQL, interface, concorrência e backfill sem bloqueadores.
Backup criptografado dos bancos local e Railway criado antes da integração.
