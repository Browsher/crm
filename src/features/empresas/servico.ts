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

export type ResultadoAnalise =
  | { ok: true; relatorio: Relatorio }
  | { ok: false; motivo: 'arquivo_invalido'; falha: FalhaDeArquivo }
  | Falha

export type ResultadoImportar =
  | { ok: true; relatorio: Relatorio; grupoId: string; inseridas: number; vinculadas: number }
  | { ok: false; motivo: 'arquivo_invalido'; falha: FalhaDeArquivo }
  | Falha

type Preparado = { relatorio: Relatorio; aceitas: LinhaAceita[] }

// As fases 0, 1 e 2, sem escrever nada. A conferência chama isto; a gravação
// chama de novo com o mesmo arquivo. É determinístico, então não há estado
// guardado no servidor entre uma coisa e outra.
async function preparar(
  repo: RepositorioEmpresas,
  fonte: FonteEmpresas,
): Promise<Preparado | Exclude<ResultadoAnalise, { ok: true }>> {
  const analise = await analisarArquivo(fonte)
  if (!analise.ok) return { ok: false, motivo: 'arquivo_invalido', falha: analise.falha }

  const cnpjs = analise.aceitas.map((l) => l.cnpj)
  const ceps = [...new Set(analise.aceitas.map((l) => l.cep).filter((c): c is string => c !== null))]
  const p = await repo.preparar(cnpjs, ceps)
  if ('motivo' in p) return p

  const novas = analise.aceitas.filter((l) => !p.jaCadastrados.has(l.cnpj))
  // CEP não encontrado NÃO recusa a empresa: ela entra sem endereço resolvido,
  // porque prospecção começa por telefone. O relatório só conta, e cita a data
  // da base para "não encontrado" não parecer defeito.
  const cepsNaoEncontrados = ceps.filter((c) => !p.enderecos.has(c)).length

  return {
    aceitas: analise.aceitas,
    relatorio: {
      novas: novas.length,
      jaCadastradas: analise.aceitas.length - novas.length,
      recusadas: analise.recusadas,
      cepsPedidos: ceps.length,
      cepsNaoEncontrados,
      basePublicadaEm: p.basePublicadaEm,
    },
  }
}

export async function analisar(repo: RepositorioEmpresas, fonte: FonteEmpresas): Promise<ResultadoAnalise> {
  const p = await preparar(repo, fonte)
  if ('ok' in p) return p
  return { ok: true, relatorio: p.relatorio }
}

export async function importar(
  repo: RepositorioEmpresas,
  fonte: FonteEmpresas,
  operacao: OperacaoGrupo,
): Promise<ResultadoImportar> {
  const p = await preparar(repo, fonte)
  if ('ok' in p) return p
  if (p.aceitas.length === 0) return { ok: false, motivo: 'sem_linhas_aceitas' }
  return repo.gravar(operacao, p.aceitas, p.relatorio)
}
