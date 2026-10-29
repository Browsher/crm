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

## Revisão e correção

Revisão independente da fonte58d1e83: zero Critical, um Important, zero Minor; nada deixado sem julgamento. Grupo criado não comprova inclusão integral de uma pesquisa antiga parcialmente selecionada. Reproduzido com unitário, integração nativa e navegador antes do ajuste; acrescido marcador transacional na0049 ainda pendente, permitindo Concluir inclusão na mesma lista. Uma rodada de correção, sem re-revisão. Após o ajuste:1.751 unitários aprovados e um ignorado;50 integrações focadas;15 jornadas afetadas. Tipos, lint, build e convenções aprovados. Publicação exige CI integral da fonte exata, backup e conferência de preservação.

## Entrega

Fonte473f0df, CI40575608030 integral aprovado (77E2E), migração0049 aplicada com backup/dados/cotas preservados. Busca f198661a do Junior incluiu5na mesma lista; replay0 e leituraRLS dos outros vendedores0. Deployment dpl_8a3jRGKywRjoSar6da7EoArMmPn2 promovido e smokeonline aprovado. Nenhuma compra externa. Registros finais em docs/operacao/producao-vercel.md.
