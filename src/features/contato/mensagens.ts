import type { MotivoAtendimento } from '../../lib/atendimento'
const MOTIVOS: Record<MotivoAtendimento, string> = {
  sem_permissao: 'Você não tem permissão para atender esta empresa.',
  nao_encontrada: 'Esta empresa não está disponível para você.',
  desatualizada: 'A empresa mudou em outra aba. Suas anotações foram preservadas. Atualize o atendimento antes de um novo registro.',
  arquivada: 'Esta empresa está sem interesse. Retome o atendimento antes de registrar.',
  dados_invalidos: 'Confira os dados do atendimento.',
  chave_reutilizada: 'Este envio já possui outros dados. Resolva o envio anterior antes de iniciar outro.',
}
export function textoDoMotivo(motivo: MotivoAtendimento) { return MOTIVOS[motivo] }
export function textoDaFalta(falta: string) {
  const textos: Record<string, string> = { tipo_invalido: 'Escolha um resultado permitido para esta fase.', agenda_incompativel: 'Sem interesse cancela os próximos passos. Remova a data e o próximo passo.', proximo_passo_exigido: 'Informe o próximo passo e a data combinada.', par_incompleto: 'Próximo passo e data andam juntos: preencha os dois ou nenhum.', dados_invalidos: 'Confira o tamanho dos textos e a data informada.' }
  return textos[falta] ?? 'Confira os dados do atendimento.'
}