# Grupos de importação: regras aprovadas

## Estado e objetivo

Regras de negócio e prévia interativa aprovadas pelo usuário em 14/09/2026, após a integração do PR38. Implementar a tabela compacta da prévia e o detalhe de grupo, reutilizando os componentes reais. A alternativa de cards é apenas exploração visual, não uma segunda interface a implementar.

Cada importação confirmada forma um grupo nomeado pelo gestor, por exemplo, "Mooca · Setembro". O gestor consulta a origem das empresas e controla a disponibilidade para novas prospecções sem interromper atendimentos existentes.

## Grupo e identidade das empresas

- Somente gestores criam, consultam a administração, renomeiam, desativam e reativam grupos.
- O grupo guarda nome, arquivo de origem, data, gestor responsável e resultado da importação. Guardar o nome do arquivo não implica armazenar seu conteúdo original.
- Um CNPJ continua identificando uma única empresa. Uma empresa pode estar vinculada a vários grupos, sem duplicar cadastro, posse, contatos ou histórico.
- Uma nova planilha não sobrescreve automaticamente dados de empresas já cadastradas.
- Linhas válidas de CNPJs existentes também são vinculadas ao novo grupo. Uma planilha com empresas válidas, todas já cadastradas, pode criar um grupo; o relatório distingue novas empresas de empresas existentes vinculadas.
- Linhas recusadas não geram cadastro nem vínculo. Duplicatas dentro do arquivo continuam respeitando a validação existente, sem multiplicar vínculos.
- Conferir continua sendo somente leitura. Grupo, empresas novas e vínculos são gravados juntos na confirmação, após reanalisar o arquivo original. Falha não deixa grupo parcial.
- Reenvio da mesma confirmação precisa evitar grupos duplicados por clique repetido ou tentativa após falha de rede. Importar deliberadamente outra vez é uma nova operação.

## Ativação e disponibilidade

- Grupos novos começam ativos. Desativar não apaga empresas nem históricos.
- Uma empresa tem origem ativa quando pertence a pelo menos um grupo ativo. Desativar um dos grupos não a bloqueia se outro continuar ativo.
- Origem ativa é condição adicional para uma nova prospecção, junto das regras atuais de posse, reserva e descanso. Não substitui essas regras.
- Empresas livres sem origem ativa não entram em busca, sugestões ou novas reservas de Prospecção. O bloqueio vale também por acesso direto, busca antiga aberta e chamada ao servidor.
- A administração de Empresas continua permitindo ao gestor consultar empresas e grupos desativados.
- Recentes e perfis resumidos precisam respeitar a mesma regra de visibilidade. O acesso do responsável à carteira ou à reserva válida é preservado.
- Reativar um grupo não toma clientes dos vendedores, não renova reservas nem antecipa o fim de um descanso.

## Carteiras e reservas existentes

- Desativar o grupo mantém a posse atual, os retornos, as notas e o histórico. Carteira e Meu dia continuam funcionando para o responsável.
- Reserva válida já iniciada permanece válida até seu vencimento atual; o vendedor pode concluir o atendimento e assumir a empresa enquanto a reserva permitir.
- A desativação não renova a reserva. Quando ela expira, uma nova reserva exige origem ativa.
- Se o vendedor devolver a empresa, a devolução acontece normalmente. Ela só poderá voltar à prospecção com alguma origem ativa e depois do descanso já previsto.
- Os prazos atuais são preservados: reserva de 30 minutos e descanso de 30 dias após devolução.
- As regras já existentes para vendedor desativado continuam valendo; grupo ativo não dispensa nenhuma condição de elegibilidade.
- Corridas entre desativação e reserva são resolvidas no banco. Se a reserva se concluir primeiro, ela é preservada; se a desativação se concluir primeiro, nenhuma nova reserva sem origem ativa pode ser concedida. Testar a ordem de conclusão das duas operações.

## Administração e apresentação

Decisão reforçada pelo usuário em 14/09: preservar `/empresas` como visão de todas as empresas juntas, com a tabela compacta, busca e filtros aprovados. Não substituir essa listagem por grupos nem exigir a escolha de uma planilha para consultar a base.

A gestão de planilhas fica em uma tela separada, proposta em `/empresas/grupos`, com acesso "Grupos de importação" a partir de Empresas. Mostrar grupos com nome, situação, data e quantidade de empresas. Abrir um grupo permite consultar somente suas empresas e voltar para a lista de grupos. A listagem geral continua disponível independentemente desse caminho.

Preservar o padrão visual aprovado de Empresas e o fluxo Enviar, Conferir e Concluir. O nome do grupo entra no envio; ao concluir, oferecer acesso ao grupo criado e à visão geral. Na implementação, a visão geral mantém também todos os filtros existentes, omitidos apenas na prévia resumida.

O gestor consegue distinguir empresas disponíveis, reservadas e em carteiras. Empresas em descanso ou sem origem ativa não podem ser contadas como disponíveis. A classificação e os rótulos finais serão apresentados no desenho da tela, sem somas que contem a mesma empresa duas vezes dentro do grupo.

Antes de desativar, mostrar o impacto em novas prospecções e informar que atendimentos iniciados continuam. Os totais de grupos diferentes podem incluir a mesma empresa; um total geral de empresas usa CNPJs distintos.

## Transição das empresas de teste

Decisão posterior aprovada pelo usuário: preservar as empresas atuais em um grupo "Base de testes" para validar carteiras, reservas e retornos. Isso substitui a intenção anterior de limpar agora. Não executar exclusão nesta fatia.

Na migração, vincular as empresas preexistentes a "Base de testes", inicialmente ativo para preservar disponibilidade. Não atribuir um nome de arquivo ou gestor fictício a essa carga anterior: mostrar origem "Cadastros anteriores" e autoria "Migração". O grupo só precisa existir se houver empresas anteriores. Novas importações pertencem somente ao grupo criado por sua confirmação, sem vínculo automático à base de testes.

Preservar todos os usuários, credenciais, sessões, CEPs, contatos, posses, reservas e recentes. Os seis grupos com nomes de regiões aprovados na prévia são demonstração, não dados a semear automaticamente no banco real. Usar esses cenários em fixtures isoladas de navegador.

A futura limpeza exige inventário dos vínculos e definição do ambiente. A autorização desta etapa cobre implementação e testes locais; aplicar migração na Railway é uma operação separada, depois de revisão e integração. Não transferir notas fictícias para cadastros reais sem conferir eventual coincidência de CNPJ.

## Evidências do código atual

Leitura realizada em 14/09/2026 na base `66e0935`:

- `src/features/empresas/servico.ts`: `preparar` separa CNPJs existentes; `importar` atualmente envia somente as novas empresas para `gravar`.
- `src/features/empresas/repositorio.ts`: a gravação atual é transacional, usa o contexto do gestor e trata colisão de CNPJ como necessidade de conferir novamente.
- `app/empresas/importar/formulario.tsx`: confirmação atualmente só aparece quando `relatorio.novas > 0`. O fluxo de grupos precisará permitir vínculo de empresas existentes.
- `db/migracoes/0016_empresa_fila.sql`: posse, reserva e devolução; descanso de 30 dias.
- `db/migracoes/0025_fila_reservar.sql`: reserva atual de 30 minutos, verificação de contexto, candidato direto e escolha automática; o antigo `fila_puxar` perdeu concessão à aplicação.
- `db/migracoes/0024_empresa_consulta.sql`: busca e opções de filtros hoje leem empresas sem conceito de grupo. As opções são compartilhadas por Prospecção e Empresas; distinguir acesso administrativo de novas prospecções.
- `db/migracoes/0026_empresa_recentes.sql`: resumos, perfil, recentes e sugestões são outros caminhos de leitura que precisam aplicar a nova regra.
- `db/migracoes/0016_empresa_fila.sql` e `0017_contato.sql`: referências à empresa restringem exclusão. `0026_empresa_recentes.sql` possui referência com cascata. A limpeza não consiste em apagar apenas a linha de empresa.

Não modificar migrações existentes. Alterações novas no banco seguem documentação, invariantes, privilégios mínimos e testes locais. `features/` não importa outra `features/`; regra compartilhada de elegibilidade pertence ao banco, com auxiliares comuns apenas onde houver consumidores reais.

## Critérios de aceite

1. CNPJ repetido em dois grupos continua com um único cadastro e histórico.
2. Importação só de CNPJs válidos existentes cria vínculos sem alterar os dados das empresas.
3. Conferência não grava; erro na confirmação não deixa grupo ou vínculo parcial; repetição da mesma confirmação não duplica o grupo.
4. Desativar o único grupo ativo impede novas reservas por escolha automática e ID direto, inclusive com tela antiga aberta.
5. Outra origem ativa mantém elegibilidade, respeitando posse, reserva e descanso.
6. Carteira, Meu dia e conclusão de reserva válida continuam funcionando após desativação.
7. Expiração ou devolução não libera empresa sem origem ativa. Reativação não apaga descanso nem altera responsável.
8. Busca, filtros, recentes, perfil e sugestões não oferecem caminhos alternativos para nova prospecção bloqueada.
9. Vendedor não administra grupos, inclusive por chamada direta ao servidor ou ao banco.
10. Concorrência entre desativação e reserva é exercitada com duas conexões reais no PostgreSQL local.
11. Contagens da administração distinguem disponibilidade, posse, reserva e demais impedimentos sem duplicar empresas.
12. Testes de unidade, integração local, navegador, revisão independente e CI no commit exato precedem integração. Validar as telas com o usuário.

## Fora desta primeira fatia

Excluir definitivamente grupos ou empresas pela interface; recolher clientes das carteiras; transferir posse em massa; tags; funil comercial; analytics de vendedores; guardar arquivos originais; atualizar cadastros automaticamente a partir de planilhas; adicionar novos campos comerciais à empresa.
