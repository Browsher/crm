# Assistente de filtros no Banco de empresas

Em Prospecção → Banco de empresas → Buscar empresas, o vendedor encontra **Sugerir filtros com IA** acima dos filtros. Por padrão fica desabilitado com o selo **Em breve**, como no Google. Cada origem tem sua própria variável de ativação no servidor. Ambas usam a chave da Anthropic e Claude Haiku 5.5 por padrão.

O Banco usa o mesmo painel do Google. Uma descrição do produto pode gerar até três públicos com filtros do Banco. Sugere CNAEs principais, CNAEs secundários se solicitados, palavras no nome da empresa quando solicitadas e região citada. O servidor confere os códigos com uma cópia do catálogo oficial e o painel mostra as descrições para revisão. Alternativas que geram os mesmos filtros aparecem uma vez. [Catálogo público de CNAEs do IBGE](https://servicodados.ibge.gov.br/api/docs/CNAE?versao=2)

Aplicar preenche apenas os campos mostrados para a opção escolhida. A região sugerida substitui as regiões daquele rascunho, inclusive quando significa cidade inteira. O rascunho mantém a localização se a sugestão omitir a região, contrariar a sigla da UF junto à cidade ou agrupar localidades em um campo. Os outros critérios, quantidade, nome e identidade da tentativa são preservados. Gerar e aplicar não consultam empresas, não usam créditos da Casa dos Dados e não submetem o formulário.

O uso real de Claude depende de chave e saldo. Os testes automatizados simulam Claude e usam os códigos do catálogo versionado. O assistente fica desativado quando falta a configuração do servidor.

O arquivo [cnae-ibge.json](../../../src/server/busca-empresas/cnae-ibge.json) contém as 1.332 subclasses disponíveis em 12/11/2026. Para atualizar, obtenha a lista de subclasses do IBGE e mapeie cada `id` de sete dígitos para sua `descricao`. Preserve zeros iniciais, confira a quantidade de códigos únicos e rode os testes de sugestões do Banco. A geração de sugestões lê o catálogo junto da aplicação. [Lista oficial de subclasses](https://servicodados.ibge.gov.br/api/v2/cnae/subclasses)
