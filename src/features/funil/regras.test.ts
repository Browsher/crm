import { expect, test } from 'vitest'
import { validarVenda } from './regras'
const base = { valor:'12,34', data:'2026-09-15', observacao:'', chave:'12345678-1234-1234-1234-123456789012' }
test('venda converte reais em centavos exatos e normaliza observação', () => {
  expect(validarVenda({...base,observacao:'  combinado  '})).toEqual({ok:true,dados:{centavos:1234,data:base.data,observacao:'combinado',chave:base.chave}})
  expect(validarVenda({...base,valor:'0,01'})).toMatchObject({ok:true,dados:{centavos:1}})
  expect(validarVenda({...base,valor:'999999999,99'})).toMatchObject({ok:true,dados:{centavos:99999999999}})
})
test('venda recusa valores ambíguos, fora do limite, data impossível e chave inválida', () => {
  for (const valor of ['0','-1','1e3','1.234,56','1,234','Infinity','','1000000000']) expect(validarVenda({...base,valor}).ok,valor).toBe(false)
  for (const data of ['2026-02-30','2026-13-01','0000-01-01','2026-9-15']) expect(validarVenda({...base,data}).ok,data).toBe(false)
  expect(validarVenda({...base,chave:'invalida'}).ok).toBe(false)
  expect(validarVenda({...base,observacao:'a'.repeat(2001)}).ok).toBe(false)
})
