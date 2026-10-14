import { describe, expect, test, vi } from 'vitest'
import { ResultadoDesconhecido, reservarEmpresa, traduzirResultado } from './repositorio'

const executar = vi.hoisted(() => vi.fn())
vi.mock('../../server/db/como-usuario', () => ({ comoUsuario: async (_usuarioId: string, trabalho: (executor: unknown) => unknown) => trabalho(executar) }))

describe('traduzirResultado', () => {
  test('ok vira sucesso', () => {
    expect(traduzirResultado('empresa_assumir', 'ok')).toEqual({ ok: true })
  })

  const recusas: [string, string][] = [
    ['nao_encontrada', 'nao_encontrada'],
    ['reserva_expirada', 'reserva_expirada'],
    ['ja_e_sua', 'ja_e_sua'],
  ]
  for (const [valor, motivo] of recusas) {
    test(`${valor} vira falha com motivo proprio`, () => {
      expect(traduzirResultado('empresa_assumir', valor)).toEqual({ ok: false, motivo })
    })
  }

  test('valor fora do vocabulario LANCA, nao vira falha', () => {
    expect(() => traduzirResultado('empresa_assumir', 'talvez')).toThrow(ResultadoDesconhecido)
  })

  // Object.hasOwn, não indexação direta: sem isso 'toString' viraria resultado.
  test('nome de propriedade herdada nao vira resultado', () => {
    expect(() => traduzirResultado('empresa_assumir', 'toString')).toThrow(ResultadoDesconhecido)
  })
})

test('reserva envia grupo final e traduz indisponibilidade preservando campos vigentes',async()=>{
  const grupo='00000000-0000-4000-8000-000000000701'
  const prazo=new Date('2099-01-01')
  executar.mockResolvedValue({linhas:[{resultado:'grupo_indisponivel',empresa_id:'anterior',reservado_ate:prazo,contexto:'versao'}]})
  expect(await reservarEmpresa('eu','nova',{nome:'Luz',cnae:null,uf:null,cidade:null,bairro:null,grupo},'versao')).toEqual({ok:true,resultado:'grupo_indisponivel',empresaId:'anterior',reservadoAte:prazo,contexto:'versao'})
  expect(executar).toHaveBeenCalledWith('SELECT * FROM fila_reservar($1,$2,$3,$4,$5,$6,$7,$8)',['nova','Luz',null,null,null,null,'versao',grupo])
})
