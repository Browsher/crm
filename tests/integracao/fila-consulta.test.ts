import { vincularGrupoAtivo } from './grupos-fixtures'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { contatoDireto } from './fixtures/contato-direto'

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
  // `contato` tem FK ON DELETE RESTRICT para `empresa`: apagar empresa antes
  // derruba com 23503.
  await banco.sql('DELETE FROM empresa_atendimento_operacao; DELETE FROM empresa_vinculo; DELETE FROM negociacao')
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql('DELETE FROM empresa')
})

async function criarEmpresa(cep: string | null): Promise<string> {
  const [linha] = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, contato_nome, telefone, cep)
     VALUES ('11222333000181', 'Aurora Comercio LTDA', 'Dona Aurora', '11987654321', $1) RETURNING id`,
    [cep],
  )
  await vincularGrupoAtivo(banco, [linha.id])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[linha.id,vendedor])
  return linha.id
}

const assumir = (usuarioId: string, empresaId: string) =>
  contatoDireto(banco, usuarioId, empresaId, {
    tipo: 'interessado', nota: null, proximoPasso: null, proximoPassoData: null,
  })

const devolver = (usuarioId: string, empresaId: string) =>
  contatoDireto(banco, usuarioId, empresaId, {
    tipo: 'sem_interesse', nota: null, proximoPasso: null, proximoPassoData: null,
  })

describe('lerMinhasEmpresas', () => {
  test('sem nada, devolve reserva nula e carteira vazia', async () => {
    const r = await lerMinhasEmpresas(vendedor)
    expect(r).toEqual({ ok: true, reserva: null, carteira: [], contexto: null })
  })

  test('vínculo vem com contato e endereço resolvido sem prazo', async () => {
    await criarEmpresa('01310100')
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.carteira[0]?.contatoNome).toBe('Dona Aurora')
    expect(r.carteira[0]?.endereco?.localidade).toBe('São Paulo')
    expect(r.carteira[0]?.reservadoAte).toBeNull()
    expect(r.carteira[0]?.posse).toBe(true)
  })

  // O terceiro estado do CEP, herdado da fatia empresas: CEP que a base não
  // resolve não é CEP ausente, e a tela diz coisas diferentes para os dois.
  test('CEP fora da base vira endereco nulo, sem lancar', async () => {
    await criarEmpresa('00000000')
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.carteira[0]?.cep).toBe('00000000')
    expect(r.carteira[0]?.endereco).toBeNull()
  })

  test('empresa sem CEP tambem vem, com endereco nulo', async () => {
    await criarEmpresa(null)
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.carteira[0]?.cep).toBeNull()
    expect(r.carteira[0]?.endereco).toBeNull()
  })

  test('interesse mantém a empresa pessoal e não cria reserva', async () => {
    const id = await criarEmpresa('01310100')
    expect(await assumir(vendedor, id)).toMatchObject({ ok: true })
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.reserva).toBeNull()
    expect(r.carteira).toHaveLength(1)
    expect(r.carteira[0].posse).toBe(true)
    expect(r.carteira[0].reservadoAte).toBeNull()
  })

  test('arquivo permanece pessoal com agenda cancelada',async()=>{
    const id=await criarEmpresa(null)
    await assumir(vendedor,id)
    expect(await devolver(vendedor,id)).toMatchObject({ok:true})
    const r=await lerMinhasEmpresas(vendedor)
    expect(r.ok&&r.carteira).toMatchObject([{id,situacao:'sem_interesse',proximoPasso:null}])
  })
  test('recebimento antigo permanece legível sem renovar reserva',async()=>{
    const id=await criarEmpresa(null)
    await banco.sql("UPDATE empresa_vinculo SET recebida_em=now()-interval '1 year' WHERE empresa_id=$1",[id])
    const r=await lerMinhasEmpresas(vendedor)
    expect(r.ok&&r.carteira.map(x=>x.id)).toEqual([id])
  })

})

// `criarEmpresa` usa CNPJ fixo; estes testes precisam de várias.
async function criarEmpresaN(sufixo: string, razao: string): Promise<string> {
  const [linha] = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, telefone)
     VALUES ($1, $2, '11987654321') RETURNING id`,
    [`1122233300${sufixo}`, razao],
  )
  await vincularGrupoAtivo(banco, [linha.id])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[linha.id,vendedor])
  return linha.id
}

// Escreve pelo caminho de verdade: `definir_auditoria` sobrescreve criado_em e
// criado_por, então semear contato como dona não controla nem autor nem ordem.
// Transações separadas é o que dá dois now() diferentes.
function acompanhar(
  usuarioId: string,
  empresaId: string,
  passo: string | null,
  data: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  return contatoDireto(banco, usuarioId, empresaId, {
    tipo: passo===null?'nao_atendeu':'acompanhamento',
    nota: null,
    proximoPasso: passo,
    proximoPassoData: data,
  })
}

describe('carteira: o proximo passo derivado do contato mais recente', () => {
  test('empresa sem contato vem com proximo passo nulo e vencido falso', async () => {
    const id = await criarEmpresaN('0181', 'Aurora')
    expect(await assumir(vendedor, id)).toMatchObject({ ok: true })
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava sucesso')
    expect(r.carteira[0]).toMatchObject({ proximoPasso: null, proximoPassoData: null, vencido: false })
  })

  test('o contato MAIS RECENTE manda', async () => {
    const id = await criarEmpresaN('0181', 'Aurora')
    await assumir(vendedor, id)
    await acompanhar(vendedor, id, 'antigo', '2026-01-01')
    await acompanhar(vendedor, id, 'recente', '2027-01-01')
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava sucesso')
    expect(r.carteira[0].proximoPasso).toBe('recente')
    expect(r.carteira[0].proximoPassoData).toBe('2027-01-01')
  })

  // A decisão que evita o compromisso ressuscitado: registrar contato SEM
  // próximo passo significa "não há próximo passo", e não "vale o anterior".
  test('contato mais recente SEM passo apaga o passo anterior', async () => {
    const id = await criarEmpresaN('0181', 'Aurora')
    await assumir(vendedor, id)
    await acompanhar(vendedor, id, 'combinado', '2027-01-01')
    await acompanhar(vendedor, id, null, null)
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava sucesso')
    expect(r.carteira[0].proximoPasso).toBeNull()
  })

  test('data de ontem vem como vencido; a de amanha nao', async () => {
    const id = await criarEmpresaN('0181', 'Aurora')
    await assumir(vendedor, id)
    const [{ ontem, amanha }] = await banco.sql<{ ontem: string; amanha: string }>(
      `SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, 'YYYY-MM-DD') AS ontem,
              to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1, 'YYYY-MM-DD') AS amanha`,
    )
    await acompanhar(vendedor, id, 'atrasado', ontem)
    const vencida = await lerMinhasEmpresas(vendedor)
    if (!vencida.ok) throw new Error('esperava sucesso')
    expect(vencida.carteira[0].vencido).toBe(true)

    await acompanhar(vendedor, id, 'em dia', amanha)
    const emDia = await lerMinhasEmpresas(vendedor)
    if (!emDia.ok) throw new Error('esperava sucesso')
    expect(emDia.carteira[0].vencido).toBe(false)
  })

  test('a carteira vem ordenada por data, com os sem passo por ultimo', async () => {
    const futura = await criarEmpresaN('0181', 'Aurora')
    const vencida = await criarEmpresaN('0262', 'Boreal')
    const semPasso = await criarEmpresaN('0343', 'Cristal')
    for (const id of [futura, vencida, semPasso]) {
        await assumir(vendedor, id)
    }
    await acompanhar(vendedor, futura, 'futura', '2030-01-01')
    await acompanhar(vendedor, vencida, 'vencida', '2020-01-01')
    const r = await lerMinhasEmpresas(vendedor)
    if (!r.ok) throw new Error('esperava sucesso')
    expect(r.carteira.map((c) => c.proximoPasso)).toEqual(['vencida', 'futura', null])
  })
})
