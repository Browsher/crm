import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'

export async function prepararEmpresasReserva(banco: BancoDeTeste) {
  await criarUsuarioComSenha(banco, 'vendedor', 'reservaAe2e', 'Senha-e2e-2026', { pendente: false })
  await criarUsuarioComSenha(banco, 'vendedor', 'reservaBe2e', 'Senha-e2e-2026', { pendente: false })
  await banco.sql(`INSERT INTO empresa (cnpj,razao_social,telefone,cnae_principal) VALUES
    ('00000000000101','Reserva E2E A','11987650101','7654321'),
    ('00000000000102','Reserva E2E B','11987650102','7654321'),
    ('00000000000103','Reserva Unica E2E','11987650103','1234567')`)
}
