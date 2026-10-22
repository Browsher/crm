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

## Verificação final

Typecheck, lint, convenções SQL, build de produção e `git diff --check` passaram.
Unidades: 1.288 passaram, uma ignorada (142 arquivos); inventário regenerado a
partir do relatório JSON da mesma execução com `--maxWorkers=2`.
Navegador: 53 jornadas passaram na rodada completa; após o ajuste da área de
toque dos papéis, dez jornadas afetadas passaram novamente no build atualizado
(redesenho, Usuários e WhatsApp). Vinte capturas estão versionadas em
[aplicacao/](aplicacao/README.md).
Integração e revisão independente serão registradas após concluir a rodada.

## Decisões da execução

1. Títulos internos `Task N` substituem `Tarefa N` para o parser do executor.
   Mesmo escopo; custo se incorreto: nenhum impacto no produto.
2. Vitest local usa `--maxWorkers=2` após contenção medida. Mesmos testes;
   custo se incorreto: execução local mais lenta. CI permanece inalterado.
3. Jornadas entre áreas foram agrupadas na tarefa 9, depois da integração do
   Shell e tema. Mesma cobertura antes da entrega; custo: descoberta mais tardia
   de regressões visuais.
4. Borda clara de campo `#8793a0` substitui `#aab3bd` para atingir contraste.
   Custo: contorno ligeiramente mais forte que a prévia.
