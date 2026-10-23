import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { lerPerfilEmpresa } from '@/src/features/empresas/perfil'
import { lerFunil, lerNegociacao } from '@/src/features/funil/consulta'
import { lerPerfilVendedor } from '@/src/features/gestao/perfil-vendedor'
import { lerDashboard } from '@/src/features/gestao/consulta'

let banco: BancoDeTeste
beforeAll(async () => { banco = await criarBancoDeTeste() })
afterAll(async () => { await banco?.derrubar() })

test('persiste nome comercial sem inventar razão social e gera busca', async () => {
  const [empresa] = await banco.sql<{ id: string; busca: string; razao_social: string | null; cnpj: string | null }>(
    `INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone)
     VALUES (NULL,NULL,'Câmeras Aurora','11987654321') RETURNING id,busca,razao_social,cnpj`,
  )
  expect(empresa.busca).toContain('cameras aurora')
  expect(empresa.razao_social).toBeNull()
  expect(empresa.cnpj).toBeNull()
})

test('aceita duas empresas distintas com CNPJ nulo', async () => {
  const empresas = await banco.sql<{ id: string }>(
    `INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone)
     VALUES (NULL,NULL,'Alfa','1133334444'), (NULL,NULL,'Beta','1133334444') RETURNING id`,
  )
  expect(empresas).toHaveLength(2)
  expect(empresas[0].id).not.toBe(empresas[1].id)
})

test('CNPJ informado conserva unicidade', async () => {
  await banco.sql("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ('11222333000181','Aurora LTDA','11987654321')")
  await expect(banco.sql("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ('11222333000181','Outra LTDA','11987654321')")).rejects.toMatchObject({ code: '23505' })
})

test.each([
  [null, null, null, '11987654321'],
  [null, null, '', '11987654321'],
  [null, ' ', 'Nome conhecido', '11987654321'],
  [null, null, 'Aurora', '123'],
  [null, null, 'Aurora', null],
  ['invalido', null, 'Aurora', '11987654321'],
])('recusa cadastro inválido %o', async (cnpj, razao, fantasia, telefone) => {
  await expect(banco.sql('INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone) VALUES ($1,$2,$3,$4)', [cnpj, razao, fantasia, telefone])).rejects.toMatchObject({ code: '23514' })
})


test('cadastro parcial conserva nome, UUID e nulos na carteira, funil e gestão', async () => {
  const gestor = await criarUsuario(banco, 'gestor', 'GestorLeituraParcial')
  const vendedor = await criarUsuario(banco, 'vendedor', 'VendedorLeituraParcial')
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone) VALUES (NULL,NULL,'Câmeras Comerciais','11999999999') RETURNING id")
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [id, vendedor])
  const [{ id: negociacaoId }] = await banco.sql<{ id: string }>('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES ($1,$2) RETURNING id', [id, vendedor])
  const contato = await banco.comoUsuario(vendedor, e => e<{ resultado: string }>("SELECT contato_registrar($1,'acompanhamento','Conversa comercial',NULL,NULL,'nenhum') AS resultado", [id]))
  expect(contato.linhas[0].resultado).toBe('ok')
  expect(await lerMinhasEmpresas(vendedor)).toMatchObject({ ok: true, carteira: [{ id, cnpj: null, razaoSocial: null, nomeFantasia: 'Câmeras Comerciais' }] })
  expect(await lerPerfilEmpresa(gestor, id)).toMatchObject({ id, cnpj: null, razaoSocial: null, nomeFantasia: 'Câmeras Comerciais' })
  expect(await lerFunil(vendedor)).toMatchObject([{ empresaId: id, nome: 'Câmeras Comerciais' }])
  expect(await lerNegociacao(vendedor, negociacaoId)).toMatchObject({ empresaId: id, nome: 'Câmeras Comerciais', cnpj: null })
  expect(await lerPerfilVendedor(gestor, vendedor)).toMatchObject({ empresas: [{ id, nome: 'Câmeras Comerciais', cnpj: null }], atividade: [{ empresaId: id, empresa: 'Câmeras Comerciais' }] })
  expect(await lerDashboard(gestor)).toMatchObject({ atividade: [{ empresa: 'Câmeras Comerciais' }] })
})

test('identificação parcial não concede escrita nem leitura administrativa ao vendedor', async () => {
  const vendedor = await criarUsuario(banco, 'vendedor', 'VendedorSemCadastro')
  await expect(banco.comoUsuario(vendedor, e => e("INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone) VALUES (NULL,NULL,'Não autorizada','11987654321')"))).rejects.toMatchObject({ code: '42501' })
  const linhas = await banco.comoUsuario(vendedor, e => e('SELECT id FROM empresa'))
  expect(linhas.linhas).toEqual([])
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [vendedor])
  await expect(banco.comoUsuario(vendedor, e => e("SELECT * FROM empresa_consultar('',NULL,NULL,NULL,NULL,1)"))).rejects.toMatchObject({ code: '42501' })
  const gestorPendente = await criarUsuario(banco, 'gestor', 'GestorPendenteParcial')
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1', [gestorPendente])
  await expect(banco.comoUsuario(gestorPendente, e => e("INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone) VALUES (NULL,NULL,'Bloqueada','11987654321')"))).rejects.toMatchObject({ code: '42501' })
})
