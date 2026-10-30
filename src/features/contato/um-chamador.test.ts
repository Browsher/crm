import { globSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
const arquivos = [...globSync('src/**/*.ts'), ...globSync('app/**/*.{ts,tsx}')].map(p => p.replaceAll('\\','/')).filter(p => !p.includes('.test.'))
test('contato usa somente o adaptador direto comum e aposenta RPC de reserva em produção', () => {
  expect(arquivos.filter(p => readFileSync(p,'utf8').includes('SELECT contato_registrar('))).toEqual([])
  expect(arquivos.filter(p => readFileSync(p,'utf8').includes('SELECT contato_registrar_direto('))).toEqual(['src/server/atendimento/operacoes.ts'])
})
test('a action lê fase autorizada e usa validação pura', () => {
  const s=readFileSync('src/features/contato/acao.ts','utf8')
  expect(s).toContain('lerAtendimento(eu.usuarioId, empresaId)')
  expect(s).toContain('validarContatoDireto')
  expect(s).not.toContain("form.get('posse')")
})
