# Meu dia com cards e painéis por abas

Desenho aprovado pelo usuário em 05/11/2026. A referência visual é a prévia local em http://127.0.0.1:4328/?v=4. A aprovação incorpora a retirada do Resumo, a ação única Voltar no cabeçalho interno e os nomes Registrar venda e Sem interesse.

## Meu dia

- A página inicia sem empresa selecionada. A leitura do histórico só começa quando o vendedor abre uma empresa.
- Cards compactos de mesma altura apresentam empresa, localização, próximo passo, data e situação do retorno. Oferecem Dados da empresa e Abrir retorno.
- Filtros Todos, Atrasos, Hoje e Próximos. Todos inclui os retornos pendentes vencidos, de hoje e futuros. A pesquisa por nome existente acompanha o filtro.
- Próximos oferece Todos os próximos, Amanhã, Semana que vem e Mês que vem. Todos os próximos inclui qualquer data futura. Amanhã é o próximo dia civil. Semana que vem é de segunda a domingo da semana civil seguinte. Mês que vem cobre o mês civil seguinte inteiro. A referência é a data atual de America/Sao_Paulo.
- Contagens refletem o mesmo recorte autorizado e as exclusões de empresa ou agenda indisponível. Fonte, vínculo, responsável, arquivo e ponteiro da agenda seguem as regras comerciais atuais.
- Trocar o filtro reseta a seleção. Alterações de agenda e revalidação não escolhem outra empresa automaticamente. Pesquisa, período e demais filtros seguem na URL e nos destinos de retorno.

## Painéis

- Abrir retorno usa a lateral compartilhada. Começa em Próximo passo e tem a aba Histórico. O corpo mostra apenas o conteúdo da aba ativa.
- O rodapé do retorno oferece Dados da empresa e Negociação para uma negociação aberta. Clientes seguem o caminho de atendimento já existente na Carteira.
- Dados da empresa apresenta os grupos cadastrais autorizados de forma organizada. O cabeçalho interno oferece Voltar. O rodapé mantém o acesso comercial aplicável.
- Negociação usa o mesmo editor já existente no Funil, com as abas Próximo passo, Atendimento e Histórico. Começa em Próximo passo. A página e o painel não têm aba nem bloco Resumo.
- Em Próximo passo e Histórico da negociação, o rodapé traz Registrar venda e Sem interesse lado a lado, inclusive no celular. O formulário de Atendimento conserva as ações contextuais de salvar e cancelar.
- O retorno não oferece um segundo botão Registrar atendimento. O registro acontece na aba Atendimento da negociação.
- O cabeçalho inicial do retorno oferece Fechar. Na aba Histórico do retorno, Voltar retorna a Próximo passo. Dados da empresa restaura o painel e a aba que o abriram. Negociação em Próximo passo volta ao contexto de origem; em Atendimento ou Histórico, Voltar retorna a Próximo passo. O rodapé não repete Voltar ao retorno.
- A lateral adapta o conteúdo ao celular, mantém ações alcançáveis e não ultrapassa a largura da tela. O tema segue os tokens do CRM. Aplicar ao editor comum a mesma organização visual aprovada também atende os consumidores do Funil.

## Histórico — apresentação escolhida

Após aprovar o desenho de Meu dia, o usuário pediu conferir a completude e validar um padrão para os históricos. O usuário escolheu e aprovou a linha do tempo expansível em 05/11/2026, apresentada na aba Histórico do painel lateral. A prévia está em http://127.0.0.1:4330/?v=2 e usa dados fictícios. O modelo combina a sequência visual da linha do tempo com a expansão individual dos eventos. Os campos propostos são: tipo, data e hora de Brasília, autor, anotação, resultado, próximo passo e data do retorno, além de valor e data da venda quando aplicáveis.

Tipo, data e hora e autor ficam visíveis no registro recolhido. Ao expandir, aparecem os detalhes disponíveis. Os eventos começam recolhidos e a opção Expandir todos opera sobre o filtro ativo, conforme a prévia aprovada. Preservar os recortes de autorização de cada consulta, inclusive o histórico próprio do vendedor no Funil. As datas dos próximos passos nos eventos são históricas e não substituem a agenda atual. A data efetiva da venda é distinta do horário do registro. Mudanças de etapa, arquivamentos e retomadas precisam ter fontes e cobertura de exibição consolidadas antes de prometer um histórico completo. Buscas e coletas mantêm campos específicos do domínio.

## Escopo dos históricos nesta entrega

Aplicar o componente comum aos históricos comerciais de Meu dia, Funil, Prospecção/atendimento, Carteira, ficha da empresa no gestor e atividade do vendedor no gestor. Preservar a identificação da empresa e o limite de 20 registros nesta última. O mapeamento de fontes e diferenças está em `docs/auditorias/2026-11-05-historicos-crm.md`.

Esta entrega não cria um feed de auditoria de mudanças de etapa, arquivo ou retomada. Preserva os blocos adicionais existentes. Buscas, coletas Google e conversas WhatsApp precisam de adaptação específica em etapa separada, sem inventar hora, autor ou evento que suas fontes não forneçam. O componente comum não amplia consultas nem permissões.

## Integridade e navegação

- Reutilizar o editor de negociação, o componente de dados e as máquinas de envio existentes. Preservar formulários suportados, autorização no banco, RLS, idempotência e recuperação de resposta perdida após reload.
- Venda inicial continua encaminhando à ficha correta da Carteira. Cliente já convertido conserva seus caminhos e formulários atuais.
- Troca de aba, painel, Voltar, Fechar, Escape e navegação do CRM protegem rascunhos e envios pendentes. Confirmações de venda, Sem interesse e descarte são pop-ups centrais.
- Foco retorna ao controle que originou a interação. Abas funcionam por teclado. Respostas atrasadas de outra empresa não substituem o conteúdo atual.

## Entrega

A implementação passa por branch, revisão independente, regressões adequadas e CI. A validação usa banco e dados fictícios isolados, desktop e celular, teclado, temas claro e escuro, falhas de leitura, envio lento e resposta perdida. A próxima entrega concreta é uma PR contra main.
