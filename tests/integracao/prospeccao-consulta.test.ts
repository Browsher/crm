import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let eu: string
let outro: string
let inativo: string
let sequencia = 0
const base = ['', null, null, null, null, 1]
const consultar = (params: unknown[] = base, usuario = eu) => banco.comoUsuario(usuario, e => e<Record<string, unknown>>('SELECT * FROM empresa_consultar($1,$2,$3,$4,$5,$6)', params))
const opcoes = (uf: string | null = null, cidade: string | null = null) => banco.comoUsuario(eu, e => e('SELECT * FROM empresa_filtros($1,$2)', [uf, cidade]))

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  eu = await criarUsuario(banco, 'vendedor', 'ConsultaEu')
  outro = await criarUsuario(banco, 'vendedor', 'ConsultaOutro')
  inativo = await criarUsuario(banco, 'vendedor', 'ConsultaInativo')
  await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [inativo])
  await banco.sql(`INSERT INTO cep (cep, bairro, localidade, uf, ibge) VALUES
    ('01000000','Centro','Homônima','SP','3550308'),
    ('02000000','Centro','Homônima','SP','3500000'),
    ('03000000',' ','Outra','RJ','3304557'),
    ('04000000','Não importado','Ausente','MG','3100000')`)
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
})
async function empresa(nome = 'Empresa', cep: string | null = null, cnae: string | null = null) {
  const [r] = await banco.sql<{ id: string }>(`INSERT INTO empresa (cnpj,razao_social,nome_fantasia,telefone,email,contato_nome,cep,cnae_principal)
    VALUES ($1,$2,'Fantasia','11987654321','sigilo@teste.local','Pessoa privada',$3,$4) RETURNING id`,
  [String(++sequencia).padStart(14, '0'), nome, cep, cnae])
  return r.id
}

test('projeção fechada permite resumo alheio e mantém RLS de empresa e histórico', async () => {
  const id = await empresa()
  await banco.sql('INSERT INTO empresa_fila (empresa_id,vendedor_id) VALUES ($1,$2)', [id,outro])
  await banco.sql("INSERT INTO contato (empresa_id,tipo,nota) VALUES ($1,'acompanhamento','Histórico privado')",[id])
  const r = await consultar()
  expect(r.linhas).toHaveLength(1)
  expect(Object.keys(r.linhas[0]).sort()).toEqual(['id','razao_social','nome_fantasia','cnae_principal','cidade','uf','bairro','disponibilidade'].sort())
  expect(r.linhas[0].disponibilidade).toBe('outro_vendedor')
  expect((await banco.comoUsuario(eu,e => e('SELECT * FROM empresa WHERE id=$1',[id]))).linhas).toEqual([])
  expect((await banco.comoUsuario(eu,e => e('SELECT * FROM contato WHERE empresa_id=$1',[id]))).linhas).toEqual([])
  expect((await banco.comoUsuario(outro,e => e('SELECT * FROM contato WHERE empresa_id=$1',[id]))).linhas).toHaveLength(1)
})

test('nega identidade ausente, inexistente, desativada e execução pública', async () => {
  await expect(banco.sql('SELECT * FROM empresa_consultar($1,$2,$3,$4,$5,$6)',base)).rejects.toMatchObject({code:'42501'})
  await expect(consultar(base,inativo)).rejects.toMatchObject({code:'42501'})
  await expect(consultar(base,'00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({code:'42501'})
  await expect(banco.sql('SELECT * FROM empresa_filtros(NULL,NULL)')).rejects.toMatchObject({code:'42501'})
  await expect(banco.comoUsuario(inativo,e => e('SELECT * FROM empresa_filtros(NULL,NULL)'))).rejects.toMatchObject({code:'42501'})
  await banco.sql('CREATE ROLE consulta_publico NOLOGIN')
  try {
    await expect(banco.sql('SET LOCAL ROLE consulta_publico; SELECT * FROM empresa_filtros(NULL,NULL)')).rejects.toMatchObject({code:'42501'})
    await expect(banco.sql("SET LOCAL ROLE consulta_publico; SELECT * FROM empresa_consultar('',NULL,NULL,NULL,NULL,1)")).rejects.toMatchObject({code:'42501'})
  } finally {
    await banco.sql('DROP ROLE consulta_publico')
  }
  const acl = await banco.sql(`SELECT p.proname FROM pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.proname IN ('empresa_consultar','empresa_filtros') AND a.grantee=0 AND a.privilege_type='EXECUTE'`)
  expect(acl).toEqual([])
})

test.each([
  ['comigo','eu',null,null,'future'], ['outro_vendedor','outro',null,null,'future'],
  ['disponivel','inativo',null,null,null], ['reservada_comigo',null,'eu','future','future'],
  ['outro_vendedor',null,'outro','future',null], ['disponivel',null,'outro','past',null],
  ['em_descanso',null,null,null,'future'], ['disponivel',null,null,null,'past'],
])('disponibilidade %s com posse %s reserva %s %s descanso %s', async (esperado,dono,reserva,prazo,descanso) => {
  const id = await empresa()
  const usuarios: Record<string,string> = { eu,outro,inativo }
  const instante = (p: string | null) => p ? new Date(Date.now() + (p === 'future' ? 3600000 : -3600000)) : null
  await banco.sql('INSERT INTO empresa_fila (empresa_id,vendedor_id,reservado_por,reservado_ate,elegivel_em) VALUES ($1,$2,$3,$4,$5)',
    [id,dono ? usuarios[dono] : null,reserva ? usuarios[reserva] : null,instante(prazo),instante(descanso)])
  expect((await consultar()).linhas[0].disponibilidade).toBe(esperado)
})

test('nome ignora caixa e acento, encontra fantasia e não pesquisa CNPJ', async () => {
  await empresa('Ação Comércio')
  expect((await consultar(['ACAO',...base.slice(1)])).linhas).toHaveLength(1)
  expect((await consultar(['fantasia',...base.slice(1)])).linhas).toHaveLength(1)
  expect((await consultar([String(sequencia).padStart(14,'0'),...base.slice(1)])).linhas).toEqual([])
})
test.each(['%','_','\\'])('nome trata %s literalmente', async caractere => {
  const id = await empresa(`Nome ${caractere} literal`)
  await empresa('Nome comum')
  expect((await consultar([caractere,...base.slice(1)])).linhas.map(r=>r.id)).toEqual([id])
})

test('filtros AND distinguem IBGE homônimo; CEP ausente, desconhecido e bairro vazio preservados', async () => {
  const alvo = await empresa('Alvo','01000000','1234567')
  await empresa('Alvo','02000000','1234567')
  const sem = await empresa('Sem CEP')
  const desconhecido = await empresa('CEP desconhecido','99999999')
  const vazio = await empresa('Bairro vazio','03000000')
  expect((await consultar(['Alvo','1234567','SP','3550308','Centro',1])).linhas.map(r=>r.id)).toEqual([alvo])
  expect((await consultar(['Alvo','7654321','SP','3550308','Centro',1])).linhas).toEqual([])
  const nulos = (await consultar(['','nao_informado',null,null,null,1])).linhas
  expect(nulos.map(r=>r.id).sort()).toEqual([sem,desconhecido,vazio].sort())
  expect(nulos.every(r=>r.bairro === null)).toBe(true)
})

test('opções vêm somente de empresas e dependências geográficas são respeitadas', async () => {
  await empresa('A','01000000','1234567')
  await empresa('B','02000000','1234567')
  await empresa('C','03000000')
  const iniciais = (await opcoes()).linhas
  expect(iniciais).toEqual(expect.arrayContaining([
    {tipo:'cnae',valor:'1234567',rotulo:'1234567'}, {tipo:'cnae',valor:'nao_informado',rotulo:'Não informado'},
    {tipo:'uf',valor:'SP',rotulo:'SP'}, {tipo:'uf',valor:'RJ',rotulo:'RJ'},
  ]))
  expect(iniciais).toHaveLength(4)
  expect((await opcoes('SP')).linhas).toEqual(expect.arrayContaining([
    {tipo:'cidade',valor:'3550308',rotulo:'Homônima'}, {tipo:'cidade',valor:'3500000',rotulo:'Homônima'},
  ]))
  expect((await opcoes('SP','3550308')).linhas).toContainEqual({tipo:'bairro',valor:'Centro',rotulo:'Centro'})
  expect((await opcoes('RJ','3304557')).linhas).not.toContainEqual(expect.objectContaining({tipo:'bairro'}))
})

test.each([
  [null,null,null,null,null,1], ['x'.repeat(101),null,null,null,null,1],
  ['',null,null,null,null,null], ['',null,null,null,null,0], ['',null,null,null,null,10001],
  ['','abc',null,null,null,1], ['',null,'sp',null,null,1], ['',null,null,'3550308',null,1],
  ['',null,'SP','x',null,1], ['',null,'SP',null,'Centro',1], ['',null,'SP','3550308','x'.repeat(201),1],
])('SQL recusa parâmetros inválidos %j', async (...params) => {
  await expect(consultar(params)).rejects.toMatchObject({code:'22023'})
})

test.each([['sp',null],[null,'3550308'],['SP','abc']])('opções recusam geografia inválida %s %s', async (uf,cidade) => {
  await expect(opcoes(uf,cidade)).rejects.toMatchObject({code:'22023'})
})

test('limites inclusivos SQL e leitura com senha provisória pendente', async () => {
  await empresa('x'.repeat(100))
  expect((await consultar(['x'.repeat(100),null,null,null,null,1])).linhas).toHaveLength(1)
  expect((await consultar(['',null,'SP','3550308','x'.repeat(200),10000])).linhas).toEqual([])
  const pendente = await criarUsuario(banco,'vendedor','ConsultaPendente')
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[pendente])
  expect((await consultar(base,pendente)).linhas).toHaveLength(1)
})

test('paginação SQL busca 21, ordena empates por id e respeita offset', async () => {
  for(let i=0;i<25;i++) await empresa('Mesmo nome')
  const todas = await banco.sql<{id:string}>('SELECT id FROM empresa ORDER BY razao_social,id')
  expect((await consultar()).linhas.map(r=>r.id)).toEqual(todas.slice(0,21).map(r=>r.id))
  expect((await consultar(['',null,null,null,null,2])).linhas.map(r=>r.id)).toEqual(todas.slice(20).map(r=>r.id))
})

test('repositório traduz campos, limita a 20 e informa próxima página', async () => {
  const { consultarEmpresas, listarOpcoes } = await import('@/src/features/prospeccao/repositorio')
  for (let i = 0; i < 21; i++) await empresa('Mesmo nome','01000000','1234567')
  const filtros = {nome:'',cnae:null,uf:null,cidade:null,bairro:null,pagina:1}
  const primeira = await consultarEmpresas(eu,filtros)
  expect(primeira.ok).toBe(true)
  if (!primeira.ok) throw new Error('esperava sucesso')
  expect(primeira.empresas).toHaveLength(20)
  expect(primeira.temProxima).toBe(true)
  expect(primeira.empresas[0]).toMatchObject({razaoSocial:'Mesmo nome',nomeFantasia:'Fantasia',cnaePrincipal:'1234567',cidade:'Homônima',uf:'SP',bairro:'Centro',disponibilidade:'disponivel'})
  expect(await consultarEmpresas(eu,{...filtros,pagina:3})).toEqual({ok:true,empresas:[],temProxima:false})
  expect(await consultarEmpresas(inativo,filtros)).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await listarOpcoes(inativo,null,null)).toEqual({ok:false,motivo:'sem_permissao'})
  expect(await listarOpcoes(eu,'SP','3550308')).toMatchObject({ok:true,opcoes:expect.arrayContaining([{tipo:'bairro',valor:'Centro',rotulo:'Centro'}])})
  await expect(consultarEmpresas(eu,{...filtros,pagina:0})).rejects.toMatchObject({code:'22023'})
  await banco.sql('DROP FUNCTION empresa_filtros(text,text)')
  await expect(listarOpcoes(eu,null,null)).rejects.toMatchObject({code:'42883'})
})
