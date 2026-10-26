# Coleta Google simultânea para três vendedores

Data: 2026-10-26. Estado: desenho para revisão do usuário; paralelismo de produção ainda não implantado. Builder check independente concluído, sem dúvidas materiais pendentes.

## Intenção e decisões do usuário

Executar até três buscas de vendedores diferentes ao mesmo tempo, usando o planejamento de cada vendedor e o workflow universal existente. Cada vendedor preenche o próprio planejamento. Um vendedor novo recebe o perfil lógico e dias vazios já previstos no CRM; não exige duplicar planilha, workflow ou agendamento.

A rotina permanece de segunda a sexta às 17h, America/Sao_Paulo. Segunda a quinta prepara o próximo dia; sexta prepara segunda. Nicho, cidade e UF são necessários para um dia definido; bairro vazio cobre a cidade inteira. Dia Não definido não roda. Hoje e dias anteriores continuam bloqueados para edição.

Por vendedor/data: meta de até 50 empresas entregues, até três lotes de no máximo 50 candidatas e até 150 candidatas distintas analisadas. Consumir primeiro o pool já coletado. Encerrar ao atingir a meta, esgotar o orçamento ou não encontrar novidades. Preservar snapshot, critérios, revisão e grupo durante toda a execução. Não ampliar região/nicho nem repetir jobs só para completar três rodadas.

**Falta de RAM: reportar que precisa de mais RAM e aguardar nova execução. Não trocar automaticamente para atendimento sequencial nem fechar programas.** Trabalhos e identidades já iniciados ficam preservados para retomada.

## O que o experimento demonstrou

O ensaio isolado `carga-maxima-02` executou três motores com dois trabalhadores internos cada, em três ondas: nove coletas concluídas em 334,1 segundos. Os três perfis usaram Armarinhos e variedades, Brás, São Paulo/SP, profundidade 1, raio 2.500 e tempo máximo de 900 segundos. Houve 146 registros brutos contando repetições; cada perfil analisou respectivamente 16, 18 e 16 candidatas distintas. As duas últimas ondas não trouxeram novidades e foram forçadas somente para carga.

Nessas condições, com outros programas fechados, o pico combinado amostrado dos motores foi 3.948,5 MiB e a menor RAM disponível no Windows foi 2.055,6 MiB. Não houve OOM. As candidatas podem se repetir entre os perfis: o total não representa empresas exclusivas globais. Critérios estavam neutros e houve zero chamadas ao workflow de verificações. O teste não entregou empresas ao CRM, não validou 450 candidatas distintas e não comprovou WhatsApp ou todos os critérios.

Prova privada preservada: `.superpowers/sdd/2026-10-26-google-real-3-vendedores/carga-maxima-02/conferencia-final.json`. Não versionar dados de empresas, credenciais, URLs temporárias ou artefatos privados desse ensaio.

## Estado atual confirmado e fronteiras

A migração 0041 cria `google_execucao_recurso_unico`, que permite apenas uma execução aberta no CRM inteiro. A 0042 retoma a primeira execução global e conserva esse limite. A ponte `scripts/google/coletar.py` também usa o lock global da campanha e o endereço fixo 8087. Portanto, manter três processos chamando o código atual não basta.

O web runner do scraper v1.18.1 atende um job de cada vez; `-c 2` controla trabalho dentro desse job. Precisamos de três instâncias para três coletas simultâneas. Referência: [código oficial do web runner v1.18.1](https://github.com/gosom/google-maps-scraper/blob/v1.18.1/runner/webrunner/webrunner.go).

Pontos de alteração: nova migração após 0044; protocolo/rota somente se necessário para transportar razões explícitas; ponte Python; configuração dos motores; coordenador local e instruções da rotina. Usar `app/api/agente/google/route.ts`, `src/features/google/repositorio.ts` e os comandos existentes de `scripts/google/agente.mts`. Não criar uma segunda implementação das verificações ou da publicação.

Fora do escopo: novas telas, novos filtros, IA para produtos/tipo/observações, raspagem social, troca de provedor, ampliação automática da busca, alteração dos horários, envio de mensagens ou campanhas, e mudança nas regras CNPJ.biz. Os critérios de qualificação ainda pendentes continuam pendentes.

## Arquitetura escolhida pelo implementador

Um coordenador local determinístico administra três posições de execução. O agente da rotina existente inicia e acompanha esse coordenador e realiza apenas as ações que exigem o Google Drive conectado. Não criar três automações, três chats permanentes, outro workflow ou um serviço de nuvem.

Cada posição possui motor, executor persistido e diretório próprios. A posição não fica presa ao nome de um vendedor: o CRM escolhe o próximo planejamento elegível e devolve o vendedor real. A associação posição/pedido/execução/motor torna-se imutável até concluir ou reconciliar esse trabalho.

O coordenador executa coleta, seleção, reserva, verificação e publicação pelos comandos existentes. As três coletas podem se sobrepor; uma falha identificada em uma posição não cancela as outras. Pedidos do mesmo vendedor não podem ficar abertos simultaneamente. Os arquivos e sinais de cada posição sempre carregam pedido, execução, revisão e hash do snapshot.

Somente os trechos curtos de reserva e distribuição global são serializados no banco. A exclusividade da empresa é decidida atomicamente na entrega, antes de inserir na lista do vendedor. Encontrar a mesma empresa em duas coletas não a entrega duas vezes.

## Fila e autoridade do banco

Adicionar migração 0045 sem reescrever 0041–0044. Acrescentar `vendedor_id` à execução, preencher a partir do pedido e estabelecer vínculo composto com o planejamento. Substituir o índice singleton por unicidade parcial de execução aberta por executor e por vendedor. Manter a unicidade já existente por pedido.

Sob o advisory lock transacional `(40,1)`, retomar primeiro a execução do próprio executor/gestor. Para trabalho novo, contar execuções abertas e admitir somente se houver menos de três. Escolher FIFO entre planejamentos elegíveis, com revisão sincronizada, que ainda não tenham execução. O aplicativo não recebe permissão para escrever diretamente nessas tabelas.

Não trocar o gestor de uma execução nem permitir que outro executor a assuma. Uma falha mantém somente a posição correspondente ocupada; não criar outro UUID para contorná-la. Pausa, inativação e perda de permissões conservam as regras atuais. Uma revisão editada depois do início não muda o snapshot nem cria outra execução para o dia.

Uma planilha não sincronizada não deve bloquear outros vendedores prontos: priorizar pedidos sincronizados elegíveis, depois retornar o aviso de sincronização quando não houver trabalho pronto. Falhas de conexão ficam explícitas no relatório.

Preservar o caminho V1: execução legada roda sozinha, no motor original. Não iniciar V1 enquanto houver V2 aberta, nem iniciar V2 enquanto houver V1 aberta ou pendência legada elegível para retomada. Retomar os trabalhos V2 existentes antes de admitir uma pendência V1. Atualizar também a inserção legada para preencher o vínculo com vendedor. Não converter recibos antigos.

Conservar o lock curto `(27,1)` e as verificações globais de CNPJ, Place ID e contatos na distribuição. Não remover locks globais indiscriminadamente. Manuais, responsáveis, reservas, carteira, propriedade e histórico permanecem protegidos. A deduplicação não depende da ordem de resposta do scraper ou n8n.

Justificativa técnica: [locks transacionais](https://www.postgresql.org/docs/18/explicit-locking.html) duram até o fim da transação, e [índices únicos parciais](https://www.postgresql.org/docs/18/indexes-partial.html) impõem unicidade somente às linhas abertas. Contagem e inserção devem acontecer sob o mesmo lock; contar fora dele não limita a concorrência.

## Motores e diretórios

Registro versionado `scripts/google/motores.json`, com três posições fixas:

| Posição | Motor | Origem | Estado local |
| --- | --- | --- | --- |
| 01 | `gmaps-mooca-prospeccao` existente | `http://127.0.0.1:8087` | `.google-agente` existente |
| 02 | `gmaps-crm-motor-02` | `http://127.0.0.1:8088` | `.google-agente/slots/02` |
| 03 | `gmaps-crm-motor-03` | `http://127.0.0.1:8089` | `.google-agente/slots/03` |

Imagem fixada: `gosom/google-maps-scraper@sha256:e205c02913c5a69c16fc2094b8e5b194a2f655166d2c1126d50548d216e6b1b2`. Cada motor usa `-web -data-folder /gmapsdata -c 2`, limite de memória 2 GiB, CPU 2 e até 512 processos. Usar os mesmos parâmetros de swap e shm do ensaio validado: swap total de 2,5 GiB e shm 64 MiB. Não atualizar imagem automaticamente.

O primeiro motor mantém container e volumes atuais; alterações de limites somente quando estiver ocioso. Os outros recebem volumes de dados separados. O cache de binários do Playwright pode ser compartilhado com escrita pela mesma imagem pré-aquecida; sessões e resultados de jobs ficam separados. Configuração dos caminhos dos navegadores segue a instalação que passou no teste. Falha no pré-aquecimento impede admitir trabalho novo.

Preparação idempotente, sem apagar ou substituir recurso em conflito. Conferir nomes, imagem, portas em loopback, volumes, argumentos e limites antes de iniciar. Nenhuma porta pública. Um container existente com configuração divergente gera diagnóstico, não recriação silenciosa.

A ponte recebe `--motor 01|02|03`, resolve exclusivamente o registro e persiste a associação no contexto do job. Não aceitar URL arbitrária vinda do planejamento. Arquivo antigo sem motor pertence somente ao 01. Retomar em outro motor deve falhar antes de qualquer POST.

Trocar o lock global V2 por lock da execução e lock do motor. O motor 01 também respeita a campanha legada para não colidir com coleta manual antiga. Cada subprocesso carrega a configuração isoladamente; não compartilhar os globais mutáveis do coletor entre threads.

Tratar JSON `null` do endpoint de listagem de jobs vazio como lista vazia. Outros formatos inválidos continuam sendo erro. Persistir intenção antes de criar job. Em resposta incerta, procurar o mesmo nome e critérios nesse motor e reconciliar; não criar outro job. Logs e downloads devem vir do container e job vinculados.

## RAM e falhas

Escolha conservadora do implementador, baseada no ensaio: exigir pelo menos **5.632 MiB (5,5 GiB) de RAM física disponível no Windows** antes de admitir uma nova onda de coletas. Essa é margem operacional inicial, não garantia para qualquer nicho. Medir RAM do host e conferir Docker/WSL; memória livre dentro do container não substitui a medição do Windows.

O coordenador agrupa as posições prontas e faz uma verificação imediatamente antes de iniciar seus novos jobs. Não aplicar a checagem depois de abrir só o primeiro motor e usar a redução causada por ele para impedir os outros da mesma onda. Retomadas de jobs já existentes não enviam novo POST.

Se a medição falhar, informar que não foi possível medir a RAM e suspender a admissão. Abaixo do limiar, registrar RAM medida, exigida, horário e posições pendentes; avisar que precisa de mais RAM e encerrar a admissão. Não reservar novos pedidos nesse caso. Não reduzir o paralelismo para tentar passar pelo bloqueio. Uma onda pode conter menos de três vendedores somente por haver menos planejamentos elegíveis, nunca como contorno de falta de RAM.

Durante as coletas, monitorar RAM; abaixo de 512 MiB disponíveis, interromper a admissão de novas coletas, registrar alerta e preservar os jobs iniciados. Não apagar job/volume, não matar o Docker nem reiniciar coleta. Os trabalhos já iniciados podem finalizar e ter seu estado registrado; se não for possível confirmar, ficam pendentes para reconciliar na próxima execução. Um OOM ou saída do motor também exige reconciliar o mesmo job antes de criar qualquer outro.

Ações sem novo navegador, como reconciliar um retorno confirmado, arquivar resultados já coletados e concluir uma publicação, podem terminar mesmo com admissão suspensa. A nova execução não libera por idade uma intenção pendente. Também não muda data, vendedor ou região para escapar do problema.

## Coordenador, workflow e Drive

O coordenador mantém um lock de processo por execução global, incluindo enquanto aguarda o Drive. Uma segunda invocação não pode disparar os mesmos trabalhos. Recuperação de lock somente após provar que o processo proprietário encerrou, preservando journal, IDs e intenções; nunca por timeout cego. O teste cobre PID reutilizado e duas tentativas de retomada simultâneas. O implementador escolhe o mecanismo de lock compatível com Windows, sem dependência nova.

O processo emite solicitações de arquivamento correlacionadas e aguarda comprovantes locais; o agente usa o conector Google Drive já configurado. Um sinal só pode liberar a posição cujo pedido/execução/lote/solicitação correspondam. Comprovante atrasado, repetido ou de outro lote não libera publicação.

Antes de qualquer criação no Drive, registrar intenção exclusiva. Resposta perdida exige procurar e conferir o mesmo arquivo/pasta; não reenviar cegamente. Conservar a pasta raiz CRM, compartilhamentos e a conferência por download de bytes e SHA256, além de ID, nome e pasta. URLs temporárias só por entrada privada, nunca em argumentos, logs, journal ou mensagens. CSV original de nove colunas, JSON das verificações e CSV bruto completo continuam obrigatórios.

Os executores estáveis e as intenções atuais de `.google-agente` permanecem na posição 01. Os outros dois criam e conservam identidades próprias antes do primeiro POST. O journal acrescenta apenas associação/etapa, não substitui os comprovantes existentes. Reinício retoma primeiro as posições pendentes e só depois admite trabalho novo.

`agente.mts verificar` continua sendo a implementação única: critérios neutros não fazem HTTP; critérios escolhidos usam o workflow `gITBY7vBYNfgUWMp`. Campos diferentes combinam E; alternativas do mesmo campo combinam OU. Não criar workflow por vendedor. Testar correlação de respostas fora de ordem, incluindo uma falha, sem enviar mensagens ou gastar consultas CNPJ.biz. Produtos, tipo de empresa e observações livres continuam não confirmados até haver qualificador.

## Entrega e ativação

Implementar em passos com teste falhando primeiro. Validar banco isolado, três posições com servidores falsos e workflow com entradas controladas. Exigir revisão independente do conjunto antes de alterar produção. Não tratar o ensaio de motores como validação do fluxo CRM/Drive/n8n.

Após os checks: guardar backup, conferir ambiente e execuções abertas, aplicar migração nova, publicar o código correspondente e preparar motores sem substituir o original. Pausar a automação existente durante essa janela e reativar somente depois de conferir versões e retomadas. Atualizar o prompt da mesma automação, preservando identidade, horário e preferências de notificação.

Se não existirem três planejamentos reais preenchidos pelos próprios vendedores, a validação de três entregas fica em ambiente isolado. Não criar planos reais por conta própria nem inserir empresas nas listas reais como teste. Em produção, processar apenas pedidos elegíveis já autorizados pelo planejamento.

Reversão operacional: suspender novas admissões e a automação, preservar tudo que começou e reconciliar. Não recolocar o índice singleton enquanto houver mais de uma execução aberta; não reverter migração apagando dados. O caminho legado permanece disponível para drenagem, sem operar simultaneamente com V2.

## Critérios de aceite

- Quatro reivindicações simultâneas admitem exatamente três vendedores; mesmo executor retoma o mesmo pedido, sem duplicar vendedor/data.
- Gestor errado, executor divergente e snapshot editado não alteram a execução existente. Execução V1 permanece isolada.
- Vendedor com sincronização pendente não impede iniciar os demais sincronizados. Falha de uma posição não cancela entregas das outras.
- Mesma empresa nas entregas concorrentes fica com um destinatário; dados manuais, carteira e reservas passam pelos testes existentes.
- Três motores diferentes coletam em paralelo; o mesmo motor não aceita dois produtores. Motor incorreto e intenção incerta bloqueiam novo POST.
- RAM insuficiente gera alerta e zero novos pedidos/jobs. Não há fallback sequencial nem fechamento automático de aplicativos.
- Retomada conserva executor, pedido, execução, motor, lote, snapshot e recibos, inclusive depois de queda entre upload e confirmação.
- Workflow único correlaciona três entradas; respostas fora de ordem e falhas não misturam empresas. Critérios neutros mantêm zero chamadas.
- Sem novidade, a rotina encerra antes de três lotes. Não promete 150 coletadas nem 50 entregues quando a região não oferece isso.

Decisões técnicas deixadas ao implementador: decomposição interna do coordenador, mecanismo Windows de exclusão/recuperação de processo e formato versionado do journal, desde que os contratos e casos de aceite acima sejam testados. Não alterar decisões de negócio ou contratar serviço novo para resolvê-las.