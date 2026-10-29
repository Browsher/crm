import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedor: string
let empresa: string
beforeAll(async () => { banco = await criarBancoDeTeste(); vendedor = await criarUsuario(banco, 'vendedor', 'Arquivo') })
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  const [e] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Arquivo','11987654321') RETURNING id")
  empresa = e.id
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'banco')", [empresa, vendedor])
})
async function rpc(nome: string, args: unknown[]) {
  return banco.comoUsuario(vendedor, async e => (await e<{ r: { ok: boolean; motivo?: string; versao: number; repetida: boolean } }>(`SELECT ${nome}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS r`, args)).linhas[0].r)
}
async function versao() { return (await banco.sql<{ versao: number }>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0].versao }
async function interessado() {
  expect(await rpc('contato_registrar_direto', [empresa, randomUUID(), await versao(), 'interessado', null, 'Enviar proposta', '2027-03-02'])).toMatchObject({ ok: true })
  return (await banco.sql<{ id: string }>('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresa]))[0].id
}
test('arraste arquiva sem contato fictício, retomar não ressuscita agenda nem negociação; replay não reaplica arquivo', async () => {
  const negociacao = await interessado()
  const antes = await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [empresa])
  const chave = randomUUID()
  const velha = await versao()
  const r = await rpc('empresa_sem_interesse_definir', [empresa, chave, velha, negociacao])
  expect(r.ok).toBe(true)
  expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [empresa])).toEqual(antes)
  expect((await banco.sql('SELECT encerramento FROM negociacao WHERE id=$1', [negociacao]))[0]).toEqual({ encerramento: 'sem_interesse' })
  expect(await rpc('empresa_atendimento_retomar', [empresa, randomUUID(), r.versao])).toMatchObject({ ok: true })
  expect(await rpc('empresa_sem_interesse_definir', [empresa, chave, velha, negociacao])).toEqual({ ...r, repetida: true })
  expect((await banco.sql('SELECT arquivada_em,agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0]).toEqual({ arquivada_em: null, agenda_contato_id: null })
  expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresa])).toEqual([])
  expect(await rpc('contato_registrar_direto', [empresa, randomUUID(), await versao(), 'interessado', null, null, null])).toMatchObject({ ok: true })
  expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresa])).toHaveLength(1)
})
test('contato real sem interesse insere exatamente uma vez e cancela agenda', async () => {
  await interessado()
  const args = [empresa, randomUUID(), await versao(), 'sem_interesse', 'Recusou', null, null]
  expect(await rpc('contato_registrar_direto', args)).toMatchObject({ ok: true, repetida: false })
  expect(await rpc('contato_registrar_direto', args)).toMatchObject({ ok: true, repetida: true })
  expect(await banco.sql("SELECT * FROM contato WHERE empresa_id=$1 AND tipo='sem_interesse'", [empresa])).toHaveLength(1)
  expect((await banco.sql('SELECT agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0]).toEqual({ agenda_contato_id: null })
})
test('referência de negociação antiga ou encerrada recusa arquivamento sem mudar estado', async () => {
  const n = await interessado()
  await banco.sql("UPDATE negociacao SET encerrada_em=clock_timestamp(),encerramento='devolucao' WHERE id=$1", [n])
  await banco.sql('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2)', [empresa, vendedor])
  const antes = await banco.sql('SELECT * FROM empresa_vinculo WHERE empresa_id=$1', [empresa])
  expect(await rpc('empresa_sem_interesse_definir', [empresa, randomUUID(), await versao(), n])).toEqual({ ok: false, motivo: 'desatualizada' })
  expect(await banco.sql('SELECT * FROM empresa_vinculo WHERE empresa_id=$1', [empresa])).toEqual(antes)
})
test('venda posterior invalida aba antiga; arquivar cliente preserva venda e interesse seguinte não abre primeira venda', async () => {
  const n = await interessado()
  const velha = await versao()
  const resultado = await banco.comoUsuario(vendedor, e => e('SELECT funil_venda_registrar($1,$2,current_date,100,NULL) AS r', [n, randomUUID()]))
  expect(resultado.linhas[0]).toEqual({ r: 'ok' })
  const vendas = await banco.sql('SELECT * FROM venda WHERE empresa_id=$1', [empresa])
  expect(await rpc('empresa_sem_interesse_definir', [empresa, randomUUID(), velha, null])).toEqual({ ok: false, motivo: 'desatualizada' })
  const r = await rpc('empresa_sem_interesse_definir', [empresa, randomUUID(), await versao(), null])
  expect(r.ok).toBe(true)
  expect(await banco.sql('SELECT * FROM venda WHERE empresa_id=$1', [empresa])).toEqual(vendas)
  expect(await rpc('empresa_atendimento_retomar', [empresa, randomUUID(), r.versao])).toMatchObject({ ok: true })
  expect(await rpc('contato_registrar_direto', [empresa, randomUUID(), await versao(), 'interessado', null, null, null])).toMatchObject({ ok: true })
  expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresa])).toEqual([])
  const seguinte = await banco.comoUsuario(vendedor, e => e('SELECT carteira_venda_registrar($1,$2,current_date,200,NULL) AS r', [empresa, randomUUID()]))
  expect(seguinte.linhas[0]).toEqual({ r: 'ok' })
})

test('venda e arquivamento concorrentes compartilham trava e rejeitam o perdedor sem perder histórico', async () => {
  const n = await interessado()
  const velha = await versao()
  const [arquivo, venda] = await Promise.all([
    rpc('empresa_sem_interesse_definir', [empresa, randomUUID(), velha, n]),
    banco.comoUsuario(vendedor, async e => (await e<{ r: string }>('SELECT funil_venda_registrar($1,$2,current_date,100,NULL) AS r', [n, randomUUID()])).linhas[0].r),
  ])
  expect(Number(arquivo.ok) + Number(venda === 'ok')).toBe(1)
  expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [empresa])).toHaveLength(1)
  if (venda === 'ok') {
    expect(arquivo).toEqual({ ok: false, motivo: 'desatualizada' })
    expect(await banco.sql('SELECT * FROM venda WHERE empresa_id=$1', [empresa])).toHaveLength(1)
    expect((await banco.sql('SELECT arquivada_em FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0]).toEqual({ arquivada_em: null })
  } else {
    expect(venda).toBe('encerrada')
    expect(await banco.sql('SELECT * FROM venda WHERE empresa_id=$1', [empresa])).toEqual([])
  }
})
