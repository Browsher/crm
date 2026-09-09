import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { from as copiarDe } from 'pg-copy-streams'
import { comAdmin } from '../db/admin'
import { paraCsv } from './linha'
import { somaDoArquivo, type Manifesto } from './manifesto'
import { lerZip } from './zip'

export type Resultado =
  | { ok: true; linhas: number }
  | { ok: false; motivo: 'soma_diferente' | 'contagem_diferente'; detalhe: string }

const COLUNAS = '(cep, logradouro, faixa, bairro, localidade, uf, ibge)'

// Os dois avisos são opcionais e injetáveis: o carregador diz o que está
// fazendo, e quem chama decide como mostrar. A carga real leva quase seis
// minutos, e sem sinal nenhum o operador não distingue "trabalhando" de
// "travado" — a reação natural é Ctrl+C, que faz ROLLBACK e desperdiça a
// rodada inteira. A política de quanto imprimir fica no CLI, não aqui.
export async function carregar(o: {
  urlAdmin: string
  caminhoZip: string
  manifesto: Manifesto
  aoProgredir?: (lidas: number) => void
  aoFase?: (fase: string) => void
}): Promise<Resultado> {
  // Catraca 1, antes de abrir transação: o arquivo em disco é o que o
  // manifesto registra? Diferente, para — não avisa e continua.
  o.aoFase?.('conferindo soma')
  const soma = await somaDoArquivo(o.caminhoZip)
  if (soma !== o.manifesto.sha256) {
    return { ok: false, motivo: 'soma_diferente', detalhe: `esperado ${o.manifesto.sha256}, lido ${soma}` }
  }

  o.aoFase?.('lendo zip')
  const csv: string[] = []
  await lerZip(o.caminhoZip, (l) => {
    csv.push(paraCsv(l))
    // Conta ENTRADA lida, não linha gravada: a duplicata entra aqui e só é
    // descartada depois, pelo DISTINCT ON. Por isso o total pode passar de
    // linhas_esperadas por poucas unidades.
    o.aoProgredir?.(csv.length)
  })

  o.aoFase?.('gravando no banco')
  return comAdmin(o.urlAdmin, async (c) => {
    await c.query('BEGIN')
    try {
      // TRUNCATE é transacional no Postgres, então nunca existe um instante em
      // que a aplicação veja a tabela vazia: ou o retrato novo entra inteiro,
      // ou o antigo continua.
      await c.query('TRUNCATE cep')
      // Temporária SEM chave: a base real tem uma duplicata, e COPY direto na
      // PK abortaria a carga inteira. O DISTINCT ON abaixo resolve no banco,
      // sem um Set de 1,2 milhão de strings na memória do Node.
      await c.query('CREATE TEMP TABLE cep_bruto (LIKE cep) ON COMMIT DROP')

      const destino = c.query(copiarDe(`COPY cep_bruto ${COLUNAS} FROM STDIN WITH (FORMAT csv)`))
      await pipeline(Readable.from(csv), destino)

      await c.query(`INSERT INTO cep ${COLUNAS}
        SELECT DISTINCT ON (cep) cep, logradouro, faixa, bairro, localidade, uf, ibge
          FROM cep_bruto ORDER BY cep`)

      // Catraca 2, DENTRO da transação: carga truncada por erro de leitura não
      // fica de pé. O ROLLBACK devolve o retrato anterior.
      const { rows } = await c.query<{ n: string }>('SELECT count(*)::text AS n FROM cep')
      const linhas = Number(rows[0].n)
      if (linhas !== o.manifesto.linhas_esperadas) {
        await c.query('ROLLBACK')
        return {
          ok: false,
          motivo: 'contagem_diferente',
          detalhe: `esperado ${o.manifesto.linhas_esperadas}, carregado ${linhas}`,
        }
      }

      await c.query(
        `INSERT INTO cep_carga (fonte, versao, publicado_em, arquivo_sha256, linhas)
         VALUES ($1, $2, $3, $4, $5)`,
        [o.manifesto.fonte, o.manifesto.versao, o.manifesto.publicado_em, o.manifesto.sha256, linhas],
      )
      await c.query('COMMIT')
      return { ok: true, linhas }
    } catch (erro) {
      await c.query('ROLLBACK')
      throw erro
    }
  })
}
