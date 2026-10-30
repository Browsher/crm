import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularEmpresaTeste } from './atendimento-fixtures'
import { contarSemInteresse, lerNegociacao } from '@/src/features/funil/consulta'
import { lerAgendaAtendimento, lerAtendimento } from '@/src/server/atendimento/consulta'
import { lerHistorico } from '@/src/features/contato/historico'
import { arquivarSemInteresse, registrarContatoDireto, retomarAtendimento } from '@/src/server/atendimento/operacoes'

let banco: BancoDeTeste, eu: string, outro: string, empresa: string, seq = 0
beforeAll(async () => { banco = await criarBancoDeTeste(); eu = await criarUsuario(banco, 'vendedor', 'Leituras'); outro = await criarUsuario(banco, 'vendedor', 'LeiturasOutro') })
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  const [e] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES($1,'Arquivo revisão','11987654321') RETURNING id", [String(++seq).padStart(14, '0')])
  empresa = e.id
  await vincularEmpresaTeste(banco, empresa, eu, 'banco')
})
async function comando() { return { empresaId: empresa, chave: randomUUID(), versao: (await banco.sql<{ versao: number }>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0].versao } }
async function consultar(filtros: Record<string, string>, ator = eu) {
  return banco.comoUsuario(ator, async sql => (await sql<{ r: { total: number; empresas: { id: string; situacao: string; motivoIndisponibilidade: string | null }[] } }>('SELECT prospeccao_pessoal($1) r', [filtros])).linhas[0].r)
}
async function indisponivel(tipo: string) {
  if (tipo === 'origem_inativa') await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id IN (SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1)', [empresa])
  if (tipo === 'pendente') await banco.sql("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,evidencias) VALUES($1,'conflito','{}')", [empresa])
}
async function interessado() {
  expect(await registrarContatoDireto(eu, await comando(), { tipo: 'interessado', nota: 'História própria', proximoPasso: 'Passo antigo', proximoPassoData: '2026-01-01' })).toMatchObject({ ok: true })
  return (await banco.sql<{ id: string }>('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresa]))[0].id
}

test.each(['disponivel', 'origem_inativa', 'pendente'])('arquivo mantém pertença e consulta privada quando %s', async tipo => {
  const n = await interessado()
  expect(await arquivarSemInteresse(eu, await comando(), n)).toMatchObject({ ok: true })
  await indisponivel(tipo)
  const arquivo = await consultar({ disponibilidade: 'sem_interesse', cnpj: String(seq).padStart(14, '0') })
  expect(arquivo.empresas).toEqual([expect.objectContaining({ id: empresa, situacao: tipo === 'disponivel' ? 'sem_interesse' : 'indisponivel', motivoIndisponibilidade: tipo === 'disponivel' ? null : tipo })])
  expect((await consultar({ cnpj: String(seq).padStart(14, '0') })).total).toBe(0)
  expect((await consultar({ disponibilidade: 'sem_interesse' })).total).toBe((await contarSemInteresse(eu) as { total: number }).total)
  expect(await lerAtendimento(eu, empresa)).toMatchObject({ ok: true })
  const historia = await lerHistorico(eu, empresa)
  expect(historia.ok && historia.contatos.map(c => c.nota)).toContain('História própria')
  expect(await lerAtendimento(outro, empresa)).toEqual({ ok: false, motivo: 'sem_permissao' })
  expect(await lerHistorico(outro, empresa)).toEqual({ ok: true, contatos: [] })
  expect((await consultar({ disponibilidade: 'sem_interesse', cnpj: String(seq).padStart(14, '0') }, outro)).total).toBe(0)
  expect(await retomarAtendimento(eu, await comando())).toMatchObject(tipo === 'disponivel' ? { ok: true } : { ok: false, motivo: 'desatualizada' })
})

test('cliente arquivado indisponível preserva venda, nome/CNPJ e páginas sem repetição', async () => {
  const n = await interessado()
  expect((await banco.comoUsuario(eu, sql => sql("SELECT funil_venda_registrar($1,$2,'2026-01-01',1234,NULL) r", [n, randomUUID()]))).linhas[0]).toEqual({ r: 'ok' })
  const vendas = await banco.sql('SELECT * FROM venda WHERE empresa_id=$1', [empresa])
  expect(await arquivarSemInteresse(eu, await comando(), null)).toMatchObject({ ok: true })
  await indisponivel('origem_inativa')
  const ids = [empresa]
  for (let i = 0; i < 21; i++) {
    const [e] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Arquivo revisão página','11987654321') RETURNING id")
    await vincularEmpresaTeste(banco, e.id, eu, 'banco')
    await banco.sql('UPDATE empresa_vinculo SET arquivada_em=now() WHERE empresa_id=$1', [e.id]); ids.push(e.id)
  }
  const filtro = { disponibilidade: 'sem_interesse', nome: 'Arquivo revisão' }
  // Isola os arquivos deste cenário dos anteriores conservados pelo banco.
  const todos = await consultar(filtro)
  const paginas = []
  for (let pagina = 1; pagina <= Math.ceil(todos.total / 20); pagina++) paginas.push(...(await consultar({ ...filtro, pagina: String(pagina) })).empresas)
  expect(new Set(paginas.map(e => e.id)).size).toBe(todos.total)
  for (const id of ids) expect(paginas.map(e => e.id)).toContain(id)
  expect((await consultar({ ...filtro, cnpj: String(seq).padStart(14, '0') })).empresas.map(e => e.id)).toEqual([empresa])
  expect(await banco.sql('SELECT * FROM venda WHERE empresa_id=$1', [empresa])).toEqual(vendas)
  const historia = await lerHistorico(eu, empresa)
  expect(historia.ok && historia.contatos.some(c => c.venda?.centavos === '1234')).toBe(true)
})

test.each(['nula', 'outro_autor', 'propria', 'indisponivel'])('Funil usa agenda canônica %s e conserva apenas história autorizada', async tipo => {
  const n = await interessado()
  await banco.sql('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
  const [novo] = await banco.sql<{ id: string }>("INSERT INTO contato(empresa_id,criado_por,tipo,nota,proximo_passo,proximo_passo_data,criado_em) VALUES($1,$2,'interessado','História alheia',$3,$4,clock_timestamp()) RETURNING id", [empresa, outro, tipo === 'outro_autor' ? 'Passo vigente' : null, tipo === 'outro_autor' ? '2026-01-02' : null])
  await banco.sql('ALTER TABLE contato ENABLE TRIGGER contato_auditoria')
  if (tipo === 'nula' || tipo === 'outro_autor') await banco.sql('UPDATE empresa_vinculo SET agenda_contato_id=$2 WHERE empresa_id=$1', [empresa, tipo === 'nula' ? null : novo.id])
  if (tipo === 'indisponivel') await indisponivel('origem_inativa')
  const detalhe = await lerNegociacao(eu, n)
  const passo = tipo === 'propria' ? 'Passo antigo' : tipo === 'outro_autor' ? 'Passo vigente' : null
  expect(detalhe?.proximoPasso).toBe(passo)
  expect(detalhe?.retorno).toBe(tipo === 'propria' ? '2026-01-01' : tipo === 'outro_autor' ? '2026-01-02' : null)
  expect(detalhe?.historico.map(c => c.nota)).toEqual(['História própria'])
  const agenda = await lerAgendaAtendimento(eu)
  expect(agenda.ok && agenda.linhas.find(e => e.id === empresa)?.proximoPasso || null).toBe(passo)
  expect(await lerNegociacao(outro, n)).toBeNull()
})

test('arquivar e retomar não fazem o Funil restaurar próximo passo histórico em novo ciclo', async () => {
  const n = await interessado()
  expect(await arquivarSemInteresse(eu, await comando(), n)).toMatchObject({ ok: true })
  expect(await retomarAtendimento(eu, await comando())).toMatchObject({ ok: true })
  const [novo] = await banco.sql<{ id: string }>('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2) RETURNING id', [empresa, eu])
  expect(await lerNegociacao(eu, novo.id)).toMatchObject({ proximoPasso: null, retorno: null, historico: [expect.objectContaining({ proximoPasso: 'Passo antigo' })] })
  const agenda = await lerAgendaAtendimento(eu)
  expect(agenda.ok && agenda.linhas.some(e => e.id === empresa)).toBe(false)
})
