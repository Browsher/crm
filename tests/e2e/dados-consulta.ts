import type { BancoDeTeste } from '../integracao/ajuda'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'

// Cenário sintético, somente no banco temporário do harness E2E.
export async function prepararEmpresasConsulta(banco: BancoDeTeste) {
  await banco.sql(`INSERT INTO cep (cep, bairro, localidade, uf, ibge) VALUES
    ('01001000', 'Centro de teste', 'Cidade paulista de teste', 'SP', '3550308'),
    ('20000000', 'Bairro de teste', 'Cidade fluminense de teste', 'RJ', '3304557')`)
  const empresas = await banco.sql<{ id: string }>(`INSERT INTO empresa
    (cnpj, razao_social, contato_nome, telefone, email, cep, cnae_principal)
    SELECT lpad(n::text,14,'0'), 'Consulta E2E ' || lpad(n::text,2,'0'),
      'Pessoa privada E2E', '11987650001', 'contato-secreto@teste.local', '01001000', '4742300'
    FROM generate_series(1,23) n RETURNING id`)
  const outra = await banco.sql<{ id: string }>(`INSERT INTO empresa (cnpj, razao_social, telefone, cep)
    VALUES ('00000000000024','Outra empresa fluminense','21987650002','20000000') RETURNING id`)
  await vincularGrupoAtivo(banco, [...empresas, ...outra].map(e => e.id))
  await banco.sql(`INSERT INTO empresa_fila (empresa_id, vendedor_id)
    SELECT e.id, u.id FROM empresa e CROSS JOIN usuario u
    WHERE e.razao_social LIKE 'Consulta E2E %' AND u.email='invalidoe2e@teste.local'`)
}
