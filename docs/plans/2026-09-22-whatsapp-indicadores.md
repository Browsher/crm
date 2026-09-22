# Indicadores reais de WhatsApp

Escopo aprovado com “Segue”: ativar os quatro cards existentes por Todos/vendedor.
Não implementar filtros de conversa nem vínculo de empresa nesta etapa.

## Regras

- Reutilizar o histórico que o painel carrega; não fazer uma segunda consulta completa.
- Enquanto houver páginas, falha ou consulta parcial, mostrar estado em vez de números.
- Conversas hoje: par fonte/conversa com atividade no dia de Brasília.
- Sem resposta: última mensagem recebida, inclusive pendências de dias anteriores.
- Ativos: fontes de vendedores com envio hoje, sobre fontes de vendedores no filtro.
  Piloto não é vendedor. Grupos e status não são atendimentos individuais.
- Média: respostas enviadas hoje; cada sequência de recebidas começa na primeira
  recebida e encerra no primeiro envio. Envios sem recebida anterior não contam.
- Tempo útil: segunda a sexta, 9h às 18h em America/Sao_Paulo, conforme mockup.
  Feriados não são descontados. Sem pares respondidos, mostrar “Sem respostas hoje”.
- Deduplicar por fonte/conversa/id, ordenar cronologicamente e ignorar datas inválidas
  ou posteriores à referência da consulta. Métricas limitadas ao histórico disponível.

## Plano de execução

1. Teste unitário falhando para agregação por fonte, fuso, sequência, fim de semana,
   ausência de respostas, duplicatas, grupos e histórico vazio.
2. Implementar cálculo puro em src/lib/whatsapp-indicadores.ts.
3. Teste DOM falhando: cards aguardam carga, revelam números e reagem a novas mensagens.
4. Reutilizar VisaoGeralWhatsApp no painel com dados acumulados e estado de completude.
5. Validar suíte WhatsApp, typecheck, lint e build; commit local na branch atual.
