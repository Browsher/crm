import { createHash } from 'node:crypto'
import { createReadStream, readFileSync } from 'node:fs'

export type Manifesto = {
  fonte: string
  versao: string
  publicado_em: string
  url: string
  sha256: string
  linhas_esperadas: number
}

// O manifesto é o que transforma "baixei um arquivo da internet" em "carreguei
// o retrato que está registrado". Mesmo padrão do railway-ca.pem: o arquivo
// grande fica fora do repositório, a soma fica dentro.
export function lerManifesto(caminho: string): Manifesto {
  const m = JSON.parse(readFileSync(caminho, 'utf8')) as Manifesto
  const faltando = (['fonte', 'versao', 'publicado_em', 'url', 'sha256', 'linhas_esperadas'] as const).filter(
    (c) => m[c] === undefined,
  )
  if (faltando.length > 0) throw new Error(`manifesto sem ${faltando.join(', ')}: ${caminho}`)
  if (!/^[0-9a-f]{64}$/.test(m.sha256)) throw new Error(`sha256 malformado no manifesto: ${caminho}`)
  return m
}

export function somaDoArquivo(caminho: string): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const hash = createHash('sha256')
    const fluxo = createReadStream(caminho)
    fluxo.on('error', rejeitar)
    fluxo.on('data', (p) => hash.update(p))
    fluxo.on('end', () => resolver(hash.digest('hex')))
  })
}
