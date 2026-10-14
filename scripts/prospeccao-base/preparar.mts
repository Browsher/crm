import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { lerFontesMaps } from '../../src/server/prospeccao-base/entrada'
import { prepararSemente } from '../../src/server/prospeccao-base/semente'
import { CABECALHOS_ABAS, desserializarAbas, serializarAbas } from '../../src/lib/prospeccao-base/abas'

async function executar() {
  const args = process.argv.slice(2)
  const opcoes = new Map<string, string>()
  for (let i = 0; i < args.length; i += 2) {
    if (!['--rastreio', '--whatsapp', '--grupo', '--saida'].includes(args[i]) || !args[i + 1] || opcoes.has(args[i])) {
      throw new Error('Uso: preparar --rastreio <json> --whatsapp <json> --grupo <json> --saida <pasta nova>')
    }
    opcoes.set(args[i], args[i + 1])
  }
  if (opcoes.size !== 4) throw new Error('Informe rastreio, whatsapp, grupo e saída')
  const raw = await readFile(resolve(opcoes.get('--rastreio')!))
  const rastreio = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
  const grupo = JSON.parse(await readFile(resolve(opcoes.get('--grupo')!), 'utf8'))
  const consultas = JSON.parse(await readFile(resolve(opcoes.get('--whatsapp')!), 'utf8'))
  const fontes = lerFontesMaps(rastreio.fontesOriginais)
  if (!fontes.ok) throw new Error(fontes.motivo + ': ' + fontes.detalhes.join(', '))
  const sha256 = createHash('sha256').update(JSON.stringify(fontes.fontes)).digest('hex')
  const r = prepararSemente(fontes.fontes, consultas, {
    id: sha256, execucaoId: randomUUID(), fonte: 'Google Maps', regiao: 'Mooca, São Paulo/SP',
    termos: rastreio.termosPesquisados, data: fontes.fontes[0]?.data_coleta ?? new Date().toISOString().slice(0, 10),
    arquivo: basename(rastreio.arquivos?.entrada?.caminho ?? 'empresas_mooca.csv'), sha256,
  })
  if (!r.ok) throw new Error(r.motivo + ': ' + r.detalhes.join(', '))
  const abas = serializarAbas(r.base)
  const volta = desserializarAbas(abas)
  if (!volta.ok) throw new Error('Roundtrip recusado: ' + volta.detalhes.join(', '))
  const resumo = {
    empresas: r.base.empresas.length, telefonesUnicos: r.base.telefones.length,
    empresasSemTelefone: r.base.empresas.filter(e => e.telefoneNormalizado === null).length,
    encontrado: r.base.telefones.filter(t => t.estado === 'encontrado').length,
    nao_encontrado: r.base.telefones.filter(t => t.estado === 'nao_encontrado').length,
    inconclusivo: r.base.telefones.filter(t => t.estado === 'inconclusivo').length,
    pendente: r.base.telefones.filter(t => t.estado === 'pendente').length,
    ocorrencias: r.base.coletas.filter(o => o.tipo === 'ocorrencia').length,
    mensagensEnviadas: 0,
  }
  if (r.base.telefones.some(t => t.estado === 'pendente')) throw new Error('Há números sem correspondência na consulta inicial')
  const saida = resolve(opcoes.get('--saida')!)
  await mkdir(dirname(saida), { recursive: true })
  await mkdir(saida)
  const json = (valor: unknown) => JSON.stringify(valor, null, 2) + '\n'
  await writeFile(resolve(saida, 'base.json'), json(r.base))
  await writeFile(resolve(saida, 'abas.json'), json(abas))
  await writeFile(resolve(saida, 'cabecalhos.json'), json(CABECALHOS_ABAS))
  await writeFile(resolve(saida, 'reconciliacao.json'), json({ ...resumo, sha256, grupo }))
  const colunas = Object.keys(fontes.fontes[0])
  const escapar = (valor: string) => '"' + valor.replace(/"/g, '""') + '"'
  const csv = [colunas, ...fontes.fontes.map(f => colunas.map(c => f[c] ?? ''))]
    .map(l => l.map(escapar).join(',')).join('\n') + '\n'
  await writeFile(resolve(saida, 'coleta-maps-completa.csv'), csv)
  console.log(JSON.stringify(resumo))
}
executar().catch(erro => { console.error(erro instanceof Error ? erro.message : 'Falha na preparação'); process.exitCode = 1 })
