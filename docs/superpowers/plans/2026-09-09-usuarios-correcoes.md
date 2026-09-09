# Fatia 0c.1 — correções de usuários: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a auditoria de quem redefiniu senha, enforçar a máquina de estados no banco, compartilhar a conferência de permissão e fechar duas invariantes.

**Architecture:** Migração 0012 acrescenta `autenticacao.credencial.atualizado_por`, cria `exigir_gestor(p_alvo)` e `usuario_situacao_definir(id, ativo)`, troca o retorno de `credencial_definir` de booleano para texto de vocabulário fixo, torna `sessoes_encerrar_de` interna e revoga `definir_auditoria` de `PUBLIC`. O repositório encolhe para cinco operações e traduz o vocabulário, lançando em valor desconhecido.

**Tech Stack:** Postgres 17 via `pg`, TypeScript, Vitest (projetos `unitario` e `integracao`), Next.js 16.

**Spec:** `docs/superpowers/specs/2026-09-09-usuarios-correcoes-design.md`

## Global Constraints

- Branch `fatia-0c1-correcoes`, já criada. **Conferir a branch imediatamente antes de cada commit** (R-013). A main é protegida com `enforce_admins`.
- TDD: teste falhando primeiro, sempre. Rodar e ver o vermelho antes de implementar.
- TypeScript sem ponto e vírgula, aspas simples. Regra devolve `{ ok, motivo }`; só infraestrutura lança. Retorno cedo.
- Migração: uma linha de comentário no topo apontando `docs/db/0012.md`; `BEGIN;` na primeira linha de código, `COMMIT;` na última; nenhum `--` nem `/*` no corpo; LF. `npm run db:checar` confere.
- `db:aplicar` roda as invariantes no fim. **Invariante violada quebra `criarBancoDeTeste` e derruba toda a integração**, não só o teste da invariante.
- Container: `npm run db:subir`. Um arquivo: `npx vitest run --project integracao tests/integracao/<arquivo>`.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6a8yJSTcsbaoksK2myUcR
  ```

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `db/migracoes/0012_situacao_e_auditoria.sql` | a migração inteira |
| `docs/db/0012.md` | o porquê da 0012 |
| `tests/integracao/funcoes-usuario.test.ts` | vocabulário, transições, auditoria, privilégios |
| `tests/integracao/schema.test.ts` | lista de migrações ganha a 0012 |
| `src/server/db/migracoes/invariantes.ts` (+ `.test.ts`) | escopo ampliado e invariante de `PUBLIC` |
| `tests/integracao/runner.test.ts` | controles negativos |
| `src/features/usuarios/repositorio.ts` | interface encolhida, tradução do vocabulário |
| `src/features/usuarios/servico.ts` | `desativar`/`reativar` delegam para `definirSituacao` |
| `src/features/usuarios/mensagens.ts` (+ `.test.ts`) | dois motivos novos |
| `tests/integracao/usuarios.test.ts` | acompanha a interface nova |
| `tests/integracao/politicas.test.ts` | teste da isenção de dono |
| `docs/db/0003.md`, `0009.md`, `0010.md`, `0011.md` | ponteiros de encaminhamento |
| `docs/db/fundacao.md`, `divida-tecnica.md`, `REGRAS.md` | docs e regras |

---

### Task 1: Migração 0012 e o banco

**Files:**
- Create: `db/migracoes/0012_situacao_e_auditoria.sql`, `docs/db/0012.md`
- Modify: `tests/integracao/funcoes-usuario.test.ts`, `tests/integracao/schema.test.ts`, `src/server/db/migracoes/invariantes.ts`

**Interfaces:**
- Produces: `public.exigir_gestor(uuid) RETURNS void`; `public.usuario_situacao_definir(uuid, boolean) RETURNS text`; `public.credencial_definir(uuid, text) RETURNS text`; `autenticacao.credencial.atualizado_por uuid`.
- Vocabulário: `credencial_definir` devolve `ok` | `nao_encontrado` | `alvo_inativo`; `usuario_situacao_definir` devolve `ok` | `nao_encontrado` | `ja_nesse_estado`.

**ATENÇÃO — esta task deixa `tests/integracao/usuarios.test.ts` VERMELHO.** O
repositório ainda espera booleano de `credencial_definir` e ainda chama
`sessoes_encerrar_de` diretamente, que perde o `GRANT` aqui. A Task 2 fecha.
É vermelho conhecido, anunciado, e confinado a duas tasks do mesmo PR. Não
"consertar" o repositório dentro desta task.

**Por que a constante da invariante muda aqui e não na Task 3:** `db:aplicar`
confere invariantes no fim. Se `sessoes_encerrar_de` sair do `GRANT` e ficar na
constante, a invariante acusa "registrada e ausente ou sem EXECUTE", `aplicar`
falha, e `criarBancoDeTeste` lança em **todos** os arquivos de integração.
Aqui é só o ajuste mínimo para o verde; a substituição da constante inteira é
a Task 3.

- [ ] **Step 1: Testes de auditoria (vermelho)**

Em `tests/integracao/funcoes-usuario.test.ts`, acrescentar:

```ts
describe('auditoria de quem redefiniu', () => {
  test('dois gestores em sequência: a credencial nomeia o segundo', async () => {
    const alvo = await criarUsuario(banco, 'vendedor', 'Auditado')
    const gestor2 = await criarUsuario(banco, 'gestor', 'GestoraDois')
    await definir(gestor, alvo, 'hash-do-primeiro')
    const [a] = await banco.sql<{ por: string }>(
      'SELECT atualizado_por AS por FROM autenticacao.credencial WHERE usuario_id = $1', [alvo])
    expect(a.por).toBe(gestor)
    await definir(gestor2, alvo, 'hash-do-segundo')
    const [b] = await banco.sql<{ por: string; hash: string }>(
      'SELECT atualizado_por AS por, senha_hash AS hash FROM autenticacao.credencial WHERE usuario_id = $1', [alvo])
    expect(b).toEqual({ por: gestor2, hash: 'hash-do-segundo' })
  })

  test('senha_trocar grava o próprio usuário', async () => {
    const { id } = await criarUsuarioComSenha(banco, 'vendedor', 'Trocador', 'senha-forte-1')
    const { token } = await criarSessao(id)
    await chamar('senha_trocar', [hashDoToken(token), 'hash-novo'])
    const [c] = await banco.sql<{ por: string }>(
      'SELECT atualizado_por AS por FROM autenticacao.credencial WHERE usuario_id = $1', [id])
    expect(c.por).toBe(id)
  })

  test('credencial criada como dona fica com atualizado_por nulo (caminho do seed)', async () => {
    const id = await criarUsuario(banco, 'vendedor', 'Semeado')
    await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, 'h'])
    const [c] = await banco.sql<{ por: string | null }>(
      'SELECT atualizado_por AS por FROM autenticacao.credencial WHERE usuario_id = $1', [id])
    expect(c.por).toBeNull()
  })
})
```

Acrescentar aos imports do arquivo: `import { chamar } from '@/src/server/db/sem-identidade'` e `import { hashDoToken } from '@/src/server/autenticacao/sessao'`.

- [ ] **Step 2: Testes do vocabulário e das transições (vermelho)**

No mesmo arquivo:

```ts
describe('vocabulário de retorno', () => {
  test('credencial_definir devolve ok, nao_encontrado e alvo_inativo, com a string exata', async () => {
    const vivo = await criarUsuario(banco, 'vendedor', 'Vivo')
    const r1 = await definir(gestor, vivo, 'h')
    expect(r1.linhas).toEqual([{ credencial_definir: 'ok' }])
    const r2 = await definir(gestor, '00000000-0000-0000-0000-000000000000', 'h')
    expect(r2.linhas).toEqual([{ credencial_definir: 'nao_encontrado' }])
    const morto = await criarUsuario(banco, 'vendedor', 'Morto')
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [morto])
    const r3 = await definir(gestor, morto, 'h')
    expect(r3.linhas).toEqual([{ credencial_definir: 'alvo_inativo' }])
  })

  test('usuario_situacao_definir devolve ok, nao_encontrado e ja_nesse_estado, com a string exata', async () => {
    const alvo = await criarUsuario(banco, 'vendedor', 'Situacao')
    const desativar = await situacao(gestor, alvo, false)
    expect(desativar.linhas).toEqual([{ usuario_situacao_definir: 'ok' }])
    const denovo = await situacao(gestor, alvo, false)
    expect(denovo.linhas).toEqual([{ usuario_situacao_definir: 'ja_nesse_estado' }])
    const some = await situacao(gestor, '00000000-0000-0000-0000-000000000000', true)
    expect(some.linhas).toEqual([{ usuario_situacao_definir: 'nao_encontrado' }])
    const volta = await situacao(gestor, alvo, true)
    expect(volta.linhas).toEqual([{ usuario_situacao_definir: 'ok' }])
    const jaAtivo = await situacao(gestor, alvo, true)
    expect(jaAtivo.linhas).toEqual([{ usuario_situacao_definir: 'ja_nesse_estado' }])
  })

  test('desativar por usuario_situacao_definir apaga as sessões do alvo', async () => {
    const alvo = await criarUsuario(banco, 'vendedor', 'ComSessao')
    const { token } = await criarSessao(alvo)
    await situacao(gestor, alvo, false)
    expect(await lerSessao(token)).toBeNull()
    expect(await sessoesDe(alvo)).toBe(0)
  })

  test('reativar não apaga sessão de ninguém', async () => {
    const outro = await criarUsuario(banco, 'vendedor', 'Intocado')
    const { token } = await criarSessao(outro)
    const alvo = await criarUsuario(banco, 'vendedor', 'Reativado')
    await situacao(gestor, alvo, false)
    await situacao(gestor, alvo, true)
    expect(await lerSessao(token)).not.toBeNull()
  })
})
```

Acrescentar o auxiliar, ao lado de `definir` e `encerrar`:

```ts
const situacao = (quem: string, alvo: string, ativo: boolean) =>
  banco.comoUsuario(quem, (e) =>
    e<{ usuario_situacao_definir: string }>('SELECT usuario_situacao_definir($1, $2)', [alvo, ativo]))
```

- [ ] **Step 3: Testes de privilégio (vermelho) e ajuste dos testes existentes**

Ainda no mesmo arquivo, no `describe('lista fechada')`, substituir o teste de privilégios por:

```ts
  test('privilégios depois da 0012', async () => {
    const r = await banco.sql<{ nome: string; usuario: boolean; conexao: boolean; publico: boolean }>(`
      SELECT p.proname AS nome,
             has_function_privilege('app_usuario', p.oid, 'EXECUTE') AS usuario,
             has_function_privilege('app_conexao', p.oid, 'EXECUTE') AS conexao,
             (p.proacl IS NULL OR EXISTS (
               SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')) AS publico
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('credencial_definir', 'usuario_situacao_definir', 'sessoes_encerrar_de', 'exigir_gestor', 'definir_auditoria')
      ORDER BY 1`)
    expect(r).toEqual([
      { nome: 'credencial_definir', usuario: true, conexao: false, publico: false },
      { nome: 'definir_auditoria', usuario: false, conexao: false, publico: false },
      { nome: 'exigir_gestor', usuario: false, conexao: false, publico: false },
      { nome: 'sessoes_encerrar_de', usuario: false, conexao: false, publico: false },
      { nome: 'usuario_situacao_definir', usuario: true, conexao: false, publico: false },
    ])
  })
```

E ajustar os testes da 0c que asseriam booleano: onde havia
`expect(r.linhas).toEqual([{ credencial_definir: true }])` passa a ser `'ok'`, e
`[{ credencial_definir: false }]` passa a ser `'nao_encontrado'`. O teste
"apaga só as sessões do alvo e devolve quantas" de `sessoes_encerrar_de` deixa
de poder chamar por `comoUsuario` (perdeu o `GRANT`): remover esse teste, porque
a cobertura passa a ser pelo `usuario_situacao_definir` dos Steps 2 e 3.

Em `tests/integracao/schema.test.ts`, acrescentar `'0012_situacao_e_auditoria.sql',` depois da 0011.

- [ ] **Step 4: Rodar e ver o vermelho**

Run: `npx vitest run --project integracao tests/integracao/funcoes-usuario.test.ts`
Expected: FAIL. As mensagens esperadas incluem `column "atualizado_por" does not exist`, `function usuario_situacao_definir(uuid, boolean) does not exist`, e os `toEqual` de vocabulário recebendo `true`/`false` em vez de string.

- [ ] **Step 5: Escrever a migração**

`db/migracoes/0012_situacao_e_auditoria.sql`, LF, sem `--` no corpo:

```sql
-- ver docs/db/0012.md
BEGIN;
ALTER TABLE autenticacao.credencial ADD COLUMN atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT;
CREATE FUNCTION exigir_gestor(p_alvo uuid) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
BEGIN
  IF NOT (public.pode_escrever() AND public.eh_gestor()) OR p_alvo = public.usuario_atual() THEN
    RAISE EXCEPTION 'so gestor ativo e sem senha provisoria age sobre outro usuario' USING ERRCODE = '42501';
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION exigir_gestor(uuid) FROM PUBLIC;
DROP FUNCTION credencial_definir(uuid, text);
CREATE FUNCTION credencial_definir(p_usuario_id uuid, p_hash text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_ativo boolean;
BEGIN
  PERFORM public.exigir_gestor(p_usuario_id);
  SELECT u.ativo INTO v_ativo FROM public.usuario u WHERE u.id = p_usuario_id;
  IF v_ativo IS NULL THEN
    RETURN 'nao_encontrado';
  END IF;
  IF NOT v_ativo THEN
    RETURN 'alvo_inativo';
  END IF;
  INSERT INTO autenticacao.credencial (usuario_id, senha_hash, atualizado_por)
  VALUES (p_usuario_id, p_hash, public.usuario_atual())
  ON CONFLICT (usuario_id) DO UPDATE
  SET senha_hash = EXCLUDED.senha_hash, atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por;
  UPDATE public.usuario SET senha_provisoria_pendente = true WHERE id = p_usuario_id AND NOT senha_provisoria_pendente;
  PERFORM public.sessoes_encerrar_de(p_usuario_id);
  RETURN 'ok';
END
$$;
REVOKE EXECUTE ON FUNCTION credencial_definir(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION credencial_definir(uuid, text) TO app_usuario;
CREATE FUNCTION usuario_situacao_definir(p_usuario_id uuid, p_ativo boolean) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_ativo boolean;
BEGIN
  PERFORM public.exigir_gestor(p_usuario_id);
  SELECT u.ativo INTO v_ativo FROM public.usuario u WHERE u.id = p_usuario_id;
  IF v_ativo IS NULL THEN
    RETURN 'nao_encontrado';
  END IF;
  IF v_ativo = p_ativo THEN
    RETURN 'ja_nesse_estado';
  END IF;
  UPDATE public.usuario SET ativo = p_ativo WHERE id = p_usuario_id;
  IF NOT p_ativo THEN
    PERFORM public.sessoes_encerrar_de(p_usuario_id);
  END IF;
  RETURN 'ok';
END
$$;
REVOKE EXECUTE ON FUNCTION usuario_situacao_definir(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION usuario_situacao_definir(uuid, boolean) TO app_usuario;
CREATE OR REPLACE FUNCTION sessoes_encerrar_de(p_usuario_id uuid) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_apagadas integer;
BEGIN
  PERFORM public.exigir_gestor(p_usuario_id);
  DELETE FROM autenticacao.sessao WHERE usuario_id = p_usuario_id;
  GET DIAGNOSTICS v_apagadas = ROW_COUNT;
  RETURN v_apagadas;
END
$$;
REVOKE EXECUTE ON FUNCTION sessoes_encerrar_de(uuid) FROM app_usuario;
CREATE OR REPLACE FUNCTION autenticacao.senha_trocar(p_token_hash text, p_hash_novo text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_usuario uuid;
BEGIN
  SELECT s.usuario_id INTO v_usuario
  FROM autenticacao.sessao s JOIN public.usuario u ON u.id = s.usuario_id
  WHERE s.token_hash = p_token_hash AND s.expira_em > now() AND u.ativo;
  IF v_usuario IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE autenticacao.credencial SET senha_hash = p_hash_novo, atualizado_em = now(), atualizado_por = v_usuario WHERE usuario_id = v_usuario;
  UPDATE public.usuario SET senha_provisoria_pendente = false WHERE id = v_usuario AND senha_provisoria_pendente;
  DELETE FROM autenticacao.sessao WHERE usuario_id = v_usuario AND token_hash <> p_token_hash;
  RETURN v_usuario;
END
$$;
REVOKE EXECUTE ON FUNCTION definir_auditoria() FROM PUBLIC;
COMMIT;
```

- [ ] **Step 6: Ajustar a constante da invariante**

Em `src/server/db/migracoes/invariantes.ts`, `FUNCOES_DE_USUARIO_EM_AUTENTICACAO`
perde `sessoes_encerrar_de` e fica só com `credencial_definir`.

**Não acrescentar `usuario_situacao_definir`.** O corpo dela não menciona
`autenticacao.` (chega lá por `sessoes_encerrar_de`), então a invariante atual
não a enxerga, e registrá-la produziria a violação "registrada e ausente".
É o limite de substring documentado na spec, seção 10. Ver a nota da Task 3.

Ajustar `invariantes.test.ts` para o `sao()` refletir a constante nova.

- [ ] **Step 7: Rodar o verde do banco**

Run: `npm run db:checar && npx vitest run --project integracao tests/integracao/funcoes-usuario.test.ts tests/integracao/schema.test.ts tests/integracao/runner.test.ts tests/integracao/trocar-senha.test.ts tests/integracao/politicas.test.ts && npx vitest run --project unitario`
Expected: PASS. `usuarios.test.ts` continua fora desta lista e continua vermelho, por desenho.

- [ ] **Step 8: `docs/db/0012.md`**

No molde dos anteriores: o que cria, por quê (cada decisão da seção 2 da spec), a tabela dos objetos tocados fora do escopo (seção 7 da spec), e "Depende de" 0009, 0010 e 0011. Incluir a linha sobre não haver janela sem privilégio entre o `DROP` e o `GRANT`, porque a migração é uma transação só.

- [ ] **Step 9: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add db/migracoes/0012_situacao_e_auditoria.sql docs/db/0012.md tests/integracao/funcoes-usuario.test.ts tests/integracao/schema.test.ts src/server/db/migracoes/invariantes.ts src/server/db/migracoes/invariantes.test.ts
git commit -m "0012: situacao_definir, exigir_gestor e auditoria de credencial"
```

---

### Task 2: TypeScript, repositório, serviço e mensagens

**Files:**
- Modify: `src/features/usuarios/repositorio.ts`, `servico.ts`, `mensagens.ts`, `mensagens.test.ts`
- Modify: `tests/integracao/usuarios.test.ts`
- Create: teste unitário do mapeamento

**Interfaces:**
- Consumes: o vocabulário da Task 1.
- Produces: `Motivo` ganha `alvo_inativo` e `ja_nesse_estado`; interface com `mudarPapel` e `definirSituacao`; `ResultadoDesconhecido`.

Esta task devolve `usuarios.test.ts` ao verde.

- [ ] **Step 1: Teste unitário do mapeamento (vermelho)**

Criar `src/features/usuarios/repositorio.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { ResultadoDesconhecido, traduzirResultado } from './repositorio'

describe('traduzirResultado', () => {
  test('vocabulário conhecido vira ok ou motivo', () => {
    expect(traduzirResultado('f', 'ok')).toEqual({ ok: true })
    expect(traduzirResultado('f', 'nao_encontrado')).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(traduzirResultado('f', 'alvo_inativo')).toEqual({ ok: false, motivo: 'alvo_inativo' })
    expect(traduzirResultado('f', 'ja_nesse_estado')).toEqual({ ok: false, motivo: 'ja_nesse_estado' })
  })

  test('valor desconhecido lança, não vira ok: false', () => {
    expect(() => traduzirResultado('credencial_definir', 'lixo')).toThrow(ResultadoDesconhecido)
    expect(() => traduzirResultado('credencial_definir', 'ok ')).toThrow(/ok /)
  })

  test('propriedade de Object.prototype não vira resultado', () => {
    expect(() => traduzirResultado('f', 'toString')).toThrow(ResultadoDesconhecido)
  })
})
```

- [ ] **Step 2: Rodar e ver o vermelho**

Run: `npx vitest run --project unitario src/features/usuarios/repositorio.test.ts`
Expected: FAIL, `traduzirResultado` não existe.

- [ ] **Step 3: Reescrever `repositorio.ts`**

Trocar `Motivo`, a interface e as operações:

```ts
export type Motivo = 'sem_permissao' | 'nao_encontrado' | 'email_em_uso' | 'alvo_inativo' | 'ja_nesse_estado'
export type Falha = { ok: false; motivo: Motivo }

export interface RepositorioUsuarios {
  listar(): Promise<Usuario[]>
  criar(dados: NovoUsuario, hash: string): Promise<{ ok: true; id: string } | Falha>
  definirCredencial(id: string, hash: string): Promise<{ ok: true } | Falha>
  mudarPapel(id: string, papel: Papel): Promise<{ ok: true } | Falha>
  definirSituacao(id: string, ativo: boolean): Promise<{ ok: true } | Falha>
}

export class ResultadoDesconhecido extends Error {
  constructor(funcao: string, valor: string) {
    super(`${funcao} devolveu valor fora do vocabulário: ${JSON.stringify(valor)}`)
    this.name = 'ResultadoDesconhecido'
  }
}

// Vocabulário das funções de escrita da 0012. Object.hasOwn, não indexação
// direta, para 'toString' não virar resultado.
const VOCABULARIO: Record<string, { ok: true } | Falha> = {
  ok: { ok: true },
  nao_encontrado: { ok: false, motivo: 'nao_encontrado' },
  alvo_inativo: { ok: false, motivo: 'alvo_inativo' },
  ja_nesse_estado: { ok: false, motivo: 'ja_nesse_estado' },
}

export function traduzirResultado(funcao: string, valor: string): { ok: true } | Falha {
  if (!Object.hasOwn(VOCABULARIO, valor)) throw new ResultadoDesconhecido(funcao, valor)
  return VOCABULARIO[valor]
}
```

As operações:

```ts
    criar(dados, hash) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ id: string }>(
          'INSERT INTO usuario (nome, email, papel, senha_provisoria_pendente) VALUES ($1, $2, $3, true) RETURNING id',
          [dados.nome, dados.email, dados.papel],
        )
        const id = r.linhas[0].id
        const c = await e<{ credencial_definir: string }>('SELECT credencial_definir($1, $2)', [id, hash])
        const t = traduzirResultado('credencial_definir', c.linhas[0].credencial_definir)
        if (!t.ok) return t
        return { ok: true as const, id }
      })
    },

    definirCredencial(id, hash) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ credencial_definir: string }>('SELECT credencial_definir($1, $2)', [id, hash])
        return traduzirResultado('credencial_definir', r.linhas[0].credencial_definir)
      })
    },

    mudarPapel(id, papel) {
      return tentar(gestorId, async (e) => {
        const r = await e('UPDATE usuario SET papel = $2 WHERE id = $1', [id, papel])
        if (r.afetadas === 0) return NAO_ENCONTRADO
        return { ok: true as const }
      })
    },

    definirSituacao(id, ativo) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ usuario_situacao_definir: string }>('SELECT usuario_situacao_definir($1, $2)', [id, ativo])
        return traduzirResultado('usuario_situacao_definir', r.linhas[0].usuario_situacao_definir)
      })
    },
```

Apagar `alterar` e `desativar`.

- [ ] **Step 4: `servico.ts`**

```ts
export function mudarPapel(repo: RepositorioUsuarios, id: string, papel: Papel): Promise<ResultadoSimples> {
  return repo.mudarPapel(id, papel)
}

export function desativar(repo: RepositorioUsuarios, id: string): Promise<ResultadoSimples> {
  return repo.definirSituacao(id, false)
}

export function reativar(repo: RepositorioUsuarios, id: string): Promise<ResultadoSimples> {
  return repo.definirSituacao(id, true)
}
```

O repositório falso de `servico.test.ts` acompanha a interface nova.

- [ ] **Step 5: `mensagens.ts` e seu teste**

Acrescentar ao `TEXTO_DO_MOTIVO`:

```ts
  alvo_inativo: 'Não dá para definir senha de um usuário desativado. Reative antes.',
  ja_nesse_estado: 'Esse usuário já está nesse estado. Recarregue a lista.',
```

E ao teste, uma asserção por texto novo.

- [ ] **Step 6: `tests/integracao/usuarios.test.ts`**

Trocar `repo.alterar(id, { papel })` por `repo.mudarPapel(id, papel)` e
`repo.desativar(id)` por `repo.definirSituacao(id, false)`. Acrescentar:

```ts
  test('definirSituacao recusa transição sem sentido, com motivo próprio', async () => {
    const repo = repositorioPostgres(gestor)
    const alvo = await criarNaTabela(banco, 'vendedor', 'Transicao')
    expect(await repo.definirSituacao(alvo, false)).toEqual({ ok: true })
    expect(await repo.definirSituacao(alvo, false)).toEqual({ ok: false, motivo: 'ja_nesse_estado' })
    expect(await repo.definirCredencial(alvo, hash)).toEqual({ ok: false, motivo: 'alvo_inativo' })
    expect(await repo.definirSituacao(alvo, true)).toEqual({ ok: true })
    expect(await repo.definirSituacao(alvo, true)).toEqual({ ok: false, motivo: 'ja_nesse_estado' })
  })
```

O teste "vendedor em qualquer operação" muda: `desativar` e `mudarPapel` de um
vendedor davam `nao_encontrado` pela política; agora `desativar` passa pela
função e dá `sem_permissao`. `mudarPapel` continua `nao_encontrado`, porque
segue sendo `UPDATE` pela política.

- [ ] **Step 7: Rodar tudo**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS, incluindo `usuarios.test.ts`.

- [ ] **Step 8: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/features/usuarios tests/integracao/usuarios.test.ts
git commit -m "usuarios: interface encolhida e vocabulário traduzido com erro em valor desconhecido"
```

---

### Task 3: Invariantes, escopo ampliado e `PUBLIC`

**Files:**
- Modify: `src/server/db/migracoes/invariantes.ts` (+ `.test.ts`), `tests/integracao/runner.test.ts`

**Interfaces:**
- Produces: `FUNCOES_DE_ACESSO_OBRIGATORIAS` (renomeada de `FUNCOES_DE_ACESSO`) e `FUNCOES_CONCEDIDAS_A_APP_USUARIO` (substitui `FUNCOES_DE_USUARIO_EM_AUTENTICACAO`, que **deixa de existir**).

Duas constantes, duas perguntas diferentes: uma diz quais funções **têm que
existir**, a outra diz quais podem **ter `GRANT`** para `app_usuario`. As cinco
funções de acesso aparecem nas duas, de propósito.

A leitura nova não usa `prosrc`: é `p.prosecdef` mais
`has_function_privilege('app_usuario', p.oid, 'EXECUTE')`, sobre todo schema de
aplicação. Com isso some o limite de substring que a 0c documentava, e
`usuario_situacao_definir` passa a ser catalogada.

- [ ] **Step 1: Teste unitário (vermelho)**

Em `invariantes.test.ts`, o `sao()` muda: `funcoesDeUsuarioEmAutenticacao`
vira `funcoesConcedidasAAppUsuario`, com os sete nomes qualificados, e entra
`funcoesExecutaveisPorPublico: []`. `funcoesDeAcesso` passa a nome
qualificado. Testes novos:

```ts
  test('definidora concedida a app_usuario fora da lista, mesmo sem tocar autenticacao', () => {
    const e = sao()
    e.funcoesConcedidasAAppUsuario.push('public.atalho')
    umaViolacao(e, /concedida a app_usuario e não registrada: public\.atalho/)
  })

  test('definidora concedida em outro schema também é acusada', () => {
    const e = sao()
    e.funcoesConcedidasAAppUsuario.push('relatorios.espia')
    umaViolacao(e, /concedida a app_usuario e não registrada: relatorios\.espia/)
  })

  test('função registrada ausente ou sem GRANT é violação, não verde', () => {
    const e = sao()
    e.funcoesConcedidasAAppUsuario = e.funcoesConcedidasAAppUsuario.filter((n) => n !== 'public.eh_gestor')
    umaViolacao(e, /registrada e ausente ou sem GRANT: public\.eh_gestor/)
  })

  test('função de schema de aplicação executável por PUBLIC', () => {
    const e = sao()
    e.funcoesExecutaveisPorPublico = ['public.definir_auditoria']
    umaViolacao(e, /executável por PUBLIC: public\.definir_auditoria/)
  })
```

Os testes antigos que citavam `funcoesDeUsuarioEmAutenticacao` saem, e o que
cobria "função tocando autenticacao sem EXECUTE não é violação" perde o
sentido: o critério deixou de ser tocar `autenticacao`.

- [ ] **Step 2: Rodar e ver o vermelho**

Run: `npx vitest run --project unitario src/server/db/migracoes/invariantes.test.ts`
Expected: FAIL, campo inexistente em `Estado` e as quatro asserções novas.

- [ ] **Step 3: Implementar**

Constantes, com os propósitos separados no comentário:

```ts
// Quais funções TÊM QUE EXISTIR. Ausência é violação, não verde.
export const FUNCOES_DE_ACESSO_OBRIGATORIAS = [
  'public.usuario_atual', 'public.pode_ler', 'public.eh_gestor',
  'public.pode_escrever', 'public.senha_provisoria_de',
] as const

// Quais podem TER GRANT para app_usuario. Lista fechada dos dois lados:
// concedida fora daqui é violação, e nome daqui sem GRANT também.
// As de acesso aparecem nas duas listas de propósito: são definidoras
// concedidas como qualquer outra, e "de acesso" é nome nosso, não do banco.
export const FUNCOES_CONCEDIDAS_A_APP_USUARIO = [
  'public.usuario_atual', 'public.pode_ler', 'public.eh_gestor',
  'public.pode_escrever', 'public.senha_provisoria_de',
  'public.credencial_definir', 'public.usuario_situacao_definir',
] as const
```

`FUNCOES_DE_USUARIO_EM_AUTENTICACAO` é apagada.

Em `Estado`, `funcoesDeUsuarioEmAutenticacao` vira `funcoesConcedidasAAppUsuario: string[]`
e entra `funcoesExecutaveisPorPublico: string[]`. Em `lerEstado`:

```ts
  const concedidas = temAppUsuario
    ? await c.query<{ nome: string }>(`
        SELECT n.nspname || '.' || p.proname AS nome
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE ${SCHEMAS_DO_SISTEMA} AND p.prosecdef
          AND has_function_privilege('app_usuario', p.oid, 'EXECUTE')
        ORDER BY 1`)
    : { rows: [] as { nome: string }[] }

  const publico = await c.query<{ nome: string }>(`
    SELECT n.nspname || '.' || p.proname AS nome
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE ${SCHEMAS_DO_SISTEMA}
      AND (p.proacl IS NULL OR EXISTS (
        SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))
    ORDER BY 1`)
```

A consulta de `funcoesDeAcesso` passa a devolver nome qualificado e a comparar
com `FUNCOES_DE_ACESSO_OBRIGATORIAS`.

Em `avaliar`, três violações: `concedida a app_usuario e não registrada: X`;
`registrada e ausente ou sem GRANT: X`; `função de schema de aplicação
executável por PUBLIC: X (função nova nasce assim; falta REVOKE)`.

- [ ] **Step 4: Controles negativos em `runner.test.ts`**

Substituir os dois controles da 0c, que citavam `autenticacao` no critério, por:

```ts
  test('nomeia definidora concedida a app_usuario fora da lista, sem tocar autenticacao (controle negativo)', async () => {
    await banco.sql("CREATE FUNCTION atalho() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT 1'")
    await banco.sql('REVOKE EXECUTE ON FUNCTION atalho() FROM PUBLIC')
    await banco.sql('GRANT EXECUTE ON FUNCTION atalho() TO app_usuario')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/concedida a app_usuario e não registrada: public\.atalho/)
    } finally {
      await banco.sql('DROP FUNCTION atalho()')
    }
  })

  test('nomeia definidora concedida em schema fora de public (controle negativo)', async () => {
    await banco.sql('CREATE SCHEMA IF NOT EXISTS relatorios')
    await banco.sql(
      "CREATE FUNCTION relatorios.espia() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT count(*)::int FROM autenticacao.sessao'",
    )
    await banco.sql('REVOKE EXECUTE ON FUNCTION relatorios.espia() FROM PUBLIC')
    await banco.sql('GRANT EXECUTE ON FUNCTION relatorios.espia() TO app_usuario')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/não registrada: relatorios\.espia/)
    } finally {
      await banco.sql('DROP FUNCTION relatorios.espia()')
      await banco.sql('DROP SCHEMA relatorios')
    }
  })

  test('nomeia função executável por PUBLIC (controle negativo)', async () => {
    await banco.sql("CREATE FUNCTION sem_revoke() RETURNS int LANGUAGE sql AS 'SELECT 1'")
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/executável por PUBLIC: public\.sem_revoke/)
    } finally {
      await banco.sql('DROP FUNCTION sem_revoke()')
    }
  })
```

O primeiro é o teste que prova o ganho da fatia: uma definidora concedida que
**não toca `autenticacao`** passaria despercebida pelo critério da 0c.

E o teste espelho em `funcoes-usuario.test.ts` passa a comparar
`FUNCOES_CONCEDIDAS_A_APP_USUARIO` com o que o banco devolve, incluindo as
cinco de acesso e `usuario_situacao_definir`.

- [ ] **Step 5: Rodar**

Run: `npm run test:unit && npx vitest run --project integracao tests/integracao/runner.test.ts tests/integracao/schema.test.ts`
Expected: PASS. Se `schema.test.ts` acusar violação real no banco de teste, é função nossa sem `REVOKE`: corrigir na 0012, não afrouxar a invariante.

- [ ] **Step 6: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/server/db/migracoes tests/integracao/runner.test.ts
git commit -m "invariantes: escopo de todos os schemas e nenhuma função executável por PUBLIC"
```

---

### Task 4: Teste da isenção de dono

**Files:**
- Modify: `tests/integracao/politicas.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
test('isenção de dono: definidora lê linha que a política esconde do chamador', async () => {
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [gestor])
  const direto = await banco.comoUsuario(vendedor, (e) =>
    e('SELECT senha_provisoria_pendente FROM usuario WHERE id = $1', [gestor]),
  )
  expect(direto.afetadas).toBe(0)
  const pelaDefinidora = await banco.comoUsuario(vendedor, (e) =>
    e<{ senha_provisoria_de: boolean | null }>('SELECT senha_provisoria_de($1)', [gestor]),
  )
  expect(pelaDefinidora.linhas[0].senha_provisoria_de).toBe(true)
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente = false WHERE id = $1', [gestor])
})
```

Com o comentário acima do teste explicando o diagnóstico: se falhar, a causa
provável é `FORCE ROW LEVEL SECURITY` ligado ou a dona ter deixado de ser dona,
e a consequência esperada é a da `0010.md`, bloqueio geral.

- [ ] **Step 2: Rodar**

Run: `npx vitest run --project integracao tests/integracao/politicas.test.ts`
Expected: PASS. Este teste passa de primeira, e é assim mesmo: ele documenta e
detecta uma suposição já verdadeira, não dirige implementação nova.

- [ ] **Step 3: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add tests/integracao/politicas.test.ts
git commit -m "teste: isenção de dono, suposição da qual usuario_situacao_definir depende"
```

---

### Task 5: Docs e regras

**Files:**
- Modify: `docs/db/0003.md`, `0009.md`, `0010.md`, `0011.md`, `fundacao.md`, `divida-tecnica.md`, `REGRAS.md`

- [ ] **Step 1: Ponteiros de encaminhamento**

Uma linha no topo de cada, logo depois do título:

- `0003.md`: `> **Alterado depois:** a 0012 revogou `EXECUTE` de `PUBLIC` em `definir_auditoria`. Ver `docs/db/0012.md`.`
- `0009.md`: `> **Alterado depois:** a 0012 fez `senha_trocar` gravar `credencial.atualizado_por`. Ver `docs/db/0012.md`.`
- `0011.md`: `> **Alterado depois:** a 0012 trocou o retorno de `credencial_definir` para texto e tornou `sessoes_encerrar_de` interna. Ver `docs/db/0012.md`.`

- [ ] **Step 2: `0010.md` ganha a ligação nova**

Parágrafo dizendo que `FORCE` não só bloqueia as funções de acesso: ele derruba
a isenção de dono da qual `usuario_situacao_definir` depende para ser a
autoridade, e que a tabela das três combinações está na spec da 0c.1.

- [ ] **Step 3: `fundacao.md`**

"Como o gestor define senha" passa a descrever `usuario_situacao_definir` e
`exigir_gestor`, e ganha a frase sobre a autoridade migrar da política para a
função nessa operação, com a política como rede de segurança para `UPDATE`
direto.

- [ ] **Step 4: `divida-tecnica.md`**

Apagar o bloco "Vai para a 0c.1". Dos itens que sobrevivem, apagar os que a
fatia resolveu: `credencial_definir` ignorando o retorno em `criar`,
`alterar(id, {})`, alvo inativo sem teste, o `AND NOT` sem teste.
Acrescentar o que a fatia criou: a conferência redundante custando duas
leituras a mais por desativação.

**Apagar a seção "Proposta com gatilho: invariante única de funções
concedidas".** Ela foi implementada nesta fatia, e a regra do arquivo é que
item resolvido sai. Do que ela previa, sobrevive só um item, que vai para a
lista de limites: função **não** definidora concedida a `app_usuario` fica
fora do catálogo, por decisão, e desuso continua sem catraca.

- [ ] **Step 5: `REGRAS.md`, duas regras**

R-014, função exposta sem consumidor não fica, com a tabela do que é catraca e
do que é bilhete, da seção 8 da spec. R-015, doc de migração cujo objeto foi
alterado depois ganha ponteiro de encaminhamento; tipo bilhete, porque nada
confere que o ponteiro existe.

- [ ] **Step 6: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add docs REGRAS.md
git commit -m "docs: 0c.1, ponteiros de encaminhamento, fundação, dívida e regras R-014 e R-015"
```

---

### Task 6: Verificação e PR

- [ ] **Step 1: Suíte completa**

Run: `npm run typecheck && npm run lint && npm run db:checar && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 2: Aplicar no container e conferir à mão**

```bash
npm run db:aplicar
```

Verificação manual mínima, porque a tela não mudou mas o servidor mudou por
baixo: criar vendedor; gerar nova senha; desativar; **tentar gerar nova senha
para o desativado por requisição forjada**, se possível, ou ao menos confirmar
que a tela não oferece; reativar. Registrar em `divida-tecnica.md` na tabela da
0c, como linha nova, não como tabela nova.

- [ ] **Step 3: Abrir o PR**

Usar `superpowers:finishing-a-development-branch`. Título: `Fatia 0c.1: correções de usuários`.
