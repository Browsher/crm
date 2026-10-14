import type { MetadadosGrupo } from '../../lib/grupo-metadados'
import { resolverCeps, type Endereco } from '../../server/cep/resolver'
import { comoUsuario, type Executar } from '../../server/db/como-usuario'
import type { LinhaAceita } from './planilha'
import type { Relatorio } from './servico'

export type Motivo = 'sem_permissao' | 'texto_invalido' | 'sem_linhas_aceitas' | 'confirmacao_invalida'
export type Falha = { ok: false; motivo: Motivo }

export type OperacaoGrupo = {
  chave: string
  nome: string
  arquivoNome: string
  assinatura: string
  metadados: MetadadosGrupo
}

export type ConfirmacaoGrupo = {
  ok: true
  grupoId: string
  inseridas: number
  vinculadas: number
  relatorio: Relatorio
}

export type CadastroIdentificado = { id: string; cnpj: string | null; razaoSocial: string | null }
export type IdentidadeImportada = Pick<LinhaAceita, 'linha' | 'cnpj' | 'razaoSocial' | 'googlePlaceId'>

export type Preparo = {
  porCnpj: Map<string, CadastroIdentificado>
  porGoogle: Map<string, CadastroIdentificado>
  enderecos: Map<string, Endereco>
  basePublicadaEm: string | null
}

export interface RepositorioEmpresas {
  preparar(identidades: IdentidadeImportada[], ceps: string[]): Promise<Preparo | Falha>
  gravar(operacao: OperacaoGrupo, linhas: LinhaAceita[], relatorio: Relatorio): Promise<ConfirmacaoGrupo | Falha>
}

// Erros de contrato conhecidos viram resultados recuperáveis; o restante é
// infraestrutura e sobe como exceção.
//
// 42501: a política negou.
// 22023: a confirmação divergiu da operação persistida ou do contrato SQL.
// 22021: byte inválido. A fase 1 pega o NUL antes, com o número da linha; isto
//   é rede para o que ela não previr, e por isso a mensagem é vaga de propósito.
//
// O resto é infraestrutura e sobe como exceção.
function traduzir(erro: unknown): Falha | null {
  const e = erro as { code?: string; constraint?: string }
  if (e?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
  if (e?.code === '22023') return { ok: false, motivo: 'confirmacao_invalida' }
  if (e?.code === '22021') return { ok: false, motivo: 'texto_invalido' }
  return null
}

async function tentar<T>(gestorId: string, trabalho: (executar: Executar) => Promise<T>): Promise<T | Falha> {
  try {
    return await comoUsuario(gestorId, trabalho)
  } catch (erro) {
    const falha = traduzir(erro)
    if (falha) return falha
    throw erro
  }
}

export function repositorioPostgres(gestorId: string): RepositorioEmpresas {
  return {
    // Uma transação de leitura para a fase 2 inteira: as identidades já cadastradas,
    // os endereços e a data do retrato de CEP que o relatório cita.
    preparar(identidades, ceps) {
      return tentar(gestorId, async (e) => {
        const cnpjs = [...new Set(identidades.map(l => l.cnpj).filter((v): v is string => v !== null))]
        const ids = [...new Set(identidades.map(l => l.googlePlaceId).filter((v): v is string => v !== null))]
        const porCnpj = new Map<string, CadastroIdentificado>()
        const porGoogle = new Map<string, CadastroIdentificado>()
        if (cnpjs.length > 0) {
          const r = await e<CadastroIdentificado>('SELECT id, cnpj, razao_social AS "razaoSocial" FROM empresa WHERE cnpj = ANY($1)', [cnpjs])
          for (const l of r.linhas) if (l.cnpj !== null) porCnpj.set(l.cnpj, l)
        }
        if (ids.length > 0) {
          const r = await e<CadastroIdentificado & { google_place_id: string }>(
            `SELECT e.id, e.cnpj, e.razao_social AS "razaoSocial", o.google_place_id
               FROM empresa_origem_google o JOIN empresa e ON e.id = o.empresa_id
              WHERE o.google_place_id = ANY($1)`, [ids],
          )
          for (const l of r.linhas) porGoogle.set(l.google_place_id, { id: l.id, cnpj: l.cnpj, razaoSocial: l.razaoSocial })
        }
        const enderecos = await resolverCeps(e, ceps)
        const c = await e<{ publicado_em: string }>(
          "SELECT to_char(publicado_em, 'YYYY-MM-DD') AS publicado_em FROM cep_carga ORDER BY carregado_em DESC LIMIT 1",
        )
        return { porCnpj, porGoogle, enderecos, basePublicadaEm: c.linhas[0]?.publicado_em ?? null }
      })
    },

    gravar(operacao, linhas, relatorio) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ grupo_id: string; inseridas: number; vinculadas: number; relatorio: Relatorio }>(
          `SELECT grupo_id, inseridas, vinculadas, relatorio
             FROM grupo_importacao_confirmar($1::uuid, $2::text, $3::text, $4::text, $5::jsonb, $6::jsonb, $7::jsonb)`,
          [
            operacao.chave,
            operacao.nome,
            operacao.arquivoNome,
            operacao.assinatura,
            JSON.stringify(linhas.map((l) => ({
              cnpj: l.cnpj,
              google_place_id: l.googlePlaceId,
              razao_social: l.razaoSocial,
              nome_fantasia: l.nomeFantasia,
              contato_nome: l.contatoNome,
              telefone: l.telefone,
              email: l.email,
              cep: l.cep,
              cnae_principal: l.cnaePrincipal,
            }))),
            JSON.stringify(relatorio),
            JSON.stringify(operacao.metadados),
          ],
        )
        const confirmado = r.linhas[0]
        if (!confirmado) throw new Error('grupo_importacao_confirmar não devolveu resultado')
        return {
          ok: true as const,
          grupoId: confirmado.grupo_id,
          inseridas: confirmado.inseridas,
          vinculadas: confirmado.vinculadas,
          relatorio: confirmado.relatorio,
        }
      })
    },
  }
}
