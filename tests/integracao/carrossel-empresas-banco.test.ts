import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste, eu: string, outro: string, gestor: string
const ids: string[] = []
let nomeOriginal: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  eu = await criarUsuario(banco, 'vendedor', 'RecentesEu')
  outro = await criarUsuario(banco, 'vendedor', 'RecentesOutro')
  gestor = await criarUsuario(banco, 'gestor', 'RecentesGestor')
  for (let i = 1; i <= 13; i++) {
    const [{ id }] = await banco.sql<{id:string}>('INSERT INTO empresa(cnpj,razao_social,telefone,email) VALUES($1,$2,$3,$4) RETURNING id', [String(88000000000000 + i), 'Empresa própria ' + i, '11998760123', 'privado@empresa.test'])
    ids.push(id)
    await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'banco')",[id,eu])
    const nome = i === 13 ? 'Armarinhos e variedades · Região central de São Paulo · Grupo de origem com nome extenso' : 'Lista própria ' + i
    if (i === 13) nomeOriginal = nome
    const [{ id: grupo }] = await banco.sql<{id:string}>('INSERT INTO grupo_importacao(nome) VALUES($1) RETURNING id', [nome])
    await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [grupo,id])
    await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id,criado_em) VALUES($1,$2,jsonb_build_object('palavra','Armarinhos'),1,'concluida',$3,$4)", [eu,nome,grupo,`2026-10-${String(i).padStart(2,'0')}T12:00:00Z`])
  }
  const [{ id: repetido }] = await banco.sql<{id:string}>("INSERT INTO grupo_importacao(nome) VALUES('Lista posterior') RETURNING id")
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [repetido,ids[12]])
  await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id,criado_em) VALUES($1,'Lista posterior','{}',1,'concluida',$2,'2026-10-26T12:00:00Z')", [eu,repetido])
  const [{ id: segredo }] = await banco.sql<{id:string}>("INSERT INTO grupo_importacao(nome) VALUES('SEGREDO do outro vendedor') RETURNING id")
  const [{ id: alheia }] = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Empresa ALHEIA','11912345678') RETURNING id")
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'banco')",[alheia,outro])
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2),($1,$3)', [segredo,ids[12],alheia])
  await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id) VALUES($1,'SEGREDO do outro vendedor','{}',1,'concluida',$2)", [outro,segredo])
  await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas) VALUES($1,'Apenas candidata','{}',1,'concluida',jsonb_build_array(jsonb_build_object('cnpj','88000000000999','razao_social','CANDIDATA NÃO IMPORTADA')))", [eu])
})
afterAll(async () => { await banco?.derrubar() })
const consultar = (usuario = eu) => banco.comoUsuario(usuario, async sql => (await sql<{dados:{empresas:{id:string;grupoOrigem:string|null;entrada:string}[];total:number}}>("SELECT prospeccao_pessoal(jsonb_build_object('origem','banco')) AS dados")).linhas[0].dados)

test('grupo de origem é próprio, completo e do primeiro vínculo; ordem e unicidade são preservadas', async () => {
  const r = await consultar()
  expect(r.total).toBe(13)
  expect(r.empresas.map(e => e.id)).toEqual([...ids].reverse())
  expect(r.empresas[0].grupoOrigem).toBe(nomeOriginal)
  expect(r.empresas[0].entrada).toContain('2026-10-13')
})
test('não inclui candidatas, empresas alheias, grupos alheios nem contatos', async () => {
  const texto = JSON.stringify(await consultar())
  for (const proibido of ['SEGREDO','ALHEIA','CANDIDATA','11998760123','privado@empresa.test']) expect(texto).not.toContain(proibido)
  // Ter busca antiga para a empresa de eu não transfere o vínculo permanente.
  expect((await consultar(outro)).total).toBe(1)
})
test('acesso direto aos grupos continua protegido e papel gestor não vira vendedor', async () => {
  expect((await banco.comoUsuario(eu, sql => sql('SELECT nome FROM grupo_importacao'))).linhas).toEqual([])
  await expect(consultar(gestor)).rejects.toMatchObject({code:'42501'})
})
