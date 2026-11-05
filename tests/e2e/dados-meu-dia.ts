import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'

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
// Nome estável preservado da fixture anterior; agora aparece em um card do grid.
export const NOME_MEU_DIA_ROLAGEM = 'Meu Dia Atraso A09'
// Último retorno de hoje: nome sem a palavra "Hoje" de propósito, para que a
// checagem do rótulo de estado ("Hoje") no teste não passe por vacuidade.
export const NOME_MEU_DIA_ULTIMO = 'Meu Dia Zular'

// [numero, razaoSocial, quando]. Números são dias civis a partir de hoje;
// períodos começam na próxima segunda ou no próximo mês em São Paulo.
// null não cria contato nem agenda.
// Dez atrasados, quatro de hoje e quatro futuros cobrem o grid e os filtros.
// A empresa sem contato permanece fora da agenda, mas o futuro faz parte dela.
const AGENDA: Array<[numero: number, nome: string, quando: number | 'semana_que_vem' | 'mes_que_vem' | null]> = [
  [502, 'Meu Dia Atraso A14', -14],
  [503, 'Meu Dia Atraso A13', -13],
  [504, 'Meu Dia Atraso A12', -12],
  [505, 'Meu Dia Atraso A11', -11],
  [506, 'Meu Dia Atraso A10', -10],
  [507, NOME_MEU_DIA_ROLAGEM, -9],
  [508, 'Meu Dia Posse Perdida', -8],
  [509, NOME_MEU_DIA_BUSCA_UNICA, -7],
  [510, 'Meu Dia Atraso Devolucao', -2],
  [511, 'Meu Dia Atraso Reagenda', -1],
  [512, 'Meu Dia Aurora', 0],
  [513, 'Meu Dia Cedro', 0],
  [514, 'Meu Dia Dourada', 0],
  [515, NOME_MEU_DIA_ULTIMO, 0],
  [516, 'Meu Dia Amanhã', 1],
  [518, 'Meu Dia Semana Que Vem', 'semana_que_vem'],
  [519, 'Meu Dia Mês Que Vem', 'mes_que_vem'],
  [520, 'Meu Dia Fora Do Mês Comércio de equipamentos e serviços com nome extenso para conferir altura uniforme dos cards', 70],
  [517, 'Meu Dia SemContato Ignorado', null],
]

export async function prepararMeuDia(banco: BancoDeTeste) {
  const vendedor = await criarUsuarioComSenha(banco, 'vendedor', 'meudiae2e', 'Senha-e2e-2026', { pendente: false })
  const outro = await criarUsuarioComSenha(banco, 'vendedor', 'meudiaprivadae2e', 'Senha-e2e-2026', { pendente: false })
  await criarUsuarioComSenha(banco, 'vendedor', 'meudiavazioe2e', 'Senha-e2e-2026', { pendente: false })

  await banco.sql(`INSERT INTO empresa (id, cnpj, razao_social, telefone, cnae_principal)
    VALUES ($1, $2, 'Meu Dia Privada Ignorada', '11999990501', '8877665')`,
    [EMPRESA_MEU_DIA_PRIVADA, cnpjDe(501)])
  await vincularEmpresaTeste(banco,EMPRESA_MEU_DIA_PRIVADA,outro.id,'legado')
  await banco.sql('INSERT INTO empresa_fila (empresa_id, vendedor_id) VALUES ($1, $2)', [EMPRESA_MEU_DIA_PRIVADA, outro.id])
  await banco.sql(`INSERT INTO contato (empresa_id, tipo, nota, proximo_passo, proximo_passo_data) VALUES
    ($1, 'acompanhamento', 'Nota privada de outro vendedor no Meu dia', 'Retorno privado',
     (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)`, [EMPRESA_MEU_DIA_PRIVADA])

  for (const [numero, nome, quando] of AGENDA) {
    const id = idDe(numero)
    await banco.sql(`INSERT INTO empresa (id, cnpj, razao_social, telefone, cnae_principal)
      VALUES ($1, $2, $3, '11999990401', '8877665')`, [id, cnpjDe(numero), nome])
    await vincularEmpresaTeste(banco,id,vendedor.id,'legado')
    await banco.sql('INSERT INTO empresa_fila (empresa_id, vendedor_id) VALUES ($1, $2)', [id, vendedor.id])
    if(id===EMPRESA_MEU_DIA_REAGENDA || numero===516) await banco.sql(`INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,(now() AT TIME ZONE 'America/Sao_Paulo')::date,100,gen_random_uuid())`,[id,vendedor.id])
    if (quando !== null) {
      await banco.sql(`INSERT INTO contato (empresa_id, tipo, nota, proximo_passo, proximo_passo_data) VALUES
        ($1, 'acompanhamento', $2, $3, CASE $4::text
          WHEN 'semana_que_vem' THEN date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date + 7
          WHEN 'mes_que_vem' THEN (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month')::date
          ELSE (now() AT TIME ZONE 'America/Sao_Paulo')::date + $5::integer END)`,
        [id, `Nota de ${nome}`, `Retorno de ${nome}`, String(quando), typeof quando === 'number' ? quando : null])
    }
  }
  // Negociação com retorno mantém a identidade usada pelo editor comum.
  await banco.sql('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2)', [idDe(512), vendedor.id])
  await banco.sql(`INSERT INTO empresa(id,cnpj,razao_social,telefone) VALUES($1,$2,'Meu Dia Arquivada','11900000521')`, [idDe(521), cnpjDe(521)])
  await vincularEmpresaTeste(banco,idDe(521),vendedor.id,'legado')
  await banco.sql(`UPDATE empresa_vinculo SET arquivada_em=now(),agenda_contato_id=NULL WHERE empresa_id=$1`, [idDe(521)])
  await banco.sql(`UPDATE empresa_vinculo v SET agenda_contato_id=(SELECT c.id FROM contato c WHERE c.empresa_id=v.empresa_id AND c.proximo_passo_data IS NOT NULL ORDER BY c.criado_em DESC,c.id DESC LIMIT 1) WHERE v.vendedor_id=ANY($1::uuid[])`,[[vendedor.id,outro.id]])
  await vincularGrupoAtivo(banco, [EMPRESA_MEU_DIA_PRIVADA, ...AGENDA.map(([numero]) => idDe(numero))])
}
