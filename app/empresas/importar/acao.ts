'use server'

import { textoDaFalhaDeArquivo, textoDoMotivo } from '@/src/features/empresas/mensagens'
import { repositorioPostgres } from '@/src/features/empresas/repositorio'
import {
  analisar,
  importar,
  type Relatorio,
  type ResultadoAnalise,
  type ResultadoImportar,
} from '@/src/features/empresas/servico'
import { exigir } from '@/src/server/autenticacao/guarda'

export type EstadoImportar = {
  erro: string | null
  relatorio: Relatorio | null
  // Preenchido só depois de gravar: é o que troca a tela de "confira" para "pronto".
  inseridas: number | null
}

// NÃO exportar: arquivo com 'use server' só exporta função. Exportado, o Next
// transforma a constante numa referência de servidor e o cliente recebe uma
// função no lugar do objeto — foi o bug do estado inicial desta tela. O valor
// inicial vive no componente cliente, como em app/usuarios/formulario-criar.tsx.
// A catraca está em src/server/diretivas.test.ts.
const INICIAL: EstadoImportar = { erro: null, relatorio: null, inseridas: null }

export async function importarAcao(_anterior: EstadoImportar, form: FormData): Promise<EstadoImportar> {
  const eu = await exigir('gestor')
  if (form.get('limpar')) return INICIAL

  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ...INICIAL, erro: 'Escolha um arquivo CSV.' }
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const repo = repositorioPostgres(eu.usuarioId)

  // Os dois caminhos ficam separados, e não num `'inseridas' in r`, pelo mesmo
  // motivo documentado em app/usuarios/acoes.ts: perguntar por um campo numa
  // união não estreita o tipo — o membro sem o campo ganha a propriedade como
  // `unknown` em vez de sumir da união.
  //
  // Confirmar reenvia o MESMO arquivo e refaz as três fases. Sem estado no
  // servidor entre a conferência e a gravação: nada a expirar, nada a limpar.
  if (form.get('confirmar') !== null) {
    const r = await importar(repo, bytes)
    if (!r.ok) return { ...INICIAL, erro: aoFalhar(r) }
    return { erro: null, relatorio: r.relatorio, inseridas: r.inseridas }
  }

  const r = await analisar(repo, bytes)
  if (!r.ok) return { ...INICIAL, erro: aoFalhar(r) }
  return { erro: null, relatorio: r.relatorio, inseridas: null }
}

function aoFalhar(r: Extract<ResultadoAnalise | ResultadoImportar, { ok: false }>): string {
  return r.motivo === 'arquivo_invalido' ? textoDaFalhaDeArquivo(r.falha) : textoDoMotivo(r.motivo)
}
