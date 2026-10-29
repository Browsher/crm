import { describe, expect, test } from 'vitest'
import { validarContatoDireto } from './regras'

describe('validarContatoDireto', () => {
  const entrada = { tipo: 'nao_atendeu', nota: '  Tentativa  ', proximoPasso: '', proximoPassoData: '' }
  test('não atendeu permite próximo passo opcional em qualquer fase e normaliza nota', () => {
    for (const fase of ['inicial', 'negociacao', 'cliente'] as const) {
      expect(validarContatoDireto(entrada, fase)).toEqual({ ok: true, valor: { tipo: 'nao_atendeu', nota: 'Tentativa', proximoPasso: null, proximoPassoData: null } })
      expect(validarContatoDireto({ ...entrada, proximoPasso: 'Ligar', proximoPassoData: '2027-03-02' }, fase).ok).toBe(true)
    }
  })
  test('recusa par incompleto, retorno sem combinado e arquivo com agenda', () => {
    expect(validarContatoDireto({ ...entrada, proximoPasso: 'Ligar' }, 'inicial')).toEqual({ ok: false, falta: 'par_incompleto' })
    expect(validarContatoDireto({ ...entrada, tipo: 'retornar_depois' }, 'inicial')).toEqual({ ok: false, falta: 'proximo_passo_exigido' })
    expect(validarContatoDireto({ ...entrada, tipo: 'sem_interesse', proximoPasso: 'Ligar', proximoPassoData: '2027-03-02' }, 'negociacao')).toEqual({ ok: false, falta: 'agenda_incompativel' })
  })
  test('acompanhamento requer fase comercial e próximo passo, não liguei preserva atividade honesta', () => {
    expect(validarContatoDireto({ ...entrada, tipo: 'acompanhamento' }, 'inicial')).toEqual({ ok: false, falta: 'tipo_invalido' })
    expect(validarContatoDireto({ ...entrada, tipo: 'acompanhamento' }, 'cliente')).toEqual({ ok: false, falta: 'proximo_passo_exigido' })
    expect(validarContatoDireto({ ...entrada, tipo: 'nao_liguei' }, 'inicial')).toEqual({ ok: true, valor: { tipo: 'nao_liguei', nota: 'Tentativa', proximoPasso: null, proximoPassoData: null } })
  })
  test('data inválida não alcança o banco', () => {
    expect(validarContatoDireto({ ...entrada, proximoPasso: 'Ligar', proximoPassoData: '2027-02-30' }, 'inicial')).toEqual({ ok: false, falta: 'dados_invalidos' })
  })
})
