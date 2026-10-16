# Campanhas de email com prospecção no CNPJ Biz

Data: 16/10/2026.

## Objetivo e decisões aprovadas

Acrescentar ao CRM campanhas de email para os vendedores encontrarem empresas do nicho desejado no CNPJ.biz, prepararem uma mensagem reutilizável com o catálogo e acompanharem os resultados. Contatos que confirmarem a assinatura poderão receber novas edições do catálogo de forma recorrente.

O usuário determinou que a função pertence ao projeto `C:\Users\ADM\projetos\crm`. A palavra feature significa nova função do projeto, sem criar uma seção chamada Feature.

Responsabilidades aprovadas na conversa:

- O vendedor define o perfil das empresas que quer buscar e padroniza a mensagem de suas campanhas.
- O vendedor pode iniciar campanhas sozinho dentro dos limites definidos pelo gestor.
- O gestor acompanha todas as campanhas e pode pausá-las.
- A recorrência do catálogo depende da escolha do destinatário.

A divisão entre os painéis foi apresentada e aceita pelo usuário. As escolhas técnicas e os comportamentos detalhados abaixo são a proposta para executar essa divisão. Foram definidos pelo autor, como decisões de implementação sujeitas à revisão do usuário, o limite mensal de empresas solicitadas, a proteção temporária de contatos, a primeira frequência mensal, o cadastro de catálogo por link HTTPS e a origem institucional de assinaturas sem campanha. A escolha do serviço real de email ainda precisa ser fechada antes da implementação do respectivo conector. Nenhuma contratação, compra de créditos ou campanha real está autorizada por esta especificação.

## Aproveitamento do CRM existente

A Prospecção em `/fila` já apresenta listas com origem e critérios, consulta empresas e respeita reserva e posse. O Funil em `/funil` acompanha negociações do vendedor nas etapas Primeiro contato, Em negociação e Proposta enviada. Gestão em `/gestao` acompanha a equipe. Esses fluxos continuam sendo a base da operação.

A busca salva representa o perfil de cliente desejado: atividade, região e outros critérios efetivamente aceitos pela API. O Funil continua representando o andamento da negociação. Buscar empresas ou enviar emails não cria interesse comercial nem avança uma negociação.

A importação atual exige telefone válido. Para suportar um lead que tenha apenas email, o destinatário da campanha pode conservar um retrato mínimo dos dados recebidos, sem inventar telefone ou criar uma empresa inválida. Vincular esse destinatário a uma empresa do CRM exige identificação e os campos mínimos do cadastro vigente. Um destinatário ainda sem empresa vinculada permanece visível na campanha e pode ser qualificado pelo vendedor.

Essa fotografia do destinatário pertence ao histórico da campanha. Não cria outra Carteira nem substitui o cadastro de empresa. Quando houver empresa conhecida, a campanha referencia seu UUID e conserva o conteúdo efetivamente usado no envio.

## Painéis e permissões

| Capacidade | Gestor | Vendedor |
| --- | --- | --- |
| Integrações | Configurar e testar CNPJ.biz e serviço de email; acompanhar sua disponibilidade | Consultar se a conexão necessária está disponível |
| Limites | Definir cotas por vendedor e teto compartilhado da equipe | Consultar suas cotas disponíveis e o motivo de bloqueio |
| Públicos | Consultar critérios, origem e desempenho da equipe | Criar, editar e reutilizar suas buscas salvas |
| Modelos | Publicar modelos compartilhados e identidade da empresa | Criar seus modelos e personalizar uma cópia dos modelos compartilhados |
| Catálogos | Cadastrar edições e definir quais estão disponíveis | Escolher uma edição publicada para sua campanha |
| Campanhas | Consultar todas, pausar e liberar as que pausou | Criar, testar, iniciar, agendar e pausar suas próprias campanhas |
| Resultados | Consultar totais e detalhes por vendedor, público e campanha | Consultar seus destinatários e resultados |
| Assinaturas | Acompanhar inscritos e configurar as frequências disponíveis | Oferecer assinatura e consultar os inscritos originados em suas campanhas |

A autoridade permanece no Postgres, com RLS e funções de escrita específicas. Ocultar um botão não é autorização. Vendedor não acessa campanhas ou segredos de outro vendedor. Gestor não inicia atendimento comercial como se fosse vendedor.

Usuário desativado, com senha provisória pendente ou sem o papel exigido não cria novas capturas nem autorizações de envio. O processamento em segundo plano também revalida essas condições.

## Fluxo do vendedor

A entrada Campanhas de email aparece junto às ferramentas de prospecção do vendedor. A criação segue seis passos:

1. Informar um nome para a campanha e selecionar ou criar seu público.
2. Definir a quantidade máxima de empresas a buscar e revisar o orçamento disponível.
3. Consultar o CNPJ.biz e revisar os candidatos encontrados e as exclusões.
4. Selecionar a edição do catálogo, preencher assunto e mensagem, conferir personalização e destinatários.
5. Enviar um teste para endereço de teste autorizado e conferir a apresentação.
6. Iniciar ou agendar, sem aprovação individual do gestor quando estiver dentro dos limites.

O teste real consome a cota de envio correspondente. A prévia local, sem email enviado, não consome envio. Salvar um rascunho não consulta a API nem gasta créditos.

Públicos e modelos podem ser reutilizados. Ao iniciar, a campanha fixa a versão dos filtros, da edição do catálogo e da mensagem. Editar o modelo depois não altera emails pendentes de uma campanha já iniciada. Para mudar seu conteúdo, o vendedor pausa a campanha e prepara outra versão com uma revisão explícita dos destinatários.

## Captura de empresas e créditos

A integração usa o contrato oficial do CNPJ.biz, com autenticação no servidor e paginação. O adaptador deve validar os campos aceitos e retornados; a interface não oferece filtros sem suporte confirmado.

A documentação consultada apresenta os endpoints de empresas `/empresas/cnpj`, `/empresas/contar` e `/empresas/listar-com-dados` sob `/api/v2`. A confirmação do contrato e da cobrança deve usar a documentação vigente antes de implementar o adaptador. Não inferir custo por chamada a partir do preço de uma exportação no site.

Cada captura registra vendedor, busca, parâmetros normalizados, quantidade pedida, páginas concluídas, data, resultado e consumo informado pelo fornecedor quando disponível. O usuário confirma quantidade e limite antes da primeira operação potencialmente cobrada.

O orçamento interno de aquisição é um limite mensal de empresas solicitadas, por vendedor e para a equipe, com mês civil no fuso de São Paulo. A unidade é uma empresa solicitada à API; não é uma chamada, um real nem necessariamente um crédito do fornecedor. A tela identifica o limite com esse nome e não o apresenta como saldo confirmado do CNPJ.biz.

Antes de cada página, reservar a quantidade máxima de empresas pedida naquela requisição. Ao iniciar a chamada potencialmente cobrada, debitar essa quantidade por prudência, inclusive se vierem duplicados, menos resultados ou um resultado incerto. Falha comprovada antes de chamar o fornecedor libera a reserva. Eventual ajuste posterior exige consumo comprovado e registro auditável, sem devolver automaticamente saldo por deduplicação. A troca de mês não permite reaproveitar uma autorização antiga para gastar a cota anterior.

Essa regra garante o limite interno de empresas solicitadas. A garantia de não exceder créditos ou dinheiro externos depende do contrato de cobrança confirmado do CNPJ.biz. Se a API não informar saldo ou custo, mostrar apenas a contagem interna e a indisponibilidade da informação externa. Não habilitar uma opção de teto monetário sem contrato que permita cumpri-lo.

Resultados anteriores do mesmo lote são preservados. Retomar uma captura consulta apenas as páginas que ainda faltam quando o contrato permitir isso com segurança. Uma chamada cobrada cujo resultado ficou desconhecido não é repetida automaticamente sem garantia de idempotência do fornecedor.

CNPJ e email normalizado permitem identificar repetições. A mesma empresa encontrada em outra busca não vira outra empresa no CRM. Emails repetidos no mesmo lote recebem uma única mensagem da campanha. Erros, campos desconhecidos ou emails ausentes são apresentados como exclusões ou pendências, sem completar dados por adivinhação.

## Responsável e proteção contra contatos duplicados

Antes de incluir um destinatário para envio, conferir posse, reservas de atendimento e proteções de outras campanhas. Empresa com vendedor ativo ou reserva de outro vendedor é excluída da campanha, com explicação. O mesmo vale para email protegido por uma campanha de outro vendedor, inclusive quando aparece em CNPJs diferentes.

A seleção de destinatários cria uma proteção própria da campanha, sem tomar a Carteira nem registrar contato fictício. A disponibilidade na Prospecção e a aquisição de novas reservas também precisam respeitar essa proteção. Caso contrário, o sistema permitiria que um vendedor ligasse enquanto outro dispara emails para a mesma empresa.

Essa proteção é adquirida de forma atômica e tem expiração. A proposta inicial é manter a proteção durante campanha ativa e por sete dias após o último envio aceito, com duração posterior configurável pelo gestor. Pausar não reserva contatos indefinidamente: a proteção de destinatários ainda não enviados expira após 24 horas sem processamento, e retomar exige revalidar a disponibilidade. Destinatários que perderam disponibilidade ficam excluídos; não voltam a receber silenciosamente.

A autorização é revalidada antes de cada envio, inclusive depois de mudança de responsável ou de cota. Aceitar uma assinatura do catálogo não transfere automaticamente a posse comercial de uma empresa.

## Conteúdo e catálogo

O vendedor edita assunto e texto com variáveis permitidas para nome da empresa, nome do contato quando conhecido e sua assinatura comercial. A prévia usa um destinatário escolhido da própria campanha e mostra claramente valores ausentes. Conteúdo sem campos obrigatórios permanece em rascunho.

O gestor cadastra título, edição e link HTTPS do catálogo. A proposta da primeira versão usa catálogo já publicado em endereço acessível, evitando depender de armazenamento de arquivos ainda não escolhido. O vendedor escolhe uma edição; o registro do envio conserva o link usado.

Emails contêm identificação da empresa, meio de resposta do vendedor e descadastro. A caixa de resposta deve ser real e verificada. O remetente deve ser permitido pelo serviço e pertencer a domínio autenticado conforme os requisitos do provedor. A identidade visual compartilhada não impede que cada vendedor escreva a abordagem do seu nicho.

O corpo é sanitizado e as variáveis são escapadas. A aplicação não interpreta HTML ou URLs fornecidos como código. A edição inicial pode usar texto com formatação limitada, sem editor visual complexo.

## Cotas e início sem aprovação individual

Gestor configura limites mensais de empresas solicitadas por vendedor e para a equipe, limite de destinatários por campanha e cotas diárias de envio por vendedor e pela equipe. Nenhuma cota positiva é ativada silenciosamente: o gestor informa valores antes de habilitar operação real.

A cota comercial diária usa a data de São Paulo. A cota do fornecedor conserva sua própria janela e velocidade, inclusive se for móvel. A liberação respeita todos os limites aplicáveis ao mesmo tempo.

Contagem e reserva de cota são feitas no banco e coordenadas entre campanhas e processos. Duas abas ou dois workers não conseguem gastar a mesma disponibilidade. Testes reais e confirmações de assinatura também entram na cota do provedor e no teto compartilhado; têm categoria própria para não confundir métricas de prospecção.

Uma solicitação de envio reserva cota antes de chamar o fornecedor. Falha comprovada antes de aceitação pode liberar a reserva conforme o contrato do provedor. Aceitação ou resultado incerto conservam contabilização suficiente para impedir ultrapassagem. O histórico distingue tentativas, mensagens aceitas e entregas.

Atingir cota bloqueia novos envios, mostrando quando será possível continuar. Campanhas ativas podem continuar na próxima janela desde que permaneçam autorizadas. Isso não remove pausas manuais.

Reduzir limites não cancela mensagens já aceitas pelo provedor. A nova configuração afeta novas capturas e autorizações de envio; o painel apresenta consumo já realizado, mesmo quando estiver acima da nova cota.

## Pausa e retomada

Pausa do vendedor pode ser retomada por ele dentro das condições vigentes. Pausa do gestor só é liberada pelo gestor. Um vendedor não contorna essa pausa editando o estado da campanha nem reutilizando seu ID em outra chamada.

O gestor também pode suspender todos os novos disparos da integração. Liberar essa suspensão não remove pausas individuais.

A pausa impede novas autorizações de envio. Uma solicitação já autorizada e em trânsito pode terminar; o painel mostra essas mensagens separadamente e conserva seus eventos posteriores. Não prometer recolher email já enviado.

Retomar revalida assinatura, descadastro, posse, estado do usuário, catálogo disponível e cotas. Não refaz envios aceitos nem considera uma campanha encerrada como nova.

## Processamento e integração com o serviço de email

A aplicação web permanece em Next.js na Vercel e usa o Postgres da Railway já existente. A fila de trabalho deve ser persistente. Envio em massa não roda em loop dentro de uma requisição do navegador nem depende de uma aba aberta.

A proposta técnica é uma fila no Postgres, com aquisição atômica e concessão temporária de trabalho, processada por executor autenticado em lotes pequenos. O modo de hospedagem e acionamento do executor deve ser escolhido antes da fatia de processamento, sem presumir que o plano atual da Vercel permita a frequência necessária. Não provisionar novo serviço pago automaticamente.

Cada destinatário possui chave estável de operação. Repetição de uma requisição de início, retomada ou trabalho não cria outra mensagem. Quando o provedor oferecer idempotência, a mesma chave é usada na chamada externa.

Após timeout com aceitação desconhecida, o registro fica Em conferência. O sistema consulta o resultado quando o provedor permitir; caso contrário, exige resolução operacional sem reenviar às cegas. Uma transação no banco não fornece garantia de envio externo exatamente uma vez.

O adaptador de email informa suas capacidades reais: aceitação, eventos de entrega, falha, denúncia, abertura, clique e resposta. A interface só apresenta o que a integração suporta. A primeira integração real precisa ser escolhida considerando a origem dos leads e as políticas do fornecedor; pagar um plano não torna qualquer lista admissível.

Usar adaptadores e contratos testáveis permite preparar domínio, banco e telas enquanto essa escolha é fechada. Simuladores ficam restritos aos testes e a uma demonstração identificada; produção sem conector configurado não informa que enviou.

## Eventos, respostas e indicadores

Estado de processamento: Rascunho, Agendada, Em andamento, Pausada, Encerrada ou Cancelada, com motivo quando bloqueada. O status de cada destinatário é separado do estado da campanha.

Destinatários podem apresentar Pendente, Em processamento, Aceito pelo serviço, Entregue ao servidor, Falhou, Em conferência ou Excluído. Descadastro e denúncia são condições de supressão separadas do histórico de entrega.

Aceito pelo serviço não equivale a entregue. Entregue ao servidor não garante caixa de entrada. Abertura e clique, quando disponíveis, são sinais de interação e não comprovam leitura humana ou interesse. Uma assinatura confirmada é uma ação distinta de clicar no catálogo.

Eventos recebidos são autenticados conforme o provedor, deduplicados e vinculados pelo identificador externo, sem confiar em vendedor ou email arbitrário do corpo. Duplicação e ordem diferente de chegada não apagam eventos válidos nem fazem retroceder um estado final de entrega.

O vendedor consulta andamento por campanha e destinatário. O gestor filtra por período, vendedor, público e campanha e acompanha aquisições, consumo, aceitação, entregas, falhas, descadastros, assinaturas e interesses confirmados.

Recebimento automático de respostas depende da capacidade do conector escolhido. Na ausência dela, o vendedor registra a resposta manualmente. Não mostrar ausência de evento como confirmação de que ninguém respondeu.

Interesse confirmado oferece uma ação para abrir o atendimento no fluxo comercial existente. A ação valida ou completa o cadastro mínimo e segue as funções autorizadas de reserva/posse/contato, sem criar ligação ou venda fictícia. Não acrescenta outra etapa ao Funil nesta entrega.

## Assinatura e recorrência do catálogo

A página pública do catálogo oferece Quero receber os próximos catálogos. O visitante informa email e interesses disponíveis, e confirma o endereço por um link enviado para a própria caixa. A origem da assinatura referencia a campanha quando houver vínculo válido e verificável; IDs de vendedor recebidos arbitrariamente na URL não definem atribuição.

A adesão sem campanha válida também pode ser concluída, com origem institucional. Ela usa o remetente e a caixa de resposta institucionais verificados e consome apenas a cota compartilhada da equipe, sem atribuição de aquisição ou conversão a um vendedor. O gestor consulta essas assinaturas em um grupo Sem vendedor. Elas não criam posse comercial nem uma conta de vendedor fictícia.

O registro conserva confirmação, finalidade, frequência escolhida e versão do texto de adesão. Estar no CNPJ.biz, constar em uma campanha ou clicar no catálogo não ativa inscrição recorrente.

A proposta inicial oferece recorrência mensal. O gestor pode habilitar outras frequências em entrega posterior. Cada execução seleciona apenas edições publicadas compatíveis com os interesses e ainda não recebidas. Sem nova edição aplicável, não repete o catálogo anterior.

A recorrência nasce vinculada ao vendedor da campanha de origem, respeitando disponibilidade e as políticas vigentes de remetente. Com vendedor desativado, o vínculo fica suspenso até tratamento do gestor; não muda de responsável silenciosamente.

Existe uma única assinatura ativa para o mesmo email e finalidade, mesmo que ele apareça em várias campanhas. O destinatário administra frequência, interesses, pausa e cancelamento por link seguro. Confirmação de uma nova adesão explícita pode reativar somente a finalidade de catálogo solicitada, preservando o histórico; importação ou ação de vendedor não a reativa. Reativar catálogo não autoriza novas campanhas de prospecção.

Descadastro gera supressão compartilhada de marketing, aplicada antes de qualquer novo envio de catálogo ou prospecção por qualquer vendedor. Uma confirmação posterior de adesão, iniciada pelo próprio destinatário, registra uma permissão específica para o catálogo e a preferência escolhidos; ela não remove o bloqueio de prospecção. Novo cancelamento revoga essa permissão. A elegibilidade consulta a supressão e a permissão específica no banco, sem tratar somente o estado ativo da assinatura como autorização suficiente.

Mensagens transacionais estritamente necessárias à adesão iniciada pelo destinatário seguem fluxo próprio. Falhas permanentes e denúncias são bloqueios de entrega independentes e não são removidos por uma reativação de assinatura.

Tokens públicos são aleatórios, têm finalidade restrita e são guardados como hash. Links GET não confirmam inscrição nem executam descadastro automaticamente, para evitar efeitos causados por leitores de links. A confirmação é uma ação explícita; o endpoint de descadastro em um clique segue o contrato POST aplicável ao fornecedor.

## Segurança e organização do código

Segredos de integração ficam somente no servidor. A implementação escolhe entre configuração operacional por ambiente e armazenamento cifrado no servidor conforme o fluxo de conexão adotado; nunca expõe chave em DTO do vendedor, HTML, URL ou log.

O executor possui credencial e privilégios próprios, restritos às operações da fila. Não usa `DATABASE_URL_ADMIN`, `SUPERUSER` ou `BYPASSRLS` em runtime. A autorização de negócio deve ser verificada em funções próprias, inclusive ao executar trabalho sem sessão de navegador.

Tabelas, funções expostas e grants entram nas invariantes de migração do projeto, com revogação de EXECUTE de PUBLIC e autorização coerente. Migrações existentes permanecem imutáveis.

Contratos compartilhados ficam em `src/lib/` ou `src/server/`. Uma feature não importa outra feature. Campanhas podem consumir serviços compartilhados de disponibilidade e identidade sem depender diretamente dos módulos de administração.

A implementação segue a stack e os padrões atuais, testes antes de regras novas e leitura dos componentes vizinhos antes de criar Actions e formulários. Manter o conteúdo acessível em celular e desktop.

## Entregas propostas

1. Fundação de campanhas, públicos e modelos, cotas, autoria e pausas, com controles negativos no banco.
2. Captura real no CNPJ.biz e revisão de destinatários, com proteção compartilhada entre campanha e atendimento.
3. Conector de email escolhido, fila persistente, executor, testes de envio e eventos.
4. Catálogo público, confirmação de inscrição, preferências, descadastro e recorrência.
5. Indicadores da equipe e jornadas completas com dados fictícios, revisão e demonstração.

Cada entrega é revisável e mantém a aplicação existente funcionando. A sequência não autoriza reduzir o escopo a uma demonstração sem envio real; ela organiza a implementação completa e explicita suas dependências.

A implementação segue branch `codex/`, PR e CI verde. Publicação, contratação, migração de produção e disparos reais dependem das autorizações correspondentes. A escolha e configuração do serviço de email e do executor precisam ser fechadas antes de ativar a operação.

## Critérios de aceite e verificação

- Vendedor cria público, modelo e campanha próprios; outro vendedor não consegue consultar nem alterar esses registros.
- Gestor define limites, acompanha todos e pausa campanha; vendedor não consegue liberar pausa do gestor.
- Capturas e envios concorrentes respeitam cotas compartilhadas; teste real entra na contabilidade.
- API inválida, timeout, captura parcial, falta de saldo e resposta incompleta têm estados recuperáveis sem duplicar gastos automaticamente.
- Destinatários repetidos, descadastrados ou indisponíveis ficam excluídos com motivo; regras são revalidadas no processamento.
- Empresa de outro vendedor e email já protegido não recebem nova campanha nem nova reserva concorrente.
- Pausa impede novas autorizações; trabalho já em trânsito termina com resultado rastreável.
- Repetir início ou trabalho, reiniciar executor e receber eventos duplicados não duplica mensagens nem deturpa o histórico.
- Aceitação externa incerta exige conferência e não sofre repetição cega.
- Envio, entrega, abertura, clique, resposta e interesse são apresentados conforme a capacidade real do conector.
- Entrada no Funil usa cadastro e permissões existentes, sem avanço automático por abertura.
- Confirmação de assinatura não ocorre por importação, GET de leitor de links ou ação do vendedor.
- Recorrência respeita preferência, novas edições, bloqueios, cotas e unicidade do envio.
- Cancelamento de inscrição por qualquer campanha bloqueia novos emails de marketing da equipe; adesão posterior confirmada libera somente o catálogo solicitado, preservando o bloqueio de prospecção e os bloqueios de entrega.
- Assinatura sem campanha válida usa identidade institucional e cota da equipe, sem criar vendedor ou posse fictícios.
- Limites mensais de aquisição são contabilizados por empresas solicitadas; duplicados, páginas incompletas e timeouts não devolvem orçamento sem comprovação.
- Desativação de usuário, troca de papel, senha provisória, alteração de responsável e redução de cota são testadas durante processamento e retomada.
- Testes de unidade, integração com Postgres e jornadas de navegador cobrem os dois papéis e caminhos públicos, sem consultar leads reais ou enviar mensagens externas.
- Verificações existentes do CRM continuam passando; nenhuma credencial ou dado real entra em fixture, screenshot ou PR.

## Evidências e contratos a confirmar

Arquivos existentes conferidos em 16/10/2026:

- `src/components/crm/shell.tsx`: navegação por papel.
- `app/gestao/page.tsx` e `src/features/gestao/consulta.ts`: dashboard e consulta restrita ao gestor.
- `app/fila/page.tsx`, `src/features/prospeccao/tipos.ts` e `repositorio.ts`: busca interna por grupo e localização.
- `src/server/grupos/prospeccao.ts`: leitura compartilhada dos metadados de grupos.
- `app/funil/page.tsx`, `src/features/funil/consulta.ts` e `src/lib/comercial.ts`: negociações e etapas existentes.
- `src/features/fila/repositorio.ts` e migrações comerciais: contratos de reserva e disponibilidade.
- `db/migracoes/0014_empresa.sql`, `0033_empresa_identificacao_parcial.sql` e `0035_grupo_metadados.sql`: identificação parcial admitida e telefone ainda exigido na importação.
- `docs/superpowers/specs/2026-10-14-producao-vercel-design.md`, `vercel.json` e `.env.example`: hospedagem, conexão de banco e ausência de configuração atual de email ou executor nesta preparação.
- `AGENTS.md`, `PREFERENCIAS.md` e `REGRAS.md`: brainstorm, spec, fronteiras, permissões e verificação.

Fontes externas consultadas para o desenho, sujeitas a reconferência ao implementar cada adaptador:

- [API de empresas CNPJ.biz](https://cnpj.biz/docs-api).
- [API do CRM CNPJ.biz](https://cnpj.biz/docs-api/crm). Sincronização com o CRM externo não faz parte desta entrega: o usuário escolheu operar o CRM local.
- [Limites do Gmail](https://support.google.com/mail/answer/22839?hl=pt-BR) e [limites do Workspace](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace).
- [Diretrizes do Gmail](https://support.google.com/mail/answer/81126?hl=pt-BR).
- [Eventos de envio no Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html), usados para distinguir aceitação, entrega e interação; não representam escolha desse fornecedor.

## Revisão de completude

Revisão independente em 16/10/2026 identificou três ambiguidades. Elas foram resolvidas nesta proposta: nova adesão concede apenas a finalidade solicitada; aquisição usa limite mensal de empresas solicitadas; assinatura sem origem verificável usa identidade institucional e cota da equipe. Serviço de email e executor continuam decisões de integração a fechar antes de suas respectivas entregas.
