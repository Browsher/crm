import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'
import { cenarioAtendimento, vincularEmpresaTeste } from './atendimento-fixtures'
let banco: BancoDeTeste
let c: Awaited<ReturnType<typeof cenarioAtendimento>>
beforeAll(async () => { banco = await criarBancoDeTeste(); c = await cenarioAtendimento(banco) })
afterAll(async () => { await banco?.derrubar() })
async function ler(ids: string[], usuario = c.vendedorId) { return banco.comoUsuario(usuario, async sql => (await sql<{ r: { ok: boolean; empresas?: { id: string }[]; motivo?: string } }>('SELECT empresas_resumos_ler($1::uuid[]) AS r', [ids])).linhas[0].r) }
test('resumo em lote deduplica e omite empresa alheia e inexistente', async () => {
  const [e] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Outra','11988887777') RETURNING id")
  await vincularEmpresaTeste(banco, e.id, c.outroId, 'legado')
  const r = await ler([c.empresaId, c.empresaId, e.id, randomUUID()])
  expect(r.ok).toBe(true)
  expect(r.empresas?.map(e => e.id)).toEqual([c.empresaId])
  expect(await ler([])).toEqual({ ok: true, empresas: [] })
})
test('recusa gestor, inativo e mais de cem IDs únicos', async () => {
  expect((await banco.sql<{r:unknown}>("SELECT empresas_resumos_ler('{}'::uuid[]) r"))[0].r).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await ler(Array.from({length:100},()=>randomUUID()))).toEqual({ok:true,empresas:[]})
  expect(await ler([], c.gestorId)).toEqual({ ok: false, motivo: 'sem_permissao' })
  expect(await ler(Array.from({ length: 101 }, () => randomUUID()))).toEqual({ ok: false, motivo: 'dados_invalidos' })
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [c.vendedorId])
  try { expect(await ler([])).toEqual({ ok: false, motivo: 'sem_permissao' }) }
  finally { await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1', [c.vendedorId]) }
})
test('lote expande histórico Banco uma vez e não cria efeitos comerciais', async () => {
  const empresas = await banco.sql<{id:string;cnpj:string}>(`INSERT INTO empresa(cnpj,razao_social,telefone)
    SELECT '77110000'||lpad(i::text,6,'0'),'Resumo lote '||i,'11977778888' FROM generate_series(1,20) i RETURNING id,cnpj`)
  for (const e of empresas) await vincularEmpresaTeste(banco,e.id,c.vendedorId,'banco')
  const itens = empresas.map(e=>({cnpj:e.cnpj,bairro:'Centro',cidade:'Cidade real',uf:'SP'}))
  await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas) VALUES($1,'Lote resumo','{}',20,'concluida',$2)",[c.vendedorId,JSON.stringify(itens)])
  const [original] = await banco.sql<{definicao:string}>("SELECT pg_get_functiondef('empresa_atendimento_resumos(uuid,uuid)'::regprocedure) definicao")
  await banco.sql('CREATE SEQUENCE public.teste_resumos_itens')
  await banco.sql(`CREATE FUNCTION public.teste_resumos_expandir(p jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
    DECLARE item jsonb; BEGIN FOR item IN SELECT jsonb_array_elements(p) LOOP
    PERFORM nextval('public.teste_resumos_itens'); RETURN NEXT item; END LOOP; END; $$`)
  await banco.sql('REVOKE EXECUTE ON FUNCTION public.teste_resumos_expandir(jsonb) FROM PUBLIC')
  try {
    await banco.sql(original.definicao.replaceAll('jsonb_array_elements(', 'public.teste_resumos_expandir('))
    expect((await ler(empresas.map(e=>e.id))).empresas).toHaveLength(20)
    expect((await banco.sql<{itens:number}>('SELECT last_value::integer itens FROM teste_resumos_itens'))[0].itens).toBe(20)
    expect((await banco.sql('SELECT id FROM contato WHERE empresa_id=ANY($1::uuid[])',[empresas.map(e=>e.id)]))).toHaveLength(0)
    expect((await banco.sql('SELECT id FROM negociacao WHERE empresa_id=ANY($1::uuid[])',[empresas.map(e=>e.id)]))).toHaveLength(0)
  } finally {
    await banco.sql(original.definicao)
    await banco.sql('DROP FUNCTION public.teste_resumos_expandir(jsonb)')
    await banco.sql('DROP SEQUENCE public.teste_resumos_itens')
  }
})
