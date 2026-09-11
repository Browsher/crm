# Fila: sequência de entregas

Spec: docs/superpowers/specs/2026-09-10-fila-interface-design.md.
Este arquivo organiza as entregas; cada uma exige seu plano executável antes
de código. Não é autorização para implementar todas com contratos inferidos.

1. CNAE opcional na importação, persistência e exibição na lista do gestor.
   Plano executável: 2026-09-10-cnae-importacao.md. Modelo antigo continua válido.
2. Consulta resumida e filtros: nome, CNAE, estado, cidade e bairro. Projeção
   autorizada no banco, sem telefone, e-mail, contato ou histórico antes da
   reserva. Não ampliar SELECT da tabela empresa para expor campos sensíveis.
3. Reserva por empresa e troca filtrada: concorrência, elegibilidade, manter
   reserva se não houver candidata, expiração e tentativa explícita de renovar.
4. Recentes: armazenamento por usuário, deduplicação, limite de 10 e consulta
   sujeita às permissões atuais. Contato e abertura de perfil atualizam recência.
5. Base visual e Fila: shadcn, tokens, shell e galeria; depois fluxo Puxar,
   Consultar e Registrar. Botões de etapa só voltam. Ações avançam. Rascunhos
   preservados por empresa e confirmação antes de descarte. Telefone/histórico
   somente onde autorizados. Visual do protótipo aprovado como referência.

Cada entrega: TDD, revisão, validação pertinente, PR contra main e CI verde.
Não empilhar PRs. Migrações novas, nunca editar as aplicadas. Atualizações no
banco real seguem o procedimento operacional do projeto após integração.
O protótipo não implementa concorrência nem permissões: não é fonte de regras
além das decisões explicitadas na spec.

Capital e sócios fora do escopo. Não importar outro router, autenticação ou
backend do shadcn-admin. A galeria valida componentes em estados realistas,
incluindo erro, carregamento, desabilitado, teclado e telas estreitas.
