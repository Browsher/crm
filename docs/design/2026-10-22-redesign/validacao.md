# Validação do redesenho

Aplicação real na branch `codex/redesign-crm`, a partir de
`b62cfa6a4b04c2346dbfff8471f54e1421185394`. Dados de navegador são sintéticos,
em Postgres local descartável. As imagens em `aplicacao/` são capturas do
build de produção; as imagens na pasta superior são a prévia aprovada.

## Cobertura das composições

| Rota | Evidência funcional e visual |
|---|---|
| `/login`, `/trocar-senha` | `autenticacao.spec.ts`, `redesign-crm.spec.ts`; erro, primeiro acesso, Sistema e 390 px. |
| `/meu-dia` | `meu-dia.spec.ts`, `redesign-crm.spec.ts`; filtros, rolagem, seleção, posse perdida, celular com Voltar, 390/820/1280/1440 px e dois temas. |
| `/fila` | `fila-visual.spec.ts`, `prospeccao-grupos.spec.ts`, `reserva.spec.ts`; etapas, rascunho, troca de reserva, origem da lista. |
| `/fila/localizar`, `/fila/localizar/[id]` | `consulta.spec.ts`, `reserva.spec.ts`; filtros, paginação, autorização e ficha. Reutilizam Shell, controles e atendimento cobertos nas demais capturas. |
| `/funil` | `funil.spec.ts`, `redesign-crm.spec.ts`; transição, venda, rascunho e modal com retorno de foco. |
| `/carteira`, `/carteira/[id]` | `carteira-visual.spec.ts`; tabela/registros móveis, filtros, histórico, venda, devolução, erro e proteção de rascunho. |
| `/gestao` | `gestao.spec.ts`; resumo e tabela com valores reais, atividade, papéis, claro/escuro e 390/1280 px. |
| `/usuarios`, `/usuarios/vendedores/[id]` | `usuarios-visual.spec.ts`, `perfil-vendedor.spec.ts`; senha provisória, conta própria, filtros, perfil e diálogos. Perfil usa as composições de tabela e dados já cobertas. |
| `/empresas`, `/empresas/[id]` | `empresas-filtros.spec.ts`, `empresas-visual.spec.ts`, `empresa-perfil-gestor.spec.ts`; filtros, retorno da ficha, dados autorizados, tabelas móveis e histórico. |
| `/empresas/importar` | `empresas-excel.spec.ts`, `empresas-visual.spec.ts`; arquivo, conferência, confirmação, token, erros e relatório em ambos os temas. |
| `/empresas/grupos`, `/empresas/grupos/[id]` | `prospeccao-grupos.spec.ts`, `redesign-crm.spec.ts`; metadados, contagens, desativação, origem e navegação ativa. Detalhe reutiliza tabela e controles da listagem. |
| `/whatsapp`, `/whatsapp/configuracao` | `whatsapp-visual.spec.ts`, `redesign-crm.spec.ts`, testes DOM; leitura, cursores, estados parciais, contexto, mídia, portal e celular. API simulada em HTTPS local, sem envio. |
| `/design` | `design.spec.ts`; galeria identificada, acesso de gestor, vazio, erro, foco, tema e 390 px. |
| `/`, `/sair` | Redirecionamentos por papel e saída POST exercitados pelas jornadas de autenticação e contínuas. Não apresentam layout próprio. |

As 21 páginas existentes na base estão representadas. A busca CNPJ.biz não
está na main e não foi copiada do checkout de outro chat. A integração futura
está em [integracao-cnpj-biz.md](integracao-cnpj-biz.md).

## Revisão Web Design Guidelines

Fonte consultada em 22/10/2026:
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
Revisão de código e jornadas no Chromium, com build de produção.

| Local | Achado e tratamento |
|---|---|
| `src/components/ui/sheet.tsx:76` | Fechar tinha alvo de 16 px. Ajustado para 44 px, nome acessível e foco visível; jornada mede o alvo no menu móvel. |
| `src/styles/ui.css:88` | A especificidade de controles legados limitava selects móveis a 41 px. Mínimo de 44 px aplicado; teste mede UF e Retorno. |
| `app/usuarios/usuarios.module.css:20` | Rótulos de papel no diálogo tinham 21 px. Área clicável ampliada para 44 px no toque; teste mede os dois papéis. |
| `app/globals.css:42` | Foco visível em links e controles. Diálogos e Sheet preservam Escape, contenção e retorno ao acionador nas jornadas. |
| `app/globals.css:47` | Alvos móveis e texto de campos em 16 px. Sem esconder overflow da página como correção de layout. |
| `src/components/crm/abas-ficha.tsx:7` | Painéis permanecem montados para preservar conteúdo e rascunhos; abas têm nomes e navegação por teclado verificada em DOM. |
| `src/components/ui/tabs.tsx:145` | Movimento reduzido respeitado por Motion; regra global também reduz transições. |
| `app/login/formulario.tsx:18` | Email com autocomplete, label e spellcheck desativado; erro preserva email e senha nunca vai para armazenamento. |
| `app/whatsapp/midia-mensagem.tsx:65` | Imagens receberam dimensões explícitas; textos alternativos e nome do ampliador preservados. Portal recebe o tema real. |
| `src/components/crm/shell.tsx:28` | Navegação semântica, nomes em modo recolhido e apenas um item ativo em Grupos. Logout continua POST. |
| `app/carteira/filtros-form.tsx:3`, `app/meu-dia/filtros-form.tsx:3` | GET com Next Form preserva o tema no layout compartilhado. Navegação por link mantém filtros; alterações de filtro reiniciam somente a seleção de Meu dia. |

Texto e metadados longos, campos ausentes, listas vazias, erros e mensagens de
somente leitura continuam cobertos pelos testes existentes. Conferência visual
manual complementa as verificações de overflow; não equivale a uma auditoria
completa com leitor de tela.

Contraste calculado dos pares de tokens usados nas superfícies: texto principal
14,54:1 claro / 13,06:1 escuro; secundário 5,04:1 / 6,95:1; secundário na
superfície atenuada 4,52:1 / 5,78:1; texto primário de ação 7,17:1 / 6,90:1;
borda de campo 3,13:1 / 3,39:1. O cálculo não representa inspeção automática de
todos os pixels e combinações da aplicação.

## Correções descobertas nas jornadas

- O tema voltava a Sistema ao aplicar filtros por navegação completa. Next
  Form mantém o provider, sem persistir preferência em armazenamento.
- A seleção antiga de Meu dia podia deixar a ficha vazia após mudar filtros.
  A chave depende apenas dos filtros normalizados; atualização dos mesmos
  dados continua preservando reconciliação e rolagem.
- Reabrir o mesmo retorno após Voltar apagava seu histórico. A limpeza agora
  acontece somente ao selecionar outra empresa; teste DOM reproduziu a falha.
- As adaptações das jornadas antigas mudam navegação para abas e escopos de
  tabela. As verificações de dados, RLS, rascunho e regras operacionais permanecem.

## Validação local e verificação final

Typecheck, lint, convenções SQL, build de produção e `git diff --check` passaram.
Unidades: 1.288 passaram, uma ignorada (142 arquivos); inventário regenerado a
partir do relatório JSON da mesma execução. A rodada após as correções da
revisão também passou (1.288 + uma ignorada), com um worker e timeout padrão.
Navegador inicial: 53 jornadas passaram na rodada completa; após o ajuste da área de
toque dos papéis, dez jornadas afetadas passaram novamente no build atualizado
(redesenho, Usuários e WhatsApp). Vinte capturas estão versionadas em
[aplicacao/](aplicacao/README.md).
Integração: 587 testes passaram, um ignorado (57 arquivos), contra bancos locais
descartáveis. Nenhuma migração foi aplicada à produção.

Comandos: `npm run typecheck`, `npm run lint`, `npm run db:checar`,
`npm run test:unit -- --maxWorkers=1 --reporter=default --reporter=json --outputFile=...`,
`npm run test:integracao`, `npm run build:e2e`,
`npm run test:e2e -- --sem-build` e `git diff --check`.

## Revisão independente

Revisor novo `gpt-6-astra`, somente leitura, range `b62cfa6..445b007`.
Veredito inicial: **With fixes**, sem achado crítico. Os três achados importantes
foram mantidos após avaliação do efeito sobre o usuário e reproduzidos em quatro
casos de navegador antes de alterar a implementação:

1. Aplicar e limpar filtros deixava Nome preenchido em Carteira e Meu dia.
   Formulários passam a remontar somente quando os filtros normalizados mudam;
   o teste inclui Nome, Retorno, Limpar, Voltar/Avançar e preservação de tema.
2. A primeira conversa móvel abria no início de um histórico extenso.
   O efeito passa a acompanhar a abertura do painel e ignora o painel oculto;
   a condição de leitura
   preserva a posição manual ao reabrir a mesma conversa. Fixture com 40
   mensagens antigas e teste com overflow real.
3. A variante destrutiva combinava texto branco com fundo escuro translúcido.
   Agora usa `--destructive-foreground` e fundo sem a opacidade específica do
   escuro. O teste calcula contraste das cores efetivamente compostas no
   Chromium, em claro/escuro, normal e hover, exigindo 4,5:1.

Os quatro casos de regressão passaram após os ajustes; os 26 testes DOM do
painel também passaram. A suíte de unidades completa foi repetida e passou.
Integração, build e navegador completos compõem a catraca final do mesmo código:
o resultado associado ao último commit está nos [checks do PR #55](https://github.com/Browsher/crm/pull/55/checks).

Menor adiado: em `/design`, o seletor local escuro não redefine todos os aliases
derivados de Card/Accent; alguns exemplos conservam a aparência do ancestral.
Os textos continuam legíveis. A skill `executing-plans` determina que os menores
ficam registrados fora da rodada de correções: “Minors never enter the fix pass”.
O tema da aplicação real é definido no provider raiz.

O revisor não reavaliou execução da busca CNPJ.biz ainda fora da main,
persistência do tema após reload nem uma auditoria integral de produção/RLS.
As decisões e seus limites estão abaixo. Nenhuma segunda revisão foi solicitada;
as correções são verificadas pelos testes de regressão e pela suíte completa.

## Decisões da execução

1. Títulos internos `Task N` substituem `Tarefa N` para o parser do executor.
   Mesmo escopo; custo se incorreto: nenhum impacto no produto.
2. Vitest local limita workers a dois e a um na rodada final, após timeouts de
   importação com dois no Windows. Mesmos testes e timeout padrão;
   custo se incorreto: execução local mais lenta. CI permanece inalterado.
3. Jornadas entre áreas foram agrupadas na tarefa 9, depois da integração do
   Shell e tema. Mesma cobertura antes da entrega; custo: descoberta mais tardia
   de regressões visuais.
4. Borda clara de campo `#8793a0` substitui `#aab3bd` para atingir contraste.
   Custo: contorno ligeiramente mais forte que a prévia.
5. Busca CNPJ.biz após integração permanece fora desta validação: PR #56 aberto,
   com handoff e integração documentados. Custo: conflitos e comportamento
   combinado ainda exigem verificação quando as branches forem integradas.
6. Tema permanece no provider, sem persistência após reload/saída, conforme a
   escolha delegada na spec. Custo: selecionar novamente após novo documento.
7. Não refazer auditoria integral de produção, RLS e serviços inalterados:
   testes locais existentes e CI passaram. Limite: esta revisão visual não
   certifica condições de produção não exercitadas pelos testes.
