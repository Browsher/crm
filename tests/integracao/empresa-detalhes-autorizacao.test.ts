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
test('resumo pessoal e detalhes compartilham localização congelada, origens e situação', async () => {
  const vendedor = await criarUsuario(banco,'vendedor','ResumoComum')
  const [e] = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Resumo comum','11912341234') RETURNING id")
  await vincularGrupoAtivo(banco,[e.id])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[e.id,vendedor])
  const [p] = await banco.sql<{id:string}>(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,snapshot) VALUES($1,'2026-10-29','Alterado','Alterado','São Paulo','SP','{"nicho":"Nicho entregue","bairro":"Sé","cidade":"São Paulo","uf":"SP"}') RETURNING id`,[vendedor])
  await banco.sql("INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{}','entregue',now())",[p.id,e.id])
  const consulta = await banco.comoUsuario(vendedor,async sql => (await sql<{dados:{empresas:Record<string,unknown>[]}}>('SELECT prospeccao_pessoal() dados')).linhas[0].dados)
  const detalhe = await ler(e.id,vendedor)
  const dados = detalhe.dados as Record<string,unknown>
  for(const campo of ['id','nome','bairro','cidade','uf','origens','recebidaEm','situacao','versao','negociacaoId']) expect(consulta.empresas[0][campo],campo).toEqual(dados[campo])
  expect(dados.bairro).toBe('Sé')
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
