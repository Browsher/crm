import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compilarCodigoN8n } from './codigo-n8n'

let compilado: string | null = null

export function compilarBibliotecaSimples(): string {
  if (compilado !== null) return compilado
  const arquivos = ['arquivo-empresas', 'cnpj', 'cep', 'cnae', 'prospeccao-base/modelo', 'prospeccao-base/telefone',
    'prospeccao-base/whatsapp', 'prospeccao-base/simples-modelo', 'prospeccao-base/entrada-sheets',
    'prospeccao-base/exportar-crm', 'prospeccao-base/sheets-simples']
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
  compilado = compilarCodigoN8n(modulos, 'entry')
  return compilado
}