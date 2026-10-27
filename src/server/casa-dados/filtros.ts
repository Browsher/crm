import type { FiltrosBusca } from '@/src/features/busca-empresas/tipos'
import { lerBanco, type FiltrosBanco } from '@/src/lib/banco-empresas'

type Resultado = { ok: true; pedido: Record<string, unknown> } | { ok: false; erro: string }
const normalizar = (s: string) => s.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const unicos = (v: string[]) => [...new Set(v)]
function localidades(regioes: FiltrosBanco['regioes']): Resultado {
  if (!regioes.length) return { ok: true, pedido: {} }
  const agrupadas = new Map<string, { uf: string; cidade: string; bairros: string[] }>()
  for (const r of regioes) {
    const uf = r.estado.toLowerCase(), cidade = normalizar(r.cidade), bairros = unicos(r.bairros.map(normalizar))
    const chave = uf + '|' + cidade, anterior = agrupadas.get(chave)
    agrupadas.set(chave, { uf, cidade, bairros: anterior ? (!anterior.bairros.length || !bairros.length ? [] : unicos([...anterior.bairros, ...bairros])) : bairros })
  }
  const estadosInteiros = new Set([...agrupadas.values()].filter(r => !r.cidade).map(r => r.uf))
  const linhas = [...agrupadas.values()].filter(r => !r.cidade || !estadosInteiros.has(r.uf))
  const ufs = unicos(linhas.map(r => r.uf))
  if (linhas.every(r => !r.cidade)) return { ok: true, pedido: { uf: ufs } }
  const cidades = unicos(linhas.map(r => r.cidade))
  const regiaoIncompativel = { ok: false as const, erro: 'Separe esta pesquisa por região. A combinação de estados, cidades e bairros escolhida não pode ser aplicada com segurança em uma única busca.' }
  if (linhas.some(r => !r.cidade) || ufs.some(uf => cidades.some(c => !linhas.some(r => r.uf === uf && r.cidade === c)))) return regiaoIncompativel
  const bairros = linhas[0].bairros
  const assinatura = JSON.stringify([...bairros].sort())
  if (linhas.some(r => JSON.stringify([...r.bairros].sort()) !== assinatura)) return regiaoIncompativel
  return { ok: true, pedido: { uf: ufs, municipio: cidades, ...(bairros.length ? { bairro: bairros } : {}) } }
}

export function prepararConsultaCasa(f: FiltrosBusca): Resultado {
  if (!Number.isSafeInteger(f.quantidade) || f.quantidade < 1 || f.quantidade > 100 || !Number.isSafeInteger(f.offset) || f.offset < 0 || f.offset > 1_000_000 || f.offset % f.quantidade !== 0) return { ok: false, erro: 'Escolha uma página válida para a quantidade de empresas solicitada.' }
  const a = f.avancados
  if (a && !lerBanco(a).ok) return { ok: false, erro: 'Confira os filtros da pesquisa.' }
  const palavras = a?.palavras ?? (f.palavra ? [f.palavra] : [])
  const cnaes = a?.cnaes ?? (f.cnae ? [f.cnae] : [])
  const atividades = a?.atividadeTipo ?? ['principal']
  const regioes = a?.regioes ?? [{ estado: f.uf as FiltrosBanco['regioes'][number]['estado'], cidade: f.cidade, bairros: f.bairro ? [f.bairro] : [] }]
  const geo = localidades(regioes)
  if (!geo.ok) return geo
  const portes = a?.portes ?? (f.porte ? [f.porte] : [])
  if (portes.includes('MEI') && portes.length > 1) return { ok: false, erro: 'Pesquise MEI separadamente dos demais portes.' }
  if (a?.regimes.some(r => r !== 'Simples Nacional')) return { ok: false, erro: 'A Casa dos Dados permite filtrar Simples Nacional. Os demais regimes não estão disponíveis nesta busca.' }
  const contato = a?.contato ?? f.contato
  if (contato === 'telefoneoucelularouemail') return { ok: false, erro: 'Escolha telefone, celular, email ou uma combinação com email. A opção telefone ou email não está disponível nesta busca.' }
  const qualidade: Record<string, boolean> = { excluir_empresas_visualizadas: true }
  if (['celular', 'celulareemail', 'telefone', 'telefoneoucelular', 'telefoneoucelulareemail'].includes(contato)) qualidade.com_telefone = true
  if (['email', 'celulareemail', 'telefoneoucelulareemail'].includes(contato)) qualidade.com_email = true
  if (contato === 'telefone') qualidade.somente_fixo = true
  if (['celular', 'celulareemail'].includes(contato)) qualidade.somente_celular = true
  if (a?.semEmailContabil) qualidade.excluir_email_contab = true
  const pedido: Record<string, unknown> = { limite: f.quantidade, pagina: f.offset / f.quantidade + 1, ...geo.pedido, mais_filtros: qualidade }
  if (palavras.length) pedido.busca_textual = [{ texto: palavras, tipo_busca: 'radical', razao_social: true, nome_fantasia: true, nome_socio: false }]
  if (cnaes.length) {
    if (atividades.includes('principal')) { pedido.codigo_atividade_principal = cnaes; pedido.incluir_atividade_secundaria = atividades.includes('secundaria') }
    else pedido.codigo_atividade_secundaria = cnaes
  }
  if (a?.naturezas.length) pedido.codigo_natureza_juridica = a.naturezas
  const situacoes = a?.situacoes ?? ['ativa']
  if (situacoes.length) pedido.situacao_cadastral = situacoes.map(s => s.toUpperCase())
  const tipos = a?.tipos ?? (f.tipo ? [f.tipo] : [])
  if (tipos.length === 1) pedido.matriz_filial = tipos[0] === '2' ? 'MATRIZ' : 'FILIAL'
  if (portes.includes('MEI')) pedido.mei = { optante: true }
  else if (portes.length) pedido.porte_empresa = { codigos: portes.map(p => ({ ME: '01', EPP: '03', DEMAIS: '05' })[p as 'ME' | 'EPP' | 'DEMAIS']) }
  if (a?.regimes.includes('Simples Nacional')) pedido.simples = { optante: true }
  if (a?.ddds.length) pedido.ddd = a.ddds
  if (a && (a.capitalMinimo || a.capitalMaximo)) pedido.capital_social = { ...(a.capitalMinimo ? { minimo: Number(a.capitalMinimo) } : {}), ...(a.capitalMaximo ? { maximo: Number(a.capitalMaximo) } : {}) }
  if (a && (a.aberturaDe || a.aberturaAte)) pedido.data_abertura = { ...(a.aberturaDe ? { inicio: a.aberturaDe } : {}), ...(a.aberturaAte ? { fim: a.aberturaAte } : {}) }
  return { ok: true, pedido }
}
