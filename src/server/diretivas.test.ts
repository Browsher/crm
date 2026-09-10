import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Catraca nascida de um bug real: `app/empresas/importar/acao.ts` exportava a
// constante IMPORTAR_INICIAL de um arquivo 'use server'. O Next transformou a
// constante numa REFERÊNCIA DE SERVIDOR — conferido no
// server-reference-manifest.json do build, que listava duas entradas para o
// arquivo. No cliente ela virou função em vez de objeto, `estado.inseridas`
// virou undefined, e a tela abriu no ramo errado.
//
// Nada acusava: typecheck, lint, build e a suíte inteira passavam. Só a tela
// mostrava, e só para quem abrisse.
//
// A regra: arquivo com 'use server' no topo só exporta função. Valor que o
// cliente precisa ler mora no componente cliente (é o que
// app/usuarios/formulario-criar.tsx sempre fez) ou num módulo sem a diretiva.
//
// O LIMITE, declarado: isto lê os exports em tempo de execução do Vitest, onde
// a diretiva é inerte. Pega export de valor, que é o erro que aconteceu. Não
// pega função exportada que não deveria ser action, nem 'use server' inline
// dentro de uma função.
// Varre `app/**` e `src/**`: a action de contato mora em src/features/contato,
// e sem esta linha ela ficaria fora do alcance da catraca que nasceu
// exatamente do bug que ela pode ter. Antes da fatia `contato` a catraca
// afirmava "toda action em app/ está vigiada"; agora afirma "toda superfície
// 'use server' do projeto está vigiada".
const ARQUIVOS = [...globSync('app/**/*.{ts,tsx}'), ...globSync('src/**/*.{ts,tsx}')].filter((caminho) => {
  const primeira = readFileSync(caminho, 'utf8').trimStart().slice(0, 20)
  return primeira.startsWith("'use server'") || primeira.startsWith('"use server"')
})

describe("arquivos 'use server'", () => {
  test('existe pelo menos um, senão esta catraca não vigia nada', () => {
    expect(ARQUIVOS.length).toBeGreaterThan(0)
  })

  // Sem isto, estender o glob passa e não cobre nada: a catraca ficaria verde
  // sobre os mesmos arquivos de antes.
  test('a varredura enxerga a action que mora em src/', () => {
    expect(ARQUIVOS.some((c) => c.split('\\').join('/') === 'src/features/contato/acao.ts')).toBe(true)
  })

  for (const caminho of ARQUIVOS) {
    test(`${caminho} só exporta função`, async () => {
      const modulo: Record<string, unknown> = await import(`@/${caminho}`)
      const naoFuncoes = Object.entries(modulo)
        .filter(([, valor]) => typeof valor !== 'function')
        .map(([nome]) => nome)
      expect(naoFuncoes).toEqual([])
    })
  }
})
