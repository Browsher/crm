import { expect, test } from 'vitest'
import { AridadeInvalida, chamar, FUNCOES, FuncaoDesconhecida } from './sem-identidade'

// Sem DATABASE_URL no ambiente unitário: se a validação não vier antes da
// conexão, o teste falha com "Variável de ambiente ausente" em vez do erro nomeado.

test('nome fora do mapa lança antes de tocar no banco', async () => {
  await expect(chamar('drop_tudo' as never, [] as never)).rejects.toBeInstanceOf(FuncaoDesconhecida)
})

test('aridade errada lança antes de tocar no banco', async () => {
  await expect(chamar('sessao_atual', ['a', 'b'] as never)).rejects.toBeInstanceOf(AridadeInvalida)
})

test('o mapa tem exatamente as sete funções da spec', () => {
  expect(Object.keys(FUNCOES).sort()).toEqual([
    'bloqueio_login',
    'credencial_por_email',
    'registrar_tentativa_login',
    'senha_trocar',
    'sessao_atual',
    'sessao_criar',
    'sessao_encerrar',
  ])
})
