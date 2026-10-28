# Alinhar a Prospecção do CRM à prévia aprovada

O usuário apontou que as telas reais continuam diferentes da prévia. Este
documento consolida a execução já autorizada, usando como referência o mockup
`prospeccao-google-espelhar-v10.html`. Não propõe outra direção visual.

## Telas

- `/fila`: central com Localizar empresas em destaque, origem escolhida antes
  de abrir a consulta, cartões Buscas no Google e Banco de empresas e acesso
  ao atendimento vigente. Atendimento continua no mesmo editor, por URL
  explícita, com rascunho, confirmação e contexto de reserva preservados.
- `/fila/localizar`: todas as empresas pessoais Google e importações do banco,
  inclusive trabalhadas, sem duplicar empresa. Filtros principais Nicho e
  Endereço, este limitado aos bairros existentes naquele nicho. Origem vem da
  central e permanece na URL. Mais filtros em cartão recolhível: nome, CNPJ,
  CNAE, UF, cidade, CEP, disponibilidade própria, porte e abertura. Sem abas
  de situação, grupo, CEP informado ou situação cadastral. Cartões com tags
  reais e ações explícitas; Enter recolhe filtros e exibe resumo animado.
- `/fila/buscar`: Banco de empresas, seis cartões de filtros, somente primeiro
  aberto. Atividade/nome; localização; perfil; capital/abertura; contatos;
  resultados. Brasil fixo, sem CEP, Estado > Cidade > Bairro com múltiplas
  regiões. Nome da lista sugerido como Nicho · Bairro · Cidade/UF. Opções
  oficiais de busca por filtros conectadas ao servidor; deduplicação de
  telefone/email e ignorar exportadas fixas. Histórico e importação continuam.
- `/fila/google`: estrutura visual do planejamento aprovado, critérios e
  espelhamento existentes. Consultar empresas do Google abre a consulta
  pessoal com origem Google, sem outra lista paralela no fluxo principal.

## Dados e compatibilidade

A leitura pessoal é autorizada no banco antes de filtrar/paginar: somente
resultados Google entregues e empresas efetivamente importadas pelo vendedor,
mais sua carteira/atendimento existente. A origem não é inferida do criador
genérico de uma lista. Retornar resumos sem telefone/email; páginas de perfil
e atendimento continuam com as regras atuais. Situações vêm da fila,
negociação e venda próprias. Sem acesso ao estágio de outro vendedor.

Listas legadas e links com grupo continuam disponíveis explicitamente; grupo
inválido não cai em Todas. Não apagar nem reatribuir empresas existentes.
Manter quotas e UUID idempotente da consulta paga. Os novos filtros são
persistidos e validados pelo banco, preservando consultas históricas antigas.
Somente o servidor conhece a chave e consulta o fornecedor.

Clarificação posterior do usuário: vendedores veem somente nome e função dos
sócios. Os demais dados ficam restritos ao gestor em tabela com RLS própria e
componente servidor exclusivo; o JSON compartilhado é sanitizado no banco.

## Visual e verificação

Segoe UI, títulos 28/36, corpo 14, branco e cinza claro, verde #17634d e
tokens escuros existentes. Conteúdo esquerdo, largura máxima 1420, cartões
de bordas discretas, botões shadcn existentes. Sem biblioteca nova.
Conferir cada tela em 1920×1080 e 390 px, teclado e movimento reduzido.
Escrever testes RED antes das mudanças de comportamento, testar isolamento
entre vendedores, filtros combinados, buscas antigas, duplicidades e editor.
Revisão independente no final e prévia real com dados fictícios atualizada.

Nenhuma migração remota, consulta paga, coleta real, alteração de planilha ou
ativação de workflow integra esta correção. Trabalhar em codex/redesign-crm
e PR #55; preservar o checkout principal de outro chat.
