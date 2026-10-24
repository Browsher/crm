import { revalidatePath } from 'next/cache'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { autorizarAgente } from '@/src/server/google/autenticacao'
import { lerComando } from '@/src/server/google/protocolo'
import { sincronizarPedido } from '@/src/server/google/planilha/sincronizar'

export async function POST(request: Request) {
  const acesso = autorizarAgente(request.headers.get('authorization'), { token: process.env.GOOGLE_AGENTE_TOKEN, usuarioId: process.env.GOOGLE_AGENTE_USUARIO_ID })
  const responder = (dados: unknown, status = 200) => Response.json(dados, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!acesso.ok) return responder({ erro: acesso.status === 503 ? 'Integração do agente não configurada.' : 'Acesso não autorizado.' }, acesso.status)
  const entrada = await lerComando(request)
  if (!entrada.ok) return responder({ erro: 'Comando inválido ou excessivo.' }, entrada.status)
  const repo = repositorioGoogle(acesso.usuarioId)
  const comando = entrada.comando
  try {
    if (comando.acao === 'proximo') {
      let r = await repo.proximo(comando.executor)
      if (r.sincronizar) {
        const sync = await sincronizarPedido(r.sincronizar)
        if (sync.estado === 'sincronizado') r = await repo.proximo(comando.executor)
        else return responder({...r,aviso:sync.motivo})
      }
      return responder(r)
    }
    if (comando.acao === 'reservar_lote') return responder({ lote: await repo.reservarLote(comando.pedido, comando.executor, comando.lote) })
    if (comando.acao === 'etapa') await repo.etapa(comando.pedido, comando.estado, comando.motivo, comando.executor)
    const resultado = comando.acao === 'entregar' ? await repo.entregar(comando.pedido, comando.empresas, comando.recibo, comando.executor)
      : comando.acao === 'concluir' ? await repo.concluir(comando.pedido, comando.executor, comando.motivo) : 'ok'
    await sincronizarPedido(comando.pedido)
    revalidatePath('/fila/google')
    revalidatePath('/fila/buscar')
    revalidatePath('/empresas/google')
    return responder({ resultado })
  } catch (erro) {
    const codigo = (erro as { code?: string }).code
    if (codigo === '42501') return responder({ erro: 'Acesso do agente indisponível.' }, 403)
    if (codigo === '22023' || codigo === '23514' || codigo === '55000') return responder({ erro: 'Pedido ou publicação divergente. Reconcilie o mesmo lote.' }, 409)
    return responder({ erro: 'Retorno não confirmado. Reconcilie o mesmo pedido antes de continuar.' }, 503)
  }
}
