# Plano: Últimas buscas e inclusão automática

Spec: ../specs/2026-10-27-ultimas-buscas-correcao.md. Implementação inline e revisão independente final. Basebdde171, worktreecrm-redesign, branchcodex/redesign-crm, PR55.

1. Leitura: TDD empresasRecentes no repositório com RLS, whitelist, fonte retornada, deduplicação, ordem e limite11. Nenhum endpoint externo.
2. Automação: TDD do modoNULL em busca_empresa_importar existente, migração0049/docs/inventários, sem novos privilégios. Guardas/travas, semtelefone, repetição, zero grupo vazio, concorrência, replay. Action persiste primeiro e inclui depois; recuperação não repete compra nem recebe candidatos do navegador.
3. UI: Últimas buscas ocupa a seção antiga. Histórico completo em botão/Dialog; Ver empresa lê só o CNPJ correspondente da busca própria e conserva privacidade/pausa. Substituir seleção manual por status de inclusão e recuperação. Desktop amplo80/120 e campos úteis/indicadores; compacto36/40, carrossel1:1 e foco/teclado preservados.
4. Verificar tipos/lint/build/unidade/integração/E2E. Revisão independente e correçõesRED/GREEN. CI da fonte exata. Novo backup, aplicar só0049 e incluir válidas das5já salvas na busca f198661a do Junior, com rechecagem nativa e preservação de cadastros anteriores/cotas100. Publicar e conferir alias/smoke; atualizar prévia/registro/PR55. Nenhuma consulta real, nova cobrança ou mudançaGoogle/n8n/planilha.

## Riscos para revisão

- Busca retornada sem grupo deve aparecer; mesma empresa em duas buscas usa snapshot mais recente e só a primeira inclusão ganha empresa/lista.
- CNPJ e busca alheios são recusados; cards não recebem contatos efetivos/documentos.
- Inclusão após consulta não pode desfazer pagamento/resultados nem gerar outro HTTP ao retomar.
- Pausa/identidade/concorrência são decididas no banco; nenhuma lista vazia.
- Dialogs encadeados, resposta atrasada/retry/resize e foco não perdem rascunho ou disparam aquisição.
- Desktop rico deve conservar1:1, uma linha e ausência de sobreposição; celular compacto.
