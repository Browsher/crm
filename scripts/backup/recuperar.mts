import { isAbsolute } from 'node:path'
import { lerChaveDaEntrada } from '../../src/server/backup/configuracao'
import { recuperarPacote } from '../../src/server/backup/executar'

function falhar(motivo: string): never {
  process.stderr.write(`${motivo}\n`)
  process.exit(1)
}

const arquivo = process.argv[2]
const destinoNovo = process.argv[3]
if (!arquivo || !destinoNovo || process.argv.length !== 4 || !isAbsolute(arquivo) || !isAbsolute(destinoNovo)) {
  falhar('informe arquivo e pasta nova com caminhos absolutos')
}

try {
  const chave = await lerChaveDaEntrada()
  await recuperarPacote(arquivo, destinoNovo, chave)
  process.stdout.write('pacote validado e extraído; nenhum SQL foi executado\n')
} catch {
  falhar('recuperação falhou')
}
