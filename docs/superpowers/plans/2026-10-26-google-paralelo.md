# Coleta Google simultânea por vendedor: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. O usuário escolheu execução nativa nesta conversa, com revisão independente do conjunto no final; não solicitar novamente o método.

**Goal:** Atender até três vendedores simultaneamente com planejamento próprio, workflow único, exclusividade global e retomada segura, reportando falta de RAM sem fallback sequencial.

**Architecture:** Uma migração permite até três execuções abertas, limitadas por vendedor e executor. Três motores isolados alimentam um coordenador local determinístico que reutiliza os comandos atuais; o agente existente realiza o arquivamento pelo Google Drive conectado e devolve comprovantes correlacionados. Journal e intenções preservam identidades entre quedas.

**Tech Stack:** Node.js 24, TypeScript/tsx, Python 3 com biblioteca padrão, PowerShell, Docker Desktop/WSL, scraper gosom v1.18.1, PostgreSQL, Vitest e n8n existente. Nenhuma dependência nova.

**Spec:** [Desenho aprovado em 26/10/2026](../specs/2026-10-26-google-paralelo-design.md).

## Global Constraints

- Checkout: `C:\Users\ADM\.codex\worktrees\crm-redesign\crm`, branch `codex/redesign-crm`, PR #55. O checkout primário pertence a outro trabalho. Não preparar `.superpowers`, `.env*` ou `.google-agente` no Git.
- Até três execuções abertas; uma por vendedor, uma por executor e uma por pedido. Autoridade no banco/RLS; sem escrita direta de aplicação nessas tabelas.
- Por vendedor/data: até 50 entregues, três lotes de até 50 candidatas, até 150 distintas analisadas. Consumir pool antes de nova coleta; parar por meta, orçamento ou ausência de novidades. Não ampliar nicho/região.
- Segunda a sexta às 17h em America/Sao_Paulo; sexta prepara segunda. Vendedor preenche o próprio plano; dia Não definido não roda; bairro vazio cobre a cidade inteira. Não mudar regras de edição ou sincronização.
- Manter executores e intenções existentes na posição 01, com estado em `.google-agente`. Posições 02 e 03 usam `.google-agente/slots/02` e `.google-agente/slots/03`.
- Motores: `gmaps-mooca-prospeccao` em 127.0.0.1:8087, `gmaps-crm-motor-02` em 8088, `gmaps-crm-motor-03` em 8089. Não substituir o primeiro container nem seus volumes.
- Imagem `gosom/google-maps-scraper@sha256:e205c02913c5a69c16fc2094b8e5b194a2f655166d2c1126d50548d216e6b1b2`; cada motor com `-web -data-folder /gmapsdata -c 2`, CPU 2, memória 2 GiB, swap total 2,5 GiB, pids 512 e shm 64 MiB.
- Exigir 5.632 MiB disponíveis no Windows antes de novas admissões/ondas. Abaixo de 512 MiB durante coleta, suspender novas admissões e alertar. Falha de medição bloqueia admissão com motivo próprio. Sem fallback sequencial, fechamento automático de programas ou remoção de jobs.
- V1 roda sozinho no motor 01; não converter recibos legados. Snapshots, posse, carteira, reserva, dados manuais e CNPJ.biz permanecem protegidos. Vendedores continuam vendo apenas nome/função de sócios.
- Workflow único `gITBY7vBYNfgUWMp`; sem critérios adicionais, zero HTTP de verificação. Qualificador de produtos/tipo/observações continua pendente. Nenhuma mensagem, consulta CNPJ paga ou plano real criado pelo executor para testar.
- Drive mantém pasta raiz `11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh`, permissões, CSV original de nove colunas, JSON de verificação, CSVs brutos e conferência por download/bytes/SHA256. Tokens e URLs temporárias nunca entram no journal, argumentos ou logs. O JSON de verificação é obrigatório para V2; V1 conserva o CSV final e os comprovantes do seu contrato.
- Antes de editar scripts usados pela rotina ativa, salvar a configuração e pausar a mesma automação pela ferramenta oficial; isso impede execução sobre código parcial. Código publicado, banco e reativação continuam condicionados à revisão independente. Não mover a pasta de estado do motor 01.
- TDD antes de código de produto; migrações 0041–0044 imutáveis; atualizar encaminhamentos de docs conforme R-015. Guardar backup e concluir revisão independente antes de alterar produção.

## Review Focus

1. Resposta perdida depois de reservar, criar job ou subir arquivo: retomar a mesma identidade sem outro POST cego. Testes nas tarefas 3, 5 e 6.
2. Dois coordenadores ou PID reutilizado durante espera pelo Drive: só um processo admite trabalho e nenhum comprovante libera outra posição. Testes nas tarefas 4 e 6.
3. Quarto vendedor, gestor errado e vendedor com espelho pendente: máximo de três, retomada privada e progresso dos pedidos sincronizados. Testes na tarefa 1.
4. CNPJ/Place ID/contato repetido em entregas simultâneas: uma distribuição global, sem sobrescrever cadastro ou transferir carteira/reserva. Testes na tarefa 1.
5. RAM cai depois de iniciar os motores ou uma resposta do workflow chega fora de ordem: preservar iniciado, suspender novas coletas e manter as outras posições independentes. Testes nas tarefas 4, 5 e 6.

## Estrutura e contratos compartilhados

Separar configuração, posse do processo, pipeline de um pedido e entrada do coordenador. Novos arquivos não importam outra feature a partir de `features/`. Os módulos abaixo são de scripts; não devem executar coletas só por serem importados.

- `scripts/google/motores.json`: registro versionado dos motores e limites, sem credenciais.
- `scripts/google/motores.mts` e `motores.ps1`: leitura/validação e preparação idempotente da infraestrutura.
- `scripts/google/motores.py`: leitura do mesmo registro e locks da ponte Python.
- `scripts/google/coordenador-tipos.mts`: contratos locais descritos abaixo; reusar `CriteriosGoogle` e `ContextoVerificacoes` existentes.
- `scripts/google/coordenador-estado.mts` e `host.ps1`: journal, exclusão do coordenador, identidade de processo e RAM do host.
- `scripts/google/arquivos.mts`: originais dos lotes, manifestos de arquivamento, correlação e conferência dos comprovantes; nenhuma credencial Drive.
- `scripts/google/fluxo.mts`: pipeline de um pedido pelos comandos existentes, sem conhecer o conector Drive.
- `scripts/google/coordenar.mts`: única entrada executável, inicia até três pipelines, emite solicitações de Drive e recebe confirmações.

Tipos centrais em `coordenador-tipos.mts`:

```ts
type MotorId = '01' | '02' | '03'
type Motor = { id: MotorId; container: string; origem: string; pastaEstado: string }
type Vinculo = { motor: MotorId; executor: string; pedido_id: string; execucao_id: string; vendedor_id: string; revisao: number; snapshot_sha256: string }
type EtapaLocal = 'retomar' | 'coletar' | 'selecionar' | 'reservar' | 'verificar' | 'arquivar' | 'entregar' | 'concluir' | 'pendente' | 'concluido'
type VinculoLegado = { motor: '01'; executor: string; pedido_id: string; vendedor_id: string }
type Associacao = { contrato: 2; vinculo: Vinculo } | { contrato: 1; vinculo: VinculoLegado }
type Posicao = { motor: MotorId; associacao: Associacao | null; etapa: EtapaLocal; contexto: string | null; lote: string | null; coleta: number; motivo: string | null }
type Journal = { versao: 1; ciclo_id: string; dono: { pid: number; inicio: string }; posicoes: Posicao[]; admissaoSuspensa: boolean }
type ArquivoLocal = { tipo: 'original' | 'resultado' | 'bruto'; caminho: string; nome: string; bytes: number; sha256: string }
type SolicitacaoDrive = { associacao: Associacao; solicitacao_id: string; lote_id: string | null; pastaPai: string; pastaNome: string; arquivos: ArquivoLocal[] }
type ComprovanteDrive = { associacao: Associacao; solicitacao_id: string; lote_id: string | null; pasta_id: string; arquivos: { tipo: ArquivoLocal['tipo']; nome: string; id: string; pasta_id: string; bytes: number; sha256: string; downloadConferido: true }[] }
type MedicaoRam = { ok: true; disponivelMiB: number; instante: string } | { ok: false; motivo: 'medicao_indisponivel' }
```

Vinculo usa UUIDs, revisão positiva e SHA256 de 64 hex. Associação V1 aceita somente motor 01 e lote nulo; não recebe revisão, execução ou hash inventado. Associação V2 precisa coincidir com o motor da posição. Caminhos ficam dentro das raízes conhecidas de estado/campanha; não aceitar nomes do Google ou de células como caminho. Comprovante é validado integralmente; `downloadConferido` não dispensa a conferência real de bytes na tarefa 6. Pedido V1 tem seu próprio caminho legado; não preencher com IDs ou hashes inventados para caber no tipo V2.

---

### Task 1: Fila atômica de três vendedores com compatibilidade legada

**Files:** Create `db/migracoes/0045_google_execucoes_paralelas.sql`, `docs/db/0045.md`, `tests/integracao/google-paralelo.test.ts`. Modify `docs/db/0041.md`, `docs/db/0042.md`, `tests/integracao/google-agentes.test.ts`. Ler primeiro os coordenadores de 0041/0042 e os testes de rodadas/entrega direta.

**Interfaces:** Consumes `google_coordenar_em(uuid,timestamptz)`, `google_agente_proximo(uuid)` e `google_execucao_validar(uuid,uuid,boolean)`. Produces as mesmas assinaturas e formato `{pedido,ocupado?,sincronizar?}`; nenhum novo parâmetro para escolher vendedor/data. `google_execucao.vendedor_id uuid NOT NULL` é ligado por FK composta `(pedido_id,vendedor_id)` ao plano; unicidade aberta por executor/vendedor e limite três dentro do lock `(40,1)`.

- [x] **Step 1: Escrever testes que falham no contrato atual.** Criar quatro vendedores com planos definidos e sincronizados no banco isolado. Reivindicar em conexões independentes com `Promise.all`: três pedidos diferentes, quarta resposta ocupada, três execuções abertas. Mesmo executor retoma ID/snapshot; gestor diferente e executor errado não assumem. Marcar uma posição falhou e provar que as outras continuam. Pedido antigo não sincronizado deve deixar os dois sincronizados progredirem.

Teste principal no novo arquivo, usando helper privado `reivindicar(executor: string)` com os quatro planos fixture da tarefa:

```ts
test('admite tres vendedores e recusa a quarta reivindicacao concorrente', async () => {
  const respostas = await Promise.all(executores.map(id => reivindicar(id)))
  expect(respostas.filter(r => r.pedido)).toHaveLength(3)
  expect(respostas.filter(r => r.ocupado)).toHaveLength(1)
  expect(new Set(respostas.flatMap(r => r.pedido ? [r.pedido.vendedor_id] : [])).size).toBe(3)
})
```
- [x] **Step 2: Rodar RED.** `npm run test:integracao -- tests/integracao/google-paralelo.test.ts`. Esperado: falhar por admitir somente um pedido; guardar essa saída. O harness `criarBancoDeTeste` exige host local; não carregar `.env.railway.local`.
- [x] **Step 3: Implementar a migração e compatibilidade.** Backfill do vendedor, FK composta, substituir singleton, atualizar inserção V1 e seleção V2. Retomar próprio executor antes de contar vagas; não iniciar V1 com V2 aberta nem V2 com pendência V1 elegível. Reusar autorização, ordem de locks e snapshot existentes. Não conceder função nova ou escrita direta. Atualizar o teste antigo que presume singleton para o novo contrato, mantendo casos V1 solo e de retomada.
- [x] **Step 4: Acrescentar controles negativos de concorrência.** Tentar FK vendedor/pedido divergente, duas execuções abertas do mesmo vendedor, quarta execução e dois gestores. Concluir e entregar simultaneamente candidatas com CNPJ, Place ID e contatos sobrepostos: `count(DISTINCT vendedor_id)` por empresa entregue deve ser 1; dados manuais e vínculo anterior de carteira/reserva devem permanecer. As barreiras do teste precisam produzir concorrência real, sem sleeps como prova. Manter lock `(27,1)` da distribuição.
- [x] **Step 5: Rodar GREEN e regressões.** `npm run db:checar` e `npm run test:integracao -- tests/integracao/google-paralelo.test.ts tests/integracao/google-agentes.test.ts tests/integracao/google-criterios-rodadas.test.ts tests/integracao/google-entrega-direta.test.ts`. Esperado: zero falhas. Conferir papel/GRANT com invariantes existentes. Documentar objetos alterados e encaminhamentos.
- [x] **Step 6: Commit.** Conferir branch com interrupção explícita se não for `codex/redesign-crm`, preparar somente arquivos desta tarefa e commitar `feat: permitir tres execucoes Google por vendedor`.

### Task 2: Registro confiável e preparação dos três motores

**Files:** Create `scripts/google/motores.json`, `scripts/google/motores.mts`, `scripts/google/motores.ps1`, `scripts/google/coordenador-tipos.mts`, `src/google-motores.test.ts`. Modify `docs/operacao/agente-google-crm.md` somente na seção de instalação. Ler a configuração Docker existente e os recursos realmente presentes antes de preparar qualquer container.

**Interfaces:** Produces `carregarMotores(arquivo?: string): Promise<readonly Motor[]>` e CLI PowerShell `motores.ps1 -Acao Conferir|Preparar`. O registro contém `versao:1`, a imagem/limites globais e as três entradas `Motor`, mais volumes explícitos. Nomes novos de dados: `crm_google_motor02_data` e `crm_google_motor03_data`; motor 01 preserva `mooca-prospeccao_gmaps_data` e cache `mooca-prospeccao_gmaps_cache`. Cache compartilhado RW pré-aquecido pela mesma imagem, com `PLAYWRIGHT_BROWSERS_PATH=/opt/browsers` e `PLAYWRIGHT_DRIVER_PATH=/opt/ms-playwright-go`.

- [x] **Step 1: Escrever testes de configuração e comandos.** Exigir três IDs/portas únicos, origens exatas em loopback, digest fixado e limites do Global Constraints. Um servidor remoto, URL com credenciais, imagem diferente, volume de dados compartilhado ou container divergente devem falhar sem comandos destrutivos. Simular Docker por executável fixture, registrando argumentos; preparação repetida deve preservar IDs/volumes e não executar `rm`, `down -v` ou recriação do 01.

```ts
test('registro preserva os tres motores e suas pastas', async () => {
  expect((await carregarMotores()).map(m => [m.id, m.origem, m.pastaEstado])).toEqual([
    ['01', 'http://127.0.0.1:8087', '.google-agente'],
    ['02', 'http://127.0.0.1:8088', '.google-agente/slots/02'],
    ['03', 'http://127.0.0.1:8089', '.google-agente/slots/03'],
  ])
})
```
- [x] **Step 2: Rodar RED.** `npm run test:unit -- src/google-motores.test.ts`; falha por módulo/registro ausente.
- [x] **Step 3: Implementar registro e preparação.** Validar antes de produzir efeitos. Ajustar limites do motor 01 só ocioso, criar somente os dois volumes/containers novos, bind em 127.0.0.1, conferir imagem/cache antes de jobs. `Conferir` é somente leitura. Conflito ou ausência de prewarm confirmado impedem admissão. PS deve resolver caminhos absolutos e não interpolar argumentos em comando de shell.
- [x] **Step 4: Rodar GREEN.** Repetir o teste; executar `motores.ps1 -Acao Conferir` em Windows e guardar diagnóstico sanitizado. A tarefa não autoriza ligar três coletas nem mudar a automação.
- [x] **Step 5: Commit.** Guard de branch e commit explícito dos arquivos da tarefa: `feat: registrar motores Google isolados`.

### Task 3: Ponte Python com associação imutável ao motor

**Files:** Create `scripts/google/motores.py`, `scripts/google/test_motores.py`. Modify `scripts/google/coletar.py`, `scripts/google/test_coletar.py`; o wrapper `src/google-agente-python.test.ts` já descobre `test_*.py`.

**Interfaces:** Consumes o registro da tarefa 2. Produces `carregar_motor(motor_id: str = '01') -> dict`, `travar_motor(motor: dict, pasta_estado: Path)` como context manager e `coletar(pedido: dict, campanha: str, motor_id: str = '01') -> Path`. `carregar_coletor`/`conferir_conexao` recebem o mesmo `motor_id` opcional; CLI acrescenta `--motor 01|02|03`. Não alterar ações/argumentos atuais.

- [x] **Step 1: Escrever testes de isolamento e incerteza.** Três processos fixture com motores diferentes entram em coleta antes de qualquer um ser liberado; dois no mesmo motor ou mesma execução não entram. Arquivo antigo sem motor aceita somente 01; divergência bloqueia antes de HTTP. `/jobs` com status 200 e JSON null resulta em zero jobs; objeto/string/status inválido continua erro. POST perdido deixa intenção; retomada não envia outro POST. Logs/downloads usam o motor/job gravados.

```python
def test_motor_fora_do_registro_nao_chega_ao_http(self):
    with self.assertRaises(ValueError):
        carregar_motor('04')
```
- [x] **Step 2: Rodar RED.** `python -X utf8 -B -m unittest discover -s scripts/google -p test_*.py`. Esperado: ausência de módulo/opção/isolamento.
- [x] **Step 3: Implementar locks e configuração.** Resolver origem/container do registro confiável, persistir motor na intenção/contexto/job, usar lock por motor e execução em V2. Preservar lock da campanha no 01 para compatibilidade manual/V1, sem bloquear 02/03. Uma configuração de módulo por subprocesso; não usar threads compartilhando `CONFIG`. Não apagar lock de processo vivo ou job para repetir criação.
- [x] **Step 4: Rodar GREEN.** Comando Python acima e `npm run test:unit -- src/google-agente-python.test.ts`. Esperado: testes atuais e novos passando, zero acesso ao Google real. Confirmar que importar os módulos não faz rede/coleta.
- [x] **Step 5: Commit.** Guard de branch e `feat: isolar coleta e retomada por motor Google`.

### Task 4: Journal, exclusão de processo e política de RAM

**Files:** Create `scripts/google/coordenador-estado.mts`, `scripts/google/host.ps1`, `src/google-coordenador-estado.test.ts`. Modify `coordenador-tipos.mts` somente para exportar os contratos listados.

**Interfaces:** Produces `lerJournal(pasta: string): Promise<Journal | null>`, `salvarJournal(pasta: string, journal: Journal): Promise<void>`, `medirRam(): Promise<MedicaoRam>`, `admitirOnda(medicao: MedicaoRam): {ok:true} | {ok:false;motivo:'ram_insuficiente'|'medicao_indisponivel'}`, e `obterExclusao(pasta: string): Promise<{liberar():Promise<void>}>`. `host.ps1 -Acao Memoria` devolve somente medição/instante; `-Acao Processo -PidAlvo <id>` devolve PID/início UTC ou ausência, sem linha de comando/env.

Escolha técnica de exclusão: listener TCP sem protocolo em `127.0.0.1:8096`, mantido pelo processo do coordenador inclusive durante espera pelo Drive. Destruir conexões recebidas sem executar comandos. Porta ocupada impede início; nunca encerrar seu dono. Journal guarda PID/início do proprietário; para recuperar pendência, comprovar término ou PID com início diferente. Erro de inspeção mantém bloqueio. O socket é liberado pelo SO após queda; não existe expiração de lock por idade. CI testa com porta efêmera injetada no módulo, nunca configurável pelo planejamento.

- [x] **Step 1: Escrever testes de exclusão/recuperação.** Dois processos reais disputam a mesma porta: um adquire, outro falha antes de comandos do CRM. Mesmo durante solicitação Drive a exclusão persiste. Simular PID reutilizado, processo vivo, inspeção impossível e duas retomadas concorrentes: somente o dono validado prossegue; journal/UUIDs nunca são recriados para escapar de pendência. Escrita interrompida não substitui journal válido por JSON parcial.
- [x] **Step 2: Escrever testes de RAM.** `admitirOnda({ok:true,disponivelMiB:5631,...})` falha com `ram_insuficiente`; 5632 passa; falha de medição tem motivo próprio. Monitoramento em 511 MiB suspende nova admissão, preserva posições e não chama kill/restart/limpeza. Uma única medição admite a onda inteira, sem testar de novo depois de iniciar só o primeiro motor.

```ts
test('5632 MiB e o limiar sem fallback sequencial', () => {
  expect(admitirOnda({ ok: true, disponivelMiB: 5631, instante: '2026-10-26T20:00:00Z' })).toEqual({ ok: false, motivo: 'ram_insuficiente' })
  expect(admitirOnda({ ok: true, disponivelMiB: 5632, instante: '2026-10-26T20:00:00Z' })).toEqual({ ok: true })
  expect(admitirOnda({ ok: false, motivo: 'medicao_indisponivel' })).toEqual({ ok: false, motivo: 'medicao_indisponivel' })
})
```
- [x] **Step 3: Rodar RED.** `npm run test:unit -- src/google-coordenador-estado.test.ts`; falta dos contratos deve ser a causa inicial.
- [x] **Step 4: Implementar o módulo.** Escrita atômica de journal versionado, validação de caminhos/associação e probe Windows por argumentos fixos. Linux usa somente probe de processo para testes; operação de coleta é Windows. Se a medição real não estiver disponível, bloquear em vez de assumir RAM livre. Intervalo de monitoramento de RAM: 5 segundos enquanto houver coleta ativa.
- [x] **Step 5: Rodar GREEN.** Repetir teste e executar o probe somente leitura no Windows; verificar que saída não contém nomes de programas, tokens ou linhas de comando.
- [x] **Step 6: Commit.** Guard de branch e `feat: proteger coordenador Google com journal e RAM`.

### Task 5: Pipeline de um pedido e contrato de arquivamento

**Files:** Create `scripts/google/fluxo.mts`, `scripts/google/arquivos.mts`, `src/google-fluxo.test.ts`, `src/google-arquivos.test.ts`. Modify `coordenador-tipos.mts`. Reusar `agente.mts`, `rodadas.py`, `coletar.py preparar` e `conferirRetornoVerificacoes`; não copiar suas regras de domínio.

**Interfaces:** Produces `executarPedido(posicao: Posicao, deps: DependenciasFluxo): Promise<Posicao>` e `prepararArquivamento(associacao: Associacao, lote: string | null, brutos: string[]): Promise<SolicitacaoDrive>`. `conferirComprovante(solicitacao: SolicitacaoDrive, comprovante: unknown): ComprovanteDrive` valida sem efeitos de rede. `DependenciasFluxo` contém `comando(programa:'node'|'python', args:readonly string[]):Promise<string>`, `admitirColeta(posicao:Posicao):Promise<boolean>`, `arquivar(s:SolicitacaoDrive):Promise<ComprovanteDrive>`, `persistir(p:Posicao):Promise<void>`. O coordenador fornece essas quatro funções; argumentos de filhos não incluem tokens.

- [x] **Step 1: Escrever testes de etapas e budgets.** Servidores/filhos fixture devem observar reservar antes de verificar e arquivar antes de entregar. Testar pool com mais de 50, três lotes/150 distintas, meta 50, pool vazio e coleta complementar sem novidade. Recibo perdido deve repetir exatamente o mesmo corpo/UUID, sem outro job ou revalidação. Parar pela resposta do servidor, sem inventar contadores. Falha em uma posição não modifica estado das outras. Acrescentar fixture V1 com recibo/CSV final legados e provar que só usa motor 01, sem UUID/hash V2 fabricados e sem outro pipeline ativo.
- [x] **Step 2: Escrever testes dos arquivos.** CSV tem exatamente `telefone,cnpj,razao_social,nome_fantasia,contato_nome,email,cep,cnae_principal,google_place_id`, UTF-8 BOM, CRLF e aspas. Hash/bytes correspondem ao arquivo real. Comprovante de outro pedido/execução/lote, arquivo extra ou ausente, nome/pasta/hash divergente, ID repetido e sinal atrasado não autorizam publicação. Coleta sem novas candidatas também preserva bruto e pedido de arquivamento com `lote_id:null`, sem criar lote vazio.

Nomear o controle negativo `comprovante de outra solicitacao nao libera entrega`. Com fixtures locais válidas `solicitacao` e `comprovante`, a asserção é:

```ts
expect(() => conferirComprovante(solicitacao, { ...comprovante, solicitacao_id: outroUUID })).toThrow()
expect(conferirComprovante(solicitacao, comprovante)).toEqual(comprovante)
```
- [x] **Step 3: Rodar RED.** `npm run test:unit -- src/google-fluxo.test.ts src/google-arquivos.test.ts`.
- [x] **Step 4: Implementar pipeline fino.** Persistir antes dos efeitos, invocar os comandos existentes com arrays de argumentos, caminhos confinados e mesmos IDs na retomada. Criar originais específicos do lote reservado, não reaproveitar o CSV dos primeiros 50 para um segundo lote. Recibo V2 usa IDs reais confirmados do Drive e JSON exato de verificação. Reutilizar decisões de `rodadas.py` para parar; V1 segue exclusivamente o caminho legado 01, sem fabricar recibo V2.
- [x] **Step 5: Rodar GREEN e regressão do CLI.** Testes da etapa e `npm run test:unit -- src/google-coordenador.test.ts src/google-agente-python.test.ts src/server/google/verificacoes/cliente.test.ts`. Esperado: zero falhas e zero chamadas externas reais.
- [x] **Step 6: Commit.** Guard de branch e `feat: coordenar etapas e comprovantes por vendedor`.

### Task 6: Coordenador simultâneo, Drive conectado e workflow único

**Files:** Create `scripts/google/coordenar.mts`, `scripts/google/conferir-drive.mts`, `src/google-pool.test.ts`, `src/google-drive-comprovante.test.ts`. Modify `src/server/google/verificacoes/workflow-basico.test.ts`, `docs/operacao/agente-google-rotina.md`, `docs/operacao/agente-google-crm.md`, `workflows/n8n/google/README.md`. Alterar JSON do workflow somente se testes demonstrarem estado compartilhado; preservar os nós da planilha.

**Interfaces:** CLI `node --env-file=.env.google-agente.local --import tsx scripts/google/coordenar.mts rodar|retomar --campanha <caminho> --pasta .google-agente`. `rodar` recusa journal pendente; `retomar` mantém ciclo/identidades. Emite JSON por linha: `{evento:'arquivar',solicitacao:<caminho absoluto>}` ou diagnóstico sanitizado. Recebe por stdin `{acao:'confirmar_arquivo',solicitacao_id:string,comprovante:string}`; o arquivo comprovante deve passar `conferirComprovante`. A confirmação é roteada pela solicitação pendente, não pela última posição ativa.

`conferir-drive.mts --solicitacao <arquivo> --saida <arquivo>` recebe somente por stdin privado, com eco desativado, IDs/metadados/URLs temporárias do conector. Faz download HTTPS sem redirecionar, com limite de bytes previsto e hash, e grava `ComprovanteDrive` sem URLs. Aceita só origem temporária do provedor confirmada no conector e metadados da solicitação; falha fechada se o provedor mudar. Não criar autenticação Google paralela.

- [x] **Step 1: Escrever teste de pool com três pipelines reais contra fixtures.** Três coletas precisam ter entrado antes de liberar a barreira. Máximo ativo 3, mesmo vendedor nunca repetido. Uma posição recebe erro enquanto duas concluem. RAM inicial 5631 implica zero chamadas `proximo`/POST de job; queda a 511 depois da partida preserva jobs e impede novas ondas. Menos de três planos elegíveis não gera vendedor fictício.
- [x] **Step 2: Escrever teste de Drive/retomada.** Solicitações chegam fora de ordem; confirmação cruzada, duplicada e antiga não libera outro lote. Queda entre upload e sinal conserva intenção e somente reconcilia. Helper rejeita link fora do provedor, redirecionamento, bytes/hash/metadados divergentes e URLs na saída. Simular download com bytes fixos; no teste não baixar dados reais. Journal pendente é atendido antes de `proximo` para outra empresa.
- [x] **Step 3: Escrever teste do grafo real único.** Executar três contextos diferentes simultaneamente no harness do workflow, com respostas fora de ordem e uma falha. Pedido/execução/lote/revisão/hash retornam ao contexto correto; campos diferentes combinam E e opções internas OU. Critérios neutros fazem zero HTTP. Comparar os nós/conexões da planilha antes/depois se houver alteração no JSON.

Nomear o teste de barreira `tres coletas entram antes de liberar a primeira`; com filhos fixture bloqueados e contador observável, as asserções antes/depois da liberação são:

```ts
expect(entradasAntesDeLiberar).toBe(3)
expect(maximoDeColetasAtivas).toBe(3)
expect(resultado.posicoes.filter(p => p.etapa === 'concluido')).toHaveLength(2)
expect(resultado.posicoes.filter(p => p.etapa === 'pendente')).toHaveLength(1)
```
- [x] **Step 4: Rodar RED.** `npm run test:unit -- src/google-pool.test.ts src/google-drive-comprovante.test.ts src/server/google/verificacoes/workflow-basico.test.ts`.
- [x] **Step 5: Implementar entrada e handoff.** Manter a exclusão da tarefa 4 durante todo o ciclo, filas de solicitações Drive correlacionadas e até três pipelines independentes. Agrupar admissões de coleta por onda, checar RAM antes de reivindicar novos pedidos e antes de novos jobs. Não abortar pipeline saudável por falha de outro. Coordenador não encerra subprocesso com job confirmado para contornar baixa RAM. Preservar subprocessos/intenções quando o resultado for desconhecido.
- [x] **Step 6: Atualizar instruções da rotina.** Agente chama um único coordenador; atende pedidos Drive e sinais sem comandar novas coletas por fora. Registra intenção exclusiva antes de criar pasta/arquivo, reencontra os mesmos em resposta perdida, confere download e entrega o comprovante. Relatório por vendedor inclui revisão, candidatas, entregues/repetidas/recusadas, motivo e links confirmados. Estado inalterado fica silencioso. RAM insuficiente ou falha nova avisa. Não criar outra automação.
- [x] **Step 7: Rodar GREEN.** Testes desta tarefa e da tarefa 5, teste do ramo da planilha `src/server/google/planilha/workflow-planilha.test.ts` e `npm run typecheck`. Fixture deve terminar com três recibos corretos ou pendências explicitamente atribuídas, sem arquivos/IDs misturados.
- [x] **Step 8: Commit.** Guard de branch e `feat: executar pool Google com tres posicoes isoladas`.

### Task 7: Verificação completa, revisão independente e ativação controlada

**Files:** Modify `docs/operacao/agente-google-crm.md`, `docs/operacao/producao-vercel.md` e o plano para registrar resultados reais. Atualizações externas limitadas à migração nova, deployment correspondente, motores e mesma automação. Não alterar o checkout primário.

**Interfaces:** Consumes os comandos das tarefas anteriores, runner `scripts/db/aplicar.mts`, backup `scripts/backup/executar.mts`, automação existente `prospec-o-de-armarinhos-e-variedades` e o projeto Vercel já vinculado. Produces comprovantes privados de versões, backup, invariantes, implantação e estado da automação. Documentação pública registra somente IDs não secretos e limites da validação.

- [x] **Step 1: Rodar checks finais.** `npm run db:checar`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integracao`, `npm run build:e2e`, `npm run test:e2e -- --sem-build` e `git diff --check`. Usar banco local e fixtures. Não repetir o ensaio pesado isolado sem nova necessidade técnica.
- [x] **Step 2: Revisão independente do incremento.** Revisor novo, somente leitura, recebe spec, plano, diff e resultados; revisar especialmente concorrência/RLS, exclusividade, retomada, Drive, RAM e V1. Corrigir achados materiais com RED→GREEN e repetir somente checks afetados, ampliando quando a mudança justificar. Não declarar aprovação só porque os motores passaram no teste anterior.
- [x] **Step 3: Preparar ativação.** Ler skills correspondentes de deploy, env, automações e Google Drive; descobrir ferramentas conectadas antes de usar navegador/CLI. Conferir CI do commit exato. Confirmar que a mesma automação continua pausada desde o início da edição dos scripts; conferir a configuração salva e fazer backup real conferido. Inspecionar execuções/intentos/motores e confirmar integridade do original. Não habilitar outros vendedores ou preencher planos.
- [x] **Step 4: Migrar e publicar.** Conferir ambiente, somas e pendências; aplicar somente a migração nova pelo runner existente com TLS e segredo só no processo. Conferir invariantes, índices/FK e limite três. Publicar o commit revisto correspondente sem mudar o destino das variáveis. Preparar motores com `Conferir/Preparar`, quando o original estiver ocioso, e reconferir IDs/volumes/loopback. Se houver erro, manter automação pausada e relatar o bloqueio; não apagar estado para desfazê-lo.
- [x] **Step 5: Homologar integração e atualizar a rotina.** Testar o webhook único com três contextos controlados básicos e comprovar isolamento, sem mensagens ou consulta CNPJ. Não gravar fixtures no CRM/planilha real. Teste de três entregas completas usa ambiente isolado enquanto faltarem três planos preenchidos pelos próprios vendedores. Atualizar a automação existente pela ferramenta oficial, preservando ID, horário seg–sex 17h SP e política de notificação; não criar duplicata. Reativar somente após conferência dos pré-requisitos e estados.
- [x] **Step 6: Registrar conclusão com limites reais.** Separar checks isolados, webhook e execução real observada. Se não houve três entregas reais, dizer isso. Documentar falta de RAM como alerta/aguarda, e reversão por suspensão de admissão e reconciliação. Nenhuma restauração do singleton com mais de uma execução aberta.
- [x] **Step 7: Commit/PR.** Guard de branch, preparar apenas os arquivos da etapa e atualizar PR #55 com comportamento final e validação. Preservar CI verde, não fazer merge sem autorização correspondente. Garantir PR anexado ao chat; não versionar comprovantes privados.

## Auto-revisão do plano

- Cobertura da spec: fila/legado/exclusividade na tarefa 1; motores na 2; locks/job na 3; RAM/journal/processo na 4; budgets/recibos na 5; Drive/pool/workflow/rotina na 6; revisão, backup e ativação na 7.
- Contratos: `MotorId`, `Vinculo`, `VinculoLegado`, `Associacao`, `Posicao`, `Journal`, `SolicitacaoDrive`, `ComprovanteDrive` e `MedicaoRam` têm definição única. Dependências do fluxo têm dono e assinaturas; V1 não é convertido para tipo V2.
- Review Focus: os cinco riscos têm testes atribuídos acima. Não remover testes de controle negativo ao adaptar a antiga expectativa de execução singleton.
- Proporção: módulos reutilizam os CLIs existentes; nenhuma API de negócio, agenda, serviço permanente ou biblioteca foi adicionada ao desenho. A porta 8096 é só exclusão local pelo tempo do processo, não endpoint de integração.
- Execução preservada: nativa nesta conversa; revisão independente do conjunto antes de produção. Plano pronto para revisão do usuário antes do início da implementação.

## Resultado observado em 26/10/2026

Implementação e revisão independente concluídas. Dois achados materiais foram
reproduzidos e corrigidos com RED→GREEN. Fonte da aplicação `400e405`,
CI #40399058396 aprovado, deployment `dpl_3kh8aCH8dhgTzrHdwm6weQvS6b8S`
publicado. Migração 0045 aplicada, invariantes aprovadas e três motores
conferidos com o original preservado. Mesma automação reativada.

Passaram as suítes locais, 69 jornadas e os três contextos simultâneos do
webhook único. O coordenador real comprovou bloqueio por RAM sem novos
pedidos/jobs. Não foram feitas três entregas em listas reais; planejamentos
continuam a cargo dos vendedores. O caminho histórico da campanha foi
atualizado para a pasta encontrada em `01 - Ativos/Conteúdo e automações`.

Os contratos ajustados e os limites reais da validação estão registrados em
[operação do agente](../../operacao/agente-google-crm.md#atualização-operacional-em-26102026).
