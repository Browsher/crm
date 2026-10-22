import type { MotivoBusca } from './servico'
const MENSAGENS: Record<MotivoBusca, string> = {
  nao_configurado: 'A conexão com o CNPJ.biz ainda não foi configurada. Solicite ao gestor a configuração.',
  credencial_invalida: 'O CNPJ.biz recusou a chave de acesso. O gestor precisa conferir a conexão.',
  sem_creditos: 'O CNPJ.biz informou falta de créditos. Solicite ao gestor a conferência da conta.',
  fornecedor_ocupado: 'O CNPJ.biz atingiu seu limite de requisições. A consulta não será repetida automaticamente.',
  fornecedor_indisponivel: 'Não foi possível concluir a conexão com o CNPJ.biz. Confira o histórico antes de iniciar outra busca.',
  tempo_esgotado: 'O CNPJ.biz não respondeu dentro do prazo. A consulta pode ter sido cobrada e não será repetida automaticamente.',
  resposta_invalida: 'O CNPJ.biz retornou dados em formato inesperado. A consulta não será repetida automaticamente.',
  cnae_nao_encontrado: 'O CNAE não foi encontrado no CNPJ.biz. Confira o código antes de iniciar outra busca.',
  sem_permissao: 'Você não tem permissão para esta operação ou as buscas foram pausadas pelo gestor.',
  operacao_invalida: 'A operação não pôde ser confirmada. Confira a seleção e atualize a página.',
  nome_invalido: 'Informe um nome de lista com até 100 caracteres.',
  filtros_invalidos: 'Confira UF, CNAE, cidade, bairro e quantidade. Informe uma palavra no nome ou um CNAE válido.',
  limite: 'O limite diário de empresas consultadas foi atingido. Reduza a quantidade ou solicite ajuste ao gestor.',
  pausada: 'O gestor pausou suas buscas de empresas.',
}
export function mensagemBusca(motivo: MotivoBusca): string { return MENSAGENS[motivo] ?? 'Não foi possível concluir a busca.' }
