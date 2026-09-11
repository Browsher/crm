import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'

function idDe(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}
function cnpjDe(n: number): string {
  return String(n).padStart(14, '0')
}

export const EMPRESA_MEU_DIA_PRIVADA = idDe(501)
export const EMPRESA_MEU_DIA_POSSE_PERDIDA = idDe(508)
export const EMPRESA_MEU_DIA_DEVOLUCAO = idDe(510)
export const EMPRESA_MEU_DIA_REAGENDA = idDe(511)
export const NOME_MEU_DIA_BUSCA_UNICA = 'Meu Dia Unico Girassol'
export const NOME_MEU_DIA_ROLAGEM = 'Meu Dia Hoje Zular'

// [numero, razaoSocial, dias]. `dias` é o deslocamento em dias civis de São
// Paulo a partir de hoje (null = sem contato nenhum, empresa fica sem_data).
// Dez atrasados (-14 a -1) mais quatro de hoje são os catorze itens que
// TRANSBORDAM a lista em 1280x800; a futura e a sem contato existem só para
// provar que o recorte da agenda as deixa de fora.
const AGENDA: Array<[numero: number, nome: string, dias: number | null]> = [
  [502, 'Meu Dia Atraso A14', -14],
  [503, 'Meu Dia Atraso A13', -13],
  [504, 'Meu Dia Atraso A12', -12],
  [505, 'Meu Dia Atraso A11', -11],
  [506, 'Meu Dia Atraso A10', -10],
  [507, 'Meu Dia Atraso A09', -9],
  [508, 'Meu Dia Posse Perdida', -8],
  [509, NOME_MEU_DIA_BUSCA_UNICA, -7],
  [510, 'Meu Dia Atraso Devolucao', -2],
  [511, 'Meu Dia Atraso Reagenda', -1],
  [512, 'Meu Dia Hoje Aurora', 0],
  [513, 'Meu Dia Hoje Cedro', 0],
  [514, 'Meu Dia Hoje Dourada', 0],
  [515, NOME_MEU_DIA_ROLAGEM, 0],
  [516, 'Meu Dia Futuro Ignorado', 5],
  [517, 'Meu Dia SemContato Ignorado', null],
]

export async function prepararMeuDia(banco: BancoDeTeste) {
  const vendedor = await criarUsuarioComSenha(banco, 'vendedor', 'meudiae2e', 'Senha-e2e-2026', { pendente: false })
  const outro = await criarUsuarioComSenha(banco, 'vendedor', 'meudiaprivadae2e', 'Senha-e2e-2026', { pendente: false })
  await criarUsuarioComSenha(banco, 'vendedor', 'meudiavazioe2e', 'Senha-e2e-2026', { pendente: false })

  await banco.sql(`INSERT INTO empresa (id, cnpj, razao_social, telefone, cnae_principal)
    VALUES ($1, $2, 'Meu Dia Privada Ignorada', '11999990501', '8877665')`,
    [EMPRESA_MEU_DIA_PRIVADA, cnpjDe(501)])
  await banco.sql('INSERT INTO empresa_fila (empresa_id, vendedor_id) VALUES ($1, $2)', [EMPRESA_MEU_DIA_PRIVADA, outro.id])
  await banco.sql(`INSERT INTO contato (empresa_id, tipo, nota, proximo_passo, proximo_passo_data) VALUES
    ($1, 'acompanhamento', 'Nota privada de outro vendedor no Meu dia', 'Retorno privado',
     (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)`, [EMPRESA_MEU_DIA_PRIVADA])

  for (const [numero, nome, dias] of AGENDA) {
    const id = idDe(numero)
    await banco.sql(`INSERT INTO empresa (id, cnpj, razao_social, telefone, cnae_principal)
      VALUES ($1, $2, $3, '11999990401', '8877665')`, [id, cnpjDe(numero), nome])
    await banco.sql('INSERT INTO empresa_fila (empresa_id, vendedor_id) VALUES ($1, $2)', [id, vendedor.id])
    if (dias !== null) {
      await banco.sql(`INSERT INTO contato (empresa_id, tipo, nota, proximo_passo, proximo_passo_data) VALUES
        ($1, 'acompanhamento', $2, $3, (now() AT TIME ZONE 'America/Sao_Paulo')::date + $4::integer)`,
        [id, `Nota de ${nome}`, `Retorno de ${nome}`, dias])
    }
  }
}
