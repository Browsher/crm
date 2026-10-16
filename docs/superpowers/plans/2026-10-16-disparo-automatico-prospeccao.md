# Disparo automático da prospecção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Iniciar a validação e o CSV final automaticamente depois da publicação conferida pelo agente.

**Architecture:** Uma variante do gerador Drive recebe Webhook POST autenticado e valida a identidade da publicação antes de qualquer escrita ou consulta. Um cliente Python local envia o sinal uma vez e persiste o resultado ou a incerteza. O agente resolve pendências antes de outra coleta.

**Tech Stack:** n8n 2.36.8, TypeScript/Vitest, Python 3.12+ com biblioteca padrão, Google Sheets/Drive e Evolution existentes.

**Spec:** docs/superpowers/specs/2026-10-16-disparo-automatico-prospeccao-design.md, aprovada pelo usuário para implementação e ativação. Reutilizar worktree producao-vercel e branch codex/base-prospeccao-n8n, PR #53. Execução com subagentes já autorizada na conversa; não solicitar nova aprovação de plano ou instalação.

## Global Constraints

- Não modificar contratos dos geradores manuais. Não há mensagens nem importação no CRM.
- Não executar nova coleta real para testar; preservar Bom Retiro: dez na origem, cinco exportados, 19 no backup, dois CSVs.
- Credencial Header Auth somente no n8n e configuração privada local; nunca em Git, logs, comprovantes ou JSON exportado.
- Uma chamada local por vez. Nenhuma alteração global de concorrência ou novo banco. Resposta incerta bloqueia novo POST até reconciliação.
- O aviso só pode operar a planilha/aba configuradas, com lote, hash e IDs iguais à publicação conferida.
- CSV original continua anterior à publicação; CSV final continua posterior à conferência das saídas e backup. Mesma pasta da coleta.

## Contrato entre tarefas

`SinalColetaPronta = {versao:1,lote:string,origemCsvSha256:string,planilhaId:string,origemId:number,pastaId:string,arquivoOriginalId:string}`. Hash SHA-256 hexadecimal minúsculo de 64 caracteres. Lote e IDs são os do manifesto de origem já existente. O corpo não inclui cadastros, endpoint ou segredo.

Resposta JSON de sucesso: `{versao:1,estado:'concluido'|'ja_concluido',lote,origemCsvSha256,execucaoId:string,empresasLidas:number,empresasExportadas:number,validos:number,invalidos:number,pendencias:number,mensagensEnviadas:0,arquivoDrive:{id,pastaId,link,nome,csvSha256}}`. Contagens não negativas, links Google Drive coerentes com IDs, lote/hash/pasta correspondentes ao sinal. O segredo não aparece na resposta.

Configuração privada local `.workflow-prospeccao.local.json`: `{versao:1,url:string,header:'X-CRM-Token',token:string,timeoutSegundos:120,planilhaId:string,origemId:number}`. URL HTTPS de produção do n8n autorizado, sem redirecionamento. Caminho público do Webhook no gerador é configuração sem segredo; credencial `httpHeaderAuth` selecionada no editor.

Cliente novo `disparar_workflow.py --publicacao <publicacao_sheets.json> --config <config privado> [--reconciliar <resultado JSON conferido>]`. Exige `origem_publicada`, `arquivo_drive_confirmado`, `leitura_retorno.conferida` e `leitura_retorno.publicacao_nova_conferida` iguais a true, manifesto coerente e estado de publicação concluída. Guarda o controle em `workflow_automatico` do mesmo comprovante; lock exclusivo ao lado da configuração, sem segredo. Opção de reconciliação valida resultado e identidade sem enviar POST; o agente só prepara esse resultado depois de conferir Sheets e arquivo Drive atuais.

## Review Focus

- Lote concluído ou legado: não limpar os cinco resultados nem gerar CSV vazio por causa do backup. Testes na tarefa 1.
- Arquivo pendente do mesmo lote: arquivar e devolver resultado existente; de outro lote: recuperar antes de seguir. Testes na tarefa 1.
- Sinal atrasado ou mesmo lote com hash conflitante: falhar antes de efeitos. Testes na tarefa 1.
- Queda após aceitação HTTP ou processo encerrado: persistir incerteza, sem reenvio por timeout, sem apagar lock vivo. Testes na tarefa 2.
- Publicação não conferida, retorno malformado, redirecionamento ou erro contendo segredo: não disparar/concluir e não vazar credenciais. Testes na tarefa 2.

## Tarefa 1: variante automática (worker TypeScript)

**Files:** criar `src/lib/prospeccao-base/automatico.ts` e testes; `src/server/prospeccao-base/workflow-automatico.ts` e testes de execução do código exportado; CLI/testes `scripts/prospeccao-base/gerar-workflow-automatico.mts`. Alterações mínimas em `codigo-simples.ts` para bundle separado. Outros arquivos só se necessário para adaptar harness, sem quebrar variantes existentes.

**Interfaces:** produzir `gerarWorkflowAutomatico(config: WorkflowDriveConfig & {webhookPath:string}): WorkflowExport`; consumir contrato acima e `gerarWorkflowComDrive`. Exportar JSON sem credenciais/pinData. Webhook POST com Header Auth, resposta ao terminar, credencial não exportada e sem trigger manual nessa variante; o workflow manual anterior permanece.

- [ ] RED para corpo inválido, destino divergente, hash/lote atual diferente, assinatura conflitante e nenhum efeito antes da conferência.
- [ ] RED para lote novo, já concluído inclusive legado 689, arquivo pendente do mesmo/outro lote e resposta final no contrato. Exercitar JS real e isolamento entre nós, com HTTP/Sheets/Evolution/Drive simulados.
- [ ] GREEN com portões antes de escritas/consultas e assinatura versionada de origem nas notas da exportação para novos lotes. Não destruir o manifesto Drive nem o texto humano útil.
- [ ] Conferir parâmetros oficiais n8n da versão instalada; gerar variante e CLI com destinos novos e erros sanitizados.
- [ ] Rodar testes novos e regressões Drive/backup, tipos e lint direcionado. Informar evidência RED/GREEN e arquivos alterados; sem commit, instalação ou serviços reais.

## Tarefa 2: cliente de disparo (worker Python)

**Files:** criar `scripts/prospeccao-campanha/disparar_workflow.py` e `test_disparar_workflow.py` somente. Nenhuma alteração de configuração/histórico reais.

**Interfaces:** CLI e arquivos descritos no contrato. Resposta stdout JSON sanitizada; erro com motivo sem token/headers/conteúdo arbitrário do servidor. Processamento HTTP síncrono com limite 120s; a shell pode ser acompanhada em intervalos menores que 60s. Lock exclusivo e persistência atômica do comprovante antes de emitir POST.

- [ ] RED para publicação não conferida, configuração inválida, corpo exato, sucesso, lote errado/retorno inválido, erro, redirect, timeout e segredo que aparece em exceção.
- [ ] RED para duas execuções concorrentes com um único POST, repetição após sucesso sem POST, estado iniciado/incerto sem POST e reconciliação válida/inválida sem rede.
- [ ] GREEN com biblioteca padrão e contrato acordado; nunca remover lock de outro processo. Capturar erro de escrita antes do envio para não causar chamada sem comprovante.
- [ ] Rodar nova suíte e demais testes de campanha; entregar resultados e instruções CLI, sem commit, cópia ao Desktop ou chamada real.

## Tarefa 3: revisão, instalação e ativação (root)

- [ ] Revisão independente dos dois componentes contra a spec e contrato; corrigir achados materiais antes de instalar.
- [ ] Criar configuração/token privados, fora do Git; instalar cliente e instruções revisadas com reserva dos anteriores. Preservar configuração da campanha, histórico e CSVs.
- [ ] Gerar JSON automático e importar em nova cópia n8n. Selecionar Google Sheets account, Evolution account, N8N Google Drive ds e nova Header Auth exclusiva. Publicar e conferir estado/endereço de produção pelo editor.
- [ ] Testar chamada sem autenticação e aviso autenticado do Bom Retiro já concluído. Conferir resposta `ja_concluido`, ausência de consultas novas, cinco linhas exportadas, 19 telefones e dois arquivos iguais. Não executar outro bairro.
- [ ] Atualizar automação via ferramenta, mantendo horário/estado/modelo/notificações; substituir proibição de iniciar n8n pelo cliente autorizado. Releitura exata do prompt. Persistir os quatro flags de conferência e retomar `workflow_automatico` pendente antes de coletar outro bairro.
- [ ] Atualizar guia/README e entregar links. Repetir verificações focadas, registrar evidências, commit na branch e atualizar PR #53 sem merge.
