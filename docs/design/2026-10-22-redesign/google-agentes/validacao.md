# Validação dos agentes e da planilha

## Implementação antes da revisão

BASE `7b92660`, branch `codex/redesign-crm`. O usuário aprovou explicitamente
agente por vendedor, planilha/equipe compartilhadas, dias móveis, execução
inline, prévia e revisão independente.

- Banco novo: ausência dos objetos observada RED; integração Google 30/30
  após a migração, incluindo identidade do executor, pausa, privacidade e
  revisão transacional. Intenção de escrita também observada RED → GREEN.
- Cliente Sheets: ausência do módulo observada RED; sete testes confirmam
  assinatura OAuth, RAW, aba/linha divergente, resposta incerta e readback.
- Serviço: ausência observada RED; quatro integrações com banco real e
  fornecedor simulado confirmam gravação, retomada, destino e concorrência.
- Executor: protocolo sem identidade e CLI real observados RED; unidade17/17
  com cliente, subprocesso e dez casos Python. Nenhuma coleta foi iniciada.
- UI: datas, novas visões e sincronização observadas RED; unidade20/20 e
  integração34/34 aprovadas. Typecheck e lint aprovados.
- Jornada nova observada RED contra o build anterior: faltavam os títulos
  da agenda móvel e dos agentes. Isolamento Google observado RED → GREEN:
  cinco testes impedem herdar credenciais e rejeitam preloads fora do harness.

Verificações completas desta versão:

- Unidade: **1.415 aprovados e um ignorado**, 1.416 no inventário real.
- Integração: **638 aprovados e um ignorado**, em bancos locais descartáveis.
- Build de produção E2E, typecheck, lint, convenções de migração e
  `git diff --check`: aprovados.
- Navegador: **64/64 jornadas aprovadas**, incluindo os dois cenários novos
  com OAuth/Sheets locais e preservação das jornadas CNPJ.biz.
- Capturas novas: vendedor em desktop e 390 px escuro, gestor em desktop.
- Prévia local reiniciada com o build aprovado, banco descartável e
  fornecedores fictícios. No navegador, a conta sintética de relacionamento
  salvou Armarinhos e variedades, Brás, São Paulo/SP para 23/10. A agenda
  confirmou os critérios e “Sincronizado com a planilha”.

O inventário foi extraído do JSON da execução completa aprovada, sem inferir
nomes nem contagem. Os dois testes ignorados já pertenciam à suíte anterior.
Nenhuma planilha, chave, permissão, automação ou migração remota real alterada.

## Decisões do executor

1. `Ruling:` seguir do desenho aprovado diretamente pelo plano derivado,
   conforme autorização explícita para implementar aqui. Custo se incorreto:
   ajustar a divisão técnica das tarefas.
2. `Ruling:` persistir a matriz da intenção antes do HTTP e aceitar somente
   conteúdo de linha conhecido na retomada. Isso protege resposta incerta e
   edições manuais divergentes. Custo: auditoria por revisão e uma transação
   local adicional.
3. `Ruling:` perda de transporte ou queda do processo mantém uma reserva
   durável de envio até comprovar o encerramento da operação anterior.
   Leitura momentânea não impede PUT tardio. Custo: reconciliação operacional
   manual e menor disponibilidade para esse pedido.
4. `Ruling:` permissões e comportamento dos serviços reais ficam para a
   ativação controlada aprovada. Testes fictícios não validam credenciais
   reais. Custo se incorreto: configuração e aceitação real adicionais antes
   de liberar a rotina.
5. `Ruling:` aceitar a fronteira da aba administrada pelo CRM, sem edição
   estrutural/manual concorrente. A API não oferece atualização condicional
   atômica da linha; escritas do CRM serializam e divergências detectadas
   bloqueiam. Custo se incorreto: conflito manual durante HTTP pode exigir
   reconciliação.
6. `Ruling:` renomeação direta no banco permanece uma operação administrativa
   fora dos fluxos entregues. IDs e critérios continuam sendo a autoridade.
   Custo se incorreto: renomear pode deixar o espelho pendente de conferência
   técnica.

## Revisão independente

Revisão fresca por `gpt-6-astra`, esforço alto, somente leitura, sobre
`7b92660..96d9d3b`. Nenhum Critical e nenhum Minor adicional. Veredito inicial:
**With fixes**, três Important, aceitos pela consequência para o usuário:

1. PUT antigo após perda de transporte podia terminar depois da revisão
   posterior confirmada. Teste com aplicação tardia observou sincronizado
   incorreto (RED). Agora a reserva antecede HTTP e sobrevive à incerteza;
   a revisão posterior fica pendente sem novo PUT (GREEN).
2. Desativação do vendedor ou gestor durante espera pela sincronização e
   promoção durante espera do planejamento foram reproduzidas (três RED).
   Locks de usuário e revalidação de papel tornaram os três GREEN. Corrige
   também o Minor adiado no relatório Google anterior.
3. Pasta legada com o mesmo job rejeitava a introdução de `executor` e
   `revisao`. Retomada completa em arquivos temporários observou RED; agora
   conserva o job e aceita os metadados novos, recusando troca de vendedor
   ou critérios (GREEN, 11 casos Python).

Passagem única de correções pelo implementador: 38 integrações Google,
44 unidades de cliente/invariantes e 11 casos Python aprovados. Suítes
completas posteriores: **1.415 unidades aprovadas e uma ignorada** em todos
os 164 arquivos, **642 integrações aprovadas e uma ignorada**, **64/64
jornadas**, build/typecheck, lint e convenções aprovados. Não houve re-review.

Uma rodada unitária anterior saiu com código 1 e omitiu a galeria antiga,
embora o JSON dissesse sucesso. O inventário detectou a ausência; a rodada
foi descartada. A galeria passou isoladamente 10/10, sem mudança, e a suíte
inteira acima foi repetida com reporters normal e JSON, log integral e
código 0. O inventário final veio dessa execução completa.

A prévia foi reiniciada após as correções e o mesmo exemplo de critérios foi
salvo e confirmado novamente no navegador, somente contra serviços locais.
Os checks remotos da revisão final são consultáveis no PR #55; nenhuma
migração ou ativação remota integra esta validação.

O revisor deixou três comportamentos em “Declined to judge”: ativação dos
serviços reais, alterações manuais concorrentes e renomeação direta de
usuário. As decisões 4–6 acima tratam todos eles. Nenhum Minor novo adiado.
