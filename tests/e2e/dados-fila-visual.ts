import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'

export async function prepararFilaVisual(banco: BancoDeTeste) {
  await criarUsuarioComSenha(banco, 'vendedor', 'visuale2e', 'Senha-e2e-2026', { pendente: false })
  await banco.sql(`INSERT INTO empresa (cnpj, razao_social, telefone, cnae_principal) VALUES
    ('00000000000201','Visual E2E A','11999990201','8888888'),
    ('00000000000202','Visual E2E B','11999990202','8888888')`)
}
