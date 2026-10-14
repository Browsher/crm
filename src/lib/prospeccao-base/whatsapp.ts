import type { EstadoWhatsApp, TelefoneBase } from './modelo'
export type RespostaWhatsApp = { statusHTTP: number | null; corpo: unknown; conectado: boolean; falha: string | null }

export function precisaConsultar(t: TelefoneBase): boolean {
  return t.revalidar || t.estado === 'pendente' || t.estado === 'inconclusivo'
}
export function classificarConsulta(numeros: string[], resposta: RespostaWhatsApp, verificadoEm: string): TelefoneBase[] {
  return numeros.map(numero => {
    const correspondentes = Array.isArray(resposta.corpo)
      ? resposta.corpo.filter((r): r is Record<string, unknown> =>
        typeof r === 'object' && r !== null && r.number === numero)
      : []
    const r = correspondentes.length === 1 ? correspondentes[0] : null
    const valido = /^55[0-9]{10,11}$/.test(numero) && resposta.conectado && resposta.falha === null &&
      resposta.statusHTTP !== null && resposta.statusHTTP >= 200 && resposta.statusHTTP < 300 &&
      r !== null && typeof r.exists === 'boolean'
    const estado: EstadoWhatsApp = valido ? r!.exists ? 'encontrado' : 'nao_encontrado' : 'inconclusivo'
    const motivo = !valido ? !resposta.conectado ? 'instancia_desconectada'
      : resposta.falha ? 'erro_transporte'
      : resposta.statusHTTP === null || resposta.statusHTTP < 200 || resposta.statusHTTP >= 300
        ? 'erro_http' : 'resposta_incompleta' : null
    return {
      numero, tipo: numero.length === 12 ? 'fixo' : 'celular', empresas: [], estado,
      numeroRetornado: r && typeof r.number === 'string' ? r.number : null,
      jid: r && typeof r.jid === 'string' ? r.jid : null,
      verificadoEm, statusHTTP: resposta.statusHTTP, motivo, revalidar: false,
    }
  })
}
