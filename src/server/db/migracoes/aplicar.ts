import type { Client } from 'pg'
import { comAdmin } from '../admin'
import { lerMigracoes, type Migracao } from './arquivos'
import { checarMigracoes } from './checar'

export const PAPEIS_APLICACAO = ['app_conexao', 'app_usuario'] as const

export type Situacao = {
  aplicadas: string[]
  pendentes: string[]
  divergentes: { nome: string; somaNoBanco: string; somaNoArquivo: string }[]
}

type Registro = { nome: string; soma: string }

async function lerRegistros(cliente: Client): Promise<Registro[] | null> {
  const existe = await cliente.query(
    "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_migracao'",
  )
  if (existe.rowCount === 0) return null
  const { rows } = await cliente.query<Registro>('SELECT nome, soma FROM _migracao')
  return rows
}

function classificar(arquivos: Migracao[], registros: Registro[]): Situacao {
  const noBanco = new Map(registros.map((r) => [r.nome, r.soma]))
  const s: Situacao = { aplicadas: [], pendentes: [], divergentes: [] }
  for (const a of arquivos) {
    const soma = noBanco.get(a.nome)
    if (soma === undefined) s.pendentes.push(a.nome)
    else if (soma === a.soma) s.aplicadas.push(a.nome)
    else s.divergentes.push({ nome: a.nome, somaNoBanco: soma, somaNoArquivo: a.soma })
  }
  return s
}

// Só lê. Funciona com papel que tenha apenas SELECT em _migracao.
export async function situacao(url: string, pasta: string): Promise<Situacao> {
  const arquivos = await lerMigracoes(pasta)
  return comAdmin(url, async (c) => classificar(arquivos, (await lerRegistros(c)) ?? []))
}

async function prepararControle(cliente: Client): Promise<void> {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS _migracao (
      nome        text PRIMARY KEY,
      soma        text NOT NULL,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )`)
  await cliente.query(
    'DO $$ BEGIN CREATE ROLE app_conferencia NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$',
  )
  await cliente.query('GRANT SELECT ON _migracao TO app_conferencia')
  // PAPEIS_APLICACAO é constante do código, não entrada externa.
  for (const papel of PAPEIS_APLICACAO) {
    await cliente.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${papel}') THEN
        REVOKE ALL ON _migracao FROM ${papel};
      END IF;
    END $$`)
  }
}

// O runner é dono da transação: corpo da migração e registro em _migracao
// entram juntos ou não entram. Sem janela entre aplicar e registrar.
async function aplicarUma(cliente: Client, m: Migracao): Promise<void> {
  await cliente.query('BEGIN')
  try {
    await cliente.query(m.corpo)
    await cliente.query('INSERT INTO _migracao (nome, soma) VALUES ($1, $2)', [m.nome, m.soma])
    await cliente.query('COMMIT')
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  }
}

export type ResultadoAplicar =
  | { ok: true; aplicadas: string[] }
  | { ok: false; motivo: string; divergentes?: Situacao['divergentes']; problemas?: string[] }

export async function aplicar(url: string, pasta: string): Promise<ResultadoAplicar> {
  const arquivos = await lerMigracoes(pasta)
  const checagem = checarMigracoes(arquivos)
  if (!checagem.ok) return { ok: false, motivo: 'checador reprovou', problemas: checagem.problemas }

  return comAdmin(url, async (c) => {
    await prepararControle(c)
    const s = classificar(arquivos, (await lerRegistros(c)) ?? [])
    if (s.divergentes.length) {
      return { ok: false, motivo: 'migração aplicada foi alterada', divergentes: s.divergentes }
    }

    const aplicadas: string[] = []
    for (const m of arquivos) {
      if (!s.pendentes.includes(m.nome)) continue
      await aplicarUma(c, m)
      aplicadas.push(m.nome)
    }
    // Papéis podem ter nascido agora, na 0000: refaz o REVOKE.
    await prepararControle(c)
    return { ok: true, aplicadas }
  })
}
