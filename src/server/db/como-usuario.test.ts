import { expect, test } from 'vitest'
import { comoUsuario, UsuarioIdInvalido } from './como-usuario'

// A URL aponta para porta fechada: se a validação não vier antes da conexão,
// o teste falha com erro de rede em vez de UsuarioIdInvalido.
const URL_FECHADA = 'postgres://x:y@localhost:1/z'

test('id que não é UUID lança antes de tocar no banco', async () => {
  await expect(comoUsuario('nao-e-uuid', async () => 1, URL_FECHADA)).rejects.toBeInstanceOf(UsuarioIdInvalido)
  await expect(comoUsuario("'; DROP TABLE usuario; --", async () => 1, URL_FECHADA)).rejects.toBeInstanceOf(
    UsuarioIdInvalido,
  )
})
