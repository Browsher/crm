# Prospecção por grupos com CNPJ opcional

Status: aprovada pelo usuário em 13/10/2026. [Plano de implementação preparado para revisão](../plans/2026-10-13-prospeccao-grupos-cnpj-opcional.md).

## Objetivo e escopo

Permitir que o gestor importe os prospects coletados no Google Maps mesmo quando CNPJ e razão social ainda não são conhecidos. Na Prospecção, o vendedor deve entender a origem de cada lista, escolher um grupo e localizar, reservar, assumir e atender suas empresas nos fluxos existentes.

A entrega da Mooca contém 45 cadastros selecionados, dos quais 43 possuem telefone. Os dados desconhecidos permanecem em branco. O usuário escolheu cadastrar prospects com CNPJ opcional.

O usuário também pediu que cada grupo represente uma lista importada, com resumo, explicação de como foi obtida e critérios utilizados. Confirmou que o vendedor deve poder escolher um grupo e prospectar essa lista. Os exemplos incluem coleta no Google Maps por região e termos e exportação da Receita Federal filtrada por CNAE.

Esta mudança adapta o cadastro de empresa existente. Não cria uma categoria comercial, uma carteira paralela nem um módulo novo de prospects. Publicação do CRM e automação do scraper são etapas próprias.

## Abordagens consideradas

**Adaptar empresa, recomendado.** A tabela já tem um UUID independente do CNPJ. Seus vínculos com fila, contatos, vendas e grupos usam esse ID. Podemos admitir identificação cadastral incompleta e preservar esses vínculos.

**Criar uma entidade separada de prospects.** Isolaria os dados incompletos, mas exigiria fluxo de conversão e alterações nas relações com carteira e histórico. Isso amplia o trabalho necessário para começar a prospectar a base recebida.

## Grupos e contexto da coleta

Cada operação de importação continua criando um grupo associado ao seu arquivo. Empresas reconhecidas em outra lista conservam seu UUID e podem pertencer a mais de um grupo. A explicação da coleta pertence ao grupo, pois a mesma empresa pode ter sido encontrada de maneiras diferentes.

O gestor informa, ao importar, o nome já existente e três novos campos:

- **Resumo da lista** (`descricao`): público, região e foco comercial, até 500 caracteres.
- **Como foi obtida** (`origem`): fonte e método da coleta, até 500 caracteres.
- **Critérios usados** (`criterios`): termos pesquisados, CNAEs e outros filtros efetivamente aplicados, até 2.000 caracteres.

Resumo e origem são obrigatórios nas novas importações. Critérios são opcionais quando não houver critérios adicionais documentados. Os textos são tratados como texto simples; os campos longos permitem quebras de linha, com normalização consistente e rejeição dos demais caracteres de controle. A função de confirmação valida esses limites no banco e inclui os metadados no pedido idempotente.

O gestor pode corrigir esses textos depois da importação, com auditoria e revalidação. O vendedor somente os consulta. Grupos anteriores continuam disponíveis com seus nomes e contagens; a origem ausente aparece como “Origem não informada”, sem preencher automaticamente uma explicação fictícia.

Para a lista recebida, os textos iniciais devem refletir a coleta documentada: empresas de segurança eletrônica, informática, eletrônicos e automação na região da Mooca; coleta por web scraping no Google Maps e conferência de contatos publicados nos sites; oito termos do lote preservados no arquivo de rastreio. Não afirmar que todas as empresas vendem câmeras Wi-Fi ou compram caixas, porque a qualificação comercial ainda não ocorreu.

## Navegação por listas na Prospecção

No código atual, o menu Prospecção aponta para `/fila` e a busca fica em `/fila/localizar`. Esta mudança usa essas páginas e preserva seus endereços.

Na entrada da Prospecção sem uma reserva, o vendedor vê os grupos ativos em cartões compactos, ordenados do mais recente para o mais antigo, com paginação. Cada cartão apresenta nome, resumo, origem, data da importação, quantidade de empresas e quantidade disponível para novas reservas. Critérios longos podem ser expandidos. O botão **Prospectar esta lista** abre a busca com o grupo selecionado. Também existe a opção **Todas as listas ativas**.

O total do cartão conta empresas distintas vinculadas ao grupo. A quantidade disponível aplica as regras reais de nova reserva, incluindo disponibilidade, carteira, descanso e condição de cliente, conforme o banco. Essas contagens são por grupo; sua soma não representa um total global de empresas distintas.

Na busca, o grupo selecionado e seu contexto ficam visíveis acima dos resultados. Nome, CNAE e localização refinam essa lista por AND. As opções dos filtros refletem o grupo. Escolher outra lista inicia na primeira página e limpa os filtros anteriores; mudar os demais filtros conserva o grupo e reinicia a paginação. Limpar filtros gerais conserva o grupo; **Todas as listas ativas** remove a seleção do grupo.

O parâmetro de navegação `grupo` carrega o UUID do grupo. Sua ausência conserva a busca geral atual. URLs, paginação, perfis e campos ocultos de reserva preservam esse parâmetro. Grupos inexistentes ou desativados produzem um aviso recuperável; não causam uma busca irrestrita silenciosa.

Quando há reserva vigente, o atendimento permanece prioritário. Alterar apenas a seleção de grupo não devolve a empresa nem apaga as anotações. O grupo selecionado é o contexto da próxima busca; não será apresentado como origem da empresa atual se ela não pertencer àquela lista.

## Consulta e reserva por grupo no banco

A leitura para o vendedor devolve somente os metadados comerciais dos grupos ativos e suas contagens. Arquivo bruto, pedido persistido, assinatura e controles de administração não são expostos. Os detalhes de administração existentes permanecem exclusivos do gestor.

As funções de consulta, opções de filtros e reserva recebem o grupo opcional e validam seu estado no banco. A restrição usa a associação em `grupo_importacao_empresa`, sem multiplicar a empresa nos resultados quando ela tiver outras origens.

**Puxar próxima empresa** considera somente candidatas do grupo escolhido. Uma nova reserva de alvo explícito também exige que o alvo pertença ao grupo informado. As permissões e regras atuais de reserva continuam sendo verificadas, inclusive depois dos bloqueios. Manter a reserva atual segue as regras existentes.

A desativação de grupo é rechecável na confirmação da reserva. Ela impede novas reservas daquela lista sem desfazer automaticamente carteiras, histórico ou reservas vigentes. A filtragem da aplicação não substitui as validações SQL. O contrato de grupo opcional também deve manter os caminhos que não selecionam um grupo.

Os acessos compartilhados e os DTOs comuns ficam em `server/` ou `lib/` quando necessários. `features/prospeccao` e `features/fila` não importam o módulo de administração de `features/empresas`.

## Dados mínimos e identificação

- Telefone válido continua obrigatório, conforme o cadastro atual.
- Deve existir pelo menos um nome conhecido: razão social ou nome fantasia/comercial.
- CNPJ e razão social podem ser nulos. Nome comercial não será copiado para o campo de razão social.
- CNPJ informado continua sujeito às validações atuais de formato e dígito verificador. Um valor inválido não será tratado como ausente.
- Campos opcionais vazios são normalizados para nulo; strings vazias e caracteres de controle não são aceitos como valores persistidos.
- A empresa continua identificada internamente pelo UUID existente.

Para esta importação do Google Maps, o identificador `place_id` já presente na coleta será preservado. Um registro sem CNPJ precisa desse identificador de origem para que uma nova importação possa reconhecer a mesma empresa sem depender de seu nome ou telefone.

## Contrato de importação

Os cabeçalhos legados de sete colunas e o cabeçalho atual de oito colunas continuam aceitos para arquivos identificados por CNPJ. Um novo cabeçalho acrescenta `google_place_id` como nona coluna:

`cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id`

O identificador de origem é opcional quando o CNPJ está presente e obrigatório quando ele está ausente. É um texto não vazio, sem caracteres de controle, com até 255 caracteres. A conferência explica qual identificador está faltando, em vez de inventar um CNPJ.

O adaptador da coleta coloca `nome_empresa` em `nome_fantasia`, `place_id` em `google_place_id` e conserva os CNPJs e razões sociais efetivamente conhecidos. A etapa de preparação conserva o arquivo bruto e as fontes para revisão. A coluna de e-mail do CRM recebe somente um endereço publicado; os demais contatos continuam preservados na fonte original.

CSV e XLSX conservam os limites, as regras de codificação e a rejeição de fórmulas atuais. A conferência permanece sem gravações; confirmar reanalisa o arquivo e mantém o protocolo de assinatura e chave da operação.

## Repetição, reimportação e complementação

O banco associa cada Google Place ID a um UUID de empresa. Uma empresa pode ter mais de um identificador de origem, por exemplo quando dois anúncios correspondem ao mesmo CNPJ. Uma associação de origem não pode apontar para duas empresas.

Na conferência e na confirmação:

- CNPJ conhecido reconhece um cadastro já existente.
- Google Place ID conhecido reconhece seu cadastro mesmo quando o CNPJ ainda está em branco.
- Se os dois identificadores apontarem para UUIDs diferentes, a linha exige revisão; não ocorre fusão automática nem reassociação de histórico.
- Repetições de CNPJ ou Google Place ID no mesmo arquivo ficam sinalizadas antes da confirmação. Cadastros diferentes com CNPJ nulo não são agrupados pelo valor nulo.
- Telefone compartilhado é um indício para revisão, sem funcionar como chave de identidade. O par GABSENS/Conserto Notebook da coleta deve ser sinalizado e conferido na preparação do arquivo.

Reimportar os mesmos IDs reconhece as empresas existentes e as vincula ao novo grupo, sem criar cópias. Repetir a confirmação da mesma operação continua devolvendo seu resultado persistido.

Quando uma reimportação pelo mesmo Google Place ID trouxer CNPJ ou razão social anteriormente ausentes, a confirmação poderá preencher esses campos vazios. Valores cadastrais existentes divergentes exigem revisão. Esse enriquecimento preserva o UUID, a carteira e o histórico, e usa a auditoria atual. Não cria uma tela de edição cadastral nesta entrega.

## Banco, consultas e apresentação

Novas migrações permitem CNPJ e razão social nulos, exigem pelo menos um nome e acrescentam os metadados de grupo e os contratos de consulta/reserva. As migrações já aplicadas permanecem imutáveis. O CNPJ informado conserva a unicidade atual.

A associação de origem fica em uma tabela própria, com chave única para Google Place ID e referência à empresa. O acesso segue o contexto de autorização existente; a gravação é feita pela função definidora da confirmação de importação. Essa função valida o contrato, os identificadores e conflitos também no banco.

A busca gerada deve funcionar quando a razão social está ausente. Consultas, ordenação e componentes usam a razão social conhecida como nome principal e, na sua ausência, o nome fantasia. Campos desconhecidos aparecem como “Não informado”. Os tipos representam os nulos reais.

As telas e consultas afetadas incluem Empresas, grupos, ficha do gestor, Prospecção, Fila, Carteira, Meu dia, Funil e consultas de gestão que exibem o nome da empresa. WhatsApp continua usando o telefone já validado.

As permissões de importação do gestor, a visibilidade por carteira/reserva, a troca de senha obrigatória e as regras de posse continuam aplicáveis. A autoridade permanece no banco. Helpers comuns de apresentação ficam em `lib/` ou `server/`, respeitando a fronteira entre features.

## Verificação e critérios de aceite

TDD deve cobrir aceitação de nome comercial com telefone e ID de origem, razão social nula, CNPJ inválido informado, ausência de ambos os nomes, telefone inválido, identidade ausente e repetição no arquivo. A compatibilidade dos cabeçalhos anteriores também precisa ser demonstrada.

Integração com Postgres verifica múltiplas empresas com CNPJ nulo, unicidade dos identificadores, reimportação em outro grupo, idempotência da mesma operação, conflitos entre CNPJ e origem, complementação de campos vazios e preservação de UUID e histórico. Controles negativos de autorização testam o contrato diretamente no banco.

Testes de componentes e navegador verificam nomes sem razão social, indicação de CNPJ desconhecido e o fluxo completo de conferência, confirmação e atendimento pelo vendedor.

Para os grupos, TDD cobre campos e limites dos metadados, correção pelo gestor, impedimento de edição pelo vendedor e idempotência com os mesmos textos. Grupos antigos sem contexto continuam legíveis. Metadados alterados não podem reutilizar silenciosamente uma operação já confirmada.

Integração verifica leitura de grupos ativos pelo vendedor, negação de leitura administrativa, contagens de empresas distintas e disponibilidade, interseção do grupo com os demais filtros, reimportação de uma empresa em dois grupos e negação de nova reserva fora do grupo. Cenários de grupo inexistente, desativado e desativado entre leitura e reserva devem conservar as regras de posse e o aviso adequado. Caminhos sem grupo continuam funcionando.

No navegador, verificar cartões e critérios, seleção de lista, reset de paginação, preservação do grupo entre busca/perfil/atendimento e o botão de próxima empresa. O cenário de reserva vigente verifica preservação de anotações e ausência de contexto de origem incorreto. Revisar a apresentação em celular e desktop, com navegação por teclado.

O arquivo da Mooca será preparado no novo formato, conservando as fontes. Os 43 cadastros com telefone satisfazem o requisito de contato; os dois sem telefone permanecem pendentes. A conferência também precisa tratar a possível duplicidade mencionada, sem concluir que IDs distintos representam compradores diferentes.

A implementação ocorre em branch `codex/`, com PR e CI verde. Migração de produção, importação efetiva e publicação são operações posteriores à verificação da mudança.

## Evidências consultadas

- `db/migracoes/0014_empresa.sql`: UUID da empresa, obrigatoriedade atual de CNPJ, razão social e telefone.
- `db/migracoes/0015_empresa_busca.sql`: busca gerada dependente da razão social.
- `db/migracoes/0027_grupos_importacao.sql`: validação SQL, associação a grupos, unicidade por CNPJ e chave de confirmação.
- `src/features/empresas/planilha.ts`, `servico.ts` e `repositorio.ts`: conferência, identificação e persistência atuais.
- `src/features/empresas/perfil.ts`, `src/features/fila/consulta.ts` e componentes de Empresas: tipos e apresentação que assumem CNPJ e razão social preenchidos.
- `src/features/empresas/grupos.ts` e `app/empresas/grupos/`: leitura e administração atuais exclusivas do gestor.
- `app/empresas/importar/formulario.tsx` e `acao.ts`: nome do grupo, conferência e confirmação da importação.
- `app/fila/page.tsx`, `app/fila/localizar/` e `src/features/prospeccao/`: páginas, navegação e filtros atuais da Prospecção.
- `src/features/fila/repositorio.ts` e `db/migracoes/0028_comercial.sql`: reserva com filtros e validações de disponibilidade no banco.
- `entrega_mooca_2026-10-13.zip`: 45 candidatos, 43 telefones, Google Place IDs preservados e fontes dos contatos.
