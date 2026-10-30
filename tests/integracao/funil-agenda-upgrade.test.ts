import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { lerMigracoes, PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { lerNegociacao } from '@/src/features/funil/consulta'
import { lerAgendaAtendimento } from '@/src/server/atendimento/consulta'
import { criarBancoDeTeste, criarUsuario } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'

test('upgrade real 0049 conserva histórico de autores distintos e Funil segue a agenda classificada pela 0050', async () => {
  // Inicializa o login do harness local antes de preparar o esquema legado.
  const inicial = await criarBancoDeTeste(); await inicial.derrubar()
  const banco = await criarBancoDeTeste({ semMigracoes: true })
  const pasta = await mkdtemp(join(tmpdir(), 'crm-agenda-upgrade-'))
  try {
    for (const m of (await lerMigracoes(PASTA_MIGRACOES)).filter(m => m.nome < '0050')) await copyFile(join(PASTA_MIGRACOES, m.nome), join(pasta, m.nome))
    expect((await aplicar(banco.urlAdmin, pasta)).ok).toBe(true)
    const a = await criarUsuario(banco, 'vendedor', 'AgendaLegadaA'), b = await criarUsuario(banco, 'vendedor', 'AgendaLegadaB')
    const cenarios: { id: string; negociacao: string; passo: string | null; agenda: string | null }[] = []
    await banco.sql('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
    for (const passo of [null, 'Agenda vigente de B']) {
      const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Agenda legada','11987654321') RETURNING id")
      await vincularGrupoAtivo(banco, [id])
      await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [id, a])
      const [n] = await banco.sql<{ id: string }>('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2) RETURNING id', [id, a])
      await banco.sql("INSERT INTO contato(empresa_id,criado_por,tipo,proximo_passo,proximo_passo_data,criado_em) VALUES($1,$2,'interessado','Histórico de A','2026-01-01','2026-01-01')", [id, a])
      const [c] = await banco.sql<{ id: string }>("INSERT INTO contato(empresa_id,criado_por,tipo,proximo_passo,proximo_passo_data,criado_em) VALUES($1,$2,'acompanhamento',$3,$4,'2026-01-02') RETURNING id", [id, b, passo, passo ? '2026-01-03' : null])
      cenarios.push({ id, negociacao: n.id, passo, agenda: passo ? c.id : null })
    }
    await banco.sql('ALTER TABLE contato ENABLE TRIGGER contato_auditoria')
    const antes = await banco.sql('SELECT * FROM contato ORDER BY id')
    expect((await aplicar(banco.urlAdmin, PASTA_MIGRACOES)).ok).toBe(true)
    expect(await banco.sql('SELECT * FROM contato ORDER BY id')).toEqual(antes)
    for (const c of cenarios) {
      expect(await banco.sql('SELECT vendedor_id,agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [c.id])).toEqual([{ vendedor_id: a, agenda_contato_id: c.agenda }])
      expect(await lerNegociacao(a, c.negociacao)).toMatchObject({ proximoPasso: c.passo, retorno: c.passo ? '2026-01-03' : null, historico: [expect.objectContaining({ proximoPasso: 'Histórico de A' })] })
      const agenda = await lerAgendaAtendimento(a)
      expect(agenda.ok && agenda.linhas.find(e => e.id === c.id)?.proximoPasso || null).toBe(c.passo)
      expect(await lerNegociacao(b, c.negociacao)).toBeNull()
    }
  } finally { await banco.derrubar(); await rm(pasta, { recursive: true, force: true }) }
})
