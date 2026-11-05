// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'
import type { Contato } from '@/src/features/contato/historico'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
const { Ficha } = await import('./ficha')
const empresa: EmpresaComigo = {
  id: 'a', cnpj: null, razaoSocial: 'Aurora', nomeFantasia: null, cnaePrincipal: null,
  ultimoContato: null, contatoNome: null, telefone: '11999999999', email: null, cep: null, endereco: null,
  situacao: 'atendimento', versao: 1, reservadoAte: null, posse: true,
  proximoPasso: 'Agenda atual diferente', proximoPassoData: '2030-12-31', situacaoRetorno: 'sem_data', vencido: false,
}
const nota = 'Todos os detalhes combinados.\n'.repeat(50)
const contato: Contato = {
  id: 'c', tipo: 'acompanhamento', nota, autor: 'Autora anterior', criadoEm: new Date('2026-11-05T01:30:00Z'),
  proximoPasso: 'Enviar catálogo antigo', proximoPassoData: '2026-10-01',
}
function renderizar(contatos: Contato[]) {
  const tela = document.createElement('div')
  tela.innerHTML = renderToStaticMarkup(<Ficha usuarioId="v" empresa={empresa} contatos={contatos} />)
  return tela
}
test('carteira compõe histórico comum recolhido com autoria, nota integral e retorno próprio', () => {
  const tela = renderizar([contato])
  const historico = tela.querySelector('[aria-label="Histórico comercial"]')!
  expect(historico).not.toBeNull()
  const registro = historico.querySelector('details')!
  expect(registro.open).toBe(false)
  expect(registro.querySelector('summary')?.textContent).toContain('Autora anterior')
  expect(registro.querySelector('summary')?.textContent).toContain('04/11/2026')
  expect(registro.querySelector('summary')?.textContent).toContain('22:30')
  expect(registro.textContent).toContain(nota)
  expect(registro.textContent).toContain('Próximo passo registrado')
  expect(registro.querySelector('time[datetime="2026-10-01"]')?.textContent).toBe('01/10/2026')
  expect(historico.textContent).not.toContain('Agenda atual diferente')
  expect(historico.textContent).not.toContain('31/12/2030')
})
test('carteira distingue venda de contato sem nota e sem autoria', () => {
  const tela = renderizar([{ ...contato, nota: null, autor: null, proximoPasso: null, proximoPassoData: null }, {
    ...contato, id: 'v', tipo: 'venda_registrada', natureza: 'venda', nota: null,
    proximoPasso: null, proximoPassoData: null, venda: { centavos: '125050', data: '2026-11-04' },
  }])
  const registros = [...tela.querySelectorAll('details')]
  expect(registros).toHaveLength(2)
  expect(registros[0].querySelector('summary')?.textContent).not.toContain('Venda')
  expect(registros[0].textContent).toContain('Autor não informado')
  expect(registros[0].textContent).toContain('Sem anotação.')
  expect(registros[1].querySelector('summary')?.textContent).toContain('Venda registrada')
  expect(registros[1].textContent).toContain('1.250,50')
  expect(registros[1].textContent).toContain('Data da venda: 04/11/2026')
})
