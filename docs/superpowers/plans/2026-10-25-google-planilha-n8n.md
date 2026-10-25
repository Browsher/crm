# Espelho do planejamento pela conexão n8n

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans; execução inline já solicitada pelo usuário.

**Goal:** Sincronizar o planejamento usando a conexão Google existente no n8n, preservando as garantias do banco.

**Architecture:** Transporte opcional autenticado em HTTPS; um ramo de planilha no workflow único. O cliente direto continua disponível. CRM confirma somente um recibo exato após leitura.

**Tech Stack:** TypeScript, Vitest, PostgreSQL/RLS existente e n8n (HTTP Request 4.2, Code 2, Webhook 2).

**Spec:** docs/superpowers/specs/2026-10-25-google-planilha-n8n-design.md

## Global Constraints

- features não importa outra feature; sem nova biblioteca, migração ou regra de negócio.
- Branch codex/redesign-crm; checkout principal preservado.
- Pedido 128 KiB; resposta 256 KiB; HTTPS sem credenciais/query/fragmento, Header Auth privado.
- Destino único, células RAW, linha fixa, legado 13 e atual 14 colunas.
- Não iniciar scraping, mensagens, consultas pagas nem outro agendamento.

## Review Focus

- Retorno perdido após gravação mantém bloqueio entre processos.
- Retorno de outro pedido/envio/revisão não confirma.
- Linha manual ou pedido estranho em intenções anteriores não autoriza sobrescrita.
- JSON e textos que começam com = continuam literais.
- Conferência real não escreve dados de teste no destino.

## Task 1: Transporte e grafo de sincronização

**Files:** src/server/google/planilha/configuracao.ts, cliente.ts, cliente-n8n.ts,
cliente-n8n.test.ts, workflow-planilha.test.ts; workflows/n8n/google/verificar-empresas.json;
src/server/google/verificacoes/contrato.test.ts; tests/integracao/google-planilha.test.ts.

**Interfaces:** ConfiguracaoPlanilha inclui alternativa transporte:n8n, url/token e destino.
criarClientePlanilha mantém conectar().gravar(payload, operacao).
O grafo aceita operacao conferir ou sincronizar e devolve identidade/células exatas.

- [ ] Escrever testes RED de configuração, recibo, perda de transporte, grafo RAW e conflitos.
- [ ] Executar testes unitários e observar falhas pela ausência do transporte/ramo.
- [ ] Implementar transporte e ramo mantendo o cliente direto.
- [ ] Testar integração do banco com resposta incerta via n8n; executar testes direcionados, typecheck e lint.
- [ ] Registrar resultado e commit apenas dos arquivos desta tarefa.

## Task 2: Preparar instalação e operação

**Files:** .env.example, docs/operacao/agente-google-crm.md, workflows/n8n/google/README.md.
Artifacts privados locais: backup do legado, credencial Header Auth e estado de instalação.

**Interfaces:** Usa o grafo e contrato da tarefa 1. IDs observados da API, nunca credenciais exportadas.

- [ ] Configurar a cópia preparada com credencial Google existente e Header Auth próprio.
- [ ] Testar somente leitura real de metadados/cabeçalho, sem coleta ou alteração de registros.
- [ ] Documentar IDs, resultados e pendências reais de servidor/ativação.
- [ ] Executar revisão independente final e corrigir achados relevantes com RED/GREEN.
- [ ] Commit/push na PR existente; manter a rotina sem novo agendamento.
