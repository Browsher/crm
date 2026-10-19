# Fundação e painéis de campanhas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar públicos, modelos, catálogos, rascunhos, cotas e pausas nos dois papéis.

**Architecture:** Uma feature campanhas usa funções SQL autorizadas e repositório com comoUsuario. As telas reaproveitam o shell atual; segredos são configuração operacional por ambiente e a ausência de conector impede envio real.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, Tailwind, pg, Postgres com RLS, Vitest e Playwright; npm e Node 24.x.

**Spec:** [Especificação aprovada](../specs/2026-10-16-campanhas-email-design.md).

## Global Constraints

Dependências: nenhuma entrega anterior. Ler os tipos e decisões do [plano principal](2026-10-16-campanhas-email.md).

- Uma feature não importa outra feature. Contratos comuns ficam em `src/lib/` ou `src/server/`.
- A autoridade permanece no Postgres, com RLS e funções de escrita específicas.
- O vendedor pode iniciar campanhas sozinho dentro dos limites definidos pelo gestor.
- Pausa do gestor só é liberada pelo gestor.
- Nenhuma cota positiva é ativada silenciosamente.
- A cota comercial diária usa a data de São Paulo. Aquisição usa limite mensal de empresas solicitadas, separado de créditos externos.
- Proteção durante campanha ativa e por sete dias após o último envio aceito; pausa de destinatário ainda não enviado expira após 24 horas sem processamento.
- A primeira recorrência é mensal. Sem nova edição aplicável, não repete o catálogo anterior.
- Ao alterar contrato de migração anterior, atualizar seu documento com ponteiro para o novo, conforme R-015.
- UTF-8 sem BOM e LF; SQL tem comentário apenas na primeira linha apontando a documentação.
- Sem consultas pagas, mensagens externas, contratação, publicação ou migração de produção durante desenvolvimento e testes.
- TDD: teste falhando, implementação mínima, teste verde e commit de escopo restrito. Preservar os arquivos locais alheios.
- Ler os guias relevantes em `node_modules/next/dist/docs/` e os componentes vizinhos antes de escrever Actions ou formulários.

## Review Focus

- E1.1: texto com controles, variável desconhecida ou URL não HTTPS deve ser recusado.
- E1.2: vendedor B não lê nem escreve campanha de A, inclusive por SQL direto.
- E1.3: corrida de cotas e virada de mês não permitem saldo duplicado.
- E1.3: vendedor não libera pausa do gestor; liberação global não remove pausa individual.
- E1.4: chamada direta à Action e estado inicial do formulário seguem autenticação e diretivas do projeto.

## Task E1.1: Tipos e validação sem dependência de infraestrutura

**Files:** criar `src/lib/email-campanhas.ts`, `src/features/campanhas/regras.ts`, `regras.test.ts`, `src/server/email/conteudo.ts`, `conteudo.test.ts`.

**Interfaces:** produzir os tipos do plano principal; `validarPublico(d:unknown):ResultadoEmail<DadosPublico>`, `validarModelo(d:unknown):ResultadoEmail<DadosModelo>`, `validarCatalogo(d:unknown):ResultadoEmail<DadosCatalogo>`, `validarCampanha(d:unknown):ResultadoEmail<DadosCampanha>`, `validarLimites(d:unknown):ResultadoEmail<LimitesEmail>`. Conteúdo: `renderizarEmail(modelo:Pick<DadosModelo,'assunto'|'corpo'>,destinatario:DestinatarioEmail,assinatura:string,urlCatalogo:string,urlDescadastro:string):ResultadoEmail<ConteudoEmail>`.

- [ ] **Step 1:** escrever testes `rejeita variável não permitida`, `escapa nome da empresa no HTML` e `aceita cotas zero mas rejeita negativo e fração`. Asserções:
  `expect(validarCatalogo({id:null,titulo:'Catálogo',edicao:'1',url:'javascript:alert(1)',interesses:[]}).ok).toBe(false)`;
  `expect(validarLimites({empresasMes:0,destinatariosCampanha:0,enviosDia:0,protecaoDias:7}).ok).toBe(true)`.
- [ ] **Step 2:** `npm run test:unit -- src/features/campanhas/regras.test.ts src/server/email/conteudo.test.ts`; esperado FAIL por funções ausentes.
- [ ] **Step 3:** implementar as assinaturas; nome até 100 pontos de código, assunto até 200, corpo até 20.000; sem controles exceto LF no corpo. Variáveis permitidas: `{{empresa}}`, `{{contato}}` e `{{assinatura}}`; ausência de contato gera texto vazio na prévia e não inventa nome. Não aceitar HTML arbitrário no editor inicial; gerar HTML com escape e parágrafos.
- [ ] **Step 4:** repetir o comando e `npm run typecheck`; esperado PASS, inclusive assunto com quebra de linha recusado.
- [ ] **Step 5:** commit somente desses arquivos: `feat: definir contratos e validacao de campanhas`.

## Task E1.2: Persistência autorizada e versões de conteúdo

**Files:** criar `db/migracoes/0038_campanhas_base.sql`, `docs/db/0038.md`, `src/features/campanhas/repositorio.ts`, `consulta.ts`, `tests/integracao/campanhas-fixtures.ts`, `campanhas-autorizacao.test.ts`; modificar `src/server/db/migracoes/invariantes.ts` e testes correspondentes.

**Interfaces:** `repositorioCampanhas(usuarioId:string)` oferece `salvarPublico(d:DadosPublico)`, `salvarModelo(d:DadosModelo)`, `publicarCatalogo(d:DadosCatalogo)`, `salvarCampanha(d:DadosCampanha)`, todos `Promise<ResultadoEmail<{id:string}>>`. Acrescentar `definirIdentidade(d:{vendedorId:string|null;nomeRemetente:string;responderPara:string}):Promise<ResultadoEmail<{id:string}>>`, exclusiva do gestor. Consultas `listarCampanhas(usuarioId:string):Promise<CampanhaResumo[]>` e `lerCampanha(usuarioId:string,id:string):Promise<ResultadoEmail<DadosCampanha & CampanhaResumo>>`. Produzir `prepararCampanhas(banco:BancoDeTeste):Promise<{gestor:string;vendedorA:string;vendedorB:string;campanhaA:string;campanhaB:string;catalogoId:string}>` para fixtures fictícias.

- [ ] **Step 1:** adicionar testes `outro vendedor não lê nem altera campanha`, `gestor publica modelo compartilhado`, `gestor não cria campanha como vendedor` e `senha provisória nega escrita`. No SQL direto, testar `email_campanha_salvar` como B sobre ID de A: `rejects.toMatchObject({code:'42501'})`; SELECT filtrado de A devolve zero linhas para B.
- [ ] **Step 2:** `npm run test:integracao -- tests/integracao/campanhas-autorizacao.test.ts`; esperado FAIL por schema ausente.
- [ ] **Step 3:** criar `email_publico`, `email_modelo`, `email_catalogo`, `email_campanha`, `email_conteudo_versao`, `email_supressao` e `email_identidade`, com UUID, auditoria, FKs, checks e RLS. Funções `email_publico_salvar(uuid,text,jsonb)`, `email_modelo_salvar(uuid,text,text,text,boolean)`, `email_catalogo_publicar(uuid,text,text,text,text[])` e `email_campanha_salvar(uuid,text,uuid,uuid,uuid,text,text)` retornam UUID e validam autoria e dados no banco. `email_identidade_definir(uuid,text,text)` cadastra a caixa real de resposta e o nome de exibição do vendedor ou da identidade institucional, sempre pelo gestor; o remetente técnico vem da configuração verificada do conector. Usar NULL de ID para criação. Nova edição do catálogo cria outro registro; suspender uma edição não altera snapshots. Modelos compartilhados são de gestor; editar sua cópia não muda o original. Supressão guarda bloqueio de marketing, bloqueio independente de entrega e geração de cancelamento por email normalizado, sem escrita direta concedida. Mapear exclusivamente grants consumidos nos repositórios.
- [ ] **Step 4:** repetir integração, `npm run db:checar` e `npm run test:unit -- src/server/db/migracoes/invariantes.test.ts`; esperado PASS. Fixar versão de conteúdo no início e rejeitar atualização silenciosa de edição publicada.
- [ ] **Step 5:** commit `feat: persistir campanhas com autorizacao no banco`, incluindo doc e invariantes.

## Task E1.3: Cotas atômicas e comandos de campanha

**Files:** criar `db/migracoes/0039_campanhas_limites.sql`, `docs/db/0039.md`, `src/features/campanhas/comandos.ts`, `cotas.ts`, `cotas.test.ts`, `tests/integracao/campanhas-cotas.test.ts`, `campanhas-comandos.test.ts`; atualizar repositório e invariantes.

**Interfaces:** `AcaoCampanha = 'iniciar'|'agendar'|'pausar'|'retomar'|'liberar'|'cancelar'`; `comandarCampanha(usuarioId:string,id:string,acao:AcaoCampanha,versao:number,chave:string,agendadaPara:string|null):Promise<ResultadoEmail<CampanhaResumo>>`; `definirLimites(usuarioId:string,vendedorId:string|null,d:LimitesEmail):Promise<ResultadoEmail<null>>`; `periodosCota(agora:Date):{dia:string;mes:string}`. SQL `email_campanha_comandar(uuid,text,integer,uuid,timestamptz)` e `email_limites_definir(uuid,integer,integer,integer,integer)` retornam text; `suspenderIntegracao(usuarioId:string,suspensa:boolean):Promise<ResultadoEmail<null>>` chama `email_integracao_suspender(boolean)`; `email_aquisicao_reservar(uuid,integer)` retorna JSON do saldo/operação.

- [ ] **Step 1:** testar que duas reservas de 60 com teto 100 produzem uma liberação; mesma chave com mesmos dados reapresenta resultado, e dados diferentes retornam `chave_reutilizada`. Testar `expect(periodosCota(new Date('2026-10-17T02:59:59Z')).dia).toBe('2026-10-16')`. Vendedor retomando pausa do gestor recebe `pausada_pelo_gestor`.
- [ ] **Step 2:** rodar `npm run test:unit -- src/features/campanhas/cotas.test.ts` e `npm run test:integracao -- tests/integracao/campanhas-cotas.test.ts tests/integracao/campanhas-comandos.test.ts`; esperado FAIL.
- [ ] **Step 3:** persistir política global, limites por vendedor, ledger por operação/período e suspensão da integração. Bloquear na mesma ordem global, vendedor e campanha, revalidando papel após espera. Cotas iniciais zero; proteção inicial sete dias. Comando usa versão e chave, não autor do formulário. Agendamento aceita ISO com offset e persiste UTC; não aceitar data local ambígua. Iniciar sem conector pronto permanece bloqueado e nunca informa envio. Comando aprovado fixa snapshot; E3 acrescentará a geração idempotente de trabalhos.
- [ ] **Step 4:** repetir testes e `npm run typecheck`; incluir virada de mês com reserva pendente, redução abaixo do consumido e liberação global conservando pausa individual. Esperado PASS.
- [ ] **Step 5:** commit `feat: aplicar cotas e pausas de campanhas`.

## Task E1.4: Telas de rascunho e administração

**Files:** criar `app/campanhas/layout.tsx`, `page.tsx`, `acoes.ts`, `formulario.tsx`, `campanhas.module.css`, `app/campanhas/[id]/page.tsx`, `app/campanhas/publicos/page.tsx`, `app/campanhas/modelos/page.tsx`; criar `app/gestao/campanhas/page.tsx`, `acoes.ts`, `formulario.tsx`, `app/gestao/campanhas/configuracao/page.tsx`, `catalogos/page.tsx`, `modelos/page.tsx`; testes `acoes.test.tsx`, `page.test.tsx`, `formulario.dom.test.tsx` em ambas as áreas. Modificar `src/components/crm/shell.tsx`, `caminho.tsx` e testes. Criar `src/server/email/configuracao.ts` e `configuracao.test.ts`; atualizar `.env.example`.

**Interfaces:** Actions `salvarCampanhaAcao(anterior:EstadoFormulario,form:FormData)`, `salvarPublicoAcao`, `salvarModeloAcao`, `comandarCampanhaAcao`, e Actions exclusivas de gestor para catálogo, limites, identidade de resposta e suspensão global, todas `Promise<EstadoFormulario>`; `EstadoFormulario={erro:string|null;id:string|null}`. `estadoIntegracoes():{cnpjDisponivel:boolean;emailDisponivel:boolean;capacidades:CapacidadesEmail|null}` não devolve segredos.

- [ ] **Step 1:** testar `gestor acessa administração e vendedor é negado`, `formulário conserva texto após recusa`, `Action exige usuário novamente` e `estado inicial serializa como objeto`: `expect(html).toContain('Salvar rascunho')`; `expect(JSON.stringify(estadoIntegracoes())).not.toContain(chaveFicticia)`.
- [ ] **Step 2:** `npm run test:unit -- app/campanhas app/gestao/campanhas src/server/email/configuracao.test.ts`; esperado FAIL.
- [ ] **Step 3:** ler integralmente `app/usuarios/acoes.ts`, `formulario-criar.tsx`, `app/whatsapp/configuracao/page.tsx` e layout antes de escrever os equivalentes. Constantes iniciais ficam no componente cliente; arquivo use server exporta só funções async e tipos. Guardar papel em cada Action e SQL. Publicar links de Campanhas em ambos os menus; vendedor edita somente seus dados. Catálogo aceita link HTTPS e interesses; configuração mostra estado das credenciais de ambiente, limites, remetente verificado e suspensão. Ler env preguiçosamente e sem NEXT_PUBLIC para chaves.
- [ ] **Step 4:** repetir testes, `npm run typecheck` e `npm run lint`; confirmar estados vazios e navegação por teclado em 390/820/1280. Ausência de credencial não quebra build ou página.
- [ ] **Step 5:** commit `feat: adicionar paineis de campanhas por papel`. Revisar entrega E1 contra a spec antes de iniciar E2.

## Saída da entrega

Rascunhos, públicos, modelos, catálogos e limites funcionam no banco local. Os botões de operação real permanecem bloqueados enquanto integração ou destinatários estiverem indisponíveis. Não apresentar a entrega como disparador completo.
