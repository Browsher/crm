// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { CardEmpresa } from './card-empresa'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove() })
const empresa: ResumoEmpresa = { referencia: { tipo: 'cadastro', empresaId: 'id' }, id: 'id', nome: 'Nome muito comprido '.repeat(20), cnpj: null, cnae: null, atividade: null, bairro: null, cidade: null, uf: null, origens: ['google'], recebidaEm: null, situacao: 'sem_interesse', versao: 42, negociacaoId: null }
test('nome completo, ausências e rótulo centralizado; callbacks recebem referência e versão opaca', async () => {
  const ver = vi.fn(), acionar = vi.fn()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<CardEmpresa empresa={empresa} aoVer={ver} aoAcionar={acionar} />))
  expect(host.querySelector('h3')?.textContent).toBe(empresa.nome)
  expect(host.textContent).toContain('Não informado')
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Ver empresa')!.click())
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Retomar atendimento')!.click())
  expect(ver).toHaveBeenCalledWith(empresa.referencia)
  expect(acionar).toHaveBeenCalledWith({ tipo: 'retomar', rotulo: 'Retomar atendimento', empresaId: 'id', versao: 42 })
  await act(async () => root.render(<CardEmpresa empresa={{ ...empresa, id: null, versao: null, referencia: { tipo: 'busca', buscaId: 'busca', cnpj: '12345678000199' } }} aoVer={ver} aoAcionar={acionar} />))
  expect(host.querySelectorAll('button')).toHaveLength(1)
})

test('composição informativa não renderiza comandos mesmo com versão recebida; responsável é metadado', async()=>{
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  const ver=vi.fn()
  await act(async()=>root.render(<CardEmpresa empresa={empresa} responsavel={{id:'dono',nome:'Ana',ativo:false}} aoVer={ver} />))
  expect(host.textContent).toContain('Ana')
  expect(host.textContent).toContain('Inativo')
  expect(host.textContent).not.toContain('Retomar atendimento')
  expect(host.querySelectorAll('button')).toHaveLength(1)
  await act(async()=>host.querySelector('button')!.click())
  expect(ver).toHaveBeenCalledWith(empresa.referencia)
})
