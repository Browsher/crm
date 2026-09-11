import { afterAll, beforeAll, expect, test } from 'vitest'
import { lerConsulta } from '@/src/features/empresas/consulta'
import { listarEmpresas } from '@/src/features/empresas/listagem'
import { repositorioPostgres } from '@/src/features/empresas/repositorio'
import { importar } from '@/src/features/empresas/servico'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
const cabecalho = 'cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep'
const csv = (cnpj: string, cnae?: string) => new TextEncoder().encode(
  `${cabecalho}${cnae === undefined ? '' : ',cnae_principal'}\n${cnpj},Empresa CNAE,,,11987654321,,${cnae === undefined ? '' : `,${cnae}`}`,
)

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'GestorCnae')
  vendedor = await criarUsuario(banco, 'vendedor', 'VendedorCnae')
})
afterAll(async () => { if (banco) await banco.derrubar() })

test('coluna opcional nasce nula para INSERT legado', async () => {
  await banco.comoUsuario(gestor, (e) => e("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ('11444777000161','Legada','11987654321')"))
  expect(await banco.sql('SELECT cnae_principal FROM empresa WHERE cnpj=$1', ['11444777000161'])).toEqual([{ cnae_principal: null }])
})

test('importa CNAE pontuado e lista o código normalizado', async () => {
  expect(await importar(repositorioPostgres(gestor), csv('11222333000181', '4742-3/00'))).toMatchObject({ ok: true, inseridas: 1 })
  const lista = await listarEmpresas(gestor, lerConsulta({ q: '11222333000181' }))
  expect(lista).toMatchObject({ ok: true, linhas: [{ cnpj: '11222333000181', cnaePrincipal: '4742300' }] })
})

test('reimportação não atualiza CNAE de CNPJ existente', async () => {
  expect(await importar(repositorioPostgres(gestor), csv('11444777000161', '4742300'))).toMatchObject({ ok: true, inseridas: 0, relatorio: { jaCadastradas: 1 } })
  expect(await banco.sql('SELECT cnae_principal FROM empresa WHERE cnpj=$1', ['11444777000161'])).toEqual([{ cnae_principal: null }])
})

test.each(['4742-3/00', 'abc', '474230', '47423000', ''])('banco recusa formato não normalizado %s', async (cnae) => {
  await expect(banco.comoUsuario(gestor, e => e(
    "INSERT INTO empresa(cnpj,razao_social,telefone,cnae_principal) VALUES ('11555777000160','Inválida','11987654321',$1)", [cnae],
  ))).rejects.toMatchObject({ code: '23514' })
})

test('CNAE não amplia escrita nem leitura do vendedor', async () => {
  await expect(banco.comoUsuario(vendedor, e => e(
    "INSERT INTO empresa(cnpj,razao_social,telefone,cnae_principal) VALUES ('11555777000160','Negada','11987654321','4742300')",
  ))).rejects.toMatchObject({ code: '42501' })
  expect((await banco.comoUsuario(vendedor, e => e('SELECT cnae_principal FROM empresa'))).linhas).toEqual([])
})
