import { describe, expect, it } from 'vitest'
import { mensagemDisponibilidade } from './mensagens'
import type { Disponibilidade } from './tipos'

describe('mensagemDisponibilidade', () => {
  it.each<[Disponibilidade, string, string | null]>([
    ['disponivel', 'Disponível', null],
    ['comigo', 'Com você', null],
    ['reservada_comigo', 'Reservada com você', null],
    ['outro_vendedor', 'Indisponível', 'Com outro vendedor'],
    ['em_descanso', 'Indisponível', 'Em descanso'],
  ])('traduz %s em texto acessível sem travessão', (estado, titulo, detalhe) => {
    const mensagem = mensagemDisponibilidade(estado)
    expect(mensagem).toEqual({ titulo, detalhe })
    expect(`${mensagem.titulo} ${mensagem.detalhe ?? ''}`).not.toMatch(/[—–]/)
  })
})
