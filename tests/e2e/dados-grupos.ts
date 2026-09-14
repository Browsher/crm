import type { Client } from 'pg'
import { comAdmin } from '../../src/server/db/admin'
import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { exigirAdminLocal } from './ambiente'

export const GRUPOS = [
  ['00000000-0000-4000-8000-000000000701', 'Mooca · Lojas de iluminação', 'mooca-setembro.xlsx', true],
  ['00000000-0000-4000-8000-000000000702', 'Tatuapé · Comércio local', 'tatuape-setembro.xlsx', true],
  ['00000000-0000-4000-8000-000000000703', 'Pinheiros · Arquitetura', 'pinheiros-arquitetura.xlsx', true],
  ['00000000-0000-4000-8000-000000000704', 'Santo André · Reativação', 'santo-andre.xlsx', false],
  ['00000000-0000-4000-8000-000000000705', 'Guarulhos · Material elétrico', 'guarulhos.xlsx', true],
  ['00000000-0000-4000-8000-000000000706', 'Base de testes', null, true],
] as const

export const CNPJ_JORNADA_NOVA = '90807060000707'
export const CNPJ_JORNADA_OVERLAP = '90807060000880'
export const CNPJ_JORNADA_CARTEIRA = '90807060000960'

export async function comBancoGrupos<T>(trabalho: (cliente: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('Execute pelo harness E2E')
  exigirAdminLocal(url)
  if (!/^\/teste_[0-9a-f]{12}$/.test(new URL(url).pathname)) throw new Error('Banco temporário obrigatório')
  return comAdmin(url, trabalho)
}

// Chamado pelo spec ou demo, nunca no boot da aplicação nem antes das jornadas
// antigas. IDs e CNAEs próprios não mudam o alvo dos testes de seleção automática.
export async function prepararGrupos(banco: BancoDeTeste) {
  const gestor = await criarUsuarioComSenha(banco, 'gestor', 'gruposgestore2e', 'Senha-e2e-2026')
  const vendedor = await criarUsuarioComSenha(banco, 'vendedor', 'gruposvendedore2e', 'Senha-e2e-2026')
  for (const [id, nome, arquivo, ativo] of GRUPOS) {
    await banco.sql(`WITH identidade AS MATERIALIZED (
      SELECT set_config('app.usuario_id', $5, true)
    ) INSERT INTO grupo_importacao(id,nome,arquivo_nome,ativo)
      SELECT $1,$2,$3,$4 FROM identidade`, [id, nome, arquivo, ativo, arquivo ? gestor.id : ''])
  }
  const nomes = ['Luz Aurora fictícia', 'Casa Cedro fictícia', 'Projeto Boreal fictício', 'Luz Dourada fictícia', 'Oficina Estrela fictícia', 'Elétrica Horizonte fictícia']
  const cnpjs = ['90807060000103', '90807060000294', '90807060000375', '90807060000456', '90807060000537', '90807060000618']
  const ids: string[] = []
  for (let i = 0; i < nomes.length; i++) {
    const [{ id }] = await banco.sql<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,telefone,cnae_principal)
      VALUES ($1,$2,'11999990701','7777701') RETURNING id`, [cnpjs[i], nomes[i]])
    ids.push(id)
  }
  // Mooca inclui disponível, overlap, carteira, reserva e descanso.
  const membros = [[0, 1, 2, 3, 4], [1], [2], [5], [3], [5]]
  for (let i = 0; i < GRUPOS.length; i++) {
    await banco.sql(`INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id)
      SELECT $1, unnest($2::uuid[])`, [GRUPOS[i][0], membros[i].map(n => ids[n])])
  }
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [ids[2], vendedor.id])
  await banco.sql(`INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate)
    VALUES ($1,$2,now()+interval '30 minutes')`, [ids[3], vendedor.id])
  await banco.sql(`INSERT INTO empresa_fila(empresa_id,elegivel_em) VALUES ($1,now()+interval '2 days')`, [ids[4]])
  return { gestor, vendedor }
}

// Adapta somente sql/URL do banco já criado pelo harness. Não cria outro banco.
export function bancoGruposDoHarness(): BancoDeTeste {
  return {
    nome: new URL(process.env.DATABASE_URL_ADMIN!).pathname.slice(1),
    urlAdmin: process.env.DATABASE_URL_ADMIN!, urlApp: process.env.DATABASE_URL!,
    sql: <T>(texto: string, params?: unknown[]) => comBancoGrupos(async c => (await c.query(texto, params)).rows as T[]),
    comoUsuario: () => { throw new Error('Não usado pelo preparador E2E') },
    derrubar: () => { throw new Error('Limpeza pertence ao harness') },
  }
}
