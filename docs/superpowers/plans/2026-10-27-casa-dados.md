# Casa dos Dados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task by task.

**Goal:** Substituir a aquisição CNPJ.biz por Casa dos Dados e validar uma única empresa real para Junior.
**Architecture:** Wrapper SQL aditivo persiste fornecedor; importação e privacidade continuam no banco. Cliente HTTP Casa normaliza para o DTO existente e UI oferece apenas filtros equivalentes. Uma resposta real, reservada antes do HTTP, é preservada para concluir/importar sem segunda compra.
**Tech Stack:** TypeScript, Zod, Next instalado, PostgreSQL18, Vitest/Playwright, sem dependência nova.
**Spec:** docs/superpowers/specs/2026-10-27-casa-dados-design.md

## Global Constraints

- Worktree crm-redesign/crm; branch codex/redesign-crm; PR55 existente, sem main/merge.
- Host fixo https://api.casadosdados.com.br, segredo CASA_DOS_DADOS_API_KEY somente servidor/header api-key.
- Uma empresa paga autorizada: Junior, Armarinhos, Brás, São Paulo/SP, quantidade1, offset0; sem compensação automática.
- Timeout25s, máximo2MB, sem retry/redirect/cache; quota antes da rede; UUID persistente.
- Origem antiga CNPJ.biz preservada; nova Casa dos Dados; proteção de sócios e contatos pelo banco.
- Nenhuma alteração Google, workflow, planilha, carteiras/reservas existentes; chave nunca no Git/log/modelo.
- Não editar migrações anteriores;0046 apenas, com backup e aplicação separada.
- Testes locais com um worker pela memória disponível; CI completa remota.

## Review Focus

1. Replay entre fornecedores não muda origem nem gera rede; reimportação própria continua idempotente.
2. Telefones/e-mails duplicados entre CNPJs ou candidatos, inclusive corrida, ficam impedidos pelo banco.
3. Arrays de regiões, MEI misturado com porte, regimes e contatos OR sem equivalente falham antes da cota/HTTP.
4. Operação com resposta salva/incerta não reenvia HTTP; dados reais não viram fixture pública.
5. Sócios/documentos, chaves reais e targets remotos ficam fora do navegador e do harness.

### Task1: Fonte e controles SQL

**Files:** Create db/migracoes/0046_casa_dados.sql, docs/db/0046.md, tests/integracao/casa-dados.test.ts. Modify src/server/db/migracoes/invariantes.ts e invariantes.test.ts somente whitelist do novo wrapper, se requerido.
**Interfaces:** busca_empresa.fornecedor default CNPJ.biz; busca_empresa_reservar_casa(uuid,text,jsonb) retorna mesmo texto da reserva e grava Casa dos Dados; concluir acrescenta bloqueada_por_repeticao para Casa; importar preserva contrato e usa fonte salva. Helpers internos sem GRANT. Duplicidade na importação usa23505, sem mutação parcial; lock27 existente mais lock de tabela se necessário para outros escritores.

- [x] RED: reservaCasa/replay/fonte antiga, quota/privacidade, flag de repetição CNPJ/telefone/email, importação com origem e reenvio, corrida e ausência de telefone.
- [x] GREEN: implementar migração aditiva sem alterar contratos antigos; rodar nova integração e regressão busca-empresas.
- [x] Atualizar whitelists/catracas exigidas; tipos/lint/db:checar; revisão de delta SQL.
- [x] Guard branch, commit/push e CI exata antes da aplicação remota.

### Task2: Uma resposta real com reserva

**Files:** Artefatos privados .google-agente/casa-dados-20261027; nenhum segredo/retorno real versionado.
**Interfaces:** operador usa identidade Junior e funções reais sob RLS; gestor habilita somente cota mínima1 temporária. Salvar corpo/UUID/estado antes do POST; resposta privada durável e SHA256.

- [x] Backup criptografado e conferido; aplicar só0046 na Railway; verificar migrações/invariantes/contagens.
- [x] Confirmar baseline atual, cota e alvo. Reservar UUIDCasa1 antes da rede; uma pesquisa completo, com contato disponível.
- [x] Salvar resposta real e metadados sem exibição; inferir apenas a estrutura dos contatos e sócios para fixture fictícia. Em incerteza, não repetir.

### Task3: Cliente, filtros e interface

**Files:** Create src/server/casa-dados/cliente.ts, filtros.ts e testes; adaptar app/fila/buscar/acoes.ts/page.tsx/formulario-completo.tsx/resultados.tsx, src/features/busca-empresas/{tipos,mensagens,repositorio}.ts, app/empresas/busca/page.tsx, src/components/crm/{dados-cadastrais,historico-buscas}.tsx. Atualizar .env.example e harness/tests existentes afetados. Preservar o leitor de dados cadastrais antigo se seu nome interno não exigir refatoração.
**Interfaces:** criarClienteCasaDados(chave,fetcher?) oferece buscar(FiltrosBusca); validarCompatibilidadeCasa antes da reserva e HTTP. Sem método de contagem paga; novas buscas usam wrapperCasa. BuscaSalva inclui fornecedor; EmpresaEncontrada pode conter flag calculada no banco. Dados cadastrais mostram dados.fonte.

- [x] RED puro dos filtros representáveis/não representáveis, paginação e defaults seguros.
- [x] GREEN mapeamento documentado, sem IDs artificiais nem filtros ignorados.
- [x] RED cliente com fixture fictícia baseada na resposta observada, falhas HTTP401/403/429, tamanho/timeout, falta de chave, uma chamada e completo explícito.
- [x] GREEN normalização contatos/endereço/CNAE/porte/abertura/capital/sócios; manter formato aceito pelo banco e limite de detalhes.
- [x] RED/ GREEN UI, mensagens e origem; desativar seleção de repetidas; limitar opções suportadas e página; remover pré-contagem.
- [ ] Adaptar E2E loopback/guardas/fixtures para Casa, zerando chave real herdada; preservar casos históricos CNPJ. Testar por regressão significativa.

### Task4: Entrega e validação final

**Files:** Atualizar docs/operacao/busca-empresas.md, docs/operacao/producao-vercel.md e resultados da execução.

- [x] Concluir a mesma reserva com normalização dos bytes reais salvos, sem novo HTTP; reexecutar reserva sem compra.
- [x] Importar uma empresa se importável; reconfirmar idempotência, fonte, grupo pessoal, histórico gestor, RLS, dados manuais e carteira/reserva inalterados.
- [x] Conferir saldo antes/depois sem inventar cobrança não aferida. Restaurar cota inicial; não liberar outros vendedores.
- [ ] Revisão independente nova do delta completo e agregados; corrigir achados com RED→GREEN.
- [ ] CI exata final; configurar chave sensível por stdin na Vercel correta; publicar app já autorizado, verificar URL/fonte e guardas.
- [ ] Verificar interface online só com sessão real, ou declarar limite dessa observação. PR55 atualizado, sem merge; relatório explícito se não houver empresa importável.
