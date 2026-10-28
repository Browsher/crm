import type { Filtros } from '@/src/features/prospeccao/tipos'
export function CamposReserva({ filtros, contexto }: { filtros: Filtros; contexto: string | null }) {
  return <>
    <input type="hidden" name="contexto" value={contexto ?? ''} />
    {filtros.pessoal && <input type="hidden" name="pessoal" value={filtros.pessoal}/>}
    {(['nome','cnae','uf','cidade','bairro','grupo'] as const).map(k => <input key={k} type="hidden" name={k} value={filtros[k] ?? ''} />)}
  </>
}
