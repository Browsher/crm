import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'

export async function prepararRecentes(banco: BancoDeTeste) {
  const eu=await criarUsuarioComSenha(banco, 'vendedor', 'recenteAe2e', 'Senha-e2e-2026', { pendente: false })
  await criarUsuarioComSenha(banco, 'vendedor', 'recenteBe2e', 'Senha-e2e-2026', { pendente: false })
  const [{id}]=await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Recente própria','11998887777') RETURNING id")
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[id,eu.id])
  await banco.sql("WITH g AS (INSERT INTO grupo_importacao(nome) VALUES('Origem recente') RETURNING id) INSERT INTO grupo_importacao_empresa SELECT id,$1 FROM g",[id])
}
