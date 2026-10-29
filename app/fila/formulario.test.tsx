import { expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('./cartao',()=>({Cartao:()=> <p>Dados</p>}))
vi.mock('@/src/features/contato/formulario',()=>({FormularioContato:({somenteConfirmacao}:{somenteConfirmacao:boolean})=> somenteConfirmacao ? null : <form aria-label="Contato"/>}))
import { Formulario } from './formulario'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
const empresa:ResumoEmpresa={referencia:{tipo:'cadastro',empresaId:'A'},id:'A',nome:'Aurora',cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['banco'],recebidaEm:null,situacao:'atendimento',versao:2,negociacaoId:null}
test('atendimento mostra registro e histórico sem prazo ou próxima empresa',()=>{
  const html=renderToStaticMarkup(<Formulario empresa={empresa} fase="inicial" filtros={{}} contatos={[]}/>)
  expect(html).toContain('aria-label="Contato"');expect(html).not.toMatch(/30 minutos|Próxima|Puxar|reserva/)
})
test.each(['a_contatar','sem_interesse','indisponivel'] as const)('%s não habilita registro até ação explícita',situacao=>{
  const html=renderToStaticMarkup(<Formulario empresa={{...empresa,situacao}} fase="inicial" filtros={{}} contatos={[]}/>)
  expect(html).not.toContain('<form')
})
