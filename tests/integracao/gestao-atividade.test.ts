import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { lerAtividadeGestao } from '@/src/features/gestao/atividade'
import { FILTROS_ATIVIDADE, type FiltrosAtividade } from '@/src/lib/atividade-gestao'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

const meiaNoite = "((now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo')"
let banco: BancoDeTeste
let gestor: string
let ana: string
let bia: string
let inativo: string
let sequencia = 0

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  ana = await criarUsuario(banco, 'vendedor', 'Ana')
  bia = await criarUsuario(banco, 'vendedor', 'Bia')
  inativo = await criarUsuario(banco, 'vendedor', 'Inativo')
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [inativo])
  await banco.sql('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
  await banco.sql('ALTER TABLE empresa_atendimento_operacao DISABLE TRIGGER empresa_atendimento_operacao_auditoria')
})

afterAll(async () => { await banco?.derrubar() })

beforeEach(async () => {
  await banco.sql('TRUNCATE empresa, busca_empresa, grupo_importacao, google_planejamento, arquivo_legado_operacao CASCADE')
})

function ler(filtros: Partial<FiltrosAtividade> = {}, modo?: Parameters<typeof lerAtividadeGestao>[2]) {
  return lerAtividadeGestao(gestor, { ...FILTROS_ATIVIDADE, ...filtros }, modo)
}

async function empresa() {
  const cnpj = String(++sequencia).padStart(14, '0')
  const [registro] = await banco.sql<{ id: string; cnpj: string }>(
    "INSERT INTO empresa(cnpj,razao_social,telefone) VALUES($1,$2,'11987654321') RETURNING id,cnpj",
    [cnpj, `Empresa ${sequencia}`],
  )
  return registro
}

async function arquivarLegado(empresaId: string) {
  await banco.sql(`WITH operacao AS (
    INSERT INTO arquivo_legado_operacao(manifesto,assinatura,backup_sha256)
    VALUES('{}',repeat('1',64),repeat('2',64)) RETURNING id
  ) INSERT INTO empresa_arquivo(empresa_id,operacao_id) SELECT $1,id FROM operacao`, [empresaId])
}

async function contato(empresaId: string, autor: string, segundos: number, tipo = 'interessado') {
  const [{ id }] = await banco.sql<{ id: string }>(`
    INSERT INTO contato(empresa_id,criado_por,criado_em,tipo,nota)
    VALUES($1,$2,${meiaNoite} + make_interval(secs => $3),$4,'Anotação') RETURNING id
  `, [empresaId, autor, segundos, tipo])
  return id
}

async function comando(empresaId: string, operacao: string, ok: boolean) {
  const [{ id }] = await banco.sql<{ id: string }>(`
    INSERT INTO empresa_atendimento_operacao(chave,usuario_id,empresa_id,operacao,entrada,resultado,criado_em)
    VALUES(gen_random_uuid(),$1,$2,$3,'{}',jsonb_build_object('ok',$4::boolean),${meiaNoite}) RETURNING id
  `, [ana, empresaId, operacao, ok])
  return id
}

async function grupo(empresaIds: string[], vinculadas = empresaIds.length) {
  const [{ id }] = await banco.sql<{ id: string }>(`
    WITH novo AS (
      INSERT INTO grupo_importacao(nome,vinculadas) VALUES('Busca de teste',$2) RETURNING id
    ), membros AS (
      INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT novo.id,unnest($1::uuid[]) FROM novo
    ) SELECT id FROM novo
  `, [empresaIds, vinculadas])
  return id
}

async function busca({ vendedor = ana, cnpjs = [], grupoId = null, estado = 'concluida', automatica = false, segundos = 0 }: {
  vendedor?: string; cnpjs?: string[]; grupoId?: string | null; estado?: string; automatica?: boolean; segundos?: number
} = {}) {
  const [{ id }] = await banco.sql<{ id: string }>(`
    INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,empresas,grupo_id,estado,inclusao_automatica_concluida,
      criado_em,concluido_em,motivo)
    VALUES($1,'Fornecedores','{"bairro":"Centro","cidade":"Santos","uf":"SP"}',50,$2,$3,$4,$5,
      ${meiaNoite} + make_interval(secs => $6) - interval '5 minutes',
      CASE WHEN $4 <> 'reservada' THEN ${meiaNoite} + make_interval(secs => $6) END,
      CASE WHEN $4 = 'falhou' THEN 'sem_creditos' END) RETURNING id
  `, [vendedor, JSON.stringify(cnpjs.map(cnpj => ({ cnpj }))), grupoId, estado, automatica, segundos])
  return id
}

test('autoriza somente gestores ativos e filtra pelo vendedor ativo que registrou o evento', async () => {
  const { id } = await empresa()
  const deAna = await contato(id, ana, 0)
  const deBia = await contato(id, bia, 1)
  await contato(id, inativo, 2)
  await contato(id, gestor, 3)
  const gestorInativo = await criarUsuario(banco, 'gestor', 'GestorInativo')
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [gestorInativo])

  expect(await lerAtividadeGestao(ana, FILTROS_ATIVIDADE)).toBeNull()
  expect(await lerAtividadeGestao(gestorInativo, FILTROS_ATIVIDADE)).toBeNull()
  expect((await ler())?.eventos.map(evento => evento.id)).toEqual([deBia, deAna])
  expect((await ler({ vendedorId: ana }))?.eventos.map(evento => evento.id)).toEqual([deAna])
  expect(await ler({ vendedorId: inativo })).toMatchObject({ eventos: [], total: 0, referencia: expect.any(String) })
})

test('usa a meia-noite de Brasília e limita os últimos sete dias a sete datas locais', async () => {
  const { id } = await empresa()
  const hoje = await contato(id, ana, 0)
  const ontem = await contato(id, ana, -1)
  const inicio = await contato(id, ana, -6 * 86400)
  await contato(id, ana, -6 * 86400 - 1)
  await contato(id, ana, 86400)

  expect((await ler({ periodo: 'hoje' }))?.eventos.map(evento => evento.id)).toEqual([hoje])
  expect((await ler({ periodo: 'ontem' }))?.eventos.map(evento => evento.id)).toEqual([ontem])
  expect((await ler())?.eventos.map(evento => evento.id)).toEqual([hoje, ontem, inicio])
})

test('pagina com desempate estável e mantém o total mesmo fora da última página', async () => {
  const { id } = await empresa()
  const ids = await banco.sql<{ id: string }>(`
    INSERT INTO contato(empresa_id,criado_por,criado_em,tipo)
    SELECT $1,$2,${meiaNoite},'interessado' FROM generate_series(1,21) RETURNING id
  `, [id, ana])
  const ordem = ids.map(registro => registro.id).sort().reverse()
  const primeira = await ler()
  const segunda = await ler({ pagina: 2 })

  expect(primeira?.eventos.map(evento => evento.id)).toEqual(ordem.slice(0, 20))
  expect(segunda?.eventos.map(evento => evento.id)).toEqual(ordem.slice(20))
  expect(segunda?.total).toBe(21)
  expect(await ler({ pagina: 3 })).toMatchObject({ eventos: [], total: 21 })
  expect((await ler({}, 'destaques'))?.eventos.map(evento => evento.id)).toEqual(ordem.slice(0, 10))
})

test('usa o registro comercial correto e exclui empresas do arquivo legado', async () => {
  const { id } = await empresa()
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [id, bia])
  const [{ id: negociacao }] = await banco.sql<{ id: string }>(
    'INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2) RETURNING id', [id, bia],
  )
  await banco.sql(`INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave,negociacao_id,criada_em)
    VALUES($1,$2,DATE '2020-05-01',8900,gen_random_uuid(),$3,${meiaNoite}),
      ($1,$2,DATE '2020-05-02',1600,gen_random_uuid(),NULL,${meiaNoite} + interval '1 second')`, [id, bia, negociacao])
  const semInteresse = await contato(id, ana, 0, 'sem_interesse')
  await comando(id, 'contato', true)
  const funil = await Promise.all(['arquivar', 'retomar', 'devolver_funil'].map(operacao => comando(id, operacao, true)))
  await comando(id, 'retomar', false)
  const acompanhamento = await contato(id, ana, 0, 'acompanhamento')
  const naoAtendeu = await contato(id, ana, 0, 'nao_atendeu')
  const naoLiguei = await contato(id, ana, 0, 'nao_liguei')
  const arquivo = await empresa()
  await contato(arquivo.id, ana, 0)
  await comando(arquivo.id, 'retomar', true)
  await arquivarLegado(arquivo.id)

  expect((await ler({ tipo: 'venda' }))?.eventos).toMatchObject([
    { vendedorId: bia, subtipo: 'recompra', dados: { dataVenda: '2020-05-02', valorCentavos: '1600' } },
    { vendedorId: bia, subtipo: 'primeira_venda', dados: { dataVenda: '2020-05-01', valorCentavos: '8900' } },
  ])
  const atendimentos = (await ler({ tipo: 'contato' }))?.eventos ?? []
  expect(atendimentos.map(evento => evento.id).sort()).toEqual([acompanhamento, naoAtendeu, naoLiguei].sort())
  expect(atendimentos.find(evento => evento.id === acompanhamento)).toMatchObject({ vendedorId: ana, dados: { nota: 'Anotação' } })
  expect((await ler({ tipo: 'funil' }))?.eventos.map(evento => evento.id).sort()).toEqual([semInteresse, ...funil].sort())
  expect((await ler({ tipo: 'contato' }, 'destaques'))?.eventos).toEqual([])
})

test('Banco distingue resultados, entregas confirmadas, ausência de entrega e inclusão incompleta', async () => {
  const entregue = await empresa()
  const fora = await empresa()
  const grupoId = await grupo([entregue.id])
  await banco.sql(`INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,recebida_em)
    VALUES($1,$2,'banco',${meiaNoite} + interval '1 minute')`, [entregue.id, ana])
  const manual = await busca({ cnpjs: [entregue.cnpj, fora.cnpj], grupoId })
  const semResultado = await busca()
  const automaticoSemEntrega = await busca({ cnpjs: [fora.cnpj], automatica: true })
  const incompleta = await busca({ cnpjs: [fora.cnpj] })
  await busca({ estado: 'reservada' })
  await arquivarLegado(entregue.id)

  const eventos = (await ler({ tipo: 'banco' }))?.eventos ?? []
  const entregas = Object.fromEntries(eventos.map(evento => [evento.id, evento.dados.entregues]))
  expect(entregas).toEqual({ [manual]: 1, [semResultado]: 0, [automaticoSemEntrega]: 0, [incompleta]: null })
  expect(eventos[0]).toMatchObject({ id: manual, dados: { solicitadas: 50, retornadas: 2, regiao: 'Centro, Santos, SP' } })
  expect((await ler({}, 'destaques'))?.eventos.map(evento => evento.id)).toEqual([manual])
})

test('Banco preserva a incerteza quando faltam provas ou quando um vínculo pode pertencer a duas buscas', async () => {
  const antiga = await empresa()
  const outroVendedor = await empresa()
  const semVinculo = await empresa()
  const faltandoMembro = await empresa()
  const foraDaResposta = await empresa()
  const compartilhada = await empresa()
  await banco.sql(`INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,recebida_em)
    SELECT empresa_id, vendedor_id,'banco',${meiaNoite} FROM unnest($1::uuid[],$2::uuid[]) AS vinculos(empresa_id,vendedor_id)`,
  [[antiga.id, outroVendedor.id, faltandoMembro.id, foraDaResposta.id, compartilhada.id], [ana, bia, ana, ana, ana]])
  const buscasAmbiguas = [
    await busca({ cnpjs: [antiga.cnpj], grupoId: await grupo([antiga.id]) }),
    await busca({ cnpjs: [antiga.cnpj], grupoId: await grupo([antiga.id]) }),
    await busca({ cnpjs: [outroVendedor.cnpj], grupoId: await grupo([outroVendedor.id]) }),
    await busca({ cnpjs: [semVinculo.cnpj], grupoId: await grupo([semVinculo.id]) }),
    await busca({ cnpjs: [faltandoMembro.cnpj], grupoId: await grupo([faltandoMembro.id], 2) }),
    await busca({ cnpjs: [faltandoMembro.cnpj], grupoId: await grupo([foraDaResposta.id]) }),
  ]
  const grupoCompartilhado = await grupo([compartilhada.id])
  buscasAmbiguas.push(
    await busca({ cnpjs: [compartilhada.cnpj], grupoId: grupoCompartilhado }),
    await busca({ cnpjs: [compartilhada.cnpj], grupoId: grupoCompartilhado, vendedor: bia }),
  )

  const eventos = (await ler({ tipo: 'banco' }))?.eventos ?? []
  expect(eventos.map(evento => evento.id).sort()).toEqual(buscasAmbiguas.sort())
  expect(eventos.every(evento => evento.dados.entregues === null)).toBe(true)
})

test('Banco atribui vínculo legado à busca manual concluída na data de recebimento', async () => {
  const empresaLegada = await empresa()
  await banco.sql(`INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,recebida_em)
    VALUES($1,$2,'banco',${meiaNoite} - interval '1 second')`, [empresaLegada.id, ana])
  const inicial = await busca({ cnpjs: [empresaLegada.cnpj], grupoId: await grupo([empresaLegada.id]), segundos: -1 })
  const posterior = await busca({ cnpjs: [empresaLegada.cnpj], grupoId: await grupo([empresaLegada.id]) })

  expect((await ler({ tipo: 'banco', periodo: 'ontem' }))?.eventos).toMatchObject([{ id: inicial, dados: { entregues: 1 } }])
  expect((await ler({ tipo: 'banco', periodo: 'hoje' }))?.eventos).toMatchObject([{ id: posterior, dados: { entregues: null } }])
})

test('Banco mostra uma busca antiga no dia em que a entrega foi confirmada', async () => {
  const entregue = await empresa()
  const grupoId = await grupo([entregue.id])
  await banco.sql(`INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,recebida_em)
    VALUES($1,$2,'banco',${meiaNoite})`, [entregue.id, ana])
  const id = await busca({ cnpjs: [entregue.cnpj], grupoId, segundos: -14 * 86400 })

  expect((await ler({ tipo: 'banco', periodo: 'hoje' }))?.eventos).toMatchObject([{ id, dados: { entregues: 1 } }])
})

test('Banco confirma entrega se conclusão e inclusão usaram a mesma transação', async () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const empresa = { cnpj: '99887766000369', razao_social: 'Comércio de teste', telefone: '11955550888', telefones: ['11955550888'] }
  const filtros = { palavra: 'comércio', cnae: '', uf: 'SP', cidade: 'Santos', bairro: '', porte: '', tipo: '',
    contato: 'telefoneoucelular', quantidade: 1, offset: 0 }
  await banco.sql('INSERT INTO busca_empresa_limite(usuario_id,limite_diario) VALUES($1,10)', [ana])
  await banco.comoUsuario(ana, async executar => {
    await executar('SELECT busca_empresa_reservar($1,$2,$3)', [id, 'Comércio em Santos', filtros])
    await executar('SELECT busca_empresa_concluir($1,$2,NULL)', [id, JSON.stringify([empresa])])
    await executar('SELECT * FROM busca_empresa_importar($1,NULL)', [id])
  })

  expect((await ler({ tipo: 'banco' }))?.eventos).toMatchObject([{ id, dados: { entregues: 1 } }])
})

test('Google conta entregas registradas por pedido, mesmo em andamento e depois de arquivadas', async () => {
  const { id: entregue } = await empresa()
  const { id: duplicada } = await empresa()
  const [{ id: pedido }] = await banco.sql<{ id: string }>(`
    INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,estado,iniciado_em)
    VALUES($1,DATE '2026-10-26','Comércio','','Santos','SP','coletando',${meiaNoite}) RETURNING id
  `, [ana])
  await banco.sql(`INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em)
    VALUES($1,0,$2,'{}','entregue',${meiaNoite} - interval '1 minute'),
      ($1,1,$2,'{}','entregue',${meiaNoite}),
      ($1,2,$3,'{}','entregue',NULL),
      ($1,3,NULL,'{}','entregue',${meiaNoite}),
      ($1,4,$3,'{}','repetida',${meiaNoite})`, [pedido, entregue, duplicada])
  await banco.sql(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,estado,iniciado_em)
    VALUES($1,DATE '2026-10-27','Comércio','','Santos','SP','coletando',${meiaNoite})`, [ana])
  await arquivarLegado(entregue)

  expect((await ler({ tipo: 'google', periodo: 'hoje' }))?.eventos).toMatchObject([
    { id: pedido, subtipo: 'coletando', dados: { nome: 'Comércio', regiao: 'Santos, SP', entregues: 1 } },
  ])
  expect((await ler({ tipo: 'google', periodo: 'ontem' }))?.eventos).toEqual([])
})

test('mostra falhas recentes no histórico, no alerta geral e nos destaques do vendedor', async () => {
  const bancoFalhou = await busca({ estado: 'falhou' })
  await busca({ estado: 'falhou', vendedor: bia, segundos: -3 })
  const [{ id: googleFalhou }] = await banco.sql<{ id: string }>(`
    INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,estado,iniciado_em,motivo)
    VALUES($1,DATE '2026-10-26','Comércio','','Santos','SP','falhou',${meiaNoite} + interval '1 second','Coleta interrompida') RETURNING id
  `, [ana])
  await busca({ estado: 'falhou', vendedor: inativo, segundos: 2 })

  expect((await ler({ tipo: 'falha', periodo: 'hoje' }))?.eventos).toMatchObject([
    { id: googleFalhou, categoria: 'google', subtipo: 'falhou' },
    { id: bancoFalhou, categoria: 'banco', subtipo: 'falhou', dados: { motivo: 'sem_creditos' } },
  ])
  expect((await ler({ tipo: 'banco', periodo: 'hoje' }))?.eventos.map(evento => evento.id)).toEqual([bancoFalhou])
  expect((await ler({ tipo: 'google', periodo: 'hoje' }))?.eventos.map(evento => evento.id)).toEqual([googleFalhou])
  expect((await ler({ periodo: 'hoje' }, 'alerta'))?.eventos.map(evento => evento.id)).toEqual([googleFalhou])
  expect((await ler({}, 'destaques'))?.eventos).toEqual([])
  expect((await ler({ vendedorId: ana }, 'destaques'))?.eventos.map(evento => evento.id)).toEqual([googleFalhou, bancoFalhou])
})

test('data a falha Google pelo espelho da transição de estado quando não há conclusão', async () => {
  const [{ id }] = await banco.sql<{ id: string }>(`
    INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,estado,iniciado_em)
    VALUES($1,DATE '2026-10-26','Comércio','','Santos','SP','coletando',${meiaNoite} - interval '3 days') RETURNING id
  `, [ana])
  await banco.sql("UPDATE google_planejamento SET estado='falhou',motivo='Coleta interrompida' WHERE id=$1", [id])
  await banco.sql(`UPDATE google_sincronizacao SET confirmada_em=${meiaNoite} - interval '1 day' WHERE pedido_id=$1`, [id])

  expect((await ler({ periodo: 'hoje' }, 'alerta'))?.eventos).toMatchObject([{ id, subtipo: 'falhou' }])
  expect((await ler({ periodo: 'ontem' }, 'alerta'))?.eventos).toEqual([])
})
