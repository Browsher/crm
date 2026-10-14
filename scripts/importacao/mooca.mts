import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { lerCsv } from '../../src/features/empresas/csv'
import { analisarPlanilha } from '../../src/features/empresas/planilha'
import { validarMetadadosGrupo } from '../../src/lib/grupo-metadados'
import { adaptarMooca, type FonteMooca } from '../../src/server/importacao/mooca-adaptador'

const REQUERIDAS: (keyof FonteMooca)[] = ['nome_empresa', 'cnpj', 'razao_social', 'telefone', 'email', 'cep', 'place_id', 'termo_pesquisado', 'fontes_email', 'fontes_conferencia', 'observacoes']
const termos = [
  'loja de câmeras de segurança Mooca São Paulo SP',
  'distribuidora CFTV Mooca São Paulo SP',
  'distribuidora segurança eletrônica Mooca São Paulo SP',
  'loja de informática Mooca São Paulo SP',
  'loja de eletrônicos Mooca São Paulo SP',
  'automação residencial Mooca São Paulo SP',
  'instalador CFTV Mooca São Paulo SP',
  'segurança eletrônica Mooca São Paulo SP',
]
const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n'

async function preparar() {
  const args = process.argv.slice(2)
  const opcoes = new Map<string, string>()
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]
    if (!['--entrada', '--zip-fonte', '--saida'].includes(flag) || !args[i + 1] || opcoes.has(flag)) {
      throw new Error('Uso: npx tsx scripts/importacao/mooca.mts --entrada <empresas_mooca.csv> --zip-fonte <entrega.zip> --saida <pasta-nova>')
    }
    opcoes.set(flag, args[i + 1])
  }
  if (opcoes.size !== 3) throw new Error('Informe --entrada, --zip-fonte e --saida.')
  const entrada = resolve(opcoes.get('--entrada')!)
  const zipFonte = resolve(opcoes.get('--zip-fonte')!)
  const saida = resolve(opcoes.get('--saida')!)
  if (existsSync(saida)) throw new Error('Destino já existe. Informe uma pasta nova.')

  const bytesEntrada = await readFile(entrada)
  const bytesZip = await readFile(zipFonte)
  const texto = new TextDecoder('utf-8', { fatal: true }).decode(bytesEntrada).replace(/^\uFEFF/, '')
  const lido = lerCsv(texto)
  if (!lido.ok) throw new Error(`Entrega com aspas não fechadas na linha ${lido.linha}.`)
  const cabecalho = lido.linhas[0]?.campos ?? []
  if (new Set(cabecalho).size !== cabecalho.length || REQUERIDAS.some(c => !cabecalho.includes(c))) {
    throw new Error('Entrega sem as colunas requeridas ou com colunas repetidas.')
  }
  const fontesOriginais = lido.linhas.slice(1).map(l => {
    if (l.campos.length !== cabecalho.length) throw new Error(`Quantidade de colunas incorreta na linha ${l.numero}.`)
    // Todos os identificadores, CEPs e contatos permanecem strings na fonte.
    return Object.fromEntries(cabecalho.map((c, i) => [c, l.campos[i]]))
  })
  const fontes = fontesOriginais.map(l => Object.fromEntries(REQUERIDAS.map(c => [c, l[c]])) as FonteMooca)
  const adaptacao = adaptarMooca(fontes)
  const conferida = analisarPlanilha(new TextEncoder().encode(adaptacao.csv))
  if (!conferida.ok || conferida.recusadas.length) throw new Error('CSV preparado não passou pela conferência real. Nenhum arquivo foi escrito.')
  const validacaoGrupo = validarMetadadosGrupo({
    descricao: 'Empresas de segurança eletrônica, informática, eletrônicos e automação na região da Mooca, selecionadas para qualificação comercial.',
    origem: 'Coleta por web scraping no Google Maps, com conferência de contatos publicados nos sites das empresas.',
    criterios: termos.join('\n'),
  })
  if (!validacaoGrupo.ok) throw new Error(`Metadados inválidos: ${validacaoGrupo.campo}/${validacaoGrupo.motivo}.`)
  const grupo = { nome: 'Mooca | Segurança, informática e eletrônicos', ...validacaoGrupo.metadados }
  const resumo = {
    selecionadas: fontes.length,
    comTelefonePublicado: fontes.filter(l => l.telefone.trim()).length,
    prontas: conferida.aceitas.length,
    pendenciasImpeditivas: adaptacao.pendencias.filter(p => !p.motivo.startsWith('aviso_')).length,
    avisosDuplicidade: adaptacao.pendencias.filter(p => p.motivo === 'aviso_telefone_compartilhado').length,
    criterioContagem: 'Linhas prontas para conferência cadastral; não representa compradores distintos nem atividade comercial confirmada.',
  }
  const pendenciasCsv = 'place_id,nome,motivo,tipo\n' + adaptacao.pendencias.map(p =>
    [p.placeId, p.nome, p.motivo, p.motivo.startsWith('aviso_') ? 'aviso' : 'impeditiva'].map(escapar).join(','),
  ).join('\n') + (adaptacao.pendencias.length ? '\n' : '')
  const rastreio = {
    preparadoEm: new Date().toISOString(), modo: 'preparacao_offline_sem_gravacao_no_crm',
    arquivos: { entrada: { caminho: entrada, sha256: sha256(bytesEntrada) }, zipFonte: { caminho: zipFonte, sha256: sha256(bytesZip) } },
    resumo, termosPesquisados: termos, fontesOriginais, linhas: adaptacao.rastreio,
    pendencias: adaptacao.pendencias,
    contatos: 'Somente o primeiro email válido da coluna conferida email; originais e alternativas preservados. Emails do motor não reconfirmados não são usados.',
    contexto: 'Entrega conserva as origens do piloto e do lote nas colunas originais. Fontes adicionais permanecem no ZIP original, identificado por SHA-256; a CLI não extrai nem executa o ZIP.',
  }
  await mkdir(dirname(saida), { recursive: true })
  // mkdir sem recursive ganha exclusividade: até uma corrida recusa o destino.
  await mkdir(saida)
  for (const [nome, conteudo] of [
    ['empresas-crm.csv', adaptacao.csv], ['pendencias.csv', pendenciasCsv],
    ['rastreio.json', json(rastreio)], ['grupo.json', json(grupo)],
  ]) await writeFile(join(saida, nome), conteudo, { encoding: 'utf8', flag: 'wx' })
  console.log(json({ saida, ...resumo }))
}

try {
  await preparar()
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : 'Falha ao preparar entrega.')
  process.exitCode = 1
}
