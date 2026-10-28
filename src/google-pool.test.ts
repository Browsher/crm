import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, expect, test } from 'vitest'
import { coordenar, CanalArquivos, type ServicosPool } from '../scripts/google/coordenar.mts'
import type { Associacao, ComprovanteDrive, Journal, MotorId, Posicao, SolicitacaoDrive } from '../scripts/google/coordenador-tipos.mts'

const pastas: string[] = []
afterEach(async () => { await Promise.all(pastas.splice(0).map(p => rm(p, { recursive: true, force: true }))) })
const ram = (n: number) => ({ ok: true as const, disponivelMiB: n, instante: new Date().toISOString() })
const vazio = (motor: MotorId): Posicao => ({ motor, associacao: null, etapa: 'retomar', contexto: null, lote: null, coleta: 0, motivo: null })
const vincular = (motor: MotorId): Posicao => ({ ...vazio(motor), contexto: '/fixture/pedido.json', associacao: { contrato: 2, vinculo: { motor, executor: randomUUID(), pedido_id: randomUUID(), execucao_id: randomUUID(), vendedor_id: randomUUID(), revisao: 1, snapshot_sha256: 'a'.repeat(64) } } })
const sinal = () => { let resolver!: () => void; const promessa = new Promise<void>(r => { resolver = r }); return { promessa, resolver } }
function fixture() {
  let journal: Journal | null = null, claims = 0, liberado = false
  const chamados = new Set<MotorId>()
  const deps: ServicosPool = {
    excluir: async () => ({ liberar: async () => { liberado = true } }),
    dono: async () => ({ pid: 1, inicio: 'fixture' }),
    ler: async () => journal, salvar: async j => { journal = structuredClone(j) },
    medir: async () => ram(7000), conferir: async () => true,
    proximo: async m => { claims++; if (chamados.has(m)) return null; chamados.add(m); return vincular(m) },
    executar: async p => ({ ...p, etapa: 'concluido' }),
    evento: () => {}, intervaloMs: 0,
  }
  return { deps, get claims() { return claims }, get liberado() { return liberado }, get journal() { return journal }, set journal(j: Journal | null) { journal = j } }
}
test('tres coletas entram antes de liberar a primeira', async () => {
  const f = fixture(), tres = sinal(), soltar = sinal()
  let entradas = 0, ativas = 0, maximo = 0
  f.deps.executar = async (p, gate, persistir) => {
    expect(await gate({ ...p, coleta: 1 })).toBe(true)
    entradas++; ativas++; maximo = Math.max(maximo, ativas)
    if (entradas === 3) tres.resolver()
    await soltar.promessa
    ativas--
    const final: Posicao = { ...p, etapa: p.motor === '02' ? 'pendente' : 'concluido', motivo: p.motor === '02' ? 'verificar_pendente' : null }
    await persistir(final)
    return final
  }
  const run = coordenar('rodar', f.deps)
  await tres.promessa
  expect(entradas).toBe(3)
  expect(maximo).toBe(3)
  expect(f.liberado).toBe(false)
  soltar.resolver()
  const resultado = await run
  expect(resultado.posicoes.filter(p => p.etapa === 'concluido')).toHaveLength(2)
  expect(resultado.posicoes.filter(p => p.etapa === 'pendente')).toHaveLength(1)
  expect(f.claims).toBe(5)
  expect(f.liberado).toBe(true)
})
test('5631 MiB impede reivindicar e executar qualquer pedido', async () => {
  const f = fixture()
  f.deps.medir = async () => ram(5631)
  const j = await coordenar('rodar', f.deps)
  expect(f.claims).toBe(0)
  expect(j.admissaoSuspensa).toBe(true)
})
test('queda critica preserva iniciados e impede rodada seguinte', async () => {
  const f = fixture(), iniciados = sinal()
  let entradas = 0, medicao = 7000
  f.deps.medir = async () => ram(medicao)
  f.deps.executar = async (p, gate) => {
    expect(await gate({ ...p, coleta: 1 })).toBe(true)
    if (++entradas === 3) { medicao = 511; iniciados.resolver() }
    await iniciados.promessa
    expect(await gate({ ...p, coleta: 2 })).toBe(false)
    return { ...p, coleta: 1, etapa: 'pendente', motivo: 'coletar_pendente' }
  }
  const j = await coordenar('rodar', f.deps)
  expect(j.admissaoSuspensa).toBe(true)
  expect(j.posicoes.every(p => p.coleta === 1 && p.associacao)).toBe(true)
})
test('retoma pendencia antes de reivindicar e nao reinicia identidade', async () => {
  const f = fixture(), p = { ...vincular('01'), etapa: 'pendente' as const, coleta: 1 }
  f.journal = { versao: 1, ciclo_id: randomUUID(), dono: { pid: 8, inicio: 'old' }, posicoes: [p, vazio('02'), vazio('03')], admissaoSuspensa: true }
  f.deps.medir = async () => ram(1000)
  f.deps.executar = async atual => { expect(atual.associacao).toEqual(p.associacao); expect(f.claims).toBe(0); return { ...atual, etapa: 'pendente' } }
  const j = await coordenar('retomar', f.deps)
  expect(j.ciclo_id).toBe(f.journal!.ciclo_id)
  expect(f.claims).toBe(0)
  await expect(coordenar('rodar', f.deps)).rejects.toThrow()
})
test('V1 vincula somente 01 e nao pede outras posicoes', async () => {
  const f = fixture()
  f.deps.proximo = async motor => { expect(motor).toBe('01'); return { ...vincular('01'), associacao: { contrato: 1, vinculo: { motor: '01', executor: randomUUID(), pedido_id: randomUUID(), vendedor_id: randomUUID() } } } }
  f.deps.executar = async p => ({ ...p, etapa: 'pendente', motivo: 'legado_pendente' })
  const j = await coordenar('rodar', f.deps)
  expect(j.posicoes.filter(p => p.associacao)).toHaveLength(1)
})
const solicitacao = (): SolicitacaoDrive => ({ associacao: vincular('01').associacao as Associacao, solicitacao_id: randomUUID(), lote_id: randomUUID(), pastaPai: '11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh', pastaNome: 'fixture', arquivos: [{ tipo: 'original', caminho: '/fixture.csv', nome: 'original.csv', bytes: 1, sha256: 'a'.repeat(64) }] })
const prova = (s: SolicitacaoDrive): ComprovanteDrive => ({ associacao: s.associacao, solicitacao_id: s.solicitacao_id, lote_id: s.lote_id, pasta_id: 'folder_fixture', arquivos: s.arquivos.map(a => ({ tipo: a.tipo, nome: a.nome, id: 'file_fixture', pasta_id: 'folder_fixture', bytes: a.bytes, sha256: a.sha256, downloadConferido: true })) })
test('Drive fora de ordem nao libera outra solicitacao e conserva intencao', async () => {
  const pasta = await mkdtemp(resolve(tmpdir(), 'pool-drive-')); pastas.push(pasta)
  const eventos: string[] = []
  const canal = new CanalArquivos(pasta, e => { eventos.push(e.solicitacao) })
  const a = solicitacao(), b = solicitacao()
  let aResolvida = false
  const pa = canal.arquivar(a).then(r => { aResolvida = true; return r })
  const pb = canal.arquivar(b)
  await canal.pronto()
  expect(eventos).toHaveLength(2)
  expect(await Promise.all(eventos.map(async caminho => JSON.parse(await readFile(caminho, 'utf8'))))).toEqual(expect.arrayContaining([a, b]))
  const caminho = resolve(pasta, 'prova.json')
  await writeFile(caminho, JSON.stringify(prova(b)))
  await expect(canal.confirmar({ acao: 'confirmar_arquivo', solicitacao_id: a.solicitacao_id, comprovante: caminho })).rejects.toThrow()
  expect(aResolvida).toBe(false)
  await canal.confirmar({ acao: 'confirmar_arquivo', solicitacao_id: b.solicitacao_id, comprovante: caminho })
  expect((await pb).solicitacao_id).toBe(b.solicitacao_id)
  await expect(canal.confirmar({ acao: 'confirmar_arquivo', solicitacao_id: b.solicitacao_id, comprovante: caminho })).rejects.toThrow()
  await writeFile(caminho, JSON.stringify(prova(a)))
  await canal.confirmar({ acao: 'confirmar_arquivo', solicitacao_id: a.solicitacao_id, comprovante: caminho })
  await pa
  const reiniciado = new CanalArquivos(pasta, () => { throw new Error('Nao repetir upload') })
  expect(await reiniciado.arquivar(a)).toEqual(prova(a))
})

test('canal encerrado recusa novas esperas sem perder a intenção', async () => {
  const pasta = await mkdtemp(resolve(tmpdir(), 'pool-close-')); pastas.push(pasta)
  const canal = new CanalArquivos(pasta, () => {})
  canal.interromper()
  const resultado = await Promise.race([canal.arquivar(solicitacao()).then(() => 'aceito', () => 'recusado'), new Promise<string>(r => setTimeout(() => r('esperando'), 50))])
  expect(resultado).toBe('recusado')
})
test('retomada sem job precisa conferir infraestrutura antes da nova coleta', async () => {
  const f = fixture(), p = vincular('01')
  f.journal = { versao: 1, ciclo_id: randomUUID(), dono: { pid: 8, inicio: 'old' }, posicoes: [p, vazio('02'), vazio('03')], admissaoSuspensa: false }
  f.deps.conferir = async () => false
  let admitido: boolean | undefined
  f.deps.executar = async (p, gate) => {
    admitido = await gate({ ...p, coleta: 1 })
    return { ...p, etapa: 'pendente' }
  }
  const j = await coordenar('retomar', f.deps)
  expect(admitido).toBe(false)
  expect(j.admissaoSuspensa).toBe(true)
})


test('posicao atrasada no Drive nao herda permissao para onda futura com pouca RAM', async () => {
  const f = fixture(), liberarDrive = sinal()
  let memoria = 7000, atrasoAdmitido: boolean | undefined
  f.deps.medir = async () => ram(memoria)
  f.deps.proximo = async m => m === '03' ? null : (f.journal?.posicoes.some(p => p.motor === m && p.associacao) ? null : { ...vincular(m), coleta: 1, etapa: m === '02' ? 'arquivar' : 'retomar' })
  f.deps.executar = async (p, gate) => {
    if (p.motor === '02') {
      await liberarDrive.promessa
      atrasoAdmitido = await gate({ ...p, coleta: 2 })
      return { ...p, etapa: 'pendente' }
    }
    await gate({ ...p, coleta: 2 })
    memoria = 1000
    liberarDrive.resolver()
    return { ...p, etapa: 'concluido' }
  }
  await coordenar('rodar', f.deps)
  expect(atrasoAdmitido).toBe(false)
})
