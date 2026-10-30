import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'
import { cenarioAtendimento } from './atendimento-fixtures'
import { randomUUID } from 'node:crypto'
import { listarEmpresas } from '@/src/features/empresas/listagem'
import { lerConsulta } from '@/src/features/empresas/consulta'
import { comAdmin } from '@/src/server/db/admin'
import { lerDashboard } from '@/src/features/gestao/consulta'
import { lerEmpresasAtendimento } from '@/src/server/atendimento/consulta'
import { listarGrupos } from '@/src/features/empresas/grupos'

let banco: BancoDeTeste
let c: Awaited<ReturnType<typeof cenarioAtendimento>>
let grupos: string[]
let manifesto: unknown
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  c = await cenarioAtendimento(banco)
  grupos = (await banco.sql<{ grupo_id: string }>('SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1', [c.empresaId])).map(g => g.grupo_id)
  await banco.sql("INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data) VALUES($1,'interessado','Histórico original','Ligar amanhã',CURRENT_DATE) RETURNING id", [c.empresaId]).then(async linhas => {
    await banco.sql('UPDATE empresa_vinculo SET agenda_contato_id=$2 WHERE empresa_id=$1', [c.empresaId, (linhas[0] as { id: string }).id])
  })
  await banco.sql('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2)', [c.empresaId, c.vendedorId])
})
afterAll(async () => { await banco?.derrubar() })

test('simulação, aplicação e repetição preservam histórico e retiram operação ativa', async () => {
  const original = await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [c.empresaId])
  manifesto = (await banco.sql<{ m: unknown }>('SELECT arquivo_legado_manifesto($1::uuid[]) AS m', [grupos]))[0].m
  expect(manifesto).toBeTruthy()
  expect((await banco.sql('SELECT * FROM empresa_arquivo'))).toEqual([])
  await banco.sql('SELECT arquivo_legado_aplicar($1::jsonb,$2)', [manifesto, 'a'.repeat(64)])
  await banco.sql('SELECT arquivo_legado_aplicar($1::jsonb,$2)', [manifesto, 'a'.repeat(64)])
  expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [c.empresaId])).toEqual(original)
  expect(await banco.sql('SELECT encerramento FROM negociacao WHERE empresa_id=$1', [c.empresaId])).toEqual([{ encerramento: 'arquivamento_legado' }])
  expect(await banco.sql('SELECT agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [c.empresaId])).toEqual([{ agenda_contato_id: null }])
  const lista = await listarEmpresas(c.gestorId, lerConsulta({}))
  expect(lista.ok && lista.linhas.some(e => e.id === c.empresaId)).toBe(false)
  const historico = await banco.comoUsuario(c.gestorId, e => e<{ r: { dados: { situacao: string } } }>('SELECT empresa_detalhes_ler($1) AS r', [c.empresaId]))
  expect(historico.linhas[0].r.dados.situacao).toBe('arquivada')
  const dono = await banco.comoUsuario(c.vendedorId, e => e<{ r: { dados: { situacao: string } } }>('SELECT empresa_detalhes_ler($1) AS r', [c.empresaId]))
  expect(dono.linhas[0].r.dados.situacao).toBe('arquivada')
  const ativas = await lerEmpresasAtendimento(c.vendedorId)
  expect(ativas.ok && ativas.linhas.some(e => e.id === c.empresaId)).toBe(false)
  expect((await listarGrupos(c.gestorId)).ok && (await listarGrupos(c.gestorId) as { grupos: unknown[] }).grupos).toEqual([])
  expect((await listarEmpresas(c.gestorId, lerConsulta({}), true)).ok).toBe(true)
  const painel = await lerDashboard(c.gestorId)
  expect(painel?.vendedores.find(v => v.id === c.vendedorId)?.oportunidades).toBe(0)
  const prospeccao = await banco.comoUsuario(c.vendedorId, e => e<{ r: { total: number } }>('SELECT prospeccao_pessoal() AS r'))
  expect(prospeccao.linhas[0].r.total).toBe(0)
})

test('escrita comum, callback, retomada e reativação antiga não reanimam o arquivo', async () => {
  await expect(banco.comoUsuario(c.gestorId, e => e('UPDATE empresa_arquivo SET motivo=motivo'))).rejects.toMatchObject({ code: '42501' })
  await expect(banco.comoUsuario(c.vendedorId, e => e("INSERT INTO contato(empresa_id,tipo) VALUES($1,'nao_atendeu')", [c.empresaId]))).rejects.toBeTruthy()
  await expect(banco.comoUsuario(c.vendedorId, async e => {
    await e("SELECT set_config('app.arquivo_legado','true',true)")
    return e("INSERT INTO contato(empresa_id,tipo) VALUES($1,'nao_atendeu')", [c.empresaId])
  })).rejects.toMatchObject({ code: '42501' })
  await expect(banco.comoUsuario(c.gestorId, e => e('SELECT arquivo_legado_aplicar($1,$2)', [manifesto,'a'.repeat(64)]))).rejects.toMatchObject({ code: '42501' })
  await expect(banco.sql("INSERT INTO contato(empresa_id,tipo) VALUES($1,'nao_atendeu')", [c.empresaId])).rejects.toMatchObject({ code: '23514' })
  await expect(banco.comoUsuario(c.gestorId, e => e('SELECT grupo_importacao_situacao_definir($1,true)', [grupos[0]]))).rejects.toBeTruthy()
  expect((await banco.sql<{ r: string }>("SELECT empresa_vincular_entrega($1,$2,'google') AS r", [c.empresaId,c.vendedorId]))[0].r).toBe('indisponivel')
  const r = await banco.comoUsuario(c.vendedorId, e => e<{ r: { ok: boolean } }>('SELECT empresa_atendimento_retomar($1,$2,1) AS r', [c.empresaId,randomUUID()]))
  expect(r.linhas[0].r.ok).toBe(false)
})

test('manifesto divergente, grupo vazio e empresa compartilhada falham fechados', async () => {
  await expect(banco.sql('SELECT arquivo_legado_manifesto($1::uuid[])', [[]])).rejects.toBeTruthy()
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO grupo_importacao(nome) VALUES('Vazio') RETURNING id")
  await expect(banco.sql('SELECT arquivo_legado_manifesto($1::uuid[])', [[id]])).rejects.toBeTruthy()
  await expect(banco.sql('SELECT arquivo_legado_aplicar($1::jsonb,$2)', [{ grupos: [] }, 'a'.repeat(64)])).rejects.toBeTruthy()
})

async function alvo(nome: string, vinculo = true) {
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES($1,'11987654321') RETURNING id", [nome])
  const [{ id: grupo }] = await banco.sql<{ id: string }>('INSERT INTO grupo_importacao(nome) VALUES($1) RETURNING id', [nome])
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [grupo,id])
  if (vinculo) await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')", [id,c.vendedorId])
  return { id, grupo }
}
async function simular(grupo: string) { return (await banco.sql<{ m: unknown }>('SELECT arquivo_legado_manifesto($1::uuid[]) AS m', [[grupo]]))[0].m }

test('sem vínculo e pendência preservam atribuição original, sem inventar dono; venda permanece idêntica', async () => {
  const semDono = await alvo('Pendente sintética', false)
  await banco.sql("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,evidencias) VALUES($1,'sem_evidencia','{\"origem\":\"sintetica\"}')", [semDono.id])
  await banco.sql('SELECT arquivo_legado_aplicar($1::jsonb,$2)', [await simular(semDono.grupo),'b'.repeat(64)])
  expect(await banco.sql('SELECT vendedor_id FROM empresa_vinculo WHERE empresa_id=$1', [semDono.id])).toEqual([])
  expect(await banco.sql('SELECT motivo,evidencias,resolvida_por_arquivo_em IS NOT NULL AS resolvida FROM empresa_vinculo_pendencia WHERE empresa_id=$1', [semDono.id])).toEqual([{ motivo: 'sem_evidencia', evidencias: { origem: 'sintetica' }, resolvida: true }])
  const inventario = await banco.comoUsuario(c.gestorId, e => e<{ r: { dados: { pendencias: { empresaId: string }[] } } }>('SELECT atendimento_transicao_inventariar(NULL,100) AS r'))
  expect(inventario.linhas[0].r.dados.pendencias.some(p => p.empresaId === semDono.id)).toBe(false)
  const cliente = await alvo('Venda sintética')
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [cliente.id,c.vendedorId])
  await banco.sql('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave,observacao) VALUES($1,$2,CURRENT_DATE,12345,$3,\'Venda original\')', [cliente.id,c.vendedorId,randomUUID()])
  const chave = randomUUID()
  const hoje = (await banco.sql<{ hoje: string }>("SELECT CURRENT_DATE::text AS hoje"))[0].hoje
  const vender = (key: string) => banco.comoUsuario(c.vendedorId, e => e<{ r: string }>('SELECT carteira_venda_registrar($1,$2,$3,7890,NULL) AS r', [cliente.id,key,hoje]))
  expect((await vender(chave)).linhas[0].r).toBe('ok')
  const original = await banco.sql('SELECT * FROM venda WHERE empresa_id=$1', [cliente.id])
  await banco.sql('SELECT arquivo_legado_aplicar($1::jsonb,$2)', [await simular(cliente.grupo),'c'.repeat(64)])
  expect(await banco.sql('SELECT * FROM venda WHERE empresa_id=$1', [cliente.id])).toEqual(original)
  expect((await vender(chave)).linhas[0].r).toBe('ok')
  expect((await vender(randomUUID())).linhas[0].r).not.toBe('ok')
  const clientes = await banco.comoUsuario(c.vendedorId, e => e('SELECT * FROM minhas_empresas_clientes()'))
  expect(clientes.linhas).toEqual([])
})

test('empresa compartilhada e atividade posterior invalidam a simulação sem escrita parcial', async () => {
  const a = await alvo('Divergente sintética')
  const m = await simular(a.grupo)
  await banco.sql("INSERT INTO contato(empresa_id,tipo) VALUES($1,'nao_atendeu')", [a.id])
  await expect(banco.sql('SELECT arquivo_legado_aplicar($1::jsonb,$2)', [m,'d'.repeat(64)])).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT * FROM empresa_arquivo WHERE empresa_id=$1', [a.id])).toEqual([])
  const [{ id: outro }] = await banco.sql<{ id: string }>("INSERT INTO grupo_importacao(nome) VALUES('Outra origem sintética') RETURNING id")
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [outro,a.id])
  await expect(simular(a.grupo)).rejects.toMatchObject({ code: '22023' })
})

test('atendimento concorrente termina antes do arquivo e invalida manifesto; arquivo primeiro bloqueia nova escrita', async () => {
  const a = await alvo('Concorrência sintética')
  const m = await simular(a.grupo)
  await comAdmin(banco.urlAdmin, async primeiro => {
    await primeiro.query('BEGIN')
    await primeiro.query("INSERT INTO contato(empresa_id,tipo) VALUES($1,'nao_atendeu')", [a.id])
    try {
      await comAdmin(banco.urlAdmin, async segundo => {
        const pid = (await segundo.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid
        const tentativa = segundo.query('SELECT arquivo_legado_aplicar($1,$2)', [m,'e'.repeat(64)]).then(() => 'ok', (e: { code: string }) => e.code)
        try { await expect.poll(async () => (await banco.sql<{ espera: string }>('SELECT wait_event_type AS espera FROM pg_stat_activity WHERE pid=$1', [pid]))[0]?.espera).toBe('Lock') } finally { await primeiro.query('COMMIT') }
        expect(await tentativa).toBe('22023')
      })
    } finally { await primeiro.query('ROLLBACK') }
  })
  const atualizado = await simular(a.grupo)
  await comAdmin(banco.urlAdmin, async primeiro => {
    await primeiro.query('BEGIN')
    await primeiro.query('SELECT arquivo_legado_aplicar($1,$2)', [atualizado,'e'.repeat(64)])
    try {
      await comAdmin(banco.urlAdmin, async segundo => {
        const pid = (await segundo.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid
        const tentativa = segundo.query("INSERT INTO contato(empresa_id,tipo) VALUES($1,'nao_atendeu')", [a.id]).then(() => 'ok', (e: { code: string }) => e.code)
        try { await expect.poll(async () => (await banco.sql<{ espera: string }>('SELECT wait_event_type AS espera FROM pg_stat_activity WHERE pid=$1', [pid]))[0]?.espera).toBe('Lock') } finally { await primeiro.query('COMMIT') }
        expect(await tentativa).toBe('23514')
      })
    } finally { await primeiro.query('ROLLBACK') }
  })
})

test('mesmos critérios Google criam destino ativo novo e conservam a lista arquivada', async () => {
  const snapshot = { nicho: 'Sintético', bairro: 'Centro', cidade: 'Cidade sintética', uf: 'SP' }
  const [{ id }] = await banco.sql<{ id: string }>('SELECT google_grupo_destino($1,$2::jsonb) AS id', [c.vendedorId,snapshot])
  const a = await alvo('Google sintética')
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [id,a.id])
  await banco.sql('SELECT arquivo_legado_aplicar($1::jsonb,$2)', [(await banco.sql<{ m: unknown }>('SELECT arquivo_legado_manifesto($1::uuid[]) AS m', [[id,a.grupo]]))[0].m,'f'.repeat(64)])
  const [{ id: novo }] = await banco.sql<{ id: string }>('SELECT google_grupo_destino($1,$2::jsonb) AS id', [c.vendedorId,snapshot])
  expect(novo).not.toBe(id)
  expect((await banco.sql<{ id: string }>('SELECT google_grupo_destino($1,$2::jsonb) AS id', [c.vendedorId,snapshot]))[0].id).toBe(novo)
  expect(await banco.sql('SELECT ativo FROM grupo_importacao WHERE id=$1', [id])).toEqual([{ ativo: false }])
})

test('manifesto com histórico extenso cabe no registro; arquivo pagina e conta antes do corte', async () => {
  const a = await alvo('Paginação sintética', false)
  const empresas = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) SELECT 'Paginação sintética '||i,'11999998888' FROM generate_series(1,54) i RETURNING id")
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT $1,unnest($2::uuid[])', [a.grupo,empresas.map(e => e.id)])
  await banco.sql("INSERT INTO contato(empresa_id,tipo,nota) SELECT $1,'nao_atendeu',string_agg(md5(i::text),'') FROM generate_series(1,1000) i", [a.id])
  await banco.sql('SELECT arquivo_legado_aplicar($1,$2)', [await simular(a.grupo),'9'.repeat(64)])
  const primeira = await listarEmpresas(c.gestorId,lerConsulta({ q: 'Paginação sintética' }),true)
  const segunda = await listarEmpresas(c.gestorId,lerConsulta({ q: 'Paginação sintética', pagina: '2' }),true)
  expect(primeira.ok && primeira.total).toBe(55)
  expect(primeira.ok && primeira.linhas).toHaveLength(50)
  expect(segunda.ok && segunda.total).toBe(55)
  expect(segunda.ok && segunda.linhas).toHaveLength(5)
})

test('recente arquivada permanece preservada e não bloqueia contato em empresa ativa após dez visitas', async () => {
  const antiga = await alvo('Recente arquivada sintética')
  await banco.sql("INSERT INTO empresa_recente(usuario_id,empresa_id,acessada_em) VALUES($1,$2,now()-interval '2 days')", [c.vendedorId,antiga.id])
  await banco.sql('SELECT arquivo_legado_aplicar($1,$2)', [await simular(antiga.grupo),'8'.repeat(64)])
  let ativa = ''
  for (let i=0;i<11;i++) {
    ativa = (await alvo('Recente ativa sintética '+i)).id
    const r = await banco.comoUsuario(c.vendedorId,e => e<{ r: boolean }>('SELECT empresa_recente_registrar($1) AS r', [ativa]))
    expect(r.linhas[0].r).toBe(true)
  }
  const versao = (await banco.sql<{ versao: number }>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1', [ativa]))[0].versao
  const r = await banco.comoUsuario(c.vendedorId,e => e<{ r: { ok: boolean } }>("SELECT contato_registrar_direto($1,$2,$3,'nao_atendeu','Atividade válida',NULL,NULL) AS r", [ativa,randomUUID(),versao]))
  expect(r.linhas[0].r.ok).toBe(true)
  expect(await banco.sql('SELECT empresa_id FROM empresa_recente WHERE empresa_id=$1', [antiga.id])).toEqual([{ empresa_id: antiga.id }])
})

test('importação Casa com gate exclusivo não disputa lock de tabela com inserção aguardando o gate', async () => {
  const [{ id: busca }] = await banco.sql<{ id: string }>(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,fornecedor,empresas)
    VALUES($1,'Casa sintética','{}',1,'concluida','Casa dos Dados',$2) RETURNING id`, [c.vendedorId,JSON.stringify([{ cnpj: '11222333000181', razao_social: 'Casa sintética concorrente', telefone: '11912345678', telefones: ['11912345678'] }])])
  await comAdmin(banco.urlAdmin,async primeiro => {
    await primeiro.query('BEGIN')
    await primeiro.query('SET LOCAL ROLE app_usuario')
    await primeiro.query("SELECT set_config('app.usuario_id',$1,true)", [c.vendedorId])
    await primeiro.query('SELECT pg_advisory_xact_lock(27,1)')
    try {
      await comAdmin(banco.urlAdmin,async segundo => {
        const pid = (await segundo.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid
        const insercao = segundo.query("INSERT INTO empresa(razao_social,telefone) VALUES('Inserção concorrente sintética','11922223333')").then(() => 'ok',(e: { code: string }) => e.code)
        try {
          await expect.poll(async () => (await banco.sql<{ espera: string }>('SELECT wait_event_type AS espera FROM pg_stat_activity WHERE pid=$1', [pid]))[0]?.espera).toBe('Lock')
          const entrega = await primeiro.query('SELECT * FROM busca_empresa_importar($1,NULL)', [busca])
          expect(entrega.rows[0]).toMatchObject({ inseridas: 1, vinculadas: 1 })
        } finally { await primeiro.query('COMMIT') }
        expect(await insercao).toBe('ok')
      })
    } finally { await primeiro.query('ROLLBACK'); await primeiro.query('RESET ROLE') }
  })
})
