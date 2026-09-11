import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import { Lista } from './lista'

const UMA: EmpresaNaLista = {
  id: '11111111-1111-4111-8111-111111111111',
  cnpj: '11222333000181',
  razaoSocial: 'Iluminação São João',
  nomeFantasia: null,
  telefone: '11987654321',
  email: null,
  cep: null,
  cnaePrincipal: null,
  localidade: null,
  uf: null,
}

describe('Lista', () => {
  test('com empresas, monta uma lista', () => {
    const saida = renderToStaticMarkup(<Lista linhas={[UMA]} />)
    expect(saida).toContain('<ul')
    expect(saida).toContain('Iluminação São João')
  })

  test('vazia, diz que não achou', () => {
    expect(renderToStaticMarkup(<Lista linhas={[]} />)).toContain('Nenhuma empresa encontrada')
  })

  // Página além do fim vem vazia e o total da janela vem zero, então a
  // paginação some. Sem esta saída, o gestor fica numa página vazia sem link
  // nenhum de volta.
  test('vazia, oferece o caminho de volta para a lista inteira', () => {
    expect(renderToStaticMarkup(<Lista linhas={[]} />)).toContain('href="/empresas"')
  })
})
