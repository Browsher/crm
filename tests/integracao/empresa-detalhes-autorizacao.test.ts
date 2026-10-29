import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'
let banco: BancoDeTeste
let eu: string, outro: string, gestor: string, minha: string, alheia: string, busca: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  eu = await criarUsuario(banco, 'vendedor', 'DetalheEu'); outro = await criarUsuario(banco, 'vendedor', 'DetalheOutro'); gestor = await criarUsuario(banco, 'gestor', 'DetalheGestor')
  const e = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES ('Minha','11988887777'),('Segredo','11988886666') RETURNING id")
  minha = e[0].id; alheia = e[1].id
  await vincularGrupoAtivo(banco, [minha, alheia])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES ($1,$2,'google'),($3,$4,'banco')", [minha,eu,alheia,outro])
  const [b] = await banco.sql<{id:string}>(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas) VALUES ($1,'Busca privada','{}',2,'concluida',$2) RETURNING id`, [eu,JSON.stringify([{cnpj:'12345678000199',razao_social:'Empresa A',telefones:[]},{cnpj:'98765432000199',razao_social:'Empresa B',telefones:[]}])])
  busca = b.id
})
afterAll(async () => { await banco?.derrubar() })
const ler = (id: string, usuario = eu) => banco.comoUsuario(usuario, async sql => (await sql<{resultado:Record<string,unknown>}>('SELECT empresa_detalhes_ler($1) AS resultado',[id])).linhas[0].resultado)
const snapshot = (cnpj: string, usuario = eu) => banco.comoUsuario(usuario, async sql => (await sql<{resultado:Record<string,unknown>}>('SELECT busca_empresa_detalhes_ler($1,$2) AS resultado',[busca,cnpj])).linhas[0].resultado)
test('vínculo autoriza dados próprios; ID alheio/arbitrário não expõe cadastro; gestor conserva leitura', async () => {
  expect(await ler(minha)).toMatchObject({ok:true,dados:{id:minha,nome:'Minha',versao:1,situacao:'a_contatar'}})
  expect(await ler(alheia)).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await ler('10000000-0000-4000-8000-000000000001')).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await ler(alheia,gestor)).toMatchObject({ok:true,dados:{nome:'Segredo',situacao:'indisponivel',versao:null}})
  expect(JSON.stringify(await ler(minha))).not.toContain('responsavel')
})
test('snapshot B é exato e próprio; busca alheia e CNPJ ausente recusados', async () => {
  expect(await snapshot('98765432000199')).toMatchObject({ok:true,empresa:{razao_social:'Empresa B'}})
  expect(JSON.stringify(await snapshot('98765432000199'))).not.toContain('Empresa A')
  expect(await snapshot('98765432000199',outro)).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await snapshot('00000000000199')).toEqual({ok:false,motivo:'nao_encontrada'})
  await expect(banco.comoUsuario(eu,sql=>sql('SELECT empresa_atendimento_resumo($1)',[alheia]))).rejects.toMatchObject({code:'42501'})
  await expect(banco.comoUsuario(eu,sql=>sql('SELECT * FROM empresa_atendimento_resumos($1)',[outro]))).rejects.toMatchObject({code:'42501'})
})
test('consulta não escreve operações, contatos ou fila e não ativa snapshot coincidente', async () => {
  const antes = await banco.sql('SELECT (SELECT count(*) FROM contato) contatos,(SELECT count(*) FROM empresa_atendimento_operacao) operacoes,(SELECT count(*) FROM empresa_fila) fila')
  await ler(minha); await snapshot('12345678000199')
  expect(await banco.sql('SELECT (SELECT count(*) FROM contato) contatos,(SELECT count(*) FROM empresa_atendimento_operacao) operacoes,(SELECT count(*) FROM empresa_fila) fila')).toEqual(antes)
})
test('candidato sem origem pessoal não entra na consulta nem autoriza cadastro; snapshot próprio sinaliza pendência', async () => {
  const [e] = await banco.sql<{id:string}>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES('55555555000199','Pendente','11977776666') RETURNING id")
  await banco.sql("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,candidatos,evidencias) VALUES($1,'multiplos_candidatos',ARRAY[$2::uuid,$3::uuid],'{}')",[e.id,eu,outro])
  const listagem = await banco.comoUsuario(eu,async sql => (await sql<{dados:{empresas:{id:string}[]}}>('SELECT prospeccao_pessoal() dados')).linhas[0].dados)
  expect(listagem.empresas.map(e=>e.id)).not.toContain(e.id)
  expect(await ler(e.id)).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await ler(e.id,gestor)).toMatchObject({ok:true,dados:{nome:'Pendente',situacao:'indisponivel',motivoIndisponibilidade:'pendente',versao:null}})
  expect((await ler(e.id,gestor)).dados).toMatchObject({origens:[]})
  await banco.sql(`UPDATE busca_empresa SET empresas=empresas||'[ {"cnpj":"55555555000199","razao_social":"Snapshot pendente","telefones":[]} ]'::jsonb WHERE id=$1`,[busca])
  expect(await snapshot('55555555000199')).toMatchObject({ok:true,motivoIndisponibilidade:'pendente',empresa:{razao_social:'Snapshot pendente'}})
})
test('resumo pessoal e detalhes compartilham localização real persistida, origens e situação', async () => {
  const vendedor = await criarUsuario(banco,'vendedor','ResumoComum')
  const [e] = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Resumo comum','11912341234') RETURNING id")
  await vincularGrupoAtivo(banco,[e.id])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[e.id,vendedor])
  const [p] = await banco.sql<{id:string}>(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,snapshot) VALUES($1,'2026-10-29','Alterado','Alterado','São Paulo','SP','{"nicho":"Nicho entregue","bairro":"Sé","cidade":"São Paulo","uf":"SP"}') RETURNING id`,[vendedor])
  await banco.sql(`INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{"bairro":"Sé","cidade":"São Paulo","uf":"SP"}','entregue',now())`,[p.id,e.id])
  const consulta = await banco.comoUsuario(vendedor,async sql => (await sql<{dados:{empresas:Record<string,unknown>[]}}>('SELECT prospeccao_pessoal() dados')).linhas[0].dados)
  const detalhe = await ler(e.id,vendedor)
  const dados = detalhe.dados as Record<string,unknown>
  for(const campo of ['id','nome','bairro','cidade','uf','origens','recebidaEm','situacao','versao','negociacaoId']) expect(consulta.empresas[0][campo],campo).toEqual(dados[campo])
  expect(dados.bairro).toBe('Sé')
})
test('Banco usa localização do snapshot exato próprio e nunca os critérios gerais ou snapshot alheio', async () => {
  const vendedor = await criarUsuario(banco,'vendedor','LocalBanco')
  const empresas = await banco.sql<{id:string;cnpj:string}>(`INSERT INTO empresa(cnpj,razao_social,telefone) VALUES
    ('77777777000199','Banco sem endereço','11911112222'),('88888888000199','Banco com snapshot','11911113333') RETURNING id,cnpj`)
  const [grupo] = await banco.sql<{id:string}>("INSERT INTO grupo_importacao(nome) VALUES('Localização real') RETURNING id")
  for (const e of empresas) {
    await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)',[grupo.id,e.id])
    await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'banco')",[e.id,vendedor])
  }
  await banco.sql(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id,empresas) VALUES
    ($1,'Critérios não são endereço','{"palavra":"Lojas","bairro":"Critério","cidade":"São Paulo","uf":"SP"}',3,'concluida',$2,$3)`,[vendedor,grupo.id,JSON.stringify([
    {cnpj:empresas[0].cnpj,razao_social:'Sem endereço',telefones:[]},
    {cnpj:empresas[1].cnpj,razao_social:'Snapshot exato',bairro:'Icaraí',cidade:'Niterói',uf:'RJ',telefones:[]},
    {cnpj:'99999999000199',razao_social:'Não corresponde',bairro:'Falso',cidade:'Salvador',uf:'BA',telefones:[]},
  ])])
  await banco.sql(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas) VALUES
    ($1,'Snapshot alheio','{}',1,'concluida',$2)`,[outro,JSON.stringify([{cnpj:empresas[0].cnpj,razao_social:'Outro vendedor',bairro:'Segredo',cidade:'Recife',uf:'PE',telefones:[]}])])
  const consultar = (f: object = {}) => banco.comoUsuario(vendedor,async sql=>(await sql<{dados:{total:number;bairros:string[];empresas:Record<string,unknown>[]}}>('SELECT prospeccao_pessoal($1) dados',[JSON.stringify(f)])).linhas[0].dados)
  const r = await consultar({origem:'banco'})
  const ausente = r.empresas.find(e=>e.id===empresas[0].id)!
  const comSnapshot = r.empresas.find(e=>e.id===empresas[1].id)!
  expect(ausente).toMatchObject({bairro:null,cidade:null,uf:null,regioes:[]})
  expect(comSnapshot).toMatchObject({bairro:'Icaraí',cidade:'Niterói',uf:'RJ',regioes:['Icaraí · Niterói/RJ']})
  expect(r.bairros).toEqual(['Icaraí · Niterói/RJ'])
  expect(r.total).toBe(2)
  expect((await ler(empresas[0].id,vendedor)).dados).toMatchObject({bairro:null,cidade:null,uf:null})
  expect((await ler(empresas[1].id,vendedor)).dados).toMatchObject({bairro:'Icaraí',cidade:'Niterói',uf:'RJ'})
  for (const filtros of [{endereco:'Icaraí · Niterói/RJ'},{cidade:'Niterói',uf:'RJ'},{origem:'banco',nicho:'Lojas',endereco:'Icaraí · Niterói/RJ',cidade:'Niterói',uf:'RJ'}]) {
    expect((await consultar(filtros)).empresas.map(e=>e.id)).toEqual([empresas[1].id])
  }
  for (const filtros of [{endereco:'Critério · São Paulo/SP'},{cidade:'São Paulo'},{uf:'SP'},{endereco:'Segredo · Recife/PE'}]) expect((await consultar(filtros)).total).toBe(0)
  expect(JSON.stringify(r)).not.toContain('Segredo')
  expect((await consultar({origem:'banco',pagina:'2'})).empresas).toEqual([])
})
test('Google mantém critérios como contexto e usa somente localização real do resultado nas opções e filtros', async () => {
  const vendedor = await criarUsuario(banco,'vendedor','LocalGoogle')
  const [e] = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Google sem endereço','11911114444') RETURNING id")
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'google')",[e.id,vendedor])
  const [p] = await banco.sql<{id:string}>(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,snapshot)
    VALUES($1,'2026-10-28','Plano alterado','Planejado','São Paulo','SP','{"nicho":"Nicho entregue","bairro":"Critério congelado","cidade":"São Paulo","uf":"SP"}') RETURNING id`,[vendedor])
  await banco.sql("INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{}','entregue',now())",[p.id,e.id])
  const consultar = (f: object = {}) => banco.comoUsuario(vendedor,async sql=>(await sql<{dados:{total:number;bairros:string[];nichos:string[];empresas:Record<string,unknown>[]}}>('SELECT prospeccao_pessoal($1) dados',[JSON.stringify(f)])).linhas[0].dados)
  expect((await ler(e.id,vendedor)).dados).toMatchObject({bairro:null,cidade:null,uf:null})
  expect(await consultar()).toMatchObject({bairros:[],nichos:['Nicho entregue'],empresas:[{bairro:null,cidade:null,uf:null,regioes:[]}]})
  expect((await consultar({endereco:'Critério congelado · São Paulo/SP'})).total).toBe(0)
  expect((await consultar({cidade:'São Paulo',uf:'SP'})).total).toBe(0)
  await banco.sql(`UPDATE google_resultado SET dados='{"bairro":"Centro","cidade":"Curitiba","uf":"PR"}' WHERE empresa_id=$1`,[e.id])
  expect((await ler(e.id,vendedor)).dados).toMatchObject({bairro:'Centro',cidade:'Curitiba',uf:'PR'})
  expect(await consultar()).toMatchObject({bairros:['Centro · Curitiba/PR'],nichos:['Nicho entregue'],empresas:[{bairro:'Centro',cidade:'Curitiba',uf:'PR',regioes:['Centro · Curitiba/PR']}]})
  expect((await consultar({nicho:'Nicho entregue',endereco:'Centro · Curitiba/PR',cidade:'Curitiba',uf:'PR'})).empresas.map(e=>e.id)).toEqual([e.id])
  expect((await consultar({cidade:'São Paulo',uf:'SP'})).total).toBe(0)
})
test('lote expande cada item do histórico Banco autorizado uma vez, inclusive com vínculos sem localização', async () => {
  const vendedor = await criarUsuario(banco,'vendedor','LoteLocalizacao')
  const empresas = await banco.sql<{id:string;cnpj:string}>(`INSERT INTO empresa(cnpj,razao_social,telefone)
    SELECT '66110000'||lpad(i::text,6,'0'),'Lote endereço '||i,'119'||lpad(i::text,8,'0') FROM generate_series(0,39) i RETURNING id,cnpj`)
  for(const e of empresas) await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'banco')",[e.id,vendedor])
  for(let i=0;i<10;i++) {
    const itens = empresas.slice(0,20).map((e,j)=>({cnpj:e.cnpj,razao_social:'Snapshot '+j,telefones:[],...(j===0&&i<9?{bairro:'Centro',cidade:'Cidade '+i,uf:'PR'}:{})}))
    await banco.sql(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas,criado_em)
      VALUES($1,'Histórico em lote','{"cidade":"Critério","uf":"SP"}',20,'concluida',$2,$3)`,[vendedor,JSON.stringify(itens),`2026-10-${String(i+1).padStart(2,'0')}T12:00:00Z`])
  }
  const alheio = JSON.stringify([{cnpj:empresas[0].cnpj,razao_social:'Alheio',bairro:'Segredo',cidade:'Segredo',uf:'BA',telefones:[]}])
  await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas) VALUES($1,'Outro histórico','{}',1,'concluida',$2),($3,'Não concluída','{}',1,'reservada',$2)",[outro,alheio,vendedor])
  // Instrumentação local conta itens JSON expandidos de verdade na chamada da RPC.
  // A função original é restaurada no finally; não há limiar de tempo/hardware.
  const definicoes = await banco.sql<{definicao:string}>(`SELECT pg_get_functiondef(p.oid) definicao FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('empresa_atendimento_resumo','empresa_atendimento_resumos') AND p.prosrc LIKE '%jsonb_array_elements(%'`)
  expect(definicoes).toHaveLength(1)
  await banco.sql('CREATE SEQUENCE public.teste_localizacao_itens')
  await banco.sql(`CREATE FUNCTION public.teste_localizacao_expandir(p jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
    DECLARE item jsonb; BEGIN FOR item IN SELECT jsonb_array_elements(p) LOOP
      PERFORM nextval('public.teste_localizacao_itens'); RETURN NEXT item; END LOOP; END; $$`)
  await banco.sql('REVOKE EXECUTE ON FUNCTION public.teste_localizacao_expandir(jsonb) FROM PUBLIC')
  try {
    for(const d of definicoes) await banco.sql(d.definicao.replaceAll('jsonb_array_elements(', 'public.teste_localizacao_expandir('))
    const consultar = (f: object) => banco.comoUsuario(vendedor,async sql=>(await sql<{dados:{total:number;bairros:string[];empresas:Record<string,unknown>[]}}>('SELECT prospeccao_pessoal($1) dados',[JSON.stringify(f)])).linhas[0].dados)
    const medir = async (f: object) => {
      await banco.sql("SELECT setval('public.teste_localizacao_itens',1,false)")
      const dados=await consultar(f)
      const [contador]=await banco.sql<{itens:number}>(`SELECT CASE WHEN is_called THEN last_value::integer ELSE 0 END itens FROM public.teste_localizacao_itens`)
      return {dados,itens:contador.itens}
    }
    const completa=await medir({origem:'banco'})
    expect(completa.dados.total).toBe(40)
    expect(completa.dados.empresas).toHaveLength(20)
    expect(completa.dados.bairros).toEqual(['Centro · Cidade 8/PR'])
    expect(completa.itens).toBeGreaterThan(0)
    expect(completa.itens).toBeLessThanOrEqual(200)
    const vazia=await medir({origem:'banco',nicho:'Inexistente'})
    expect(vazia.dados.total).toBe(0)
    expect(vazia.itens).toBeLessThanOrEqual(200)
    const exata=await consultar({cnpj:empresas[0].cnpj,cidade:'Cidade 8',uf:'PR'})
    expect(exata.empresas.map(e=>e.id)).toEqual([empresas[0].id])
    expect((await ler(empresas[0].id,vendedor)).dados).toMatchObject({cidade:'Cidade 8',bairro:'Centro',uf:'PR'})
    expect((await ler(empresas[39].id,vendedor)).dados).toMatchObject({cidade:null,bairro:null,uf:null})
    expect(JSON.stringify(completa.dados)).not.toContain('Segredo')
    expect((await consultar({origem:'banco',pagina:'2'})).empresas).toHaveLength(20)
  } finally {
    for(const d of definicoes) await banco.sql(d.definicao)
    await banco.sql('DROP FUNCTION public.teste_localizacao_expandir(jsonb)')
    await banco.sql('DROP SEQUENCE public.teste_localizacao_itens')
  }
})
test('entrega histórica sem vínculo não autoriza cadastro nem inclui consulta pessoal', async () => {
  const [e] = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Sem vínculo','11922223333') RETURNING id")
  const [p] = await banco.sql<{id:string}>("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES($1,'2026-10-30','Antigo','Sé','São Paulo','SP') RETURNING id",[eu])
  await banco.sql("INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{}','entregue',now())",[p.id,e.id])
  expect(await ler(e.id)).toEqual({ok:false,motivo:'sem_permissao'})
  const r = await banco.comoUsuario(eu,async sql => (await sql<{dados:{total:number}}>(`SELECT prospeccao_pessoal('{"nicho":"Antigo"}') dados`)).linhas[0].dados)
  expect(r.total).toBe(0)
})
test('origem inativa é informação explícita sem liberar ações ou confundir pendência', async () => {
  const [e] = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Origem inativa','11922224444') RETURNING id")
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[e.id,eu])
  expect(await ler(e.id)).toMatchObject({ok:true,dados:{situacao:'indisponivel',motivoIndisponibilidade:'origem_inativa'}})
})
test('paginação mantém 20 e filtros antes do limite, sem dados de vendedor alheio', async () => {
  const vendedor = await criarUsuario(banco,'vendedor','PaginaDetalhes')
  await banco.sql(`WITH novas AS (INSERT INTO empresa(razao_social,telefone) SELECT 'Página '||i,'119'||lpad(i::text,8,'0') FROM generate_series(1,23) i RETURNING id)
    INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) SELECT id,$1,'legado' FROM novas`,[vendedor])
  const consultar = (f: object) => banco.comoUsuario(vendedor,async sql => (await sql<{dados:{empresas:{id:string;nome:string}[];total:number}}>('SELECT prospeccao_pessoal($1) dados',[JSON.stringify(f)])).linhas[0].dados)
  const pagina1=await consultar({}),pagina2=await consultar({pagina:'2'})
  expect(pagina1.total).toBe(23); expect(pagina1.empresas).toHaveLength(20); expect(pagina2.empresas).toHaveLength(3)
  expect(new Set([...pagina1.empresas,...pagina2.empresas].map(e=>e.id)).size).toBe(23)
  expect((await consultar({nome:'Página 23'})).empresas.map(e=>e.nome)).toEqual(['Página 23'])
})
test('arquivadas saem da consulta padrão e aparecem por filtro; versões permanecem opacas', async () => {
  await banco.sql('UPDATE empresa_vinculo SET arquivada_em=now(),versao=17 WHERE empresa_id=$1',[minha])
  expect(await ler(minha)).toMatchObject({ok:true,dados:{situacao:'sem_interesse',versao:17}})
  const consultar = (f: object) => banco.comoUsuario(eu, async sql => (await sql<{dados:{total:number;empresas:unknown[]}}>('SELECT prospeccao_pessoal($1) dados',[JSON.stringify(f)])).linhas[0].dados)
  expect((await consultar({nome:'Minha'})).total).toBe(0)
  expect((await consultar({})).empresas).not.toEqual(expect.arrayContaining([expect.objectContaining({id:minha})]))
  expect(await consultar({disponibilidade:'sem_interesse'})).toMatchObject({total:1,empresas:[{id:minha,situacao:'sem_interesse',versao:17}]})
  await expect(consultar({disponibilidade:'em_descanso'})).rejects.toMatchObject({code:'22023'})
})
test('ator inativo perde cadastro e snapshot; gestor diagnostica responsável inativo', async () => {
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[eu])
  expect(await ler(minha)).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await snapshot('12345678000199')).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await ler(minha,gestor)).toMatchObject({ok:true,dados:{situacao:'indisponivel',motivoIndisponibilidade:'responsavel_inativo'}})
})
