import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('./modal',()=>({ModalFunil:()=>null}))
import { Quadro } from './quadro'
import { detalhesSnapshot } from '@/src/lib/empresa-visual'
test('quadro mostra três etapas e cards essenciais sem busca nem telefone',()=>{
  const empresa={...detalhesSnapshot({razao_social:'Aurora',cidade:'São Paulo'},{tipo:'cadastro',empresaId:'e'}),id:'e',versao:1,situacao:'primeiro_contato' as const,negociacaoId:'a'}
  const html=renderToStaticMarkup(<Quadro usuarioId="teste" linhas={[{id:'a',empresaId:'e',nome:'Aurora',cidade:'São Paulo',etapa:'primeiro_contato',versao:1,empresa}]} />)
  for(const texto of ['Primeiro contato','Em negociação','Proposta enviada','Aurora','São Paulo'])expect(html).toContain(texto)
  expect(html).not.toContain('<input');expect(html).not.toContain('Telefone');expect(html).not.toContain('Venda concluída')
})
