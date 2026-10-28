# Captura de leads e proteção de contatos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buscar empresas no CNPJ.biz com limite comprovável e impedir disputas de contato entre campanhas e atendimento.

**Architecture:** O cliente externo normaliza apenas campos documentados. Capturas persistidas trabalham uma página por vez, com orçamento já confirmado e retomada explícita. A proteção usa as mesmas identidades e bloqueios nos caminhos de campanha e fila.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, Tailwind, pg, Postgres com RLS, Vitest e Playwright; npm e Node 24.x.

**Spec:** [Especificação aprovada](../specs/2026-10-16-campanhas-email-design.md).

## Global Constraints

Dependências: E1 concluída. Ler os tipos e decisões do [plano principal](2026-10-16-campanhas-email.md).

- Uma feature não importa outra feature. Contratos comuns ficam em `src/lib/` ou `src/server/`.
- A autoridade permanece no Postgres, com RLS e funções de escrita específicas.
- O vendedor pode iniciar campanhas sozinho dentro dos limites definidos pelo gestor.
- Pausa do gestor só é liberada pelo gestor.
- Nenhuma cota positiva é ativada silenciosamente.
- A cota comercial diária usa a data de São Paulo. Aquisição usa limite mensal de empresas solicitadas, separado de créditos externos.
- Proteção durante campanha ativa e por sete dias após o último envio aceito; pausa de destinatário ainda não enviado expira após 24 horas sem processamento.
- A primeira recorrência é mensal. Sem nova edição aplicável, não repete o catálogo anterior.
- UTF-8 sem BOM e LF; SQL tem comentário apenas na primeira linha apontando a documentação.
- Sem consultas pagas, mensagens externas, contratação, publicação ou migração de produção durante desenvolvimento e testes.
- TDD: teste falhando, implementação mínima, teste verde e commit de escopo restrito. Preservar os arquivos locais alheios.
- Ler os guias relevantes em `node_modules/next/dist/docs/` e os componentes vizinhos antes de escrever Actions ou formulários.

## Review Focus

- E2.1: resposta parcial, campo extra e filtro não suportado não viram dados inventados.
- E2.2: timeout depois de chamar o fornecedor conserva débito e exige conferência.
- E2.2: duas confirmações da mesma captura não repetem chamada externa.
- E2.3: dois CNPJs com mesmo email competem pela mesma proteção.
- E2.4: lead com só email fica revisável e não cria empresa sem telefone.

## Task E2.1: Contrato e adaptador CNPJ.biz

**Files:** criar `src/server/cnpj-biz/tipos.ts`, `cliente.ts`, `cliente.test.ts`, `contrato.ts`, `contrato.test.ts`, `docs/integracoes/cnpj-biz.md`; atualizar `.env.example`.

**Interfaces:** `EmpresaCnpjBiz={cnpj:string;nomeEmpresa:string;nomeContato:string|null;email:string|null;telefone:string|null}`; `PaginaCnpjBiz={itens:EmpresaCnpjBiz[];proximoOffset:number|null;consumoInformado:number|null}`. `criarClienteCnpjBiz(config:{apiKey:string;fetch:typeof fetch}):{filtrosSuportados:(keyof FiltrosPublico)[];listar(f:FiltrosPublico,limit:number,offset:number):Promise<ResultadoEmail<PaginaCnpjBiz>>}`.

- [ ] **Step 0:** confirmar o contrato externo: consultar Context7 primeiro; se não houver CNPJ.biz, usar a documentação oficial `https://cnpj.biz/docs-api`. Registrar método, campos, paginação e cobrança em `docs/integracoes/cnpj-biz.md`, com fixtures sintéticas.
- [ ] **Step 1:** escrever testes `envia Bearer só ao host oficial`, `rejeita limit 0 e 101`, `rejeita filtro sem contrato` e `não presume crédito pelo tamanho da resposta`.
- [ ] **Step 2:** `npm run test:unit -- src/server/cnpj-biz`; esperado FAIL com adaptador ausente.
- [ ] **Step 3:** implementar as assinaturas com fetch injetado, endpoint documentado, paginação 1 a 100, timeout de 15 segundos, validação e erros sem chave no texto. Não criar endpoint de saldo. Sem consumo documentado, retornar `consumoInformado:null`; erro depois de requisição possivelmente cobrada retorna `resultado_incerto`.
- [ ] **Step 4:** repetir testes com rede externa proibida e respostas gravadas fictícias. Não seguir redirect para outro host com Bearer.
- [ ] **Step 5:** commit `feat: integrar contrato de empresas CNPJ Biz`.

## Task E2.2: Captura persistente e consumo conservador

**Files:** criar `db/migracoes/0040_campanhas_captura.sql`, `docs/db/0040.md`, `src/features/campanhas/captura.ts`, `captura.test.ts`, `tests/integracao/campanhas-captura.test.ts`; modificar repositório e invariantes.

**Interfaces:** `iniciarCaptura(usuarioId:string,campanhaId:string,quantidade:number,chave:string):Promise<ResultadoEmail<{capturaId:string}>>`; `capturarPagina(usuarioId:string,capturaId:string,cliente:ReturnType<typeof criarClienteCnpjBiz>):Promise<ResultadoEmail<{recebidos:number;concluida:boolean;incerta:boolean}>>`. SQL `email_captura_iniciar(uuid,integer,uuid)`, `email_captura_pagina_adquirir(uuid)` e `email_captura_pagina_concluir(uuid,uuid,text,jsonb)`, com autorização e concessão verificadas.

- [ ] **Step 1:** testar 150 empresas em páginas 100 e 50; mesma chave não faz nova chamada; retorno de 80 para pedido de 100 conserva débito 100; timeout conserva débito e `incerta:true`. No mês seguinte, concessão antiga não usa a janela anterior.
- [ ] **Step 2:** `npm run test:unit -- src/features/campanhas/captura.test.ts` e `npm run test:integracao -- tests/integracao/campanhas-captura.test.ts`; esperado FAIL.
- [ ] **Step 3:** persistir `email_captura`, `email_captura_pagina` e `email_destinatario`. Antes de HTTP, adquirir atomicamente página e orçamento por E1.3, derivando offset no banco. Registrar o marco de início antes da chamada: queda depois dele deixa página em conferência, sem repetição automática. Normalizar e deduplicar sem devolver orçamento. Ausência de telefone ou empresaId é válida no destinatário.
- [ ] **Step 4:** repetir testes, incluindo vendedor alheio e alteração de papel enquanto aguarda lock. Nenhuma transação fica aberta durante HTTP.
- [ ] **Step 5:** commit `feat: persistir capturas e controlar aquisicao de leads`.

## Task E2.3: Disponibilidade compartilhada e exclusões

**Files:** criar `db/migracoes/0041_campanhas_protecao.sql`, `docs/db/0041.md`, `src/server/email/disponibilidade.ts`, `tests/integracao/campanhas-disponibilidade.test.ts`; modificar `src/features/prospeccao/tipos.ts`, `mensagens.ts`, `app/fila/localizar/resultados.tsx`, `src/features/gestao/consulta.ts`, testes e invariantes; acrescentar ponteiros em `docs/db/0026.md`, `0028.md`, `0033.md`, `0036.md` e `0037.md` para `0041.md`.

**Interfaces:** `revisarDestinatarios(usuarioId:string,campanhaId:string):Promise<ResultadoEmail<{incluidos:number;excluidos:{id:string;motivo:string}[]}>>`. SQL interna `email_contato_disponivel(uuid,text,uuid)` e pública `email_destinatarios_revisar(uuid)`. Produzir `email_contato_protecao` por email normalizado e, quando conhecidos, CNPJ/empresa, sem escrita direta concedida.

- [ ] **Step 1:** vendedores diferentes disputam mesmo email de CNPJs diferentes: `expect(incluidosA + incluidosB).toBe(1)`. Reserva telefônica anterior exclui campanha; campanha anterior impede reserva alheia. Pausa há mais de 24h libera proteção de não enviados; aceitação mantém sete dias.
- [ ] **Step 2:** `npm run test:integracao -- tests/integracao/campanhas-disponibilidade.test.ts tests/integracao/fila-reservar.test.ts tests/integracao/prospeccao-grupos.test.ts`; esperado FAIL novo.
- [ ] **Step 3:** bloquear chaves de identidade ordenadas nos dois caminhos, mesmo sem empresa existente. Em migração nova, atualizar as definições vigentes de `fila_reservar`, `empresa_assumir`, `empresa_consultar`, `empresa_resumos`, `empresa_recentes`, `empresa_perfil`, `empresa_sugestoes` e `grupo_prospeccao_contagens`, preservando grupos, clientes e descanso. Somente proteção alheia impede atendimento do atual. Acrescentar disponibilidade `em_campanha`: título Indisponível e detalhe Em campanha de outro vendedor; gestor exclui qualquer proteção ativa de seu total disponível. Usar supressão de E1.2 nas exclusões, além de email ausente/inválido.
- [ ] **Step 4:** repetir integrações e `npm run test:unit -- src/features/prospeccao app/fila/localizar`; testar colisão com e sem empresa conhecida e ausência de deadlock. Esperado PASS.
- [ ] **Step 5:** commit `feat: coordenar contatos de campanhas e prospeccao`.

## Task E2.4: Público salvo, orçamento e revisão no vendedor

**Files:** criar `app/campanhas/[id]/captura.tsx`, `captura.dom.test.tsx`, `destinatarios.tsx`, `destinatarios.test.tsx`; modificar `app/campanhas/[id]/page.tsx`, `acoes.ts`, `publicos/page.tsx` e testes.

**Interfaces:** Actions `iniciarCapturaAcao(anterior:EstadoFormulario,form:FormData)`, `continuarCapturaAcao` e `revisarDestinatariosAcao`, todas com o mesmo retorno de E1.4. Próximos passos e offset são derivados do estado persistido.

- [ ] **Step 1:** testar que Salvar público não chama API; confirmação informa quantidade máxima; continuar não repete página concluída; lead sem telefone mantém email e mostra Não informado.
- [ ] **Step 2:** `npm run test:unit -- app/campanhas`; esperado FAIL novo.
- [ ] **Step 3:** apresentar só filtros suportados. Capturar no máximo uma página por Action, conservar progresso e permitir continuar ao retornar à tela. Quantidade e chave aprovadas ficam no lote. Exibir limite mensal interno, débito, consumo externo quando informado, exclusões e estado em conferência. Alterar filtros cria outra captura.
- [ ] **Step 4:** repetir testes, typecheck e verificar em celular com dados fictícios. Ausência de campo do fornecedor permanece visível como dado desconhecido.
- [ ] **Step 5:** commit `feat: permitir captura e revisao de publico pelo vendedor`.

## Saída da entrega

O vendedor prepara uma campanha com contatos adquiridos e revisados. Testes usam fetch controlado. Consulta real só ocorre com autorização posterior de uso dos créditos.
