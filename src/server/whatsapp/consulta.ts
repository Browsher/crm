import { listarVinculos } from './vinculos'
import { lerPaginaMensagens, type Mensagem } from './evolution'

export type Fonte = { id: string; nome: string; instancia: string }
export type Cursores = Record<string, { pagina: number; limite: string; temMais: boolean }>

export async function resolverFontes(usuarioId: string, filtro: string) {
  const vinculos = await listarVinculos(usuarioId)
  const vendedores = vinculos.filter(v => v.ativo).map(v => ({ id: v.id, nome: v.nome, instancia: v.instancia }))
  const instancia = process.env.EVOLUTION_INSTANCE_NAME?.trim()
  // Mesmo um vínculo inativo reserva a instância: nunca reabrir pelo piloto.
  const piloto = instancia && !vinculos.some(v => v.instancia === instancia)
    ? { id: 'piloto', nome: 'Número de teste', instancia } : null
  const opcoes = [...vendedores, ...(piloto ? [piloto] : [])]
  const fontes = filtro === 'todos' ? (vinculos.length ? vendedores : piloto ? [piloto] : [])
    : opcoes.filter(f => f.id === filtro)
  return { fontes, opcoes, vendedores }
}

function validarCursores(fontes: Fonte[], cursores: Cursores) {
  if (!cursores || typeof cursores !== 'object' || Array.isArray(cursores)
    || Object.keys(cursores).length !== fontes.length) throw new Error('Escopo do histórico mudou')
  for (const fonte of fontes) {
    const c = Object.hasOwn(cursores, fonte.id) ? cursores[fonte.id] : null
    const tempo = c && typeof c.limite === 'string' ? Date.parse(c.limite) : NaN
    if (!c || !Number.isSafeInteger(c.pagina) || c.pagina < 1 || c.pagina > 100000
      || typeof c.temMais !== 'boolean' || !Number.isFinite(tempo) || tempo < 0
      || new Date(tempo).toISOString() !== c.limite) throw new Error('Cursor inválido')
  }
}

export async function consultarFontes(usuarioId: string, filtro: string, anteriores?: Cursores) {
  const escopo = await resolverFontes(usuarioId, filtro)
  const { fontes } = escopo
  if (anteriores) validarCursores(fontes, anteriores)
  const limite = new Date().toISOString()
  const cursores: Cursores = Object.fromEntries(fontes.map(f => [f.id,
    anteriores?.[f.id] ?? { pagina: 1, limite, temMais: true }]))
  const mensagens: Mensagem[] = []
  const avisos: string[] = []
  let total = 0
  let configurado = fontes.length > 0
  for (let inicio = 0; inicio < fontes.length; inicio += 3) {
    await Promise.all(fontes.slice(inicio, inicio + 3).map(async fonte => {
      const cursor = cursores[fonte.id]
      if (!cursor.temMais) return
      try {
        const r = await lerPaginaMensagens(cursor.pagina, cursor.limite, fonte.instancia)
        if (!r.configurado) { configurado = false; avisos.push(fonte.nome); return }
        total += r.total
        mensagens.push(...r.mensagens.map(m => ({ ...m, fonteId: fonte.id, vendedor: fonte.nome })))
        cursores[fonte.id] = { ...cursor, pagina: cursor.pagina + 1, temMais: r.temMais }
      } catch { avisos.push(fonte.nome) }
    }))
  }
  return { ...escopo, mensagens: mensagens.toSorted((a, b) => b.em.localeCompare(a.em)), cursores,
    avisos, total, configurado, temMais: Object.values(cursores).some(c => c.temMais), limiteHistorico: limite }
}
