# Planejamento Google, critérios opcionais e rodadas complementares

Data: 23/10/2026. Projeto: CRM. As regras e a organização visual abaixo foram
aprovadas na conversa. Este documento consolida o contrato para planejar a
implementação; ainda não representa ativação dos agentes ou dos workflows.

## Intenção e fronteiras

Cada vendedor define as buscas que vão abastecer suas empresas no CRM.
O agente usa esse planejamento, entrega diretamente quando não há filtros
extras e executa somente as verificações selecionadas quando houver filtros.
Rodadas complementares procuram completar a entrega sem ultrapassar o teto
diário. Gestores compartilham equipe, planilha e histórico central.

Preservar a integração CNPJ.biz, seus campos cadastrais separados dos manuais,
quota de 100 solicitadas por dia, chave no servidor e idempotência por UUID.
Os novos limites deste documento são exclusivos da busca Google. Não
implementar campanhas, envio de mensagens, redes sociais ou vendas.

Referências do checkout existente: `docs/operacao/agente-google-crm.md`,
`docs/superpowers/specs/2026-10-22-google-agentes-vendedores-planilha-design.md`.
Este documento substitui os pontos antigos sobre 9h, dia atual, bloqueio de
todos os pedidos iniciados, WhatsApp obrigatório e lote único. Os demais
controles de identidade, conservação de dados e reconciliação continuam.

## Planejamento e calendário aprovados

- Abrir sempre a semana atual, segunda a sexta, com destaque em Hoje.
- Permitir consultar semanas futuras e o histórico real de semanas anteriores.
- Dia inteiramente vazio pode ser salvo e aparece como Não definido; não gera
  coleta nem obriga a preencher os outros dias da semana.
- Dia programado exige nicho, cidade e UF. Bairro é opcional; vazio significa
  cidade inteira. Dia parcialmente preenchido precisa de correção antes de salvar.
- Critérios extras são opcionais. Nenhum exige preenchimento por padrão.
- Hoje e datas passadas não podem ser alterados. Datas futuras continuam
  editáveis, inclusive após 17h; não introduzir bloqueio adicional de amanhã.
- Segunda a quinta, 17h America/Sao_Paulo: preparar o dia seguinte.
- Sexta, 17h America/Sao_Paulo: preparar segunda-feira. Não agendar novas
  coletas aos sábados e domingos. Não aplicar calendário de feriados não solicitado.
- O destinatário, a data planejada e a revisão vêm do banco, nunca de um nome
  de vendedor informado pelo scraper ou pelas células.

Escolha técnica para conciliar edição futura e execução: o planejamento salvo
é versionado separadamente da execução. Ao reservar a execução, guardar uma
cópia imutável do plano sincronizado, critérios e limites. Alteração posterior
permanece salva e visível, mas não modifica rodadas em andamento nem dispara
outra execução para o mesmo dia. Mostrar quando a revisão atual difere daquela
usada na coleta. Não fingir que a alteração foi aplicada ao lote já iniciado.

Pedidos com erro de sincronização ficam pendentes, sem usar uma revisão antiga
silenciosamente. Não recuperar uma data vencida criando uma busca nova fora da
agenda; retomadas de execuções iniciadas conservam a mesma identidade.

## Interface aprovada na prévia

Editar planejamento transforma a tabela em campos na mesma tela: nicho,
bairro, cidade e UF por dia; grupo de destino calculado automaticamente.
Salvar e Cancelar preservam alterações ou o estado anterior de forma coerente.
Usar botões explícitos, campos rotulados, mensagens de erro e confirmação.

Critérios de busca abre um diálogo por dia, com os grupos Busca e perfil,
Exclusões, Contatos e avaliações e Outras orientações. Aplicar critérios altera
o rascunho do planejamento; Cancelar, X e Esc descartam somente o rascunho
do diálogo. Salvar planejamento persiste o conjunto. Preservar navegação por
teclado, foco, rolagem interna e funcionamento em 1920x1080 e em telas menores.

Espelhar um dia permite escolher semana e dia de origem de planejamentos
salvos do próprio vendedor, incluindo semanas anteriores sem limite artificial
de duas semanas. A prévia tem dois exemplos fictícios; produção usa registros
reais. Não copiar empresas nem reexecutar uma busca histórica.

O vendedor escolhe independentemente Nicho, Critérios de busca e Região
(bairro, cidade e UF juntos), a semana exibida ou a seguinte e os dias de
destino. Não permitir aplicar sem item ou dia escolhido, sobre o próprio dia
de origem, ou sobre hoje/passado. Revalidar no servidor. Somente campos
marcados substituem dados dos destinos; valores vazios também são copiados.
Recalcular grupos. As cópias são independentes. Rejeitar atomicamente se algum
destino deixar de ser elegível. Salvar/cancelar a edição antes de abrir essa
operação, para não descartar rascunhos de outra semana. Remover o antigo bloco
O que será copiado e o resumo fixo de nicho/quantidade/região preservada.

## Critérios e encaminhamento aprovados

Nicho, região e termos adicionais são entradas da coleta. Os termos
complementam o nicho, sem substituí-lo nem autorizar outra região.

Um único workflow n8n recebe o lote e os critérios do snapshot. Suas etapas
condicionais executam apenas verificações necessárias, conservam evidências
individuais e respondem uma vez com o resultado completo. Todos os vendedores
compartilham esse workflow; pedido, vendedor, revisão e lote distinguem as
execuções. Sem verificações necessárias, a entrega direta dispensa o n8n.

Verificações reutilizáveis dentro desse workflow:

1. Dados do Google: nota mínima de 0 a 5, mínimo inteiro de avaliações a partir
   de zero e situação do estabelecimento. Situação usa o cadastro do Google,
   não a situação cadastral da Receita Federal.
2. Site e e-mail: caixas Com site/Sem site e Com e-mail/Sem e-mail comercial
   publicado. Reaproveitar dados e evidências da coleta; conservar a fonte.
3. Perfil comercial: produtos de interesse; varejista, atacadista, distribuidor,
   fabricante; loja física/online/ambas; negócios e termos a evitar; outras
   orientações; prioridades. Usar informações publicadas, não inventar perfil.
4. WhatsApp: confirmação pelo serviço usado no workflow existente.
5. Telefone fixo: identificar fixos e conferir o formato. Não exige WhatsApp
   e não afirma que uma linha está ativa apenas por seu formato.

Opções Priorizar loja física, Priorizar em funcionamento e O que priorizar
ordenam os resultados; não excluem por falta de uma preferência. Opções
Somente, Excluir e mínimos numéricos funcionam como filtros selecionados.
Outras orientações qualificam a busca e não podem alterar quota, identidade,
permissões, destino, agenda ou criar ações externas arbitrárias.

Entre filtros diferentes aplicar E. Entre alternativas da mesma lista de
checkboxes aplicar OU. Forma de atendimento Loja física e online significa
ambas. WhatsApp e fixo juntos aceitam pelo menos um canal, conservam os dois
quando disponíveis e não duplicam uma empresa. Com e Sem de site/e-mail juntos
equivalem a ausência de restrição naquele campo. Sem seleção de contato não
exigir WhatsApp nem telefone fixo. Cada campo neutro deixa de acionar a
verificação correspondente; reaproveitar a leitura quando vários campos usam
a mesma etapa do workflow.

Exemplo: Com site + Com e-mail + WhatsApp e fixo significa site E e-mail E
(WhatsApp OU fixo). Uma aprovação de contato não substitui outro filtro.

Sem filtros extras, entregar todas as candidatas novas até a meta, sem exigir
recibo de n8n/WhatsApp ou aplicar os filtros antigos de armarinhos, perfil ou
fechamento. Apenas termos adicionais continuam permitindo esse caminho direto.
Não remover empresas por ausência de telefone/site/e-mail/endereço. Mostrar
os dados ausentes ou Não verificado com honestidade. Se o cadastro atual
exigir telefone, o desenho precisa suportar a ausência para esta origem sem
inventar número nem enfraquecer as exigências manuais ou do CNPJ.biz.

Escolha técnica conservadora: verificação selecionada retorna aprovado,
reprovado ou não confirmado, com motivo, fonte e horário. Ausência de informação
ou falha de consulta não prova Sem site/Sem e-mail. Não confirmado não conta
como aprovação; guardar na auditoria do gestor, permitir reconciliação e
continuar com outras candidatas dentro do limite. Uma falha geral de serviço
pausa a etapa para retomada, em vez de classificar todo o lote como reprovado.
O fornecedor/modelo de qualificação e sua configuração são escolhas da
implementação/ativação, não uma autorização para contratar novos serviços.

## Meta, lotes e retomada aprovados

- Meta: até 50 empresas efetivamente entregues ao vendedor por data planejada.
- Até 3 lotes de até 50 candidatas, no máximo 150 candidatas novas analisadas.
- Cópia do plano e critérios iguais durante todas as rodadas desse pedido.
- Primeiro aproveitar candidatas ainda não processadas da coleta já disponível;
  quando necessário, coleta complementar controlada com o mesmo planejamento.
- Não trocar bairro, cidade, UF, nicho ou relaxar filtros para completar a meta.
- Encerrar ao atingir 50 entregues, chegar a 3 lotes/150 analisadas ou não
  encontrar empresas novas. Se houver menos aprovadas, entregar o que houver.
- Não prometer que uma nova consulta do Maps retorna outras empresas ou atinge
  a meta. Preservar o download completo mesmo se só parte entrar nos lotes.

Escolhas técnicas: contar candidatas distintas uma vez, com identidade
persistida. Repetida já vista não deve ser validada de novo nem servir para
criar um ciclo infinito de busca. A tentativa complementar também precisa de
identidade e teto; interromper quando não houver novidades, mesmo sem gastar
150 verificações. Não usar offsets/paginação inexistentes no kit instalado.
O executor pode escolher estratégia finita entre resultados disponíveis e
consultas literais compatíveis, respeitando limites operacionais configurados.

Cada lote, criação de job, verificação e entrega tem identidade durável ligada
ao vendedor e à data planejada. Falha/timeout retoma ou reconcilia a mesma
etapa, não cria nova rodada para contornar incerteza e não renova os limites.
Entrega repetida reconcilia a resposta sem duplicar empresas. Confirmar as
entregas no banco antes de contar a meta. Se houver excesso de aprovadas,
entregar só o restante para 50 e conservar as outras ocorrências na auditoria.

## Entrega, dados e recursos compartilhados

Conferir a base global antes da distribuição e novamente na transação final.
Reutilizar cadastros por identidades confiáveis, preservando campos manuais,
responsável, reserva e carteira. Place ID/CNPJ e os contatos normalizados
participam da prevenção de repetidas; conflitos não autorizam fundir empresas
distintas. Primeira entrega determina exclusividade permanente. Gestor vê
histórico completo e solicitantes; vendedor recebe apenas suas empresas.

Mesmo nicho e mesma região pesquisada do vendedor reutilizam o grupo; regiões
diferentes ficam separadas. Preservar nome e endereço reais do Maps, mesmo
incompletos ou de bairro vizinho. Não substituir endereço real pela região
planejada nem excluir por uma diferença geográfica não solicitada.

Manter originais, resultados, fontes, recibos e vínculo com os grupos no CRM.
Gestor acompanha critérios/revisão usados, rodadas, encontradas, candidatas,
aprovadas, entregues, repetidas, rejeitadas/não confirmadas e motivo de parada.
Não usar abertura de ficha como comprovação de utilização; manter atendimento
registrado pelo destinatário após a entrega como evidência existente.

O CRM é a origem do planejamento; a planilha compartilhada é espelho e, nas
rotas que ainda precisarem, transporte serial. Não criar planilha por vendedor
ou gestor. Uma validação/publicação por vez nos recursos compartilhados;
workflows opcionais não sobrescrevem abas de outro lote. Evitar repetir a
extração do site e a confirmação do mesmo telefone dentro do pedido.

O caminho direto não exige simular uma validação inexistente ou falsificar
validacao_conferida. O contrato de entrega identifica verificações requeridas,
executadas, seus resultados e evidências, aceitando vazio somente quando o
plano não as exige. Limites, exclusividade e autorizações continuam no banco.

## Validação e ativação

Implementar em branch e PR, com TDD e isolamento do outro checkout. Não alterar
o conteúdo das migrações 0040/0041 já existentes; criar migração nova depois de
conferir os nomes disponíveis no momento da implementação. Uma feature não
importa outra feature; elevar contratos comuns para lib/server quando preciso.

Cobrir calendário de sexta/segunda e limites São Paulo, plano vazio/parcial,
edição futura sem mudar snapshot, combinações E/OU e neutras, preferências,
entrega direta sem contato, telefone fixo sem WhatsApp, seleção de campos no
espelhamento histórico, 3 lotes/150/50, falta de novidades, resultado incerto,
repetição, concorrência entre vendedores e planilha, isolamento e dados CNPJ.biz.
Simular scraper, Evolution, IA, Sheets e Drive nos testes; nenhuma busca real,
validação de números, custo externo ou migração em produção é necessária para
verificar a implementação. Revisão independente ao final.

Preparar configuração/importação revisável dos workflows e documentação de
transição da rotina antiga. Ativação real exige conferir as configurações,
versões e pendências existentes. Não apagar locks, CSVs, jobs, histórico ou
abas para contornar falhas e não anunciar serviços como ativos sem confirmação.
