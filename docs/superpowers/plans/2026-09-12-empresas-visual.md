# Empresas visual: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Aplicar tabela compacta e importação em etapas no padrão da Prospecção.

**Architecture:** Composição em app/ e apresentação comum em src/components/crm.
Serviço e repositório de empresas mantêm o contrato atual. Um formulário cliente
preserva o input de arquivo enquanto alterna etapas locais.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, componentes existentes,
Vitest e Playwright. npm, sem dependências novas.

**Spec:** docs/superpowers/specs/2026-09-12-empresas-visual-design.md

## Restrições globais

- Ler AGENTS.md, PREFERENCIAS.md, REGRAS.md e documentação local pertinente em
  node_modules/next/dist/docs antes do código.
- Branch codex/empresas-visual. Preservar a edição já existente de PREFERENCIAS.md
  e os arquivos locais AGENTS.md e CONTINUIDADE-CODEX.md; não incluí-los em commits.
- Sem alteração de Meu dia, Carteira, regras comerciais, SQL ou dependências.
- TDD por tarefa. Testes de app/ usam .test.tsx, conforme vitest.config.mts.
- Banco temporário local apenas. Confirmar host antes das suítes; não usar Railway.
- Nunca commit na main. Conferir e barrar branch inesperada antes de cada commit.

## Tarefa 1: tabela e shell

Modificar app/empresas/page.tsx, lista.tsx, linha.tsx, paginacao.tsx e testes
vizinhos. Criar app/empresas/layout.tsx e empresas.module.css. Modificar
src/components/crm/shell.tsx e shell.test.tsx para área empresas.

Interface preservada: Lista({ linhas }: { linhas: EmpresaNaLista[] }), com
EmpresaNaLista de src/features/empresas/listagem.ts. Sem campos de dono ou venda.
Layout espelha app/carteira/layout.tsx, exigindo gestor em vez de usuário.

- [ ] Ler integralmente os arquivos citados e seus testes antes de editar.
- [ ] RED: tabela semântica e dados de localização, permissão e área ativa:

```tsx
expect(renderToStaticMarkup(<Lista linhas={linhas} />)).toContain('<table')
expect(renderToStaticMarkup(<Lista linhas={linhas} />)).toContain('<th')
```

Usar fixtures já existentes de lista.test.tsx e linha.test.tsx, preservando casos
sem CEP e CEP não encontrado. Testar nome acessível do campo de busca e paginação
mantendo o termo. Executar os testes afetados e observar falha pelo contrato novo.
- [ ] Implementar tabela e shell, preservando busca GET e destinoCanonico.
- [ ] GREEN: executar testes afetados, typecheck e lint. Revisar 390/820/1280 na
  etapa de navegador. Commit da tarefa na branch.

## Tarefa 2: apresentação compartilhada das etapas

Criar src/components/crm/etapas.tsx, etapas.module.css e etapas.test.tsx.
Modificar app/fila/etapas.tsx e remover somente CSS de etapas extraído de
app/fila/shell.module.css. Preservar URLs, callback e bloqueado da Fila.

Interface proposta:

```tsx
type ItemEtapa = { id: string; rotulo: string; acao?: React.ReactNode }
type PropsEtapas = {
  rotulo: string
  atual: string
  itens: readonly ItemEtapa[]
}
```

Etapas renderiza nav com aria-label, um indicador por item e aria-current=step
somente no atual. A tela chamadora fornece Link/button apenas para retornos
permitidos. Nunca mover filtros da Prospecção para o componente comum.

- [ ] RED: rótulo acessível, indicador atual único, etapas futuras como texto.
- [ ] Executar testes de etapas e app/fila/etapas.test.tsx, observando a falha nova.
- [ ] Implementar componente, reutilizar na Fila sem alterar navegação.
- [ ] GREEN: testes de etapas e shell, typecheck. Commit da tarefa.

## Tarefa 3: importação e estado do arquivo

Modificar app/empresas/importar/page.tsx e formulario.tsx; criar
etapas-importacao.tsx, relatorio.tsx e formulario.dom.test.tsx no mesmo diretório.
Modificar formulario.test.tsx e mensagens efetivamente exibidas em
src/features/empresas/mensagens.ts com seus testes, apenas para texto sem travessão.
Ler como molde app/carteira/[id]/ficha.dom.test.tsx e formulario.test.tsx existentes.

Contratos existentes: importarAcao(anterior, form) retorna EstadoImportar
{ erro, relatorio, inseridas }; Relatorio em src/features/empresas/servico.ts.
Não exportar estado inicial de arquivo use server. Não duplicar Relatorio.

Estado de apresentação proposto:

```tsx
type EtapaImportacao = 'enviar' | 'conferir' | 'concluir'
// etapa local não autoriza gravação. O servidor reanalisa o File a cada envio.
// Input arquivo montado na mesma posição do formulário, mesmo quando oculto.
// onChange invalida o relatório exibido; só resposta do envio atual o habilita.
```

- [ ] RED no DOM: selecionar File, conferir, voltar, confirmar que input.files[0]
  é o mesmo objeto. Trocar File exige Conferir novamente, sem botão Importar.
- [ ] RED: indicadores não avançam; pendente bloqueia arquivo e retornos;
  relatório zero novas não confirma; falha elimina confirmação obsoleta;
  sucesso oferece reinício e link Empresas, sem volta a Conferir.
- [ ] Usar mocks de action controlados por promises para resposta lenta e erro,
  seguindo harness DOM existente. Asserções de interação devem usar DOM real,
  não leitura de fonte nem snapshots como prova de preservação do File.
- [ ] Implementar etapas, relatório e bloqueios. Manter input dentro do form e
  montado durante Enviar/Conferir; não trocar key do form ao voltar. Remover o
  arquivo somente ao reiniciar após sucesso ou por troca explícita do usuário.
- [ ] Manter ações nomeadas Conferir arquivo e Importar N empresas; após voltar
  a Enviar, exigir nova conferência para avançar, preservando File selecionado.
- [ ] GREEN: testes unitários/DOM afetados e typecheck. Commit da tarefa.

## Tarefa 4: jornada real e revisão

Criar tests/e2e/empresas-visual.spec.ts; usar autenticação existente em
tests/e2e/autenticacao.spec.ts como molde e dados controlados do harness.
Não usar empresas que outras jornadas modificam. Ler gerador/fixtures atuais de
CNPJ em testes de empresas antes de escolher valores; não inventar dígitos válidos.

- [ ] Escrever jornada: gestor acessa tabela, busca e limpa, abre importação;
  seleciona CSV com novas, já cadastrada e recusada; confere, volta, verifica File,
  confere novamente, confirma e encontra nova empresa na tabela.
- [ ] Provar ausência de gravação após Conferir mediante consulta só ao banco
  temporário ou busca pela empresa em segunda página autenticada. Provar gravação
  após Importar. CNPJ exclusivo da fixture deve ser validado antes do teste.
- [ ] Exercitar arquivo inválido, troca após relatório, zero novas e vendedor
  recusado por URL. Preservar testes existentes de autorização da action; ampliar
  apenas se a implementação alterar o contrato dela.
- [ ] Exemplo do caminho de navegador (locator do input deve ter label Arquivo CSV):

```ts
await page.getByLabel('Arquivo CSV').setInputFiles({
  name: 'empresas.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8'),
})
await page.getByRole('button', { name: 'Conferir arquivo', exact: true }).click()
await expect(page.getByRole('button', { name: /Importar \d+ empresas/ })).toBeVisible()
```

- [ ] Conferir visual e teclado em 390/820/1280 claro e escuro: tabela acessível,
  erro legível, foco em mudança de etapa, botões alcançáveis. Capturas reais.
- [ ] Regenerar npm run test:inventario; executar typecheck, lint, db:checar,
  test:unit, test:integracao e test:e2e (inclui build). Não executar builds
  concorrentes na mesma saída. Falha de infraestrutura deve ser declarada.
- [ ] Revisar diff contra cada item de aceite, sem adicionar escopo. Conferir que
  Fila continua com seus testes de navegação e que nada tocou banco real.
- [ ] Abrir PR contra main com resultados e capturas. Conferir CI no SHA final.
  Apresentar resultado para validação; merge somente quando autorizado.

## Autorrevisão do plano

### Registro da execução em 14/09/2026

- [x] Tabela, shell e etapas compartilhadas implementados; testes da Fila preservados.
- [x] Importação em etapas com arquivo persistente, erros, confirmação e reinício.
- [x] Revisão independente; correção do foco de retorno com RED real e GREEN 5/5.
- [x] Unitários finais: 782 passando, 1 pulado. Integração: 422 passando, 1 pulado.
- [x] Typecheck, lint, db:checar e build E2E sem URLs de banco verdes.
- [x] 30 jornadas reais de navegador verdes, bancos temporários locais removidos.
- [x] Capturas de tabela/conferência em 390/820/1280 e erro em 390, claro/escuro; inspeção visual local.
- [ ] Abrir PR, conferir CI do SHA final e apresentar para aprovação visual do usuário.

Notas de execução: a implementação anterior foi preservada e revisada, sem
refazer artificialmente o RED. A entrega será um commit consolidado em vez dos
commits intermediários sugeridos. Unitários concorrentes locais tiveram falhas
de prontidão/importação; a execução sequencial passou sem mudar timeouts.
O inventário foi regenerado com o algoritmo do script a partir do relatório
JSON dessa execução verde (783 casos), incluindo os testes dinâmicos de docs.
O CI continua usando o comando unitário padrão concorrente.
Na primeira rodada E2E, o seletor de alerta incluía o anunciador do Next e
beforeAll repetia uma precondição de um teste já concluído após reinício do
worker. Ambos foram corrigidos nos testes e a rodada final passou inteira.

Tabela/shell e estados vazios: tarefa 1. Reuso visual sem acoplamento: tarefa 2.
Etapas, File persistente, erros e confirmação: tarefa 3. Persistência real,
permissões, regressão, responsividade e CI: tarefa 4. Não há feature adicional.
