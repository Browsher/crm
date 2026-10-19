# Campanhas de email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a feature aprovada no CRM, da escolha do público ao envio rastreável e ao catálogo recorrente.

**Architecture:** Cinco entregas sequenciais usam os módulos atuais de identidade, Prospecção e Funil. O domínio de campanhas fica separado dos adaptadores CNPJ.biz e email; fila, cotas, disponibilidade e permissões são persistidas no Postgres. O executor usa credencial própria e roda fora das requisições do navegador.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, Tailwind, Postgres 17/18 com RLS, pg, Vitest 5 e Playwright; npm e Node 24.x.

**Spec:** [Campanhas de email com prospecção no CNPJ Biz](../specs/2026-10-16-campanhas-email-design.md), aprovada pelo usuário.

## Global Constraints

- Uma feature não importa outra feature. Contratos comuns ficam em `src/lib/` ou `src/server/`.
- A autoridade permanece no Postgres, com RLS e funções de escrita específicas.
- O vendedor pode iniciar campanhas sozinho dentro dos limites definidos pelo gestor.
- Pausa do gestor só é liberada pelo gestor.
- Nenhuma cota positiva é ativada silenciosamente.
- A cota comercial diária usa a data de São Paulo. Aquisição usa limite mensal de empresas solicitadas, separado de créditos externos.
- Proteção durante campanha ativa e por sete dias após o último envio aceito; pausa de destinatário ainda não enviado expira após 24 horas sem processamento.
- A primeira recorrência é mensal. Sem nova edição aplicável, não repete o catálogo anterior.
- Ao alterar contrato de migração anterior, seu documento recebe ponteiro para a nova explicação, conforme R-015.
- UTF-8 sem BOM e LF; SQL tem comentário apenas na primeira linha apontando a documentação.
- Sem consultas pagas, mensagens externas, contratação, publicação ou migração de produção durante desenvolvimento e testes.
- TDD: teste falhando, implementação mínima, teste verde e commit de escopo restrito. Preservar os arquivos locais alheios.
- Ler os guias relevantes em `node_modules/next/dist/docs/` e os componentes vizinhos antes de escrever Actions ou formulários.

## Review Focus

1. Chamada direta ao banco por vendedor, gestor ou executor errado: negar escrita e leitura indevidas, mesmo sem passar pela tela. Cobertura E1.2 e E3.2.
2. Virada de dia/mês e duas reservas concorrentes: nenhuma cota pode ser usada duas vezes ou transferida à janela anterior. Cobertura E1.3 e E2.2.
3. Mesmo email em dois CNPJs e colisão com atendimento telefônico: um único responsável pode autorizar contato. Cobertura E2.3.
4. Pausa ou queda entre autorização e resposta do provedor: preservar mensagens em trânsito e não repetir resultado incerto. Cobertura E3.3.
5. GET de leitor de links, descadastro seguido de adesão e assinatura sem campanha: exigir confirmação explícita, liberar somente catálogo solicitado e usar cota institucional. Cobertura E4.1 a E4.3.

## Sequência e entregáveis

| Entrega | Plano | Resultado revisável |
| --- | --- | --- |
| E1 | [Fundação e painéis](2026-10-16-campanhas-email-01-fundacao.md) | Públicos, modelos, edições, rascunhos, limites e pausa com autorização real |
| E2 | [Captura e disponibilidade](2026-10-16-campanhas-email-02-captura.md) | Captura CNPJ.biz, orçamento e revisão de leads sem duplicidade |
| E3 | [Envio e processamento](2026-10-16-campanhas-email-03-envio.md) | Conector real, fila, executor, teste e eventos conforme capacidades |
| E4 | [Assinatura e recorrência](2026-10-16-campanhas-email-04-recorrencia.md) | Catálogo público, adesão confirmada, preferências e envio de novas edições |
| E5 | [Gestão e atendimento](2026-10-16-campanhas-email-05-gestao.md) | Indicadores, qualificação no CRM e jornadas completas |

Cada entrega tem seu ciclo de revisão e pode gerar um PR. Abrir contra main, integrar antes de iniciar o PR seguinte e então atualizar a base; não empilhar PRs em branches destinadas a desaparecer. A feature só está concluída quando as cinco entregas e os conectores reais estiverem verificados.

## Mapa de arquivos

- `src/lib/email-campanhas.ts`: tipos compartilhados, resultados e estados.
- `src/features/campanhas/`: validação, repositórios, consultas, modelos e comandos do usuário.
- `src/server/cnpj-biz/`: autenticação, contrato validado e leitura da API de empresas.
- `src/server/email/`: configuração, conteúdo, fila, cotas, transporte e eventos.
- `src/server/catalogo/`: consentimento, links públicos e recorrência compartilhada.
- `src/server/db/executor-email.ts` e `catalogo-publico.ts`: funções permitidas para papéis técnicos específicos, sem SQL arbitrário fornecido pelo chamador.
- `app/campanhas/`: área do vendedor; `app/gestao/campanhas/`: administração e acompanhamento.
- `app/catalogo/`: páginas públicas e operações limitadas por token.
- `app/api/email/eventos/[provedor]/route.ts`: webhook autenticado do conector escolhido.
- `scripts/email/executar.mts`: executor com rodada única e execução contínua fora do Next.
- `db/migracoes/0038_*` a `0048_*` e seus `docs/db/NNNN.md`: alterações aditivas.
- Testes junto ao domínio/componentes, `tests/integracao/campanhas-*.test.ts`, `catalogo-*.test.ts` e `tests/e2e/campanhas-*.spec.ts`.

A última migração conferida é 0037. Se outra entrega avançar a sequência antes de implementar, resolver a numeração na branch ainda não aplicada e ajustar as referências antes do primeiro teste; nunca alterar ou renumerar uma migração aplicada.

## Contratos entre entregas

Os tipos abaixo são produzidos em E1.1 no arquivo `src/lib/email-campanhas.ts`. Assinaturas posteriores usam exatamente esses nomes.

- `ResultadoEmail<T> = {ok:true;valor:T}|{ok:false;motivo:MotivoEmail}`.
- `MotivoEmail`: `sem_permissao|nao_encontrado|dados_invalidos|desatualizada|cota_excedida|pausada_pelo_gestor|integracao_indisponivel|contato_indisponivel|resultado_incerto|chave_reutilizada|atendimento_em_andamento`.
- `EstadoCampanha = rascunho|agendada|em_andamento|pausada|encerrada|cancelada`.
- `CategoriaEmail = prospeccao|teste|confirmacao|catalogo`.
- `FiltrosPublico = {cnaes:string[];uf:string|null;municipios:string[];porte:string|null;somenteComEmail:true}`. São nomes internos; E2.1 mapeia somente os filtros comprovadamente suportados pelo fornecedor.
- `DadosPublico = {id:string|null;nome:string;filtros:FiltrosPublico}`.
- `DadosModelo = {id:string|null;nome:string;assunto:string;corpo:string;compartilhado:boolean}`.
- `DadosCatalogo = {id:string|null;titulo:string;edicao:string;url:string;interesses:string[]}`.
- `DadosCampanha = {id:string|null;nome:string;publicoId:string;catalogoId:string;modeloId:string|null;assunto:string;corpo:string}`.
- `CampanhaResumo = {id:string;nome:string;vendedorId:string;estado:EstadoCampanha;versao:number;pausaGestor:boolean;agendadaPara:string|null}`.
- `LimitesEmail = {empresasMes:number;destinatariosCampanha:number;enviosDia:number;protecaoDias:number}`; `protecaoDias` começa em 7, demais valores começam em 0.
- `DestinatarioEmail = {id:string;campanhaId:string|null;email:string;cnpj:string|null;empresaId:string|null;nomeEmpresa:string|null;nomeContato:string|null;telefone:string|null}`.
- `ConteudoEmail = {assunto:string;texto:string;html:string}`.
- `CapacidadesEmail = {entrega:boolean;falha:boolean;denuncia:boolean;descadastro:boolean;abertura:boolean;clique:boolean;resposta:boolean;idempotencia:boolean}`.
- `PedidoEnvio = {operacaoId:string;categoria:CategoriaEmail;destinatario:DestinatarioEmail;conteudo:ConteudoEmail;remetente:string;responderPara:string;cabecalhos:Record<string,string>}`.
- `ResultadoEnvio = {tipo:'aceito';idExterno:string}|{tipo:'recusado';codigo:string;repetivel:boolean;tentarApos:string|null}|{tipo:'incerto'}`.
- `EventoEmail = {id:string;idExterno:string;tipo:'entrega'|'falha'|'denuncia'|'abertura'|'clique'|'resposta'|'descadastro';em:string}`.
- `PoliticaProvedorEmail = {contaId:string;limiteJanela:number|null;janelaSegundos:number|null;intervaloMinimoMs:number|null}`; valores confirmados do contrato do serviço e compartilhados por conta de transporte, inclusive quando houver vários remetentes.
- `AdaptadorEmail = {politica:PoliticaProvedorEmail;capacidades:CapacidadesEmail;enviar(p:PedidoEnvio):Promise<ResultadoEnvio>;autenticarEvento(corpo:Uint8Array,cabecalhos:Headers):Promise<ResultadoEmail<EventoEmail[]>>}`.
- `ReferenciaTokenEmail = {id:string;nonce:string;finalidade:'origem'|'adesao'|'preferencias'|'descadastro';hash:string}`.
- `TrabalhoEmail = {id:string;concessao:string;pedido:PedidoEnvio;expiraEm:string;tokens:ReferenciaTokenEmail[]}`. Antes de E4, `tokens` é vazio e a operação de marketing continua desabilitada.
- `DadosAdesao = {email:string;interesses:string[];origemToken:string|null;versaoTexto:string}`; `PreferenciasCatalogo = {interesses:string[];frequencia:'mensal';pausada:boolean}`.
- `FiltroGestaoEmail = {de:string;ate:string;vendedorId:string|null;publicoId:string|null;campanhaId:string|null}`.

Os contratos de repositório nunca aceitam autor vindo do formulário: a identidade é obtida de `exigir` e confirmada no SQL. Funções do executor recebem trabalho e concessão, sem escolher arbitrariamente outro usuário.

## Decisões de integração antes da etapa correspondente

**Serviço de email, antes de E3.1:** registrar em `docs/operacao/email.md` o serviço escolhido, documentação primária vigente, compatibilidade com a origem dos leads, autenticação, remetentes, limites, idempotência e eventos. É necessário um serviço real; SMTP genérico não fornece automaticamente confirmação de entrega. O usuário confirmou email com domínio próprio hospedado na Hostinger. Confirmar no hPanel o produto e plano ativos (Hostinger Mail, Titan, cPanel ou Workspace), sem inferir isso apenas da marca da hospedagem. A hospedagem confirmada não define o transporte das campanhas: Hostinger Mail permite newsletters solicitadas dentro dos limites e proíbe destinatários sem opt-in. Email obtido somente no CNPJ.biz não comprova esse aceite; não selecionar automaticamente essas caixas para a prospecção. O transporte das campanhas continua sujeito à validação da origem dos leads e às capacidades documentadas. A recorrência segue a adesão explícita da E4. O gestor cadastra a caixa real de resposta de cada vendedor e a institucional; o serviço de transporte pode ser diferente da hospedagem dessas caixas. Até a escolha, E1 e E2 podem ser executadas e a produção permanece sem envio habilitado.

Fontes de integração conferidas em 19/10/2026: [política de campanhas da Hostinger](https://www.hostinger.com/support/1583510-is-mass-mailing-supported-at-hostinger/), [identificação do produto no hPanel](https://www.hostinger.com/support/5832752-how-to-check-the-email-service-included-in-your-hosting-plan-at-hostinger/) e [limites do Hostinger Mail](https://www.hostinger.com/support/4625828-parameters-and-limits-of-hostinger-email/). No Hostinger Mail a janela diária é móvel de 24 horas por caixa; aliases da mesma caixa compartilham sua franquia. Os valores efetivos devem ser conferidos no painel; não ativar cotas pelo máximo de uma tabela pública.

**Cobrança CNPJ.biz, antes de E2.1:** conferir o contrato vigente de filtros, paginação e consumo. O limite interno mede empresas solicitadas; não inventar um endpoint de saldo ou prometer teto em reais sem contrato comprovado.

**Hospedagem do executor, antes de ativar E3:** o código é um CLI Node 24 com credencial técnica própria. Escolher com o usuário onde rodará continuamente ou qual agendador o chamará. Rodada manual e simulador local são verificáveis sem contratar infraestrutura; não equivalem a recorrência ativa em produção.

Credenciais operacionais ficam em env na primeira versão. O gestor vê estado, capacidades e teste da conexão, além de configurar limites, identidade e suspensão no CRM. O plano não cria um cofre de segredos cifrados no banco.

## Verificação e entrega

Cada tarefa tem comandos focados. No encerramento de cada entrega: `npm run typecheck`, `npm run lint`, `npm run db:checar`, testes unitários e integrações afetadas, `npm run test:inventario`. No encerramento da feature: suítes completas, build sem secrets e `npm run test:e2e`.

Os testes usam exclusivamente o harness local de `tests/integracao/ajuda.ts`. Não executar integrações contra Railway. O runner E2E usa seu banco descartável e porta 3100, conservando a instância habitual na 3000.

Baseline conhecido de planejamento: `src/docs.test.ts` falha por um CR no arquivo local não versionado `CONTINUIDADE-CODEX.md`. O novo documento de especificação passou isoladamente. Preservar esse arquivo; registrar a distinção entre teste do escopo e suíte local completa, sem ignorar silenciosamente uma falha.

## Revisão do próprio plano

- [x] Os requisitos da spec estão mapeados às cinco entregas e aos contratos acima.
- [x] Captura sem telefone preserva destinatário sem criar empresa inválida.
- [x] Público salvo permanece separado do Funil e de posse comercial.
- [x] Cotas, concessões, eventos, adesão e papéis técnicos têm testes negativos e de concorrência.
- [x] Provedor e hospedagem pendentes estão limitados às tarefas que realmente dependem deles.
- [x] Nenhuma tarefa exige serviço pago, disparo real ou migração remota sem autorização correspondente.
- [x] O executor lê este plano, a spec e o subplano da entrega; não reabre decisões aprovadas.
