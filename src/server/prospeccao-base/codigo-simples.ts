import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compilarCodigoN8n } from './codigo-n8n'

let compilado: string | null = null
let compiladoBackup: string | null = null

export function compilarBibliotecaSimples(comBackup = false): string {
  const cache = comBackup ? compiladoBackup : compilado
  if (cache !== null) return cache
  const arquivos = ['arquivo-empresas', 'cnpj', 'cep', 'cnae', 'prospeccao-base/modelo', 'prospeccao-base/telefone',
    'prospeccao-base/whatsapp', 'prospeccao-base/simples-modelo', 'prospeccao-base/entrada-sheets',
    'prospeccao-base/exportar-crm', 'prospeccao-base/sheets-simples']
  if (comBackup) arquivos.push('prospeccao-base/backup-telefones')
  const modulos = Object.fromEntries(arquivos.map(arquivo => {
    const id = 'src/lib/' + arquivo
    return [id, readFileSync(resolve(id + '.ts'), 'utf8')]
  }))
  // Exports atribuídos explicitamente: o runner seguro pode neutralizar defineProperty.
  modulos.entry = [
    "import { lerColetaSheets as ler } from './src/lib/prospeccao-base/entrada-sheets'",
    "import { montarSaidas as montar } from './src/lib/prospeccao-base/exportar-crm'",
    "import { prepararPublicacao as preparar, conferirSaidas as conferir, rangeA1 as range } from './src/lib/prospeccao-base/sheets-simples'",
    "import { classificarConsultaComunidade as classificar } from './src/lib/prospeccao-base/whatsapp'",
    'export const lerColetaSheets = ler',
    'export const montarSaidas = montar',
    'export const prepararPublicacao = preparar',
    'export const conferirSaidas = conferir',
    'export const rangeA1 = range',
    'export const classificarConsultaComunidade = classificar',
  ].join('\n')
  if (comBackup) modulos.entry += '\n' + [
    "import { consolidarBackupTelefones as consolidar, filtrarColetaPorBackup as filtrar, conferirBackup as conferirHistorico, prepararAcrescimoBackup as acrescentar } from './src/lib/prospeccao-base/backup-telefones'",
    "import { COLUNAS_CRM as colunas } from './src/lib/prospeccao-base/exportar-crm'",
    'export const consolidarBackupTelefones = consolidar',
    'export const filtrarColetaPorBackup = filtrar',
    'export const conferirBackup = conferirHistorico',
    'export const prepararAcrescimoBackup = acrescentar',
    'export const COLUNAS_CRM = colunas',
  ].join('\n')
  const resultado = compilarCodigoN8n(modulos, 'entry')
  if (comBackup) compiladoBackup = resultado
  else compilado = resultado
  return resultado
}

let compiladoDrive: string | null = null

export function compilarBibliotecaDrive(): string {
  if (compiladoDrive !== null) return compiladoDrive
  const id = 'src/lib/prospeccao-base/arquivos-drive'
  const nomes = ['criarCsvDrive','matrizSheetsDrive','nomeSeguroDrive','nomePastaDrive','lerManifestoDrive',
    'escreverManifestoDrive','resolverOrigemDrive','criarExportacaoDrive','conferirPastaDrive','queryArquivoDrive']
  const modulos = { [id]: readFileSync(resolve(id + '.ts'),'utf8'),
    entry: "import * as drive from './" + id + "'\n" + nomes.map(n => 'export const ' + n + ' = drive.' + n).join('\n') }
  compiladoDrive = compilarCodigoN8n(modulos,'entry')
  return compiladoDrive
}

let compiladoAutomatico: string | null = null

export function compilarBibliotecaAutomatica(): string {
  if (compiladoAutomatico !== null) return compiladoAutomatico
  const arquivos = ['prospeccao-base/arquivos-drive','prospeccao-base/automatico']
  const modulos = Object.fromEntries(arquivos.map(a => ['src/lib/' + a, readFileSync(resolve('src/lib/' + a + '.ts'),'utf8')]))
  const nomes = ['validarSinalColetaPronta','conferirPublicacaoAutomatica','escreverAssinaturaAutomatica','conferirExportacaoAutomatica','montarRespostaAutomatica']
  modulos.entry = "import * as auto from './src/lib/prospeccao-base/automatico'\n" + nomes.map(n => 'export const ' + n + ' = auto.' + n).join('\n')
  compiladoAutomatico = compilarCodigoN8n(modulos,'entry')
  return compiladoAutomatico
}
