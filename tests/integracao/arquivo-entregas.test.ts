import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
let banco: BancoDeTeste
let vendedor: string
let gestor: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco,'vendedor','ArquivoEntrega')
  gestor = await criarUsuario(banco,'gestor','ArquivoEntregaGestor')
  await banco.comoUsuario(gestor,e => e('SELECT busca_empresa_limite_definir($1,1000,false)', [vendedor]))
})
afterAll(async () => { await banco?.derrubar() })
const empresa = { cnpj: '11222333000181', razao_social: 'Entrega sintética', telefone: '11988887777', telefones: ['11988887777'] }
const call = (u: string, sql: string, p: unknown[]) => banco.comoUsuario(u,e => e(sql,p)).then(r => r.linhas)

test('replay Banco conserva resultado original; callbacks Google novos recusam arquivada e entregam empresa válida', async () => {
  const busca = randomUUID()
  await call(vendedor,"SELECT busca_empresa_reservar($1,'Sintética',$2)", [busca,{ palavra: 'Sintética', cnae: '', uf: 'SP', cidade: '', bairro: '', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 3, offset: 0 }])
  await call(vendedor,'SELECT busca_empresa_concluir($1,$2,NULL)', [busca,JSON.stringify([empresa])])
  const entregue = await call(vendedor,'SELECT * FROM busca_empresa_importar($1,NULL)', [busca])
  const [{ grupo_id: grupo }] = await banco.sql<{ grupo_id: string }>('SELECT grupo_id FROM busca_empresa WHERE id=$1', [busca])
  const [{ m }] = await banco.sql<{ m: unknown }>('SELECT arquivo_legado_manifesto($1::uuid[]) AS m', [[grupo]])
  const resultados = await banco.sql('SELECT empresas FROM busca_empresa WHERE id=$1', [busca])
  await banco.sql('SELECT arquivo_legado_aplicar($1,$2)', [m,'a'.repeat(64)])
  expect(await call(vendedor,'SELECT * FROM busca_empresa_importar($1,NULL)', [busca])).toEqual(entregue)
  expect(await banco.sql('SELECT empresas FROM busca_empresa WHERE id=$1', [busca])).toEqual(resultados)
  expect(await repositorioBusca(vendedor).empresasRecentes()).toEqual([])
  const outro = await criarUsuario(banco,'vendedor','ArquivoEntregaOutro')
  await call(gestor,'SELECT busca_empresa_limite_definir($1,1000,false)', [outro])
  const buscaAlheia = randomUUID()
  await call(outro,"SELECT busca_empresa_reservar($1,'Consulta própria',$2)", [buscaAlheia,{ palavra: 'Sintética', cnae: '', uf: 'SP', cidade: '', bairro: '', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 3, offset: 0 }])
  await call(outro,'SELECT busca_empresa_concluir($1,$2,NULL)', [buscaAlheia,JSON.stringify([empresa])])
  expect(await banco.comoUsuario(outro,e => e('SELECT * FROM empresa_arquivo'))).toMatchObject({ linhas: [] })
  expect(await repositorioBusca(outro).empresasRecentes()).toEqual([])
  expect((await call(vendedor,'SELECT busca_empresa_snapshot_ativo($1,$2) AS ativo', [buscaAlheia,empresa.cnpj]))[0]).toEqual({ ativo: false })
  expect((await call(outro,'SELECT busca_empresa_snapshot_ativo($1,$2) AS ativo', [buscaAlheia,'00000000000000']))[0]).toEqual({ ativo: false })
  for (const legado of [false,true]) {
    const executor = randomUUID()
    const [{ id }] = await banco.sql<{ id: string }>(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,criterios,snapshot,estado)
      VALUES($1,date_trunc('week',now())+($2::int*interval '1 day'),'Sintética','','São Paulo','SP','{}','{"criterios":{},"nicho":"Sintética","bairro":"","cidade":"São Paulo","uf":"SP"}','coletando') RETURNING id`, [vendedor,legado?15:14])
    const [{ eid, hash }] = await banco.sql<{ eid: string; hash: string }>(`INSERT INTO google_execucao(executor_id,gestor_id,pedido_id,vendedor_id,revisao,snapshot,contrato)
      SELECT $1,$2,id,vendedor_id,1,snapshot,$4 FROM google_planejamento WHERE id=$3 RETURNING id eid,encode(sha256(convert_to(snapshot::text,'UTF8')),'hex') hash`, [executor,gestor,id,legado?1:2])
    const linhas = [{ ...empresa, google_place_id: 'arquivo-repetida', validado: true }, { nome_fantasia: 'Google válida sintética', google_place_id: 'nova-'+String(legado), telefone: legado?'11955554444':'11977776666', validado: true }]
    const lote = randomUUID()
    if (!legado) await call(gestor,'SELECT google_agente_reservar_lote($1,$2,$3)', [id,executor,JSON.stringify({ lote_id: lote, candidatas: linhas })])
    const recibo = legado
      ? { pedido_id: id, validacao_conferida: true, origem_sha256: 'a'.repeat(64), final_sha256: 'b'.repeat(64), arquivo_original_id: 'raw', arquivo_final_id: 'resultado' }
      : { versao: 2, pedido_id: id, execucao_id: eid, lote_id: lote, revisao: 1, snapshot_sha256: hash, origem_sha256: 'a'.repeat(64), resultado_sha256: 'b'.repeat(64), arquivo_original_id: 'raw', arquivo_resultado_id: 'resultado', verificacoes_requeridas: [], evidencias: [] }
    const publicar = () => call(gestor,'SELECT google_agente_entregar($1,$2,$3,$4) AS r', [id,JSON.stringify(linhas),JSON.stringify(recibo),executor])
    expect((await publicar())[0]).toEqual({ r: 'ok' })
    const original = await banco.sql('SELECT * FROM google_resultado WHERE planejamento_id=$1 ORDER BY indice', [id])
    expect(original).toEqual([expect.objectContaining({ situacao: 'indisponivel' }),expect.objectContaining({ situacao: 'entregue' })])
    await publicar()
    expect(await banco.sql('SELECT * FROM google_resultado WHERE planejamento_id=$1 ORDER BY indice', [id])).toEqual(original)
    await banco.sql('UPDATE google_execucao SET concluido_em=clock_timestamp() WHERE id=$1', [eid])
  }
  expect(await banco.sql('SELECT ativo FROM grupo_importacao WHERE id=$1', [grupo])).toEqual([{ ativo: false }])
})
