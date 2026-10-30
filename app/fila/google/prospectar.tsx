import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
import { Cartao } from '../cartao'
export function ProspectarGoogle({ empresa }: { empresa: ResumoEmpresa }) {
  return <Cartao empresa={empresa} filtros={{ origem: 'google' }} />
}