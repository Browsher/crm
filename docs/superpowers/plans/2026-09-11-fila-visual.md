# Fila: aplicação do padrão visual aprovado

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** aplicar a galeria aprovada ao fluxo real Puxar, Consultar e Registrar.
**Architecture:** preservar rotas, actions, RLS e RascunhosProvider. Layout da
Fila fornece o escopo visual. Localizar é Puxar; perfil resumido é Consultar;
atendimento reservado alterna Consultar/Registrar sem perder rascunho.
**Tech Stack:** Next.js 16, React 19, componentes locais shadcn/Radix, Vitest,
Playwright e PostgreSQL 18.
**Spec:** ../specs/2026-09-10-fila-interface-design.md e
../specs/2026-09-11-padrao-visual.md, aprovadas pelo usuário.

## Restrições

- Não alterar SQL, permissões, migrações ou regras de seleção da próxima empresa.
- Features não importam outras features. Composição permanece em app.
- Usar os componentes existentes, sem novas dependências.
- Sem travessões no texto da interface. Não adicionar Ausente.
- Reserva expirada mantém notas editáveis, bloqueia envio e oculta dados privados.
- Cada mudança comportamental tem RED antes de GREEN. Não relaxar testes de RLS.
- Ler vizinhos e guias locais Next antes de código.

## Tarefa 1: estrutura e navegação (root)

- [x] Criar shell da Fila com tema claro/escuro/sistema, navegação em rotas
  existentes e menu móvel; reutilizar tokens .crm-ui sem afetar outras áreas.
- [x] Manter RascunhosProvider no layout. Não trocar sua chave ao navegar.
- [x] Criar EtapasFila em app/fila/etapas.tsx: props etapa
  'puxar'|'consultar'|'registrar', filtros:Filtros, onConsultar?:()=>void,
  bloqueado?:boolean. Indicadores futuros não são botões/links; Puxar volta a
  urlConsulta(filtros, filtros.pagina), Consultar só volta por onConsultar.
- [x] Ajustar page da Fila: manter consultas autorizadas; sem reserva encaminhar
  à localização apenas quando não há anotações preservadas. Reservas expiradas
  e rascunhos continuam com editor, renovação e descarte acessíveis.

## Tarefa 2: localizar e perfil (worker independente)

Ownership: app/fila/localizar/** exceto registrar-visita e actions de visita.

- [x] Atualizar formulário com Input/NativeSelect/Label/Button, preservar filtros
  dependentes e querystring. Busca manual por nome continua separada de puxar.
- [x] Puxar mostra título/subtítulo aprovados, card Localizar empresa, resultados,
  recentes/sugestões reais e ação Buscar cliente usando contrato atual de reserva.
- [x] Reutilizar Reservar para ação automática opcional empresaId:null (acao puxar)
  e manter seleção explícita empresaId:string (acao reservar). Descarte de notas
  antes da troca usa diálogo Radix; cancelar não chama action nem apaga rascunho.
- [x] Cards mantêm Ver perfil e ações no rodapé, estados escritos e nenhum dado
  privado acrescentado. Perfil resumido mostra EtapasFila consultar e ação de
  reservar; Abrir atendimento/carteira mantêm rotas existentes.
- [x] Testes de filtros e permissões de render preservados; ampliar teste de
  cancelamento/aceite. Root adapta E2E para novo diálogo e navegação.

## Tarefa 3: consulta/registro (worker independente)

Ownership: app/fila/formulario.tsx,cartao.tsx e seus testes; src/features/contato/
formulario.tsx e testes; CSS específico novo app/fila/atendimento.module.css.

- [x] Cartao admite etapa opcional consultar/registrar, mantendo comportamento
  padrão antigo para consumidores fora da Fila. Consultar: dados/histórico e
  botão Registrar resultado; Registrar: dados ao lado do formulário real.
- [x] Formulario controla etapa por empresa. Nova reserva/Próxima inicia Consultar;
  indicador Consultar volta; rascunho do provider permanece por empresa.
- [x] Expor onRegistrar no Cartao; Formulario usa EtapasFila contrato tarefa1.
- [x] Manter timer, refresh e bloqueios; expiração em Registrar preserva formulário.
  Registro só avança via ação explícita, nunca pelo indicador.
- [x] Substituir window.confirm por diálogo Radix no Formulario sem perder
  submitter, contexto ou validação de concorrência. Cancelar preserva tudo.
- [x] Estilizar formulário de contato por opção visual opcional, padrão antigo
  fora da Fila. Não mudar action ou regras de tipos/desfechos.
- [x] Testes RED/GREEN para etapas, volta, bloqueio e notas preservadas.

## Tarefa 4: validação e entrega (root)

- [x] Revisão independente de integração e limites de acesso.
- [x] Testes locais, tipos, lint e build; E2E real em banco temporário para fluxo,
  cancelamento de troca, falta de próxima, expiração e mobile/temas.
- [x] Mostrar a Fila local sem alterar registros reais para gerar demonstração.
- [ ] PR contra main e CI verde; concluir relatório com limitações concretas.

Ruling: galeria e comportamento já aprovados; a solicitação atual autoriza
executar esta aplicação visual, sem nova rodada de aprovação do mesmo desenho.

## Evidências de implementação (11/09/2026)

- 670 testes unitários passaram; 1 skip existente.
- 404 testes de integração passaram; 1 skip existente. PostgreSQL 18 temporário local.
- 19 jornadas E2E passaram; build, typecheck, lint e convenções de migração passaram.
- Revisão independente encerrada: rascunhos expirados acessíveis, etapa reinicia por empresa, navegação bloqueada durante envio, responsividade e contraste corrigidos.
- Inspeção das capturas de Puxar e Registrar; E2E verifica 390, 820, 1000 e 1280 px.
- Sem alteração de SQL, dependências ou credenciais. A opção visual do formulário preserva consumidores fora da Fila.
