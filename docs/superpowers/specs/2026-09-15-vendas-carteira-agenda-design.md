# Vendas na Carteira, histórico e agenda

Solicitação e regra de retorno aprovadas em 15/09/2026. PR46 aprovado e integrado antes desta fatia.

## Fluxo

Prospecção não coloca todo cadastro no Funil: ao registrar interessado ou retornar_depois, a empresa fica com o vendedor e entra no Funil. Retornar_depois exige combinado e data. Não atendeu, sem interesse e descarte devolvem à Prospecção. Meu dia reúne tarefas de hoje e atrasadas das posses do vendedor, tanto Funil quanto Carteira. Retornos futuros só aparecem quando chega o dia; filtros ainda podem ocultá-los.

Primeira venda move para Carteira; compras seguintes permanecem nela. No perfil acessado pela Carteira, adicionar Registrar venda com valor/data/observação, confirmação, proteção de rascunho e mesma chave em tentativa repetida. Reusar validação monetária atual em lib, sem importar entre features. Sem edição/exclusão de vendas. Nenhuma compra altera retorno ou cria atendimento fictício.

## Histórico

Compor contatos e vendas reais em ordem de registro, com título Venda registrada, valor, data da venda, observação e autoria. Histórico da empresa na ficha, Meu dia, Prospecção e visão administrativa da empresa reconhecem o evento. Não inserir contato artificial: o resumo da agenda segue o último atendimento, não a última venda. RLS de vendas permanece: vendedor só lê venda própria enquanto responsável; gestor lê as permitidas pelo papel. Funil preserva seu histórico restrito a atendimentos próprios; empresa vendida sai dele.

## Autoridade e limites

Novo comando de compra na Carteira recebe ID da empresa e chave idempotente, exige vendedor atual ativo, senha regular, primeira venda existente; locks por usuário e empresa, revalidação após espera. Mesma chave e mesmos dados retornam sucesso, dados diferentes recusados. Venda não muda posse, etapa ou data do próximo passo.

Retornar_depois exige assunção na validação do servidor e guarda no banco; dados novos seguem a regra. Não reassumir automaticamente registros antigos devolvidos, pois podem estar com outra pessoa. Registrar a causa encontrada e orientar sobre anteriores após conferir o caso.

Testes em bancos temporários Docker: retorno hoje entra no Funil/Meu dia; futuros não entram no Meu dia; primeira e segunda venda preservam tarefa; histórico contém ambas; terceiros e gestor não registram venda pelo comando do vendedor; duplo envio não duplica. Migração nova após0030. Sem escrita na Railway ou merge sem aprovação visual.
