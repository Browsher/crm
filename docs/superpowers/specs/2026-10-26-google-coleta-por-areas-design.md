# Coleta Google por áreas para o ensaio de 3 x 150 candidatas

## Objetivo e autorização

O usuário autorizou liberar mais RAM, ajustar a coleta e repetir o ensaio de três
lotes de 50 candidatas por vendedor, com três perfis isolados e revisão independente.
A entrada inicial do ensaio anterior foi 5961 MiB; uma nova onda foi bloqueada a
5304 MiB. Foram analisadas 39/59/57 candidatas em cinco lotes. Nenhum OOM foi
registrado, mas o motor 02 atingiu repetidamente o limite de memória do cgroup.

## Decisões e escopo

A implementação será uma opção operacional `coleta_por_areas: true` na configuração
da campanha. Ficará habilitada somente na campanha privada do novo ensaio. Nenhuma
migração, endpoint, interface ou workflow n8n será modificado. A campanha real,
planejamentos, listas e planilha da equipe permanecem preservados. Defaults do
coletor existente continuam válidos. Nenhum limite de RAM será reduzido.

Quando o pedido V2 abranger cidade inteira (bairro vazio), a opção produz quatro
URLs Google Maps de busca por coleta, com o mesmo texto literal de nicho, cidade,
UF e termos adicionais. A localização varia numa grade determinística dentro do
raio configurado. Cada rodada usa quatro centros diferentes; máximo de 12 centros
nas três coletas. Passo em metros = min(raio/3, 3000); pontos fixos por rodada:
1: (0,0),(1,0),(0,1),(-1,0); 2: (0,-1),(1,1),(-1,1),(-1,-1);
3: (1,-1),(2,0),(0,2),(-2,0). Coordenadas finitas, latitude válida e raio positivo
serão validados. A mesma imagem fixada, dois trabalhadores e 2 GiB por motor
continuam em uso. Bairro informado ou contrato V1 preservam a consulta única.

Suporte às URLs foi conferido no código da revisão 549e4b5e61c7103685ef8392f246ebdba783ed03
(v1.18.1), que corresponde à imagem instalada:
https://github.com/gosom/google-maps-scraper/blob/549e4b5e61c7103685ef8392f246ebdba783ed03/gmaps/job.go

O texto não é executado no shell. URLs são geradas pelo programa, com host Google
fixo e consulta codificada; o vendedor não fornece URLs operacionais arbitrárias.
Intenção e resposta guardam a versão da estratégia e o corpo exato antes/depois
do POST. Uma criação incerta reconcilia o mesmo corpo no motor e nunca cria outro
job cego. Jobs V2 anteriores com palavra-chave única continuam retomáveis. Um
contexto, motor, termo ou grade divergente impede o POST. Logs correlacionam todos
os input_ids das sementes ao mesmo pedido original.

## Lotes e orçamento

No modo por áreas, antes de reservar um lote, o fluxo consulta um resumo local do
pool: até 50 candidatas distintas ainda não vistas e quantidade nova na última
coleta. Se faltar completar 50 e houver coleta disponível com potencial de
novidades, coleta a próxima área antes de gastar outro lote. Se a última coleta
não acrescentar identidades, processa o saldo parcial e encerra sem novas buscas.
Coleta inicial vazia encerra sem resultados. A terceira coleta permite o saldo
parcial; nunca fabricar empresas para completar 50.

O restante do fluxo permanece nativo: no máximo 3 lotes, 150 candidatas analisadas
e 50 entregues por vendedor/dia. Atingir 50 entregues ou não haver novidades ainda
encerra o pedido. Exclusividade global, RLS, recibos, hashes, Drive e idempotência
continuam com a autoridade atual. Reservas/publicações pendentes são retomadas
antes de decidir novos lotes. O modo legado de lote parcial fica inalterado quando
a opção estiver desligada.

Para evitar crescimento ilimitado do JSON intermediário, a preparação V2 do modo
por áreas retém no máximo 150 identidades distintas por coleta depois da prioridade
existente. O CSV bruto original permanece integral e é arquivado exatamente como
recebido. O resumo distingue brutos recebidos de candidatas preparadas. No modo novo, o
intermediário omite raw_rows (cópia redundante); all mantém todos os campos brutos
das candidatas selecionadas e selected mantém o recorte usual de 50. O CSV bruto
continua integral. Antes de gravar, medir os bytes UTF-8 e recusar intermediário
acima de 9.000.000 bytes, deixando a etapa pendente com o bruto preservado. Não
elevar o teto, truncar campos ou substituir prova de download. Novas na última
coleta compara com todas as fontes anteriores, independentemente de vistas.

## E-mail e memória

O padrão segue email:true. Uma opção operacional booleana `coletar_email`, default
true, permite um ensaio de volume sem visitar sites para e-mails apenas se o usuário
escolher essa cobertura reduzida. Nesse caso os perfis do ensaio não exigem e-mail,
e o relatório não afirma validar sua coleta. Nenhuma mensagem WhatsApp é enviada.

A rotina existente será pausada antes de editar scripts compartilhados e restaurada
na mesma configuração após revisão e checks. Antes do teste, fechar somente apps
não essenciais autorizados; preservar Codex, Docker, banco, Drive e serviços de
outros projetos. Admitir onda apenas com 5632 MiB disponíveis, monitorar RAM e
cgroups, manter a fila se faltar memória, sem fallback sequencial ou RAM simulada.
Não reiniciar motores ativos, apagar jobs, trocar volumes ou aumentar limites
para contornar um erro. Os ensaios antigos permanecem intactos.

## Validação e critério de sucesso

TDD: grade/diferença entre rodadas; literalidade e host; input inválido; bairro/V1;
retomada antiga/nova e resposta perdida; recorte e preservação do CSV; pool parcial
complementado antes da reserva; coleta repetida sem novo lote; retomada de reserva
já existente; 3 lotes reais de 50 por perfil, quando houver fonte suficiente.

Depois de unidade, tipos/lint, revisão independente e checks afetados, criar novo
banco local e perfis fictícios. Sem gravações no CRM/planilha reais. Usar Google e
workflow básico reais; provar 9 lotes de 50, 450 analisadas somadas aos perfis,
correlação Drive por execução/lote, isolamento, reenvio idempotente e RAM observada.
Se o Google não fornecer esse volume, houver bloqueio ou faltar RAM, relatar o
resultado como não validado com os contadores reais, sem falsificar conclusão.

## Builder check

Revisão independente do desenho em 26/10: nenhuma decisão adicional do usuário.
Guarda UTF-8 de 9.000.000 bytes e comparação com todas as fontes anteriores
incorporadas como decisões do implementador.
