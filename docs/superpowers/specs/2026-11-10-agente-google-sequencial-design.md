# Agente do Google com um vendedor por vez

O agendamento atual usa um coordenador local que pode reivindicar e executar três pedidos juntos. A rotina foi encontrada ativa, mas os três coletores estavam parados. O último registro local consultado marcava a admissão suspensa e zero pedidos pendentes. A medição do Windows retornou aproximadamente 2 GiB livres, abaixo dos 5.632 MiB exigidos no modo paralelo.

O coordenador passa a reivindicar um pedido no motor 01 e a concluir sua coleta, verificação e entrega antes de pedir o próximo. O servidor continua escolhendo a ordem. Mantêm-se o horário das 17h nos dias úteis, o planejamento pessoal, a meta de até 50 entregues, o teto de três lotes e a pausa para dias sem planejamento.

O limiar de entrada passa a 2.560 MiB livres, calculado com o limite de 2.048 MiB do motor e a margem existente de 512 MiB. É uma margem de projeto, a medir em uso real. O agente verifica memória e disponibilidade do motor antes de reivindicar e antes de cada coleta nova. Em memória crítica ou medição indisponível, conserva o trabalho em andamento e suspende novas admissões. Não muda limites dos containers, infraestrutura, API, banco ou volumes.

O journal conserva o formato anterior. Pendências dos motores 01, 02 e 03 são retomadas em sequência no motor e com a identidade originais. Enquanto a etapa do vendedor permanece pendente, o coordenador encerra o ciclo preservando os dados para retomada. Os demais pedidos continuam na fila enquanto forem elegíveis pela regra atual do CRM. Uma pendência longa pode consumir a janela dos vendedores seguintes. Operações que já começaram preservam suas chaves, recibos, resultados e arquivos.

## Verificação e liberação

- [x] Reproduzir o paralelismo anterior em testes simulados e provar que o próximo pedido só é reivindicado depois de concluir o anterior.
- [x] Conferir o limiar de memória, a verificação de um único motor, a retomada dos journals anteriores e a interrupção segura antes de reivindicar outro vendedor.
- [x] Validar com o banco isolado que o mesmo executor conclui três vendedores com uma execução aberta por vez.
- [x] Atualizar o guia da rotina e indicar que o checkout operacional precisa receber a versão integrada antes de usar o modo sequencial.
- [x] Revisar separadamente a mudança. A entrega exige PR com CI verde. Os testes locais usam dados fictícios e não disparam a rotina de coleta.
