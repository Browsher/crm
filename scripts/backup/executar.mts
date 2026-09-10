import { access, readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { lerAmbiente, lerChaveDaEntrada, resolverIpv4 } from '../../src/server/backup/configuracao'
import { criarColetorDocker, executarBackup, prepararAlvo, type ColetorBackup } from '../../src/server/backup/executar'

interface Configuracao {
  repositorio: string
  destino: string
  estado: string
}

function falhar(motivo: string): never {
  process.stderr.write(`${motivo}\n`)
  process.exit(1)
}

const caminhoConfig = process.argv[2]
if (!caminhoConfig || process.argv.length !== 3 || !isAbsolute(caminhoConfig)) falhar('informe o caminho absoluto da configuração')

try {
  const config = JSON.parse(await readFile(caminhoConfig, 'utf8')) as Configuracao
  for (const nome of ['repositorio', 'destino', 'estado'] as const) {
    const caminho = config[nome]
    if (typeof caminho !== 'string' || !isAbsolute(caminho)) falhar(`${nome} deve ser caminho absoluto`)
  }
  await access(config.repositorio)
  const chave = await lerChaveDaEntrada()
  const coletores: ColetorBackup[] = [
    {
      nome: 'local',
      coletar: async () => {
        const ambiente = await lerAmbiente(join(config.repositorio, '.env.local'))
        return await criarColetorDocker(prepararAlvo('local', ambiente)).coletar()
      }
    },
    {
      nome: 'railway',
      coletar: async () => {
        const ambiente = await lerAmbiente(join(config.repositorio, '.env.railway.local'))
        const alvo = prepararAlvo('railway', ambiente)
        if (alvo.ca && !isAbsolute(alvo.ca)) alvo.ca = resolve(config.repositorio, alvo.ca)
        if (alvo.ca) await access(alvo.ca)
        alvo.enderecoProxy = await resolverIpv4(alvo.host)
        if (!alvo.enderecoProxy) throw new Error('proxy Railway indisponível')
        return await criarColetorDocker(alvo).coletar()
      }
    }
  ]
  const resultado = await executarBackup({
    destino: config.destino,
    estado: config.estado,
    chave,
    coletores
  })
  process.stdout.write(`${JSON.stringify(resultado)}\n`)
  process.exitCode = resultado.ok ? 0 : 1
} catch {
  falhar('backup falhou; consulte o resultado operacional')
}
