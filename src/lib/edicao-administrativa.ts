export const RESULTADO_INCERTO = 'Não foi possível confirmar a alteração. Atualize a página e confira o estado antes de enviar novamente.'

export function avisarSeRevalidacaoFalhar(revalidar: () => void): { aviso?: string } {
  try {
    revalidar()
    return {}
  } catch {
    return { aviso: 'Alteração salva. Atualize a página para conferir o estado.' }
  }
}
