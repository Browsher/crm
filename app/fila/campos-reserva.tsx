import type { Filtros } from '@/src/features/prospeccao/tipos'
export function CamposReserva({ filtros, contexto }: { filtros: Filtros; contexto: string | null }) {
  return <>
    <input type="hidden" name="contexto" value={contexto ?? ''} />
    {(['nome','cnae','uf','cidade','bairro'] as const).map(k => <input key={k} type="hidden" name={k} value={filtros[k] ?? ''} />)}
  </>
}
