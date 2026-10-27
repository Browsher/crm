import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { ResultadosBusca } from './resultados'
import type { BuscaSalva, EmpresaEncontrada } from '@/src/features/busca-empresas/tipos'
vi.mock('./acoes', () => ({ concluirInclusaoAcao: vi.fn(), importarBuscaAcao: vi.fn() }))
const empresa: EmpresaEncontrada = { cnpj: '11222333000181', razao_social: 'Empresa de teste', nome_fantasia: null,
  email: 'loja@exemplo.test', telefone: null, cep: null, cnae_principal: '4742300', situacao: 'ATIVA', porte: 'ME',
  data_abertura: '2020-01-15', logradouro: 'Rua teste', numero: '10', complemento: null,
  bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', telefones: [] }
const busca = { id: '11111111-1111-4111-8111-111111111111', nome: 'Lojas SP', estado: 'concluida', empresas: [empresa], grupo_id: null } as BuscaSalva
test('empresa sem telefone continua visível e não pode ser selecionada para importação', () => {
  const html = renderToStaticMarkup(<ResultadosBusca busca={busca} bloqueada={false} />)
  expect(html).toContain('Empresa de teste')
  expect(html).toContain('loja@exemplo.test')
  expect(html).toContain('Sem telefone válido')
  expect(html).not.toContain('type="checkbox"')
  expect(html).toContain('Ver mais: Empresa de teste')
  expect(html).toContain('aria-expanded="false"')
})
test('pausa impede selecionar resultado mesmo quando há telefone válido', () => {
  const html = renderToStaticMarkup(<ResultadosBusca busca={{ ...busca, empresas: [{ ...empresa, telefone: '11988887777' }] }} bloqueada />)
  expect(html).not.toContain('type="checkbox"')
  expect(html).toMatch(/type="submit"[^>]*disabled=""/)
  expect(html).not.toMatch(/<fieldset[^>]*disabled/)
  expect(html).toContain('Inclusões pausadas pelo gestor')
  expect(html).toContain('Ver mais: Empresa de teste')
})

test('lista já criada mostra inclusão automática e não pede seleção manual',()=>{
 const html=renderToStaticMarkup(<ResultadosBusca busca={{...busca,grupo_id:'grupo',empresas:[{...empresa,telefone:'11988887777'}]}} bloqueada={false}/>)
 expect(html).toContain('automaticamente');expect(html).toContain('Prospectar esta lista')
 expect(html).not.toContain('Importar selecionadas');expect(html).not.toContain('type="checkbox"')
})
