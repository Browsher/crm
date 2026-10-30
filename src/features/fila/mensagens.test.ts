import { expect, test } from 'vitest'
import { textoDoMotivo } from './mensagens'

test('consulta pessoal explica recusa de autorização sem sugerir aquisição global', () => {
  expect(textoDoMotivo('sem_permissao')).toContain('Você não tem permissão')
  expect(textoDoMotivo('sem_permissao')).not.toMatch(/Puxe|reserva|próxima/)
})
