import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste, eu:string, gestor:string, empresa:string
beforeAll(async()=>{
  banco=await criarBancoDeTeste()
  eu=await criarUsuario(banco,'vendedor','Aposentadoria')
  gestor=await criarUsuario(banco,'gestor','AposentadoriaGestor')
  ;[{id:empresa}]=await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Arquivo legado','11987654321') RETURNING id")
  await banco.sql("INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES($1,$2,now()+interval '30 minutes')",[empresa,eu])
})
afterAll(async()=>{await banco?.derrubar()})

const aposentadas=[
  "fila_reservar(NULL,'',NULL,NULL,NULL,NULL,NULL,NULL)",
  "prospeccao_pessoal_reservar(NULL,'{}',NULL)",
  "contato_registrar(NULL,'interessado',NULL,NULL,NULL,'assumir')",
  "funil_devolver(NULL,'Sem interesse')",
  "empresa_consultar('',NULL,NULL,NULL,NULL,1,NULL)",
  'empresa_filtros(NULL,NULL,NULL)', 'empresa_perfil(NULL)', 'empresa_recentes()', 'empresa_sugestoes()',
  'busca_empresa_grupos_google()', 'grupo_prospeccao_ler(NULL)', 'grupos_prospeccao_listar(1)',
]
test.each(aposentadas)('comando aposentado nega execução: %s',async chamada=>{
  for(const ator of [eu,gestor]) await expect(banco.comoUsuario(ator,e=>e(`SELECT ${chamada}`))).rejects.toMatchObject({code:'42501'})
})
test('reserva antiga preservada não autoriza empresa, contato ou linha de fila',async()=>{
  for(const tabela of ['empresa','empresa_fila','contato']) expect((await banco.comoUsuario(eu,e=>e(`SELECT * FROM ${tabela}`))).linhas).toEqual([])
  expect(await banco.sql('SELECT reservado_por FROM empresa_fila WHERE empresa_id=$1',[empresa])).toEqual([{reservado_por:eu}])
  expect((await banco.comoUsuario(gestor,e=>e('SELECT id FROM empresa'))).linhas).toEqual([{id:empresa}])
})
test('dados cadastrais e visita de empresa alheia não contornam o catálogo fechado',async()=>{
  await banco.sql("INSERT INTO empresa_dados_cadastrais(empresa_id,fonte,coletado_em,telefones) VALUES($1,'CNPJ.biz',now(),'[]')",[empresa])
  expect((await banco.comoUsuario(eu,e=>e('SELECT * FROM empresa_dados_cadastrais_ler($1)',[empresa]))).linhas).toEqual([])
  expect((await banco.comoUsuario(eu,e=>e('SELECT empresa_recente_registrar($1) AS r',[empresa]))).linhas).toEqual([{r:false}])
})
