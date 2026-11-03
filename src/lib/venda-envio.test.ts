// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { criarComandoVenda, lerComandoVenda, persistirComandoVenda, limparVendaConfirmada, formularioVenda } from './venda-envio'
const entrada={valor:'125,50',data:'2026-01-01',observacao:'Original'}
const comando=()=>criarComandoVenda('ator','empresa',{tipo:'primeira',negociacaoId:'ciclo'},entrada)
afterEach(()=>{sessionStorage.clear();vi.restoreAllMocks()})
test('persistência conserva identidade, tipo e entrada congelada depois de reload, sem trocar chave',()=>{
 const c=comando();persistirComandoVenda(c);entrada.observacao='Outra nota'
 const restaurado=lerComandoVenda('ator')!
 expect(restaurado).toEqual(c);expect(restaurado.entrada.observacao).toBe('Original')
 expect([...formularioVenda(restaurado).entries()]).toContainEqual(['id','ciclo'])
 expect(lerComandoVenda('outro')).toBeNull();entrada.observacao='Original'
})
test('comando posterior ou de outro ator não é removido pela confirmação antiga',()=>{
 const antigo=comando();persistirComandoVenda(antigo)
 expect(limparVendaConfirmada({...antigo,chave:'outra'})).toBe(false)
 expect(()=>persistirComandoVenda({...antigo,chave:'outra'})).toThrow(/envio anterior/)
 expect(limparVendaConfirmada(antigo)).toBe(true)
 const novo=comando();persistirComandoVenda(novo)
 expect(limparVendaConfirmada(antigo)).toBe(false);expect(lerComandoVenda('ator')).toEqual(novo)
 const outro=criarComandoVenda('outro','outra',{tipo:'recompra'},entrada);persistirComandoVenda(outro)
 limparVendaConfirmada(novo);expect(lerComandoVenda('outro')).toEqual(outro)
})
test('storage inválido ou comando de outro ator nunca é sobrescrito',()=>{
 sessionStorage.setItem('crm:venda:v1:ator','quebrado')
 expect(()=>persistirComandoVenda(comando())).toThrow()
 sessionStorage.setItem('crm:venda:v1:ator',JSON.stringify({...comando(),usuarioId:'outro'}))
 expect(()=>lerComandoVenda('ator')).toThrow()
})
