import { resolverIdentidade } from './identidade'
import { analisarArquivo, type FonteEmpresas } from './arquivo'
import type { FalhaDeArquivo, LinhaAceita, Recusa } from './planilha'
import type { Falha, OperacaoGrupo, RepositorioEmpresas } from './repositorio'

export type Relatorio = {
  novas: number
  jaCadastradas: number
  recusadas: Recusa[]
  // CEPs distintos que o arquivo trouxe, e quantos deles a base não resolveu.
  cepsPedidos: number
  cepsNaoEncontrados: number
  // Nulo significa `cep_carga` vazia, ou seja: a base nunca foi carregada
  // neste banco. É estado diferente de "o CEP não existe na base", e a tela
  // precisa dos dois separados — ver textoDoEndereco em mensagens.ts.
  basePublicadaEm: string | null
}

export type Conferencia = {
  linhasAceitas: number[]
  recusadasIdentidade: Extract<Recusa, { tipo: 'identidade' }>[]
}

export type ResultadoAnalise =
  | { ok: true; relatorio: Relatorio; conferencia: Conferencia }
  | { ok: false; motivo: 'arquivo_invalido'; falha: FalhaDeArquivo }
  | Falha

export type ResultadoImportar =
  | { ok: true; relatorio: Relatorio; grupoId: string; inseridas: number; vinculadas: number }
  | { ok: false; motivo: 'arquivo_invalido'; falha: FalhaDeArquivo }
  | Falha

type Preparado = { relatorio: Relatorio; aceitas: LinhaAceita[]; linhasDoArquivo: LinhaAceita[]; novasPorLinha: Set<number> }

// As fases 0, 1 e 2, sem escrever nada. A conferência chama isto; a gravação
// chama de novo com o mesmo arquivo. O comprovante autenticado conserva a
// seleção aprovada; a classificação cadastral pode mudar entre requisições.
async function preparar(
  repo: RepositorioEmpresas,
  fonte: FonteEmpresas,
): Promise<Preparado | Exclude<ResultadoAnalise, { ok: true }>> {
  const analise = await analisarArquivo(fonte)
  if (!analise.ok) return { ok: false, motivo: 'arquivo_invalido', falha: analise.falha }

  const ceps = [...new Set(analise.aceitas.map((l) => l.cep).filter((c): c is string => c !== null))]
  const p = await repo.preparar(analise.aceitas, ceps)
  if ('motivo' in p) return p

  const aceitas: LinhaAceita[] = []
  const recusadas = [...analise.recusadas]
  const novasPorLinha = new Set<number>()
  for (const linha of analise.aceitas) {
    const identidade = resolverIdentidade(linha, p)
    if (!identidade.ok) {
      recusadas.push({ tipo: 'identidade', linha: linha.linha, motivo: identidade.motivo })
      continue
    }
    aceitas.push(linha)
    if (identidade.empresaId === null) novasPorLinha.add(linha.linha)
  }
  recusadas.sort((a, b) => a.linha - b.linha)
  // CEP não encontrado NÃO recusa a empresa: ela entra sem endereço resolvido,
  // porque prospecção começa por telefone. O relatório só conta, e cita a data
  // da base para "não encontrado" não parecer defeito.
  const cepsNaoEncontrados = ceps.filter((c) => !p.enderecos.has(c)).length

  return {
    aceitas,
    linhasDoArquivo: analise.aceitas,
    novasPorLinha,
    relatorio: {
      novas: novasPorLinha.size,
      jaCadastradas: aceitas.length - novasPorLinha.size,
      recusadas,
      cepsPedidos: ceps.length,
      cepsNaoEncontrados,
      basePublicadaEm: p.basePublicadaEm,
    },
  }
}

export async function analisar(repo: RepositorioEmpresas, fonte: FonteEmpresas): Promise<ResultadoAnalise> {
  const p = await preparar(repo, fonte)
  if ('ok' in p) return p
  return { ok: true, relatorio: p.relatorio, conferencia: {
    linhasAceitas: p.aceitas.map(l => l.linha),
    recusadasIdentidade: p.relatorio.recusadas.filter((r): r is Extract<Recusa, { tipo: 'identidade' }> => r.tipo === 'identidade'),
  } }
}

export async function importar(
  repo: RepositorioEmpresas,
  fonte: FonteEmpresas,
  operacao: OperacaoGrupo,
  conferencia: Conferencia,
): Promise<ResultadoImportar> {
  const p = await preparar(repo, fonte)
  if ('ok' in p) return p
  // A seleção foi autenticada pela Action. Reparsear conserva exatamente essas
  // linhas, mesmo se uma identidade mudou: SQL revalida tudo ou devolve o replay
  // persistido antes de resolver cadastros. Filtrar pela classificação atual
  // apagaria conflitos novos e impediria retries legítimos após o primeiro commit.
  const numeros = new Set(conferencia.linhasAceitas)
  const selecionadas = p.linhasDoArquivo.filter(l => numeros.has(l.linha))
  if (numeros.size !== conferencia.linhasAceitas.length || selecionadas.length !== numeros.size) return { ok: false, motivo: 'confirmacao_invalida' }
  if (selecionadas.length === 0) return { ok: false, motivo: 'sem_linhas_aceitas' }
  const novas = selecionadas.filter(l => p.novasPorLinha.has(l.linha)).length
  const relatorio = { ...p.relatorio, novas, jaCadastradas: selecionadas.length - novas,
    recusadas: [...p.relatorio.recusadas.filter(r => r.tipo !== 'identidade'), ...conferencia.recusadasIdentidade].sort((a, b) => a.linha - b.linha),
  }
  return repo.gravar(operacao, selecionadas, relatorio)
}
