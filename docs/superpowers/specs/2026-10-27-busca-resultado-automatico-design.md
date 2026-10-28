# Abrir resultado automaticamente

Pedido direto: ao buscar no Banco de empresas, abrir o pop-up. O usuário esclareceu que queria entender Filtros usados, sem pedir renomeação ou filtros favoritos.

- Resultado recém-salvo e links com ?busca= abrem o Dialog automaticamente com o conteúdo que a página já leu sob sessão/RLS.
- Não duplicar consulta ao fornecedor nem fazer leitura extra para a primeira abertura. Refresh apenas relê o registro salvo.
- Fechar mantém um botão Ver resultados para reabrir; reabertura usa a action de leitura existente, com limites/permissões atuais.
- Não reabrir ao revalidar a página após importação; somente outra busca, identificada por UUID, inicia outro pop-up.
- Histórico permanece dentro de Banco de empresas. Adicionar Localizar todas as empresas no cabeçalho, apontando para as empresas pessoais já importadas, origem banco. Nenhum acesso global do vendedor.
- Filtros usados continua mostrando o snapshot dos critérios preenchidos; quantidade no cabeçalho e regras fixas não viram filtros favoritos.
- Preservar cards shadcn, tema, acessibilidade, foco, seleção/importação, pausa, mensagens e proteção dos sócios. Nenhuma migração, configuração, limite ou busca real.

Verificação: RED/GREEN de abertura inicial, nenhuma action extra, fechar/reabrir e rerender fechado. E2E de submissão com Dialog automático, refresh sem nova cobrança, importação, links de histórico e localização. Revisão independente final.
