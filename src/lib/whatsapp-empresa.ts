export type CadastroWhatsApp = {
  telefone: string
} & ({ estado: 'encontrada'; empresa: { id: string; nome: string } } | { estado: 'ausente' | 'ambigua' | 'indisponivel' })

export const rotuloCadastro = (cadastro?: CadastroWhatsApp) => {
  if (!cadastro) return 'Empresa não identificada'
  if (cadastro.estado === 'encontrada') return 'Cadastrada'
  if (cadastro.estado === 'ausente') return 'Não cadastrada'
  if (cadastro.estado === 'ambigua') return 'Telefone em várias empresas'
  return 'Consulta de empresa indisponível'
}
