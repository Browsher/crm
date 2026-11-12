import { z } from 'zod'
import type { CnaeConfirmado, SugestaoBanco } from '@/src/lib/assistente-ia-banco'
import type { EntradaAssistente, ResultadoAssistente } from '@/src/lib/assistente-ia'
import { assistenteIaDisponivel, camposPublico, esquemaSugestoes, normalizarTexto, sugerirPublicos, textoCurto } from '@/src/server/assistente-ia'
import { mensagemCatalogo, prepararContextoAssistente } from '@/src/server/contexto-assistente-ia'
import { candidatosCnaeLivre, cnaeOficial } from './candidatos-cnae'

const codigoCnae = z.string().refine(codigo => /^[0-9]{7}$/.test(codigo))
const codigosCnae = z.array(codigoCnae).refine(codigos => codigos.length <= 3)
const motivoPerfil = textoCurto(100)

// O contrato do Claude é fechado, mas extras e campos inválidos não descartam os CNAEs.
const campoPerfil = <T extends z.ZodType>(valor: T) => z.object({ valor, motivo: motivoPerfil })
  .meta({ additionalProperties: false }).optional().catch(undefined)

const perfilEmpresa = z.object({
  portes: campoPerfil(z.array(z.enum(['ME', 'EPP', 'DEMAIS']))
    .refine(portes => portes.length > 0 && new Set(portes).size === portes.length)),
  mei: campoPerfil(z.enum(['qualquer', 'somente', 'excluir'])),
  regime: campoPerfil(z.enum(['qualquer', 'simples', 'fora_simples'])),
  estabelecimento: campoPerfil(z.enum(['matriz', 'filial'])),
  aberturaUltimosDias: campoPerfil(z.number()
    .refine(dias => Number.isInteger(dias) && dias >= 1 && dias <= 2147483647).meta({ type: 'integer' })),
  contato: campoPerfil(z.enum(['email', 'celular', 'celulareemail', 'telefone', 'telefoneoucelular', 'telefoneoucelulareemail'])),
}).meta({ additionalProperties: false }).transform(perfil => {
  for (const campo of Object.keys(perfil) as (keyof typeof perfil)[]) {
    if (perfil[campo] === undefined) delete perfil[campo]
  }
  return Object.keys(perfil).length ? perfil : undefined
}).optional().catch(undefined)

const schema = esquemaSugestoes(z.strictObject({
  ...camposPublico,
  cnaes: codigosCnae.optional(),
  cnaesSecundarios: codigosCnae.optional(),
  palavras: z.array(textoCurto(100)).refine(palavras => palavras.length <= 3 && palavras.every(palavra => !palavra.includes(','))).optional(),
  perfilEmpresa,
}))

const INSTRUCOES = [
  'Ajude um vendedor a prospectar empresas no Banco de empresas brasileiro.',
  'Sugira até três CNAEs principais de sete dígitos por público, com o código exato da subclasse e zeros iniciais. Omita códigos incertos.',
  'Use cnaesSecundarios somente quando o vendedor pedir atividades secundárias. Não duplique códigos entre os dois campos.',
  'Palavras são restrições à razão social ou ao nome fantasia, não à descrição do segmento. Use até três palavras somente quando o vendedor pedir filtro no nome da empresa.',
  'Um público precisa ter ao menos um CNAE ou uma palavra-chave de nome utilizável. Use apenas os filtros relevantes.',
  'Use exclusivamente os CNAEs candidatos fornecidos. Quando houver perfis do catálogo, informe perfil com o id exato do perfil correspondente e use somente os códigos daquele perfil.',
  'Para descrição livre, use a lista de CNAEs principais apenas no campo cnaes e a lista de CNAEs secundários apenas em cnaesSecundarios.',
  'Com um SKU do catálogo, priorize quem pode comprar para revenda. Uma especialidade é uma preferência comercial e o CNAE pode representar uma atividade mais abrangente.',
  'Em perfilEmpresa, proponha porte, MEI ou participação no Simples Nacional como hipóteses de segmentação úteis para cada público. MEI é um filtro separado de portes. Não trate dados cadastrais como prova de capacidade de compra.',
  'Sugira matriz ou filial, idade em dias ou contato disponível somente quando ajudarem o objetivo. Omita campos sem proposta e evite recortes incompatíveis.',
  'Para cada filtro de perfil, inclua valor e um motivo comercial de até 100 caracteres. Não sugira capital social, quantidade de resultados ou seleção automática.',
]

const SEM_CANDIDATOS = {
  ok: false, motivo: 'Não encontramos um CNAE adequado para esse público. Detalhe a atividade de quem compra ou use o assistente no Google.',
} as const
const MARCADOR_NOME = /\b(?:no nome(?: fantasia| da empresa)?|pelo nome|nome fantasia|nome da empresa|razao social|palavra chave)\b/

function palavraPedida(palavra: string, trechos: string[]): boolean {
  const termo = normalizarTexto(palavra)
  if (!termo) return false
  const conector = '(?: (?:contem|contenham|conter|tenha|tenham|ter|inclua|com|seja|e|ou|igual|a)){0,3}'
  const marcador = MARCADOR_NOME.source
  const juntoDoNome = new RegExp(`\\b${termo}${conector} ${marcador}|${marcador}${conector} ${termo}\\b`)
  return trechos.some(trecho => juntoDoNome.test(trecho))
}

function confirmarCnaes(lista: string[] = [], permitidos: CnaeConfirmado[]): CnaeConfirmado[] {
  const escolhidos = new Set(lista)
  return permitidos.filter(cnae => escolhidos.has(cnae.codigo))
}

export async function sugerirFiltrosBanco(entrada: EntradaAssistente | string): Promise<ResultadoAssistente<SugestaoBanco>> {
  if (!assistenteIaDisponivel('banco')) return { ok: false, motivo: 'O assistente de filtros estará disponível em breve.' }
  const contexto = prepararContextoAssistente(entrada)
  if (!contexto.ok) return contexto

  const valor = contexto.valor
  const trechos = valor.textoPreferencias.split(/[.!?;\n]+/).map(normalizarTexto)
  const pedidosSecundarios = trechos.filter(trecho => /\bsecundari[ao]s?\b/.test(trecho) &&
    !/\b(?:sem|nao (?:inclu\w*|quero|us\w*|consider\w*)|exclu\w*) (?:\w+ ){0,4}secundari[ao]s?\b/.test(trecho))
  const pediuSecundarios = pedidosSecundarios.length > 0
  const pedidosNome = trechos.filter(trecho => MARCADOR_NOME.test(trecho) &&
    !/\b(?:nao (?:us\w*|inclu\w*|quero|filtr\w*|restring\w*)|sem (?:filtro|restringir))\b/.test(trecho))
  const pediuNomes = pedidosNome.length > 0

  const perfis = valor.origem === 'catalogo' ? valor.perfis.map(perfil => ({
    id: perfil.id, titulo: perfil.rotulo, nicho: perfil.nicho,
    cnaes: perfil.cnaes.flatMap(cnae => cnaeOficial(cnae.codigo, cnae)),
  })).filter(perfil => perfil.cnaes.length) : []
  const livres = valor.origem === 'livre'
    ? candidatosCnaeLivre(valor.textoSegmento, valor.publico || valor.textoLivre) : []
  const livresSecundarios = valor.origem === 'livre' && pediuSecundarios ? candidatosCnaeLivre(pedidosSecundarios.join(' ')) : []
  if (valor.origem === 'catalogo' ? !perfis.length : !livres.length && !livresSecundarios.length && !pediuNomes) return SEM_CANDIDATOS

  const mensagem = valor.origem === 'catalogo' ? mensagemCatalogo(valor, perfis) : valor.mensagem
  const instrucoes = valor.origem === 'livre' ? [
    ...INSTRUCOES, 'CNAEs principais candidatos: ' + JSON.stringify(livres),
    'CNAEs secundários candidatos: ' + JSON.stringify(livresSecundarios),
  ] : INSTRUCOES
  const resultado = await sugerirPublicos('banco', mensagem, schema, instrucoes,
    publico => [publico.perfil, publico.titulo, publico.cnaes?.join(' '), publico.cnaesSecundarios?.join(' '), publico.palavras?.join(' ')].join(' '), valor.descricaoRegiao)
  if (!resultado.ok) return resultado

  const assinaturas = new Set<string>()
  const perfisUsados = new Set<string>()
  const sugestoes = resultado.valor.sugestoes.flatMap(s => {
    const perfil = perfis.find(opcao => opcao.id === s.perfil)
    if (valor.origem === 'catalogo' && (!perfil || perfisUsados.has(perfil.id))) return []
    const candidatos = perfil?.cnaes ?? livres
    const cnaes = confirmarCnaes(s.cnaes, candidatos)
    const cnaesSecundarios = pediuSecundarios
      ? confirmarCnaes(s.cnaesSecundarios?.filter(codigo => !cnaes.some(c => c.codigo === codigo)), perfil?.cnaes ?? livresSecundarios) : []
    const palavras = [...new Set(s.palavras)].filter(palavra => palavraPedida(palavra, pedidosNome))
    if (!palavras.length && !cnaes.length && !cnaesSecundarios.length) return []
    const assinatura = JSON.stringify([
      cnaes.map(c => c.codigo).sort(),
      cnaesSecundarios.map(c => c.codigo).sort(),
      [...new Set(palavras.map(normalizarTexto))].sort(),
    ])
    if (assinaturas.has(assinatura)) return []
    assinaturas.add(assinatura)
    if (perfil) perfisUsados.add(perfil.id)
    return [{ titulo: perfil?.titulo ?? s.titulo, descricao: s.descricao, cnaes, cnaesSecundarios, palavras,
      ...(s.perfilEmpresa && { perfilEmpresa: s.perfilEmpresa }),
    }]
  })

  if (!sugestoes.length) return SEM_CANDIDATOS
  return { ok: true, valor: { ...resultado.valor, sugestoes } }
}
