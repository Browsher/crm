# Filtros adicionais Casa dos Dados

## Intenção e escopo selecionado

O usuário escolheu acrescentar ao Banco de empresas: abertas nos últimos dias; excluir optantes do MEI; excluir optantes do Simples Nacional; período de exclusão de cada regime; e listas separadas de CNAEs principais e secundários. Abertura recente foi citada duas vezes e corresponde a um único recurso.

Nome ou palavra-chave já existe e pesquisa razão social/nome fantasia em modo radical. Permanece como está. Não acrescentar busca por sócio, modo exato, CNPJ, CEP, telefone informado ou outras opções da relação anterior. Limites atuais de 100 por vendedor/dia, privacidade, deduplicação e agendamento Google permanecem.

## Comportamento proposto

1. Atividade e nome: conservar Nome ou palavra-chave e Naturezas jurídicas; substituir o campo único de CNAEs por CNAEs principais e CNAEs secundários, cada um aceitando códigos separados por vírgula. A escolha antiga de onde aplicar uma lista única sai do formulário novo. Um campo pode ficar vazio. Não copiar automaticamente os códigos de um campo para outro.
2. Capital e abertura: manter capital mínimo/máximo. Para abertura, permitir escolher Período ou Últimos dias. Em Período, manter as datas inicial/final opcionais; em Últimos dias, exigir inteiro positivo. Ao mudar o modo, limpar os valores do modo abandonado. O servidor rejeita a presença simultânea de período e últimos dias antes de reservar cota ou fazer HTTP.
3. Perfil: acrescentar Excluir optantes do MEI e Excluir optantes do Simples Nacional. A seleção positiva existente permanece. Não permitir exigir e excluir o mesmo regime; orientar o usuário na tela e repetir essa validação no servidor e banco.
4. Ao marcar uma exclusão, mostrar Data de exclusão a partir de e Data de exclusão até para aquele regime. Ambas opcionais, aceitando somente uma ponta. Ao desmarcar, limpar essas datas. Período invertido, data inválida ou datas sem a exclusão correspondente são recusados; não ignorar filtros silenciosamente.
5. O histórico do gestor mostra os dois conjuntos de CNAEs, o intervalo relativo de abertura, as exclusões e suas datas. Buscas antigas continuam legíveis com sua lista e seleção de atividade originais.
6. Manter os seis cartões, somente o primeiro aberto inicialmente, componentes existentes, operação por teclado e layout responsivo. Nenhum novo modal ou etapa extra.

## Contrato e compatibilidade

Adicionar campos opcionais ao contrato avançado versao1, sem trocar o significado dos campos históricos. cnaes continua como a lista principal nas operações novas; cnaesSecundarios identifica o modo de listas independentes. O formulário novo envia cnaesSecundarios, mesmo vazio, e atividadeTipo=['principal']. Nesse modo, qualquer atividadeTipo divergente é inválido. Payload histórico sem cnaesSecundarios conserva a semântica antiga de atividadeTipo, inclusive principal+secundaria.

Campos opcionais novos: cnaesSecundarios (até 20 códigos de 7 dígitos, únicos); aberturaUltimosDias (string vazia ou inteiro positivo até 2147483647); excluirMei e excluirSimples (booleanos); meiExclusaoDe, meiExclusaoAte, simplesExclusaoDe e simplesExclusaoAte (datas ISO ou vazias).

A leitura/validação de payload antigo não acrescenta defaults novos ao JSON. Isso preserva igualdade e replay por UUID. A sugestão de nome e o resumo CNAE usam o primeiro principal; na ausência, o primeiro secundário. Não mudar a preferência atual de palavra antes do CNAE no nome sugerido.

A escolha de campos aditivos, rótulos, modo de abertura exclusivo e tratamento de contradições é proposta do implementador. O limite técnico de dias corresponde ao inteiro PostgreSQL e evita overflow; não introduz limite comercial novo.

## Mapeamento Casa dos Dados

- CNAEs principais: codigo_atividade_principal. CNAEs secundários: codigo_atividade_secundaria. Não unir as listas nem ativar incluir_atividade_secundaria para misturar principal com secundária no modo novo. Os dois parâmetros seguem a API; a documentação não especifica uma álgebra E/OU detalhada, então não prometer uma interpretação adicional nem criar outra busca para compor resultados.
- aberturaUltimosDias: data_abertura.ultimos_dias. Não calcular datas no navegador. Preservar o número e a data da consulta no histórico; replay do mesmo UUID só lê os resultados persistidos.
- excluirMei: mei.excluir_optante=true; período opcional em mei.data_exclusao.inicio/fim.
- excluirSimples: simples.excluir_optante=true; período opcional em simples.data_exclusao.inicio/fim.
- Nada preenchido: não enviar propriedades novas e manter os defaults atuais de situação/contato.

Fonte oficial consultada nesta conversa: https://docs.casadosdados.com.br/pesquisa-avan%C3%A7ada-de-empresas-16579062e0.md. Context7 não indexou o fornecedor; o OpenAPI oficial foi lido diretamente. Não inventar data de opção de regime ou filtros que só existam na resposta.

## Banco, segurança e operação

Migração0047 aditiva substitui somente a função privada busca_filtros_completos_validos para aceitar e validar os opcionais, sem editar migrações aplicadas. Manter validações anteriores, privilégios, assinaturas, RLS, reserva/cota, UUID, importação e proteção dos sócios. Validar listas, datas, tipos, inteiros e contradições também no banco, inclusive chamadas diretas.

O banco é a autoridade. Funcionalidade precisa de migração porque os campos avançados são persistidos no histórico e a validação atual recusa chaves extras. Banco antigo deve recusar o payload novo, nunca ignorá-lo ou ampliar a busca. Nenhuma linha histórica precisa ser reescrita.

Trabalhar no worktree crm-redesign/crm, branch codex/redesign-crm, PR55. Checkout principal e .superpowers alheia preservados. Testes com dados fictícios; não realizar nova busca paga sem autorização específica. Segredo somente servidor, sem alteração de variáveis ou limites.

Após aprovação deste desenho: implementar nesta conversa com TDD, conferir UI em desktop/celular, revisão independente final, CI da fonte exata. Aplicar somente0047 após backup/conferência e publicar no mesmo projeto Vercel, mantendo as cotas100 e os dados existentes. Não fazer merge na main.

## Aceitação

- Cada campo selecionado aparece e produz exatamente os parâmetros documentados, sem rede auxiliar ou retries.
- Dados ausentes não acrescentam filtros; combos inválidos não consomem cota nem HTTP.
- Datas relativas e períodos não coexistem; datas de exclusão correspondem ao regime correto.
- Antigos payloads e replay permanecem válidos e byte-equivalentes após serialização de leitura.
- Histórico e sugestão de nome contemplam buscas exclusivamente por CNAE secundário.
- Guardas, pausa/cota100, fornecedor Casa e privacidade não mudam.
- Nenhum crédito real consumido nos testes; entrega publicada e limitações de observação documentadas.


## Conferência do desenho

Revisor independente, sem contexto anterior e sem alterações de produto, leu desenho/plano e respondeu: nothing important left. O usuário aprovou explicitamente o desenho e o plano nesta conversa. A implementação foi iniciada após essa aprovação.
