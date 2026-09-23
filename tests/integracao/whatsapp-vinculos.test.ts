import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outro: string
const repo = () => import('@/src/server/whatsapp/vinculos')

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'GestoraWhats')
  vendedor = await criarUsuario(banco, 'vendedor', 'AnaWhats')
  outro = await criarUsuario(banco, 'vendedor', 'BiaWhats')
})
afterAll(async () => { await banco?.derrubar() })

test('tabela tem RLS habilitada e forçada', async () => {
  expect(await banco.sql("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.whatsapp_vinculo')"))
    .toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
})

test('gestor salva, substitui com novo identificador, lista e remove somente o vínculo', async () => {
  const r = await repo()
  expect(await r.salvarVinculo(gestor, vendedor, 'ana')).toEqual({ ok: true })
  const [primeiro] = await r.listarVinculos(gestor)
  expect(primeiro).toMatchObject({ vendedorId: vendedor, nome: 'AnaWhats', instancia: 'ana', ativo: true })
  expect(await r.salvarVinculo(gestor, vendedor, 'ana')).toEqual({ ok: true })
  expect((await r.listarVinculos(gestor))[0].id).toBe(primeiro.id)
  expect(await r.salvarVinculo(gestor, vendedor, 'ana-nova')).toEqual({ ok: true })
  const [novo] = await r.listarVinculos(gestor)
  expect(novo.id).not.toBe(primeiro.id)
  expect(await r.removerVinculo(gestor, primeiro.id)).toEqual({ ok: false, motivo: 'nao_encontrado' })
  expect(await r.removerVinculo(gestor, novo.id)).toEqual({ ok: true })
  expect(await r.listarVinculos(gestor)).toEqual([])
  expect(await r.listarVendedores(gestor)).toEqual([{ id: vendedor, nome: 'AnaWhats' }, { id: outro, nome: 'BiaWhats' }])
})

test('unicidade de instância impede tomar vínculo de outro vendedor', async () => {
  const r = await repo()
  expect(await r.salvarVinculo(gestor, vendedor, 'unica')).toEqual({ ok: true })
  expect(await r.salvarVinculo(gestor, outro, 'unica')).toEqual({ ok: false, motivo: 'instancia_em_uso' })
  expect(await r.listarVinculos(gestor)).toHaveLength(1)
})

test('vendedor não lê, escreve nem remove vínculo via repositório ou SQL direto', async () => {
  const r = await repo()
  expect(await r.listarVinculos(vendedor)).toEqual([])
  expect(await r.listarVendedores(vendedor)).toEqual([])
  expect(await r.salvarVinculo(vendedor, outro, 'proibida')).toEqual({ ok: false, motivo: 'sem_permissao' })
  const [v] = await r.listarVinculos(gestor)
  expect((await r.removerVinculo(vendedor, v.id)).ok).toBe(false)
  expect(await banco.comoUsuario(vendedor, e => e('SELECT * FROM whatsapp_vinculo'))).toMatchObject({ linhas: [] })
  await expect(banco.comoUsuario(vendedor, e => e('INSERT INTO whatsapp_vinculo(vendedor_id, instancia) VALUES ($1,$2)', [vendedor, 'direta'])))
    .rejects.toMatchObject({ code: '42501' })
  expect(await banco.comoUsuario(vendedor, e => e('DELETE FROM whatsapp_vinculo'))).toMatchObject({ afetadas: 0 })
})

test('gestor com senha provisória não salva nem remove', async () => {
  const r = await repo()
  const pendente = await criarUsuario(banco, 'gestor', 'PendenteWhats')
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [pendente])
  expect(await r.salvarVinculo(pendente, outro, 'pendente')).toEqual({ ok: false, motivo: 'sem_permissao' })
  const [v] = await r.listarVinculos(gestor)
  expect((await r.removerVinculo(pendente, v.id)).ok).toBe(false)
  expect(await r.listarVinculos(gestor)).toHaveLength(1)
})

test('banco recusa alvo inválido e mostra vínculo indisponível após mudança de papel ou desativação', async () => {
  const r = await repo()
  for (const alvo of [gestor, '00000000-0000-0000-0000-000000000000']) {
    expect(await r.salvarVinculo(gestor, alvo, 'invalida')).toEqual({ ok: false, motivo: 'vendedor_invalido' })
  }
  await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [vendedor])
  expect((await r.listarVinculos(gestor))[0].ativo).toBe(false)
  expect(await r.salvarVinculo(gestor, vendedor, 'inativa')).toEqual({ ok: false, motivo: 'vendedor_invalido' })
  await banco.sql("UPDATE usuario SET ativo = true, papel = 'gestor' WHERE id = $1", [vendedor])
  expect((await r.listarVinculos(gestor))[0].ativo).toBe(false)
  expect(await r.listarVendedores(gestor)).toEqual([{ id: outro, nome: 'BiaWhats' }])
  await expect(banco.comoUsuario(gestor, e => e('INSERT INTO whatsapp_vinculo(vendedor_id, instancia) VALUES ($1,$2)', [gestor, 'direta'])))
    .rejects.toMatchObject({ code: '23514' })
})

test('banco rejeita instância vazia, espaços externos e caracteres de controle', async () => {
  const r = await repo()
  for (const instancia of ['', ' teste ', 'linha\nquebrada']) {
    expect(await r.salvarVinculo(gestor, outro, instancia)).toEqual({ ok: false, motivo: 'instancia_invalida' })
  }
})
