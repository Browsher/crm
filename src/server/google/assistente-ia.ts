import { z } from 'zod'
import type { EntradaAssistente, ResultadoAssistente } from '@/src/lib/assistente-ia'
import type { SugestaoGoogle } from '@/src/lib/google/assistente-ia'
import { assistenteIaDisponivel, camposPublico, esquemaSugestoes, normalizarTexto, sugerirPublicos, textoCurto } from '@/src/server/assistente-ia'
import { mensagemCatalogo, prepararContextoAssistente } from '@/src/server/contexto-assistente-ia'

const schema = esquemaSugestoes(z.strictObject({
  ...camposPublico,
  nicho: textoCurto(100),
  termos: textoCurto(240, 0).optional(),
  produtos: textoCurto(240, 0).optional(),
  excluir: textoCurto(240, 0).optional(),
}))

const INSTRUCOES = [
  'Ajude um vendedor a planejar buscas B2B de empresas no Google.',
  'Em cada sugestão informe um nicho pesquisável (100 caracteres).',
  'Inclua termos adicionais úteis e concisos, separados por vírgula. Inclua produtos apenas quando úteis e excluir apenas se o vendedor pedir. Limite cada um a 240 caracteres. Não inclua campos sem valor.',
  'Quando houver perfis do catálogo, informe perfil com o id exato. Respeite a especialidade e os perfis disponíveis. Priorize compradores que possam revender o produto por caixa.',
]

export async function sugerirFiltrosGoogle(entrada: EntradaAssistente | string): Promise<ResultadoAssistente<SugestaoGoogle>> {
  if (!assistenteIaDisponivel('google')) return { ok: false, motivo: 'O assistente de filtros estará disponível em breve.' }
  const contexto = prepararContextoAssistente(entrada)
  if (!contexto.ok) return contexto
  const valor = contexto.valor
  const mensagem = valor.origem === 'livre' ? valor.mensagem : mensagemCatalogo(valor, valor.perfis.map(({ id, rotulo, nicho }) => ({ id, rotulo, nicho })))
  const resultado = await sugerirPublicos('google', mensagem, schema, INSTRUCOES, publico => publico.perfil ?? publico.nicho, valor.descricaoRegiao)
  if (!resultado.ok) return resultado

  const pedidosExclusao = valor.textoPreferencias.split(/[.!?;\n]+/).map(normalizarTexto).filter(trecho =>
    /\b(?:exclu\w*|evit\w*|ignor\w*|exceto|nao incluir|nao quero|sem (?:lojas?|empresas?|negocios?))\b/.test(trecho) &&
    !/\bnao (?:exclu\w*|evit\w*|ignor\w*)\b/.test(trecho))
  const sugestoes = resultado.valor.sugestoes.flatMap(({ perfil, excluir, ...sugestao }) => {
    const perfilCatalogo = valor.origem === 'catalogo' ? valor.perfis.find(p => p.id === perfil) : undefined
    if (valor.origem === 'catalogo' && !perfilCatalogo) return []
    const tipo = valor.origem === 'catalogo' && valor.publico ? perfilCatalogo?.tipoGoogle : undefined
    const especialidade = valor.origem === 'catalogo' ? valor.especialidade : undefined
    const nicho = perfilCatalogo?.nicho ?? sugestao.nicho
    const especializar = especialidade && !normalizarTexto(nicho).includes(normalizarTexto(especialidade)) &&
      (nicho.length + especialidade.length + 2 <= 100)
    const excluirAutorizado = excluir?.split(',').map(parte => parte.trim()).filter(parte => {
      const termo = normalizarTexto(parte)
      return termo && pedidosExclusao.some(trecho => (' ' + trecho + ' ').includes(' ' + termo + ' '))
    }).join(', ')
    return [{
      ...sugestao,
      nicho: especializar ? nicho + ', ' + especialidade : nicho,
      ...(perfilCatalogo && { titulo: perfilCatalogo.rotulo }),
      ...(excluirAutorizado && { excluir: excluirAutorizado }),
      ...(tipo && { tipos: [tipo] }),
    }]
  })
  return sugestoes.length
    ? { ok: true, valor: { ...resultado.valor, sugestoes } }
    : { ok: false, motivo: valor.origem === 'catalogo'
      ? 'Nenhuma sugestão corresponde a esse público. Revise os refinamentos e tente novamente.'
      : 'Descreva para que o produto serve ou quem costuma comprá-lo para receber sugestões.' }
}
