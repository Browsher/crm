# Base comercial do Funil: plano da primeira fatia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Introduzir a base de negociação e classificação comercial sem expor uma venda antes de suas telas consumidoras estarem prontas.

**Architecture:** PostgreSQL autoriza posse, transições e leitura. A fonte atual de responsável continua empresa_fila; negociação representa um ciclo e venda representa um fato histórico. Migração incremental preserva empresas e contatos.

**Tech Stack:** Next.js, TypeScript, PostgreSQL, Vitest e Playwright existentes; npm.

**Spec:** docs/superpowers/specs/2026-09-15-funil-comercial-design.md

## Global Constraints

- Testes somente em banco temporário Docker. Não aplicar na Railway neste plano.
- TDD, branch codex, PR contra main, nunca commit na main.
- Não alterar arquivos locais alheios nem excluir os dados atuais de teste.
- Não criar grant de função sem consumidor (R-014).
- Não importar de outra features; composição em app e contratos comuns em lib.
- Implementação pelo agente principal, testes focados e uma revisão final.
- Este é plano da base; UI, executor de expiração e transferência têm fatias próprias.

## Arquivos e responsabilidades

- Criar src/lib/comercial.ts e src/lib/comercial.test.ts: vocabulário de etapas
  usado por consultas e UI, sem decidir autorização em TypeScript.
- Criar db/migracoes/0028_comercial.sql e docs/db/0028.md: estrutura de ciclos,
  venda e eventos, políticas, integração atômica com assumir/devolver. Conferir
  numeração livre imediatamente antes de criar; migrações antigas são imutáveis.
- Criar src/features/funil/consulta.ts e testes/integracao/funil-base.test.ts:
  leitura própria com autoria filtrada e contrato para o quadro/modal.
- Atualizar src/server/db/migracoes/invariantes.ts e seus testes somente com
  tabelas/funções realmente criadas e concedidas; seguir padrão existente.
- Atualizar docs/db/fundacao.md e referências antigas afetadas com ponteiros.
- Ler db/migracoes/0018_contato_registrar.sql e a substituição em
  db/migracoes/0025_fila_reservar.sql integralmente; conferir definições vigentes.

## Tarefa 1: conferir transações existentes e fixar contrato

- [x] Localizar todas as definições substituídas e seus chamadores:

```powershell
rg -n 'contato_registrar|empresa_assumir|empresa_devolver|fila_reservar' db/migracoes src app
rg -n 'FUNCOES_CONCEDIDAS|TABELAS|POLITICAS' src/server/db/migracoes/invariantes.ts
```

- [x] Ler funções completas e anotar ordem dos bloqueios no doc 0028. Usar a
  mesma ordem no novo fluxo; não adicionar locks em ordem oposta.
- [x] Escrever teste RED do vocabulário antes de criar o módulo:

```ts
import { expect, test } from 'vitest'
import { ETAPAS_FUNIL, ehEtapaFunil } from './comercial'
test('funil tem somente as três etapas abertas', () => {
  expect(ETAPAS_FUNIL).toEqual(['primeiro_contato', 'em_negociacao', 'proposta_enviada'])
  expect(ehEtapaFunil('venda_concluida')).toBe(false)
  expect(ehEtapaFunil('toString')).toBe(false)
  for (const etapa of ETAPAS_FUNIL) expect(ehEtapaFunil(etapa)).toBe(true)
})
```

- [x] Executar RED: `npx vitest run --project unitario src/lib/comercial.test.ts`.
- [x] Implementar e repetir o teste:

```ts
export const ETAPAS_FUNIL = ['primeiro_contato', 'em_negociacao', 'proposta_enviada'] as const
export type EtapaFunil = typeof ETAPAS_FUNIL[number]
export function ehEtapaFunil(valor: string): valor is EtapaFunil {
  return (ETAPAS_FUNIL as readonly string[]).includes(valor)
}
```

## Tarefa 2: negociação ao assumir, preservação ao devolver

**Interface:** manter a assinatura e resultados existentes de contato_registrar.
Adicionar negociação em primeiro_contato na mesma transação da assunção.
Identidade vem de usuario_atual(), nunca de autor enviado pelo formulário.

- [x] Usar criarBancoDeTeste/criarUsuario dos testes de integração existentes.
  Criar dois vendedores, gestor e empresas no banco descartável.
- [x] Escrever testes que chamem registrarContato pelo caminho real, comprovando:
  assumir cria um ciclo; reservar não cria; repetir não cria segundo ciclo;
  devolver encerra ciclo e preserva contato; assumir novamente cria novo ciclo.
- [x] Rodar `npx vitest run --project integracao tests/integracao/funil-base.test.ts`
  e registrar falha por ausência do comportamento, não falha de conexão.
- [x] Criar migração aditiva. Contrato de estrutura:

```sql
CREATE TABLE negociacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id),
  vendedor_id uuid NOT NULL REFERENCES usuario(id),
  etapa text NOT NULL CHECK (etapa IN ('primeiro_contato','em_negociacao','proposta_enviada')),
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  encerrada_em timestamptz,
  encerramento text CHECK (encerramento IN ('venda','devolucao','inatividade')),
  CHECK ((encerrada_em IS NULL) = (encerramento IS NULL))
);
CREATE UNIQUE INDEX negociacao_aberta_empresa_idx ON negociacao(empresa_id)
  WHERE encerrada_em IS NULL;
```

- [x] Completar owner/RLS sem FORCE e grants segundo a fundação; vendedor só
  lê ciclo próprio e de posse atual, gestor lê administrativo. Não conceder
  INSERT/UPDATE direto ao app. Adaptar funções vigentes completas, preservando
  seus retornos, reservas/contextos, poder de escrita e limites de sessão.
- [x] Posse antiga sem compra documentada vira ciclo inicial, sem inventar venda.
  Não apagar nem reatribuir contatos; documentar instante de migração como início.
- [x] Repetir testes e invariantes; provar que rollback não deixa meio ciclo.

## Tarefa 3: leitura própria e proteção de clientes

**Interface proposta:** lerFunil(usuarioId: string) retorna negociações abertas
do ator com id, empresaId, nome, cidade e etapa. lerNegociacao(usuarioId, id)
retorna detalhes autorizados ou null, incluindo apenas contato.criado_por = ator.
Não chamar lerHistorico global diretamente nem importar outra feature.

- [x] Testar vendedor A/B: B assume empresa antes atendida por A; lista, resumo,
  próximo passo e histórico de B não contêm a nota de A. A perde acesso ao ciclo
  atual de B. Gestor continua lendo histórico administrativo.
- [x] Implementar SQL parametrizado sob comoUsuario, com filtro de posse atual
  e autor antes de retornar qualquer campo. Não enviar telefone no resumo do card.
- [x] Preparar relação de venda com empresa, autor, data, valor exato e chave de
  idempotência única. Sem conceder função de registro antes do consumidor da
  próxima fatia. Fixture administrativa pode simular cliente somente nos testes.
- [x] Testar cliente com dono inativo não elegível à reserva, sugestão ou consulta
  como disponível; cliente ativo não devolvível pelo caminho antigo. Prospecto
  continua seguindo regras anteriores até a fatia da expiração.
- [x] Aplicar a proteção em todos os caminhos de disponibilidade identificados
  na tarefa 1, incluindo empresa_consultar, empresa_resumos e empresa_sugestoes.
  Use existência de venda como fato comercial; não deduzir cliente de tipo contato.
- [x] Repetir integração incluindo grupos, fila e contato. Nenhum teste depende
  de banco real ou de timeout arbitrário para simular 30 dias.

## Tarefa 4: verificação e entrega da base

- [x] Conferir migração em banco novo e em banco com posse/contatos anteriores.
- [x] Documentar políticas, bloqueios, compatibilidade e consumidor de cada grant.
- [x] Rodar typecheck, lint, db:checar, test:unit, test:integracao e build:e2e.
  Atualizar inventário com test:inventario; limitar workers locais se necessário.
- [x] Rodar test:e2e -- --sem-build para comprovar que a base não quebra as telas.
- [x] Revisão independente focada em RLS, disponibilidade de cliente, concorrência
  e ausência de vazamento por último contato global.
- [ ] Conferir branch antes de cada commit, stage só dos arquivos da fatia;
  abrir PR contra main e aguardar CI do SHA exato. Não fazer merge automático.

## Cobertura e dependências de lançamento

Esta fatia entrega estrutura/consulta, assunção e proteções. Não entrega o modal,
formulário de venda nem expiração recorrente. A próxima fatia só pode habilitar
registro de venda junto com os consumidores Carteira/Meu dia compatíveis.
Regras de prazo e operação recorrente serão detalhadas antes da fatia 4, sem
prometer execução automática com o computador desligado antes de ter executor.

## Decisões da execução

RLS sem FORCE segue a fundação vigente. Eventos de ciclo são representados por
iniciada_em, encerrada_em e encerramento. As duas funções novas são internas,
sem GRANT ao app; as invariantes genéricas já as cobrem. O dashboard precisa
excluir clientes do estoque e por isso recebe ajuste mínimo nesta fatia.

## Resultado local

918 unitários passaram (1 pulado), 479 de integração passaram (1 pulado),
41 jornadas de navegador passaram. Typecheck, lint, db:checar e build:e2e
verdes. Revisão independente sem achados acionáveis. Apenas bancos temporários
Docker usados; Railway sem aplicação. PR/CI ainda são etapa de entrega.
