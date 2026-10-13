'use server'

import { emitirConferencia, verificarConferencia } from '@/src/features/empresas/conferencia'
import { createHash } from 'node:crypto'
import { textoDaFalhaDeArquivo, textoDoMotivo } from '@/src/features/empresas/mensagens'
import { formatoDoArquivo, LIMITE_BYTES_ARQUIVO } from '@/src/features/empresas/arquivo'
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
  grupoId: string | null
  conferencia: string | null
}

// NÃO exportar: arquivo com 'use server' só exporta função. Exportado, o Next
// transforma a constante numa referência de servidor e o cliente recebe uma
// função no lugar do objeto — foi o bug do estado inicial desta tela. O valor
// inicial vive no componente cliente, como em app/usuarios/formulario-criar.tsx.
// A catraca está em src/server/diretivas.test.ts.
const INICIAL: EstadoImportar = { erro: null, relatorio: null, inseridas: null, grupoId: null, conferencia: null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const CONTROLE = /[\u0000-\u001f\u007f-\u009f]/u

export async function importarAcao(_anterior: EstadoImportar, form: FormData): Promise<EstadoImportar> {
  const eu = await exigir('gestor')
  if (form.get('limpar')) return INICIAL

  const nome = form.get('nome')
  if (typeof nome !== 'string' || nome.trim() === '' || nome.length > 100 || CONTROLE.test(nome)) {
    return { ...INICIAL, erro: 'Informe um nome de grupo com até 100 caracteres.' }
  }

  const chave = form.get('chave')
  if (typeof chave !== 'string' || !UUID.test(chave)) {
    return { ...INICIAL, erro: 'A operação não pôde ser identificada. Confira novamente o arquivo.' }
  }

  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ...INICIAL, erro: 'Escolha um arquivo Excel (.xlsx) ou CSV UTF-8 (.csv).' }
  }

  const formato = formatoDoArquivo(arquivo.name, arquivo.type)
  if (formato === null) return { ...INICIAL, erro: textoDaFalhaDeArquivo({ motivo: 'formato_nao_suportado' }) }
  if (arquivo.size > LIMITE_BYTES_ARQUIVO) {
    return { ...INICIAL, erro: textoDaFalhaDeArquivo({ motivo: 'excede_tamanho' }) }
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const fonte = { formato, bytes }
  const repo = repositorioPostgres(eu.usuarioId)

  // Os dois caminhos ficam separados, e não num `'inseridas' in r`, pelo mesmo
  // motivo documentado em app/usuarios/acoes.ts: perguntar por um campo numa
  // união não estreita o tipo — o membro sem o campo ganha a propriedade como
  // `unknown` em vez de sumir da união.
  //
  // Confirmar reenvia o MESMO arquivo. O comprovante autentica a seleção
  // entre requisições sem persistir dados na conferência.
  const assinatura = createHash('sha256').update(bytes).digest('hex')
  const operacao = { chave, nome, arquivoNome: arquivo.name, assinatura }
  const contexto = { usuarioId: eu.usuarioId, operacao }
  if (form.get('confirmar') !== null) {
    const conferencia = verificarConferencia(form.get('conferencia'), contexto)
    if (conferencia === null) return { ...INICIAL, erro: textoDoMotivo('confirmacao_invalida') }
    const r = await importar(repo, fonte, operacao, conferencia)
    if (!r.ok) return { ...INICIAL, erro: aoFalhar(r) }
    return { erro: null, relatorio: r.relatorio, inseridas: r.inseridas, grupoId: r.grupoId, conferencia: null }
  }

  const r = await analisar(repo, fonte)
  if (!r.ok) return { ...INICIAL, erro: aoFalhar(r) }
  const conferencia = emitirConferencia(contexto, r.conferencia)
  if (conferencia === null) return { ...INICIAL, erro: 'Não foi possível concluir a conferência. Tente novamente mais tarde.' }
  return { erro: null, relatorio: r.relatorio, inseridas: null, grupoId: null, conferencia }
}

function aoFalhar(r: Extract<ResultadoAnalise | ResultadoImportar, { ok: false }>): string {
  return r.motivo === 'arquivo_invalido' ? textoDaFalhaDeArquivo(r.falha) : textoDoMotivo(r.motivo)
}
