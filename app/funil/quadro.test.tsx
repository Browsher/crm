import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('./modal',()=>({ModalFunil:()=>null}))
import { Quadro } from './quadro'
test('quadro mostra três etapas e cards essenciais sem busca nem telefone',()=>{
  const html=renderToStaticMarkup(<Quadro linhas={[{id:'a',empresaId:'e',nome:'Aurora',cidade:'São Paulo',etapa:'primeiro_contato'}]} />)
  for(const texto of ['Primeiro contato','Em negociação','Proposta enviada','Aurora','São Paulo'])expect(html).toContain(texto)
  expect(html).not.toContain('<input');expect(html).not.toContain('Telefone');expect(html).not.toContain('Venda concluída')
})
