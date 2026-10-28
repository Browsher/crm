import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import { isDeepStrictEqual } from 'node:util'
import { conferirComprovante, conferirSolicitacao, lerJson, salvarImutavel } from './arquivos.mts'
import { admitirOnda, aplicarMedicao, confinarCaminho, inspecionarProcesso, lerJournal, medirRam, obterExclusao, salvarJournal } from './coordenador-estado.mts'
import { executarPedido } from './fluxo.mts'
import { carregarMotores } from './motores.mts'
import type { ComprovanteDrive, Journal, MedicaoRam, MotorId, Posicao, SolicitacaoDrive } from './coordenador-tipos.mts'

type Evento = { evento: string; [k: string]: unknown }
type Gate = (p: Posicao) => Promise<boolean>
type Persistir = (p: Posicao) => Promise<void>
export type ServicosPool = {
  excluir(): Promise<{ liberar(): Promise<void> }>
  dono(): Promise<Journal['dono']>
  ler(): Promise<Journal | null>
  salvar(j: Journal): Promise<void>
  medir(): Promise<MedicaoRam>
  conferir(): Promise<boolean>
  proximo(m: MotorId): Promise<Posicao | null>
  executar(p: Posicao, admitir: Gate, persistir: Persistir): Promise<Posicao>
  evento(e: Evento): void
  aguardarColetas?(): Promise<void>
  intervaloMs?: number
}
const ids: MotorId[] = ['01', '02', '03']
const vazia = (motor: MotorId): Posicao => ({ motor, associacao: null, etapa: 'retomar', contexto: null, lote: null, coleta: 0, motivo: null })
const pendente = (p: Posicao) => !!p.associacao && p.etapa !== 'concluido'
const identidade = (p: Posicao) => p.associacao?.contrato === 2 ? p.associacao.vinculo.execucao_id : p.associacao?.vinculo.pedido_id
const falha = () => new Error('Coordenador ou confirmação divergente. Preserve journal e intenções.')
export async function coordenar(acao: 'rodar' | 'retomar', d: ServicosPool): Promise<Journal> {
  const lock = await d.excluir()
  let timer: ReturnType<typeof setInterval> | undefined
  let monitor: Promise<unknown> = Promise.resolve()
  try {
    const anterior = await d.ler()
    if (acao === 'rodar' && anterior?.posicoes.some(pendente)) throw falha()
    const j: Journal = acao === 'retomar' && anterior ? { ...anterior, dono: await d.dono(), admissaoSuspensa: false } :
      { versao: 1, ciclo_id: randomUUID(), dono: await d.dono(), posicoes: ids.map(vazia), admissaoSuspensa: false }
    let fila = Promise.resolve()
    const mudancas = new Set<() => void>()
    const avisarMudanca = () => { for (const r of mudancas) r(); mudancas.clear() }
    const esperarMudanca = () => new Promise<void>(r => { mudancas.add(r) })
    const salvar = () => { const copia = structuredClone(j); fila = fila.then(() => d.salvar(copia)); return fila }
    const persistir: Persistir = async p => { j.posicoes[ids.indexOf(p.motor)] = structuredClone(p); avisarMudanca(); await salvar() }
    const avisar = (motivo: string) => d.evento({ evento: 'bloqueio', motivo })
    const medir = async () => {
      const m = await d.medir()
      const novo = aplicarMedicao(j, m)
      if (novo.admissaoSuspensa && !j.admissaoSuspensa) avisar(m.ok ? 'ram_critica' : 'medicao_indisponivel')
      j.admissaoSuspensa = novo.admissaoSuspensa
      await salvar()
      return m
    }
    await salvar()
    if ((d.intervaloMs ?? 5000) > 0) {
      let medindo = false
      timer = setInterval(() => {
        if (medindo) return
        medindo = true
        monitor = medir().catch(() => { j.admissaoSuspensa = true; avisar('journal_pendente') }).finally(() => { medindo = false })
      }, d.intervaloMs ?? 5000)
    }
    const grants = new Set<string>()
    const prontas = new Map<string, Posicao>()
    let admissao = Promise.resolve()
    const chave = (p: Posicao, coleta = p.coleta) => identidade(p) + ':' + coleta
    const admitir: Gate = p => {
      prontas.set(chave(p), p)
      j.posicoes[ids.indexOf(p.motor)] = { ...p, etapa: 'coletar' }
      avisarMudanca()
      const executar = async () => {
        if (j.admissaoSuspensa) return false
        if (grants.has(chave(p))) { grants.delete(chave(p)); prontas.delete(chave(p)); return true }
        // Initial pipelines reach the first collection barrier before a wave is admitted.
        while (j.posicoes.some(outro => pendente(outro) && outro.coleta === 0 && outro.etapa === 'retomar')) await esperarMudanca()
        await d.aguardarColetas?.()
        if (j.admissaoSuspensa) return false
        const m = await medir()
        const r = admitirOnda(m)
        if (r.ok && !await d.conferir()) { j.admissaoSuspensa = true; avisar('motores_indisponiveis'); await salvar(); return false }
        if (!r.ok) { j.admissaoSuspensa = true; avisar(r.motivo); await salvar(); return false }
        // Only actual waiting requests belong to this wave, never a future collection in Drive/verification.
        for (const k of prontas.keys()) grants.add(k)
        grants.delete(chave(p))
        prontas.delete(chave(p))
        return true
      }
      const resposta = admissao.then(executar)
      admissao = resposta.then(() => {}, () => {})
      return resposta
    }
    const tentadas = new Set<string>()
    let retomarPrimeiro = j.posicoes.some(pendente)
    for (let volta = 0; volta < 100; volta++) {
      if (!retomarPrimeiro && !j.admissaoSuspensa) {
        const r = admitirOnda(await medir())
        if (!r.ok) { j.admissaoSuspensa = true; avisar(r.motivo); await salvar() }
        else if (!await d.conferir()) { j.admissaoSuspensa = true; avisar('motores_indisponiveis'); await salvar() }
        else {
          for (const m of ids) {
            if (j.posicoes.some(p => pendente(p) && p.associacao?.contrato === 1)) break
            const atual = j.posicoes[ids.indexOf(m)]
            if (pendente(atual)) continue
            const novo = await d.proximo(m)
            if (!novo) { if (m === '01' && !j.posicoes.some(pendente)) break; continue }
            if (novo.motor !== m || !novo.associacao || !novo.contexto) throw falha()
            if (novo.associacao.contrato === 1 && m !== '01') throw falha()
            if (j.posicoes.some(p => pendente(p) && p.associacao?.vinculo.vendedor_id === novo.associacao!.vinculo.vendedor_id)) throw falha()
            await persistir(novo)
          }
        }
      }
      retomarPrimeiro = false
      const executar = j.posicoes.filter(p => pendente(p) && !tentadas.has(identidade(p)!))
      if (!executar.length) break
      for (const p of executar) tentadas.add(identidade(p)!)
      await Promise.allSettled(executar.map(async p => {
        let final: Posicao
        try { final = await d.executar(structuredClone(p), admitir, persistir) }
        catch { final = { ...j.posicoes[ids.indexOf(p.motor)], etapa: 'pendente', motivo: 'fluxo_pendente' } }
        await persistir(final)
        d.evento({ evento: 'resultado', posicao: final })
      }))
      // Never start another contract while a legacy execution is waiting for its runbook.
      if (j.posicoes.some(p => pendente(p) && p.associacao?.contrato === 1)) break
    }
    await fila
    return structuredClone(j)
  } finally {
    if (timer) clearInterval(timer)
    await monitor
    await lock.liberar()
  }
}

type EventoArquivo = { evento: 'arquivar'; solicitacao: string }
type Espera = { s: SolicitacaoDrive; aceitar: (p: ComprovanteDrive) => void; recusar: (e: Error) => void }
export class CanalArquivos {
  private fechado = false
  private esperas = new Map<string, Espera>()
  private inicializacoes: Promise<void>[] = []
  constructor(private pasta: string, private emitir: (e: EventoArquivo) => void) {}
  arquivar(s: SolicitacaoDrive): Promise<ComprovanteDrive> {
    if (this.fechado) return Promise.reject(new Error('Canal encerrado. Preserve a intenção.'))
    let aceitar!: Espera['aceitar'], recusar!: Espera['recusar']
    const resposta = new Promise<ComprovanteDrive>((a, r) => { aceitar = a; recusar = r })
    const preparar = async () => {
      conferirSolicitacao(s)
      const dir = resolve(this.pasta, 'drive', s.solicitacao_id)
      await mkdir(this.pasta, { recursive: true })
      await confinarCaminho(this.pasta, dir)
      const pedido = resolve(dir, 'solicitacao.json'), comprovante = resolve(dir, 'comprovante.json')
      await salvarImutavel(pedido, JSON.stringify(s, null, 2))
      try { aceitar(conferirComprovante(s, await lerJson(comprovante))); return }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
      if (this.esperas.has(s.solicitacao_id)) throw falha()
      if (this.fechado) throw falha()
      this.esperas.set(s.solicitacao_id, { s, aceitar, recusar })
      this.emitir({ evento: 'arquivar', solicitacao: pedido })
    }
    this.inicializacoes.push(preparar().catch(e => { recusar(e) }))
    return resposta
  }
  async pronto() { await Promise.all(this.inicializacoes) }
  async confirmar(v: unknown) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw falha()
    const x = v as Record<string, unknown>
    if (Object.keys(x).sort().join(',') !== 'acao,comprovante,solicitacao_id' || x.acao !== 'confirmar_arquivo' || typeof x.solicitacao_id !== 'string' || typeof x.comprovante !== 'string') throw falha()
    const espera = this.esperas.get(x.solicitacao_id)
    if (!espera) throw falha()
    // A confirmation must be a local file under the coordinator's private state.
    await confinarCaminho(this.pasta, resolve(x.comprovante))
    const p = conferirComprovante(espera.s, await lerJson(x.comprovante))
    await salvarImutavel(resolve(this.pasta, 'drive', x.solicitacao_id, 'comprovante.json'), JSON.stringify(p, null, 2))
    this.esperas.delete(x.solicitacao_id)
    espera.aceitar(p)
  }
  interromper() {
    this.fechado = true
    for (const e of this.esperas.values()) e.recusar(falha())
    this.esperas.clear()
  }
}
const nativo = promisify(execFile)
async function main() {
  const [acao, ...args] = process.argv.slice(2)
  if (!['rodar', 'retomar'].includes(acao) || args.length % 2) throw falha()
  const opts = new Map<string, string>()
  for (let i = 0; i < args.length; i += 2) { if (!['--campanha', '--pasta'].includes(args[i]) || opts.has(args[i])) throw falha(); opts.set(args[i], args[i + 1]) }
  const campanha = resolve(opts.get('--campanha') ?? process.env.GOOGLE_SCRAPER_CAMPANHA ?? '')
  if (!opts.get('--campanha') && !process.env.GOOGLE_SCRAPER_CAMPANHA) throw falha()
  if (!(await stat(campanha)).isDirectory()) throw falha()
  const pasta = resolve(opts.get('--pasta') ?? '.google-agente')
  await carregarMotores()
  const pastaMotor = (m: MotorId) => m === '01' ? pasta : resolve(pasta, 'slots', m)
  const emitir = (e: Evento) => process.stdout.write(JSON.stringify(e) + '\n')
  const canal = new CanalArquivos(resolve(pasta, 'coordenador'), emitir)
  const entrada = createInterface({ input: process.stdin, crlfDelay: Infinity })
  let encerrado = false, journalAtual: Journal | null = null, coletas = 0
  const conhecidos = new Map<MotorId, string>()
  const gravacoes: Promise<void>[] = []
  const livres = new Set<() => void>()
  entrada.on('line', linha => {
    try { void canal.confirmar(JSON.parse(linha)).catch(() => emitir({ evento: 'confirmacao_recusada' })) }
    catch { emitir({ evento: 'confirmacao_recusada' }) }
  })
  entrada.on('close', () => { encerrado = true; if (journalAtual) journalAtual.admissaoSuspensa = true; canal.interromper() })
  const comando = async (programa: 'node' | 'python', args: readonly string[]) => {
    const coletando = programa === 'python' && args.some(a => a.endsWith('/coletar.py')) && args.includes('coletar')
    if (coletando) coletas++
    try { return (await nativo(programa === 'node' ? process.execPath : 'python', [...args], { windowsHide: true, maxBuffer: 32 * 1024 * 1024, env: process.env })).stdout }
    catch { throw new Error('Subprocesso pendente. Preserve os arquivos e consulte o diagnóstico da etapa.') }
    finally { if (coletando && --coletas === 0) { for (const f of livres) f(); livres.clear() } }
  }
  try {
    const j = await coordenar(acao as 'rodar' | 'retomar', {
      excluir: () => obterExclusao(pasta),
      dono: async () => { const p = await inspecionarProcesso(process.pid); if (!p.ok || !p.processo) throw falha(); return p.processo },
      ler: async () => { const j = await lerJournal(pasta); for (const p of j?.posicoes ?? []) if (p.associacao) conhecidos.set(p.motor, p.associacao.vinculo.executor); return j }, salvar: async j => { journalAtual = j; await salvarJournal(pasta, j) },
      medir: async () => encerrado ? { ok: false, motivo: 'medicao_indisponivel' } : medirRam(),
      conferir: async () => {
        try { const r = await nativo('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', 'scripts/google/motores.ps1', '-Acao', 'Conferir'], { windowsHide: true }); return JSON.parse(r.stdout).ok === true } catch { return false }
      },
      evento: e => {
        emitir(e)
        if (e.evento === 'resultado') {
          const p = e.posicao as Posicao
          const id = identidade(p)
          if (id) gravacoes.push(salvarImutavel(resolve(pasta, 'coordenador', 'resultados', id + '-' + randomUUID() + '.json'), JSON.stringify(p, null, 2)))
        }
      },
      aguardarColetas: () => coletas ? new Promise<void>(r => { livres.add(r) }) : Promise.resolve(),
      proximo: async m => {
        if (encerrado) return null
        const dir = pastaMotor(m)
        await mkdir(dir, { recursive: true })
        if (conhecidos.has(m) && (await lerJson(resolve(dir, 'executor.json'))).id !== conhecidos.get(m)) throw falha()
        const r = JSON.parse(await comando('node', ['--import', 'tsx', 'scripts/google/agente.mts', 'proximo', '--pasta', dir]))
        if (!r.pedido) { if (r.sincronizar || r.ocupado) emitir({ evento: 'aguardar', motor: m, motivo: r.sincronizar ? 'sincronizacao' : 'ocupado' }); return null }
        const p = r.pedido
        const executor = (await lerJson(resolve(dir, 'executor.json'))).id as string
        const contrato = p.contrato === 2 ? 2 : 1
        const comuns = { motor: m, executor, pedido_id: p.id, vendedor_id: p.vendedor_id }
        const associacao: Posicao['associacao'] = contrato === 2 ? { contrato: 2, vinculo: { ...comuns, execucao_id: p.execucao_id, revisao: p.revisao, snapshot_sha256: p.snapshot_sha256 } } :
          { contrato: 1, vinculo: { ...comuns, motor: '01' } }
        if (contrato === 1 && m !== '01') throw falha()
        const contexto = resolve(dir, 'pedidos', p.id, contrato === 2 ? p.execucao_id : 'legado', 'pedido.json')
        await confinarCaminho(pasta, contexto)
        const conteudo = { ...p, executor, motor: m, estado: 'coletando' }
        try {
          const antigo = await lerJson(contexto)
          const campos = ['id', 'vendedor_id', 'execucao_id', 'revisao', 'snapshot_sha256', 'nicho', 'bairro', 'cidade', 'uf', 'snapshot', 'motor', 'executor']
          if (campos.some(k => !isDeepStrictEqual(antigo[k], conteudo[k]))) throw falha()
        } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; await salvarImutavel(contexto, JSON.stringify(conteudo, null, 2)) }
        return { ...vazia(m), contexto, associacao }
      },
      executar: (p, admitirColeta, persistir) => executarPedido(p, { campanha, pastaEstado: pastaMotor(p.motor), comando, admitirColeta, persistir, arquivar: s => canal.arquivar(s) }),
    })
    await Promise.all(gravacoes)
    emitir({ evento: 'fim', pendentes: j.posicoes.filter(pendente).map(p => ({ motor: p.motor, pedido: p.associacao!.vinculo.pedido_id, motivo: p.motivo })), admissaoSuspensa: j.admissaoSuspensa })
  } finally { entrada.close(); canal.interromper() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Coordenador não confirmado. Preserve journal, identidades e intenções.'); process.exitCode = 1 })
}
