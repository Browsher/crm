# Assistente de filtros no Banco de empresas

Em Prospecção → Banco de empresas → Buscar empresas, o vendedor encontra **Sugerir filtros com IA** acima dos filtros. Por padrão fica desabilitado com o selo **Em breve**, como no Google. Cada origem tem sua própria variável de ativação no servidor. Ambas usam a chave da Anthropic e Claude Haiku 5.5 por padrão.

O Banco usa o mesmo painel do Google. Uma descrição do produto pode gerar até três públicos com filtros do Banco. Sugere CNAEs principais, CNAEs secundários se solicitados, palavras no nome da empresa quando solicitadas e região citada. O servidor confere os códigos e o painel mostra as descrições oficiais para revisão. Uma falha do catálogo impede aplicar CNAEs sem confirmação. Alternativas que geram os mesmos filtros aparecem uma vez. [Catálogo público de CNAEs do IBGE](https://servicodados.ibge.gov.br/api/docs/CNAE?versao=2)

Aplicar preenche apenas os campos mostrados para a opção escolhida. A região sugerida substitui as regiões daquele rascunho, inclusive quando significa cidade inteira. O rascunho mantém a localização se a sugestão omitir a região, contrariar a sigla da UF junto à cidade ou agrupar localidades em um campo. Os outros critérios, quantidade, nome e identidade da tentativa são preservados. Gerar e aplicar não consultam empresas, não usam créditos da Casa dos Dados e não submetem o formulário.

O próximo uso real de Claude depende de chave, saldo, limites do workspace e validação em prévia. Os testes automatizados simulam Claude e IBGE. O rollout normal mantém a nova opção desativada.
