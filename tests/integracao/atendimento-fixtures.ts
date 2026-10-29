import { criarUsuario, type BancoDeTeste } from './ajuda'

// Exclusivo da preparação administrativa do harness local. Não é comando do app.
export async function vincularEmpresaTeste(
  banco: BancoDeTeste,
  empresaId: string,
  vendedorId: string,
  origem: 'google' | 'banco' | 'legado',
): Promise<number> {
  const [vinculo] = await banco.sql<{ versao: number }>(
    `INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,$3)
     RETURNING versao`, [empresaId, vendedorId, origem],
  )
  return vinculo.versao
}

export async function cenarioAtendimento(banco: BancoDeTeste): Promise<{
  vendedorId: string; outroId: string; gestorId: string; empresaId: string; versao: number
}> {
  const vendedorId = await criarUsuario(banco, 'vendedor', 'Atendimento')
  const outroId = await criarUsuario(banco, 'vendedor', 'OutroAtendimento')
  const gestorId = await criarUsuario(banco, 'gestor', 'GestorAtendimento')
  const [{ id: empresaId }] = await banco.sql<{ id: string }>(
    "INSERT INTO empresa(razao_social,telefone) VALUES('Atendimento teste','11987654321') RETURNING id",
  )
  const versao = await vincularEmpresaTeste(banco, empresaId, vendedorId, 'legado')
  return { vendedorId, outroId, gestorId, empresaId, versao }
}
