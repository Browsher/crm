import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { lerDashboard } from '@/src/features/gestao/consulta'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'

let banco: BancoDeTeste
let gestor: string
let ana: string
let bia: string
let inativo: string
let sequencia = 0
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  ana = await criarUsuario(banco, 'vendedor', 'Ana')
  bia = await criarUsuario(banco, 'vendedor', 'Bia')
  inativo = await criarUsuario(banco, 'vendedor', 'Inativo')
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [inativo])
  // Apenas no banco descartável: fixture precisa fixar autor e horário histórico.
  await banco.sql('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql('DELETE FROM empresa')
})
async function empresa(dono: string | null = null) {
  const [{ id }] = await banco.sql<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,telefone)
    VALUES ($1,$2,'11987654321') RETURNING id`, [String(++sequencia).padStart(14, '0'), `Empresa ${sequencia}`])
  await vincularGrupoAtivo(banco, [id])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [id, dono])
  return id
}
async function contato(id: string, autor: string, dias: number | null, tipo = 'interessado', segundos = 0) {
  await banco.sql(`INSERT INTO contato(empresa_id,tipo,criado_por,criado_em,proximo_passo,proximo_passo_data)
    VALUES($1,$2,$3, ((now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
      + make_interval(secs => $5), CASE WHEN $4::int IS NULL THEN NULL ELSE 'Retornar' END,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date + $4::int)`, [id, tipo, autor, dias, segundos])
}
test('somente ativos, com zero explícito e ordem por nome', async () => {
  const r = await lerDashboard(gestor)
  expect(r?.vendedores).toEqual([
    { id: ana, nome: 'Ana', clientes: 0, atrasados: 0, hoje: 0, contatosHoje: 0 },
    { id: bia, nome: 'Bia', clientes: 0, atrasados: 0, hoje: 0, contatosHoje: 0 },
  ])
  expect(r?.disponiveis).toBe(0)
  expect(r?.atividade).toEqual([])
})
test('recusa vendedor, usuário inexistente e gestor desativado', async () => {
  expect(await lerDashboard(ana)).toBeNull()
  expect(await lerDashboard('00000000-0000-4000-8000-000000000000')).toBeNull()
  const desativado = await criarUsuario(banco, 'gestor', 'GestorDesativado')
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [desativado])
  expect(await lerDashboard(desativado)).toBeNull()
})
test('último retorno por empresa, contatos por autor e limite do dia de São Paulo', async () => {
  const a = await empresa(ana)
  const b = await empresa(ana)
  const c = await empresa(bia)
  const d = await empresa(inativo)
  await contato(a, ana, -2, 'interessado', -1) // ontem, fora da contagem diária
  await contato(a, bia, 0, 'retornar_depois', 0) // meia-noite, autor distinto do dono
  await contato(b, ana, -1, 'interessado', 1)
  await contato(b, ana, -1, 'nao_liguei', 2)
  await contato(c, bia, 2, 'acompanhamento', 3)
  await contato(d, inativo, -1, 'interessado', 4)
  await contato(c, bia, null, 'interessado', 86400) // amanhã, fora da contagem
  const r = await lerDashboard(gestor)
  expect(r?.vendedores).toEqual([
    { id: ana, nome: 'Ana', clientes: 2, atrasados: 1, hoje: 1, contatosHoje: 1 },
    { id: bia, nome: 'Bia', clientes: 1, atrasados: 0, hoje: 0, contatosHoje: 2 },
  ])
  expect(r?.atividade.every(item => item.vendedor !== 'Inativo')).toBe(true)
  expect(r?.atividade).toHaveLength(6)
})
test('estoque exclui posse ativa, reserva válida, descanso, grupo inativo e não duplica grupos', async () => {
  const livre = await empresa()
  await vincularGrupoAtivo(banco, [livre])
  await empresa(ana)
  await empresa(inativo) // posse inativa volta a ser elegível, conforme a fila
  const reservado = await empresa()
  await banco.sql("UPDATE empresa_fila SET reservado_por=$2,reservado_ate=now()+interval '1 hour' WHERE empresa_id=$1", [reservado, ana])
  const descanso = await empresa()
  await banco.sql("UPDATE empresa_fila SET elegivel_em=now()+interval '1 hour' WHERE empresa_id=$1", [descanso])
  const oculto = await empresa()
  await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id IN (SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1)', [oculto])
  expect((await lerDashboard(gestor))?.disponiveis).toBe(2)
  expect((await lerDashboard(gestor))?.vendedores[0].clientes).toBe(1)
})
test('atividade limitada a dez, ordenada, preserva vários registros da mesma empresa', async () => {
  const id = await empresa(ana)
  for (let i = 0; i < 12; i++) await contato(id, ana, null, 'interessado', i)
  const r = await lerDashboard(gestor)
  expect(r?.atividade).toHaveLength(10)
  expect(r?.vendedores[0].contatosHoje).toBe(12)
  expect(r?.vendedores[0].clientes).toBe(1)
  expect(r!.atividade.map(item => item.em)).toEqual([...r!.atividade.map(item => item.em)].sort().reverse())
})
test('desativar retira card e atividade sem apagar empresa nem contato', async () => {
  const id = await empresa(ana)
  await contato(id, ana, -1)
  expect((await lerDashboard(gestor))?.vendedores[0].clientes).toBe(1)
  try {
    await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [ana])
    const r = await lerDashboard(gestor)
    expect(r?.vendedores.map(v => v.id)).toEqual([bia])
    expect(r?.atividade).toEqual([])
    expect(await banco.sql('SELECT vendedor_id FROM empresa_fila WHERE empresa_id=$1', [id])).toEqual([{ vendedor_id: ana }])
    expect(await banco.sql('SELECT count(*)::int AS n FROM contato WHERE empresa_id=$1', [id])).toEqual([{ n: 1 }])
  } finally { await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1', [ana]) }
})
test('desempata último contato pelo id quando os horários coincidem', async () => {
  const id = await empresa(ana)
  await banco.sql(`INSERT INTO contato(id,empresa_id,tipo,criado_por,criado_em,proximo_passo,proximo_passo_data)
    VALUES ('00000000-0000-4000-8000-000000000002',$1,'acompanhamento',$2,now(),'Retornar',(now() AT TIME ZONE 'America/Sao_Paulo')::date),
    ('00000000-0000-4000-8000-000000000001',$1,'acompanhamento',$2,now(),'Retornar',(now() AT TIME ZONE 'America/Sao_Paulo')::date-1)`, [id, ana])
  expect((await lerDashboard(gestor))?.vendedores[0]).toMatchObject({ clientes: 1, atrasados: 0, hoje: 1, contatosHoje: 2 })
})
