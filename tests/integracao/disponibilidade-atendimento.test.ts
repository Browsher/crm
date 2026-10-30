import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'
import { comAdmin } from '@/src/server/db/admin'

type Linha = { empresaId: string; disponivel: boolean; motivo: 'pendente' | 'origem_inativa' | 'responsavel_inativo' | null }
type Resultado = { ok: true; empresas: Linha[] } | { ok: false; motivo: 'sem_permissao' | 'dados_invalidos' }
let banco: BancoDeTeste
let vendedor: string, outro: string, gestor: string, propria: string, alheia: string
beforeAll(async () => {
  banco=await criarBancoDeTeste()
  vendedor=await criarUsuario(banco,'vendedor','Disponibilidade')
  outro=await criarUsuario(banco,'vendedor','DisponibilidadeOutra')
  gestor=await criarUsuario(banco,'gestor','DisponibilidadeGestor')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql("UPDATE usuario SET ativo=true,senha_provisoria_pendente=false,papel=CASE WHEN id=$1 THEN 'gestor' ELSE 'vendedor' END WHERE id=ANY($2::uuid[])",[gestor,[vendedor,outro,gestor]])
  const empresas=await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Disponibilidade própria','11987654321'),('Disponibilidade alheia','11987654321') RETURNING id")
  ;[propria,alheia]=empresas.map(e=>e.id)
  await vincularGrupoAtivo(banco,[propria,alheia])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado'),($3,$4,'legado')",[propria,vendedor,alheia,outro])
})
async function ler(ator:string,ids:(string|null)[]|null):Promise<Resultado> {
  return banco.comoUsuario(ator,async e=>(await e<{r:Resultado}>('SELECT empresas_disponibilidade_ler($1::uuid[]) AS r',[ids])).linhas[0].r)
}
async function resumo(){return banco.comoUsuario(vendedor,async e=>(await e<{r:{ok:true;empresas:{id:string;situacao:string;motivoIndisponibilidade:string|null}[]}}>('SELECT empresas_resumos_ler($1::uuid[]) AS r',[[propria]])).linhas[0].r.empresas[0])}

test('vendedor lê subset próprio deduplicado e omite alheio e inexistente',async()=>{
  expect(await ler(vendedor,[propria,alheia,propria,'00000000-0000-4000-8000-000000000000'])).toEqual({ok:true,empresas:[{empresaId:propria,disponivel:true,motivo:null}]})
  expect(await ler(outro,[propria])).toEqual({ok:true,empresas:[]})
})
test('gestor lê disponibilidade real de donos distintos sem receber versão ou comando',async()=>{
  const r=await ler(gestor,[propria,alheia])
  expect(r.ok&&r.empresas).toEqual([propria,alheia].sort().map(empresaId=>({empresaId,disponivel:true,motivo:null})))
  const detalhes=await banco.comoUsuario(gestor,e=>e<{r:{dados:{versao:null;situacao:string}}}>('SELECT empresa_detalhes_ler($1) AS r',[propria]))
  expect(detalhes.linhas[0].r.dados).toMatchObject({versao:null,situacao:'indisponivel'})
})
test('autenticação vem antes do lote vazio e papel/estado vigente não ficam em cache',async()=>{
  expect(await ler('00000000-0000-4000-8000-000000000000',[])).toEqual({ok:false,motivo:'sem_permissao'})
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[vendedor])
  expect(await ler(vendedor,[])).toEqual({ok:false,motivo:'sem_permissao'})
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[gestor])
  expect((await ler(gestor,[propria])).ok).toBe(true)
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[gestor])
  expect(await ler(gestor,[])).toEqual({ok:false,motivo:'sem_permissao'})
  await banco.sql("UPDATE usuario SET ativo=true,senha_provisoria_pendente=false,papel='vendedor' WHERE id=$1",[gestor])
  expect(await ler(gestor,[propria,alheia])).toEqual({ok:true,empresas:[]})
})
test('recusa nulo/elemento nulo e 101 distintos, aceita 100 e deduplica 101 repetidos',async()=>{
  expect(await ler(vendedor,null)).toEqual({ok:false,motivo:'dados_invalidos'})
  expect(await ler(vendedor,[null])).toEqual({ok:false,motivo:'dados_invalidos'})
  const ids=(await banco.sql<{id:string}>('SELECT gen_random_uuid() AS id FROM generate_series(1,101)')).map(e=>e.id)
  expect(await ler(gestor,ids.slice(0,100))).toEqual({ok:true,empresas:[]})
  expect(await ler(gestor,ids)).toEqual({ok:false,motivo:'dados_invalidos'})
  expect(await ler(vendedor,Array.from({length:101},()=>propria))).toEqual({ok:true,empresas:[{empresaId:propria,disponivel:true,motivo:null}]})
})
test('fonte inativa e pendência têm paridade com resumo comum; gestor mantém ator próprio',async()=>{
  await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id IN (SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1)',[propria])
  expect(await ler(vendedor,[propria])).toEqual({ok:true,empresas:[{empresaId:propria,disponivel:false,motivo:'origem_inativa'}]})
  expect(await ler(gestor,[propria])).toEqual(await ler(vendedor,[propria]))
  expect(await resumo()).toMatchObject({situacao:'indisponivel',motivoIndisponibilidade:'origem_inativa'})
  await banco.sql("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,candidatos,evidencias) VALUES($1,'fixture',$2,'{}')",[propria,[vendedor,outro]])
  expect(await ler(vendedor,[propria])).toEqual({ok:true,empresas:[{empresaId:propria,disponivel:false,motivo:'pendente'}]})
  expect(await resumo()).toMatchObject({situacao:'indisponivel',motivoIndisponibilidade:'pendente'})
})
test('dono inativo fica indisponível no gestor e papel do gestor não concede comando ao dono',async()=>{
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[vendedor])
  expect(await ler(gestor,[propria])).toEqual({ok:true,empresas:[{empresaId:propria,disponivel:false,motivo:'responsavel_inativo'}]})
})

test('origem delegada preserva matriz anterior de observador, grupo e exclusividade',async()=>{
  const planos=new Map<string,string>()
  for(const dono of [vendedor,outro]) {
    const [p]=await banco.sql<{id:string}>("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES($1,'2026-10-29','Teste','','Cidade','SP') RETURNING id",[dono])
    planos.set(dono,p.id)
  }
  for(const exclusivo of [null,vendedor,outro]) for(const grupoAtivo of [true,false]) {
    await banco.sql('DELETE FROM google_exclusividade WHERE empresa_id=$1',[propria])
    if(exclusivo) await banco.sql('INSERT INTO google_exclusividade(empresa_id,vendedor_id,planejamento_id) VALUES($1,$2,$3)',[propria,exclusivo,planos.get(exclusivo)])
    await banco.sql('UPDATE grupo_importacao SET ativo=$2 WHERE id IN (SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1)',[propria,grupoAtivo])
    for(const ator of [vendedor,outro,gestor]) {
      // Admin somente neste harness compara o helper privado como antes da 0055.
      // A identidade muda apenas na transação de teste, nunca na implementação.
      const r=await comAdmin(banco.urlAdmin,async c=>{
        await c.query('BEGIN')
        try {
          await c.query("SELECT set_config('app.usuario_id',$1,true)",[ator])
          return (await c.query<{antiga:boolean;nova:boolean}>(`SELECT
            (public.eh_gestor() OR NOT EXISTS(SELECT 1 FROM google_exclusividade WHERE empresa_id=$1 AND vendedor_id<>public.usuario_atual()))
              AND (EXISTS(SELECT 1 FROM grupo_importacao_empresa ge JOIN grupo_importacao g ON g.id=ge.grupo_id WHERE ge.empresa_id=$1 AND g.ativo)
                OR EXISTS(SELECT 1 FROM google_exclusividade WHERE empresa_id=$1)) AS antiga,
            public.empresa_origem_ativa($1) AS nova`,[propria])).rows[0]
        } finally { await c.query('ROLLBACK') }
      })
      expect(r.nova,JSON.stringify({ator,exclusivo,grupoAtivo})).toBe(r.antiga)
    }
    const esperado=(exclusivo===null||exclusivo===vendedor)&&(grupoAtivo||exclusivo!==null)
    expect(await ler(gestor,[propria])).toEqual({ok:true,empresas:[{empresaId:propria,disponivel:esperado,motivo:esperado?null:'origem_inativa'}]})
    expect((await resumo()).motivoIndisponibilidade).toBe(esperado?null:'origem_inativa')
  }
})

test('helpers e projeção não têm grant, wrapper não grava vínculo, histórico ou operação',async()=>{
  const privadas=[
    {assinatura:'empresa_origem_ativa_para(uuid,uuid)',sql:'SELECT empresa_origem_ativa_para($1,$2)',args:[propria,vendedor]},
    {assinatura:'empresa_origem_ativa(uuid)',sql:'SELECT empresa_origem_ativa($1)',args:[propria]},
    {assinatura:'empresa_atendimento_motivo(uuid)',sql:'SELECT empresa_atendimento_motivo($1)',args:[propria]},
    {assinatura:'empresa_atendimento_resumos(uuid,uuid)',sql:'SELECT empresa_atendimento_resumos($1,$2)',args:[vendedor,propria]},
  ]
  for(const privada of privadas) {
    const [r]=await banco.sql<{permitido:boolean}>('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS permitido',['app_usuario',privada.assinatura])
    expect(r.permitido,privada.assinatura).toBe(false)
    await expect(banco.comoUsuario(vendedor,e=>e(privada.sql,privada.args))).rejects.toMatchObject({code:'42501'})
  }
  const snapshot=()=>banco.sql(`SELECT (SELECT jsonb_agg(to_jsonb(v) ORDER BY empresa_id) FROM empresa_vinculo v) AS vinculos,
    (SELECT count(*)::int FROM contato) AS contatos,(SELECT count(*)::int FROM venda) AS vendas,
    (SELECT count(*)::int FROM empresa_atendimento_operacao) AS operacoes`)
  const antes=await snapshot()
  await ler(vendedor,[propria,alheia]);await ler(gestor,[propria,alheia])
  expect(await snapshot()).toEqual(antes)
})
