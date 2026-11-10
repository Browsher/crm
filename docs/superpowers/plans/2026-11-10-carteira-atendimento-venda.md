# Cards da Carteira, atendimento lateral e data da primeira venda

> Implementar e revisar as três partes separadamente, na mesma branch.

**Objetivo.** Aplicar os três ajustes aprovados em 10/11/2026, preservando os fluxos comerciais, permissões, dados e rotas existentes.

**Referências.** Mockup D, Cards completos em duas colunas, aprovado após comparação das opções de Carteira. A ficha lateral segue a [decisão da Carteira](../../design/2026-11-06-carteira-abertura-cliente/README.md) e a moldura e confirmações seguem a [especificação dos painéis](../specs/2026-11-05-padronizacao-paineis-crm-design.md).

## Carteira

- [x] Testar a exibição de vários clientes, dois cards por linha no desktop e um em tela estreita. O card apresenta nome, localização, situação do retorno, última atividade, próximo passo, data de retorno e contato principal.
- [x] Adaptar `app/carteira/lista.tsx` e seus estilos. Usar o card do design system e uma única ação Ver cliente por empresa. A ficha conserva a mesma rota, o acesso a dados cadastrais e histórico e as regras de clientes arquivados.
- [x] Validar busca por nome, UF, retorno, ordem alfabética, ausência de registros, rolagem, abertura lateral e foco ao voltar. Manter o tamanho da lista e a consulta existentes.

## Continuar atendimento em Localizar empresas

- [x] Testar a entrada por Continuar atendimento com filtros e página, a preservação da lista atrás da lateral, o fechamento no desktop e celular e a restauração do foco e da rolagem.
- [x] Reutilizar a leitura autorizada e o editor do atendimento. Aplicar a moldura comum de painel lateral a partir de Localizar empresas. Preservar o acesso direto pela rota canônica, inclusive após reload, e os destinos comerciais após salvar.
- [x] Proteger edição alterada, envio em andamento e recuperação do mesmo comando. Testar fechamento por botão, Escape e Voltar, além de acesso a empresa de outro vendedor.

## Data da primeira venda

- [x] Testar data inicial em São Paulo perto da virada UTC, edição para outro dia e saída imediata do formulário limpo.
- [x] Preencher a data ao iniciar uma venda nova no Funil. O preenchimento inicial não altera o estado do formulário por si só. Conservar a data escolhida na confirmação e na recuperação do mesmo envio. Recompra conserva o comportamento existente.

## Entrega

- [x] Executar tipos, lint, testes afetados e jornadas de desktop e celular com banco isolado. Revisar as três partes e a composição final.
- [ ] Abrir a PR a partir da `main` e acompanhar o CI. Merge e publicação seguem o fluxo de aprovação separado do projeto.
