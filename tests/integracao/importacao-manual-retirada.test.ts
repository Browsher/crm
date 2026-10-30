import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { repositorioPostgres } from '@/src/features/empresas/repositorio'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
const assinatura = 'public.grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb,jsonb)'
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'ManualRetiradaGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'ManualRetiradaVendedor')
  await banco.sql(`WITH e AS (
    INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ('11222333000181','Cadastro preservado','11987654321') RETURNING id
  ), g AS (
    INSERT INTO grupo_importacao(nome) VALUES ('Lista histórica preservada') RETURNING id
  ), vinculo AS (
    INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT g.id,e.id FROM g,e RETURNING empresa_id
  ) INSERT INTO empresa_origem_google(google_place_id,empresa_id) SELECT 'place-historico-preservado',empresa_id FROM vinculo`)
})
afterAll(async () => { await banco?.derrubar() })

test('função histórica existe sem EXECUTE para aplicação ou PUBLIC; Banco e Google conservam seus contratos', async () => {
  expect(await banco.sql(`SELECT to_regprocedure($1) IS NOT NULL AS existe,
    has_function_privilege('app_usuario',$1,'EXECUTE') AS app,
    EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid=to_regprocedure($1) AND a.grantee=0 AND a.privilege_type='EXECUTE') AS publico`, [assinatura])).toEqual([{ existe: true, app: false, publico: false }])
  expect(await banco.sql(`SELECT proname FROM pg_proc WHERE proname IN ('busca_empresa_importar','google_agente_entregar') AND has_function_privilege('app_usuario',oid,'EXECUTE') ORDER BY 1`)).toEqual([{ proname: 'busca_empresa_importar' }, { proname: 'google_agente_entregar' }])
})

test('gestor e vendedor recebem negação SQL sem alterar cadastros, listas ou vínculos', async () => {
  const tabelas = ['empresa', 'empresa_origem_google', 'grupo_importacao', 'grupo_importacao_empresa']
  const fotografia = () => Promise.all(tabelas.map(t => banco.sql(`SELECT * FROM ${t} ORDER BY 1,2`)))
  const antes = await fotografia()
  for (const usuario of [gestor, vendedor]) {
    await expect(banco.comoUsuario(usuario, e => e('SELECT * FROM grupo_importacao_confirmar($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), 'Lista', 'antigo.csv', 'a'.repeat(64), '[{"cnpj":"11222333000181","razao_social":"Histórico","telefone":"11987654321"}]', '{}', '{"descricao":"Teste","origem":"Fixture","criterios":null}']))).rejects.toMatchObject({ code: '42501' })
    expect(await repositorioPostgres(usuario).gravar({ chave: randomUUID(), nome: 'Lista', arquivoNome: 'antigo.csv', assinatura: 'a'.repeat(64), metadados: { descricao: 'Teste', origem: 'Fixture', criterios: null } }, [], { novas: 0, jaCadastradas: 0, recusadas: [], cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null })).toEqual({ ok: false, motivo: 'sem_permissao' })
  }
  expect(await fotografia()).toEqual(antes)
})
