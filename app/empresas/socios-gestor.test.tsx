import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
const mocks=vi.hoisted(()=>({exigir:vi.fn(),sql:vi.fn()}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:mocks.exigir}))
vi.mock('@/src/server/db/como-usuario',()=>({comoUsuario:async(_id:string,fn:(s:typeof mocks.sql)=>unknown)=>fn(mocks.sql)}))
import { SociosGestor } from './socios-gestor'
import { DetalhesBancoEmpresa } from '@/src/components/crm/detalhes-banco'
test('componente exclusivo exige gestor antes de consultar documentos',async()=>{
  mocks.exigir.mockRejectedValueOnce(new Error('sem permissão'))
  await expect(SociosGestor({buscaId:'11111111-1111-4111-8111-111111111111'})).rejects.toThrow('sem permissão')
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  expect(mocks.sql).not.toHaveBeenCalled()
})
test('documentos aparecem apenas no componente do gestor, nunca no componente compartilhado',async()=>{
  const socio={nome:'Sócio fictício',cnpj_cpf_socio:'***111222**',funcao:{descricao:'Administrador'},representante_legal:{nome:'Representante fictício',cpf:'***333444**'}}
  mocks.exigir.mockResolvedValueOnce({usuarioId:'gestor'})
  mocks.sql.mockResolvedValueOnce({linhas:[{cnpj:'11222333000181',dados:[socio]}]})
  const exclusivo=renderToStaticMarkup(await SociosGestor({buscaId:'11111111-1111-4111-8111-111111111111'}))
  expect(exclusivo).toContain('111222')
  const compartilhado=renderToStaticMarkup(<dl><DetalhesBancoEmpresa dados={{socios:[socio]}}/></dl>)
  expect(compartilhado).toContain('Sócio fictício')
  expect(compartilhado).toContain('Administrador')
  expect(compartilhado).not.toContain('111222')
  expect(compartilhado).not.toContain('Representante fictício')
})
