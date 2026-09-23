'use server'

import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerPaginaMensagens } from '@/src/server/whatsapp/evolution'
import { removerVinculo, salvarVinculo } from '@/src/server/whatsapp/vinculos'

export type EstadoVinculo = { erro: string | null; sucesso: string | null }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function falha(motivo: string): EstadoVinculo {
  const mensagens: Record<string, string> = {
    instancia_em_uso: 'Esta instância já está vinculada a outro vendedor.',
    vendedor_invalido: 'Selecione um vendedor ativo.',
    sem_permissao: 'Você não tem permissão para alterar vínculos.',
    nao_encontrado: 'O vínculo não foi encontrado. Atualize a página.',
  }
  return { erro: mensagens[motivo] ?? 'Não foi possível alterar o vínculo. Tente novamente.', sucesso: null }
}

function concluir(sucesso: string): EstadoVinculo {
  revalidatePath('/whatsapp')
  revalidatePath('/whatsapp/configuracao')
  return { erro: null, sucesso }
}

export async function salvarVinculoAcao(_anterior: EstadoVinculo, form: FormData): Promise<EstadoVinculo> {
  const eu = await exigir('gestor')
  const vendedorId = String(form.get('vendedorId') ?? '')
  const entrada = String(form.get('instancia') ?? '')
  const instancia = entrada.trim()
  if (!uuid.test(vendedorId)) return falha('vendedor_invalido')
  if (!instancia || instancia.length > 100 || /\p{Cc}/u.test(entrada)) {
    return { erro: 'Informe o nome exato da instância, com até 100 caracteres e sem caracteres de controle.', sucesso: null }
  }
  try {
    const consulta = await lerPaginaMensagens(1, new Date().toISOString(), instancia)
    if (!consulta.configurado) return { erro: 'A integração está indisponível. Verifique a configuração do servidor.', sucesso: null }
  } catch {
    return { erro: 'Não foi possível consultar essa instância. Confira o nome e tente novamente.', sucesso: null }
  }
  try {
    const resultado = await salvarVinculo(eu.usuarioId, vendedorId, instancia)
    if (!resultado.ok) return falha(resultado.motivo)
  } catch {
    return falha('indisponivel')
  }
  return concluir('Vínculo salvo.')
}

export async function removerVinculoAcao(_anterior: EstadoVinculo, form: FormData): Promise<EstadoVinculo> {
  const eu = await exigir('gestor')
  const id = String(form.get('id') ?? '')
  if (!uuid.test(id)) return falha('nao_encontrado')
  try {
    const resultado = await removerVinculo(eu.usuarioId, id)
    if (!resultado.ok) return falha(resultado.motivo)
  } catch {
    return falha('indisponivel')
  }
  return concluir('Vínculo removido. A instância e o histórico foram preservados.')
}
