# Filtros e identificação de empresas no WhatsApp

Etapa aprovada: filtros Todas / Sem resposta / Não cadastradas e Ver empresa.

- Cruzamento somente leitura pelo telefone brasileiro confirmado (+55 seguido
  de 10 ou 11 dígitos) com empresa.telefone. Sem inferir nono dígito ou DDD.
- Correspondência única permite abrir /empresas/[id]. Múltiplas empresas com o
  mesmo telefone ficam ambíguas, sem escolher uma. Sem telefone não é ausência.
- Consultar em lote os telefones de cada página com comoUsuario e eh_gestor().
  Nenhuma associação persistente nem alteração na carteira do vendedor.
- Falha de consulta de empresas não esconde mensagens e não vira “Não cadastrada”.
- Sem resposta usa última mensagem recebida. Não cadastradas usa ausência
  confirmada de telefone no CRM. Busca textual combina com filtro selecionado.
- Filtros operam nas conversas carregadas; cards permanecem relativos ao vendedor.
- Mostrar nome da empresa e situação de identificação, preservando nome do contato.

Plano: testes de repositório em banco isolado e de interação DOM primeiro;
consulta em lote, enriquecimento e filtros depois; testes WhatsApp, tipos, lint
e build ao final. Manter branch e alterações não relacionadas intactas.
