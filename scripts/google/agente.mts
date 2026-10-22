import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { clienteAgente } from '../../src/server/google/cliente'
import { lerComando } from '../../src/server/google/protocolo'

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
    try { await readFile(resolve(pasta, 'publicacao-pendente.json')); throw new Error('Há publicação sem confirmação local. Reconcilie o mesmo arquivo antes de pedir outro lote.') }
    catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    const resposta = await enviar({ acao: 'proximo', executor })
    if (resposta.pedido) {
      const pedido = resposta.pedido as { id: string }
      if (!/^[0-9a-f-]{36}$/i.test(pedido.id)) throw new Error('Pedido inválido recebido.')
      await salvar(pedido.id + '.json', { ...pedido, executor })
    }
    console.log(JSON.stringify(resposta))
  } else if (acao === 'etapa') {
    const r = await lerComando(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ acao, executor, pedido: opcoes.get('pedido'), estado: opcoes.get('estado'), motivo: opcoes.get('motivo') ?? null }) }))
    if (!r.ok) throw new Error('Pedido ou etapa inválidos.')
    console.log(JSON.stringify(await enviar(r.comando)))
  } else if (acao === 'entregar') {
    if (!opcoes.get('publicacao') || !opcoes.get('original') || !opcoes.get('final')) throw new Error('Informe --publicacao, --original e --final.')
    const texto = await readFile(resolve(opcoes.get('publicacao')!), 'utf8')
    const valor = JSON.parse(texto)
    if (valor.executor && valor.executor !== executor) throw new Error('Publicação de outro executor. Preserve a identidade original.')
    const r = await lerComando(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ ...valor, executor }) }))
    if (!r.ok || r.comando.acao !== 'entregar') throw new Error('Publicação inválida.')
    const { comando } = r
    if (hash(await readFile(resolve(opcoes.get('original')!))) !== comando.recibo.origem_sha256
      || hash(await readFile(resolve(opcoes.get('final')!))) !== comando.recibo.final_sha256) throw new Error('Arquivos não conferem com os hashes do recibo.')
    const pendente = { pedido: comando.pedido, executor, publicacao_sha256: hash(Buffer.from(texto)) }
    try {
      const anterior = JSON.parse(await readFile(resolve(pasta, 'publicacao-pendente.json'), 'utf8'))
      if (anterior.pedido !== pendente.pedido || (anterior.executor && anterior.executor !== executor) || anterior.publicacao_sha256 !== pendente.publicacao_sha256) throw new Error('Há outra publicação pendente. Preserve-a e reconcilie antes de continuar.')
    } catch (erro) { if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro }
    await salvar('publicacao-pendente.json', pendente)
    const resposta = await enviar(comando)
    if (!['ok', 'repetida', 'vendedor_inativo'].includes(String(resposta.resultado))) throw new Error('Publicação sem confirmação reconhecida. Preserve o mesmo lote.')
    await salvar(comando.pedido + '-retorno.json', resposta)
    await unlink(resolve(pasta, 'publicacao-pendente.json'))
    console.log(JSON.stringify(resposta))
  } else throw new Error('Use proximo, etapa ou entregar. Consulte docs/operacao/agente-google-crm.md.')
} finally {
  await lock.close()
  await unlink(resolve(pasta, 'execucao.lock'))
}
