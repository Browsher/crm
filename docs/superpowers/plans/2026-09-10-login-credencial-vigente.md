# Credencial vigente no login — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Executar na branch codex/login-credencial-vigente já preparada, com revisão independente.

**Goal:** impedir emissão baseada em credencial revogada durante o login.
**Architecture:** versão bigint da credencial transportada como string; banco serializa emissão e revogação com travas curtas. Node verifica scrypt fora da transação e recebe recusa explícita.
**Tech Stack:** TypeScript, pg, PostgreSQL, Vitest, Playwright, npm.
**Spec:** docs/superpowers/specs/2026-09-10-login-credencial-vigente-design.md, aprovada pelo usuário.

## Restrições globais

- Nova migração 0022; arquivos SQL já aplicados são imutáveis.
- Ordem credencial → usuário → sessão. SQL explícito, sem depender de JOIN para ordenar travas.
- Sem migração de produção, deploy ou merge nesta execução. PR contra main com CI verde.
- Preservar AGENTS.md não versionado. Não corrigir os outros achados da auditoria nesta entrega.
- Testes usam banco descartável local e app_teste. Senhas de produção nunca são lidas nem modificadas.
- TDD: primeira regressão falha pelo comportamento, antes da alteração SQL/API.

## Tarefa 1: contrato completo banco → login

**Arquivos:** criar db/migracoes/0022_credencial_vigente.sql e tests/integracao/login-concorrente.test.ts; modificar src/server/autenticacao/{entrar,sessao,linhas}.ts, src/server/db/sem-identidade.ts e testes diretamente afetados por seus contratos. Criar teste dirigido de comportamento Node se necessário em src/server/autenticacao/entrar.test.ts.

**Interfaces produzidas:**

```ts
type LinhaCredencial = {
  usuario_id: string; senha_hash: string; versao: string
  ativo: boolean; senha_provisoria_pendente: boolean
}
type LinhaSessaoCriada = { senha_provisoria_pendente: boolean }
type ResultadoCriarSessao =
  | { ok: false }
  | { ok: true; token: string; expiraEm: Date; precisaTrocarSenha: boolean }
// criarSessao(usuarioId: string, versao: string): Promise<ResultadoCriarSessao>
```

- [ ] Ler integralmente vizinhos tests/integracao/{entrar,sessao,trocar-senha,funcoes-autenticacao}.test.ts e funções SQL 0009/0012; consultar migração runner sobre propriedade e privilégios.
- [ ] Criar regressão com entrar real e banco real, interceptando apenas chamada de leitura da credencial para concluir redefinição após retornar a linha. Adaptador encaminha demais chamadas ao módulo real. Rodar antes da correção; demonstrar login aceito indevidamente.

```ts
expect(await entrar({ email, senha: senhaAntiga, origem: null }))
  .toEqual({ ok: false, motivo: 'credenciais_invalidas' })
expect(await banco.sql('SELECT * FROM autenticacao.sessao WHERE usuario_id = $1', [alvo]))
  .toEqual([])
```

- [ ] Adicionar coluna versao bigint NOT NULL DEFAULT 1; credencial_por_email retorna versão junto ao hash. Recriar função de leitura porque retorno muda. Incrementar versão na mesma atualização de senha_trocar e no ON CONFLICT de credencial_definir; nova credencial começa em1. Preservar regras e auditoria existentes.
- [ ] Remover sessao_criar(uuid,text,timestamptz); criar assinatura (uuid,text,timestamptz,bigint), retorno TABLE(senha_provisoria_pendente boolean). Trancar credencial FOR UPDATE; se ausente ou versão nula/divergente retornar zero linhas. Trancar usuário FOR SHARE; se ausente/inativo retornar zero linhas. Inserir sessão e retornar marca atual. Restaurar REVOKE PUBLIC/GRANT app_conexao e propriedade conforme runner existente.

```sql
SELECT c.versao INTO v_versao FROM autenticacao.credencial c
WHERE c.usuario_id = p_usuario_id FOR UPDATE;
IF NOT FOUND OR p_versao IS NULL OR v_versao IS DISTINCT FROM p_versao THEN
  RETURN;
END IF;
SELECT u.ativo, u.senha_provisoria_pendente INTO v_ativo, v_pendente
FROM public.usuario u WHERE u.id = p_usuario_id FOR SHARE;
IF NOT FOUND OR NOT v_ativo THEN RETURN; END IF;
```

- [ ] Mapa sessao_criar passa a4. criarSessao transmite versão sem Number, só devolve token se banco devolver linha. entrar registra sucesso depois da emissão aceita; senha errada mantém bloqueio existente; versão revogada registra falha e retorna credenciais_invalidas, sem token. Ler precisaTrocarSenha do retorno final.
- [ ] Adaptar fixtures existentes: usuários de testes de sessão precisam de credencial; passar versão vigente explicitamente e validar ok antes de token. Não introduzir argumento default que esconda a versão verificada.
- [ ] Rodar regressão original verde, mais casos versão nula/incorreta, ausência de credencial, usuário inativo, bigint acima9007199254740991, marca provisória final, não registro de sucesso em recusa, assinatura antiga ausente e privilégios.

## Tarefa 2: serialização concorrente e regressões

**Arquivos:** tests/integracao/login-concorrente.test.ts (ou novo arquivo de contratos SQL separado se necessário), testes de autenticação existentes; src/server/db/sem-identidade.test.ts e invariantes.test.ts somente onde o contrato exigir.

**Consome:** contratos de quatro argumentos e versão string da tarefa1.

- [ ] Com duas conexões app_teste e transações, executar emissão/troca nas duas ordens para titular e gestor. Confirmar segunda chamada bloqueada consultando pg_blocking_pids antes de liberar primeira; polling limitado só observa espera, não ordena com sleep arbitrário.

```ts
expect(bloqueadores).toContain(pidPrimeiraConexao)
// Após COMMIT de revogação, emissão antiga não retorna linha.
expect(emissao.rows).toEqual([])
// Emissão anterior é removida pela revogação subsequente.
expect(sessoesDoAlvo).toEqual([])
```

- [ ] Repetir ordens para desativação. Testar rollback da alteração, redefinição mesmo hash e A→B→A; sessão própria do titular preservada e demais revogadas. Usar contas separadas; promises de operações bloqueadas ganham handler imediatamente.
- [ ] Rodar testes dirigidos, depois typecheck/lint/db:checar/unitários/integração completos. Rodar npm run test:e2e com novo build, não reutilizar build antigo.

## Tarefa 3: documentação, revisão e PR

**Arquivos:** docs/db/0022.md, docs/db/{0007,0009,0012,fundacao}.md; spec aprovada.

- [ ] Documentar contratos, travas, efeitos, assinatura removida e necessidade de código/banco coordenados. Adicionar ponteiros R015 nos docs históricos. Declarar que hipótese adjacente senha_trocar continua fora do escopo.
- [ ] Revisão independente de diff completo contra spec, com evidências red/green. Corrigir findings e retestar proporcionalmente.
- [ ] Verificar branch imediatamente antes de commit e abortar se diferente de codex/login-credencial-vigente; stage somente arquivos próprios. Push/PR main; aguardar CI sem merge automático.
- [ ] Entrega informa nova migração ainda não aplicada na Railway e necessidade de preparar janela de atualização antes do merge/deploy.

## Conferência do plano

Tarefa1 entrega contrato compartilhado SQL/TS e regressão observável; tarefa2 cobre todas as ordens e limites da spec; tarefa3 entrega documentação e integração revisável. Banco e login mudam juntos para evitar contrato incompleto. Toda validação de produção permanece separada.
