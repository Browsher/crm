# Perfil da empresa no assistente do Banco

> Implementação por tarefa com regressões antes das mudanças e revisão independente.

**Objetivo**. Gerar filtros opcionais de perfil por público e aplicá-los ao rascunho do Banco com capital informado manualmente.

**Arquitetura**. Reaproveitar o assistente por SKU e a consulta existente. A resposta da IA inclui apenas filtros suportados. Uma função pura calcula as mudanças selecionadas e valida a combinação com o rascunho. O painel exibe motivos e consequências antes de aplicar.

**Especificação**. [Perfil da empresa no Banco](../specs/2026-11-12-assistente-ia-perfil-empresa-banco-design.md).

## Tarefas

1. Em `src/server/busca-empresas/assistente-ia.ts`, validar sugestões de porte, MEI, Simples, estabelecimento, idade e contato. Cobrir hipóteses por público, valores fora do contrato e capital omitido com Claude simulado.
2. Em `src/lib/assistente-ia-banco.ts`, aplicar apenas filtros selecionados e capital digitado. Cobrir precedência de MEI, datas dependentes, faixa inválida e preservação de filtros do rascunho. Verificar o payload no adaptador da Casa dos Dados.
3. Em `app/fila/buscar`, apresentar a revisão dentro do painel de sugestões. Usar os componentes do CRM e manter o formulário principal como único ponto de consulta. Cobrir aplicação, seleção de opção, conflito e edição manual de capital com testes DOM.
4. Verificar Google e Banco em Chromium, em desktop e celular, com Claude e Banco simulados. Executar revisão independente, abrir a PR e acompanhar o CI.
