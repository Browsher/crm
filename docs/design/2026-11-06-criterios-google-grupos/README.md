# Critérios Google: agrupamento no painel lateral

Data: 06/11/2026. Comparação visual com dados fictícios. Nenhuma alteração do produto.

## Decisões anteriores

O usuário aprovou o Banco com histórico na página, empresas expansíveis abaixo de cada card, Ver empresa por item e Filtros usados somente no grupo principal. Essa aprovação foi registrada antes desta comparação.

Permanecem aprovados: conteúdos/formulários na lateral; confirmações no centro; menu interno quando houver várias seções; tarefas curtas abertas diretamente; ações no rodapé. Não comparar novamente abas contra menu.

## O que estamos decidindo

Somente como agrupar o conteúdo dos critérios do Google. O conjunto atual possui procurar, evitar, contatos e orientações; a seção Orientações tem apenas dois campos. A proposta junta seções relacionadas, sem remover ou acrescentar critérios.

Fonte: app/fila/google/criterios.tsx e src/lib/google/criterios.ts, conferidos nesta rodada. O desenho não adiciona CNAE ao contrato de critérios Google.

### A · Três grupos

Opção A escolhida pelo usuário em 06/11/2026:

| Entrada no menu | Conteúdo |
| --- | --- |
| Empresas e produtos | Termos adicionais, Produtos de interesse, Tipo de negócio e Forma de atendimento |
| Contatos e presença digital | Site próprio, E-mail comercial publicado, Tipo de contato, Nota mínima e Mínimo de avaliações |
| Preferências e restrições | Negócios e termos a evitar, Situação no Google, O que priorizar e Outras orientações |

Benefício: distribui o preenchimento, sem uma entrada isolada para apenas dois campos de Orientações.
Custo: uma entrada a mais do que a alternativa B.

### B · Dois grupos

| Entrada no menu | Conteúdo |
| --- | --- |
| Perfil e preferências | Todo o conteúdo de Empresas e produtos e de Preferências e restrições da opção A |
| Contatos e presença digital | Os mesmos campos e opções de contato da opção A |

Benefício: menu mais curto.
Custo: concentra mais campos em Perfil e preferências e exige mais rolagem.

A referência anterior de quatro abas permanece acessível apenas para comparação de conteúdo.

## Navegação e preenchimento

- O painel abre no menu interno, sem selecionar um grupo automaticamente.
- Abrir um grupo mostra seus campos; Voltar, no cabeçalho, retorna ao menu.
- O preenchimento é conservado ao visitar outro grupo. Não duplicar Voltar no rodapé.
- Cancelar e Aplicar critérios permanecem no rodapé, tanto no menu quanto dentro do grupo.
- Cancelar, Fechar ou Escape ao sair de uma edição não aplicada pedem confirmação de descarte.
- Aplicar critérios simula atualizar o rascunho do dia e fecha a lateral. O planejamento ainda precisa ser salvo.
- Na prévia, reabrir o mesmo dia conserva o que foi aplicado; descartar uma edição posterior recupera esse último conteúdo aplicado. Nada é persistido fora da página.
- Todas as opções e exemplos dos campos são reutilizados da galeria anterior; os exemplos ficam nos placeholders e somem durante o foco.
- Manter leitura de dias não editáveis na futura implementação, sem ações de gravação. A comparação foca no modo de edição.

## Limites e implementação posterior

O formulário real e seu normalizador continuam como fonte de regras, limites, valores internos das opções e autorização. A galeria ilustra o agrupamento e a navegação; não implementa o normalizador nem as consultas reais.

Aplicar não equivale a Salvar planejamento, executar coleta ou disparar busca paga. Não há chamadas de rede ou alterações em contas, dias ou dados reais.

As preferências combinam prioridades, exclusões e orientações em uma entrada visual. Os campos continuam independentes no contrato do produto.

## Prévia

- A: http://127.0.0.1:4338/?area=criterios&view=tres
- B: http://127.0.0.1:4338/?area=criterios&view=dois

## Situação

Agrupamento aprovado: A, três grupos. Conteúdo e padrão geral do painel continuam aprovados. A opção B permanece como referência não escolhida. Próxima comparação: estrutura de Espelhar planejamento.
