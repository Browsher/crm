import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

// Gera o inventário dos testes unitários: um nome por linha, ordenado.
//
// Existe por causa de um mistério: numa rodada da fatia `contato` o unitário
// deu "1 falha em 415" e a saída foi truncada antes de alguém ler QUAL. Cinco
// rodadas depois, incluindo `build` seguido de `test:unit`, deram 415 verdes,
// e a falha não reapareceu.
//
// Sem inventário, a próxima ocorrência é outro mistério do mesmo tamanho. Com
// ele, `git diff` sobre este arquivo responde "que teste sumiu, apareceu ou
// mudou de nome desde a última vez" — e a contagem deixa de ser o único dado.
//
// Regenerar depois de acrescentar teste: `npm run test:inventario`.

const DESTINO = 'tests/inventario-unitario.txt'

const pasta = mkdtempSync(join(tmpdir(), 'inventario-'))
const saida = join(pasta, 'unitario.json')

execFileSync('npx', ['vitest', 'run', '--project', 'unitario', '--reporter=json', `--outputFile=${saida}`], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
})

type Relatorio = {
  testResults: { name: string; assertionResults: { fullName: string }[] }[]
}

const relatorio: Relatorio = JSON.parse(readFileSync(saida, 'utf8'))

const nomes = relatorio.testResults
  .flatMap((arquivo) =>
    arquivo.assertionResults.map(
      (t) => `${relative(process.cwd(), arquivo.name).split('\\').join('/')} :: ${t.fullName}`,
    ),
  )
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))

const cabecalho = [
  '# Inventário dos testes unitários',
  '#',
  '# Gerado por `npm run test:inventario`. Um nome por linha, ordenado.',
  '# Serve para diferenciar uma falha intermitente da próxima: sem isto,',
  '# "1 falha em N" com a saída truncada não é comparável com nada.',
  `# Total: ${nomes.length}`,
  '',
]

writeFileSync(DESTINO, cabecalho.concat(nomes).join('\n') + '\n', 'utf8')
console.log(`${DESTINO}: ${nomes.length} testes`)
