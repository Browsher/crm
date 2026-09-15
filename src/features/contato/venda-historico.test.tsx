import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { LinhaDoTempo } from './linha-do-tempo'
test('venda no histórico informa valor, data e autor mesmo sem observação',()=>{
  const html=renderToStaticMarkup(<LinhaDoTempo contatos={[{id:'venda:1',tipo:'venda_registrada',nota:null,proximoPasso:null,proximoPassoData:null,criadoEm:new Date('2026-01-03T12:00:00Z'),autor:'Vendedor',venda:{centavos:'12550',data:'2026-01-02'}}]} />)
  expect(html).toContain('Venda registrada');expect(html).toContain('125,50');expect(html).toContain('02/01/2026');expect(html).toContain('Vendedor')
})
