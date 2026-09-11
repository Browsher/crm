# Reserva por empresa e troca filtrada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** reservar uma empresa escolhida e trocar a reserva conforme os filtros,
sem perder a reserva atual quando a tentativa falhar.

**Architecture:** a transação PostgreSQL decide elegibilidade e troca. As ações
da aplicação validam entrada e traduzem resultado; a interface preserva filtros
e rascunho. Nenhuma decisão de disponibilidade depende apenas do status exibido.

**Tech Stack:** PostgreSQL, Next.js, React, TypeScript, Vitest e Playwright.

**Spec:** docs/superpowers/specs/2026-09-10-fila-interface-design.md.

## Regras aprovadas

- Reserva de 30 minutos, com prazo calculado pelo banco.
- Buscar cliente e Próxima respeitam nome, CNAE, estado, cidade e bairro.
- Reserva por escolha é por id, após o vendedor selecionar o cadastro.
- Empresa de outro vendedor continua visível como resumo e indisponível.
- Troca sem candidata mantém empresa, prazo e rascunho atuais.
- Troca não registra contato e não aplica descanso de 30 dias.
- Confirmação antes de descartar anotações ao trocar de empresa.
- Expiração preserva anotações, bloqueia envio e oferece nova tentativa explícita.
- Não renovar automaticamente ao consultar, recarregar ou repetir uma ação.
- Sem travessões nos textos da interface.
- Branch e PR contra main; migração nova, testes isolados, revisão e CI verde.

## Evidências da preparação

Lidos nesta preparação: src/features/fila/repositorio.ts, app/fila/acoes.ts,
app/fila/formulario.tsx, app/fila/cartao.tsx, src/features/contato/acao.ts,
0018_contato_registrar.sql e 0019_fila_interna.sql.
O contrato atual puxarProxima só retorna id ou fila vazia. A tela esconde o
botão quando existe reserva. Cartao contém FormularioContato, portanto botão
Próxima não pode envolver esse cartão em outro form.
contato_registrar bloqueia a linha de empresa antes de conferir reserva.
As funções assumir/devolver são internas desde 0019 e assim devem continuar.

## 1. Contrato e concorrência no banco

Arquivos: nova migração 0025 (conferir número livre), docs/db/0025.md,
ponteiro docs/db/0016.md, src/features/fila/repositorio.ts e testes;
src/server/db/migracoes/invariantes.ts e seus testes.

- [x] Definir resultado discriminado com sucesso, sem candidata, indisponível,
  contexto alterado e sem permissão. Retornar id e prazo somente quando autorizado.
- [x] Escrever testes SQL antes de implementar: dois vendedores escolhem a mesma
  empresa, duas requisições do mesmo vendedor, troca com fila vazia, exclusão da
  reserva atual, filtro sem resultado, reserva expirada e senha provisória.
- [x] Serializar operações de reserva do mesmo usuário dentro da transação.
  Usar lock transacional dedicado; não bloquear a linha de usuario, evitando
  conflito com chaves estrangeiras dos registros de contato.
- [x] Bloquear empresas de modo compatível com contato_registrar. Candidata
  ocupada por outra transação não deve fazer a seleção automática esperar;
  validar novamente elegibilidade depois de adquirir o lock.
- [x] Identificar o contexto esperado pelo cliente para recusar uma segunda
  troca enviada de tela antiga. Não confiar no id do usuário vindo do formulário.
- [x] Escolher e bloquear a candidata antes de liberar a anterior. Publicar a
  liberação e aquisição na mesma transação; nenhuma candidata implica nenhuma
  alteração. Ordem de locks deve evitar deadlock em tentativas cruzadas.
- [x] Manter empresa da carteira fora de nova reserva e respeitar dono ativo,
  descanso e prazo vigente. A política de dono desativado segue a fila atual.
- [x] Reserva vigente da mesma empresa não estende prazo. Nova reserva após
  expiração exige comando explícito e nova verificação de elegibilidade.
- [x] Reutilizar a semântica dos filtros da consulta sem importar uma feature
  dentro de outra. Código compartilhado só sobe para lib/server quando houver
  dois consumidores reais, com os testes existentes acompanhando a mudança.
- [x] Retirar a exposição de fila_puxar() quando o consumidor da interface
  migrar para fila_reservar(), sem manter um caminho concedido sem uso (R-014).
- [x] Testar que contatos, elegivel_em e primeira_reserva_em preservam sua
  semântica. Nenhum GRANT novo sem consumidor incluído nesta mesma entrega.

## 2. Ações e interface funcional

Arquivos: app/fila/acoes.ts, formulario.tsx, cartao.tsx, page.tsx,
app/fila/localizar/resultados.tsx e componentes de ações próprios; formulário
de contato apenas para integração de estado de rascunho/expiração.

- [x] Ler inteiro src/features/contato/formulario.tsx antes de alterar seu
  contrato e ler os guias Next locais relevantes antes dos componentes.
- [x] Acrescentar Reservar para ligar aos resultados elegíveis. Sucesso abre
  a Fila com a empresa reservada; falha atualiza o estado sem revelar contatos.
- [x] Transportar filtros validados para a Fila e para as ações de próxima.
  Rejeitar filtro inválido, sem cair silenciosamente em busca sem filtro.
- [x] Exibir Próxima como form irmão do cartão, nunca form aninhado.
  Desabilitar durante envio, mas garantir duplicidade também no banco.
- [x] Propagar estado de rascunho por props/callbacks a partir da composição
  em app. A feature de contato não importa a feature de fila ou prospecção.
- [x] Confirmar descarte antes da tentativa. Só limpar anotações depois de
  sucesso que realmente altere a empresa; erro ou fila vazia preservam texto.
- [x] Manter contagem regressiva acessível e bloquear envio ao expirar.
  Não apagar rascunho se revalidação retornar ausência de reserva; não manter
  uma empresa devolvida como se ainda estivesse reservada.
- [x] Tentar reservar novamente mantém rascunho da mesma empresa. Se outra
  pessoa adquiriu a reserva, explicar indisponibilidade sem perder o texto.
- [x] Testar estados puros e interações antes da implementação correspondente.
  Somente UI funcional nesta fatia; o redesign completo mantém sua etapa própria.

## 3. Verificação de entrega

- [x] Integração usa conexões independentes e barreiras explícitas para provar
  concorrência; não usar sleeps como prova de serialização.
- [x] Jornadas Playwright: localizar, reservar, telefone autorizado, próxima
  filtrada, nenhuma próxima, cancelar descarte, expirar e tentar novamente.
- [x] Conferir duas abas: submissão antiga não troca silenciosamente a empresa
  que a outra aba acabou de reservar. Testar leitura/registro alheios negados.
- [x] Rodar typecheck, lint, db:checar, suíte PostgreSQL 18, build e E2E.
- [x] Revisão do conjunto: ordem de locks, identidade, grants, compatibilidade
  das ações existentes, anotações e expiração. Ajustar plano se os testes
  demonstrarem necessidade; registrar decisões concretas na execução.
- [ ] PR contra main, CI verde e merge. Depois, backup configurado, checagem
  de pendentes, migração local/Railway e invariantes conforme fluxo autorizado.

## Limite desta preparação

Este plano registra a entrega e os pontos obrigatórios de verificação.
Assinaturas finais e protocolo de contexto esperado precisam ser fechados
na revisão técnica antes dos testes e do código, juntamente com a leitura
completa do formulário de contato. Não afirmar implementação concluída com
base apenas neste documento.

## Contrato fechado para execução

Contexto persistente por usuário em fila_contexto, versão UUID, leitura própria
por RLS e sem escrita direta. Ausência inicial é null. Aquisição/troca e
consumo da reserva por contato mudam versão, detectando inclusive ciclos de
reservar e devolver entre duas submissões de uma aba antiga.

fila_reservar(alvo uuid, nome text, cnae text, uf text, cidade text, bairro text,
contexto_esperado uuid) retorna resultado, empresa_id, reservado_ate e contexto.
Resultados: ok, sem_candidata, indisponivel, contexto_alterado. Permissão 42501,
parâmetro inválido 22023. Identidade sempre vem de usuario_atual().
Escolha explícita usa id; filtros são aplicados à seleção automática. A ação
sempre valida filtros, inclusive na escolha. Prazo usa relógio após locks.

Mesmo usuário serializado por advisory transacional; contato_registrar usa o
mesmo protocolo antes de bloquear empresa. Empresas anterior/candidata usam
locks sem espera: conflito preserva estado e solicita tentativa posterior.
fila_puxar() perde a permissão da aplicação, pois seu consumidor foi substituído.
A interface usa somente o contrato com contexto esperado.

Rascunho controlado no layout da Fila por empresaId. FormularioContato aceita
rascunho/onDraftChange/onSaved/bloqueado/onPendingChange por props. Ao perder
acesso, só painel de rascunho, sem reusar cartão antigo com contatos. Sucesso
de registro limpa rascunho pelo id submetido; falha de troca não limpa nada.
Nenhuma persistência em localStorage ou envio de rascunho sem registrar.

## Ajustes verificados durante a execução

- Navegação e filtros usam o roteador cliente para preservar a memória do layout.
- Expiração guarda somente id, nome e anotações, inclusive quando vazias, para
  permitir uma nova tentativa após a reserva desaparecer da leitura autorizada.
- Campos ficam somente leitura durante operações; continuam editáveis quando
  a reserva apenas expirou. Sucesso limpa apenas o rascunho da empresa enviada.
- Label de Nota fica separado do textarea, com id único por formulário.
- Revisão R-014 retirou o contrato legado concedido sem consumidor de produção;
  cenários relevantes foram migrados para a nova função, com contexto esperado.

Validação final local: 98 arquivos, 1009 testes passaram e 1 ignorado; 10
jornadas Playwright passaram. Typecheck, lint, db:checar e build passaram.
Revisão independente concluída sem bloqueadores após as correções acima.
