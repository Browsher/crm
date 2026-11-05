# Histórico do CRM: fontes e aplicação do padrão

Levantamento por leitura de código em 05/11/2026, base a96ccbe. Nenhuma consulta ou alteração em produção. A aprovação visual é a linha do tempo expansível em http://127.0.0.1:4330/?v=2, com dados fictícios.

## O que o padrão comercial deve mostrar

Em cada registro recolhido: tipo do evento, data e hora de America/Sao_Paulo e autor disponível. Ao expandir: anotação completa, resultado do atendimento, próximo passo e data original do retorno, valor e data efetiva da venda quando existirem. Os registros começam recolhidos. Expandir todos opera sobre os registros do filtro ativo. Não confundir a agenda atual com os dados históricos de um contato.

| Superfície | Fonte existente | Diferença confirmada | Aplicação planejada |
| --- | --- | --- | --- |
| Prospecção/atendimento | `src/features/contato/historico.ts`, sob RLS | `linha-do-tempo.tsx` usa data UTC sem hora e apresenta a data do retorno em ISO | Adaptador comum de contato e venda |
| Meu dia | `app/meu-dia/historico.ts` valida o vínculo antes de `lerHistorico` | Render local omite a hora e os campos do próximo passo; anotações são reduzidas | Adaptador comum, carregamento sob demanda e rejeição de respostas antigas |
| Funil | `lerNegociacao` em `src/features/funil/consulta.ts` | Consulta já recebe tipo e retorno, mas o painel não os apresenta; não recebe autor nem vendas | Adaptador próprio, somente contatos do vendedor autorizado; autoria “Você” é justificada pelo predicado SQL |
| Carteira | `lerHistorico` | Render próprio já possui os campos comerciais, com outra organização | Mesmo componente visual, mantendo o recorte autorizado |
| Ficha da empresa no gestor | `lerHistorico` e blocos adicionais | Render comercial completo, separado de coletas Google e arquivo legado | Substituir apenas o render comercial; preservar os blocos adicionais |
| Atividade de vendedor no gestor | Consulta da ficha do vendedor | Lista de até 20 contatos de várias empresas, com autor implícito | Mesmo padrão de evento, preservando empresa/contexto, limite e consulta |

As fontes foram conferidas nos consumidores `app/meu-dia/painel.tsx`, `app/funil/modal.tsx`, `app/carteira/[id]/ficha.tsx`, `app/empresas/[id]/page.tsx`, `app/usuarios/vendedores/[id]/page.tsx` e `src/features/contato/linha-do-tempo.tsx`. O DTO `Contato` já carrega nota, tipo/natureza, autor, criadoEm, próximo passo, data do retorno e venda opcional.

## Eventos que não estão na linha do tempo comercial atual

| Evento | Evidência de persistência atual | Limite para esta entrega |
| --- | --- | --- |
| Contato/atividade | Tabela `contato`; `lerHistorico` classifica `nao_liguei` como atividade sem ligação | Exibir os dados autorizados existentes |
| Venda | `lerHistorico` une `venda` e `contato`; `venda.data` e `venda.criada_em` são distintas | Exibir valor/data efetiva sem alterar ordem por momento do registro |
| Mudança de etapa | Última definição de `funil_etapa_definir` na migração 0057 atualiza `negociacao.etapa`; as definições e triggers das migrações 0000–0061 foram pesquisadas | Não há trilha de cada mudança de etapa identificada nessas fontes. Não reconstruir datas/etapas anteriores por suposição |
| Sem interesse e retomada | `empresa_atendimento_operacao` tem operação, entrada, resultado, autor e criado_em; migração 0061 escreve recibos inclusive para `arquivar`, `retomar` e `devolver_funil` | Não equivale a um feed pronto: contém resultados de comandos, inclusive falhas. Um feed precisa de contrato, filtragem e regras de visibilidade próprios |
| Arquivo legado | Ficha do gestor já mostra arquivamento e negociações preservadas | Manter o bloco existente; não converter essas informações em contatos fictícios |

A tabela de operações tem RLS na migração 0050: gestor ou o próprio ator ainda vinculado à empresa. A consulta comercial genérica pode apresentar contatos de autores anteriores; o Funil exige autoria própria antes da serialização. Compartilhar a aparência não amplia nenhuma dessas permissões.

## Domínios com apresentação própria

Buscas (`src/components/crm/historico-buscas.tsx`) e coletas (`historico-google.tsx`) têm fornecedor, quantidades, filtros, situação e links próprios. A coleta recebe dia, sem horário de evento no DTO atual. A conversa do WhatsApp é outro domínio; seu conteúdo e suas permissões não foram auditados nesta etapa.

A entrega de Meu dia adota o padrão nos seis consumidores comerciais acima. A apresentação específica de buscas/coletas/WhatsApp e um novo feed de mudanças de etapa/arquivo/retomada ficam como etapas separadas, sem mudança silenciosa de consultas nem criação de eventos. O histórico comercial não deve ser anunciado como auditoria completa de todas as ações do CRM.
