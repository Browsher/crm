# Envio de emails e processamento persistente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar por conector real, respeitar cotas e pausas e registrar resultados sem duplicação cega.

**Architecture:** O CLI adquire um trabalho de cada vez, autoriza no banco e chama o transporte fora da transação. Resultado incerto fica retido para conferência. Webhooks passam por autenticação específica antes de persistir eventos.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, Tailwind, pg, Postgres com RLS, Vitest e Playwright; npm e Node 24.x.

**Spec:** [Especificação aprovada](../specs/2026-10-16-campanhas-email-design.md).

## Global Constraints

Dependências: E1 e E2; escolha documentada do serviço real antes de E3.1. Ler os tipos e decisões do [plano principal](2026-10-16-campanhas-email.md).

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

- E3.1: aceitação pelo serviço não é entrega e ausência de capacidade não vira zero confirmado.
- E3.2: papel técnico não pode consultar usuário, empresa ou outra função fora da lista.
- E3.3: crash antes e depois do marco de chamada têm recuperações diferentes.
- E3.3: pausa depois da autorização conserva envio em trânsito, mas impede o próximo.
- E3.4: assinatura falsa, corpo alterado e evento repetido não alteram dados indevidamente.

## Task E3.1: Conector real e configuração verificável

**Files:** criar `src/server/email/provedor.ts`, `provedor.test.ts`, `docs/operacao/email.md`; modificar `src/lib/email-campanhas.ts`, `src/server/email/configuracao.ts`, testes e `.env.example`.

**Interfaces:** produzir `criarAdaptadorEmail(config:Readonly<Record<string,string>>,fetchImpl:typeof fetch):ResultadoEmail<AdaptadorEmail>` e o contrato AdaptadorEmail do plano principal. Configuração usa nome de provedor fechado, nunca endpoint arbitrário vindo do formulário. Validar `PoliticaProvedorEmail`: limiteJanela/janelaSegundos devem ser ambos nulos ou ambos positivos; intervaloMinimoMs é nulo ou positivo. Remetentes da mesma conta compartilham contaId. Documentar consumo externo dessa conta; sem medição externa não prometer saldo total disponível.

- [ ] **Step 0:** fechar o serviço com base no domínio próprio e na hospedagem Hostinger confirmados; conferir produto/plano no hPanel e as políticas de origem dos leads. Aplicar as fontes do plano principal: Hostinger Mail proíbe destinatários sem opt-in, portanto a captura CNPJ.biz isolada não habilita envio por essas caixas. Manter a identidade de resposta dos vendedores e validar separadamente o transporte das campanhas, inclusive a recorrência consentida. Registrar documentação primária, autenticação, quotas, idempotência e eventos. Usar Context7 e documentação oficial; não contratar plano ou apresentar conta pessoal como envio ilimitado. Se ainda não houver decisão, bloquear esta tarefa, continuar apenas tarefas independentes e declarar essa dependência.
- [ ] **Step 1:** escrever testes com respostas sintéticas do serviço selecionado: aceitação gera `tipo:'aceito'`, rejeição conhecida gera `recusado`, timeout potencialmente aceito gera `incerto`.
- [ ] **Step 2:** `npm run test:unit -- src/server/email/provedor.test.ts src/server/email/configuracao.test.ts`; esperado FAIL com conector ausente.
- [ ] **Step 3:** implementar o contrato e autenticação reais. Capacidades falsas ocultam indicadores incompatíveis; autenticarEvento verifica a origem de webhook ou de evento obtido por consulta autenticada documentada. Enviar chave de idempotência somente com suporte documentado; não tratar um header inventado como garantia. Invalidar credencial sem ecoar segredo. Manter configuração padrão sem envio habilitado.
- [ ] **Step 4:** repetir testes, incluindo HTTP 429 com prazo, remetente não autorizado, rejeição definitiva e corpo incompleto. Registrar formato de fixture e versão da documentação, sem respostas ou endereços reais.
- [ ] **Step 5:** commit `feat: adicionar conector real de email`. Atualizar este bloco com o nome e contrato efetivamente escolhidos antes de considerar a tarefa concluída.

## Task E3.2: Fila, concessão e papel executor restrito

**Files:** criar `db/migracoes/0042_email_processamento.sql`, `docs/db/0042.md`, `src/server/db/executor-email.ts`, `executor-email.test.ts`, `src/server/email/fila.ts`, `tests/integracao/campanhas-executor.test.ts`; modificar `src/server/db/migracoes/aplicar.ts`, `invariantes.ts`, testes e `tests/integracao/campanhas-fixtures.ts`.

**Interfaces:** `configurarPoliticaProvedor(p:PoliticaProvedorEmail):Promise<void>`; `adquirirTrabalho(executorId:string):Promise<TrabalhoEmail|null>`; `autorizarTrabalho(id:string,concessao:string):Promise<ResultadoEmail<PedidoEnvio>>`; `registrarResultado(id:string,concessao:string,r:ResultadoEnvio):Promise<void>`. SQL `email_provedor_politica_definir(jsonb)` concedida somente ao executor e chamada com configuração operacional validada antes da rodada, `email_trabalho_adquirir(uuid)`, `email_envio_autorizar(uuid,uuid)`, `email_envio_chamada_iniciar(uuid,uuid)`, `email_envio_concluir(uuid,uuid,jsonb)`. O helper técnico só chama esse mapa fechado, sem SQL ou usuário de origem fornecidos livremente.

- [ ] **Step 1:** duas autorizações concorrentes na última vaga da janela do provedor liberam somente uma; um intervalo mínimo adia a segunda sem consumir nova cota; dois executores não recebem o mesmo trabalho; `SELECT * FROM usuario` como executor recebe 42501; tentativa de `SET ROLE app_usuario` é negada. Trabalho de usuário desativado não é autorizado; testes e confirmações entram no teto da equipe. Após autorização, redução de cota impede novas autorizações.
- [ ] **Step 2:** `npm run test:integracao -- tests/integracao/campanhas-executor.test.ts`; esperado FAIL.
- [ ] **Step 3:** criar fila e tentativas com chave única por destinatário/versão/categoria. Persistir a política e o histórico de autorizações por conta do provedor; impor sua janela móvel e intervalo mínimo de modo atômico, além das cotas comerciais. Remetentes da mesma conta não podem duplicar a franquia. Respostas HTTP 429 usam tentarApos em UTC para adiar a próxima tentativa conforme o contrato do serviço, mantendo o bloqueio persistido e qualquer pausa manual. Em caso de ausência desse prazo, aplicar espera conservadora persistida; a fila não deve repetir imediatamente. Acrescentar ao comando iniciar a criação idempotente dos trabalhos. `app_email_executor` nasce NOLOGIN sem superpoderes, sem herança e sem grant de tabelas; operação configura login/segredo separadamente. Criar invariantes próprias para papel e funções; revogar PUBLIC e atualizar lista de papéis que não acessam migrações. Adquirir uma linha com concessão de 90 segundos, revalidar proprietário, consentimento, proteções, pausas e cotas antes do marco de chamada. Não conceder impersonação de app_usuario. Confirmação consome cota global/provedor; prospecção, teste e catálogo vinculado também consomem cota de seu vendedor.
- [ ] **Step 4:** repetir testes, invariantes, `npm run db:checar` e `npm run typecheck`. Uma concessão expirada antes do marco pode ser adquirida novamente; depois do marco passa a conferência, nunca a envio automático.
- [ ] **Step 5:** commit `feat: criar fila e autorizacao restrita de email`.

## Task E3.3: Orquestração, retentativas e comandos do vendedor

**Files:** criar `db/migracoes/0043_email_testes_conteudo.sql`, `docs/db/0043.md`, `src/server/email/processar.ts`, `processar.test.ts`, `src/features/campanhas/teste-envio.ts`, `teste-envio.test.ts`, `app/campanhas/[id]/envio.tsx`, `envio.dom.test.tsx`; modificar `app/campanhas/acoes.ts`, detalhes, comandos, invariantes e testes de integração.

**Interfaces:** `processarLote(limite:number,executorId:string,adaptador:AdaptadorEmail):Promise<{aceitos:number;recusados:number;incertos:number}>`; `solicitarTeste(usuarioId:string,campanhaId:string,emailTeste:string,chave:string):Promise<ResultadoEmail<{trabalhoId:string}>>`; `revisarConteudo(usuarioId:string,campanhaId:string,versao:number,assunto:string,corpo:string,chave:string):Promise<ResultadoEmail<CampanhaResumo>>`. SQL `email_teste_solicitar(uuid,text,uuid)` e `email_campanha_conteudo_revisar(uuid,integer,text,text,uuid)`, com grants para suas Actions.

- [ ] **Step 1:** simular queda depois do marco e antes do retorno: `expect(chamadasTransporte).toBe(1)` após segunda rodada; trabalho permanece em conferência. Simular pausa pelo gestor durante o envio: primeiro resultado persiste e segundo destinatário não recebe. Testar que edição do modelo não altera snapshot e revisão explícita não reenfileira aceitos.
- [ ] **Step 2:** `npm run test:unit -- src/server/email/processar.test.ts src/features/campanhas/teste-envio.test.ts app/campanhas`; esperado FAIL.
- [ ] **Step 3:** processar no máximo 25 itens por rodada, adquirindo cada item somente quando for processá-lo. Timeout por requisição de 15 segundos e backoff persistido para recusa temporária comprovada. Resultado incerto reserva contagem e proteção até conferência; não oferecer botão de reenviar sem prova de não aceitação. Teste só vai para a caixa de resposta do próprio vendedor ou para a caixa institucional, configuradas pelo gestor em email_identidade, e conta na cota. Guardar a revisão anterior e a lista aceita; conteúdo novo requer pausa e confirmação dos pendentes e não libera pausa do gestor.
- [ ] **Step 4:** repetir testes mais `campanhas-executor` e `campanhas-comandos`; testar chave repetida com payload diferente, calendário de cota, configuração indisponível e destinatário descadastrado entre revisão e execução.
- [ ] **Step 5:** commit `feat: processar campanhas sem repetir envios incertos`.

## Task E3.4: Executor fora do navegador e eventos autenticados

**Files:** criar `scripts/email/executar.mts`, `src/server/email/cli.ts`, `cli.test.ts`, `src/server/email/eventos.ts`, `eventos.test.ts`, `db/migracoes/0044_email_eventos.sql`, `docs/db/0044.md`, `app/api/email/eventos/[provedor]/route.ts`, `route.test.tsx`, `tests/integracao/campanhas-eventos.test.ts`; modificar `src/server/autenticacao/rota.ts`, `rota.test.ts`, `.env.example`, invariantes e operação.

**Interfaces:** CLI `npm run email:executar -- --uma-rodada --limite 25`, registrado em package.json com tsx; `registrarEventos(eventos:EventoEmail[]):Promise<ResultadoEmail<{novos:number}>>`. SQL `email_eventos_registrar(jsonb)` concedida somente ao executor. Route Handler valida o corpo bruto via AdaptadorEmail antes de chamar a função.

- [ ] **Step 1:** testar webhook sem assinatura retorna 401 e zero escritas; repetição do mesmo evento mantém uma linha; evento tardio de entrega não apaga denúncia/supressão. Proxy permite somente o caminho de callback esperado e mantém `/api/email/eventos-falso/x` protegido. CLI sem credencial técnica falha antes de abrir conexão.
- [ ] **Step 2:** rodar `npm run test:unit -- src/server/email/cli.test.ts src/server/email/eventos.test.ts app/api/email src/server/autenticacao/rota.test.ts` e integração de eventos; esperado FAIL.
- [ ] **Step 3:** implementar CLI com rodada única e modo contínuo, encerramento limpo, limites válidos e espera entre rodadas sem manter transação. Usar `DATABASE_URL_EMAIL_EXECUTOR` e TLS verificado; nunca reutilizar URL administrativa. Persistir eventos únicos por provedor/conta/id, vinculando idExterno ao trabalho já conhecido. Falha permanente e denúncia atualizam supressão. Liberar callback no proxy, sem liberar toda a API, e rejeitar provedor desconhecido. Não abrir webhook que o conector não autentique de forma documentada.
- [ ] **Step 4:** repetir testes, typecheck, build sem secrets e teste de reinício com banco local. Não ativar modo contínuo ou agendador contra produção neste teste.
- [ ] **Step 5:** commit `feat: executar fila e receber eventos autenticados`.

## Saída da entrega

Conector e executor são reais e testados com HTTP controlado. Ativação comercial aguarda credenciais, hospedagem do executor e descadastro público da E4. O plano não considera SMTP aceito uma confirmação de entrega nem considera simulador uma integração concluída.
