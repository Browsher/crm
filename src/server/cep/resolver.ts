import type { Executar } from '../db/como-usuario'

// Pura: sem banco, sem rede. É a fase 1 da importação de empresas, que precisa
// recusar 'CEP: consultar' numa célula sem abrir conexão.
// Só remove separadores; qualquer letra sobrevive à limpeza e reprova no teste
// de oito dígitos, então 'a1310100' não vira '1310100'.
export function normalizarCep(bruto: string): string | null {
  const limpo = bruto.replace(/[\s.\-/]/g, '')
  return /^[0-9]{8}$/.test(limpo) ? limpo : null
}

export type Endereco = {
  cep: string
  logradouro: string | null
  faixa: string | null
  bairro: string | null
  localidade: string
  uf: string
  ibge: string
}

// Em lote de propósito. A importação de empresas tem milhares de linhas e
// algumas centenas de CEPs distintos: `= ANY` resolve todas numa ida. A versão
// singular convidaria a um laço com centenas de idas, que mede bem em teste com
// dez linhas e só aparece com a planilha real.
//
// Devolve mapa PARCIAL, e não { ok, motivo }, contrariando o padrão do projeto
// de propósito: CEP não encontrado não é falha da operação. A consulta
// funcionou e a resposta é "não existe na base de julho/2024". Quem decide o
// que fazer com isso é a importação, que sabe que a empresa entra mesmo assim.
// Consulta de referência não decide negócio.
export async function resolverCeps(executar: Executar, ceps: string[]): Promise<Map<string, Endereco>> {
  if (ceps.length === 0) return new Map()
  const { linhas } = await executar<Endereco>(
    `SELECT cep, logradouro, faixa, bairro, localidade, uf, ibge
       FROM cep WHERE cep = ANY($1)`,
    [ceps],
  )
  return new Map(linhas.map((l) => [l.cep, l]))
}
