import { expect, test } from 'vitest'
import { emitirConferencia, verificarConferencia } from './conferencia'

const env = { IMPORTACAO_CONFERENCIA_SEGREDO: 'ab'.repeat(32) }
const contexto = { usuarioId: 'gestor-a', operacao: { chave: '11111111-1111-4111-8111-111111111111', nome: 'Mooca', arquivoNome: 'mooca.csv', assinatura: 'a'.repeat(64) } }
const conferencia = { linhasAceitas: [2, 4], recusadasIdentidade: [{ tipo: 'identidade' as const, linha: 3, motivo: 'cnpj_divergente' as const }] }
test('comprovante preserva seleção e recusas sem depender de memória de processo', () => {
  const token = emitirConferencia(contexto, conferencia, env)
  expect(verificarConferencia(token, contexto, { ...env })).toEqual(conferencia)
})
test.each([['vazia', ''], ['texto comum', 'senha'], ['não hexadecimal', 'x'.repeat(64)], ['curta', 'a'.repeat(63)]])('configuração %s falha fechada', (_rotulo, segredo) => {
  const config = { IMPORTACAO_CONFERENCIA_SEGREDO: segredo }
  expect(emitirConferencia(contexto, conferencia, config)).toBeNull()
  expect(verificarConferencia(emitirConferencia(contexto, conferencia, env), contexto, config)).toBeNull()
})
test('configuração ausente não reutiliza segredo da conexão ou cookie', () => {
  const config = { IMPORTACAO_CONFERENCIA_SEGREDO: undefined, DATABASE_URL: 'postgres://segredo', COOKIE: 'cookie' }
  expect(emitirConferencia(contexto, conferencia, config)).toBeNull()
  expect(verificarConferencia(emitirConferencia(contexto, conferencia, env), contexto, config)).toBeNull()
})
test.each(['chave', 'nome', 'arquivoNome', 'assinatura'] as const)('mudança de %s invalida o comprovante', campo => {
  const token = emitirConferencia(contexto, conferencia, env)
  expect(verificarConferencia(token, { ...contexto, operacao: { ...contexto.operacao, [campo]: 'outro' } }, env)).toBeNull()
})
test('outro gestor ou outra chave de servidor não reconhece comprovante', () => {
  const token = emitirConferencia(contexto, conferencia, env)
  expect(verificarConferencia(token, { ...contexto, usuarioId: 'gestor-b' }, env)).toBeNull()
  expect(verificarConferencia(token, contexto, { IMPORTACAO_CONFERENCIA_SEGREDO: 'cd'.repeat(32) })).toBeNull()
})
test('seleção adulterada não pode confirmar um subconjunto arbitrário', () => {
  const token = emitirConferencia(contexto, conferencia, env)!
  const [payload, mac] = token.split('.')
  const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  json.linhasAceitas = [4]
  expect(verificarConferencia(`${Buffer.from(JSON.stringify(json)).toString('base64url')}.${mac}`, contexto, env)).toBeNull()
})
test.each([['vazio', ''], ['texto comum', 'invalido'], ['excessivo', 'a'.repeat(600_001)]])('comprovante %s é recusado', (_rotulo, token) => {
  expect(verificarConferencia(token, contexto, env)).toBeNull()
})
test('schema autenticado também exige versão e seleção sem repetições', () => {
  const invalida = { linhasAceitas: [2, 2], recusadasIdentidade: [] }
  expect(verificarConferencia(emitirConferencia(contexto, invalida, env), contexto, env)).toBeNull()
  expect(verificarConferencia(emitirConferencia(contexto, { linhasAceitas: [2], recusadasIdentidade: [{ tipo: 'identidade', linha: 2, motivo: 'cnpj_divergente' }] }, env), contexto, env)).toBeNull()
})


test('comprovante de 5.000 recusas conserva seleção e schema no round-trip', () => {
  const maximo = { linhasAceitas: [], recusadasIdentidade: Array.from({ length: 5000 }, (_, i) => ({ tipo: 'identidade' as const, linha: 1_000_000 + i, motivo: 'identificadores_divergentes' as const })) }
  const token = emitirConferencia(contexto, maximo, env)!
  // O transporte é medido com encodeReply e argumentos reais do wrapper em
  // app/empresas/importar/formulario-transporte.test.tsx. Aqui é só o envelope.
  expect(verificarConferencia(token, contexto, env)).toEqual(maximo)
})
