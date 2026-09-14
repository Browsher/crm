# Grupos de importação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development task-by-task. TDD e revisão independente em cada tarefa. Sem subagentes pelos implementadores.

**Goal:** administrar grupos em tela separada, importar vínculos sem duplicar empresas e bloquear novas prospecções sem interromper carteiras.

**Architecture:** PostgreSQL controla origem ativa e concorrência. A feature empresas concentra importação e administração de grupos; a Fila consome suas funções SQL existentes com as novas guardas. Todas as escritas da confirmação são atômicas e idempotentes.

**Tech Stack:** PostgreSQL18, Next.js16.3.4, React19, TypeScript, Vitest, Playwright, componentes existentes. Sem bibliotecas novas.

**Spec:** docs/superpowers/specs/2026-09-14-grupos-importacao-design.md

## Global Constraints

- Branch codex/grupos-importacao a partir de main66e0935. Sem merge automático ou migração Railway. Preservar PREFERENCIAS.md, AGENTS.md e CONTINUIDADE-CODEX.md locais.
- Manter /empresas com tabela e filtros atuais; nova tela /empresas/grupos e detalhe /empresas/grupos/[id]. Tabela compacta, sem alternativa cards no produto.
- Base de testes ativa para empresas preexistentes, sem alterar contatos/posse/reserva. Não semear os seis exemplos no banco real e não excluir dados.
- Migrações anteriores imutáveis; primeira nova migração0027_grupos_importacao.sql. Conferir numeração antes de escrever.
- Banco é autoridade. Não importar outra features/ de features/. Guardas de gestor e pode_escrever no servidor e SQL. Testes reais apenas em bancos temporários locais.
- Reserva30min e descanso30dias preservados. Apenas origem ativa não basta para uma empresa estar disponível.

### Task 1: Banco, transição e elegibilidade

**Files:** criar db/migracoes/0027_grupos_importacao.sql, docs/db/0027.md, tests/integracao/grupos-importacao.test.ts e testes de concorrência nesse arquivo ou arquivo irmão. Alterar src/server/db/migracoes/invariantes.ts e testes afetados; atualizar ponteiros em docs/db/0014.md,0024.md,0025.md,0026.md e fundacao.md. Fixtures de integração de fila/consulta/recentes podem ganhar vínculos explícitos; nunca afrouxar a regra de produção para fixtures antigas.

**Interfaces produzidas:**

```sql
-- Tabelas, nomes de colunas usados pelas tarefas seguintes:
-- grupo_importacao(id uuid PK, nome text, arquivo_nome text NULL,
-- ativo boolean, chave uuid UNIQUE NULL, assinatura text NULL,
-- relatorio jsonb, criado_em timestamptz, criado_por uuid NULL,
-- atualizado_em timestamptz NULL, atualizado_por uuid NULL)
-- grupo_importacao_empresa(grupo_id uuid, empresa_id uuid, PK(grupo_id,empresa_id))
-- FK RESTRICT, RLS SELECT só gestor; escrita somente funções controladas.
grupo_importacao_confirmar(p_chave uuid,p_nome text,p_arquivo text,
  p_assinatura text,p_linhas jsonb,p_relatorio jsonb)
  RETURNS TABLE(grupo_id uuid,inseridas integer,vinculadas integer,relatorio jsonb);
grupo_importacao_situacao_definir(p_grupo uuid,p_ativo boolean) RETURNS text;
grupo_importacao_renomear(p_grupo uuid,p_nome text) RETURNS text;
empresa_filtros_administracao(p_uf text,p_cidade text)
  RETURNS TABLE(tipo text,valor text,rotulo text);
-- Helpers internos, sem GRANT à aplicação: empresa_origem_ativa(uuid),
-- empresa_visivel_prospeccao(uuid). Existência justificada nos consumidores.
```

Linhas JSON usam as colunas reais: cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal. Devolver quantidade de inseridas e total de vínculos. Validar1..5000linhas, CNPJ distinto, nome1..100 e arquivo1..255 sem controles; assinaturaSHA256hex64. Permitir nomes de grupos iguais, identidade por UUID. `chave` de confirmação pertence ao gestor: repetição com mesmo gestor/assinatura/nome/arquivo devolve resultado persistido, divergência retorna erro22023 e outro gestor não recupera grupo. Nunca sobrescrever campos da empresa existente.

- [ ] RED com PostgreSQL real antes da migração: grupo ausente; duas planilhas compartilham CNPJ; vendedor negado; confirmação repetida cria uma única vez; chave reaproveitada com outro conteúdo negada; payload inválido desfaz tudo.

```ts
const r = await banco.comoUsuario(gestor, e => e(
  'SELECT * FROM grupo_importacao_confirmar($1,$2,$3,$4,$5,$6)',
  [chave, 'Mooca', 'mooca.xlsx', assinatura, JSON.stringify(linhas), JSON.stringify(relatorio)],
))
expect(r.linhas[0]).toMatchObject({ inseridas: 1, vinculadas: 2 })
```

- [ ] Implementar schema/funções. Criar Base de testes apenas se houver empresas na migração; origem arquivoNULL e criado_porNULL, ativo=true. Backfill só empresas existentes, sem trigger que vincule importações futuras à base.
- [ ] Atualizar por CREATE OR REPLACE os consumidores atuais: fila_reservar, empresa_consultar, empresa_resumos, empresa_sugestoes, empresa_filtros. Recentes/perfil passam por resumos. Leitura administrativa usa função separada sem filtrar grupos desativados. Conservar assinaturas existentes e privilégios revogados.
- [ ] Serializar mudança de origem com reserva: lock advisory global compartilhado na reserva e exclusivo em confirmação/situação, antes de locks de usuário/empresa/grupo, mantendo uma ordem única. Revalidar estado após adquirir locks. Reserva válida própria pode terminar após desativação; nova reserva não.
- [ ] Testar duas conexões reais com espera baseada em pg_locks, não sleep: primeiro reserva e depois desativação preserva reserva; primeiro desativação e depois reserva rejeita; dois grupos com um ativo; descanso e carteira preservados; UUID direto, filtros/sugestões/perfil/recentes não furam bloqueio.
- [ ] Testar upgrade: aplicar até0026 em banco temporário, inserir empresa/contato/posse, aplicar0027 e comparar IDs/histórico. Atualizar fixtures existentes explicitamente com grupo ativo quando o cenário exige elegibilidade. Invariantes, db:checar, integração focada e typecheck.

### Task 2: Importação real com nome de grupo e confirmação idempotente

**Files:** src/features/empresas/servico.ts, repositorio.ts, mensagens.ts e testes; app/empresas/importar/acao.ts, formulario.tsx, relatorio.tsx e respectivos testes DOM/action/static; novo src/features/empresas/grupo-entrada.ts e teste se separar parser. Não alterar rotas de administração desta tarefa.

**Interfaces:** consumir SQL confirmar da tarefa1. Acrescentar dados obrigatórios da operação ao contrato de importar; manter analisar somente leitura. Interface compartilhada:

```ts
type OperacaoGrupo = { chave: string; nome: string; arquivoNome: string; assinatura: string }
// gravar recebe todas as linhas aceitas, não só as novas
// ResultadoImportar ok adiciona grupoId:string e vinculadas:number.
// EstadoImportar adiciona grupoId:string|null; atualizar todos os consumidores.
```

- [ ] RED: só CNPJs existentes ainda confirma grupo; repo recebe todas aceitas; dupla confirmação retorna mesmo grupo; sem aceitas não confirma. Escrever testes com fake de repositório que diferencie novas e existentes e ação com gestor ausente antes de ler arquivo.
- [ ] A action valida nome e UUID, calcula SHA256 do arquivo original no servidor com node:crypto e envia com nome/arquivo para SQL. Não aceitar hash enviado pelo navegador. Preservar limites/leitorExcel/CSV e reanálise da confirmação. Mapear22023 para mensagem recuperável; falha de infraestrutura continua exceção.
- [ ] Formulário: Input nome do grupo no Enviar; gerar UUID de operação no cliente, conservar durante retry e trocar ao iniciar outro arquivo/operação. Alterar nome/arquivo invalida conferência e operação anterior; manter File ao voltar. Evitar gerar UUID diferente a cada render. Conferir/confirmar guardados pelo mesmo nome e arquivo.
- [ ] Conferir mostra grupo, novas empresas e existentes que serão vinculadas. Botão Confirmar importação aparece se totalaceitas>0. Concluir mostra inseridas e totalnoGrupo com links Ver grupo e Ver empresas. Testar erro/foco, voltar, troca de arquivo e nome, reiniciar, somente existentes.
- [ ] Rodar testes focados de serviço/repositório/action/DOM e integração de importação; atualizar fixtures/asserts legados com novos campos sem enfraquecer intenção original. Typecheck/lint. Revisão independente.

### Task 3: Administração de grupos e detalhe

**Files:** criar src/features/empresas/grupos.ts e grupos.test.ts; app/empresas/grupos/page.tsx, grupos.module.css, [id]/page.tsx, acoes.ts, controles.tsx e testes. Modificar app/empresas/page.tsx apenas para link Grupos de importação e listagem.ts para empresa_filtros_administracao. Reusar Input/Button/AlertDialog ou Dialog disponíveis, lendo os componentes existentes antes de compor.

**Interfaces:** SELECT de grupo_importacao e grupo_importacao_empresa via comoUsuario sob RLS. Mutação chama SQLsituacao/renomear. Leituras retornam discriminante ok e DTO com id,nome,arquivoNome,ativo,criadoEm,autor,total; detalhe acrescenta empresas e contagens. ID inválido ou inexistente vira notFound, nunca query sem filtro. Paginar grupos e empresas do detalhe em50 itens com links preservados.

```ts
type ResumoGrupo = { id:string; nome:string; arquivoNome:string|null; ativo:boolean;
  criadoEm:string; autor:string|null; total:number }
type ContagensGrupo = { total:number; disponiveis:number; carteiras:number;
  reservadas:number; outros:number }
// total = disponiveis + carteiras + reservadas + outros
```

- [ ] RED nas leituras reais: base prévia com autoria/arquivoNULL exibida como Migração/Cadastros anteriores; deduplicar vínculos; outrogrupoativo preserva disponibilidade; gestorlista todos, vendedornegado. Contagem de carteiras reflete vínculo atual (inclusive vendedor desativado), disponíveis exclui toda posse para não somar duas vezes; detalhe identifica responsável e outrosgrupos.
- [ ] Página tabela compacta com Grupo/Planilha,Situação,Empresas,Importado em,Ver grupo. Link Todas as empresas e Importar planilha. Estado vazio recuperável com acesso à importação. Não acrescentar controles de mockup nem grupos fictícios.
- [ ] Detalhe com breadcrumb, nome/origem/data/autor, contagens e tabela de membros. Situacao de atendimento identifica posse,reserva,descanso,origem bloqueada. Mostrar outrosgrupos sem duplicar linhas. Ação Renomear simples e Desativar/Reativar com confirmação.
- [ ] Prévia de desativação conta empresas atualmente livres/elegíveis sem outrogrupoativo, comunica preservação de carteiras/reservas. Mostrar que a quantidade é retrato atual. Action sempre revalida guarda gestor e SQL, invalida /empresas/grupos, detalhe, /fila,/fila/localizar; não confiar no número do cliente. Focus trap, Escape,cancelar,pendente/erro/foco preservados.
- [ ] Unitários/DOM/actions/integração, typecheck/lint e revisão. Manter /empresas e todos seus filtros no layout original.

### Task 4: Jornada, dados de demonstração isolados e entrega

**Files:** tests/e2e/grupos-importacao.spec.ts e dados-grupos.ts; fixtures de E2E existentes que precisam de origem ativa; tests/inventario-unitario.txt; documentação de execução neste plano e continuidade local.

- [ ] Fixtures somente em banco temporário do harness. Criar seis grupos da prévia e empresas fictícias com overlap,carteira,reserva,descanso. Vínculos explícitos em fixtures antigas; não criar gatilho de produção para acomodar testes.
- [ ] E2E: gestorimporta XLSX/cria grupo, reimporta sóexistentes sem sobrescrever, abregrupo, renomeia, cancela/confirma desativação, carteira continua, outraorigemativa funciona, reativa; vendedorrecusado nas rotas. /empresas mostra todas independentementedegrupo. Medir ausência de escrita em conferência.
- [ ] Screenshots390/820/1280 claro/escuro, tabela de grupos e detalhe, dialog e vazio. Inspecionar visualmente. Sem mudar layout da Carteira/Meu dia.
- [ ] Rodar inventário/unitários, integração, typecheck,lint,db:checar,build:e2e,E2E serializando suítes pesadas no Windows. Revisão final independente; corrigir achados com regressões não vacuosas.
- [ ] Commit branch, abrir PRcontra main comCI noSHAexato. Semmerge automático. Não aplicarRailway. Registrar que migração énecessária para servidorlocal; só aplicar no banco de desenvolvimento local após confirmarhost e guardas, preservando dados. Fornecer entrega e instrução de validação.
