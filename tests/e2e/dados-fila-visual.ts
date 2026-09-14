import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'

export async function prepararFilaVisual(banco: BancoDeTeste) {
  await criarUsuarioComSenha(banco, 'vendedor', 'visuale2e', 'Senha-e2e-2026', { pendente: false })
  const empresas = await banco.sql<{ id: string }>(`INSERT INTO empresa (cnpj, razao_social, telefone, cnae_principal) VALUES
    ('00000000000201','Visual E2E A','11999990201','8888888'),
    ('00000000000202','Visual E2E B','11999990202','8888888') RETURNING id`)
  await vincularGrupoAtivo(banco, empresas.map(e => e.id))
}
