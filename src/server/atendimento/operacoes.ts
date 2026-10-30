import type { ComandoEmpresa, EntradaContato, MotivoAtendimento, ResultadoAtendimento } from '../../lib/atendimento'
import { comoUsuario } from '../db/como-usuario'

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const MOTIVOS: readonly MotivoAtendimento[] = ['sem_permissao', 'nao_encontrada', 'desatualizada', 'arquivada', 'dados_invalidos', 'chave_reutilizada']

async function executar(usuarioId: string, comando: ComandoEmpresa, sql: string, adicionais: unknown[] = []): Promise<ResultadoAtendimento> {
  if (!UUID.test(comando.empresaId) || !UUID.test(comando.chave) || !Number.isInteger(comando.versao) || comando.versao < 1 || comando.versao > 2147483647) return { ok: false, motivo: 'dados_invalidos' }
  try {
    return await comoUsuario(usuarioId, async e => {
      const { linhas } = await e<{ resultado: ResultadoAtendimento }>(sql, [comando.empresaId, comando.chave, comando.versao, ...adicionais])
      const resultado = linhas[0]?.resultado
      if (resultado?.ok === true && Number.isInteger(resultado.versao) && resultado.versao > 0 && typeof resultado.repetida === 'boolean') return resultado
      if (resultado?.ok === false && MOTIVOS.includes(resultado.motivo)) return resultado
      throw new Error('Resultado de atendimento fora do contrato')
    })
  } catch (erro) {
    if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}

export function iniciarAtendimento(usuarioId: string, comando: ComandoEmpresa): Promise<ResultadoAtendimento> {
  return executar(usuarioId, comando, 'SELECT atendimento_iniciar($1,$2,$3) AS resultado')
}
export function registrarContatoDireto(usuarioId: string, comando: ComandoEmpresa, entrada: EntradaContato): Promise<ResultadoAtendimento> {
  // Data segue como texto na fronteira SQL para a RPC devolver recusa de negócio,
  // inclusive quando chamada sem a validação de formulário.
  return executar(usuarioId, comando, 'SELECT contato_registrar_direto($1,$2,$3,$4,$5,$6,$7) AS resultado', [entrada.tipo, entrada.nota, entrada.proximoPasso, entrada.proximoPassoData])
}
export function arquivarSemInteresse(usuarioId: string, comando: ComandoEmpresa, negociacaoId: string | null): Promise<ResultadoAtendimento> {
  if (negociacaoId !== null && !UUID.test(negociacaoId)) return Promise.resolve({ ok: false, motivo: 'dados_invalidos' })
  return executar(usuarioId, comando, 'SELECT empresa_sem_interesse_definir($1,$2,$3,$4) AS resultado', [negociacaoId])
}
export function retomarAtendimento(usuarioId: string, comando: ComandoEmpresa): Promise<ResultadoAtendimento> {
  return executar(usuarioId, comando, 'SELECT empresa_atendimento_retomar($1,$2,$3) AS resultado')
}
