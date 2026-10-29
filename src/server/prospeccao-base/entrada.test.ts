import { expect, test } from 'vitest'
import { lerFontesMaps } from './entrada'

const fonte = () => ({
  place_id: 'place-cenario', nome_empresa: 'Empresa fictícia', cnpj: '',
  telefone: '(11) 2606-1244', endereco: 'Rua do cenário, 10, sala 2',
  link_maps: 'https://maps.google.com/', cep: '03123000',
  endereco_maps: 'Rua do cenário, 10, sala 2', observacoes: 'Conferido',
})
test('preserva endereço, CEP e campos adicionais como texto', () => {
  expect(lerFontesMaps([{ ...fonte(), coluna_adicional: '=texto literal' }])).toEqual({
    ok: true, fontes: [{ ...fonte(), coluna_adicional: '=texto literal' }],
  })
})
test('empresa sem telefone não desaparece', () => {
  const r = lerFontesMaps([{ ...fonte(), telefone: '' }])
  expect(r.ok && r.fontes[0].telefone).toBe('')
})
test.each(['place_id', 'nome_empresa', 'endereco', 'link_maps'])('recusa entrada sem a coluna %s', coluna => {
  const linha: Record<string, unknown> = fonte()
  delete linha[coluna]
  expect(lerFontesMaps([linha])).toMatchObject({ ok: false, motivo: 'entrada_invalida' })
})
test('CEP numérico não é convertido para texto depois de perder zero', () => {
  expect(lerFontesMaps([{ ...fonte(), cep: 3123000 }]))
    .toMatchObject({ ok: false, motivo: 'entrada_invalida' })
})
test('nome e Place ID vazios não entram no índice', () => {
  expect(lerFontesMaps([{ ...fonte(), place_id: '' }])).toMatchObject({ ok: false })
  expect(lerFontesMaps([{ ...fonte(), nome_empresa: '  ' }])).toMatchObject({ ok: false })
})
test('caractere de controle na identidade é recusado', () => {
  expect(lerFontesMaps([{ ...fonte(), place_id: 'p\u0000' }])).toMatchObject({ ok: false })
})
