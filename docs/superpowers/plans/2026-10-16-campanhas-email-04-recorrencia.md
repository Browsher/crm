# Assinatura e recorrência do catálogo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o catálogo, obter adesão confirmada e enviar novas edições mensalmente com preferências e descadastro.

**Architecture:** Funções públicas restritas por token usam conexão própria, sem sessão fictícia de vendedor. Consentimento é separado de posse comercial. A recorrência produz trabalhos na mesma fila e obedece às cotas existentes.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, Tailwind, pg, Postgres com RLS, Vitest e Playwright; npm e Node 24.x.

**Spec:** [Especificação aprovada](../specs/2026-10-16-campanhas-email-design.md).

## Global Constraints

Dependências: E1 e fila E3.2; ativação depende do conector E3 e do executor hospedado. Ler os tipos e decisões do [plano principal](2026-10-16-campanhas-email.md).

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

- E4.1: token efetivo não fica em texto puro no banco nem em snapshot de email.
- E4.2: GET/HEAD de scanner não confirma adesão ou descadastro.
- E4.2: confirmação antiga depois de cancelamento não reativa marketing.
- E4.3: reativação libera só catálogo solicitado, sem remover bloqueio de prospecção ou entrega.
- E4.4: reinício após meses não envia edições repetidas nem usa vendedor desativado.

## Task E4.1: Tokens, finalidade e papel público restrito

**Files:** criar `db/migracoes/0045_catalogo_assinaturas.sql`, `docs/db/0045.md`, `src/server/catalogo/tokens.ts`, `tokens.test.ts`, `src/server/db/catalogo-publico.ts`, `catalogo-publico.test.ts`, `tests/integracao/catalogo-autorizacao.test.ts`; modificar tipos compartilhados, invariantes, configuração, `.env.example` e harness local.

**Interfaces:** complementar o contrato compartilhado de E1.1: `FinalidadeToken='origem'|'adesao'|'preferencias'|'descadastro'`; `ReferenciaTokenEmail={id:string;nonce:string;finalidade:FinalidadeToken;hash:string}`; `derivarToken(ref:Pick<ReferenciaTokenEmail,'id'|'nonce'|'finalidade'>,segredo:string):{token:string;hash:string}`; `hashToken(token:string):string`. Papel `app_catalogo_publico` sem herança, leitura de tabelas ou acesso a funções de vendedor. `TrabalhoEmail` recebe `tokens:ReferenciaTokenEmail[]`.

- [ ] **Step 1:** `expect(hashToken(derivarToken(ref,chave).token)).toBe(derivarToken(ref,chave).hash)`; mesma referência/finalidade deriva mesmo token e outra finalidade deriva diferente. Papel público não lê campanha nem usuário; nenhum registro contém token efetivo em claro.
- [ ] **Step 2:** `npm run test:unit -- src/server/catalogo/tokens.test.ts src/server/db/catalogo-publico.test.ts` e integração de autorização; esperado FAIL.
- [ ] **Step 3:** criar `catalogo_assinatura`, `catalogo_consentimento`, `catalogo_token` e limites públicos de solicitação. Nonce aleatório de 32 bytes, token efetivo HMAC-SHA256 com `EMAIL_TOKENS_CHAVE` de 32 bytes e propósito separado; guardar hash do token efetivo, nunca token em claro. Adesão expira em 24h, origem e preferências em 90 dias; descadastro permanece válido para sua finalidade até revogação. O worker reconstitui links apenas em memória no transporte; snapshots conservam referências/redações desses links. Permitir destinatário de assinatura com campanhaId nulo somente quando houver assinaturaId; nomeEmpresa pode ser desconhecido. Criar `DATABASE_URL_CATALOGO_PUBLICO`, sem reutilizar URL administrativa. Novos papéis e grants entram nas invariantes com mapas fechados.
- [ ] **Step 4:** repetir testes e `npm run db:checar`; verificar que descarte de conexão não vaza papel, como em `como-usuario.ts`. Chave ausente não quebra build, mas bloqueia geração/entrega de links.
- [ ] **Step 5:** commit `feat: criar consentimento e tokens restritos de catalogo`.

## Task E4.2: Adesão pública com confirmação explícita

**Files:** criar `src/server/catalogo/adesao.ts`, `adesao.test.ts`, `app/catalogo/[id]/page.tsx`, `formulario.tsx`, `acoes.ts`, `formulario.dom.test.tsx`, `app/catalogo/confirmar/[token]/page.tsx`, `acao.ts`, `acao.test.tsx`, `tests/integracao/catalogo-adesao.test.ts`; modificar proxy lógico e testes.

**Interfaces:** `solicitarAdesao(d:DadosAdesao,origem:string|null):Promise<{recebido:true}>`; `confirmarAdesao(token:string):Promise<ResultadoEmail<{assinaturaId:string}>>`; SQL `catalogo_publico_ler(uuid)`, `catalogo_adesao_solicitar(text,text[],text,text,text,jsonb)`, `catalogo_adesao_confirmar(text)`, permitidas apenas no mapa público e com validação de token/origem no banco.

- [ ] **Step 1:** GET da confirmação não altera assinatura; POST válido confirma uma vez. Token de campanha inválido produz origem institucional, nunca vendedor do parâmetro da URL. Vendedor inativo conserva adesão, mas suspende envio vinculado. Repetição pública e email desconhecido devolvem a mesma resposta sem enumerar assinantes.
- [ ] **Step 2:** rodar `npm run test:unit -- src/server/catalogo app/catalogo src/server/autenticacao/rota.test.ts` e `npm run test:integracao -- tests/integracao/catalogo-adesao.test.ts`; esperado FAIL.
- [ ] **Step 3:** ler catálogo publicado por DTO mínimo. Formulário pede email e interesse válido, incluindo opção explícita Catálogo completo. Persistir versão do texto, finalidade e origem verificável; iniciar confirmação na fila, contando teto global e do provedor. Limitar solicitações a 3 por email/dia e 20 por origem/hora, sem confiar em IP enviado em formulário. Gerar as referências de token no servidor e passar somente seed, hash e finalidade no JSON restrito da solicitação. A função de confirmação recebe o token efetivo e calcula seu hash no SQL; hash fornecido pelo chamador não é prova de confirmação. Confirmar por POST e invalidar tokens anteriores ao último cancelamento. Confirmações usam identidade institucional e cota global, inclusive quando a origem comercial está suspensa. Adesão sem campanha usa identidade institucional e nenhum vendedor fictício. Assinatura já ativa conserva responsável ao receber outra origem, sem transferência silenciosa. Liberar somente os caminhos públicos de catálogo, com casos negativos para nomes parecidos.
- [ ] **Step 4:** repetir testes mais autorização pública; testar token expirado, finalidade trocada, duas confirmações concorrentes e zero de cota sem perder adesão pendente.
- [ ] **Step 5:** commit `feat: confirmar assinatura publica do catalogo`.

## Task E4.3: Preferências, descadastro e links de todos os emails

**Files:** criar `src/server/catalogo/preferencias.ts`, `preferencias.test.ts`, `app/catalogo/preferencias/[token]/page.tsx`, `acoes.ts`, `app/catalogo/descadastro/[token]/page.tsx`, `acoes.ts`, `app/catalogo/descadastro/[token]/um-clique/route.ts`, testes correspondentes e `tests/integracao/catalogo-descadastro.test.ts`; modificar `src/server/email/processar.ts`, `conteudo.ts` e testes, mais funções na migração nova da tarefa.

**Interfaces:** `atualizarPreferencias(token:string,p:PreferenciasCatalogo):Promise<ResultadoEmail<null>>`; `descadastrar(token:string):Promise<ResultadoEmail<null>>`; `prepararLinksPublicos(t:TrabalhoEmail):Promise<ResultadoEmail<PedidoEnvio>>`. SQL `catalogo_preferencias_definir(text,text[],boolean)`, `catalogo_descadastrar(text)`, `email_links_preparar(uuid,uuid,jsonb)` e helper interno de elegibilidade. Criar `db/migracoes/0046_catalogo_preferencias.sql` e `docs/db/0046.md`.

- [ ] **Step 1:** descadastro antes da autorização impede próximo envio por qualquer vendedor. Nova adesão explícita libera só catálogo, preservando prospecção bloqueada e denúncia. GET/HEAD do link mantém estado; POST um-clique com contrato válido cancela sem login. Email sem capacidade de abertura não mostra leitura zero confirmada.
- [ ] **Step 2:** testes unitários de preferências/rotas e integração `catalogo-descadastro`; esperado FAIL.
- [ ] **Step 3:** resolver token por hash e finalidade, bloquear linha de supressão junto com consentimento e usar geração de cancelamento para invalidar confirmação antiga. Headers de descadastro apontam para o endpoint POST; link no corpo abre página com confirmação. Renderizar links em memória no worker depois da autorização, sem persistir o token em corpo ou log. Conferir origem e formulário nas Actions públicas; o POST um-clique depende do token e contrato específico, não de sessão ou do Origin de navegador.
- [ ] **Step 4:** repetir testes e regressão `src/server/email/processar.test.ts`; testar corrida confirmação/cancelamento e ausência de token em snapshot, fixtures de saída ou exceções.
- [ ] **Step 5:** commit `feat: aplicar preferencias e descadastro compartilhado`.

## Task E4.4: Recorrência mensal na fila persistente

**Files:** criar `db/migracoes/0047_catalogo_recorrencia.sql`, `docs/db/0047.md`, `src/server/catalogo/recorrencia.ts`, `recorrencia.test.ts`, `tests/integracao/catalogo-recorrencia.test.ts`; modificar CLI, funções concedidas ao executor, configuração e docs de operação.

**Interfaces:** `agendarCatalogosMensais(limite:number):Promise<{agendados:number;semNovidade:number;suspensos:number}>`; `proximaJanelaMensal(agora:Date):Date`. SQL `catalogo_recorrencia_agendar(integer)` permitida somente ao executor, criando na mesma transação o trabalho e o registro `catalogo_remessa` único por email/edição/finalidade.

- [ ] **Step 1:** duas rodadas no mesmo mês/edição criam um trabalho; nova edição compatível é elegível na próxima janela; não havendo nova edição, `expect(agendados).toBe(0)`. Após meses parado, selecionar só a edição publicada mais recente por interesse e deduplicar edições comuns, sem despejar histórico.
- [ ] **Step 2:** `npm run test:unit -- src/server/catalogo/recorrencia.test.ts` e `npm run test:integracao -- tests/integracao/catalogo-recorrencia.test.ts`; esperado FAIL.
- [ ] **Step 3:** primeira janela no dia 1 do mês seguinte, às 09h de São Paulo, exibida nas preferências. Depois usar mês civil, não somar 30 dias. Sem novidades ou com cotas esgotadas, preservar pendência sem duplicar remessa; cancelado, bloqueado ou vendedor desativado não autoriza. Origem institucional consome só equipe/provedor. CLI materializa recorrência antes de drenar fila; catálogo em conferência não volta como nova tentativa.
- [ ] **Step 4:** repetir testes com virada de ano, fevereiro, pausa, mudança de interesses, corrida de executores e edição suspensa. Revalidar no envio, mesmo depois de o agendador ter selecionado.
- [ ] **Step 5:** commit `feat: enviar novas edicoes do catalogo mensalmente`.

## Saída da entrega

Assinatura e preferências funcionam sem login; o executor agenda somente envios autorizados. Implantação e disparos reais continuam separados da demonstração com banco e transporte fictícios.
