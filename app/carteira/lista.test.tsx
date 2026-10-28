import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import type { FiltrosCarteira } from './filtros'
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

const ENDERECO_SP = {
  cep: '13000000', logradouro: 'Rua A', faixa: null, bairro: 'Centro',
  localidade: 'Campinas', uf: 'SP', ibge: '0000000',
}

describe('ListaCarteira', () => {
  test('com empresas, monta tabela com as próximas ações reais e sem compra fictícia', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[UMA]} />)
    expect(saida).toContain('<table')
    expect(saida).toContain('Aurora Comercio LTDA')
    expect(saida).toContain('Ver cliente')
    expect(saida).toContain('Próximo passo')
    expect(saida).not.toContain('Última compra')
  })

  test('vazia, diz o que fazer em vez de so dizer que esta vazia', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[]} />)
    expect(saida).not.toContain('<ul')
    expect(saida).toContain('Puxar')
  })

  const COM_PASSO = { ...UMA, id: 'a', razaoSocial: 'Alfa', proximoPasso: 'Mandar orçamento', proximoPassoData: '2026-10-01', situacaoRetorno: 'futuro' as const,
    endereco: ENDERECO_SP }
  const VENCIDA = { ...UMA, id: 'b', razaoSocial: 'Beta', proximoPasso: 'Ligar de volta', proximoPassoData: '2026-09-01', situacaoRetorno: 'atrasado' as const, vencido: true }
  const SEM_PASSO = { ...UMA, id: 'c', razaoSocial: 'Gama' }

  test('mostra o proximo passo e a data de cada empresa', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[COM_PASSO]} />)
    expect(saida).toContain('Mandar orçamento')
    expect(saida).toContain('2026-10-01')
  })

  test('marca a vencida com palavra, nao so com cor', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[VENCIDA]} />)
    expect(saida).toContain('Atrasado')
  })

  // NULLS LAST é decisão: empresa sem próximo passo precisa de atenção, mas
  // menos que um combinado vencido. Para não sumir no fim, o grupo é CONTADO e
  // NOMEADO no topo.
  test('o grupo sem proximo passo aparece contado e nomeado', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[COM_PASSO, SEM_PASSO]} />)
    expect(saida).toContain('1 cliente sem próximo passo')
  })

  test('nao mostra o aviso de grupo quando todas tem proximo passo', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[COM_PASSO]} />)
    expect(saida).not.toContain('sem próximo passo')
  })

  test('cada empresa linka para a ficha', () => {
    const filtros = { nome: 'Alfa', uf: 'SP', retorno: 'futuro' } satisfies FiltrosCarteira
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[COM_PASSO]} filtros={filtros} />)
    expect(saida).toContain('/carteira/a?nome=Alfa&amp;uf=SP&amp;retorno=futuro')
  })

  test('mostra contato, localizacao, resumo da ultima conversa e data legivel', () => {
    const nota = 'Uma observação longa '.repeat(15)
    const empresa = {
      ...UMA,
      contatoNome: 'Ana Souza',
      endereco: ENDERECO_SP,
      ultimoContato: { nota, criadoEm: new Date('2026-09-10T15:30:00-03:00') },
    }
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[empresa]} />)
    expect(saida).toContain('Ana Souza')
    expect(saida).toContain('Campinas, SP')
    expect(saida).toContain('10/09/2026')
    expect(saida).toContain(`${nota.slice(0, 179).trimEnd()}…`)
    expect(saida).not.toContain(nota)
  })

  test('explicita ausencias sem inventar contato ou historico', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[UMA]} />)
    expect(saida).toContain('Contato principal não informado')
    expect(saida).toContain('Localização não informada')
    expect(saida).toContain('Ainda não há uma conversa registrada')
  })

  test('distingue filtro sem resultado de carteira vazia e conta filtradas sobre total', () => {
    const filtros = { nome: 'Inexistente', uf: '', retorno: '' } satisfies FiltrosCarteira
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[UMA]} filtros={filtros} />)
    expect(saida).toContain('0 de 1 empresa')
    expect(saida).toContain('Nenhum cliente corresponde aos filtros')
    expect(saida).not.toContain('Sua carteira está vazia')
  })
})

// O contrato do consumidor distingue primeiro uso de recuperação dos filtros.
test('Carteira vazia oferece navegação primária no rodapé do Card', () => {
  const saida = renderToStaticMarkup(<ListaCarteira linhas={[]} filtros={{ nome: 'Inexistente', uf: '', retorno: '' }} />)
  expect(saida).toContain('Sua carteira está vazia')
  expect(saida).toContain('Assuma uma empresa da fila para começar.')
  expect(saida).toContain('data-slot="card-footer"')
  expect(saida).toMatch(/<a[^>]+href="\/fila"[^>]*>Puxar a próxima empresa<\/a>/)
  expect(saida).toContain('data-variant="default"')
  expect(saida).not.toContain('Nenhum cliente corresponde aos filtros')
})

test('Filtro sem resultado preserva filtros e oferece recuperação outline no Card', () => {
  const filtros = { nome: 'Inexistente', uf: '', retorno: '' } satisfies FiltrosCarteira
  const saida = renderToStaticMarkup(<ListaCarteira linhas={[UMA]} filtros={filtros} />)
  expect(saida).toContain('<h3')
  expect(saida).toContain('Nenhum cliente corresponde aos filtros')
  expect(saida).toContain('data-slot="card-footer"')
  expect(saida).toContain('data-variant="outline"')
  expect(saida).toMatch(/<a[^>]+href="\/carteira"[^>]*>Limpar filtros<\/a>/)
  expect(filtros).toEqual({ nome: 'Inexistente', uf: '', retorno: '' })
})

vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'vendedor-sintetico' }) }))
vi.mock('@/src/features/fila/consulta', () => ({ lerMinhasEmpresas: async () => ({ ok: false, motivo: 'sem_permissao' }) }))

test('ficha com consulta recusada apresenta aviso de erro e conserva a mensagem', async () => {
  const { default: PaginaFicha } = await import('./[id]/page')
  const saida = renderToStaticMarkup(await PaginaFicha({ params: Promise.resolve({ id: UMA.id }) }))
  expect(saida).toContain('role="alert"')
  expect(saida).toContain('data-slot="alert"')
  expect(saida).toContain('Você não tem permissão para isso agora. Se acabou de trocar a senha, entre de novo.')
  expect(saida).not.toContain('Sua carteira está vazia')
})

test('registros mantêm caption, cabeçalhos e rótulos de todas as células no celular', () => {
  const saida = renderToStaticMarkup(<ListaCarteira linhas={[{ ...UMA, razaoSocial: 'Nome muito longo '.repeat(30) }]} />)
  expect(saida).toContain('<caption')
  expect(saida).toContain('Clientes da sua carteira')
  expect(saida.match(/scope="col"/g)).toHaveLength(6)
  for (const rotulo of ['Empresa', 'Contato principal', 'Última conversa', 'Próximo passo', 'Retorno', 'Ações']) {
    expect(saida).toContain(`data-label="${rotulo}"`)
  }
  expect(saida).toContain('Contato principal não informado')
  expect(saida).toContain('Localização não informada')
  expect(saida).toContain('Ver cliente')
})
