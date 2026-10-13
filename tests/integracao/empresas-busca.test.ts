import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { conferirInvariantes } from '@/src/server/db/migracoes/invariantes'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'
import { listarEmpresas } from '@/src/features/empresas/listagem'
import { lerConsulta } from '@/src/features/empresas/consulta'
import { consultarEmpresas } from '@/src/features/prospeccao/repositorio'
import { listarSugestoes, lerPerfil } from '@/src/features/prospeccao/recentes'
import { detalharGrupo } from '@/src/features/empresas/grupos'

let banco: BancoDeTeste
let gestor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
})
afterAll(async () => {
  await banco.derrubar()
})

describe('0015: a maquinaria de busca', () => {
  test('as invariantes continuam valendo', async () => {
    expect(await conferirInvariantes(banco.urlAdmin)).toEqual({ ok: true })
  })

  // A extensão traz quatro funções e o invólucro é a quinta. Toda função nova
  // nasce com EXECUTE para PUBLIC (proacl nulo); sem os REVOKE, as cinco
  // apareceriam aqui.
  test('nenhuma função de extensoes ou public é executável por PUBLIC', async () => {
    const r = await banco.sql<{ nome: string }>(`
      SELECT n.nspname || '.' || p.proname AS nome
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('extensoes', 'public')
        AND (p.proacl IS NULL OR EXISTS (
          SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))
      ORDER BY 1`)
    expect(r).toEqual([])
  })

  // O REVOKE no schema fecha a porta para PUBLIC e fecharia para app_usuario
  // junto: sem_acento não é definidora, então o corpo dela roda com o
  // privilégio de quem chama. Este teste é o que prova que os dois GRANT
  // estão lá.
  test('app_usuario executa sem_acento', async () => {
    const r = await banco.comoUsuario(gestor, (e) =>
      e<{ sem_acento: string }>("SELECT sem_acento('Iluminação São João') AS sem_acento"),
    )
    expect(r.linhas[0].sem_acento).toBe('iluminacao sao joao')
  })

  test('o banco calcula busca no INSERT do gestor', async () => {
    const r = await banco.comoUsuario(gestor, async (e) => {
      await e(`INSERT INTO empresa (cnpj, razao_social, nome_fantasia, telefone)
               VALUES ('11222333000181', 'Iluminação São João', 'LÂMPADAS Ltda', '11987654321')`)
      return e<{ busca: string }>("SELECT busca FROM empresa WHERE cnpj = '11222333000181'")
    })
    expect(r.linhas[0].busca).toBe('iluminacao sao joao lampadas ltda')
  })

  test('busca não contém o CNPJ', async () => {
    const r = await banco.comoUsuario(gestor, (e) =>
      e<{ busca: string }>("SELECT busca FROM empresa WHERE cnpj = '11222333000181'"),
    )
    expect(r.linhas[0].busca).not.toContain('11222333000181')
  })

  test('nome_fantasia nulo não vira "null" dentro de busca', async () => {
    const r = await banco.comoUsuario(gestor, async (e) => {
      await e(`INSERT INTO empresa (cnpj, razao_social, telefone)
               VALUES ('11444777000161', 'Beta Comercio', '1133334444')`)
      return e<{ busca: string }>("SELECT busca FROM empresa WHERE cnpj = '11444777000161'")
    })
    expect(r.linhas[0].busca).toBe('beta comercio ')
  })

  test('a coluna busca é gerada: ninguém escreve nela', async () => {
    await expect(
      banco.comoUsuario(gestor, (e) =>
        e(`INSERT INTO empresa (cnpj, razao_social, telefone, busca)
           VALUES ('11222333000262', 'Gama', '1133334444', 'qualquer')`),
      ),
    ).rejects.toMatchObject({ code: '428C9' })
  })
})


test('busca e ordena o nome comercial parcial mantendo os nulos reais em lista, perfil e grupo', async () => {
  const vendedor = await criarUsuario(banco, 'vendedor', 'VendedorParcial')
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone) VALUES (NULL,NULL,'Alfa Câmeras Aurora','11955555555') RETURNING id")
  await vincularGrupoAtivo(banco, [id])
  const consulta = lerConsulta({ q: 'cameras aurora' })
  const lista = await listarEmpresas(gestor, consulta)
  expect(lista).toMatchObject({ ok: true, linhas: [{ id, cnpj: null, razaoSocial: null, nomeFantasia: 'Alfa Câmeras Aurora' }] })
  const filtros = { nome: 'cameras aurora', cnae: null, uf: null, cidade: null, bairro: null, pagina: 1 }
  expect(await consultarEmpresas(vendedor, filtros)).toMatchObject({ ok: true, empresas: [{ id, razaoSocial: null, nomeFantasia: 'Alfa Câmeras Aurora' }] })
  expect(await lerPerfil(vendedor, id)).toMatchObject({ ok: true, empresa: { id, razaoSocial: null, nomeFantasia: 'Alfa Câmeras Aurora' } })
  expect(await listarSugestoes(vendedor)).toMatchObject({ ok: true, empresas: [{ id }] })
  const [{ grupo_id }] = await banco.sql<{ grupo_id: string }>('SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1', [id])
  expect(await detalharGrupo(gestor, grupo_id)).toMatchObject({ ok: true, empresas: [{ id, cnpj: null, razaoSocial: null, nomeFantasia: 'Alfa Câmeras Aurora' }] })
})

test('consultas SQL usam fantasia no desempate sem incluir empresas sem origem ativa', async () => {
  const vendedor = await criarUsuario(banco, 'vendedor', 'VendedorOrdemParcial')
  const empresas = await banco.sql<{ id: string; nome_fantasia: string }>(`INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone) VALUES
    (NULL,NULL,'Ordem Alfa','11966666666'),(NULL,'Ordem Zeta',NULL,'11977777777'),
    (NULL,NULL,'Ordem Inativa','11988888888') RETURNING id,nome_fantasia`)
  await vincularGrupoAtivo(banco, empresas.slice(0,2).map(e => e.id))
  const consulta = await banco.comoUsuario(vendedor, e => e<{ id: string }>("SELECT id FROM empresa_consultar('Ordem',NULL,NULL,NULL,NULL,1)"))
  expect(consulta.linhas.map(e => e.id)).toEqual(empresas.slice(0,2).map(e => e.id))
  const sugestoes = await banco.comoUsuario(vendedor, e => e<{ id: string }>('SELECT id FROM empresa_sugestoes()'))
  expect(sugestoes.linhas.map(e => e.id).filter(id => empresas.some(e => e.id === id))).toEqual(empresas.slice(0,2).map(e => e.id))
})
