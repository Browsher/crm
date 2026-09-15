export type DadosVenda = { centavos:number; data:string; observacao:string | null; chave:string }
export const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export function validarVenda(r: {valor:string;data:string;observacao:string;chave:string}): {ok:true;dados:DadosVenda} | {ok:false;erro:string} {
  if (!/^\d{1,9}([,.]\d{1,2})?$/.test(r.valor.trim())) return {ok:false,erro:'Informe o valor em reais, sem separador de milhar, até 999999999,99.'}
  const [inteiro,fracao=''] = r.valor.trim().split(/[,.]/)
  const centavos=Number(inteiro)*100+Number(fracao.padEnd(2,'0'))
  if (centavos < 1) return {ok:false,erro:'O valor mínimo é R$ 0,01.'}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data) || r.data.startsWith('0000')) return {ok:false,erro:'Informe uma data válida.'}
  const data = new Date(`${r.data}T12:00:00Z`)
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0,10)!==r.data) return {ok:false,erro:'Informe uma data válida.'}
  if (!UUID.test(r.chave)) return {ok:false,erro:'Reabra o formulário de venda.'}
  if (r.observacao.length>2000 || r.observacao.includes('\0')) return {ok:false,erro:'A observação deve ter até 2.000 caracteres válidos.'}
  return {ok:true,dados:{centavos,data:r.data,observacao:r.observacao.trim() || null,chave:r.chave}}
}
