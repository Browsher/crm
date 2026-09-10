import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { assumir, devolver, puxarProxima } from '@/src/features/fila/repositorio'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  await banco.sql(
    `INSERT INTO cep (cep, logradouro, faixa, bairro, localidade, uf, ibge)
     VALUES ('01310100', 'Avenida Paulista', 'lado par', 'Bela Vista', 'São Paulo', 'SP', '3550308')`,
  )
})
afterAll(async () => {
  await banco.derrubar()
})

beforeEach(async () => {
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
})

async function criarEmpresa(cep: string | null): Promise<string> {
  const [linha] = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, contato_nome, telefone, cep)
     VALUES ('11222333000181', 'Aurora Comercio LTDA', 'Dona Aurora', '11987654321', $1) RETURNING id`,
    [cep],
  )
  return linha.id
}

describe('lerMinhasEmpresas', () => {
  test('sem nada, devolve reserva nula e carteira vazia', async () => {
    const r = await lerMinhasEmpresas(vendedor)
    expect(r).toEqual({ ok: true, reserva: null, carteira: [] })
  })

  test('a reserva vem com contato e endereco resolvido', async () => {
    await criarEmpresa('01310100')
    await puxarProxima(vendedor)
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.carteira).toEqual([])
    expect(r.reserva?.contatoNome).toBe('Dona Aurora')
    expect(r.reserva?.endereco?.localidade).toBe('São Paulo')
    expect(r.reserva?.reservadoAte).toBeInstanceOf(Date)
    expect(r.reserva?.posse).toBe(false)
  })

  // O terceiro estado do CEP, herdado da fatia empresas: CEP que a base não
  // resolve não é CEP ausente, e a tela diz coisas diferentes para os dois.
  test('CEP fora da base vira endereco nulo, sem lancar', async () => {
    await criarEmpresa('00000000')
    await puxarProxima(vendedor)
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.reserva?.cep).toBe('00000000')
    expect(r.reserva?.endereco).toBeNull()
  })

  test('empresa sem CEP tambem vem, com endereco nulo', async () => {
    await criarEmpresa(null)
    await puxarProxima(vendedor)
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.reserva?.cep).toBeNull()
    expect(r.reserva?.endereco).toBeNull()
  })

  test('assumida sai da reserva e entra na carteira', async () => {
    const id = await criarEmpresa('01310100')
    await puxarProxima(vendedor)
    expect(await assumir(vendedor, id)).toEqual({ ok: true })
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.reserva).toBeNull()
    expect(r.carteira).toHaveLength(1)
    expect(r.carteira[0].posse).toBe(true)
    expect(r.carteira[0].reservadoAte).toBeNull()
  })

  test('devolvida sai das duas', async () => {
    const id = await criarEmpresa('01310100')
    await puxarProxima(vendedor)
    await assumir(vendedor, id)
    expect(await devolver(vendedor, id)).toEqual({ ok: true })
    expect(await lerMinhasEmpresas(vendedor)).toEqual({ ok: true, reserva: null, carteira: [] })
  })

  test('reserva expirada nao aparece como reserva', async () => {
    const id = await criarEmpresa('01310100')
    await puxarProxima(vendedor)
    await banco.sql("UPDATE empresa_fila SET reservado_ate = now() - interval '1 minute' WHERE empresa_id = $1", [id])
    const r = await lerMinhasEmpresas(vendedor)
    expect(r).toEqual({ ok: true, reserva: null, carteira: [] })
  })

  test('senha provisoria pendente vira sem_permissao, nao excecao', async () => {
    const pendente = await criarUsuario(banco, 'vendedor', 'PendenteConsulta')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [pendente])
    await criarEmpresa('01310100')
    expect(await puxarProxima(pendente)).toEqual({ ok: false, motivo: 'sem_permissao' })
  })
})
