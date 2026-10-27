import type { MotivoBusca } from './servico'
const MENSAGENS: Record<MotivoBusca, string> = {
  nao_configurado: 'A conexão com o fornecedor do banco de empresas ainda não foi configurada. Solicite ao gestor a configuração.',
  credencial_invalida: 'O fornecedor do banco de empresas recusou a chave de acesso. O gestor precisa conferir a conexão.',
  sem_creditos: 'O fornecedor do banco de empresas informou falta de créditos. Solicite ao gestor a conferência da conta.',
  fornecedor_ocupado: 'O fornecedor do banco de empresas atingiu seu limite de requisições. A consulta não será repetida automaticamente.',
  fornecedor_indisponivel: 'Não foi possível concluir a conexão com o fornecedor do banco de empresas. Confira o histórico antes de iniciar outra busca.',
  tempo_esgotado: 'O fornecedor do banco de empresas não respondeu dentro do prazo. A consulta pode ter sido cobrada e não será repetida automaticamente.',
  resposta_invalida: 'O fornecedor do banco de empresas retornou dados em formato inesperado. A consulta não será repetida automaticamente.',
  cnae_nao_encontrado: 'O CNAE não foi encontrado no fornecedor do banco de empresas. Confira o código antes de iniciar outra busca.',
  sem_permissao: 'Você não tem permissão para esta operação ou as buscas foram pausadas pelo gestor.',
  empresa_repetida: 'Esta empresa ou seus contatos já estão na base global. Confira a seleção antes de importar.',
  operacao_invalida: 'A operação não pôde ser confirmada. Confira a seleção e atualize a página.',
  nome_invalido: 'Informe um nome de lista com até 100 caracteres.',
  filtros_invalidos: 'Confira os códigos, as regiões, as faixas e a quantidade. Cidades precisam de estado e bairros precisam de cidade.',
  limite: 'O limite diário de empresas consultadas foi atingido. Reduza a quantidade ou solicite ajuste ao gestor.',
  pausada: 'O gestor pausou suas buscas de empresas.',
}
export function mensagemBusca(motivo: MotivoBusca): string { return MENSAGENS[motivo] ?? 'Não foi possível concluir a busca.' }
