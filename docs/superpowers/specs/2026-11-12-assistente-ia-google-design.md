# Assistente de filtros do Google

No Planejamento da semana, junto de **Critérios de busca**, cada dia editável mostra **Sugerir filtros com IA**. Por padrão o controle fica desabilitado com a indicação **Em breve**. Tanto a tela quanto a ação no servidor exigem ativação explícita e uma chave configurada para Claude.

Quando ativado, o botão abre o painel lateral compartilhado do CRM. O vendedor descreve o produto e pode informar a região. O painel apresenta até três públicos distintos, com nicho, termos adicionais e, quando pertinentes, produtos de interesse e exclusões explícitas. A região é exibida uma vez. Quando o vendedor não informa cidade e UF com clareza, permanece a região já preenchida no rascunho. Uma região sugerida é aplicada em conjunto e pode abranger a cidade inteira.

**Aplicar filtros** copia somente os campos apresentados para o rascunho do dia escolhido e fecha o painel. Os demais critérios permanecem no rascunho. O fluxo de edição e salvamento existente continua responsável por persistir o planejamento. O assistente não tem ferramentas de busca, coleta, planilha ou banco de dados. Fechar o painel descarta somente o texto e as sugestões ainda não aplicadas, com a confirmação de descarte usada pelo planejamento.

A API direta da Anthropic usa Claude Haiku 5.5 e saída estruturada. O servidor verifica a sessão, valida entradas e respostas, limita o tamanho da chamada e traduz falhas em mensagens no painel. A chave permanece no servidor e o conteúdo enviado se limita à descrição digitada. Os testes usam respostas simuladas. A liberação real depende de chave, saldo e teste com a API.

O servidor confere se a descrição contém a cidade e, quando sugerido, o bairro. Se faltar essa evidência, omite a região e mantém os demais filtros.

Para liberar, crie uma chave em um [workspace dedicado da Anthropic](https://platform.claude.com/docs/en/manage-claude/workspaces) e ajuste os limites de gasto e frequência nesse workspace. Configure a chave como `ANTHROPIC_API_KEY` no servidor. Valide uma geração em prévia com `CRM_GOOGLE_IA_ATIVA=1` antes de usar a mesma configuração em produção.
