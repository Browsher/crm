import { normalizarCnpj } from '../../features/empresas/cnpj'
import { analisarPlanilha, CABECALHO_GOOGLE, type LinhaAceita } from '../../features/empresas/planilha'
import { normalizarTelefone } from '../../features/empresas/telefone'
import { normalizarCep } from '../cep/resolver'

export type FonteMooca = {
  nome_empresa: string
  cnpj: string
  razao_social: string
  telefone: string
  email: string
  cep: string
  place_id: string
  termo_pesquisado: string
  fontes_email: string
  fontes_conferencia: string
  observacoes: string
}
export type PendenciaMooca = { placeId: string; nome: string; motivo: string }
type RastreioMooca = {
  placeId: string
  fontes: string
  emailsOriginais: string
  emailEscolhido: string | null
  observacoes: string
  fontesEmail: string
  termoPesquisado: string
  avisos: string[]
  outrosPlaceIdsComTelefone: string[]
}
export type AdaptacaoMooca = { csv: string; pendencias: PendenciaMooca[]; rastreio: RastreioMooca[] }

const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`
const csvDe = (linhas: string[][]) => CABECALHO_GOOGLE + '\n' + linhas.map(l => l.map(escapar).join(',')).join('\n') + (linhas.length ? '\n' : '')
const camposDe = (l: LinhaAceita) => [l.cnpj ?? '', l.razaoSocial ?? '', l.nomeFantasia ?? '', l.contatoNome ?? '', l.telefone, l.email ?? '', l.cep ?? '', l.cnaePrincipal ?? '', l.googlePlaceId ?? '']

export function adaptarMooca(linhas: FonteMooca[]): AdaptacaoMooca {
  const pendencias: PendenciaMooca[] = []
  const rastreio = linhas.map(l => ({
    placeId: l.place_id, fontes: l.fontes_conferencia, emailsOriginais: l.email,
    // Só a coluna conferida pode fornecer contato. Nunca recorrer ao motor.
    emailEscolhido: l.email.split(/[;|,\s]+/).map(e => e.toLowerCase())
      .find(e => /^[^\s@]+@[^\s@]+$/.test(e) && e !== 'example@gmail.com') ?? null,
    observacoes: l.observacoes, fontesEmail: l.fontes_email, termoPesquisado: l.termo_pesquisado,
    avisos: [] as string[], outrosPlaceIdsComTelefone: [] as string[],
  }))
  const candidatas: { fonte: FonteMooca; campos: string[]; indice: number }[] = []
  const pendente = (l: FonteMooca, motivo: string) => pendencias.push({ placeId: l.place_id, nome: l.nome_empresa, motivo })
  for (const [indice, l] of linhas.entries()) {
    const cadastrais = [l.cnpj, l.razao_social, l.nome_empresa, l.telefone, l.email, l.cep, l.place_id]
    if (cadastrais.some(v => /[\u0000-\u001f\u007f-\u009f]/u.test(v))) {
      pendente(l, 'caractere_invalido')
      continue
    }
    const telefone = normalizarTelefone(l.telefone)
    if (telefone === null) {
      pendente(l, l.telefone.trim() ? 'telefone_invalido' : 'telefone_ausente')
      continue
    }
    candidatas.push({ fonte: l, indice, campos: [
      l.cnpj ? normalizarCnpj(l.cnpj) ?? l.cnpj : '', l.razao_social, l.nome_empresa,
      '', telefone, rastreio[indice].emailEscolhido ?? '', l.cep ? normalizarCep(l.cep) ?? l.cep : '', '', l.place_id,
    ] })
  }
  if (!candidatas.length) return { csv: csvDe([]), pendencias, rastreio }

  // A autoridade da preparação é o mesmo parser usado na conferência do CRM.
  // Inclusive IDs/CNPJs repetidos: nenhuma das duas linhas é escolhida.
  const analise = analisarPlanilha(new TextEncoder().encode(csvDe(candidatas.map(l => l.campos))))
  if (!analise.ok) {
    for (const l of candidatas) pendente(l.fonte, analise.falha.motivo)
    return { csv: csvDe([]), pendencias, rastreio }
  }
  for (const recusa of analise.recusadas) {
    const l = candidatas[recusa.linha - 2]
    pendente(l.fonte, recusa.tipo === 'repetido' ? `${recusa.identificador}_repetido` : recusa.motivo)
  }
  const porTelefone = new Map<string, LinhaAceita[]>()
  for (const l of analise.aceitas) {
    const grupo = porTelefone.get(l.telefone) ?? []
    grupo.push(l)
    porTelefone.set(l.telefone, grupo)
  }
  for (const grupo of porTelefone.values()) {
    if (grupo.length < 2) continue
    for (const l of grupo) {
      const candidata = candidatas[l.linha - 2]
      pendente(candidata.fonte, 'aviso_telefone_compartilhado')
      const r = rastreio[candidata.indice]
      r.avisos.push('aviso_telefone_compartilhado')
      r.outrosPlaceIdsComTelefone = grupo.filter(outra => outra !== l).map(outra => outra.googlePlaceId ?? '')
    }
  }
  return { csv: csvDe(analise.aceitas.map(camposDe)), pendencias, rastreio }
}
