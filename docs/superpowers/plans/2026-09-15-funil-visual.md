# Funil visual e primeira venda

> **For agentic workers:** Use superpowers:executing-plans, tarefa por tarefa, com TDD. Execução pelo agente principal e uma revisão independente final.

**Goal:** Entregar quadro/modal do Funil e registro de primeira venda sem esconder retornos nem misturar prospectos com clientes na lista da Carteira.

**Architecture:** Autoridade PostgreSQL; actions autenticadas compõem features, sem imports entre features. Dados privados filtrados antes de serializar. Componentes existentes para tema, botões, campos, modal e atendimento.

**Tech Stack:** Next.js/React/TypeScript/PostgreSQL/Vitest/Playwright existentes.

**Spec:** docs/superpowers/specs/2026-09-15-funil-comercial-design.md

## Restrições e decisões

- PR45 integrado antes desta branch. PR novo contra main; sem merge automático.
- Não aplicar migrações na Railway. Testes e demonstração em banco temporário Docker.
- Reais, centavos exatos, mínimo 0,01; data civil válida até hoje em São Paulo.
- Teto técnico de 999.999.999,99 reais para manter conversão e apresentação exatas; observação até 2.000 caracteres.
- Sem editar/excluir venda nesta versão, com aviso e confirmação no formulário. Correção administrativa em fatia própria, conforme aprovação de 15/09.
- Sem busca, menus de três pontos ou arrastar. Três colunas e modal; celular fullscreen.
- Reutilizar Segoe UI, tokens de ui.css (claro branco/cinza, escuro #09090b/#141416), contorno e foco existentes. Conteúdo alinhado à esquerda; contadores por etapa, cards compactos nome/cidade. Nenhum novo pacote.
- Atendimentos no Funil só do ator; telefone carregado somente ao pedir atendimento.
- Expiração e transferência não entram. Registrar compra posterior fica para a próxima fatia, sem botão morto nesta.

## Tarefa 1: comandos e contratos

Arquivos: src/features/funil/regras.ts e regras.test.ts; repositorio.ts; db/migracoes/0029_funil_comandos.sql; docs/db/0029.md; tests/integracao/funil-comandos.test.ts; invariantes.ts e listas de migrações afetadas.

Interfaces: validarVenda({valor,data,observacao,chave}) retorna união ok/dados ou erro; registrarVenda(usuarioId,negociacaoId,dados), mudarEtapa(usuarioId,id,etapa,anterior), devolverNegociacao(usuarioId,id,motivo) retornam ok ou motivo. Comandos recebem ID do ciclo, nunca dono do cliente.

- [x] RED de conversão monetária, data impossível e UUID; executar unitário focado.
```ts
expect(validarVenda({ valor: '12,34', data: '2026-09-15', observacao: '', chave })).toMatchObject({ok:true, dados:{centavos:1234}})
expect(validarVenda({ valor: '1e3', data: '2026-09-15', observacao: '', chave }).ok).toBe(false)
```
- [x] Implementar parser por dígitos, sem parseFloat, e validação estrutural de data.
- [x] RED integração: funções ausentes, acesso de outro vendedor/gestor negado, stage anterior conflitante, primeira venda fecha ciclo, repetição mesma chave não duplica, chave diferente após fechamento não cria segunda venda, data futura/valor inválido negados, devolução com motivo mantém contato, corrida venda/devolução consistente.
- [x] Migração: funções definidoras com search_path vazio, REVOKE PUBLIC, GRANT apenas dos consumidores. Ordem advisory usuário 25, empresa FOR UPDATE, ciclo. Idempotência retorna ok apenas para mesmo autor/ciclo/dados; chave associada ao ciclo em venda. Revalidar estado após locks. Validação data no banco usando São Paulo.
- [x] Consulta de classificação próprias empresas com venda, inclusive autoria anterior, exposta só a vendedor atual. Consumidor lerMinhasEmpresas(usuarioId, somenteClientes=false); preservar assinatura de retorno. Sem alterar Meu dia: continua todas as posses.
- [x] Repetir integração focada e atualizar invariantes/listas e docs antigos.

## Tarefa 2: actions e telas compatíveis

Arquivos: app/funil/layout.tsx, page.tsx, acoes.ts; src/components/crm/shell.tsx/test; app/carteira/page.tsx; src/features/fila/consulta.ts; src/features/contato/acao.ts e formulario.tsx; app/carteira/[id]/ficha.tsx.

Ler como molde app/carteira/layout.tsx, app/usuarios/acoes.ts e formulario-criar.tsx, src/features/contato/formulario.tsx, app/carteira/[id]/ficha.tsx e guia local Next server-and-client-components.

- [x] RED das actions antes da leitura/escrita. Menu conferido no navegador; layout e página reutilizam a guarda existente exigir(vendedor). Action recebe FormData, usa exigir('vendedor'), valida campos e chama repositório. Não exportar constantes de arquivo use server.
- [x] Implementar ações detalhe, telefone, etapa, venda, devolução. Consulta de telefone sob RLS e ciclo próprio aberto. Escritas revalidam /funil, /carteira, /meu-dia, /gestao e /usuarios. Contato também revalida /funil.
- [x] Carteira lista somente clientes usando segundo argumento true. Ficha e Meu dia mantêm acesso à posse prospecto para compatibilidade de atendimento. Corrigir textos de assunção para Funil. Cliente não tem botão de devolução na ficha (banco segue autoridade).
- [x] Teste integrado: antes da compra, Funil tem empresa e Carteira não; depois da compra, inverso; retorno permanece em Meu dia.

## Tarefa 3: quadro e modal

Arquivos: app/funil/quadro.tsx, modal.tsx, funil.module.css, quadro.test.tsx e modal.dom.test.tsx.

Interfaces: Quadro recebe NegociacaoResumo[]; abre Modal pelo id. Modal busca detalhe próprio e protege respostas por identidade de requisição/desmontagem. Renderizar carregamento/erro/perda de posse sem manter dados antigos. Ao fechar restaurar foco ao card; ao remover card focar aviso do quadro.

- [x] RED render: três colunas com contadores, nome/cidade, ausência de busca e telefone.
- [x] Construir quadro com largura flexível, rolagem horizontal em viewport estreito. Modal central max-width 780px; mobile 100dvh. Rolagem interna e backdrop sem mudar largura do quadro.
- [x] RED DOM: Escape/fechar com rascunho pede descarte, cancelar preserva; envio bloqueia fechamento; falha preserva valores; seleção/resposta antiga não sobrescreve nova; foco e confirmação de venda.
- [x] Formulários etapa/venda/devolução com confirmação inline; o motivo de devolução é obrigatório. FormularioContato existente no modo atendimento, com próximo passo e telefone carregado por ação separada. Sem exibir telefone no detalhe.
- [x] Aviso de navegação/fechamento com rascunho; ação em andamento bloqueia duplo envio. Chave UUID gerada uma vez por intenção de venda, preservada em retry. Sucesso remove card e informa destino Carteira; não registrar segunda venda pelo ciclo fechado.

## Tarefa 4: navegador e entrega

Arquivos: tests/e2e/dados-funil.ts e funil.spec.ts; scripts/e2e/run.mts; fixtures antigas de Carteira ajustadas para declarar clientes de verdade, e cenários de devolução permanecem prospectos acessados pela ficha.

- [x] Jornada E2E com dados próprios nas três etapas, outro vendedor com nota secreta, retorno hoje. Jornada abre modal, troca etapa, cancela rascunho, registra primeira venda, confere Carteira e Meu dia, confere uma venda; repetição e corrida verificadas na integração.
- [x] Validar 390/820/1280, claro/escuro, teclado, scroll e telefone só ao atendimento. Tirar capturas e abrir demonstração temporária para aprovação visual.
- [x] Unitários/inventário, integração, typecheck, lint, db:checar, build:e2e e E2E, usando banco descartável. Uma revisão independente final de autorização, concorrência e UI.
- [ ] Commit só na branch conferida, PR contra main, CI do SHA exato. Preservar arquivos locais não rastreados e PREFERENCIAS.md. Sem merge nem migração Railway nesta fatia.

## Evidências da execução em 15/09/2026

- 930 unitários passaram, 1 pulado; inventário com 931 casos. Execução limitada a dois workers na máquina local.
- 485 integrações passaram, 1 pulada, em bancos descartáveis Docker.
- Build de produção isolado e typecheck passaram; 42 jornadas E2E passaram na árvore com o ajuste final do modal mobile.
- Capturas reais em test-results/funil-{light,dark}-{390,820,1280}.png e funil-modal-{light,dark}-{390,820,1280}.png. A captura mobile revelou espaço vertical excessivo, corrigido por align-content:start e reconferido.
- Uma revisão independente encontrou três problemas, reproduzidos antes das correções: autorização mudando durante a espera pelo lock, perda de rascunho ao negar posse e resposta antiga do telefone fechando outro formulário. Testes focados passaram após cada correção; revisor conferiu os três ajustes.
- O E2E inicialmente localizava o select pelo texto completo do label, que também continha opções. Passou ao usar o papel combobox e nome acessível Etapa; não foi necessário aumentar timeout.
- Demonstração isolada em http://crm-funil.localhost:3101/funil, conferida no navegador; login funile2e@teste.local. Não usa banco real. Aprovação visual e merge ainda pendentes.
