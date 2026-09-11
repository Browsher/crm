import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'

export async function prepararRecentes(banco: BancoDeTeste) {
  await criarUsuarioComSenha(banco, 'vendedor', 'recenteAe2e', 'Senha-e2e-2026', { pendente: false })
  await criarUsuarioComSenha(banco, 'vendedor', 'recenteBe2e', 'Senha-e2e-2026', { pendente: false })
}
