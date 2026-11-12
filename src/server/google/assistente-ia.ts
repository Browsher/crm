import { z } from 'zod'
import { camposPublico, esquemaSugestoes, sugerirPublicos, textoCurto } from '@/src/server/assistente-ia'

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
]

export function sugerirFiltrosGoogle(descricao: string) {
  return sugerirPublicos('google', descricao, schema, INSTRUCOES, publico => publico.nicho)
}
