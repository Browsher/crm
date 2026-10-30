import { randomUUID } from 'node:crypto'
import type { EntradaContato } from '@/src/lib/atendimento'
import { registrarContatoDireto } from '@/src/server/atendimento/operacoes'
import type { BancoDeTeste } from '../ajuda'

export async function contatoDireto(banco:BancoDeTeste, usuarioId:string, empresaId:string, entrada:EntradaContato) {
  const [v]=await banco.sql<{versao:number}>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1',[empresaId])
  return registrarContatoDireto(usuarioId,{empresaId,chave:randomUUID(),versao:v?.versao??1},entrada)
}
