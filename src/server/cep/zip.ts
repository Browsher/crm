import yauzl from 'yauzl'
import { linhaDoJson, type LinhaCep } from './linha'

// Lê o zip SEM EXTRAIR. Extrair é o caminho errado: a base real tem 1,2 milhão
// de arquivos de 184 bytes em média, e em NTFS cada um consome um cluster de
// 4 KB — 212 MB de conteúdo viram ~4,6 GB em disco.
export function lerZip(
  caminho: string,
  aoLer: (l: LinhaCep) => void,
): Promise<{ lidas: number; descartadas: number }> {
  return new Promise((resolver, rejeitar) => {
    yauzl.open(caminho, { lazyEntries: true }, (erro, zip) => {
      if (erro || !zip) return rejeitar(erro ?? new Error(`zip não abriu: ${caminho}`))
      let lidas = 0
      let descartadas = 0
      zip.on('error', rejeitar)
      zip.on('end', () => resolver({ lidas, descartadas }))
      zip.on('entry', (entrada) => {
        if (entrada.fileName.endsWith('/')) return zip.readEntry()
        zip.openReadStream(entrada, (erroFluxo, fluxo) => {
          if (erroFluxo || !fluxo) {
            return rejeitar(erroFluxo ?? new Error(`entrada não abriu: ${entrada.fileName}`))
          }
          const pedacos: Buffer[] = []
          fluxo.on('data', (p: Buffer) => pedacos.push(p))
          fluxo.on('error', rejeitar)
          fluxo.on('end', () => {
            const linha = linhaDoJson(Buffer.concat(pedacos).toString('utf8'))
            if (linha) {
              lidas++
              aoLer(linha)
            } else {
              descartadas++
            }
            zip.readEntry()
          })
        })
      })
      zip.readEntry()
    })
  })
}
