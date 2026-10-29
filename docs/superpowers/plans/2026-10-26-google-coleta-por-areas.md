# Coleta Google por áreas Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** possibilitar um ensaio de 9 lotes reais de 50 candidatas, com três perfis isolados e coleta por áreas.
**Architecture:** opção operacional na campanha privada; geração determinística de URLs para a imagem já instalada, recorte local limitado, complementação antes de reservar lote e preservação de todo protocolo de retomada.
**Tech Stack:** Python padrão, TypeScript/tsx, Vitest e PostgreSQL do harness existente.
**Spec:** docs/superpowers/specs/2026-10-26-google-coleta-por-areas-design.md

## Global Constraints

- Preservar imagem, 3 motores, 2 trabalhadores/2 GiB por motor, volumes e jobs.
- Admissão 5632 MiB e suspensão crítica 512 MiB; sem fallback sequencial.
- Máximo 3 coletas/3 lotes/150 analisadas/50 entregues por vendedor; V1 inalterado.
- Perfil e banco de teste novos; nenhum dado de teste em produção ou planilha real.
- Drive real com download/tamanho/SHA256; nenhum recibo ou evidência fabricada.
- Default email:true; opção desligada no ensaio somente se escolhida pelo usuário.
- Automatização pausada antes de código compartilhado; backup privado já salvo.
- Branch codex/redesign-crm, PR55; sem main/merge/deploy de aplicativo ou migração.

## Review Focus

1. Corpo salvo antigo/novo deve ser reconciliado, nunca substituído por uma grade nova.
2. Saldo parcial repetido não deve causar terceira coleta sem novidades.
3. Lote já reservado/publicação pendente precisa preceder decisões de completar pool.
4. Recorte de 150 não pode mascarar limite UTF-8 nem perder CSV bruto integral.
5. 450 analisadas, 9 lotes cheios e 3 motores simultâneos exigem prova real; 3x50 entregues é outro teto.

### Task 1: Consultas e preparação limitada

**Files:** Create scripts/google/consultas.py, scripts/google/test_consultas.py. Modify scripts/google/coletar.py, scripts/google/test_coletar.py, src/google-agente-python.test.ts se necessário para timeout adequado da suíte.
**Interfaces:** gerar/validar consultas por rodada a partir do pedido, centro e raio; metadata consulta_versao=1 apenas na nova estratégia. Coletar-email booleano default true. Ler/retomar corpo salvo único ou grade validada. Preparação V2 do novo modo limitada a 150 identidades e 9.000.000 bytes.

- [x] Escrever testes RED de grade, rodadas distintas, limites/literalidade, V1/bairro e input inválido.
- [x] Implementar gerador puro e rodar GREEN.
- [x] Escrever testes RED de ponte: corpo de 4 URLs, origem antiga retomada, resposta perdida nova reconciliada e divergência sem POST.
- [x] Implementar integração e defaults sem mudar chamadas antigas.
- [x] Escrever RED de recorte/duplicatas/bruto integral e campo extenso.
- [x] Implementar recorte apenas opt-in com guarda UTF-8 e rodar suíte Python pela ponte Vitest.

### Task 2: Completar o pool antes de consumir lote

**Files:** Modify scripts/google/rodadas.py, scripts/google/test_rodadas.py, scripts/google/fluxo.mts, src/google-fluxo.test.ts.
**Interfaces:** ação resumo devolve disponíveis (até 50) e novas na última coleta. O resumo recebe o índice do início da última fonte por argumento CLI, preservando o formato do pool salvo. Modo opt-in lido da campanha; antigo fica inalterado. Antes de gerar lote, coletar mais se falta completar 50 e há orçamento/novidades. Processar saldo parcial ao esgotar fontes; parar sem novidades.

- [x] RED puro: identidades/vistas/novas considerando todas as fontes anteriores.
- [x] Implementar resumo e testar GREEN.
- [x] RED fluxo: 39+39+100 candidatas distintas resultam em três lotes de 50; primeiro lote só reserva depois da fonte complementar.
- [x] RED fluxo: 39+mesmas39 encerra uma parcial sem terceira coleta; vazio não cria lote; reserva pendente continua igual.
- [x] Implementar decisões no modo opt-in e rodar fluxo/pool/retomada existentes.

### Task 3: Revisar e ensaiar sem misturar produção

**Files:** Modify docs/operacao/agente-google-crm.md conforme resultados; artefatos apenas no estado ignorado .google-agente/ajuste-coleta-* e novo teste isolado.
**Interfaces:** coordenador/fluxo reais, banco local com RLS, webhook básico existente, Drive conectado, mesmos motores e medição real Windows. Nenhum workflow será editado.

- [x] Rodar tipos, lint, testes focados e checks afetados.
- [x] Revisão independente nova do diff; corrigir achados com RED→GREEN.
- [x] Preparar nova campanha privada opt-in e novos perfis fictícios. Respeitar escolha sobre e-mails; manter critérios reais seletivos para exercer os três lotes sem alterar teto de entregues.
- [x] Verificar motor ocioso, RAM física e obter exclusão local; não simular admissão nem reiniciar motor ativo.
- [x] Executar ensaio real. Arquivar arquivos nas pastas isoladas corretas, conferir bytes/hash, só então confirmar a entrega.
- [x] Provar lotes, jobs, candidatas, reenvio idempotente, RLS, RAM/cgroups e encerramento sem pendências escondidas.
- [x] Revisão independente final dos resultados, com limites explícitos se faltar volume/RAM.
- [ ] Guard de branch, commit/PR55 apenas arquivos próprios, CI do commit exato e restauração da mesma automação/configuração anterior. Não habilitar o opt-in na campanha real.

## Evidência do ensaio

- 35 testes focados passaram, incluindo ponte Python com 44 testes; tipos e lint passaram.
- Revisão independente corrigiu duas falhas com RED→GREEN: novidades não podem ser apagadas por vistas; limite de bytes deve corresponder ao arquivo Windows gravado.
- Teste real: 3 coletas simultâneas; restaurantes 2 lotes de 50, 100 analisadas e 2 entregues. Farmácias e roupas ficaram na mesma coleta com API working após log de encerramento.
- Capacidade450 não validada. Polling expirou sem duplicar os jobs; próxima coleta bloqueada com4.079 MiB < 5.632 MiB. RAM inicial 6.057 / mínima 1.018 MiB; pressão no limite, sem OOMkill.
- 5 arquivos únicos Drive, 6 conferências, 2 publicações repetidas sem mudança de contagem; RLS/exclusividade preservadas.
- Estado ignorado: .google-agente/teste-areas-20261026-215052. Nenhum segredo ou contato comercial acompanha este plano.
- Não habilitar o modo na campanha real nem tratar o ensaio como aprovação da capacidade máxima. Preservar os dois jobs incertos para diagnóstico.

A revisão final dos agregados não encontrou achados adicionais. Permanecem os bloqueios operacionais descritos; nenhuma execução foi concluída e a coleta de e-mails não foi validada.
