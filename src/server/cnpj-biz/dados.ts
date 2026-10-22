import { comoUsuario } from '@/src/server/db/como-usuario'
export type DadosCadastrais = {
  fonte: string; coletado_em: string; situacao: string | null; porte: string | null; data_abertura: string | null
  logradouro: string | null; numero: string | null; complemento: string | null
  bairro: string | null; cidade: string | null; uf: string | null; telefones: string[]
}
export async function lerDadosCadastrais(usuarioId: string, empresaId: string): Promise<DadosCadastrais | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(empresaId)) return null
  return comoUsuario(usuarioId, async e => {
    const { linhas } = await e<DadosCadastrais>(`SELECT fonte,coletado_em::text,situacao,porte,data_abertura::text,logradouro,numero,
      complemento,bairro,cidade,uf,telefones FROM empresa_dados_cadastrais_ler($1)`, [empresaId])
    return linhas[0] ?? null
  })
}
