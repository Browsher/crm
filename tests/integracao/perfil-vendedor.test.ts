import { beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { lerPerfilVendedor } from '@/src/features/gestao/perfil-vendedor'
import { lerDashboard } from '@/src/features/gestao/consulta'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outro: string
let sequencia = 0
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'Ana')
  outro = await criarUsuario(banco, 'vendedor', 'Bruno')
  // Somente fixture neste banco descartável: fixar autoria/instante histórico.
  await banco.sql('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
})
beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
})
afterAll(async () => { await banco?.derrubar() })
async function empresa(dono: string | null) {
  const [{ id }] = await banco.sql<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,telefone)
    VALUES($1,$2,'11999999999') RETURNING id`, [String(++sequencia).padStart(14,'0'),`Empresa ${String(sequencia).padStart(4,'0')}`])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)',[id,dono])
  return id
}
async function contato(id: string, autor: string, dias: number | null, tipo = 'acompanhamento', segundos = 0) {
  await banco.sql(`INSERT INTO contato(empresa_id,criado_por,criado_em,tipo,nota,proximo_passo,proximo_passo_data)
    VALUES($1,$2,((now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo')+make_interval(secs=>$5),
      $3,'Nota registrada',CASE WHEN $4::int IS NOT NULL THEN 'Retornar' END,(now() AT TIME ZONE 'America/Sao_Paulo')::date+$4::int)`,[id,autor,tipo,dias,segundos])
}
test('gestor vê vazio explícito; vendedor não consulta nem o próprio perfil', async () => {
  expect(await lerPerfilVendedor(gestor,vendedor)).toMatchObject({ nome:'Ana', clientes:0, atrasados:0, hoje:0, contatosHoje:0, empresas:[], atividade:[] })
  expect(await lerPerfilVendedor(vendedor,vendedor)).toBeNull()
  expect(await lerPerfilVendedor(gestor,gestor)).toBeNull()
  expect(await lerPerfilVendedor(gestor,'inválido')).toBeNull()
  expect(await lerPerfilVendedor(gestor,'00000000-0000-4000-8000-000000000000')).toBeNull()
})
test('alvo desativado não aparece e gestor desativado não lê', async () => {
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[outro])
  try { expect(await lerPerfilVendedor(gestor,outro)).toBeNull() }
  finally { await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1',[outro]) }
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[gestor])
  try { expect(await lerPerfilVendedor(gestor,vendedor)).toBeNull() }
  finally { await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1',[gestor]) }
})
test('resumo coincide com dashboard, autoria difere da posse, último contato governa retorno', async () => {
  const a = await empresa(vendedor)
  const b = await empresa(outro)
  const c = await empresa(null)
  await banco.sql("UPDATE empresa_fila SET reservado_por=$2,reservado_ate=now()+interval '1 hour' WHERE empresa_id=$1",[c,vendedor])
  await contato(a,vendedor,-1,'interessado',-1)
  await contato(a,outro,0,'retornar_depois',1)
  await contato(b,vendedor,2,'interessado',0)
  await contato(b,vendedor,2,'nao_liguei',2)
  await contato(b,vendedor,null,'acompanhamento',86400)
  const r = await lerPerfilVendedor(gestor,vendedor)
  expect(r).toMatchObject({ clientes:1, atrasados:0, hoje:1, contatosHoje:1, empresas:[expect.objectContaining({ id:a, retorno:expect.any(String) })] })
  expect(r?.atividade).toHaveLength(4)
  expect(r?.atividade.filter(c => c.empresaId===b)).toHaveLength(3)
  const dashboard = await lerDashboard(gestor)
  const resumo = dashboard!.vendedores.find(v=>v.id===vendedor)!
  expect(r).toMatchObject(resumo)
})
test('carteira paginada não muda total e atividade limita vinte registros', async () => {
  for (let i=0;i<51;i++) await empresa(vendedor)
  const pagina1 = await lerPerfilVendedor(gestor,vendedor,1)
  const pagina2 = await lerPerfilVendedor(gestor,vendedor,2)
  expect(pagina1?.clientes).toBe(51)
  expect(pagina1?.empresas).toHaveLength(50)
  expect(pagina2?.empresas).toHaveLength(1)
  expect(pagina1?.empresas.some(e=>e.id===pagina2?.empresas[0].id)).toBe(false)
  const id = pagina2!.empresas[0].id
  for(let i=0;i<21;i++) await contato(id,vendedor,null,'acompanhamento',i)
  const r = await lerPerfilVendedor(gestor,vendedor)
  expect(r?.atividade).toHaveLength(20)
  expect(r?.contatosHoje).toBe(21)
  expect(r!.atividade.map(c=>c.em)).toEqual([...r!.atividade.map(c=>c.em)].sort().reverse())
})
