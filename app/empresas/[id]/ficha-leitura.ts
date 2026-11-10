import { lerHistorico } from '@/src/features/contato/historico'
import { lerPerfilEmpresa } from '@/src/features/empresas/perfil'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { lerDadosCadastrais, type DadosCadastrais } from '@/src/server/cnpj-biz/dados'
import { lerSociosGestor } from '../socios-gestor'

function dadosExibidos(dados: DadosCadastrais | null): DadosCadastrais | null {
  const detalhes = dados?.detalhes
  if (!dados || !detalhes) return dados
  return { ...dados, detalhes: {
    capital_social: detalhes.capital_social,
    natureza_juridica: detalhes.natureza_juridica,
    regime_tributario: detalhes.regime_tributario,
    atividades_secundarias: detalhes.atividades_secundarias,
    socios: detalhes.socios?.map(socio => typeof socio === 'string' ? socio : {
      nome: socio.nome, funcao: { descricao: socio.funcao?.descricao },
    }),
  } }
}

export async function lerFichaEmpresa(usuarioId: string, id: string) {
  const perfil = await lerPerfilEmpresa(usuarioId, id)
  if (!perfil) return null
  const { resumo, ...empresa } = perfil
  void resumo
  const [historico, cadastrais, coletas, socios] = await Promise.all([
    lerHistorico(usuarioId, id),
    lerDadosCadastrais(usuarioId, id),
    repositorioGoogle(usuarioId).historicoEmpresa(id),
    lerSociosGestor(usuarioId, { empresaId: id }),
  ])
  return { empresa, historico, cadastrais: dadosExibidos(cadastrais), coletas, socios }
}

export type FichaEmpresa = NonNullable<Awaited<ReturnType<typeof lerFichaEmpresa>>>
