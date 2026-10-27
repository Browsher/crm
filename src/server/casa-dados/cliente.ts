import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { normalizarCnpj, validarCnpj } from '@/src/lib/cnpj'
import type { SocioBanco, DetalhesBanco } from '@/src/lib/banco-empresas'
import type { ClienteBusca, EmpresaEncontrada, FalhaFornecedor, FiltrosBusca, ResultadoFornecedor } from '@/src/features/busca-empresas/tipos'
import { prepararConsultaCasa } from './filtros'

const URL_PESQUISA = 'https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=completo'
const MAX_BYTES = 2_000_000
const texto = z.string().max(1000).nullable().optional()
const atividade = z.object({ codigo: texto, descricao: texto })
const socio = z.object({ nome: texto, qualificacao_socio: texto,
  qualificacao_socio_codigo: z.union([z.number().int(), z.string().max(20)]).nullable().optional(),
  documento: texto, data_entrada_sociedade: texto, pais_socio: texto,
  nome_representante_legal: texto, cpf_representante_legal: texto, faixa_etaria_descricao: texto })
const schemaEmpresa = z.object({
  cnpj: z.string().max(30), razao_social: z.string().min(1).max(500), nome_fantasia: texto,
  data_abertura: texto, capital_social: z.number().finite().nonnegative().nullable().optional(),
  porte_empresa: z.object({ codigo: texto, descricao: texto }).nullable().optional(),
  situacao_cadastral: z.object({ situacao_atual: texto, situacao_cadastral: texto }).nullable().optional(),
  codigo_natureza_juridica: texto, descricao_natureza_juridica: texto,
  endereco: z.object({ cep: texto, tipo_logradouro: texto, logradouro: texto, numero: texto,
    complemento: texto, bairro: texto, uf: texto, municipio: texto }).nullable().optional(),
  atividade_principal: atividade.nullable().optional(), atividade_secundaria: z.array(atividade).max(100).nullable().optional(),
  mei: z.object({ optante: z.boolean() }).nullable().optional(), simples: z.object({ optante: z.boolean() }).nullable().optional(),
  bloqueado: z.boolean().optional(),
  contato_telefonico: z.array(z.object({ completo: texto, ddd: texto, numero: texto })).max(30).nullable().optional(),
  contato_email: z.array(z.object({ email: texto, valido: z.boolean().nullable().optional() })).max(30).nullable().optional(),
  quadro_societario: z.array(socio).max(100).nullable().optional(),
})
const limpar = (v?: string | null) => {
  const s = v?.trim()
  return s && !/[\u0000-\u001f\u007f-\u009f]/u.test(s) ? s : null
}
const telefone = (v?: string | null) => {
  let s = limpar(v)?.replace(/[\s()+.-]/g, '') ?? ''
  if (/^55[0-9]{10,11}$/.test(s)) s = s.slice(2)
  return /^[1-9][0-9]{9,10}$/.test(s) ? s : null
}
const data = (v?: string | null) => {
  const s = limpar(v)?.slice(0, 10)
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s ? s : null
}
const cnae = (v?: string | null) => {
  const s = limpar(v)?.replace(/[.\s/-]/g, '') ?? ''
  return /^[0-9]{7}$/.test(s) ? s : null
}
function normalizar(bruto: z.infer<typeof schemaEmpresa>, incluirSocios: boolean): EmpresaEncontrada | null {
  const cnpj = normalizarCnpj(bruto.cnpj), razao = limpar(bruto.razao_social)
  if (!cnpj || !validarCnpj(cnpj) || !razao || bruto.bloqueado) return null
  const telefones = [...new Set((bruto.contato_telefonico ?? []).map(t => telefone((t.ddd ?? '') + (t.numero ?? '')) ?? telefone(t.completo)).filter((t): t is string => t !== null))]
  const email = (bruto.contato_email ?? []).filter(e => e.valido !== false).map(e => limpar(e.email)?.toLowerCase()).find(e => e && /^[^\s@]+@[^\s@]+$/.test(e)) ?? null
  const e = bruto.endereco, cep = limpar(e?.cep)?.replace(/[.\s-]/g, '') ?? ''
  const socios: SocioBanco[] = (bruto.quadro_societario ?? []).map(s => ({ nome: limpar(s.nome),
    funcao: { codigo: s.qualificacao_socio_codigo == null ? null : String(s.qualificacao_socio_codigo), descricao: limpar(s.qualificacao_socio) },
    cnpj_cpf_socio: limpar(s.documento), data_entrada_sociedade: data(s.data_entrada_sociedade),
    pais: { descricao: limpar(s.pais_socio) }, representante_legal: { nome: limpar(s.nome_representante_legal), cpf: limpar(s.cpf_representante_legal) }, faixa_etariia: limpar(s.faixa_etaria_descricao) }))
  const detalhes: DetalhesBanco = {
    ...(bruto.capital_social == null ? {} : { capital_social: bruto.capital_social.toFixed(2) }),
    natureza_juridica: limpar([bruto.codigo_natureza_juridica, bruto.descricao_natureza_juridica].filter(Boolean).join(' - ')),
    regime_tributario: bruto.simples?.optante ? ['Simples Nacional'] : [],
    atividades_secundarias: (bruto.atividade_secundaria ?? []).map(a => [cnae(a.codigo), limpar(a.descricao)].filter(Boolean).join(' - ')).filter(Boolean),
    ...(incluirSocios ? { socios } : {}),
  }
  if (Buffer.byteLength(JSON.stringify(detalhes)) > 64000) return null
  return { cnpj, razao_social: razao, nome_fantasia: limpar(bruto.nome_fantasia), telefone: telefones[0] ?? null,
    telefones, email, detalhes, cep: /^[0-9]{8}$/.test(cep) ? cep : null, cnae_principal: cnae(bruto.atividade_principal?.codigo),
    situacao: limpar(bruto.situacao_cadastral?.situacao_atual ?? bruto.situacao_cadastral?.situacao_cadastral),
    porte: bruto.mei?.optante ? 'MEI' : ({ '01': 'ME', '03': 'EPP', '05': 'DEMAIS' }[bruto.porte_empresa?.codigo ?? ''] ?? null),
    data_abertura: data(bruto.data_abertura), logradouro: limpar([e?.tipo_logradouro, e?.logradouro].filter(Boolean).join(' ')),
    numero: limpar(e?.numero), complemento: limpar(e?.complemento), bairro: limpar(e?.bairro), cidade: limpar(e?.municipio),
    uf: e?.uf && /^[A-Za-z]{2}$/.test(e.uf) ? e.uf.toUpperCase() : null }
}
export function normalizarRespostaCasa(valor: unknown, f: FiltrosBusca): ResultadoFornecedor {
  const dados = z.object({ total: z.number().int().nonnegative(), cnpjs: z.array(schemaEmpresa).max(f.quantidade) }).safeParse(valor)
  if (!dados.success) return { ok: false, motivo: 'resposta_invalida' }
  const empresas = dados.data.cnpjs.map(e => normalizar(e, f.avancados?.socios ?? false))
  if (empresas.some(e => e === null)) return { ok: false, motivo: 'resposta_invalida' }
  return { ok: true, empresas: [...new Map(empresas.map(e => [e!.cnpj, e!])).values()] }
}
export function criarClienteCasaDados(chave: string | undefined, fetcher: typeof fetch = fetch): ClienteBusca & { validar(f: FiltrosBusca): boolean } {
  return {
    validar: f => prepararConsultaCasa(f).ok,
    async buscar(f) {
      if (!chave?.trim() || /[\r\n]/.test(chave)) return { ok: false, motivo: 'nao_configurado' }
      const consulta = prepararConsultaCasa(f)
      if (!consulta.ok) return { ok: false, motivo: 'resposta_invalida' }
      const signal = AbortSignal.timeout(25_000)
      try {
        const r = await fetcher(URL_PESQUISA, { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': chave.trim() },
          body: JSON.stringify(consulta.pedido), cache: 'no-store', redirect: 'error', signal })
        if (!r.ok) {
          const motivo: FalhaFornecedor = r.status === 401 ? 'credencial_invalida' : r.status === 403 ? 'sem_creditos' : r.status === 429 ? 'fornecedor_ocupado' : 'fornecedor_indisponivel'
          await r.body?.cancel()
          return { ok: false, motivo }
        }
        if (Number(r.headers.get('content-length')) > MAX_BYTES || !r.body) {
          await r.body?.cancel()
          return { ok: false, motivo: 'resposta_invalida' }
        }
        const leitor = r.body.getReader(), partes: Uint8Array[] = []
        let tamanho = 0
        try {
          for (;;) {
            const { done, value } = await leitor.read()
            if (done) break
            tamanho += value.byteLength
            if (tamanho > MAX_BYTES) { await leitor.cancel(); return { ok: false, motivo: 'resposta_invalida' } }
            partes.push(value)
          }
        } finally { leitor.releaseLock() }
        try { return normalizarRespostaCasa(JSON.parse(Buffer.concat(partes).toString('utf8')), f) }
        catch { return { ok: false, motivo: 'resposta_invalida' } }
      } catch (erro) {
        const nome = (erro as { name?: string }).name
        return { ok: false, motivo: signal.aborted || nome === 'AbortError' || nome === 'TimeoutError' ? 'tempo_esgotado' : 'fornecedor_indisponivel' }
      }
    },
  }
}
