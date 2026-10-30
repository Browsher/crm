import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import type { ResumoEmpresaGestor } from '@/src/lib/empresa-visual'
import { Lista } from './lista'

const UMA: EmpresaNaLista & ResumoEmpresaGestor = {
  referencia: { tipo: 'cadastro', empresaId: '11111111-1111-4111-8111-111111111111' },
  nome: 'Iluminação São João', cnae: '4742300', atividade: null, bairro: null, cidade: null,
  origens: ['banco'], recebidaEm: null, situacao: 'atendimento', versao: null, negociacaoId: null,
  responsavel: { id: 'vendedor', nome: 'Ana', ativo: true },
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
    expect(saida).toContain('data-slot="card"')
    expect(saida).not.toContain('<table')
    expect(saida).toContain('aria-label="Empresas cadastradas"')
    for (const campo of ['Localização', 'CNAE', 'Atividade', 'Origem', 'Recebida em', 'Em atendimento', 'Ana', 'Ver empresa', 'Ficha administrativa']) expect(saida).toContain(campo)
    expect(saida).not.toContain('Iniciar atendimento')
    expect(saida).not.toContain('Retomar atendimento')
    expect(saida).not.toContain('Continuar atendimento')
    expect(saida).toContain('Iluminação São João')
  })

  test('responsável inativo explícito e ficha preserva o contexto da busca', () => {
    const saida = renderToStaticMarkup(<Lista linhas={[{ ...UMA, responsavel: { id: 'vendedor', nome: 'Ana', ativo: false } }]} consulta={{ termo: 'Luz', padrao: 'Luz', cnpjPrefixo: null, pagina: 2, cnae: null, uf: 'SP', cidade: null, bairro: null }} />)
    expect(saida).toContain('Inativo')
    expect(saida).toContain('pagina=2')
    expect(saida).toContain('uf=SP')
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
