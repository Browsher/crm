# Empresas: acompanhamento pelo gestor

Estado: proposta para revisão. Os pedidos abaixo vieram do usuário; os detalhes
marcados como recomendação são escolhas do assistente, ainda não aprovadas.
Não houve alteração de produto ou publicação nesta etapa.

Base de implementação conferida em 29/10/2026: `main` remota e `origin/main`
local em `fafd7fc11ee294e0aabc6b0e489b80971ac90d2d`. O checkout de trabalho
está em outra branch, mais antiga. As decisões abaixo foram reconciliadas com
a base atual por `git show origin/main:<caminho>`, sem trocar a branch em uso.

## Pedidos e limite da fatia

- Reorganizar Empresas para o gestor acompanhar o fluxo atual dos vendedores.
- Retirar as opções de o gestor importar/enviar empresas.
- Remover a aba de Design System.
- Mostrar origem Google ou banco de dados e quem puxou a empresa.
- Mostrar quanto tempo a empresa está parada e seu histórico na ficha.
- Excluir cadastros antigos sem utilidade e retirar informações/funcionalidades
  antigas da interface. O usuário confirmou que deseja as duas coisas.

Manter o controle existente de desativar/reativar listas. O usuário perguntou
se já existia; não pediu sua remoção. A revisão dos indicadores de `/gestao`
é outra fatia. Metas, ranking e transferência não entram nesta entrega.

## Reorganização proposta

Preservar `/empresas`, acesso exclusivo do gestor, filtros atuais por nome/CNPJ,
CNAE e localização, paginação de 50 empresas e retorno da ficha com os filtros.
Cabeçalho recomendado: **Acompanhe a origem e o atendimento das empresas**.
Acessos: **Listas de prospecção** (`/empresas/grupos`) e **Limites e histórico
de buscas** (`/empresas/busca`). Estes nomes são recomendações de apresentação.

| Coluna | Conteúdo proposto |
| --- | --- |
| Empresa | Nome com link para a ficha, CNPJ conhecido e cidade/UF. |
| Origem | Google, Banco de dados, ambas ou Origem não registrada. |
| Quem puxou | Vendedor vinculado à aquisição; mais de um aparece sem perder a associação à origem. |
| Responsável atual | Dono atual; eventual reserva vigente aparece com rótulo próprio. |
| Última atividade | Data e tempo sem atividade, ou ausência de atendimento. |

Telefone, email e CNAE continuam na ficha. CNAE permanece como filtro. Não
adicionar filtros novos ou cartões de totais automaticamente nesta fatia.
No celular, manter os rótulos compreensíveis sem rolagem horizontal da página
inteira. Preservar temas e acessibilidade. Vazio e falha não são equivalentes.

## Origem e autoria: recomendação

Separar quem adquiriu a empresa de quem a atende hoje e de quem executou uma
importação técnica. A coluna **Quem puxou** usa os vínculos comerciais já
registrados, sem atribuir aquisição ao dono atual ou ao gestor executor.

**Google atual:** relacionar `google_resultado.empresa_id` com
`google_planejamento.vendedor_id`, somente nos resultados com situação
`entregue`. Usar `entregue_em` quando mostrar a data da entrega. O planejamento
e a execução preservam os critérios e o vendedor da solicitação. Não é correto
afirmar que o sistema atual só tem listas Google globais ou não registra quem
solicitou as buscas.

**Banco de dados atual:** Casa dos Dados, mantendo o histórico CNPJ.biz.
Relacionar a empresa ao grupo efetivamente vinculado à `busca_empresa`
concluída e usar `busca_empresa.usuario_id` como autor. Resultados não incluídos
na lista não são empresas adquiridas. A inclusão atual é automática, com
retomada idempotente em caso de pendência; preservar esse fluxo.

**Google legado:** `empresa_origem_google` comprova a fonte, mas sozinho não
comprova um solicitante vendedor. Sem entrega pessoal vinculada, mostrar
**Aquisição antiga** e autoria comercial **Não registrada**. Na ficha, a autoria
técnica de cadastro/importação continua disponível com seu rótulo próprio.
Cadastros sem origem estruturada ficam como **Origem não registrada**.

Uma empresa com várias aquisições aparece uma única vez. Mostrar as origens e
os vendedores relacionados, conservando os pares origem/autor na ficha. Se
precisar compactar na tabela, mostrar o primeiro vínculo em ordem estável e
**+N aquisições**, mantendo a relação completa acessível. Autores desativados
continuam no histórico com sua situação identificada.

`empresa.criado_por` e `empresa.criado_em` informam **Cadastro registrado por**
e **Entrada no CRM**, não substituem o vendedor de planejamento ou pesquisa.
Autor nulo não significa automação e não deve ganhar atribuição inventada.

Datas conservam seu significado: entrada no CRM, entrega Google, busca feita
no banco e criação da lista. `grupo_importacao_empresa` não tem data própria;
não usar a criação do grupo como data exata de cada inclusão. A pesquisa do
banco pode preceder uma retomada da inclusão.

A leitura de gestão deve agregar todos os vendedores autorizados ao gestor,
em vez de chamar uma consulta pessoal como se o gestor fosse cada vendedor.
Não alterar a visibilidade dos vendedores para implementar a supervisão.

## Tempo parada: recomendação de regra

- Medir tempo sem **atividade comercial registrada**: contato de tipo diferente
  de `nao_liguei`, ou venda registrada. Um descarte sem ligação não é atendimento.
- Última atividade é o maior instante entre `contato.criado_em` elegível e
  `venda.criada_em`. A data comercial retroativa da venda não substitui o
  instante em que alguém a registrou.
- Medir a empresa inteira, mesmo com mudanças de responsável; não apresentar
  esse tempo como desempenho isolado do vendedor atual.
- Contar dias civis em `America/Sao_Paulo`, calculados no SQL: hoje, há 1 dia,
  há N dias. Na ficha, apresentar também a data exata.
- Sem atividade elegível: **Sem atendimento registrado** e **Há N dias na base**,
  usando `empresa.criado_em` para a segunda informação.
- Abrir ficha, reservar, pesquisar, reimportar, alterar metadados e avançar etapa
  do Funil não reiniciam o contador.
- O indicador é informativo. Não implementar devolução, transferência ou
  expiração automática por inatividade nesta fatia.

## Ficha e histórico

Reorganizar `/empresas/[id]`, com origem, autoria comercial e da entrada, responsável atual,
reserva vigente, última atividade, próximo passo e retorno em destaque.
Preservar os dados cadastrais já existentes.

O histórico atual já combina contatos e vendas com autor e horário. Reutilizá-lo,
conservando anotações, tipo, próximo passo, retorno e valor/data das vendas,
ordenados do mais recente para o mais antigo. Não criar outra fonte de verdade
nem contatos fictícios. A entrada no CRM pode ser apresentada com sua data real;
listas e buscas ficam em seu contexto próprio quando a data do vínculo não é
conhecida. Não fabricar eventos antigos de reserva, mudança de etapa ou execução
do agente Google. Consultar ficha não produz escrita comercial.

## Remoções

Retirar **Importar empresas**, **Importar planilha** e instruções de importação
nos cabeçalhos de Empresas/Grupos, estados vazios e filtros inválidos.
Retirar formulários e ações exclusivos de `app/empresas/importar`. A URL antiga
mantém apenas guarda de gestor e redirecionamento para `/empresas`, sem formulário
ou escrita. Ajustar breadcrumb e testes relacionados.

Preservar serviços e contratos de importação usados pelas aquisições Google e Casa dos Dados.
A retirada da interface manual não revoga indiscriminadamente permissões SQL,
nem altera o agente Google, n8n, Casa dos Dados ou históricos CNPJ.biz. Qualquer revogação exige inventário
dos consumidores conforme R-014.

Retirar a galeria de `/design` e seus acessos, se existentes na base efetivamente
alterada. A navegação da `main` atual possui o item Design System, que também deve
ser removido. A URL deixa de oferecer a galeria; os componentes em `src/components/ui`,
estilos e temas utilizados pelo CRM real permanecem.

Manter gestão de limites e desativação/reativação de listas com seu comportamento
atual. Não mudar posse, descanso, permissões ou prioridade de reserva.

## Limpeza adicional solicitada e confirmada

O usuário confirmou as duas partes: apagar cadastros antigos sem utilidade e
remover informações/funcionalidades antigas da interface. Não se trata apenas
de ocultar registros. Isso não autoriza apagar indistintamente qualquer empresa
criada por alguém cujo papel atual seja gestor.

Antes da exclusão, levantar por ambiente e por ID as empresas das importações
manuais antigas, autoria, data e vínculos em contatos, negociações, vendas,
listas e identificadores externos. Separar candidatas sem uso de registros
com atividade comercial, apresentando quantidades e impacto concretos. Vínculo
com lista compartilhada ou autoria atual não basta para definir exclusão.
Nenhuma remoção em cascata de histórico fica implicitamente autorizada.
O inventário também deve considerar entregas e exclusividades Google,
planejamentos, execuções/lotes e aquisições pessoais do banco. Uma empresa
registrada tecnicamente pelo gestor pode ter sido entregue a um vendedor;
portanto, o autor técnico não define sozinho se ela é antiga ou descartável.

O usuário confirmou que os vendedores usam o CRM hospedado. O planejamento
considera o ambiente hospedado como alvo operacional desta reorganização;
conferir a identidade da conexão/deployment antes de qualquer limpeza e não
estender a exclusão ao banco local por inferência. O procedimento define
cópia recuperável, restauração, conjunto de IDs, ordem compatível com as FKs e
verificação das quantidades antes/depois, incluindo nova checagem dos vínculos
na transação. Não desabilitar constraints nem RLS para executar uma exclusão
mais ampla que o conjunto definido.

Tentativa de inventário em 29/10/2026: conexões operacionais com transação
planejada em modo somente leitura; local retornou EACCES e Railway ENOTFOUND.
Nenhuma consulta de inventário foi concluída e não há contagens confirmadas.
Essas falhas não significam banco vazio. Nenhum cadastro foi excluído.

A reorganização da tela e a exclusão operacional são etapas distintas. A
especificação não implementa a limpeza automaticamente nem acrescenta uma
rotina periódica de exclusão.

## Uso pelos vendedores e publicação

O usuário confirmou uso hospedado pelos vendedores. Planejamento e
implementação ficam fora da versão em uso. Não editar diretamente o checkout
servido, não apontar testes ao banco hospedado e não publicar mudanças parciais.
Utilizar branch/ambiente de desenvolvimento separado e banco de testes isolado.

A publicação ocorre depois da validação do fluxo completo, incluindo os
vendedores. Mudanças puramente visuais não justificam interromper a operação
durante todo o desenvolvimento.

A exclusão de cadastros é uma operação própria sobre o banco compartilhado:
combinar uma janela curta, ter recuperação disponível, conferir novamente
vínculos/atividade e executar somente o conjunto definido. Enquanto o
inventário estiver bloqueado, a exclusão permanece pendente.

## Implementação e verificação

Seguir componentes e stack existentes, sem biblioteca nova. Antes de alterar
App Router, ler guias relevantes em `node_modules/next/dist/docs/`.
Todas as leituras usam `comoUsuario` e RLS; nenhuma conexão administrativa.
`features/` não importa outra feature: contratos/consultas comuns sobem para
`lib/` ou `server/`. A composição entre features pode continuar na camada `app/`.

Agregar origem/atividade por empresa, sem multiplicar linhas, totais ou páginas.
Paginar no banco; não carregar toda a base no navegador. O desenho utiliza dados
atuais, sem backfill fictício ou tabela nova de rastreamento. Índices adicionais
só se a análise da consulta justificar migração aditiva.

TDD: observar teste falhando antes de implementar. Cobrir:

- Entrega Google por planejamento/vendedor, banco atual Casa dos Dados,
  histórico CNPJ.biz, múltiplas origens, legado e resultado não incluído.
- Vários grupos/contatos/vendas sem duplicar empresa, total ou paginação.
- Autor da aquisição, autor de busca e responsável distintos; autor ausente e
  desativado; executor técnico gestor distinto do solicitante Google.
- Última atividade com contato, descarte sem ligação, venda retroativa, ausência
  de atendimento e mudança de dia no fuso; leitura/reimportação não reiniciam tempo.
- Ficha preserva contatos/vendas e não escreve ao abrir.
- Importação manual ausente nos estados normais, vazios e de erro; URL antiga
  redireciona sem importar; `/design` não oferece galeria.
- Listas, limites e aquisição dos vendedores preservados; vendedor não acessa
  dados administrativos; usuário sem leitura liberada permanece bloqueado.

E2E que preparam dados por `/empresas/importar` passam a usar fixtures autorizadas
no banco descartável do harness, sem criar rota de seed no aplicativo ou eliminar
cobertura de grupos/prospecção. Validar unidades/componentes, integração das
consultas/permissões, typecheck, lint, build e jornadas afetadas, desktop/celular,
teclado e temas. Nenhum teste usa banco real ou crédito pago do fornecedor.

Implementação em branch própria e PR contra `main`; não empilhar PR sobre branch
apagável por squash. Partir da `main` atual conferida, `fafd7fc`, e reconferir seu estado antes
do PR de produto. Não implementar sobre o checkout antigo `b4ea0a2`.

## Evidências consultadas

Conferido com `Get-Content -Encoding UTF8`, buscas por `Get-ChildItem` com
`Select-String` e, para a base atual, `git show origin/main:<caminho>`.
O SHA da `main` foi confirmado também pela API GitHub. Estes fatos descrevem
código versionado, não prova do deployment efetivamente em uso.

- `app/empresas/page.tsx`, `formulario.tsx`, `lista.tsx`, `linha.tsx` e
  `src/features/empresas/listagem.ts`, `consulta.ts`, `filtros.ts`: listagem/filtros.
- `app/empresas/[id]/page.tsx`, `src/features/empresas/perfil.ts` e
  `src/features/contato/historico.ts`: ficha e histórico combinado real.
- `app/empresas/grupos/page.tsx`, `[id]/page.tsx`, `controles.tsx`, `acoes.ts`
  e `src/features/empresas/grupos.ts`: gestão de listas já implementada.
- `src/features/busca-empresas/repositorio.ts`, `tipos.ts`,
  `app/empresas/busca/page.tsx` e `docs/operacao/busca-empresas.md`: buscas e Google.
- `db/migracoes/0014_empresa.sql`, `0016_empresa_fila.sql`,
  `0027_grupos_importacao.sql`, `0028_comercial.sql`,
  `0034_empresa_origem_google.sql`, `0038_busca_empresas.sql` e
  `0039_busca_papel_vigente.sql`, `0040_google_planejamento.sql`,
  `0043_prospeccao_pessoal.sql`, `0048_prospeccao_grupo_origem.sql` e
  `0049_banco_inclusao_automatica.sql`: autoria, instantes e vínculos disponíveis.
- `origin/main:src/server/prospeccao-pessoal.ts`,
  `src/features/google/repositorio.ts`, `src/features/google/tipos.ts`,
  `app/fila/buscar/page.tsx` e `docs/operacao/busca-empresas.md`:
  aquisição pessoal atual, planejamento Google e fornecedor Casa dos Dados.
- `src/components/crm/shell.tsx`, `caminho.tsx`, `app/design/page.tsx`,
  `galeria.tsx` e testes E2E dessas telas: navegação e acessos retirados.

## Próxima etapa

Revisar o desenho com o usuário, incluindo as recomendações de autoria e tempo
sem atividade. Depois preparar o plano pela skill `superpowers:writing-plans`.
