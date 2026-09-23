# Etiquetas reais nas conversas

Etapa aprovada: apresentar situação comercial existente, sem mudar funil ou carteira.
O pedido atual autoriza exibição no WhatsApp; a preferência anterior de não
reestruturar Carteira/Meu dia permanece respeitada.

- Empresa identificada unicamente: situação conforme ficha administrativa.
- Responsável ativo com negociação aberta do mesmo responsável: usar etapa real
  (primeiro_contato, em_negociacao, proposta_enviada). Ciclos encerrados e antigos
  responsáveis não emprestam etapa à conversa.
- Sem negociação válida: carteira; depois reserva vigente; sem grupo ativo;
  descanso futuro; disponível. Mesma precedência da ficha de empresa.
- Sem correspondência, ambiguidade ou erro: manter etiquetas de identificação.
- Exibir badge textual na lista e no cabeçalho, com cor complementar e título
  indicando que a situação é da empresa no CRM, não inferida da mensagem.
- Reutilizar consulta em lote, RLS e identidade; nenhuma escrita ou nova migração.

Plano: testes de banco para situações/ciclos e teste DOM de badge; SQL e tipos;
renderização; testes WhatsApp, integração, tipos, lint e build.
