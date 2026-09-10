import { describe, expect, test } from 'vitest'
import { DESFECHO_SUGERIDO, EXIGE_POSSE, ROTULO, TIPOS_CONTATO, ehTipo } from './tipos'

describe('TIPOS_CONTATO', () => {
  test('tem os seis tipos da spec, e nenhum a mais', () => {
    expect([...TIPOS_CONTATO]).toEqual([
      'nao_liguei',
      'nao_atendeu',
      'retornar_depois',
      'sem_interesse',
      'interessado',
      'acompanhamento',
    ])
  })

  test('todo tipo tem rotulo e desfecho sugerido', () => {
    for (const t of TIPOS_CONTATO) {
      expect(ROTULO[t]).toBeTruthy()
      expect(['nenhum', 'assumir', 'devolver']).toContain(DESFECHO_SUGERIDO[t])
    }
  })

  // O único tipo de posse. Se algum dia outro entrar, este teste obriga a
  // decidir conscientemente em vez de deixar acontecer.
  test('acompanhamento e o unico tipo de posse', () => {
    const dePosse = TIPOS_CONTATO.filter((t) => EXIGE_POSSE[t])
    expect(dePosse).toEqual(['acompanhamento'])
  })

  test('interessado sugere assumir; os outros de reserva sugerem devolver', () => {
    expect(DESFECHO_SUGERIDO.interessado).toBe('assumir')
    expect(DESFECHO_SUGERIDO.nao_liguei).toBe('devolver')
    expect(DESFECHO_SUGERIDO.nao_atendeu).toBe('devolver')
    expect(DESFECHO_SUGERIDO.retornar_depois).toBe('devolver')
    expect(DESFECHO_SUGERIDO.sem_interesse).toBe('devolver')
    expect(DESFECHO_SUGERIDO.acompanhamento).toBe('nenhum')
  })
})

describe('ehTipo', () => {
  test('aceita tipo da lista', () => {
    expect(ehTipo('nao_liguei')).toBe(true)
  })

  test('recusa tipo fora da lista — e e a UNICA defesa que existe, porque o banco so exige nao-vazio', () => {
    expect(ehTipo('inventado')).toBe(false)
  })

  // Includes sobre tupla, não indexação de objeto: sem isso 'toString' passaria.
  test('nome de propriedade herdada nao e tipo', () => {
    expect(ehTipo('toString')).toBe(false)
  })
})
