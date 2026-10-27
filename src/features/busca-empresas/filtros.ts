import type { FiltrosBusca } from './tipos'
import { lerBanco } from '@/src/lib/banco-empresas'

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const
const CONTROLE = /[\u0000-\u001f\u007f-\u009f]/u
export function validarFiltros(entrada: Record<string, unknown>): { ok: true; filtros: FiltrosBusca } | { ok: false; motivo: 'filtros_invalidos' } {
  if(entrada.avancados!==undefined) {
    const r=lerBanco(entrada.avancados)
    const quantidade=String(entrada.quantidade??'10'),offset=String(entrada.offset??'0')
    if(!r.ok||!/^[0-9]{1,3}$/.test(quantidade)||Number(quantidade)<1||Number(quantidade)>100||!/^[0-9]{1,7}$/.test(offset)||Number(offset)>1000000) return {ok:false,motivo:'filtros_invalidos'}
    const f=r.filtros,regiao=f.regioes[0]
    return {ok:true,filtros:{palavra:f.palavras.join(', ').slice(0,100),cnae:f.cnaes[0]||f.cnaesSecundarios?.[0]||'',uf:regiao?.estado||'',cidade:regiao?.cidade||'',bairro:regiao?.bairros[0]||'',porte:'',tipo:'',contato:'telefoneoucelular',quantidade:Number(quantidade),offset:Number(offset),avancados:f}}
  }
  const texto = (campo: string) => typeof entrada[campo] === 'string' ? entrada[campo].trim() : ''
  const palavra = texto('palavra')
  const brutoCnae = texto('cnae')
  const cnae = brutoCnae.replace(/[.\s/-]/g, '')
  const uf = texto('uf').toUpperCase()
  const cidade = texto('cidade')
  const bairro = texto('bairro')
  const porte = texto('porte')
  const tipo = texto('tipo')
  const contato = texto('contato') || 'telefoneoucelular'
  const quantidadeBruta = String(entrada.quantidade ?? '10')
  const offsetBruto = String(entrada.offset ?? '0')
  const quantidade = Number(quantidadeBruta)
  const offset = Number(offsetBruto)
  if ([palavra, brutoCnae, uf, cidade, bairro, porte, tipo, contato].some(v => CONTROLE.test(v)) ||
    palavra.length > 100 || cidade.length > 100 || bairro.length > 100 || brutoCnae.length > 20 ||
    (cnae !== '' && !/^[0-9]{7}$/.test(cnae)) || (!palavra && !cnae) ||
    !(UFS as readonly string[]).includes(uf) || (bairro !== '' && cidade === '') ||
    !['','MEI','ME','EPP','DEMAIS'].includes(porte) || !['','1','2'].includes(tipo) ||
    !['telefoneoucelular','telefoneoucelulareemail','email','telefoneoucelularouemail'].includes(contato) ||
    !/^[0-9]+$/.test(quantidadeBruta) || quantidade < 1 || quantidade > 100 ||
    !/^[0-9]+$/.test(offsetBruto) || !Number.isSafeInteger(offset) || offset > 1_000_000) {
    return { ok: false, motivo: 'filtros_invalidos' }
  }
  return { ok: true, filtros: { palavra, cnae, uf, cidade, bairro, porte: porte as FiltrosBusca['porte'],
    tipo: tipo as FiltrosBusca['tipo'], contato: contato as FiltrosBusca['contato'], quantidade, offset } }
}
