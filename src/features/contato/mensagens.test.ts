import { expect, test } from 'vitest'
import { textoDoMotivo, textoDaFalta } from './mensagens'
test('conflito explica preservação do rascunho e nunca promete devolução ou expiração', () => {
  expect(textoDoMotivo('desatualizada')).toContain('preservadas')
  for (const m of ['sem_permissao','nao_encontrada','desatualizada','arquivada','dados_invalidos','chave_reutilizada'] as const) expect(textoDoMotivo(m)).not.toMatch(/30|\breserva\b|Puxe/)
  expect(textoDaFalta('par_incompleto')).toContain('dois')
})
