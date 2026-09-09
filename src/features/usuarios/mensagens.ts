import type { FaltaNovoUsuario } from './regras'
import type { Motivo } from './repositorio'
import type { ResultadoCriar, ResultadoNovaSenha, ResultadoSimples } from './servico'

type Falhou = Extract<ResultadoCriar | ResultadoNovaSenha | ResultadoSimples, { ok: false }>

// Um texto por motivo do repositório. Record, não if encadeado: motivo novo
// sem texto quebra o build.
const TEXTO_DO_MOTIVO: Record<Motivo, string> = {
  sem_permissao: 'Você não tem permissão para isso.',
  nao_encontrado: 'Usuário não encontrado. Recarregue a lista.',
  email_em_uso: 'Já existe usuário com esse e-mail.',
  alvo_inativo: 'Não dá para definir senha de um usuário desativado. Reative antes.',
  ja_nesse_estado: 'Esse usuário já está nesse estado. Recarregue a lista.',
}

const TEXTO_DA_FALTA: Record<FaltaNovoUsuario, string> = {
  nome_vazio: 'preencha o nome',
  email_invalido: 'informe um e-mail válido',
  papel_invalido: 'escolha um papel válido',
}

function junta(partes: string[]): string {
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

// `dados_invalidos` primeiro, e por igualdade positiva: excluir os três
// motivos de `Falha` um a um não estreita o tipo, porque o discriminante de
// `Falha` já é uma união de literais e o membro sobrevive com `motivo: never`.
export function mensagemDeUsuario(r: Falhou): string {
  if (r.motivo === 'dados_invalidos') {
    const texto = junta(r.faltas.map((f) => TEXTO_DA_FALTA[f]))
    return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`
  }
  return TEXTO_DO_MOTIVO[r.motivo]
}
