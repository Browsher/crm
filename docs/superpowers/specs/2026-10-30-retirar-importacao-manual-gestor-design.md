# Retirar a importação manual do gestor

## Pedido e escopo aprovado

O usuário escolheu o item 1 do pacote de pendências: retirar os botões, a tela e a ação de importação manual do gestor. A opção Listas continua no menu, conforme sua correção anterior. Esta entrega não executa a limpeza das 43 empresas identificadas na auditoria.

## Comportamento esperado

- Empresas e Listas não oferecem importar empresas, planilhas ou arquivos, inclusive nos estados vazios e de filtros inválidos.
- O endereço antigo `/empresas/importar` exige a autorização de gestor e encaminha para `/empresas`, sem apresentar formulário. Visitantes e vendedores conservam o tratamento da guarda atual.
- A ação antiga não pode conferir nem gravar arquivos, mesmo se chamada por uma aba antiga. Pode ser removida do build ou substituída por uma recusa explícita, após a guarda.
- A função SQL exclusiva `grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb,jsonb)` perde EXECUTE para `app_usuario` e PUBLIC por migração nova, conforme R-014. Nenhuma migração anterior é editada.
- As buscas do Banco e entregas do Google conservam suas funções próprias. Listas, seus detalhes e a edição gerencial continuam disponíveis.
- Nenhuma empresa, grupo, atendimento, negociação, vínculo ou venda é apagado ou arquivado nesta entrega.

## Implementação e verificação

Usar o padrão existente de guarda e redirecionamento do projeto. Remover os componentes exclusivos do formulário que ficarem sem uso; preservar utilitários compartilhados quando houver consumidor real. Atualizar textos que convidam à importação e a documentação operacional atual, sem reescrever documentos históricos.

Os testes devem verificar a ausência dos atalhos, o destino do endereço antigo, a impossibilidade de escrita pela ação e a revogação de privilégio SQL. Jornadas que usavam importação para preparar dados devem usar fixtures administrativas no banco temporário, mantendo a cobertura de consulta, listas, permissões e atendimento. Testes exclusivos do comportamento retirado podem ser removidos ou substituídos por testes do novo contrato.

Entrega em branch e PR, com revisão independente e CI. Merge, publicação e execução de migrações em produção não fazem parte da autorização deste item.
