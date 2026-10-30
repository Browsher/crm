import type { QueryResultRow } from 'pg'
import { comAdmin } from '@/src/server/db/admin'
import { exigirHostLocal } from '@/src/server/db/host-local'
import { repositorioPostgres, type RepositorioEmpresas } from '@/src/features/empresas/repositorio'
import type { Relatorio } from '@/src/features/empresas/servico'
import type { BancoDeTeste } from '../ajuda'

// Somente fixtures de registros históricos. A aplicação perdeu EXECUTE na 0059.
// As ações atuais de consulta/administração continuam usando banco.comoUsuario.
export async function confirmarImportacaoHistorica<T extends QueryResultRow = QueryResultRow>(banco: BancoDeTeste, usuario: string, parametros: unknown[]) {
  exigirHostLocal(banco.urlAdmin)
  if (!/^teste_[0-9a-f]{12}$/.test(banco.nome)) throw new Error('Fixture exige banco temporário')
  return comAdmin(banco.urlAdmin, async c => {
    await c.query('BEGIN')
    try {
      await c.query("SELECT set_config('app.usuario_id',$1,true)", [usuario])
      const r = await c.query<T>('SELECT * FROM grupo_importacao_confirmar($1,$2,$3,$4,$5,$6,$7)', parametros)
      await c.query('COMMIT')
      return { linhas: r.rows, afetadas: r.rowCount ?? 0 }
    } catch (erro) {
      await c.query('ROLLBACK')
      throw erro
    }
  })
}

export function repositorioHistorico(banco: BancoDeTeste, usuario: string): RepositorioEmpresas {
  return {
    preparar: repositorioPostgres(usuario).preparar,
    async gravar(operacao, linhas, relatorio) {
      try {
        const r = await confirmarImportacaoHistorica<{ grupo_id: string; inseridas: number; vinculadas: number; relatorio: Relatorio }>(banco, usuario, [
          operacao.chave, operacao.nome, operacao.arquivoNome, operacao.assinatura,
          JSON.stringify(linhas.map(l => ({ cnpj: l.cnpj, google_place_id: l.googlePlaceId, razao_social: l.razaoSocial, nome_fantasia: l.nomeFantasia, contato_nome: l.contatoNome, telefone: l.telefone, email: l.email, cep: l.cep, cnae_principal: l.cnaePrincipal }))),
          JSON.stringify(relatorio), JSON.stringify(operacao.metadados),
        ])
        const confirmado = r.linhas[0]
        return { ok: true, grupoId: confirmado.grupo_id, inseridas: confirmado.inseridas, vinculadas: confirmado.vinculadas, relatorio: confirmado.relatorio }
      } catch (erro) {
        const codigo = (erro as { code?: string }).code
        if (codigo === '42501') return { ok: false, motivo: 'sem_permissao' }
        if (codigo === '22023') return { ok: false, motivo: 'confirmacao_invalida' }
        if (codigo === '22021') return { ok: false, motivo: 'texto_invalido' }
        throw erro
      }
    },
  }
}
