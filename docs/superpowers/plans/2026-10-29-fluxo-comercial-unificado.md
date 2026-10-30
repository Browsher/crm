# Fluxo comercial unificado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar distribuição e atendimento pessoal sem prazos, apresentação de empresas e arquivamento Sem interesse, preservando histórico, vendas e permissões.

**Architecture:** Acrescentar um vínculo pessoal exclusivo separado da responsabilidade comercial e das negociações. Os comandos transacionais do banco autorizam o atendimento, mantêm uma referência para a agenda vigente e arquivam sem inventar contatos; consultas e componentes comuns apresentam o mesmo cadastro em todas as telas. Uma única evolução integrada, com tarefas sequenciais revisáveis, evita publicar interface e banco com contratos incompatíveis.

**Tech Stack:** Node 24, npm, Next.js 16.4.1, React 19.2.8, TypeScript, PostgreSQL 18, pg, Vitest, Playwright, componentes e tokens existentes. Arraste HTML e animação CSS, sem biblioteca nova.

**Spec:** `docs/superpowers/specs/2026-10-29-fluxo-comercial-unificado-design.md`, aprovado pelo usuário em 29/10/2026.

**Status:** plano e execução aprovados pelo usuário em 29/10/2026, mantendo Superpowers e agentes separados por implementação/revisão. Spec Kit foi apenas avaliado e não foi instalado.

## Global Constraints

- Atendimento direto, sem reserva ou expiração de 30 minutos.
- Retirar devolução e bloqueio automáticos de 30 dias, mantendo histórico e vínculo.
- Funil após interesse ou retorno combinado; Carteira após a primeira venda.
- Não atendeu pode ter tentativa agendada sem negociação; Sem interesse encerra negociação e cancela retornos.
- Sem interesse é um único card de descarte com animação de lixeira, não uma coluna do Funil.
- Retomar não restaura agenda cancelada nem negociação automaticamente.
- Preservar empresas, contatos, autoria, vendas, buscas, grupos internos e rascunhos; não redistribuir ambiguidades automaticamente.
- Autoridade de acesso e dos efeitos comerciais no banco; sem acesso global do vendedor ou ampliação de comandos do gestor.
- `features/` não importa outra `features/`; contratos comuns em `lib/` ou `server/`.
- Textos da interface em português, sem travessões; reutilizar os tokens e componentes do design system existente.
- Uma entrega exclusiva considerando Google e Banco; não repetir aquisição paga para corrigir uma falha local.
- Branch `codex/`, PR contra main, nenhuma alteração em migração antiga, merge apenas com CI verde. Publicação continua manual e fora desta execução.
- Cada tarefa segue teste significativo falhando, implementação mínima, teste passando, revisão independente e commit. Não enfraquecer guardas, expectativas ou timeouts para obter verde.
- Antes dos comandos locais, isolar `.env.local` sem imprimir valores e usar apenas o banco descartável local do harness. Restaurar o arquivo no encerramento. Não aplicar migração em produção nesta execução.
- Para APIs de biblioteca durante a implementação, consultar Context7 conforme AGENTS.md; para Next, ler também os guias locais indicados em CLAUDE.md. Indisponibilidade da documentação não autoriza inventar API ou dependência.

## Review Focus

1. Duas entregas simultâneas, ou de fontes diferentes, da mesma identidade: exatamente um vendedor recebe; sem empresa extra, troca de responsável ou segunda chamada paga. Testes: tarefa 2.
2. Comando repetido ou resposta perdida seguido de uma aba desatualizada: um único efeito e conflito explícito, sem apagar rascunho ou arquivar negociação/venda posterior. Testes: tarefas 3 e 5.
3. Arquivar e retomar após a data de um contato antigo: nenhuma tarefa cancelada reaparece, nem contato/negociação fictícios. Testes: tarefas 3 e 7.
4. Empresa na última etapa, teclado, toque, movimento reduzido e falha de rede no descarte: mesma operação autorizada e retorno compreensível, sem coluna nova ou falso sucesso. Testes: tarefa 6.
5. Histórico ambíguo, usuário inativo, empresa sem CNPJ ou contato compartilhado: preservar identidade e dados, não escolher responsável por nome parecido nem abrir o catálogo inteiro. Testes: tarefas 1, 2, 4 e 9.

---

## Execução e limites das etapas

Método preservado: um agente implementador por tarefa e outro agente para revisar essa tarefa, com revisão final de toda a branch. Executar em sequência porque banco, consultas e telas compartilham os contratos abaixo. O revisor não edita arquivos; o implementador corrige os achados antes de avançar. Todos recebem a spec, este plano e o diff da tarefa anterior, com propriedade explícita dos arquivos; ninguém reverte trabalho de outro agente.

Usar o worktree gerenciado desta conversa se continuar adequado, conferindo anexos e estado pela skill de worktrees antes de executar. A branch atual contém somente documentação; preservar esses commits. Conferir a main remota antes da implementação e resolver diferenças por conteúdo, sem resetar o checkout principal ou perder o plano.

Entregar uma PR final contra main. Commits intermediários são unidades de revisão, não publicações individuais: as migrações e o código que as consome precisam entrar juntos. Não criar PRs empilhadas.

### Preparação operacional, incorporada à tarefa 1

- [ ] Ler CLAUDE.md, PREFERENCIAS.md, REGRAS.md e a spec aprovada; conferir branch, arquivos alterados e worktree. Preservar alterações externas.
- [ ] Separar o ambiente privado sem ler ou registrar segredos. Confirmar o host local pelas guardas existentes; não usar `db:aplicar` com ambiente de produção.
- [ ] Conferir que a última migração continua `0049_banco_inclusao_automatica.sql`. Os números 0050–0058 abaixo estão reservados neste plano; a 0054 acrescenta a leitura em lote das fontes (tarefa 5), a 0055 centraliza disponibilidade (tarefa 7), a 0056 compartilha o resumo gerencial em lote (tarefa 8), a aposentadoria passa à 0057 e a revisão final acrescenta a 0058 somente para pertença ao arquivo e projeção delimitada dos resumos. Se a main avançar, renumerar apenas os arquivos novos antes de publicar, sem alterar migrações existentes.

## Contratos comuns decididos pelo plano

### Persistência e concorrência

`empresa_vinculo` terá `empresa_id` como PK/FK, `vendedor_id`, `origem_inicial` (`google`, `banco`, `legado`), `recebida_em`, `iniciada_em`, `arquivada_em`, `agenda_contato_id` nullable/FK para `contato` e `versao integer` positiva. A referência de agenda aponta para um contato real da mesma empresa com próximo passo/data; impor a coerência também no banco, por FK composta ou guarda equivalente. Texto e data continuam no contato, sem cópia divergente. Arquivar limpa essa referência; retomar não a restaura.

`empresa_fila.vendedor_id` permanece como responsabilidade comercial compatível com negociação/cliente; não preencher para toda empresa entregue. A leitura pessoal e o registro inicial são autorizados pelo novo vínculo. O cliente continua sendo responsabilidade comercial atual mais venda existente.

`empresa_atendimento_operacao` guarda chave UUID única, usuário, empresa, operação, entrada normalizada e resultado para repetição idempotente. Mesma chave e mesma entrada retornam o resultado de negócio anterior, com `repetida:true`; chave reaproveitada com outros dados é recusada. Conferir o replay antes da versão. Um replay atualiza a consulta, sem repetir a animação ou reaplicar arquivamento após uma retomada posterior. Escritas de contato, arquivamento e retomada bloqueiam a mesma empresa e validam vínculo/versão novamente após a trava. Unificar a ordem de travas com os contratos de entrega e venda existentes, com teste concorrente.

Ambiguidades do legado ficam em `empresa_vinculo_pendencia`, por empresa, com motivo e referências de origem, sem atribuição arbitrária. O gestor recebe relatório paginado; o vendedor recebe indisponibilidade explícita quando pertinente. Não criar nesta evolução um comando novo de transferência de responsável.

### Tipos e comandos

Criar `src/lib/atendimento.ts` com os tipos compartilhados:

```ts
type MotivoAtendimento = 'sem_permissao' | 'nao_encontrada' | 'desatualizada'
  | 'arquivada' | 'dados_invalidos' | 'chave_reutilizada'
type ResultadoAtendimento = { ok: true; versao: number; repetida: boolean }
  | { ok: false; motivo: MotivoAtendimento }
type ComandoEmpresa = { empresaId: string; chave: string; versao: number }
type EntradaContato = { tipo: TipoContato; nota: string | null;
  proximoPasso: string | null; proximoPassoData: string | null }
```

`TipoContato` mantém os seis valores existentes em `src/features/contato/tipos.ts`, movidos/reexportados da camada comum. `desfecho` não é mais uma escolha enviada pela tela para devolver/assumir; o banco deriva os efeitos do resultado e do estado autorizado. Não liguei não registra conversa nem abre negociação e não devolve automaticamente; arquivar continua sendo uma ação explícita.

Produzir em `src/server/atendimento/operacoes.ts`:

- `iniciarAtendimento(usuarioId: string, comando: ComandoEmpresa): Promise<ResultadoAtendimento>`.
- `registrarContatoDireto(usuarioId: string, comando: ComandoEmpresa, entrada: EntradaContato): Promise<ResultadoAtendimento>`.
- `arquivarSemInteresse(usuarioId: string, comando: ComandoEmpresa, negociacaoId: string | null): Promise<ResultadoAtendimento>`.
- `retomarAtendimento(usuarioId: string, comando: ComandoEmpresa): Promise<ResultadoAtendimento>`.

Cada função chama uma RPC própria (`atendimento_iniciar`, `contato_registrar_direto`, `empresa_sem_interesse_definir`, `empresa_atendimento_retomar`) com os mesmos dados. O contexto é sempre o usuário autenticado, nunca um vendedor recebido da tela. RPCs devolvem JSON com `ResultadoAtendimento`; recusa de acesso não revela dados de outro vendedor.

Criar `src/lib/empresa-visual.ts`: `SituacaoEmpresa` com `a_contatar`, `atendimento`, as três etapas existentes, `cliente`, `sem_interesse`, `indisponivel`; `ReferenciaEmpresa` discriminada entre `{ tipo: 'cadastro'; empresaId: string }` e `{ tipo: 'busca'; buscaId: string; cnpj: string }`. Não adicionar `sem_interesse` a `ETAPAS_FUNIL`.

`ResumoEmpresa` contém `referencia:ReferenciaEmpresa`, `id:string|null` para snapshot não incluído, `nome:string`, `cnpj`/`cnae`/`atividade`/`bairro`/`cidade`/`uf` como `string|null`, `origens:('google'|'banco'|'legado')[]`, `recebidaEm:string|null`, `situacao:SituacaoEmpresa`, `versao:number|null`, `negociacaoId:string|null`. `ResumoEmpresaGestor` acrescenta `responsavel:{id:string;nome:string;ativo:boolean}|null`. `DetalhesEmpresa` acrescenta telefone/email e endereço nullable, porte, situação cadastral, data de abertura e dados cadastrais disponíveis; ausência explícita, sem aquisição do fornecedor.

`AcaoEmpresa` é a união `{tipo:'iniciar'|'retomar';rotulo:string;empresaId:string;versao:number}` ou `{tipo:'continuar'|'funil'|'carteira';rotulo:string;href:string}`. O identificador da negociação determina o link do Funil; a referência sem ID/versão não recebe comando de escrita.

`acaoEmpresa(resumo: ResumoEmpresa): AcaoEmpresa | null` centraliza as cinco ações: iniciar, continuar, abrir Funil, abrir Carteira, retomar. Referência sem cadastro incluído ou indisponível não ganha ação de atendimento. `CardEmpresa` renderiza os rótulos dessa função, sem rótulo independente por página.

## Task 1: Vínculo permanente, inventário e transição conservadora

**Files:**
- Create: `db/migracoes/0050_empresa_vinculo.sql`, `docs/db/0050.md`.
- Create: `src/server/atendimento/transicao.ts`, `src/server/atendimento/transicao.test.ts`, `scripts/atendimento/inventariar.mts`.
- Create: `tests/integracao/atendimento-vinculo.test.ts`, `tests/integracao/atendimento-transicao.test.ts`, `tests/integracao/atendimento-fixtures.ts`.
- Modify: `src/server/db/migracoes/invariantes.ts`, `src/server/db/migracoes/invariantes.test.ts`, `tests/integracao/schema.test.ts`. Reutilizar `tests/integracao/ajuda.ts` sem mudar suas guardas locais.

**Interfaces:**
- Consumes: `BancoDeTeste`, `criarBancoDeTeste`, `criarUsuario` de `tests/integracao/ajuda.ts`; padrões de RLS/auditoria em 0016/0017 e catálogo fechado em `invariantes.ts`.
- Produces: três tabelas no total (`empresa_vinculo`, `empresa_vinculo_pendencia`, `empresa_atendimento_operacao`); `classificarVinculoLegado(evidencias: EvidenciasVinculo): DecisaoVinculo`, união `{ tipo:'vincular'; vendedorId:string } | { tipo:'pendente'; motivo:string }`. `EvidenciasVinculo` tem `responsavel:string|null`, `google:string|null`, `candidatos:string[]` das entregas/reserva recuperáveis e `ativos:string[]`.
- Produces: `inventariarTransicao(gestorId: string, depois: string | null, limite: number): Promise<{ok:true;dados:RelatorioTransicao}|{ok:false;motivo:'sem_permissao'|'filtros_invalidos'}>`. `RelatorioTransicao` tem `totais:{empresas:number;vinculosInequivocos:number;pendencias:number}`, `pendencias:{empresaId:string;motivo:string;candidatos:string[]}[]` e `proximo:string|null`, no máximo 100 pendências por página, somente leitura.
- Produces: fixtures `vincularEmpresaTeste(banco:BancoDeTeste,empresaId:string,vendedorId:string,origem:'google'|'banco'|'legado'):Promise<number>` e `cenarioAtendimento(banco: BancoDeTeste): Promise<{ vendedorId:string; outroId:string; gestorId:string; empresaId:string; versao:number }>`. São preparação administrativa exclusiva do banco de teste; não criar caminho de escrita equivalente no aplicativo.

- [ ] **Step 1: Escrever testes falhando de classificação, preservação e acesso.** Asserções centrais, além de preparar cenários pelo harness real:

```ts
expect(classificarVinculoLegado({ responsavel: 'A', google: 'B', candidatos: ['A','B'], ativos: ['A','B'] }))
  .toMatchObject({ tipo: 'pendente' })
expect(classificarVinculoLegado({ responsavel: 'A', google: null, candidatos: ['B'], ativos: ['A','B'] }))
  .toEqual({ tipo: 'vincular', vendedorId: 'A' })
// Na integração: vendedor alheio não lê vínculo/contato; gestor lê inventário,
// não escreve por ele; cliente e venda existentes têm os mesmos IDs e autores.
```

- [ ] **Step 2: Rodar os testes alvo.** `npm run test:unit -- src/server/atendimento/transicao.test.ts` e `npm run test:integracao -- tests/integracao/atendimento-vinculo.test.ts tests/integracao/atendimento-transicao.test.ts`. Esperado: falha pelas estruturas/regras novas ausentes, não por conexão.
- [ ] **Step 3: Implementar a migração e o inventário.** Migração somente aditiva e transacional; RLS e escrita restrita a funções. Inferir vínculo apenas quando inequívoco; responsável preservado, contradição com exclusividade Google vira pendência, usuário inativo não libera redistribuição. Usar o último contato vigente para a referência de agenda, sem recuperar data anterior a um contato posterior sem tarefa. Não converter todo descanso em Sem interesse. CLI: `npx tsx scripts/atendimento/inventariar.mts --gestor <uuid> --limite 100`, com `--depois <uuid>` opcional; UUID e limite 1–100 validados, host local exigido, identidade real de gestor e transação read only. Imprime JSON de agregados/IDs de pendência e nunca credenciais, contatos ou SQL de escrita; recusa devolve saída não zero.
- [ ] **Step 4: Validar.** Repetir os testes alvo e `npm run db:checar`; esperado: PASS, nenhuma mudança no hash das migrações 0000–0049, nenhuma venda/contato perdido. O relatório não muda linha alguma. Não executar o CLI em produção neste estágio.
- [ ] **Step 5: Revisar e commitar.** Revisor independente confere critérios de escolha, pendências, RLS e auditoria; corrigir antes do commit `feat: add permanent company assignment and transition inventory`.

## Task 2: Entrega exclusiva entre Google e Banco

**Files:**
- Create: `db/migracoes/0051_entrega_exclusiva.sql`, `docs/db/0051.md`, `tests/integracao/entrega-exclusiva.test.ts`.
- Modify: `tests/integracao/banco-inclusao-automatica.test.ts`, `tests/integracao/google-entrega-direta.test.ts`, `tests/integracao/google-criterios-rodadas.test.ts`, `src/features/busca-empresas/repositorio.ts` somente se o retorno precisar expor contagens, e os respectivos testes.
- Reference: funções de entrega da 0042 e inclusão da 0049; não editar esses arquivos.

**Interfaces:**
- Consumes: vínculo e pendências da tarefa 1; assinaturas existentes de `google_agente_entregar(...)` e `busca_empresa_importar(uuid,text[])` preservadas para seus chamadores.
- Produces: helper interno `empresa_vincular_entrega(p_empresa uuid,p_vendedor uuid,p_origem text) RETURNS text`, com `ok`, `repetida`, `indisponivel`; sem GRANT ao aplicativo. As funções públicas validam seu ator e chamam o helper na mesma transação da entrega.

- [ ] **Step 1: Escrever testes concorrentes falhando.** Dois vendedores e duas fontes disputam o mesmo CNPJ/empresa; só um vínculo e uma entrega. Mesma identidade sem CNPJ pelo identificador Google continua única. Preservar o bloqueio de contatos repetidos sem fundir empresas apenas por nome. Asserções:

```ts
expect(vinculosDaEmpresa).toHaveLength(1)
expect(entregasConfirmadasComoNovas).toHaveLength(1)
expect(vinculosDaEmpresa[0].vendedor_id).toBe(vencedorDaEntrega)
expect(chamadasAoFornecedor).toBe(1) // replay da inclusão usa a resposta persistida
```

- [ ] **Step 2: Rodar.** `npm run test:integracao -- tests/integracao/entrega-exclusiva.test.ts tests/integracao/banco-inclusao-automatica.test.ts tests/integracao/google-entrega-direta.test.ts`. Esperado: falha por entrega duplicada/ausência do contrato, com infraestrutura local válida.
- [ ] **Step 3: Substituir as funções por migração nova.** Conferir exclusividade sob a mesma ordem de travas e unicidade, antes de confirmar a entrega. Manter recibos de origem, grupos internos, snapshots, deduplicação atual, exclusividade Google, pausa e recuperação idempotente. Não contar repetição como nova entrega nem iniciar negociação/responsabilidade comercial. Resposta paga preservada, nenhuma nova consulta automática para completar quantidade.
- [ ] **Step 4: Repetir testes e `npm run db:checar`.** Esperado: PASS nas duas ordens Google→Banco/Banco→Google, replay, concorrência e cliente já existente, sem redefinir responsável.
- [ ] **Step 5: Revisar e commitar.** Revisor confere ordem de travas contra venda e inclusão atuais; commit `feat: enforce exclusive company delivery across sources`.

## Task 3: Atendimento, arquivamento e retomada atômicos

**Files:**
- Create: `db/migracoes/0052_atendimento_direto.sql`, `docs/db/0052.md`, `src/lib/atendimento.ts`, `src/server/atendimento/operacoes.ts`, `src/server/atendimento/operacoes.test.ts`.
- Create: `tests/integracao/atendimento-direto.test.ts`, `tests/integracao/sem-interesse.test.ts`.
- Modify: `src/features/contato/tipos.ts`, `src/features/contato/regras.ts`, `src/features/contato/regras.test.ts`, `src/features/contato/um-chamador.test.ts`, `src/server/db/migracoes/invariantes.ts` e seus testes. Preservar os exports/adaptadores antigos até a troca dos consumidores na tarefa 5; revogação final na tarefa 9.
- Reference: `src/features/contato/acao.ts` como padrão de validação/guarda; comandos de contato da 0031, Funil da 0029 e venda da 0028.

**Interfaces:**
- Consumes: `empresa_vinculo`, `empresa_atendimento_operacao`, contratos de `ComandoEmpresa`/`EntradaContato` decididos acima e unicidade de negociação aberta.
- Produces: as quatro funções de `src/server/atendimento/operacoes.ts` e RPCs correspondentes; `validarContatoDireto(entrada: { tipo:string; nota:string; proximoPasso:string; proximoPassoData:string }, fase:'inicial'|'negociacao'|'cliente')`, resultado `{ok:true;valor:EntradaContato}|{ok:false;falta:string}`.
- Produces: arquivamento interno compartilhado pelo contato real Sem interesse e pelo comando manual, sem conceder o helper interno a `app_usuario`.

- [ ] **Step 1: Escrever testes falhando do contrato.** Não atendeu com/sem par de próximo passo; retorno combinado exige texto/data; Sem interesse recusa nova agenda na mesma entrada e cancela a atual. Assumir só no interesse/retorno. Arquivamento manual não insere contato; contato real Sem interesse insere exatamente um. Replay com mesma chave não duplica; mesma chave com outros dados recusa; versão antiga recusa sem modificar nada. Testes devem verificar:

```ts
expect(resultado).toMatchObject({ ok: true })
expect(negociacoesAposNaoAtendeu).toHaveLength(0)
expect(contatosAposDoisReplays).toHaveLength(1)
expect(agendaDepoisDeArquivarERetomar).toBeNull()
expect(contatosDepoisDoArraste).toEqual(contatosAntesDoArraste)
expect(vendasDepoisDoArquivamento).toEqual(vendasAntesDoArquivamento)
```

- [ ] **Step 2: Rodar testes alvo.** `npm run test:unit -- src/features/contato/regras.test.ts src/server/atendimento/operacoes.test.ts`; `npm run test:integracao -- tests/integracao/atendimento-direto.test.ts tests/integracao/sem-interesse.test.ts`. Esperado: falhas nos novos comportamentos, não em setup.
- [ ] **Step 3: Implementar RPCs, validador e adaptadores.** RLS de empresa/contato/dados cadastrais permite vínculo próprio após qualquer prazo; gestor continua com leitura e sem novos comandos de vendedor. Iniciar só marca início. Contato real atualiza a referência de agenda na mesma transação; Sem interesse arquiva, limpa agenda e encerra negociação com motivo próprio, sem devolver/vencer vínculo. Retomar limpa apenas o estado de arquivo, sem restaurar agenda/negociação. Negociação indicada pelo Funil precisa pertencer à empresa e continuar aberta; conflito com venda/reabertura é desatualização, não um arquivamento de estado posterior.
- [ ] **Step 4: Validar.** Repetir alvos mais `tests/integracao/contato-politicas.test.ts`, `tests/integracao/funil-comandos.test.ts`, `tests/integracao/vendas-carteira.test.ts` e `npm run db:checar`. Esperado: preservação de direitos, primeira venda, agenda e autoria; atualizar expectativas antigas apenas onde a regra aprovada mudou. O teste de chamador único deve garantir um único adaptador para a RPC nova em `server/atendimento`. O adaptador antigo fica temporariamente isolado até 5/9, sem ampliar seus consumidores; não quebrar exports que a interface ainda usa.
- [ ] **Step 5: Revisar e commitar.** Revisão independente de RLS, idempotência e transações; commit `feat: add direct attendance and no-interest archival commands`.

## Task 4: Consulta comum, card e pop-up somente de informações

**Files:**
- Create: `db/migracoes/0053_consulta_atendimento.sql`, `docs/db/0053.md`, `src/lib/empresa-visual.ts`, `src/lib/empresa-visual.test.ts`.
- Create: `src/server/atendimento/consulta.ts`, `src/server/empresas/detalhes.ts`, `src/server/empresas/detalhes.test.ts`, `tests/integracao/empresa-detalhes-autorizacao.test.ts`.
- Create: `src/components/crm/card-empresa.tsx`, `card-empresa.dom.test.tsx`, `empresa-detalhes.tsx`, `empresa-dialogo.tsx`, `empresa-dialogo.dom.test.tsx`, `empresa.module.css`.
- Modify: `src/lib/prospeccao-pessoal.ts`, `src/server/prospeccao-pessoal.ts`, `app/empresas/busca/detalhe-acao.tsx` e seus testes, `src/components/crm/empresa-encontrada.tsx` para adaptar/reutilizar a apresentação existente.
- Reference: `src/components/ui/dialog.tsx`, `app/fila/buscar/empresas-recentes.tsx`, `src/components/crm/empresa-encontrada.tsx`, `app/fila/google/criterios.tsx` para diálogo com foco inicial correto.

**Interfaces:**
- Consumes: `ReferenciaEmpresa`, `ResumoEmpresa`, `DetalhesEmpresa`, `SituacaoEmpresa`, vínculo/agenda novos.
- Produces: `lerAtendimento(usuarioId:string,empresaId:string): Promise<{ok:true;empresa:ResumoEmpresa;fase:'inicial'|'negociacao'|'cliente'}|{ok:false;motivo:'sem_permissao'|'nao_encontrada'}>`; `lerDetalhesEmpresa(usuarioId:string,referencia:ReferenciaEmpresa): Promise<{ok:true;dados:DetalhesEmpresa}|{ok:false;motivo:'sem_permissao'|'nao_encontrada'}>`.
- Produces: `acaoEmpresa(resumo)` e `CardEmpresa({empresa,aoVer,aoAcionar})`, com `aoVer:(referencia:ReferenciaEmpresa)=>void` e `aoAcionar:(acao:AcaoEmpresa)=>void`; `EmpresaDialogo({referencia,aoFechar})` carrega via action autenticada e usa detalhes comuns.
- Preserve: `lerEmpresaBuscaAcao(id,cnpj)` pode manter seu formato público de ReactNode para consumidores existentes, devolvendo apenas o componente de dados. `lerDetalheBuscaAcao` continua sendo Ver busca.

- [ ] **Step 1: Escrever testes falhando de ações e seleção/autorização.** Mesma situação produz mesmo rótulo em qualquer tela; snapshots sem cadastro não iniciam atendimento. Abrir CNPJ B numa busca com A/B mostra B; busca de outro vendedor, ID arbitrário e resposta atrasada de A após selecionar B não expõem/trocam a empresa. Nome longo, CNAE ausente e Google sem CNPJ são legíveis e não inventam dados. Asserções:

```ts
expect(acaoEmpresa(empresaSemInteresse)?.rotulo).toBe('Retomar atendimento')
expect(conteudoDoDialogo).not.toContain('Prospectar esta lista')
expect(conteudoDoDialogo).not.toContain('Filtros usados')
expect(chamadasDeEscritaOuFornecedor).toHaveLength(0)
```

- [ ] **Step 2: Rodar.** `npm run test:unit -- src/lib/empresa-visual.test.ts src/components/crm/card-empresa.dom.test.tsx src/components/crm/empresa-dialogo.dom.test.tsx src/server/empresas/detalhes.test.ts`; `npm run test:integracao -- tests/integracao/empresa-detalhes-autorizacao.test.ts`. Esperado: falha por contratos/componentes novos.
- [ ] **Step 3: Implementar consultas e componentes.** A RPC de consulta pessoal continua paginada em 20, com campos/ordem de filtros atuais; acrescentar disponibilidade `sem_interesse`, excluir arquivadas do padrão ativo e retirar categorias temporárias. Distinguir indisponibilidade pendente/inativa. Consultas de cadastro verificam vínculo/papel; snapshot exige busca própria e CNPJ exato. Compartilhar DTO, formatadores e rótulos, mantendo dados gerenciais fora do DTO do vendedor. Dialogo tem somente informações, fecha sem alterar navegação e preserva foco.
- [ ] **Step 4: Repetir alvos e testes existentes de detalhe/recente.** Esperado: PASS com `Não informado` consistente, seleção estável, consulta sem efeitos, guardas reais e nenhuma aquisição. Invariantes novas entram no catálogo fechado.
- [ ] **Step 5: Revisar e commitar.** Revisor confere autorização da consulta e consistência dos estados/ações; commit `feat: share company cards and informational details dialog`.

## Task 5: Jornada pessoal direta e retirada da navegação antiga

**Files:**
- Create: `db/migracoes/0054_resumos_empresas.sql`, `docs/db/0054.md`; Modify: `src/server/atendimento/consulta.ts`, catálogo fechado de funções e testes, `docs/db/0053.md` para o ponteiro do contrato de leitura em lote. Acréscimo decidido durante a execução para evitar leituras individuais por card.
- Create: `app/fila/atendimento/[id]/page.tsx`, `app/fila/atendimento/acoes.ts`, `app/fila/atendimento/acoes.test.tsx`, `app/fila/atendimento/page.test.tsx`.
- Modify: `app/fila/page.tsx`, `central.tsx`, `localizar/page.tsx`, `localizar/pessoal.tsx`, `localizar/navegacao.ts`, `localizar/[id]/page.tsx`, `cartao.tsx`, `formulario.tsx`, `rascunhos.tsx`, `src/features/contato/acao.ts`, `formulario.tsx`, `rascunho.ts` e seus testes existentes.
- Modify: `src/features/contato/repositorio.ts`, `src/features/contato/repositorio.test.ts`, `src/features/contato/regras.ts`, `src/features/contato/um-chamador.test.ts` para concluir a troca do adaptador/validação antigos sem deixar chamadores ativos no contrato de reserva.
- Modify: `app/fila/google/prospectar.tsx`, `entrega.tsx`, `entregas.tsx`, `google/[id]/page.tsx`; `app/fila/buscar/empresas-recentes.tsx`, `resultados.tsx` e testes correspondentes.
- Remove when unused: `app/fila/localizar/legado.tsx`, `contexto-grupo.tsx`, `app/fila/grupos.tsx`, `grupos.module.css`, `campos-reserva.tsx`, `entrada-reserva.ts`, `localizar/reservar.tsx`, `etapas.tsx`. Converter os testes do contrato antigo em casos de aposentadoria, sem apagar cobertura de filtros/permissão/rascunho.
- Create: `tests/e2e/atendimento-direto.spec.ts`, `tests/e2e/dados-atendimento.ts`.
- Modify: `scripts/e2e/run.mts` para chamar `prepararAtendimentoDireto(banco:BancoDeTeste):Promise<void>`, usando a fixture da tarefa 1 para empresas exclusivas dessa jornada.

**Interfaces:**
- Consumes: comandos e consultas das tarefas 3/4; formulário envia chave estável e versão lida do servidor.
- Produces: `iniciarAtendimentoAcao(form:FormData): Promise<ResultadoAtendimento>`; caminho explícito `/fila/atendimento/<empresaId>`, sem selecionar uma próxima empresa global.
- Produces: `lerResumosEmpresas(usuarioId:string,empresaIds:readonly string[]):Promise<{ok:true;empresas:ResumoEmpresa[]}|{ok:false;motivo:'sem_permissao'|'dados_invalidos'}>`, consumido na renderização dos cards Google/Banco. A RPC `empresas_resumos_ler(uuid[])` devolve o mesmo JSON, autentica vendedor ativo com `pode_ler()`, deduplica no máximo 100 IDs e retorna somente os solicitados com vínculo próprio; alheios/inexistentes são omitidos. Array vazio retorna vazio após autorização. Usa o helper privado em lote uma única vez, sem concedê-lo nem reexpandir histórico por card. Snapshot próprio sem vínculo continua sem identidade/ação comercial. Cobrir autenticação, lista mista, limite, ausência de efeitos e trabalho em lote no banco real.
- Produces: serializer `urlAtendimento(empresaId:string,filtros:FiltrosPessoais): string`; `urlConsulta` não escreve `grupo=` nem propaga `escolher_lista`/`legado`. Destinos de volta são locais e validados.

- [ ] **Step 1: Escrever testes falhando de jornada e URLs.** Iniciar só muda atendimento; registro após mais de 30 minutos é permitido; duas empresas têm rascunhos separados; uma aba antiga não sobrescreve a outra. IDs alheios e URL `grupo=` não adquirem nada. Ver empresa na consulta/Google/últimas empresas abre o mesmo diálogo e não entra em atendimento.

```ts
// test('consulta vazia não reabre lista compartilhada')
expect(urlConsulta(selecionarGrupo(null),1)).not.toContain('grupo=')
// test('falha ou conflito não apaga rascunho da empresa')
expect(rascunhoDepoisDaFalha).toEqual(rascunhoAntesDaFalha)
expect(iniciosDepoisDeVerEmpresa).toBe(0)
```

- [ ] **Step 2: Rodar `npm run test:unit -- app/fila src/features/contato` e `npm run test:e2e -- tests/e2e/atendimento-direto.spec.ts`.** O runner encaminha o caminho ao Playwright e prepara banco local/mocks. Esperado: falha nos comportamentos que ainda usam reserva/legado, sem alterar timeout.
- [ ] **Step 3: Integrar cards e ações às telas pessoais.** Manter filtros pessoais, origem, paginação e volta; sem banner de 30 minutos, Próxima global ou etapas Puxar/Consultar/Registrar. Retirar a escolha de devolver/assumir do formulário novo, usando resultados de contato e fase real lida no servidor, nunca `posse`/fase enviada pelo navegador como autorização. Chave só muda após sucesso/novo comando, nunca automaticamente numa falha de resposta; rascunho só é limpo após sucesso ou descarte explícito. Não abrir empresa antes de inclusão como efeito de Ver empresa.
- [ ] **Step 4: Validar.** Testes de navegação, pessoal, rascunho, contato/action, entrega e recentes passam. `urlConsulta` com filtros vazios cai em consulta pessoal segura; bookmark de grupo vai à entrada atual, mantendo atendimento inequívoco quando recuperável e sem apagar rascunho. Ver busca continua funcionando. Testar o relógio do banco/fixture, não esperar 30 minutos reais.
- [ ] **Step 5: Revisar e commitar.** Revisor valida jornada inteira e confirma que nenhuma página ainda chama aquisição global como fallback; commit `feat: replace legacy list prospecting with direct personal attendance`.

## Task 6: Área Sem interesse e card animado no Funil

**Files:**
- Create: `app/fila/sem-interesse/page.tsx`, `lista.tsx`, `acoes.ts`, `acoes.test.tsx`, `lista.dom.test.tsx`.
- Create: `app/funil/card-sem-interesse.tsx`, `card-sem-interesse.module.css`, `card-sem-interesse.dom.test.tsx`, `tests/e2e/sem-interesse.spec.ts`.
- Create: `tests/e2e/dados-sem-interesse.ts`; Modify: `scripts/e2e/run.mts` para chamar `prepararSemInteresse(banco:BancoDeTeste):Promise<void>`, com dados próprios dessa jornada.
- Modify: `app/funil/page.tsx`, `quadro.tsx`, `quadro.dom.test.tsx`, `modal.tsx`, `modal.dom.test.tsx`, `acoes.ts`, `acoes.test.tsx`, `funil.module.css`, `app/fila/central.tsx`, `src/features/funil/consulta.ts`, `src/features/funil/repositorio.ts`.
- Preserve: os três elementos atuais de `ETAPAS_FUNIL` em `src/lib/comercial.ts`.

**Interfaces:**
- Consumes: arquivo paginado de `lerEmpresasPessoais(...,{disponibilidade:'sem_interesse'})`, consulta/ações comuns, `arquivarSemInteresse` e `retomarAtendimento`.
- Produces: `semInteresseAcao(form:FormData): Promise<EstadoFunil>` no Funil, exige empresa, negociação, versão e chave; action homóloga da área para retomar/arquivar empresa pessoal.
- Produces: `CardSemInteresse({estado,total,aceitaArraste,aoMudarSobre,aoSoltar})`, com estado `'repouso'|'sobre'|'salvando'|'sucesso'|'erro'`, `total:number` da consulta autorizada, `aceitaArraste:boolean`, `aoMudarSobre:(sobre:boolean)=>void` e `aoSoltar:()=>void`; o próprio card oferece link `/fila/sem-interesse`. Parent controla alvo válido/trava/comando, sem usar payload arbitrário de `dataTransfer` como autorização. `NegociacaoResumo` passa a trazer `versao:number` e `empresa:ResumoEmpresa`, carregados em lote, para usar o card comum e montar o comando.

- [ ] **Step 1: Escrever testes falhando.** Arraste de cada uma das três etapas para o mesmo card; inclusive Proposta enviada, hoje não arrastável por não ter próxima etapa. Testar teclado/toque pelo menu, clique para consultar, drop não abre a consulta, movimento reduzido, Enter durante salvamento, falha/resultado desconhecido, replay e refresh sem falso sucesso. Asserções:

```ts
expect(ETAPAS_FUNIL).toEqual(['primeiro_contato','em_negociacao','proposta_enviada'])
expect(colunasDeEtapa).toHaveLength(3)
expect(cardsDeDescarte).toHaveLength(1)
expect(arquivarChamadas).toHaveLength(1)
expect(cardOriginalDepoisDaFalha).not.toBeNull()
expect(contatosAposArraste).toEqual(contatosAntesDoArraste)
```

- [ ] **Step 2: Rodar.** `npm run test:unit -- app/funil/quadro.dom.test.tsx app/funil/card-sem-interesse.dom.test.tsx app/funil/acoes.test.tsx app/fila/sem-interesse/acoes.test.tsx app/fila/sem-interesse/lista.dom.test.tsx`. Esperado: falha pelos novos alvos/ações ausentes.
- [ ] **Step 3: Implementar arquivo e descarte.** Card compacto de descarte separado do grid das colunas; usar tokens existentes e lixeira animada em CSS. Proposta visual: 180 ms para realce/abertura, 220 ms para recolhimento no sucesso, sem movimento intenso com `prefers-reduced-motion`. Ícone decorativo, nome acessível Sem interesse, status anunciado e foco restaurado. Cards de empresa do Funil usam `CardEmpresa` num contêiner arrastável, sem botão envolvendo outros botões: Ver empresa abre somente os dados e Abrir no Funil abre a negociação operacional. Salvando mantém indicação pendente; só retirar/animar sucesso após confirmação. Não permitir dois comandos concorrentes na mesma interface. Arraste para próxima etapa mantém suas restrições atuais, mas o início do arraste não bloqueia a última etapa quando o destino é arquivo. A ação antiga Devolver à prospecção vira Marcar como Sem interesse e usa o mesmo comando, sem inventar ligação.
- [ ] **Step 4: Validar.** Repetir alvos e `npm run test:e2e -- tests/e2e/sem-interesse.spec.ts`. Cobrir duas páginas de arquivadas, filtro por nome/CNPJ, empresa nunca negociada consultável sem negociação artificial, nenhuma tarefa pendente após arquivar, retomada sem restaurar tarefas, replay sem repetir a animação e falha sem sumiço do card. Sem coluna nova e sem carregar todo o arquivo no Funil. Verificar claro/escuro e desktop/móvel, com capturas da interação.
- [ ] **Step 5: Revisar e commitar.** Revisor independente confere efeito comercial junto da interface, acessibilidade e ausência de exclusão real; commit `feat: add no-interest archive and animated funnel drop card`.

## Task 7: Meu dia, Carteira e histórico sem tarefas ressuscitadas

**Files:**
- Create: `db/migracoes/0055_disponibilidade_atendimento.sql`, `docs/db/0055.md`, `tests/integracao/disponibilidade-atendimento.test.ts`; atualizar catálogo fechado e ponteiros documentais das funções substituídas. Acréscimo decidido durante a execução para compartilhar disponibilidade com o gestor sem duplicar predicados nem expor helpers privados.
- Create: `src/lib/agenda-atendimento.ts`.
- Modify: `src/features/fila/consulta.ts`, `app/meu-dia/page.tsx`, `agenda.ts`, `historico.ts`, `painel.tsx` e seus testes; `app/carteira/page.tsx`, `lista.tsx`, `[id]/page.tsx`, `[id]/ficha.tsx` e testes.
- Modify: `src/features/contato/historico.ts`, `src/features/contato/linha-do-tempo.tsx`, `src/features/gestao/consulta.ts`, `src/features/gestao/perfil-vendedor.ts` e `tests/integracao/gestao-dashboard.test.ts`, distinguindo eventos reais, oportunidades abertas e arquivamento nos indicadores.
- Create: `tests/integracao/agenda-atendimento.test.ts`.
- Modify: `tests/integracao/carteira-retornos.test.ts`, `meu-dia-historico.test.ts`, `funil-comandos.test.ts`; `tests/e2e/meu-dia.spec.ts`, `carteira-visual.spec.ts`.
- Modify: `tests/e2e/dados-meu-dia.ts`, `tests/e2e/dados-carteira-visual.ts`, `tests/e2e/dados-funil.ts` para preparar vínculo/agenda reais nos cenários que passam a consumir as leituras novas.

**Interfaces:**
- Consumes: `agenda_contato_id` e vínculo ativo, condição de cliente existente, fase e DTO comuns.
- Produces: `EmpresaComigo` movido de `src/features/fila/consulta.ts` para `src/lib/agenda-atendimento.ts`, preservando campos atuais de cadastro/contato/endereço e acrescentando `situacao:SituacaoEmpresa` e `versao:number`; reexport no arquivo antigo para compatibilidade. Campo de reserva compatível, quando ainda necessário ao tipo antigo, sempre nulo no novo fluxo.
- Produces: `lerAgendaAtendimento(usuarioId:string): Promise<{ok:true;linhas:EmpresaComigo[]}|{ok:false;motivo:'sem_permissao'}>` em `src/server/atendimento/consulta.ts`, importando o tipo da camada comum; `lerMinhasEmpresas` deixa de ser fonte de reserva e mantém compatibilidade de cliente apenas onde ainda necessária.
- Produces: RPC somente de leitura `empresas_disponibilidade_ler(uuid[])`, com `{ok:true;empresas:Array<{empresaId:string;disponivel:boolean;motivo:motivoCanônico|null}>}` ou `{ok:false;motivo:'sem_permissao'|'dados_invalidos'}`. Autorização antes do lote vazio, UUIDs deduplicados no máximo 100; vendedor recebe apenas vínculo próprio, gestor ativo lê os IDs já autorizados. O estado é do dono real, sem impersonação, versão ou comando de vendedor. Helper privado concentra origem, exclusividade, vínculo/dono ativo e pendência; nova 0055 pode substituir a projeção e delegação de origem preservando a autorização do observador e o caso gestor existentes. Helpers brutos não são concedidos. Métricas e perfil usam lotes no mesmo statement sem reler snapshots por empresa. Provar paridade, matriz de origem/papel, negativas, limites e ausência de efeitos no banco real.

- [ ] **Step 1: Escrever testes falhando da agenda projetada.** Tentativa sem negociação devida aparece, futura não aparece até o dia, sem data não vira tarefa, arquivada sai, retomada não lê a data histórica cancelada. Primeira venda mantém o próximo passo vigente e inclui Carteira; recebido sem venda não entra. Eventos de arquivo não aumentam contagem de contatos.

```ts
// test('tentativa sem negociação entra em Meu dia, mas não em Carteira')
expect(idsDaAgenda).toContain(empresaSemNegociacao)
expect(idsDaCarteira).not.toContain(empresaSemNegociacao)
// test('retomada preserva cancelamento e histórico')
expect(agendaAposRetomada).not.toContain(empresaArquivada)
expect(contatoHistorico.proximo_passo_data).toEqual(dataAntesDoArquivo)
```

- [ ] **Step 2: Rodar.** `npm run test:integracao -- tests/integracao/agenda-atendimento.test.ts tests/integracao/carteira-retornos.test.ts tests/integracao/meu-dia-historico.test.ts`; `npm run test:unit -- app/meu-dia app/carteira src/features/contato`. Esperado: falha por consulta antiga que depende de reserva/responsabilidade ou busca o último retorno cancelado.
- [ ] **Step 3: Integrar a agenda vigente nas leituras.** Usar o contato apontado pelo vínculo, dia civil São Paulo e ordenação estável por data/nome/ID. Manter o último contato para histórico separadamente. Reutilizar `CardEmpresa` nos cards da Carteira e de empresa da agenda, preservando os campos específicos de próxima ação. Cliente com venda preserva a condição histórica de Carteira se houver arquivamento posterior, com estado explícito e sem retorno pendente; não apagar venda para tirá-lo das oportunidades. Enquanto arquivado, oferecer Retomar antes de registrar novo trabalho, sem bloquear leitura do histórico ou apagar a condição de cliente. Corrigir mensagens que prometem Carteira por assumir ou falam apenas em clientes na agenda.
- [ ] **Step 4: Validar.** Repetir alvos, venda e `npm run test:e2e -- tests/e2e/meu-dia.spec.ts tests/e2e/carteira-visual.spec.ts tests/e2e/sem-interesse.spec.ts`. Cobrir Meu dia→empresa→voltar, Funil→venda→Carteira e Sem interesse→retomar. Esperado: agenda consistente em todas as telas, inclusive perfil do gestor, sem recomputar tarefas pelo último contato ignorando cancelamento.
- [ ] **Step 5: Revisar e commitar.** Revisão das leituras e contadores; commit `feat: align daily agenda and portfolio with permanent attendance`.

## Task 8: Gestor e design system com o mesmo padrão de empresa

**Files:**
- Create: `db/migracoes/0056_resumos_gestor.sql`, `docs/db/0056.md`, adaptador focado em `src/server/empresas/` e testes de autorização/paridade em lote; atualizar catálogo fechado e ponteiros documentais. Acréscimo decidido durante a execução: o resumo anterior acoplava indisponibilidade à permissão do observador e não atendia a leitura gerencial do estado real.
- Modify: `src/features/empresas/listagem.ts`, `perfil.ts`, `app/empresas/page.tsx`, `lista.tsx`, `linha.tsx` se permanecer consumidor, `empresas.module.css` e testes.
- Modify: `app/design/galeria.tsx`, `app/fila/localizar/pessoal.module.css`, `app/fila/buscar/empresas-recentes.module.css` para remover composição duplicada após conferir consumidores.
- Modify: `tests/integracao/empresa-perfil-gestor.test.ts`, `empresas-listagem.test.ts`, `tests/e2e/empresas-visual.spec.ts`, `empresa-perfil-gestor.spec.ts`, `carrossel-empresas-banco.spec.ts`.

**Interfaces:**
- Consumes: `ResumoEmpresa`, `CardEmpresa`, diálogo e consultas autorizadas; filtros/paginação existentes do gestor.
- Produces: listagem gerencial paginada em cards com responsável e situação corretos, sem botões de vendedor. Estado cliente exige venda; responsável sem venda não recebe rótulo Carteira. Galeria mostra os mesmos componentes e o card de descarte real.
- Produces: `lerResumosEmpresasGestor(usuarioId:string,empresaIds:readonly string[]):Promise<{ok:true;empresas:ResumoEmpresaGestor[]}|{ok:false;motivo:'sem_permissao'|'dados_invalidos'}>` e RPC `gestor_empresas_resumos_ler(uuid[])`. Gestor ativo/pode_ler antes do vazio, UUIDs deduplicados no máximo 100, apenas IDs existentes já autorizados; vendedor recusado. Reutilizar uma projeção privada base de dados/estado reais do dono e snapshots exatos, sem N leituras de histórico por card. O wrapper privado anterior conserva assinatura/OID e delega preservando guardas de observador; não renomear objeto existente. O detalhe já autorizado pode usar a base para o gestor, com versão nula. `responsavel` vem do vínculo persistido ou é nulo, sem escolha entre candidatos; nenhuma versão/comando de vendedor é entregue ao gestor. Helpers sem grant, sem aquisição/efeito. Testar paridade por estado/campo, roles/limites, lotes e contagem real do trabalho. SQL anterior continua imutável.

- [ ] **Step 1: Escrever testes falhando de igualdade de contrato e permissões.** Mesmo cadastro em consulta, últimas empresas e gestor tem nome/CNAE/origem/situação iguais; gestor mantém filtro e paginação e não ganha Iniciar/Retomar como vendedor. Código de CNAE não vira atividade textual. Cliente/negociação/arquivada não são todos chamados Carteira.

```ts
// test('gestor compartilha dados sem receber comandos do vendedor')
expect(resumoNoGestor.situacao).toBe(resumoPessoal.situacao)
expect(textoDoCardGerencial).not.toContain('Iniciar atendimento')
expect(textoDoCardGerencial).not.toContain('Retomar atendimento')
```

- [ ] **Step 2: Rodar `npm run test:unit -- app/empresas src/components/crm/card-empresa.dom.test.tsx` e `npm run test:integracao -- tests/integracao/empresa-perfil-gestor.test.ts tests/integracao/empresas-listagem.test.ts`.** Esperado: falha pelas diferenças antigas de composição/estado.
- [ ] **Step 3: Integrar consultas e componentes.** Reutilizar os campos base e manter extensões de gestor no DTO gerencial. Ver empresa é informacional também para gestor, usando dados já autorizados. Preservar busca, importação, administração interna de grupos e ações gerenciais atuais. Remover CSS/linha antiga apenas sem consumidores. Galeria não deve ensinar reserva ou coluna Sem interesse.
- [ ] **Step 4: Validar.** Repetir alvos, `npm run typecheck` e `npm run test:e2e -- tests/e2e/empresas-visual.spec.ts tests/e2e/empresa-perfil-gestor.spec.ts tests/e2e/carrossel-empresas-banco.spec.ts`. Revisão visual em 390/820/1280 px, claro/escuro, nomes longos e dados ausentes. Resultado: cards legíveis, sem botões sobrepostos ou texto de origem/CNAE inventado, controles gerenciais preservados.
- [ ] **Step 5: Revisar e commitar.** Revisão independente do contrato visual e das permissões; commit `feat: standardize manager company cards and design gallery`.

## Task 9: Transição completa e retirada dos comandos de fila sem consumidor

**Files:**
- Create: `db/migracoes/0057_aposentar_reserva.sql`, `docs/db/0057.md`, `tests/integracao/atendimento-migracao.test.ts`, `tests/e2e/fluxo-comercial-unificado.spec.ts`, `docs/operacao/fluxo-comercial-unificado.md`.
- Modify: `src/server/db/migracoes/invariantes.ts`, `src/features/fila/repositorio.ts`, `tests/integracao/fila-reservar.test.ts`, `fila-puxar.test.ts`, `fila-posse.test.ts`, `fila-politicas.test.ts`, `fila-consulta.test.ts`, `contato-registrar.test.ts`, `prospeccao-pessoal.test.ts`, `prospeccao-grupos.test.ts`, `prospeccao-consulta.test.ts`.
- Modify: `tests/e2e/dados-reserva.ts`, `tests/e2e/dados-google.ts`, `tests/e2e/prospeccao-grupos.spec.ts`, `tests/e2e/prospeccao-previa.spec.ts`, `tests/e2e/reserva.spec.ts`, `scripts/e2e/run.mts` para concluir a troca do preparo legado; preservar cenários de proteção, filtro e histórico nas jornadas novas.
- Reference: `src/features/contato/um-chamador.test.ts`, testes de política/identidade e documentação das migrações superadas.

**Interfaces:**
- Consumes: todas as tarefas anteriores; operação pública somente pelo novo contrato.
- Produces: nenhuma função concedida sem consumidor; documentação da transição, pendências, verificação e recuperação. Histórico permanece consultável sem liberar o catálogo inteiro.
- Produces: guardas autoritativas para comandos novos nas mesmas indisponibilidades do resumo comum (origem inativa e pendência), depois de autenticação/replay e trava. Obrigação identificada no teste da tarefa 5: a pré-leitura de estado em TypeScript impedia replay, mas a 0052 ainda permitia comando novo com origem inativa. Resolver na nova 0057, reutilizando a disponibilidade central da 0055 e os contratos da 0056, sem editar SQL antigo, com negativas reais e preservação do replay histórico autorizado. Incluir a RPC comercial que o teste da tarefa 7 comprovou aceitar venda nova de cliente arquivado.

- [ ] **Step 1: Escrever testes falhando de migração e aposentadoria.** Criar banco até 0049 com reserva, negociação, cliente, descanso por Não atendeu/Sem interesse, colisão entre fontes e dono inativo; guardar IDs/autores/quantidades/datas. Aplicar as novas migrações pelo runner e comparar. Assertivas: contatos/vendas imutáveis, responsável inequívoco preservado, conflito reportado, agenda cancelada não restaurada, nenhum grant de aquisição global acessível ao vendedor, arquivos antigos não reabrem o catálogo.

```ts
// test('migração preserva história e não escolhe dono para colisão')
expect(contatosDepois).toEqual(contatosAntes)
expect(vendasDepois).toEqual(vendasAntes)
expect(pendencias.map(p=>p.empresaId)).toContain(empresaAmbigua)
expect(atribuicoesNovasDaEmpresaAmbigua).toHaveLength(0)
```
- [ ] **Step 2: Rodar.** `npm run test:integracao -- tests/integracao/atendimento-migracao.test.ts tests/integracao/atendimento-transicao.test.ts tests/integracao/politicas.test.ts`; esperado: falhas nas concessões/caminhos antigos antes da retirada.
- [ ] **Step 3: Aposentar os caminhos antigos.** Confirmar consumidores com `rg` antes de revogar `fila_reservar`, `prospeccao_pessoal_reservar`, `contato_registrar` antigo, `funil_devolver` e consultas de catálogo usadas somente pelo legado. Se algum consumidor legítimo permanecer, migrá-lo na mesma tarefa e só então revogar; não remover dados/grupos. Atualizar o catálogo fechado de funções e substituir expectativas antigas de prazo por provas do novo contrato. Acrescentar ponteiros nos documentos antigos, nunca editar seus SQLs. Fixtures E2E passam a preparar vínculos e agenda verdadeiros, sem usar reserva para simular entrega.
- [ ] **Step 4: Rodar a verificação completa uma vez.** `npm run typecheck`; `npm run lint`; `npm run db:checar`; `npm run test:unit`; `npm run test:integracao`; `npm run build:e2e`; `npm run test:e2e -- --sem-build`. Esperado: todos aprovados, nenhum skip novo ou timeout elevado. O runner já usa banco temporário e provedores mockados; não substituí-lo por testes em produção. Se necessário filtrar E2E durante desenvolvimento, conferir primeiro o encaminhamento de argumentos no runner; a validação final usa a suíte completa.
- [ ] **Step 5: Revisar e commitar.** Revisor verifica relatório antes/depois, permissões negativas, jornadas principais e lista de concessões retiradas. Commit `refactor: retire temporary reservation and legacy list access`.

## Task 10: Revisão final e entrega da PR

**Files:** diff integral da branch, spec, este plano, evidências e `docs/operacao/fluxo-comercial-unificado.md`.

**Interfaces:**
- Consumes: tarefas aprovadas e resultado da verificação completa.
- Produces: PR contra main com problema/comportamento final, validação, migrações novas e procedimento de transição; publicação manual sem execução automática.

- [ ] **Step 1: Solicitar revisão independente de toda a branch**, com foco em fronteiras entre entrega, comando, RLS, agenda e UI. A revisão final não substitui as revisões por tarefa. Corrigir achados e repetir somente os checks afetados e a integração exigida pelo novo diff.
- [ ] **Step 2: Conferir o diff final contra a spec.** Card de descarte, sem coluna; Ver empresa sem busca/efeito; nenhum prazo antigo; apenas uma entrega; nenhuma tarefa ressuscitada; Carteira só após venda; preservação e permissões comprovadas. Atualizar checkboxes com evidência, não por estimativa.
- [ ] **Step 3: Criar a PR e anexá-la à conversa.** Conferir branch imediatamente antes de commit/push; main protegida. Descrição indica que teste local e CI não equivalem a execução de migração ou validação autenticada em produção. Acompanhar o CI do commit atual; sem merge automático nesta etapa.
- [ ] **Step 4: Entregar o resultado e restaurar o ambiente privado.** Informar o que foi testado, a PR e pendências reais do inventário. Não migrar/publicar/ativar coleta nem redistribuir exceções por inferência. Guardar evidências sem segredos; não encerrar sessões do usuário.

## Autorrevisão e handoff

- Cobertura: navegação antiga e atendimento (5/9), vínculo/exclusividade/transição (1/2/9), comandos e agenda (3/7), card e pop-up comum (4), arquivo e animação sem coluna (6), gestor/galeria (8), verificação e entrega (9/10).
- Contratos: os comandos da tarefa 3 são a única escrita compartilhada consumida por 5/6/7; consultas da 4 são reutilizadas por 5/6/8; agenda aponta para contato real e é cancelada por referência, não por alteração de histórico.
- Cinco riscos do Review Focus têm testes nas tarefas proprietárias, inclusive última etapa arrastável, concorrência, identidades parciais e legado ambíguo.
- Pendências de dados não são decisões arbitrárias de código: ficam explícitas no relatório e na operação, sem reatribuição ou perda silenciosa.
- Método de execução já fornecido: agentes separados para implementar e revisar cada tarefa, em sequência, com revisão final.
- O usuário revisou e aprovou o plano e a continuidade com Superpowers. Executar as tarefas e revisões em sequência, sem pedir novamente a escolha de método. Merge e publicação continuam fora desta autorização.
