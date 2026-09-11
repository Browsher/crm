import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import { ListaCarteira } from './lista'

const UMA: EmpresaComigo = {
  id: '11111111-1111-4111-8111-111111111111',
  cnpj: '11222333000181',
  razaoSocial: 'Aurora Comercio LTDA',
  nomeFantasia: null,
  contatoNome: null,
  telefone: '11987654321',
  email: null,
  cep: null,
  endereco: null,
  reservadoAte: null,
  posse: true,
  proximoPasso: null,
  proximoPassoData: null,
  cnaePrincipal: null,
  ultimoContato: null,
  situacaoRetorno: 'sem_data',
  vencido: false,
}

describe('ListaCarteira', () => {
  test('com empresas, monta uma lista', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[UMA]} />)
    expect(saida).toContain('<ul')
    expect(saida).toContain('Aurora Comercio LTDA')
  })

  test('vazia, diz o que fazer em vez de so dizer que esta vazia', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[]} />)
    expect(saida).not.toContain('<ul')
    expect(saida).toContain('Puxar')
  })

  const COM_PASSO = { ...UMA, id: 'a', razaoSocial: 'Alfa', proximoPasso: 'Mandar orçamento', proximoPassoData: '2026-10-01' }
  const VENCIDA = { ...UMA, id: 'b', razaoSocial: 'Beta', proximoPasso: 'Ligar de volta', proximoPassoData: '2026-09-01', vencido: true }
  const SEM_PASSO = { ...UMA, id: 'c', razaoSocial: 'Gama' }

  test('mostra o proximo passo e a data de cada empresa', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[COM_PASSO]} />)
    expect(saida).toContain('Mandar orçamento')
    expect(saida).toContain('2026-10-01')
  })

  test('marca a vencida com palavra, nao so com cor', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[VENCIDA]} />)
    expect(saida).toContain('vencido')
  })

  // NULLS LAST é decisão: empresa sem próximo passo precisa de atenção, mas
  // menos que um combinado vencido. Para não sumir no fim, o grupo é CONTADO e
  // NOMEADO no topo.
  test('o grupo sem proximo passo aparece contado e nomeado', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[COM_PASSO, SEM_PASSO]} />)
    expect(saida).toContain('1 sem próximo passo')
  })

  test('nao mostra o aviso de grupo quando todas tem proximo passo', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[COM_PASSO]} />)
    expect(saida).not.toContain('sem próximo passo')
  })

  test('cada empresa linka para a ficha', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[COM_PASSO]} />)
    expect(saida).toContain('/carteira/a')
  })
})
