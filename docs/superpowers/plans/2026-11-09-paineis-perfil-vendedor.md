# Painéis do perfil do vendedor

> Implementar e revisar em etapas separadas com `superpowers:subagent-driven-development`.

**Objetivo.** Abrir Empresas e Atendimentos na lateral do perfil acessível ao gestor, conforme a [opção aprovada](../../design/2026-11-06-perfil-vendedor-organizacao/README.md) e a [validação da paginação](../../design/2026-11-06-perfil-vendedor-organizacao/validacao.md).

## Implementação

- [ ] Preparar regressões para o perfil inicialmente fechado, abertura e fechamento com foco e retomada da consulta. Reaproveitar os botões e o painel responsivo da base do CRM. Manter identificação, indicadores, Atualizar e Voltar para Usuários na página principal.
- [ ] Exibir nome, CNPJ copiável, retorno e próximo passo em cards compactos. Usar a consulta existente de 50 por página e manter o recorte de Usuários nos links. Mostrar intervalo e controles de paginação no rodapé, com limites desabilitados e recuperação de página vazia. Manter a página ao trocar de painel.
- [ ] Exibir até 20 atividades na linha do tempo compartilhada. Manter filtro e itens expandidos ao reabrir e reiniciar o estado ao trocar de vendedor. Reaproveitar os dados, permissões e consultas existentes, sem migração.

## Verificação e entrega

- [ ] Cobrir 50 + 1 empresas, navegação entre páginas, CNPJ, filtros, expansão do histórico, retorno à lista de Usuários, Escape e apresentação em desktop e celular com dados isolados.
- [ ] Rodar verificações de tipos, lint e testes afetados. Pedir revisão independente, corrigir achados e verificar novamente.
- [ ] Abrir PR para `main` e acompanhar o CI até aprovação. Aguardar outra autorização para integrar e publicar.
