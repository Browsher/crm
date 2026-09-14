import type { BancoDeTeste } from './ajuda'

// Vínculo explícito somente dos IDs preparados pelo cenário. O harness e a
// produção nunca vinculam cadastros futuros automaticamente.
export async function vincularGrupoAtivo(banco: BancoDeTeste, empresaIds: string[]) {
  await banco.sql(`WITH grupo AS (
    INSERT INTO grupo_importacao(nome) VALUES ('Origem do cenário') RETURNING id
  ) INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id)
    SELECT grupo.id, unnest($1::uuid[]) FROM grupo`, [empresaIds])
}
