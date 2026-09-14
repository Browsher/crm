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

- [ ] RED nas leituras reais: base prévia com autoria/arquivoNULL exibida como Migração/Cadastros anteriores; deduplicar vínculos; outrogrupoativo preserva disponibilidade; gestorlista todos, vendedornegado. Carteiras conta vínculo com vendedor ativo. Disponíveis segue a elegibilidade real da Fila, inclusive a regra já existente para vendedor inativo, sem contar a empresa em duas categorias. Detalhe identifica responsável inativo quando houver, além dos outros grupos.
- [ ] Página tabela compacta com Grupo/Planilha,Situação,Empresas,Importado em,Ver grupo. Link Todas as empresas e Importar planilha. Faixa de resumo da prévia aprovada: total de grupos, ativos, desativados e empresas únicas vinculadas; os totais abrangem todos os grupos e não apenas a página atual, sem contar duas vezes uma empresa de vários grupos. Estado vazio recuperável com acesso à importação. Não acrescentar controles de mockup nem grupos fictícios.
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

## Registro de execução

### Banco concluído e revisado

Commits60f3096 e a1b0c6a. Migração0027 implementada; migrações anteriores preservadas. Testes focados de grupos e upgrade, regressões de fixtures, invariantes e convenções passaram no PostgreSQL local temporário. Após correção da revisão, 57 testes de integração e 88 de documentação passaram. Typecheck passou na etapa. Nenhuma migração aplicada na Railway nem no banco de desenvolvimento.

A revisão independente confirmou os contratos funcionais e pediu eliminar a duplicação de opções de filtros. Helper privado compartilhado introduzido sem GRANT à aplicação; re-revisão aprovou. Permanece pequena lacuna de teste carregada para tarefa4: verificar ausência de Base de testes antes da limpeza das fixtures de banco vazio.

Decisões de implementação: preservar INSERT legado em empresa sem promover registros sem grupo; comparar pedido canônico no replay, mas devolver relatório persistido, pois a reanálise posterior muda as contagens de novos/existentes; permitir no checador somente PK composta de colunas UUID que são FKs. Contagens administrativas seguirão elegibilidade real de dono inativo e os totais globais da prévia aprovada.

### Importação concluída e revisada

Commit82259f4. Nome e chave da operação no formulário, reanálise e hash no servidor, todas as linhas aceitas no contrato SQL e resultado persistido no retry. Conferência somente leitura e conclusão com acesso ao grupo. 57 unitários/DOM e21 integrações locais passaram; typecheck e lint focado passaram. Revisão independente aprovou sem achados.

### Administração concluída e revisada

Commit2358ab1. Lista e detalhe separados, totais globais sem duplicação, paginação50, controles de renomear/ativar/desativar e opções administrativas. A troca para empresa_filtros_administracao resolveu a regressão anterior sem vincular artificialmente suas fixtures. 30 testes de integração, conjunto unitário/actions/páginas28, DOM final3 e diretivas11 passaram; typecheck e lint focado passaram. Revisão independente aprovou, com ajuste pequeno de texto da página fora da faixa carregado para a tarefa4. Warning Vite preexistente no teste de diretivas fica registrado para manutenção.

### Jornada implementada, revisão em andamento

Commitc6561f4. 881 unitários passaram e um caso exclusivo de Linux foi pulado no Windows. 454 integrações passaram e o caso de versão esperada do PostgreSQL foi pulado por variável local ausente. Typecheck, lint, convenções e build E2E passaram. O lint local excluiu apenas diretórios não versionados de outra tarefa, .artifact-work/ e outputs/, sem alterar configuração do projeto.

As32 jornadas anteriores passaram em duas rodadas completas. Três jornadas novas passaram depois de corrigir seletores/esperas dos próprios testes. A inspeção visual encontrou quebra na badge Desativado em390px; teste de medição reproduziu o erro, CSS localizado corrigiu e os três testes de grupos passaram novamente após novo build. Capturas24 em390/820/1280, claro e escuro, cobrem lista, detalhe, confirmação e paginação vazia. O vazio absoluto será validado ao iniciar a demonstração isolada, antes de semear seus grupos.

As duas pequenas lacunas das revisões anteriores foram corrigidas com regressões: banco vazio é observado antes de qualquer limpeza e página além do fim explica que os grupos estão em outras páginas. Testes de importação medem ausência de escrita durante conferência e preservação dos cadastros existentes. Fixtures de cenários antigos receberam somente vínculos explícitos dos seus próprios IDs.

Observação não diagnosticada: mensagem de servidor destination stream closed early durante navegação, sem rota ou cancelamento identificável no log, mesmo com testes aprovados. Incluída na revisão independente; não foi suprimida. Warnings de Vite e lockfile externo permanecem registrados sem mudança fora do escopo.

Revisão da tarefa4 concluída: produto/testes aprovados; a espera sem prazo do script descartável de demonstração recebeu limite10s e cancelamento. Teste focado provocou destino de login impossível e comprovou timeout e remoção real do banco temporário; re-revisão aprovou. A execução permanente da demonstração ainda não começou.

Revisão final, demonstração e PR ainda pendentes neste registro. Nenhuma aplicação da migração em banco de desenvolvimento ou Railway até aqui. Cinco bancos E2E desta tarefa e os dois bancos da prova de timeout foram removidos; sobra teste_4d072e625239 anterior ao PR35 foi preservada.

### Revisão final e operação local concluídas

Revisão global da base66e0935 atéca9c877 concluída, sem achados críticos ou importantes. Mantidas as duas pendências diagnósticas de stream e warnings descritas acima. Aplicação local executada depois da revisão, com guardas de host loopback, banco crm/porta5432, ambiente explícito e recusa de qualquer pendência diferente da0027. Invariantes passaram; antes/depois preservaram66 empresas,31 contatos e4 usuários. A Base de testes ativa recebeu as66 empresas. Nenhuma aplicação na Railway.

Demonstração isolada iniciada em crm-grupos.localhost:3101, com seis grupos fictícios e outro banco temporário. Login e hostname foram comprovados no Chromium. As seis capturas de vazio absoluto nos dois temas/3larguras foram geradas antes da semente; amostras390escuro/1280claro e a lista dos seis grupos foram inspecionadas. O script tem encerramento com remoção do seu banco específico. A demonstração permanece disponível para validação do usuário; não equivale a aprovação visual já recebida. PR e CIexato são a próxima etapa; merge aguarda aprovação.
