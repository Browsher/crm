# Fila de regiões e backup de telefones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Execute tasks without stopping for routine confirmations.

**Goal:** Coletar pela fila online e preservar/excluir telefones já liberados para CRM.
**Architecture:** Reutilizar o gerador simples como base de uma variante com backup. Parametrizar cidade/UF no coletor existente, mantendo o fluxo legado. O controlador integra as abas e a automação após testes.
**Tech Stack:** TypeScript/Vitest, Python/unittest, Google Sheets nativo, n8n 2.36.8 e Evolution community node.
**Spec:** ../specs/2026-10-16-fila-regioes-backup-telefones-design.md

## Global Constraints
- Spreadsheet 17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU; IDs 10151001/2/3/4 e backup 10151005.
- Backup telefones: A1 telefone, números como texto, sem exclusão de registros.
- Planejamento: A:B nichos; D:F Bairro | Cidade/UF | Situação.
- Um bairro por execução, dias úteis às 09h America/Sao_Paulo, até 50 empresas.
- Nenhum envio/importação/coleta real durante testes; não alterar credenciais/compartilhamento.
- Teste falhando primeiro; branch codex/base-prospeccao-n8n, nunca main.

## Review Focus
1. Mesmo telefone com máscara/DDI diferente precisa ser excluído; fixo de oito dígitos locais preservado.
2. Falha ao preservar exportação anterior não pode limpar os resultados existentes.
3. Fila com município homônimo ou retomada de outra cidade não pode reutilizar o job errado.
4. Backup alterado durante a validação impede a gravação final.
5. Lote vazio ou todo repetido deve remover sobras das saídas sem perder histórico.

### Task 1: Variante de workflow com backup
Ownership: src/lib/prospeccao-base/backup-telefones.ts e .test.ts; src/server/prospeccao-base/workflow-backup.ts e .test.ts; código de compilação necessário em codigo-simples.ts ou codigo-backup.ts; scripts/prospeccao-base/gerar-workflow-backup.mts.
Consumes: gerarWorkflowSimples(WorkflowSimplesConfig), normalizarNumero, lerColetaSheets, montarSaidas, prepararPublicacao, conferirSaidas.
Produces: gerarWorkflowComBackup(config: WorkflowSimplesConfig & { backupId: number }): WorkflowExport.
- [ ] Criar testes de backup anterior + novo, máscaras/DDI/fixos, exclusão de repetidos, erro antes de limpar, falha Evolution, alteração concorrente e saída vazia.
- [ ] Rodar testes e registrar falha real.
- [ ] Implementar funções puras e variante, mantendo gerador simples e testes atuais compatíveis.
- [ ] Executar o JavaScript exportado em harness de transporte isolado; validar readbacks e ordem backup -> conferir -> limpar -> consultar -> publicar.
- [ ] CLI gera arquivo novo sem credenciais e sem pinData. Não substituir JSONs existentes.
- [ ] Rodar testes focados, typecheck e revisão da tarefa; commit apenas arquivos próprios.

### Task 2: Coletor com região selecionada
Ownership: scripts/prospeccao-campanha/ dentro do worktree. Copiar fonte e testes da campanha local; não copiar histórico, leads ou credenciais.
Consumes: coletor.py, verificar_coleta.py e test_coletor.py de C:/Users/ADM/Desktop/Web Scraping/armarinhos.
Produces: coletor.py com --cidade, --uf e --fila-planejada, mantendo defaults legados; verificador compatível com cidade do resumo.
- [ ] Criar testes falhando para cidade fora de São Paulo, fila externa após 25, pendência homônima, nomes seguros, não avanço da fila legada.
- [ ] Parametrizar palavras-chave, geocodificação, filtro e resumo. Manter lock, limite diário, dedupe por identidade e retomada.
- [ ] Testes isolados usam fixtures e configuração temporária; nenhum acesso real ao Maps.
- [ ] Fornecer arquivos revisáveis e comandos de instalação exatos; o controlador instala na campanha após revisão.
- [ ] Rodar unittest legado e novo e revisão da tarefa; commit apenas arquivos próprios.

### Task 3: Integração da planilha e da automação
Ownership do controlador: abas Google Sheets, prompt da automação e instruções de operação.
- [ ] Renomear aba 10151005 para Backup telefones; ajustar nota para reserva de prospecção.
- [ ] Acrescentar fila D:F a Planejamento semanal com os 25 bairros legados e cidade São Paulo/SP; marcar Brás Concluído por histórico real.
- [ ] Conferir todas as células e estrutura sem alterar dados das três abas de trabalho; inspecionar visualmente.
- [ ] Instalar coletor/verificador testados na campanha com cópia reversível das fontes anteriores; histórico permanece intacto.
- [ ] Atualizar automação via ferramenta, preservando agenda, alvo e preferências; ler fila online, selecionar/registar status, usar --fila-planejada e cidade/UF; sem pausas definitivas por fila vazia.
- [ ] Preparar JSON configurado novo em outputs/validacao-whatsapp-backup-2026-10-16 e copiar para pasta principal. Manter caminho de importação manual pelo editor n8n.

### Task 4: Verificação e entrega
- [ ] Rodar testes relevantes de ambos os subsistemas e typecheck/lint dos arquivos alterados.
- [ ] Revisão independente de código e conformidade, com foco nos cinco casos acima.
- [ ] Corrigir defeitos materiais e atualizar manual do novo fluxo.
- [ ] Atualizar PR #53, sem merge; separar evidência local de importação/execução remota.
- [ ] Entregar planilha e JSON com instrução breve; não afirmar execução remota que não ocorreu.
