import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'

export async function prepararVinculosPermanentes(banco: BancoDeTeste) {
  const a=await criarUsuarioComSenha(banco, 'vendedor', 'reservaAe2e', 'Senha-e2e-2026', { pendente: false })
  const b=await criarUsuarioComSenha(banco, 'vendedor', 'reservaBe2e', 'Senha-e2e-2026', { pendente: false })
  const empresas = await banco.sql<{ id: string }>(`INSERT INTO empresa (cnpj,razao_social,telefone,cnae_principal) VALUES
    ('00000000000101','Reserva E2E A','11987650101','7654321'),
    ('00000000000102','Reserva E2E B','11987650102','7654321'),
    ('00000000000103','Reserva Unica E2E','11987650103','1234567') RETURNING id`)
  await vincularGrupoAtivo(banco, empresas.map(e => e.id))
  for(const [i,e] of empresas.entries())await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[e.id,i===2?b.id:a.id])
}
