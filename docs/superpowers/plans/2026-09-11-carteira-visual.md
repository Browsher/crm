# Carteira em cards e ficha equilibrada

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** aplicar layouts aprovados a /carteira e /carteira/[id].
**Architecture:** reutilizar leitor autorizado enriquecido no PR33 e formulário
de contato atual. Compartilhar shell visual, sem expor Meu dia antes de existir.
**Tech Stack:** Next16, React19, TypeScript, componentes locais, Vitest/Playwright.
**Spec:** ../specs/2026-09-11-carteira-meu-dia-design.md (somente Carteira/ficha).

## Restrições

- Não alterar SQL, RLS, migrações, dependências ou actions de contato.
- Manter guarda de usuário, carteira pessoal e 404 fora da posse antes de histórico.
- Sem travessões na interface. Sem cargo de contato inventado.
- Datas classificadas pelo banco; UI apenas formata valores existentes.
- Manter Fila, sua reserva e provider de rascunhos funcionando.
- Não incluir menu Meu dia até sua fatia. Não implementar a rota agora.
- Cada comportamento novo começa por RED/GREEN. Não enfraquecer asserts de segurança.
- Branch codex/carteira-visual, PR contra main, AGENTS.md preservado.

## Tarefa 1: shell compartilhado (root)

Arquivos: criar src/components/crm/shell.tsx, shell.module.css, tema.tsx e
shell.test.tsx; adaptar app/fila/shell.tsx, tema.tsx; criar app/carteira/layout.tsx.
Ler app/fila/layout.tsx e shell.tsx antes. Contrato:

```ts
type AreaCrm = 'fila' | 'carteira'
type Props = {children: ReactNode; nome: string; papel: 'gestor'|'vendedor'; area: AreaCrm}
```

- [x] RED: ShellCrm area carteira marca Carteira atual, mantém links de usuário
  por papel e renderiza conteúdo. Exemplo de assert:
  `expect(html).toContain('href="/carteira" aria-current="page"')`.
- [x] Extrair shell e contexto para src/components/crm. Wrapper ShellFila passa
  area=fila e mantém exportações e rótulo Tema da Fila para compatibilidade.
  LayoutCarteira faz `exigir('usuario')`, importa ui.css e usa area=carteira.
- [x] GREEN: testes de shell atuais/novos, tipos e lint. Nenhum main adicional
  no shell; páginas mantêm landmark próprio.

## Tarefa 2: cards e filtros (worker lista)

Ownership: app/carteira/page.tsx, lista.tsx, lista.test.tsx; novos filtros.ts,
filtros.test.tsx, filtros-form.tsx e carteira.module.css.
Ler app/fila/localizar/formulario.tsx e navegação antes.

Contrato exportado de filtros.ts para ficha:

```ts
type FiltrosCarteira = {nome:string; uf:string; retorno:''|'atrasado'|'hoje'|'futuro'|'sem_data'}
function lerFiltrosCarteira(params:Record<string,string|string[]|undefined>):
  {ok:true;filtros:FiltrosCarteira}|{ok:false}
function urlCarteira(filtros:FiltrosCarteira):string
function urlFicha(id:string,filtros:FiltrosCarteira):string
```

- [x] RED: filtros inválidos/repetidos, busca nome, combinação UF/retorno,
  ordenação por nome/id e links que mantêm query. Não classificar datas em TS.
- [x] Implementar parsing de nome até120, UF válida ou vazia e enum retorno.
  GET form com campos nome/uf/retorno. Filtrar somente carteira autorizada já
  carregada; opções UF derivadas dela; contagem filtrada e total. Função pura
  auxiliar filtrarCarteira(linhas,filtros) retorna array novo ordenado.
- [x] Cards com nome/contato/localização, última nota (resumo até180 caracteres)
  e data, próximo passo/data/estado e Ver cliente no rodapé. Estado sem retorno
  contado. Diferenciar nenhum resultado de carteira vazia, acesso negado de ambos.
  Estilos duas colunas desktop/uma mobile, títulos com h2/h3 sem perder semântica.
- [x] GREEN unitários focais e types. Datas exibidas legíveis sem alterar valor.

## Tarefa 3: ficha equilibrada (worker ficha)

Ownership: app/carteira/[id]/page.tsx,ficha.tsx,ficha.test.tsx; ficha.module.css,
novo testeDOM; sem editar arquivos da lista ou src/features/contato/formulario.
Ler app/fila/formulario.tsx para confirmação, src/features/contato/formulario.tsx,
acao.ts e os guias Next de componentes servidor/cliente.

Contrato Ficha: empresa:EmpresaComigo, contatos:Contato[],
erroHistorico?:boolean, voltarPara?:string. Consumir filtros.ts da tarefa2.

- [x] RED: dados+próximo passo à esquerda/histórico à direita, formulário só
  abre por Registrar atendimento, possui Registrar e devolver. Sem timer.
- [x] Implementar ficha responsiva usando Card/Button/Alert/Dialog e formulário
  real com visual=fila (opção existente), posse/comDevolver/voltarPara mantidos.
  Dados incluem CNPJ/CNAE e ausências claras. Histórico em componente local
  sem travessões, tipos traduzidos pelo ROTULO existente, nota integral.
  ErroHistorico mostra erro distinto de histórico vazio.
- [x] RED DOM: foco ao abrir, rascunho preservado após cancelar confirmação,
  confirmação para descartar/cancelar/voltar com edição. Navegação bloqueada
  durante envio. Erro de envio não desmonta editor; sucesso atualiza ficha
  pelas revalidações existentes. Proteção beforeunload durante rascunho.
- [x] Page valida filtros e monta retorno apenas com urlCarteira, nunca aceita
  redirect arbitrário de query. Verifica posse antes de ler histórico, mantém
  RegistrarVisita existente. Não regravar contato ao navegar.
- [x] GREEN testes DOM, render, types e lint. Preserve testes de devolução.

## Tarefa 4: validação e PR (root)

Arquivos: criar tests/e2e/carteira-visual.spec.ts, dados-carteira-visual.ts e
registrar fixture em scripts/e2e/run.mts.

- [x] Criar vendedor e duas empresas fictícias com posse e contatos no banco
  temporário. Testar filtro/contagem, ficha e retorno conservando filtros,
  dados privados inacessíveis por outro vendedor, erro formulário sem data,
  nota preservada e cancelamento confirmado, registro atualizado e devolução.
- [x] Navegador 390/820/1280px, tema claro/escuro, capturas e sem overflow.
  Conferir Fila com suiteE2E existente sem relaxar jornadas.
- [ ] Revisão independente, corrigir achados. Testes unitários/integração,
  build, tipos, lint e convenções. PR e CI verde; mostrar Carteira local.

## Decisões de execução

Os protótipos e a separação das telas já foram aprovados. Esta execução cobre
apenas Carteira/ficha; Meu dia permanece a próxima fatia. Rascunhos não ganham
persistência em disco. GET filtros é somente leitura; classificação vem do PR33.
