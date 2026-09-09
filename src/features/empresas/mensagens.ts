import { LIMITE_DE_LINHAS, type FalhaDeArquivo, type MotivoDeCampo, type Recusa } from './planilha'
import type { Motivo } from './repositorio'
import type { Relatorio } from './servico'

// Record, não if encadeado: motivo novo sem texto quebra o build.
const TEXTO_DO_MOTIVO: Record<Motivo, string> = {
  sem_permissao: 'Você não tem permissão para importar empresas.',
}

export function textoDoMotivo(m: Motivo): string {
  return TEXTO_DO_MOTIVO[m]
}

// As mensagens de estrago do Excel explicam a CAUSA. Sem isso o gestor lê
// "CNPJ inválido" e não descobre que a culpa é da formatação da coluna — e o
// conserto de trinta segundos vira uma tarde.
const TEXTO_DO_CAMPO: Record<MotivoDeCampo, (valor: string) => string> = {
  cnpj_vazio: () => 'CNPJ em branco.',
  cnpj_notacao_cientifica: (v) =>
    `CNPJ em notação científica (${v}) — os dígitos se perderam. Formate a coluna como Texto na planilha e preencha de novo.`,
  cnpj_forma: (v) => `CNPJ com formato inválido (${v}). São 14 caracteres.`,
  cnpj_dv: (v) => `CNPJ com dígito verificador errado (${v}). Confira na origem.`,
  razao_social_vazia: () => 'Razão social em branco.',
  telefone_vazio: () => 'Telefone em branco. Prospecção começa por telefone, então ele é obrigatório.',
  telefone_forma: (v) => `Telefone inválido (${v}). Informe DDD + número, com 10 ou 11 dígitos.`,
  email_forma: (v) => `E-mail inválido (${v}).`,
  cep_curto: (v) =>
    `CEP com 7 dígitos (${v}) — o zero à esquerda foi comido. Formate a coluna como Texto na planilha.`,
  cep_forma: (v) => `CEP inválido (${v}). São 8 dígitos.`,
  colunas_de_menos: (v) => `A linha tem ${v} colunas; o modelo tem 7.`,
}

export function textoDaRecusa(r: Recusa): string {
  if (r.tipo === 'campo') return `Linha ${r.linha}: ${TEXTO_DO_CAMPO[r.motivo](r.valor)}`
  const fim =
    r.divergencia === null
      ? 'as duas linhas são iguais, então apague uma.'
      : `as duas divergem na coluna ${r.divergencia}, então alguém precisa decidir qual está certa.`
  return `Linha ${r.linha}: CNPJ ${r.cnpj} repetido na linha ${r.par} — ${fim}`
}

export function textoDaFalhaDeArquivo(f: FalhaDeArquivo): string {
  switch (f.motivo) {
    case 'nao_utf8':
      return 'O arquivo não está em UTF-8. No Excel use Salvar como > CSV UTF-8 (delimitado por vírgulas) — a opção "CSV" comum grava em outro formato e estraga os acentos.'
    case 'vazio':
      return 'O arquivo não tem nenhuma linha de dados.'
    case 'cabecalho_diferente':
      return `O cabeçalho não confere. Veio "${f.encontrado}". Baixe o modelo e use as colunas dele, na mesma ordem.`
    case 'aspas_nao_fechadas':
      return `Aspas não fechadas na linha ${f.linha}. Quebra de linha dentro de um campo não é aceita — deixe cada empresa em uma linha só.`
    case 'excede_limite':
      return `O arquivo tem ${f.linhas} linhas e o limite é ${LIMITE_DE_LINHAS}. Divida em arquivos menores.`
  }
}

// A linha sobre endereço no relatório, ou null quando não há o que dizer.
//
// Três estados, e a fatia `cep` só previa dois. Ela criou `cep_carga` para
// desfazer a ambiguidade "um CEP que não resolve não existe, ou é mais novo que
// a base?". Apareceu um terceiro: **a base nunca foi carregada neste banco** —
// e ele é o mais provável em ambiente novo, porque é como a Railway nasce.
//
// Sem separar, uma base ausente vira "todos os CEPs não encontrados", que é
// verdade literal e conclusão errada: manda procurar defeito nos dados quando o
// que falta é rodar um comando.
//
// A mensagem dá a saída, não só o diagnóstico, como as da fase 1.
export function textoDoEndereco(r: Relatorio): string | null {
  if (r.cepsPedidos === 0) return null
  if (r.basePublicadaEm === null) {
    return 'A base de CEP não está carregada neste banco — rode `npm run db:cep:carregar`. Nenhum endereço será resolvido, e as empresas entram sem endereço.'
  }
  if (r.cepsNaoEncontrados === 0) return null
  const quantos =
    r.cepsNaoEncontrados === 1 ? '1 CEP não encontrado' : `${r.cepsNaoEncontrados} CEPs não encontrados`
  return `${quantos} na base de ${r.basePublicadaEm}. Essas empresas entram sem endereço.`
}
