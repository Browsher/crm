# Gestão de campanhas e encaminhamento comercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar visibilidade à equipe, transformar interesse confirmado em atendimento e verificar a feature inteira.

**Architecture:** Consultas usam os mesmos registros de aquisição, envios e consentimentos, com contagens distintas e autoria preservada. Encaminhamento usa os comandos comerciais existentes por função compartilhada no servidor/banco, sem importação entre features.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, Tailwind, pg, Postgres com RLS, Vitest e Playwright; npm e Node 24.x.

**Spec:** [Especificação aprovada](../specs/2026-10-16-campanhas-email-design.md).

## Global Constraints

Dependências: E1 a E4; dados e conectores de teste exclusivamente fictícios. Ler os tipos e decisões do [plano principal](2026-10-16-campanhas-email.md).

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

- E5.1: vários eventos do mesmo envio não multiplicam mensagens, custos ou conversões.
- E5.1: campanha de usuário inativo continua no histórico do gestor.
- E5.2: abrir email ou confirmar catálogo não gera negociação automaticamente.
- E5.2: encaminhar interessado não descarta reserva de atendimento que o vendedor já tinha.
- E5.3: testes de navegador não herdam credenciais de produção nem usam simulador fora do banco descartável.

## Task E5.1: Indicadores por campanha, público e vendedor

**Files:** criar `src/features/campanhas/indicadores.ts`, `indicadores.test.ts`, `tests/integracao/campanhas-indicadores.test.ts`, `app/gestao/campanhas/indicadores.tsx`, `indicadores.test.tsx`, `app/campanhas/[id]/andamento.tsx`, `andamento.test.tsx`, `app/campanhas/assinantes/page.tsx`, `app/gestao/campanhas/assinantes/page.tsx`; modificar consultas e páginas de campanhas.

**Interfaces:** `lerIndicadores(usuarioId:string,f:FiltroGestaoEmail):Promise<ResultadoEmail<{empresasSolicitadas:number;mensagensAceitas:number;entregas:number|null;falhas:number|null;emConferencia:number;assinaturas:number;interesses:number;primeirasVendas:number;valorPrimeirasVendasCentavos:string}>>`; `listarAssinantes(usuarioId:string,pagina:number):Promise<ResultadoEmail<{itens:{id:string;email:string;vendedorId:string|null;ativa:boolean}[];temProxima:boolean}>>`. Valores monetários inteiros atravessam DTO como string, sem perda de bigint.

- [ ] **Step 1:** um envio com cinco eventos de abertura mantém uma mensagem aceita; capacidade de entrega ausente retorna `entregas:null`; vendedor só vê próprios resultados, gestor inclui inativos e grupo Sem vendedor. A associação de primeira venda é coberta depois de E5.2, sem ligar por coincidência de nome.
- [ ] **Step 2:** rodar unitários dos indicadores/páginas e `npm run test:integracao -- tests/integracao/campanhas-indicadores.test.ts`; esperado FAIL.
- [ ] **Step 3:** agregar subconsultas independentes antes dos joins, contar operações/destinatários distintos e separar débito interno de consumo externo. Datas do filtro são dias inclusivos de São Paulo convertidos para limites UTC, com limite superior exclusivo. Exibir desconhecido quando capacidade não existe, sem fabricar zero. Listas paginadas com ordem estável; campanha cancelada ou autor inativo permanece consultável pelo gestor.
- [ ] **Step 4:** repetir testes com filtro por período, vendedor, público e campanha, resultados vazios e paginação sem sobreposição. Verificar acesso direto às rotas dos dois papéis.
- [ ] **Step 5:** commit `feat: acompanhar campanhas e assinaturas da equipe`.

## Task E5.2: Interesse explícito entra no atendimento atual

**Files:** criar `db/migracoes/0048_campanhas_atendimento.sql`, `docs/db/0048.md`, `src/server/email/encaminhamento.ts`, `encaminhamento.test.ts`, `tests/integracao/campanhas-atendimento.test.ts`, `app/campanhas/[id]/interesse.tsx`, `interesse.dom.test.tsx`; modificar Actions, invariantes e indicadores.

**Interfaces:** `DadosEncaminhamento={telefone:string|null;nomeEmpresa:string|null;cnpj:string|null;nota:string;proximoPasso:string;retorno:string}`; `encaminharInteresse(usuarioId:string,destinatarioId:string,chave:string,d:DadosEncaminhamento):Promise<ResultadoEmail<{empresaId:string;negociacaoId:string}>>`. SQL `email_interesse_encaminhar(uuid,uuid,jsonb,text,text,date)` valida autoria, origem e disponibilidade e retorna JSON com esses IDs. `email_encaminhamento` conserva campanha/destinatário/negociação e tem unicidade por negociação para atribuir a primeira origem sem duplicar conversão.

- [ ] **Step 1:** envio ou abertura não cria negociação. Duas chamadas iguais de interesse explícito retornam a mesma negociação. Sem telefone, devolver dados inválidos e conservar o lead na campanha. Com atendimento vigente em outra empresa, retornar `atendimento_em_andamento` sem devolver reserva nem apagar anotações. Outro vendedor não encaminha esse destinatário.
- [ ] **Step 2:** `npm run test:unit -- src/server/email/encaminhamento.test.ts app/campanhas` e `npm run test:integracao -- tests/integracao/campanhas-atendimento.test.ts tests/integracao/contato-registrar.test.ts tests/integracao/funil-base.test.ts`; esperado FAIL novo.
- [ ] **Step 3:** ler contratos vigentes de `fila_reservar`, `empresa_assumir` e `contato_registrar` antes de criar o wrapper. Reutilizar empresa por identidade verificada ou cadastrar somente com os campos mínimos reais, sem grant geral de importação para vendedor. Exigir próximo passo/data e nota do interesse recebido; usar contato interessado genuíno, sem ligação ou venda fictícia. Respeitar a reserva vigente; aquisição e vínculo comercial ocorrem na mesma transação autorizada. A nova negociação começa em Primeiro contato e usa o quadro existente.
- [ ] **Step 4:** repetir testes, RLS e concorrência. Registrar primeira venda pelo fluxo existente e comprovar atribuição única; compra posterior não vira outra primeira conversão da campanha.
- [ ] **Step 5:** commit `feat: encaminhar interessados ao atendimento comercial`.

## Task E5.3: Jornadas completas, revisão e entrega

**Files:** criar `tests/e2e/dados-campanhas.ts`, `campanhas-vendedor.spec.ts`, `campanhas-gestor.spec.ts`, `catalogo-publico.spec.ts`, `src/server/email/simulador-e2e.ts`, `simulador-e2e.test.ts`, `docs/operacao/campanhas-email.md`; modificar `scripts/e2e/run.mts`, `tests/e2e/ambiente.ts`, `src/e2e-ambiente.test.ts` e `tests/inventario-unitario.txt`.

**Interfaces:** `prepararCampanhasE2E(banco:BancoDeTeste):Promise<void>` usa cenários fictícios no banco já criado pelo runner. Simulador só existe com `CRM_E2E=1`, host local, papel app_teste e banco `teste_[0-9a-f]{12}`; qualquer divergência bloqueia sua seleção. Runner cria conexões locais dos papéis técnicos sem reutilizar credenciais reais.

- [ ] **Step 1:** escrever jornadas: vendedor cria público/mensagem, captura, revisa, testa e inicia; gestor reduz cota e pausa; vendedor não retoma; gestor libera; visitante vê catálogo, adere por POST, confirma e cancela; edição nova gera uma remessa, edição repetida gera zero; interesse confirmado abre Funil sem alterar outra reserva. Testar em 390/820/1280, teclado e temas claro/escuro.
- [ ] **Step 2:** `npm run test:e2e`; esperado FAIL das jornadas novas antes de ligar fixtures e rotas. O runner deve continuar recusando qualquer host remoto antes de criar banco.
- [ ] **Step 3:** ligar dados e transportes fictícios somente no cenário descartável. Limpar explicitamente envs CNPJ/email, URLs técnicas e chave de tokens herdadas do processo pai no build e servidor de teste; usar chaves fictícias do runner. Impedir rede externa, inclusive no código do servidor. Não adicionar rota pública de controle de teste nem usar simulator em produção. Documentar provisionamento restrito, encerramento do executor, rotação de credenciais e resolução de resultado incerto sem reenviar.
- [ ] **Step 4:** executar `npm run typecheck`, `npm run lint`, `npm run db:checar`, `npm run test:unit`, `npm run test:integracao`, `npm run test:inventario`, `npm run build:e2e` e `npm run test:e2e`. Capturar telas fictícias e conferir o fluxo real da interface. Separar baseline local conhecido de falha introduzida; não alterar CONTINUIDADE-CODEX.md de outra tarefa. Após isso, revisão independente do diff e da spec inteira.
- [ ] **Step 5:** commit `test: verificar campanhas e catalogo de ponta a ponta`. Preparar PR contra main com comportamento final, validação e dependências operacionais; anexar o PR ao chat após criá-lo. CI verde no SHA atual é requisito de integração. Não fazer merge, publicar, migrar produção ou disparar mensagens reais nesta tarefa sem autorização correspondente.

## Saída da feature

Entregas E1 a E5 verificadas, conector real escolhido e implementado, autorização no banco e recorrência testada. A documentação informa quais eventos o serviço realmente fornece e o que ainda depende de configuração operacional. Habilitar produção requer credenciais, cotas do gestor, domínio/remetentes válidos, executor hospedado e aprovação para migrações e disparos reais.
