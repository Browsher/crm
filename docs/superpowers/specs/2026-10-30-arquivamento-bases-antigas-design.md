# Arquivar as bases antigas de empresas

## Escopo confirmado

O usuário pediu a retirada dos cadastros das duas bases antigas, após retirar a importação manual na PR 69, e solicitou seguir para a próxima etapa. Confirmou que a venda e a negociação abertas dessas bases eram testes e devem sair do trabalho ativo, preservando o histórico.

A auditoria de produção, somente leitura em 30/10/2026, identificou 43 empresas: 13 na base Armarinhos e variedades · Brás / SP e 30 na base Mooca | Segurança e tecnologia. Dessas empresas, 36 não possuem contato, negociação ou venda no CRM e 7 possuem histórico; há uma venda, uma negociação aberta e 27 pendências de vínculo. Nenhuma das 43 está vinculada a outras bases. O manifesto com IDs e o levantamento detalhado ficam em arquivo operacional ignorado pelo Git, sem dados de clientes em código público.

## Resultado para quem usa

- As duas bases e suas 43 empresas saem das consultas padrão e dos indicadores de trabalho ativo do gestor e vendedor: Empresas, Prospecção, últimas empresas, Meu dia, Funil, Carteira, Gestão e Listas.
- O gestor consegue consultar o arquivo e abrir empresas e bases arquivadas, com histórico e vendas preservados, em modo de consulta. Usar o mesmo design system e os componentes atuais; manter o menu Listas.
- O estado exibido é Arquivada. Esse arquivo tem identidade própria, distinta do descarte comercial Sem interesse.
- A negociação aberta deixa o Funil e recebe encerramento com motivo explícito de arquivamento. Os retornos dessas empresas deixam a agenda ativa; seus contatos e datas originais permanecem no histórico.
- As 27 pendências deixam a fila de revisão ativa, preservando as evidências de transição e a atribuição original. Nenhum responsável é inventado.
- URLs e ações antigas conservam a consulta histórica autorizada; ações de atendimento, registro, venda, alteração de etapa, retomada e reativação de base arquivada são recusadas no servidor e no banco.
- As conversas de WhatsApp, arquivos, contatos, negociações, vendas, resultados de buscas e metadados de origem continuam preservados. As entregas do Google e do Banco continuam operando para empresas válidas; o arquivo bloqueia a recolocação automática dessas empresas no trabalho ativo.

## Decisões de implementação

Arquivar logicamente as 43 empresas, inclusive as 36 sem histórico comercial, é a escolha do implementador. Isso cumpre a retirada das telas ativas e conserva identidades, deduplicação, replays e referências históricas de buscas sem exclusões físicas. A diferença para uma eliminação definitiva é apenas a conservação dos dados no arquivo.

Registrar o arquivamento de maneira explícita e persistente, protegido contra escrita comum da aplicação. O construtor deve escolher entre campos protegidos ou tabelas de arquivo conforme os privilégios reais do projeto. A autoridade continua no PostgreSQL com RLS e funções definidoras. Helpers internos recebem revogação de PUBLIC; nenhuma concessão fica sem consumidor. O marcador de arquivo é considerado nas consultas e transições, inclusive chamadas diretas que ignoram a interface.

Uma migração nova prepara o contrato de arquivamento, sem IDs ou dados de produção. A operação das duas bases usa um procedimento administrativo restrito, com simulação e manifesto dos IDs exatos; não constitui um recurso geral de importação ou exclusão na interface. Ela exige conferência novamente antes da escrita, bloqueio de concorrência, transação atômica, idempotência e cópia recuperável anterior à operação. Mudança de membros, nova origem compartilhada ou nova atividade após o manifesto impedem aplicação automática até reconciliação. O arquivo administrativo mostra o que foi retirado e por quê, conservando acesso aos detalhes; não oferece restauração comercial automática nesta etapa.

## Restrições

- Preservar todas as empresas e linhas de histórico; não executar DELETE ou TRUNCATE para esta limpeza.
- Preservar as migrações 0000–0059; iniciar na 0060.
- Preservar regras de exclusividade entre vendedores, Funil por interesse/retorno e Carteira por primeira venda para empresas ativas.
- Aplicar o filtro de arquivo antes da contagem e paginação, com os mesmos critérios nos totais, opções, cards e indicadores.
- Preservar dados fora do manifesto e os contratos públicos das entregas atuais.
- Não instalar, ativar ou pausar workflows e automações; nenhuma dependência nova.
- Não modificar dados de produção durante implementação ou testes. A integração, a publicação e a operação de arquivamento serão propostas com a PR e o ensaio concluídos.

## Validação

Provar no banco a retirada das telas e contagens ativas, o acesso histórico autorizado, a recusa de transições diretas e a preservação de identidade, autores, contatos, valores de vendas e resultados originais das buscas. Cobrir cadastros sem vínculo, com pendência, com venda, negociação aberta e retorno agendado; grupo vazio, grupo misto e empresa compartilhada; replay de operação antiga e callbacks do Google/Banco; disputa entre arquivar e registrar atendimento; URLs e paginação do arquivo. Operação simulada deve ser idempotente e falhar de modo fechado diante de manifesto divergente. Usar apenas dados sintéticos em testes e base temporária local. Revisão independente e CI completo antes de integrar.
