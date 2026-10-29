// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PainelFiltros } from './painel-filtros'
import { FiltrosForm } from '@/app/carteira/filtros-form'

test('painel mantém um único formulário com campos, valores e ações da Carteira', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(<FiltrosForm filtros={{ nome: 'Aurora', uf: 'SP', retorno: 'atrasado' }} ufs={['SP', 'RJ', 'SP']} />)
  expect(container.querySelectorAll('form')).toHaveLength(1)
  const form = container.querySelector('form')!
  expect(form.getAttribute('action')).toBe('/carteira')
  expect(form.querySelector('[data-slot="card"]')).not.toBeNull()
  expect([...new FormData(form).entries()]).toEqual([['nome', 'Aurora'], ['uf', 'SP'], ['retorno', 'atrasado']])
  for (const id of ['carteira-nome', 'carteira-uf', 'carteira-retorno']) {
    expect(form.querySelector(`label[for="${id}"]`)).not.toBeNull()
  }
  expect(form.querySelector('button[type="submit"]')?.textContent).toBe('Filtrar')
  expect(form.querySelector('a[href="/carteira"]')?.textContent).toBe('Limpar filtros')
  expect([...form.querySelectorAll('#carteira-uf option')].map(option => option.textContent)).toEqual(['Todos', 'RJ', 'SP'])
})


test('painel compõe conteúdo, descrição e ações sem assumir o formulário do consumidor', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(<form action="/destino" method="get">
    <PainelFiltros descricao={<p>Escolha os filtros</p>} acoes={<button type="submit">Aplicar</button>} className="consumidor">
      <div><label htmlFor="teste-nome">Empresa</label><input id="teste-nome" name="nome" defaultValue="Aurora" /></div>
    </PainelFiltros>
  </form>)
  expect(container.querySelectorAll('form')).toHaveLength(1)
  expect(container.querySelector('[data-slot="card"]')?.textContent).toContain('Escolha os filtros')
  expect(container.querySelector('form')?.method).toBe('get')
  expect(container.querySelector('button')?.form).toBe(container.querySelector('form'))
  expect([...new FormData(container.querySelector('form')!).entries()]).toEqual([['nome', 'Aurora']])
})
