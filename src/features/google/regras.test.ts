import { expect, test } from 'vitest'
import { hojeEmSaoPaulo, semanaDe, validarPlano, proximosDiasUteis } from './regras'

test.each([
  ['2026-10-22',['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28']],
  ['2026-10-23',['2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29']],
  ['2026-10-24',['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30']],
  ['2026-12-31',['2026-12-31','2027-01-01','2027-01-04','2027-01-05','2027-01-06']],
])('próximos dias avançam sem repetir o passado a partir de %s',(hoje,esperado)=>{
  expect(proximosDiasUteis(hoje)).toEqual(esperado)
})

test('semana civil tem cinco dias e domingo pertence à semana anterior', () => {
  expect(semanaDe('2026-10-25')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'])
  expect(semanaDe('2027-01-01')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01'])
})
test('não normaliza silenciosamente uma data inexistente', () => {
  expect(semanaDe('2026-02-30')).toBeNull()
  expect(semanaDe('qualquer')).toBeNull()
})
test('dia de São Paulo não depende do fuso do servidor', () => {
  expect(hojeEmSaoPaulo(new Date('2026-10-23T01:30:00Z'))).toBe('2026-10-22')
})
test('dia totalmente vazio pode ficar não definido', () => {
  expect(validarPlano({ dia: '2026-10-26', nicho: '', bairro: '', cidade: '', uf: '' })).toMatchObject({ ok: true })
})
test('critério inválido impede salvar e critério válido acompanha o plano', () => {
  const base = { dia: '2026-10-26', nicho: 'Loja', bairro: '', cidade: 'São Paulo', uf: 'SP' }
  expect(validarPlano({ ...base, criterios: { telefone: ['celular'] } })).toMatchObject({ ok: false })
  expect(validarPlano({ ...base, criterios: { nota: 0 } })).toMatchObject({ ok: true, plano: { criterios: { nota: 0 } } })
})
test('critérios são dados literais e bairro é opcional', () => {
  expect(validarPlano({ dia: '2026-10-26', nicho: ' Pet shop $() ', bairro: '', cidade: ' São Paulo ', uf: 'sp' })).toEqual({ ok: true,
    plano: { dia: '2026-10-26', nicho: 'Pet shop $()', bairro: '', cidade: 'São Paulo', uf: 'SP' } })
})
test.each([{ dia: '2026-10-25' }, { nicho: '' }, { cidade: '' }, { uf: 'XX' }, { nicho: 'a'.repeat(101) }, { bairro: 'teste\ncomando' }])('rejeita plano inválido: %j', falha => {
  expect(validarPlano({ dia: '2026-10-26', nicho: 'Loja', bairro: '', cidade: 'São Paulo', uf: 'SP', ...falha })).toMatchObject({ ok: false })
})
