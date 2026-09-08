import { Client } from 'pg'
import { lerEnv } from './env'
import { configSsl } from './ssl'

// Caminho de administração: runner, seed e harness de teste. Conecta com a
// URL que receber, sem pool e sem a guarda de papel do pool.ts, porque aqui
// ser superusuário é o esperado. Nunca usar em código de aplicação.
export async function comAdmin<T>(url: string, trabalho: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: url, ssl: configSsl(lerEnv()) })
  await cliente.connect()
  try {
    return await trabalho(cliente)
  } finally {
    await cliente.end()
  }
}

// Troca o nome do banco na URL, mantendo usuário, senha, host e porta.
export function comBanco(url: string, banco: string): string {
  const u = new URL(url)
  u.pathname = `/${banco}`
  return u.toString()
}
