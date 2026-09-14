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
}

export type ConfirmacaoGrupo = {
  ok: true
  grupoId: string
  inseridas: number
  vinculadas: number
  relatorio: Relatorio
}

export type Preparo = {
  jaCadastrados: Set<string>
  enderecos: Map<string, Endereco>
  basePublicadaEm: string | null
}

export interface RepositorioEmpresas {
  preparar(cnpjs: string[], ceps: string[]): Promise<Preparo | Falha>
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
    // Uma transação de leitura para a fase 2 inteira: os CNPJs já cadastrados,
    // os endereços e a data do retrato de CEP que o relatório cita.
    preparar(cnpjs, ceps) {
      return tentar(gestorId, async (e) => {
        const jaCadastrados = new Set<string>()
        if (cnpjs.length > 0) {
          const r = await e<{ cnpj: string }>('SELECT cnpj FROM empresa WHERE cnpj = ANY($1)', [cnpjs])
          for (const l of r.linhas) jaCadastrados.add(l.cnpj)
        }
        const enderecos = await resolverCeps(e, ceps)
        const c = await e<{ publicado_em: string }>(
          "SELECT to_char(publicado_em, 'YYYY-MM-DD') AS publicado_em FROM cep_carga ORDER BY carregado_em DESC LIMIT 1",
        )
        return { jaCadastrados, enderecos, basePublicadaEm: c.linhas[0]?.publicado_em ?? null }
      })
    },

    gravar(operacao, linhas, relatorio) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ grupo_id: string; inseridas: number; vinculadas: number; relatorio: Relatorio }>(
          `SELECT grupo_id, inseridas, vinculadas, relatorio
             FROM grupo_importacao_confirmar($1::uuid, $2::text, $3::text, $4::text, $5::jsonb, $6::jsonb)`,
          [
            operacao.chave,
            operacao.nome,
            operacao.arquivoNome,
            operacao.assinatura,
            JSON.stringify(linhas.map((l) => ({
              cnpj: l.cnpj,
              razao_social: l.razaoSocial,
              nome_fantasia: l.nomeFantasia,
              contato_nome: l.contatoNome,
              telefone: l.telefone,
              email: l.email,
              cep: l.cep,
              cnae_principal: l.cnaePrincipal,
            }))),
            JSON.stringify(relatorio),
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
