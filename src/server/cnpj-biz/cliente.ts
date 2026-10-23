import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { normalizarCnpj, validarCnpj } from '@/src/lib/cnpj'
import type { ClienteBusca, EmpresaEncontrada, FalhaFornecedor, FiltrosBusca, ResultadoFornecedor } from '@/src/features/busca-empresas/tipos'

const BASE = 'https://cnpj.biz/api/v2'
const MAX_BYTES = 2_000_000
const texto = z.string().max(1000).nullable().optional()
const socio=z.union([z.string().max(1000),z.object({nome:texto,cnpj_cpf_socio:texto,funcao:z.object({codigo:texto,descricao:texto}).nullable().optional(),data_entrada_sociedade:texto,pais:z.object({codigo:z.number().nullable().optional(),descricao:texto}).nullable().optional(),representante_legal:z.object({cpf:texto,nome:texto}).nullable().optional(),faixa_etariia:texto})])
const endereco = z.object({ cep: texto, tipo_logradouro: texto, logradouro: texto, numero: texto,
  complemento: texto, bairro: texto, cidade: z.object({ nome: texto }).nullable().optional(),
  estado: z.object({ sigla: texto }).nullable().optional() })
const schemaEmpresa = z.object({
  cnpj: z.string(), razao_social: z.string().min(1).max(500), nome_fantasia: texto,
  email: texto, data_abertura: texto, situacao: texto, porte_empresa: texto, endereco: endereco.nullable().optional(),
  telefones: z.array(z.string().max(100)).max(30).nullable().optional(),
  atividades_principal: z.array(z.string().max(1000)).max(10).nullable().optional(),
  capital_social:texto,natureza_juridica:texto,regime_tributario:z.array(z.string().max(1000)).max(20).optional(),atividades_secundarias:z.array(z.string().max(1000)).max(100).optional(),socios:z.array(socio).max(100).optional(),
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
  const detalhes=Object.fromEntries((['capital_social','natureza_juridica','regime_tributario','atividades_secundarias','socios'] as const).filter(k=>bruto[k]!==undefined).map(k=>[k,bruto[k]]))
  if(Buffer.byteLength(JSON.stringify(detalhes))>64000)return null
  return { cnpj, razao_social: razao, nome_fantasia: limpar(bruto.nome_fantasia),...(Object.keys(detalhes).length?{detalhes}:{}),
    email: email && /^[^\s@]+@[^\s@]+$/.test(email) ? email : null, telefone: telefones[0] ?? null,
    cep: /^[0-9]{8}$/.test(cep) ? cep : null, cnae_principal: /^[0-9]{7}$/.test(cnae) ? cnae : null,
    situacao: limpar(bruto.situacao), porte: limpar(bruto.porte_empresa), data_abertura: dataValida ? abertura : null,
    logradouro: limpar([e?.tipo_logradouro, e?.logradouro].filter(Boolean).join(' ')), numero: limpar(e?.numero),
    complemento: limpar(e?.complemento), bairro: limpar(e?.bairro), cidade: limpar(e?.cidade?.nome),
    uf: e?.estado?.sigla && /^[A-Z]{2}$/.test(e.estado.sigla) ? e.estado.sigla : null, telefones }
}
type JsonResultado = { ok: true; valor: unknown } | { ok: false; motivo: FalhaFornecedor }
export function criarClienteCnpjBiz(chave: string | undefined, fetcher: typeof fetch = fetch): ClienteBusca & {contar:(f:FiltrosBusca)=>Promise<{ok:true;quantidade:number}|{ok:false;motivo:FalhaFornecedor}>} {
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
  async function preparar(f:FiltrosBusca,signal:AbortSignal) {
      const a=f.avancados
      const atividades:number[]=[]
      for(const cnae of a?.cnaes??(f.cnae?[f.cnae]:[])) {
        const codigo = `${cnae.slice(0, 2)}.${cnae.slice(2, 4)}-${cnae.slice(4, 5)}-${cnae.slice(5)}`
        const atividade = await post('/atividades/buscar', { busca: codigo, limit: 100, offset: 0 }, signal)
        if (!atividade.ok) return atividade
        const schema = z.array(z.object({ atividade_id: z.number().int().positive(), codigo: z.string() })).max(100)
        const dados = schema.safeParse(atividade.valor)
        if (!dados.success) return { ok: false as const, motivo: 'resposta_invalida' as const }
        const atividadeId = dados.data.find(a => a.codigo.replace(/[.\s/-]/g, '') === cnae)?.atividade_id
        if (!atividadeId) return { ok: false as const, motivo: 'cnae_nao_encontrado' as const }
        atividades.push(atividadeId)
      }
      const naturezas:number[]=[]
      for(const codigo of a?.naturezas??[]) {
        const r=await post('/naturezas-juridicas/buscar',{busca:codigo.slice(0,3)+'-'+codigo.slice(3),limit:100,offset:0},signal)
        if(!r.ok)return r
        const dados=z.array(z.object({natureza_juridica_id:z.number().int().positive(),codigo:z.string()})).max(100).safeParse(r.valor)
        const encontrada=dados.success?dados.data.find(n=>n.codigo.replace(/\D/g,'')===codigo):null
        if(!encontrada)return {ok:false as const,motivo:'resposta_invalida' as const}
        naturezas.push(encontrada.natureza_juridica_id)
      }
      const moeda=(s:string)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true}).format(Number(s))
      const data=(s:string)=>s.split('-').reverse().join('/')
      const pedido = a ? {
        limit:f.quantidade,offset:f.offset,socios:a.socios,
        ...(a.palavras.length?{razao_fantasia:a.palavras}:{}),...(atividades.length?{atividades,atividade_tipo:a.atividadeTipo}:{}),
        ...(naturezas.length?{natureza_juridica:naturezas}:{}),...(a.portes.length?{porte_empresa:a.portes}:{}),...(a.tipos.length?{tipo:a.tipos}:{}),
        ...(a.situacoes.length?{situacao:a.situacoes}:{}),...(a.regimes.length?{regime_tributario:a.regimes}:{}),
        localidades:a.regioes.length?a.regioes.map(r=>({tipo:r.cidade?'cidade':'estado',estado:r.estado,pais:'BR',...(r.cidade?{cidade:r.cidade}:{})})):[{tipo:'pais',pais:'BR'}],
        ...(a.regioes.some(r=>r.bairros.length)?{bairros:a.regioes.flatMap(r=>r.bairros.map(bairro=>({bairro,cidade:r.cidade,estado:r.estado,pais:'BR'})))}:{}),
        ...(a.ddds.length?{ddd:a.ddds}:{}),...(a.capitalMinimo?{capital_minimo:moeda(a.capitalMinimo)}:{}),...(a.capitalMaximo?{capital_maximo:moeda(a.capitalMaximo)}:{}),
        ...(a.aberturaDe?{data_abertura_inicio:data(a.aberturaDe)}:{}),...(a.aberturaAte?{data_abertura_fim:data(a.aberturaAte)}:{}),...(a.contato?{contato:a.contato}:{}),
        avancado:['numero','email','exportei',...(a.semEmailContabil?['sememailcontab']:[])],
      } : {
        limit: f.quantidade, offset: f.offset, situacao: ['ativa'], contato: f.contato, socios: false,
        localidades: [{ tipo: f.cidade ? 'cidade' : 'estado', estado: f.uf, pais: 'BR', ...(f.cidade ? { cidade: f.cidade } : {}) }],
        ...(f.palavra ? { razao_fantasia: [f.palavra] } : {}),
        ...(atividades.length ? { atividades, atividade_tipo: ['principal'] } : {}),
        ...(f.bairro ? { bairros: [{ bairro: f.bairro, cidade: f.cidade, estado: f.uf, pais: 'BR' }] } : {}),
        ...(f.porte ? { porte_empresa: [f.porte] } : {}), ...(f.tipo ? { tipo: [f.tipo] } : {}),
        avancado:['numero','email','exportei'],
      }
      return {ok:true as const,pedido}
  }
  return {
    async contar(f) {
      const signal=AbortSignal.timeout(25_000)
      const r=await preparar(f,signal)
      if(!r.ok)return r
      const resposta=await post('/empresas/contar',r.pedido,signal)
      if(!resposta.ok)return resposta
      const dados=z.object({result:z.literal(true),count:z.string().regex(/^[0-9]+$/)}).safeParse(resposta.valor)
      if(!dados.success||!Number.isSafeInteger(Number(dados.data.count)))return {ok:false,motivo:'resposta_invalida'}
      return {ok:true,quantidade:Number(dados.data.count)}
    },
    async buscar(f: FiltrosBusca): Promise<ResultadoFornecedor> {
      const signal=AbortSignal.timeout(25_000)
      const r=await preparar(f,signal)
      if(!r.ok)return r
      const resposta = await post('/empresas/listar-com-dados', r.pedido, signal)
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
