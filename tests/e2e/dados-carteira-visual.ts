import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'

export const EMPRESA_CARTEIRA_PRIVADA = '00000000-0000-4000-8000-000000000303'

export async function prepararCarteiraVisual(banco: BancoDeTeste) {
  const vendedor = await criarUsuarioComSenha(banco, 'vendedor', 'carteiravisuale2e', 'Senha-e2e-2026', { pendente: false })
  const outro = await criarUsuarioComSenha(banco, 'vendedor', 'carteiraprivadae2e', 'Senha-e2e-2026', { pendente: false })
  await banco.sql(`INSERT INTO cep (cep, localidade, uf, ibge) VALUES
    ('99000301', 'Cidade Aurora fictícia', 'SP', '3550308'),
    ('99000302', 'Cidade Boreal fictícia', 'RJ', '3304557'),
    ('99000303', 'Cidade Privada fictícia', 'MG', '3106200')`)
  const empresas = [
    ['00000000-0000-4000-8000-000000000301', '00000000000301', 'Carteira Visual Aurora', '99000301', vendedor.id],
    ['00000000-0000-4000-8000-000000000302', '00000000000302', 'Carteira Visual Boreal', '99000302', vendedor.id],
    [EMPRESA_CARTEIRA_PRIVADA, '00000000000303', 'Carteira Visual Privada', '99000303', outro.id],
  ]
  for (const [id, cnpj, nome, cep, dono] of empresas) {
    await banco.sql(`INSERT INTO empresa (id, cnpj, razao_social, cep, telefone, cnae_principal)
      VALUES ($1, $2, $3, $4, '11999990301', '8877665')`, [id, cnpj, nome, cep])
    await banco.sql('INSERT INTO empresa_fila (empresa_id, vendedor_id) VALUES ($1, $2)', [id, dono])
  }
  await banco.sql(`INSERT INTO contato (empresa_id, tipo, nota, proximo_passo, proximo_passo_data) VALUES
    ('00000000-0000-4000-8000-000000000301', 'acompanhamento', 'Nota inicial Aurora ' || repeat('x', 300), 'Rever proposta Aurora', CURRENT_DATE - 2),
    ('00000000-0000-4000-8000-000000000302', 'interessado', 'Nota inicial Boreal', NULL, NULL),
    ($1, 'acompanhamento', 'Nota privada de outro vendedor', 'Retorno privado', CURRENT_DATE)`, [EMPRESA_CARTEIRA_PRIVADA])
}
