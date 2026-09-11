# Base visual e galeria de componentes

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** apresentar componentes reais reutilizáveis numa galeria, para validar
o padrão antes de aplicá-lo às telas operacionais.
**Architecture:** primitivas shadcn/ui adaptadas ao tema aprovado; CSS restrito
ao escopo crm-ui. Galeria autenticada de gestor em /design, sem escrita de negócio.
**Tech Stack:** Next.js, React, Tailwind, primitivas Radix, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-09-11-padrao-visual.md.

## Escopo e decisões

- Seguir paleta, dimensões e estados da spec, com temas claro, escuro e sistema.
- Copiar/adaptar componentes da referência local shadcn-admin, preservando MIT;
  usar instalação manual documentada em https://ui.shadcn.com/docs/installation/manual.
- Instalar somente dependências usadas pelos componentes. Não executar init que
  sobrescreva globals.css. Não substituir estilos das telas operacionais.
- NativeSelect mantém select nativo para os filtros simples. Diálogo usa Radix
  para foco, Escape e semântica; não reinventar modal acessível.
- Galeria somente gestor, por exigir('gestor'), igual ao padrão de /usuarios.
- Todos os exemplos são identificados como demonstração e só alteram estado local.
- Não implementar agora as etapas funcionais ou mudar regras do banco.

## Tarefa 1: componentes, tokens e dependências

Arquivos: src/components/ui/{button,input,textarea,label,native-select,card,badge,
alert,dialog,skeleton}.tsx, src/styles/ui.css, src/lib/ui-utils.ts, components.json,
package.json/lock e aviso de licença da referência.

Interfaces: exports Button com variant default/outline/ghost/destructive e size
default/sm/icon, props nativas e asChild; Input, Textarea, Label, NativeSelect com
props nativas; Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter;
Badge variant default/success/warning/danger/outline; Alert/AlertTitle/AlertDescription
variant default/success/warning/danger; Skeleton; Dialog/DialogTrigger/DialogClose/
DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter.
DialogContent recebe theme opcional light/dark/system e leva escopo/tema ao portal.

- [x] Testes primeiro: botão desabilitado e composição link, associações label,
  erro via aria-invalid e atributos preservados; observar RED e depois GREEN.
- [x] Adicionar dependências mínimas por npm, conferir peer dependencies e licença.
- [x] Adaptar componentes usando classes semânticas, valores comuns no CSS scoped.
  Foco visível; controles de40px/44px toque; campos mobile16px. Reduced motion.
- [x] Tokens claro/escuro seguem spec. Bordas de input podem ser mais fortes que
  bordas decorativas de card para contraste de controles. Documentar distinção.
- [x] Testar diálogo por navegador: foco inicial, Escape, retorno ao acionador,
  botão fechar, título/descrição e tema correto do portal.

## Tarefa 2: página de referência

Arquivos: app/design/page.tsx, galeria.tsx, galeria.module.css e testes de render.
Ler app/usuarios/page.tsx e guias locais Next sobre page/use-client/CSS.

- [x] Testar guarda gestor e ausência de importações de escrita de negócio.
- [x] Criar layout com menu lateral apenas para seções reais da galeria, cabeçalho,
  tema seletor e aviso de exemplos. Mostrar tipografia, botões/estados, filtros,
  empresas disponíveis/reservadas/indisponíveis e reserva expirada com texto.
- [x] Permitir tema, filtros de exemplo, abrir diálogo e simular carregamento.
  Nada envia contato ou reserva. Botões de exemplo dão resposta explícita.
- [x] Demonstrar navegação de etapas com avanço apenas pela ação, mantendo
  anotações ao voltar. Rotular claramente o bloco como simulação de componentes.
- [x] Layout desktop e390px, rótulos legíveis e ação de menu para telas estreitas.

## Tarefa 3: verificação e apresentação

- [x] Vitest, lint, typecheck e build. Playwright cobrindo autenticação/gestor,
  tema, formulário, diálogo/foco, etapas, preservação de texto e largura móvel.
- [x] Inspecionar screenshots claro/escuro/mobile e contraste dos tokens usados.
  Corrigir problemas encontrados; revisão independente do diff.
- [x] Mostrar a galeria ao usuário para validação visual antes de aplicar às telas.
  A entrega desta etapa é a galeria revisável na branch codex/padrao-visual.

Ruling: a aprovação anterior autoriza construir a galeria; a aplicação visual
na Fila continua dependendo da validação desta referência pelo usuário.
