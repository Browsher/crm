import { resolverCeps, type Endereco } from '../../server/cep/resolver'
import { comoUsuario, type Executar } from '../../server/db/como-usuario'
import type { LinhaAceita } from './planilha'

export type Motivo = 'sem_permissao' | 'cnpj_ja_gravado' | 'texto_invalido'
export type Falha = { ok: false; motivo: Motivo }

export type Preparo = {
  jaCadastrados: Set<string>
  enderecos: Map<string, Endereco>
  basePublicadaEm: string | null
}

export interface RepositorioEmpresas {
  preparar(cnpjs: string[], ceps: string[]): Promise<Preparo | Falha>
  gravar(linhas: LinhaAceita[]): Promise<{ ok: true; inseridas: number } | Falha>
}

// Três sinais, e nenhum é infraestrutura:
//
// 42501: a política negou.
// 23505: corrida — outra importação gravou este CNPJ entre a conferência e a
//   gravação. Não dá para prevenir na fase 1: o CNPJ não existia quando o
//   gestor conferiu. A transação inteira desfaz, e a mensagem manda conferir de
//   novo; o contrato de tudo-ou-nada continua valendo.
// 22021: byte inválido. A fase 1 pega o NUL antes, com o número da linha; isto
//   é rede para o que ela não previr, e por isso a mensagem é vaga de propósito.
//
// O resto é infraestrutura e sobe como exceção.
function traduzir(erro: unknown): Falha | null {
  const e = erro as { code?: string; constraint?: string }
  if (e?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
  if (e?.code === '23505' && e.constraint === 'empresa_cnpj_key') return { ok: false, motivo: 'cnpj_ja_gravado' }
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

    // unnest com arrays, e não INSERT com milhares de parâmetros: o Postgres
    // limita em 65535 e a conta ficaria perto demais do teto sem motivo.
    gravar(linhas) {
      if (linhas.length === 0) return Promise.resolve({ ok: true as const, inseridas: 0 })
      return tentar(gestorId, async (e) => {
        const r = await e(
          `INSERT INTO empresa (cnpj, razao_social, nome_fantasia, contato_nome, telefone, email, cep, cnae_principal)
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])`,
          [
            linhas.map((l) => l.cnpj),
            linhas.map((l) => l.razaoSocial),
            linhas.map((l) => l.nomeFantasia),
            linhas.map((l) => l.contatoNome),
            linhas.map((l) => l.telefone),
            linhas.map((l) => l.email),
            linhas.map((l) => l.cep),
            linhas.map((l) => l.cnaePrincipal),
          ],
        )
        return { ok: true as const, inseridas: r.afetadas }
      })
    },
  }
}
