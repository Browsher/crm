import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'

export const CLIENTE_REDESIGN = '00000000-0000-4000-8000-000000009701'
export const NOME_REDESIGN = `Redesign Cliente ${'Comércio de equipamentos e serviços '.repeat(3)}`.trim()

export async function prepararRedesign(banco: BancoDeTeste) {
  const vendedor = await criarUsuarioComSenha(banco, 'vendedor', 'redesigne2e', 'Senha-e2e-2026')
  await criarUsuarioComSenha(banco, 'vendedor', 'redesignprovisorioe2e', 'Senha-e2e-2026', { pendente: true })
  await banco.sql('UPDATE usuario SET nome=$1 WHERE id=$2', ['Vendedora de relacionamento comercial com nome extenso', vendedor.id])
  for (const [id, cnpj, nome] of [
    [CLIENTE_REDESIGN, '00000000009701', NOME_REDESIGN],
    ['00000000-0000-4000-8000-000000009702', '00000000009702', 'Redesign Negociação'],
  ]) {
    await banco.sql('INSERT INTO empresa(id,cnpj,razao_social,telefone) VALUES($1,$2,$3,$4)', [id, cnpj, nome, '11955559701'])
    await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [id, vendedor.id])
    await banco.sql("INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data) VALUES($1,'acompanhamento',$2,'Retornar para conversar',(now() AT TIME ZONE 'America/Sao_Paulo')::date)", [id, 'Observação extensa da jornada. '.repeat(40)])
  }
  await banco.sql('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())', [CLIENTE_REDESIGN, vendedor.id])
  await banco.sql("INSERT INTO negociacao(empresa_id,vendedor_id,etapa) VALUES('00000000-0000-4000-8000-000000009702',$1,'primeiro_contato')", [vendedor.id])
  await vincularGrupoAtivo(banco, [CLIENTE_REDESIGN, '00000000-0000-4000-8000-000000009702'])
}
