import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { lerPerfilEmpresa } from '@/src/features/empresas/perfil'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let id: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  const [e] = await banco.sql<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,telefone,contato_nome,email,cnae_principal)
    VALUES('11222333000181','Empresa Perfil','11987654321','Maria','maria@teste.local','4742300') RETURNING id`)
  id = e.id
  await vincularGrupoAtivo(banco, [id])
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('UPDATE grupo_importacao SET ativo=true')
})
test('gestor consulta dados e origem de empresa livre sem atendimento', async () => {
  const r = await lerPerfilEmpresa(gestor, id)
  expect(r).toMatchObject({ id, razaoSocial: 'Empresa Perfil', contatoNome: 'Maria', telefone: '11987654321',
    email: 'maria@teste.local', cnae: '4742300', situacao: 'disponivel', responsavel: null, proximoPasso: null, retorno: null })
  expect(r?.grupos).toHaveLength(1)
  expect(r?.grupos[0]).toMatchObject({ nome: 'Origem do cenário', ativo: true })
})
test('ID inválido/inexistente e vendedor não recebem perfil administrativo', async () => {
  expect(await lerPerfilEmpresa(gestor, 'invalido')).toBeNull()
  expect(await lerPerfilEmpresa(gestor, '00000000-0000-4000-8000-000000000000')).toBeNull()
  expect(await lerPerfilEmpresa(vendedor, id)).toBeNull()
})
test('posse e último retorno aparecem sem gravar visita ou contato', async () => {
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [id, vendedor])
  await banco.sql(`INSERT INTO contato(id,empresa_id,tipo,proximo_passo,proximo_passo_data) VALUES
    ('00000000-0000-4000-8000-000000000001',$1,'interessado','Antigo',CURRENT_DATE-1),
    ('00000000-0000-4000-8000-000000000002',$1,'acompanhamento','Telefonar',CURRENT_DATE+1)`, [id])
  const r = await lerPerfilEmpresa(gestor, id)
  expect(r).toMatchObject({ responsavel: 'Vendedor', responsavelAtivo: true, situacao: 'carteira', proximoPasso: 'Telefonar' })
  expect(r?.retorno).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(await banco.sql('SELECT count(*)::int AS n FROM contato WHERE empresa_id=$1', [id])).toEqual([{ n: 2 }])
  expect(await lerPerfilEmpresa(vendedor, id)).toBeNull() // inclusive sendo dono
})
test('reserva válida e grupo desativado continuam explícitos', async () => {
  await banco.sql("INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES($1,$2,now()+interval '1 hour')", [id,vendedor])
  await banco.sql('UPDATE grupo_importacao SET ativo=false')
  expect(await lerPerfilEmpresa(gestor, id)).toMatchObject({ situacao: 'reservada', reservadoPor: 'Vendedor', grupos: [expect.objectContaining({ ativo: false })] })
  await banco.sql("UPDATE empresa_fila SET reservado_ate=now()-interval '1 hour' WHERE empresa_id=$1", [id])
  expect(await lerPerfilEmpresa(gestor, id)).toMatchObject({ situacao: 'inativa', reservadoPor: null })
})
