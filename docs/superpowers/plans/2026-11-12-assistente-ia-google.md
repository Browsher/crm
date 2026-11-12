# Plano de implementação do assistente de filtros do Google

> **Para agentes:** executar as etapas em ordem com testes de regressão.

**Objetivo.** Deixar o assistente preparado e exibir Em breve por padrão.

**Arquitetura.** Uma ação de servidor verifica vendedor e configuração, chama Claude e devolve sugestões tipadas. O painel usa os componentes do CRM e altera somente o rascunho já mantido pelo planejamento.

**Stack.** Next.js, TypeScript, Zod, Vitest e API Messages da Anthropic.

**Design.** [Assistente de filtros do Google](../specs/2026-11-12-assistente-ia-google-design.md)

## Servidor

- [x] Escrever testes de bloqueio sem ativação ou chave, sessão de vendedor, contrato da chamada, retorno inválido, região inventada e falha de créditos.
- [x] Executar o teste e observar falha antes da implementação.
- [x] Adicionar `sugerirFiltrosGoogleAcao(descricao: string)` com configuração privada em `src/server/google/assistente-ia.ts` e contrato compartilhado em `src/lib/google/assistente-ia.ts`.
- [x] Documentar variáveis em `.env.example` e executar os testes sem requisições pagas.

## Planejamento

- [x] Escrever testes do estado Em breve e da aplicação de uma opção somente ao dia escolhido, preservando os outros critérios.
- [x] Executar os testes e observar falha antes da implementação.
- [x] Integrar `AssistenteIaGoogle` com a edição de dias futuros e o painel lateral compartilhado. Reutilizar a proteção de edição e manter o salvamento da semana separado.
- [ ] Rodar testes, checagem de tipos, lint e build. Conferir no navegador o estado padrão em desktop e celular. Entregar em branch e PR para revisão.
