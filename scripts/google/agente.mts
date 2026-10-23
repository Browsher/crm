import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { clienteAgente } from '../../src/server/google/cliente'
import { lerComando } from '../../src/server/google/protocolo'
import { executarVerificacoes, conferirRetornoVerificacoes, configuracaoVerificacoes } from '../../src/server/google/verificacoes/cliente'
import { normalizarCriterios, verificacoesNecessarias } from '../../src/lib/google/criterios'

const [acao, ...argumentos] = process.argv.slice(2)
const opcoes = new Map<string, string>()
for (let i = 0; i < argumentos.length; i += 2) {
  if (!argumentos[i].startsWith('--') || !argumentos[i + 1]) throw new Error('Informe opções com valor explícito.')
  opcoes.set(argumentos[i].slice(2), argumentos[i + 1])
}
const pasta = resolve(opcoes.get('pasta') || '.google-agente')
await mkdir(pasta, { recursive: true })
const lock = await open(resolve(pasta, 'execucao.lock'), 'wx').catch(() => { throw new Error('Outra chamada está em andamento. Confira o processo antes de remover o lock.') })
const salvar = async (nome: string, valor: unknown) => {
  const arquivo = resolve(pasta, nome)
  await writeFile(arquivo + '.tmp', JSON.stringify(valor, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(arquivo + '.tmp', arquivo)
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
try {
  const url = process.env.GOOGLE_CRM_URL
  const token = process.env.GOOGLE_AGENTE_TOKEN
  if (!url || !token) throw new Error('Configure GOOGLE_CRM_URL e GOOGLE_AGENTE_TOKEN no ambiente privado.')
  const enviar = clienteAgente({ url, token })
  let executor: string
  try { executor = JSON.parse(await readFile(resolve(pasta, 'executor.json'), 'utf8')).id }
  catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro
    executor = randomUUID()
    await salvar('executor.json', { id: executor })
  }
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(executor)) throw new Error('Identidade do executor inválida. Preserve a pasta para reconciliação.')
  if (acao === 'proximo') {
    for (const nome of ['publicacao-pendente.json', 'operacao-pendente.json', 'verificacao-pendente.json']) {
      try { await readFile(resolve(pasta, nome)); throw new Error('Há operação sem confirmação local. Reconcilie o mesmo arquivo antes de pedir outro lote.') }
      catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    }
    const resposta = await enviar({ acao: 'proximo', executor })
    if (resposta.pedido) {
      const pedido = resposta.pedido as { id: string }
      if (!/^[0-9a-f-]{36}$/i.test(pedido.id)) throw new Error('Pedido inválido recebido.')
      await salvar(pedido.id + '.json', { ...pedido, executor })
    }
    console.log(JSON.stringify(resposta))
  } else if (acao === 'verificar') {
    const verificar = async () => {
      for (const nome of ['publicacao-pendente.json', 'operacao-pendente.json']) {
        try { await readFile(resolve(pasta,nome)); throw new Error('Reconcilie a operação pendente antes de verificar.') }
        catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
      }
      if (!opcoes.get('contexto') || !opcoes.get('lote') || !opcoes.get('saida')) throw new Error('Informe --contexto, --lote e --saida.')
      const pedido = JSON.parse(await readFile(resolve(opcoes.get('contexto')!), 'utf8'))
      const lote = JSON.parse(await readFile(resolve(opcoes.get('lote')!), 'utf8'))
      const criterios = normalizarCriterios(pedido.snapshot?.criterios ?? pedido.criterios)
      if (!criterios.ok || ![pedido.id,pedido.execucao_id,lote.lote_id].every(id => typeof id === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
        || !Number.isSafeInteger(pedido.revisao) || pedido.revisao < 1 || !/^[0-9a-f]{64}$/.test(pedido.snapshot_sha256) || !Array.isArray(lote.candidatas) || lote.candidatas.length < 1 || lote.candidatas.length > 50) throw new Error('Contexto ou lote inválidos.')
      const contexto = { pedido_id: pedido.id, execucao_id: pedido.execucao_id, lote_id: lote.lote_id, revisao: pedido.revisao, snapshot_sha256: pedido.snapshot_sha256, criterios: criterios.valor }
      const assinatura = hash(Buffer.from(JSON.stringify({contexto,candidatas:lote.candidatas})))
      let pendente: {assinatura:string}|null = null
      try { pendente = JSON.parse(await readFile(resolve(pasta,'verificacao-pendente.json'),'utf8')) }
      catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
      if (pendente && pendente.assinatura !== assinatura) throw new Error('Há verificação de outro lote pendente. Preserve os arquivos.')
      const limpar = async () => { try { await unlink(resolve(pasta,'verificacao-pendente.json')) } catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro } }
      const saida = resolve(opcoes.get('saida')!)
      try {
        const anterior = JSON.parse(await readFile(saida,'utf8'))
        if (anterior.assinatura !== assinatura) throw new Error('Arquivo de verificação existente diverge. Preserve-o.')
        conferirRetornoVerificacoes(contexto,lote.candidatas,anterior)
        await limpar()
        console.log(saida)
        return
      } catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
      let verificado
      if (opcoes.get('reconciliar')) {
        if (!pendente) throw new Error('Não há verificação pendente para reconciliar.')
        verificado = conferirRetornoVerificacoes(contexto,lote.candidatas,JSON.parse(await readFile(resolve(opcoes.get('reconciliar')!),'utf8')))
      } else {
        if (pendente) throw new Error('Reconcilie a verificação pendente com --reconciliar. Nenhum novo POST foi enviado.')
        if (verificacoesNecessarias(criterios.valor).length) {
          configuracaoVerificacoes()
          await salvar('verificacao-pendente.json',{assinatura,contexto,lote_id:lote.lote_id})
        }
        verificado = await executarVerificacoes(contexto,lote.candidatas)
      }
      await writeFile(saida+'.tmp',JSON.stringify({...contexto,...verificado,assinatura},null,2),{encoding:'utf8',mode:0o600})
      await rename(saida+'.tmp',saida)
      await limpar()
      console.log(saida)
    }
    await verificar()
  } else if (acao === 'reservar_lote' || acao === 'concluir') {
    try { await readFile(resolve(pasta, 'verificacao-pendente.json')); throw new Error('Reconcilie a verificação pendente antes de continuar.') }
    catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    try { await readFile(resolve(pasta, 'publicacao-pendente.json')); throw new Error('Reconcilie a publicação pendente antes de continuar.') }
    catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    const entrada = acao === 'reservar_lote'
      ? { acao, executor, pedido: opcoes.get('pedido'), lote: JSON.parse(await readFile(resolve(opcoes.get('lote') || ''), 'utf8')) }
      : { acao, executor, pedido: opcoes.get('pedido'), motivo: opcoes.get('motivo') }
    const r = await lerComando(new Request('http://localhost', { method: 'POST', body: JSON.stringify(entrada) }))
    if (!r.ok || (r.comando.acao !== 'reservar_lote' && r.comando.acao !== 'concluir')) throw new Error('Reserva ou conclusão inválida.')
    const assinatura = hash(Buffer.from(JSON.stringify(r.comando)))
    try {
      const anterior = JSON.parse(await readFile(resolve(pasta, 'operacao-pendente.json'), 'utf8'))
      if (anterior.assinatura !== assinatura) throw new Error('Há outra operação pendente. Reconcilie o mesmo comando.')
    } catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    await salvar('operacao-pendente.json', { assinatura, comando: r.comando })
    const resposta = await enviar(r.comando)
    if (r.comando.acao === 'reservar_lote') {
      const lote = resposta.lote as { id?: string } | undefined
      if (!lote || typeof lote.id !== 'string' || lote.id !== r.comando.lote.lote_id) throw new Error('Reserva não confirmada. Preserve o mesmo lote.')
      await salvar(r.comando.pedido + '-' + lote.id + '-reserva.json', resposta)
    } else {
      const resultado = resposta.resultado as { motivo_parada?: string } | undefined
      if (resultado?.motivo_parada !== r.comando.motivo) throw new Error('Conclusão não confirmada. Preserve o mesmo pedido.')
      await salvar(r.comando.pedido + '-conclusao.json', resposta)
    }
    await unlink(resolve(pasta, 'operacao-pendente.json'))
    console.log(JSON.stringify(resposta))
  } else if (acao === 'etapa') {
    const r = await lerComando(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ acao, executor, pedido: opcoes.get('pedido'), estado: opcoes.get('estado'), motivo: opcoes.get('motivo') ?? null }) }))
    if (!r.ok) throw new Error('Pedido ou etapa inválidos.')
    console.log(JSON.stringify(await enviar(r.comando)))
  } else if (acao === 'entregar') {
    try { await readFile(resolve(pasta, 'verificacao-pendente.json')); throw new Error('Reconcilie a verificação pendente antes de entregar.') }
    catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    try { await readFile(resolve(pasta, 'operacao-pendente.json')); throw new Error('Reconcilie a reserva pendente antes de entregar.') }
    catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    const resultado = opcoes.get('resultado') || opcoes.get('final')
    if (!opcoes.get('publicacao') || !opcoes.get('original') || !resultado) throw new Error('Informe --publicacao, --original e --resultado (ou --final no legado).')
    const texto = await readFile(resolve(opcoes.get('publicacao')!), 'utf8')
    const valor = JSON.parse(texto)
    if (valor.executor && valor.executor !== executor) throw new Error('Publicação de outro executor. Preserve a identidade original.')
    const r = await lerComando(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ ...valor, executor }) }))
    if (!r.ok || r.comando.acao !== 'entregar') throw new Error('Publicação inválida.')
    const { comando } = r
    if (hash(await readFile(resolve(opcoes.get('original')!))) !== comando.recibo.origem_sha256
      || hash(await readFile(resolve(resultado))) !== (comando.recibo.versao === 2 ? comando.recibo.resultado_sha256 : comando.recibo.final_sha256)) throw new Error('Arquivos não conferem com os hashes do recibo.')
    const pendente = { pedido: comando.pedido, executor, publicacao_sha256: hash(Buffer.from(texto)) }
    try {
      const anterior = JSON.parse(await readFile(resolve(pasta, 'publicacao-pendente.json'), 'utf8'))
      if (anterior.pedido !== pendente.pedido || (anterior.executor && anterior.executor !== executor) || anterior.publicacao_sha256 !== pendente.publicacao_sha256) throw new Error('Há outra publicação pendente. Preserve-a e reconcilie antes de continuar.')
    } catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    await salvar('publicacao-pendente.json', pendente)
    const resposta = await enviar(comando)
    if (!['ok', 'repetida', 'vendedor_inativo'].includes(String(resposta.resultado))) throw new Error('Publicação sem confirmação reconhecida. Preserve o mesmo lote.')
    await salvar(comando.pedido + '-retorno.json', resposta)
    if (comando.recibo.versao === 2) await salvar(comando.pedido + '-' + comando.recibo.lote_id + '-retorno.json', resposta)
    await unlink(resolve(pasta, 'publicacao-pendente.json'))
    console.log(JSON.stringify(resposta))
  } else throw new Error('Use proximo, etapa, reservar_lote, verificar, entregar ou concluir. Consulte docs/operacao/agente-google-crm.md.')
} finally {
  await lock.close()
  await unlink(resolve(pasta, 'execucao.lock'))
}
