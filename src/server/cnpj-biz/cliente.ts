import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { normalizarCnpj, validarCnpj } from '@/src/lib/cnpj'
import type { ClienteBusca, EmpresaEncontrada, FalhaFornecedor, FiltrosBusca, ResultadoFornecedor } from '@/src/features/busca-empresas/tipos'

const BASE = 'https://cnpj.biz/api/v2'
const MAX_BYTES = 2_000_000
const texto = z.string().max(1000).nullable().optional()
const endereco = z.object({ cep: texto, tipo_logradouro: texto, logradouro: texto, numero: texto,
  complemento: texto, bairro: texto, cidade: z.object({ nome: texto }).nullable().optional(),
  estado: z.object({ sigla: texto }).nullable().optional() })
const schemaEmpresa = z.object({
  cnpj: z.string(), razao_social: z.string().min(1).max(500), nome_fantasia: texto,
  email: texto, data_abertura: texto, situacao: texto, porte_empresa: texto, endereco: endereco.nullable().optional(),
  telefones: z.array(z.string().max(100)).max(30).nullable().optional(),
  atividades_principal: z.array(z.string().max(1000)).max(10).nullable().optional(),
})
const limpar = (valor?: string | null) => {
  const limpo = valor?.trim()
  return limpo && !/[\u0000-\u001f\u007f-\u009f]/u.test(limpo) ? limpo : null
}
const digitosTelefone = (valor: string) => {
  const limpo = valor.replace(/[\s().-]/g, '').replace(/^\+55/, '')
  return /^[0-9]{10,11}$/.test(limpo) ? limpo : null
}
function normalizar(bruto: z.infer<typeof schemaEmpresa>): EmpresaEncontrada | null {
  const cnpj = normalizarCnpj(bruto.cnpj)
  const razao = limpar(bruto.razao_social)
  if (!cnpj || !validarCnpj(cnpj) || !razao) return null
  const e = bruto.endereco
  const telefones = [...new Set((bruto.telefones ?? []).map(digitosTelefone).filter((t): t is string => t !== null))]
  const email = limpar(bruto.email)?.toLowerCase() ?? null
  const cep = limpar(e?.cep)?.replace(/[.\s-]/g, '') ?? ''
  const cnae = bruto.atividades_principal?.[0]?.split(' - ')[0].replace(/[.\s/-]/g, '') ?? ''
  const abertura = limpar(bruto.data_abertura)
  const dataValida = abertura && /^\d{4}-\d{2}-\d{2}$/.test(abertura) &&
    !Number.isNaN(Date.parse(abertura)) && new Date(abertura).toISOString().slice(0, 10) === abertura
  return { cnpj, razao_social: razao, nome_fantasia: limpar(bruto.nome_fantasia),
    email: email && /^[^\s@]+@[^\s@]+$/.test(email) ? email : null, telefone: telefones[0] ?? null,
    cep: /^[0-9]{8}$/.test(cep) ? cep : null, cnae_principal: /^[0-9]{7}$/.test(cnae) ? cnae : null,
    situacao: limpar(bruto.situacao), porte: limpar(bruto.porte_empresa), data_abertura: dataValida ? abertura : null,
    logradouro: limpar([e?.tipo_logradouro, e?.logradouro].filter(Boolean).join(' ')), numero: limpar(e?.numero),
    complemento: limpar(e?.complemento), bairro: limpar(e?.bairro), cidade: limpar(e?.cidade?.nome),
    uf: e?.estado?.sigla && /^[A-Z]{2}$/.test(e.estado.sigla) ? e.estado.sigla : null, telefones }
}
type JsonResultado = { ok: true; valor: unknown } | { ok: false; motivo: FalhaFornecedor }
export function criarClienteCnpjBiz(chave: string | undefined, fetcher: typeof fetch = fetch): ClienteBusca {
  async function post(caminho: string, body: unknown, signal: AbortSignal): Promise<JsonResultado> {
    if (!chave?.trim() || /[\r\n]/.test(chave)) return { ok: false, motivo: 'nao_configurado' }
    try {
      const resposta = await fetcher(BASE + caminho, { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${chave.trim()}` },
        body: JSON.stringify(body), cache: 'no-store', redirect: 'error', signal })
      if (!resposta.ok) {
        const motivo: FalhaFornecedor = resposta.status === 401 || resposta.status === 403 ? 'credencial_invalida' :
          resposta.status === 402 ? 'sem_creditos' : resposta.status === 429 ? 'fornecedor_ocupado' : 'fornecedor_indisponivel'
        await resposta.body?.cancel()
        return { ok: false, motivo }
      }
      if (Number(resposta.headers.get('content-length')) > MAX_BYTES || !resposta.body) {
        await resposta.body?.cancel()
        return { ok: false, motivo: 'resposta_invalida' }
      }
      const leitor = resposta.body.getReader()
      const partes: Uint8Array[] = []
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
      try { return { ok: true, valor: JSON.parse(Buffer.concat(partes).toString('utf8')) } }
      catch { return { ok: false, motivo: 'resposta_invalida' } }
    } catch (erro) {
      const nome = (erro as { name?: string }).name
      return { ok: false, motivo: signal.aborted || nome === 'AbortError' || nome === 'TimeoutError' ? 'tempo_esgotado' : 'fornecedor_indisponivel' }
    }
  }
  return {
    async buscar(f: FiltrosBusca): Promise<ResultadoFornecedor> {
      const signal = AbortSignal.timeout(25_000)
      let atividadeId: number | undefined
      if (f.cnae) {
        const atividade = await post('/atividades/buscar', { busca: f.cnae, limit: 100, offset: 0 }, signal)
        if (!atividade.ok) return atividade
        const schema = z.array(z.object({ atividade_id: z.number().int().positive(), codigo: z.string() })).max(100)
        const dados = schema.safeParse(atividade.valor)
        if (!dados.success) return { ok: false, motivo: 'resposta_invalida' }
        atividadeId = dados.data.find(a => a.codigo.replace(/[.\s/-]/g, '') === f.cnae)?.atividade_id
        if (!atividadeId) return { ok: false, motivo: 'cnae_nao_encontrado' }
      }
      const pedido = {
        limit: f.quantidade, offset: f.offset, situacao: ['ativa'], contato: f.contato, socios: false,
        localidades: [{ tipo: f.cidade ? 'cidade' : 'estado', estado: f.uf, pais: 'BR', ...(f.cidade ? { cidade: f.cidade } : {}) }],
        ...(f.palavra ? { razao_fantasia: [f.palavra] } : {}),
        ...(atividadeId ? { atividades: [atividadeId], atividade_tipo: ['principal'] } : {}),
        ...(f.bairro ? { bairros: [{ bairro: f.bairro, cidade: f.cidade, estado: f.uf, pais: 'BR' }] } : {}),
        ...(f.porte ? { porte_empresa: [f.porte] } : {}), ...(f.tipo ? { tipo: [f.tipo] } : {}),
      }
      const resposta = await post('/empresas/listar-com-dados', pedido, signal)
      if (!resposta.ok) return resposta
      const dados = z.array(schemaEmpresa).max(f.quantidade).safeParse(resposta.valor)
      if (!dados.success) return { ok: false, motivo: 'resposta_invalida' }
      const empresas = dados.data.map(normalizar)
      if (empresas.some(e => e === null)) return { ok: false, motivo: 'resposta_invalida' }
      const unicas = new Map(empresas.map(e => [e!.cnpj, e!]))
      return { ok: true, empresas: [...unicas.values()] }
    },
  }
}
