import { usuarioAtual } from '@/src/server/autenticacao/guarda'
import { avaliarAcesso } from '@/src/server/autenticacao/acesso'
import { lerMidia } from '@/src/server/whatsapp/midia'

export const runtime = 'nodejs'
const privados = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const erro = (status: number, motivo: string) => Response.json({ ok: false, motivo }, { status, headers: privados })
  try {
    const acesso = avaliarAcesso(await usuarioAtual(), 'gestor')
    if (!acesso.ok) return erro(acesso.motivo === 'sem_sessao' ? 401 : 403, 'acesso_negado')
    const { id } = await params
    const conversa = new URL(request.url).searchParams.get('conversa') ?? ''
    if (!/^[\w-]{1,200}$/.test(id) || !/^[\w.:-]{1,200}@(lid|s\.whatsapp\.net|g\.us)$/.test(conversa)) return erro(400, 'pedido_invalido')
    const midia = await lerMidia(id, conversa)
    if (!midia.ok) return erro(midia.motivo === 'muito_grande' ? 413 : midia.motivo === 'nao_encontrada' ? 404 : 503, midia.motivo)
    return new Response(new Uint8Array(midia.bytes), { headers: {
      ...privados,
      'Content-Type': midia.tipo,
      'Content-Length': String(midia.bytes.byteLength),
      'Content-Disposition': `${midia.documento ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(midia.nome).replace(/'/g, '%27')}`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } })
  } catch { return erro(503, 'indisponivel') }
}
