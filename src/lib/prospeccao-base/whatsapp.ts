import type { EstadoWhatsApp, TelefoneBase } from './modelo'
export type RespostaWhatsApp = { statusHTTP: number | null; corpo: unknown; conectado: boolean; falha: string | null }

export function precisaConsultar(t: TelefoneBase): boolean {
  return t.revalidar || t.estado === 'pendente' || t.estado === 'inconclusivo'
}
export function classificarConsulta(numeros: string[], resposta: RespostaWhatsApp, verificadoEm: string): TelefoneBase[] {
  const sucesso = resposta.statusHTTP !== null && resposta.statusHTTP >= 200 && resposta.statusHTTP < 300
  return classificarResposta(numeros, resposta, verificadoEm, sucesso)
}

export function classificarConsultaComunidade(numeros: string[], retorno: unknown, conectado: boolean, verificadoEm: string): TelefoneBase[] {
  const envelope = typeof retorno === 'object' && retorno !== null && !Array.isArray(retorno)
    ? retorno as Record<string, unknown> : null
  const sucesso = envelope?.success === true && !('error' in envelope)
  return classificarResposta(numeros, {
    statusHTTP: null, corpo: sucesso ? envelope.data : null, conectado, falha: sucesso ? null : 'erro_consulta',
  }, verificadoEm, sucesso, 'erro_consulta')
}

function classificarResposta(numeros: string[], resposta: RespostaWhatsApp, verificadoEm: string,
  sucesso: boolean, motivoFalha = 'erro_transporte'): TelefoneBase[] {
  return numeros.map(numero => {
    const correspondentes = Array.isArray(resposta.corpo)
      ? resposta.corpo.filter((r): r is Record<string, unknown> =>
        typeof r === 'object' && r !== null && r.number === numero)
      : []
    const r = correspondentes.length === 1 ? correspondentes[0] : null
    const valido = /^55[0-9]{10,11}$/.test(numero) && resposta.conectado && resposta.falha === null &&
      sucesso &&
      r !== null && typeof r.exists === 'boolean'
    const estado: EstadoWhatsApp = valido ? r!.exists ? 'encontrado' : 'nao_encontrado' : 'inconclusivo'
    const motivo = !valido ? !resposta.conectado ? 'instancia_desconectada'
      : resposta.falha ? motivoFalha
      : !sucesso
        ? 'erro_http' : 'resposta_incompleta' : null
    return {
      numero, tipo: numero.length === 12 ? 'fixo' : 'celular', empresas: [], estado,
      numeroRetornado: r && typeof r.number === 'string' ? r.number : null,
      jid: r && typeof r.jid === 'string' ? r.jid : null,
      verificadoEm, statusHTTP: resposta.statusHTTP, motivo, revalidar: false,
    }
  })
}
