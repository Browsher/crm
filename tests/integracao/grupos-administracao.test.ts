import { afterAll, beforeAll, expect, test } from 'vitest'
import { detalharGrupo, listarGrupos, renomearGrupo, definirSituacaoGrupo } from '@/src/features/empresas/grupos'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let grupo: string
let outro: string
let empresas: string[]

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestora')
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  const inativo = await criarUsuario(banco, 'vendedor', 'Inativo')
  await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [inativo])
  const grupos = await banco.sql<{ id: string }>("INSERT INTO grupo_importacao(nome) VALUES ('Base de testes'), ('Outro') RETURNING id")
  grupo = grupos[0].id
  outro = grupos[1].id
  empresas = (await banco.sql<{ id: string }>(`INSERT INTO empresa(cnpj, razao_social, telefone)
    SELECT '11222333' || lpad(n::text, 6, '0'), 'Empresa ' || n, '11999999999' FROM generate_series(1,7) n RETURNING id`)).map(e => e.id)
  await banco.sql('INSERT INTO grupo_importacao_empresa SELECT $1, unnest($2::uuid[])', [grupo, empresas])
  await banco.sql('INSERT INTO grupo_importacao_empresa VALUES ($1,$2)', [outro, empresas[1]])
  await banco.sql(`INSERT INTO empresa_fila(empresa_id,vendedor_id,reservado_por,reservado_ate,elegivel_em) VALUES
    ($1,$6,NULL,NULL,NULL), ($2,NULL,$6,now()+interval '1 hour',NULL),
    ($3,NULL,NULL,NULL,now()+interval '1 day'), ($4,$7,NULL,NULL,NULL),
    ($5,$7,NULL,NULL,now()+interval '1 day')`, [empresas[2], empresas[3], empresas[4], empresas[5], empresas[6], vendedor, inativo])
})
afterAll(async () => { await banco?.derrubar() })

test('lista sob RLS com origem nula, total global de empresas únicas e grupos fora da página', async () => {
  const r = await listarGrupos(gestor, 1)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.resumo).toEqual({ total: 2, ativos: 2, desativados: 0, empresas: 7 })
  expect(r.grupos.find(g => g.id === grupo)).toMatchObject({ nome: 'Base de testes', arquivoNome: null, autor: null, total: 7 })
  const negado = await listarGrupos(vendedor, 1)
  expect(negado).toEqual({ ok: false, motivo: 'sem_permissao' })
})

test('classifica carteira ativa, reserva, descanso e dono inativo sem duplicar empresas', async () => {
  const r = await detalharGrupo(gestor, grupo, 1)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.contagens).toEqual({ total: 7, disponiveis: 3, carteiras: 1, reservadas: 1, outros: 2 })
  expect(r.impactoDesativacao).toBe(2)
  expect(r.empresas).toHaveLength(7)
  expect(r.empresas.find(e => e.id === empresas[1])?.outrosGrupos).toEqual([{ id: outro, nome: 'Outro', ativo: true }])
  expect(r.empresas.find(e => e.id === empresas[5])).toMatchObject({ situacao: 'disponivel', responsavel: 'Inativo', responsavelAtivo: false })
  expect(r.empresas.find(e => e.id === empresas[6])).toMatchObject({ situacao: 'em_descanso', responsavelAtivo: false })
})

test('id inválido e inexistente não abrem listagem; vendedor é negado', async () => {
  expect(await detalharGrupo(gestor, 'invalido', 1)).toEqual({ ok: false, motivo: 'nao_encontrado' })
  expect(await detalharGrupo(gestor, '00000000-0000-0000-0000-000000000000', 1)).toEqual({ ok: false, motivo: 'nao_encontrado' })
  expect(await detalharGrupo(vendedor, grupo, 1)).toEqual({ ok: false, motivo: 'sem_permissao' })
})

test('desativar preserva outra origem, carteiras e reservas; reativar e renomear usam autoridade SQL', async () => {
  expect(await definirSituacaoGrupo(vendedor, grupo, false)).toEqual({ ok: false, motivo: 'sem_permissao' })
  expect(await definirSituacaoGrupo(gestor, grupo, false)).toEqual({ ok: true })
  const r = await detalharGrupo(gestor, grupo, 1)
  if (!r.ok) throw new Error(r.motivo)
  expect(r.contagens).toEqual({ total: 7, disponiveis: 1, carteiras: 1, reservadas: 1, outros: 4 })
  expect(r.empresas.find(e => e.id === empresas[0])?.situacao).toBe('origem_bloqueada')
  expect(await definirSituacaoGrupo(gestor, grupo, true)).toEqual({ ok: true })
  expect(await renomearGrupo(gestor, grupo, '  Nome novo  ')).toEqual({ ok: true })
  expect(await renomearGrupo(gestor, grupo, '  ')).toEqual({ ok: false, motivo: 'nome_invalido' })
  expect(await renomearGrupo(vendedor, grupo, 'Outro nome')).toEqual({ ok: false, motivo: 'sem_permissao' })
})

test('paginação em 50 mantém resumo global e contagens mesmo além do fim', async () => {
  await banco.sql("INSERT INTO grupo_importacao(nome) SELECT 'Grupo ' || n FROM generate_series(1,51) n")
  const a = await listarGrupos(gestor, 1)
  const b = await listarGrupos(gestor, 2)
  if (!a.ok || !b.ok) throw new Error('listagem negada')
  expect(a.grupos).toHaveLength(50)
  expect(b.grupos).toHaveLength(3)
  expect(a.resumo).toEqual({ total: 53, ativos: 53, desativados: 0, empresas: 7 })
  expect(new Set([...a.grupos, ...b.grupos].map(g => g.id)).size).toBe(53)
  await banco.sql(`WITH novas AS (INSERT INTO empresa(cnpj,razao_social,telefone)
    SELECT '99888777' || lpad(n::text,6,'0'), 'Extra ' || n, '11999999999' FROM generate_series(1,51) n RETURNING id)
    INSERT INTO grupo_importacao_empresa SELECT $1,id FROM novas`, [grupo])
  const detalhe = await detalharGrupo(gestor, grupo, 2)
  const vazio = await detalharGrupo(gestor, grupo, 99)
  if (!detalhe.ok || !vazio.ok) throw new Error('detalhe negado')
  expect(detalhe.empresas).toHaveLength(8)
  expect(detalhe.contagens).toEqual({ total: 58, disponiveis: 54, carteiras: 1, reservadas: 1, outros: 2 })
  expect(vazio.empresas).toEqual([])
  expect(vazio.contagens.total).toBe(58)
})
