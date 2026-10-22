# Validação do planejamento Google

Implementação na branch `codex/redesign-crm`, a partir de
`d57eda95e428089aacf3bfe8a4f4a2868f355fb8`. Desenho aprovado em 22/10/2026.

## Evidências antes da revisão independente

- Unidade completa: 1.387 aprovados e 1 ignorado, com prazo local de 60 s.
  Após o ajuste do proxy, 15 testes focados passaram, incluindo o caso novo
  de Bearer sem cookie. Os limites padrão do CI não foram alterados.
- Integração completa: 617 aprovados, 5 falhas nas listas explícitas de
  migrações, 1 ignorado. As cinco listas foram atualizadas para incluir 0040;
  os 12 testes desses arquivos passaram depois. A suite Google com paginação
  passou seus 18 testes após a mudança.
- Build de produção para o harness, typecheck, lint e db:checar aprovados.
- Navegador: 62 jornadas aprovadas, incluindo CNPJ.biz, planejamento,
  privacidade por vendedor, gestor, API autenticada, repetição idempotente e
  reserva do lead entregue. Desktop, 390 px e tema escuro exercitados.
- Ponte Python: 8 casos via unidade, com arquivos temporários. Coleta real,
  Google Sheets, Drive, n8n e Evolution não foram acionados por esta entrega.

## Decisões operacionais

- O pedido aprovado autoriza implementação inline sem outra confirmação do
  plano técnico derivado. A produção e a rotina real permanecem pendentes de
  ativação conforme o desenho.
- Até 50 leads são entregues por pedido. Ocorrências excedentes permanecem
  na auditoria, com capacidade de 5.000 registros/8 MB e 50 por página.
  Capacidade insuficiente deixa o lote para conferência, sem descarte silencioso.
- A revisão automática rejeitou remover o caminho legado de listas Google.
  Ele foi preservado e reutilizado para identificar empresas de origem
  Google nas listas compartilhadas anteriores.
- Importações frias de módulos no Windows excederam o prazo de 5 s em testes
  antigos. A verificação local usa 60 s, sem remover asserções ou mudar o CI.

## Capturas

- `google-planejamento-desktop.png`: planejamento com pedido salvo.
- `google-planejamento-mobile-escuro.png`: formulário em 390 px e tema escuro.
- `google-gestor-desktop.png`: pedidos, destinatários e utilização.
- `google-gestor-mobile.png`: auditoria dos resultados com pendências.

Capturas de página inteira podem posicionar barras fixas na posição atual de
rolagem do navegador. A conferência visual da prévia usa também a viewport
real. Todas as empresas, contatos e contas das evidências são fictícios.

## Revisão independente

Será registrada após o parecer de um revisor com contexto novo e os ajustes
necessários. A ativação operacional está descrita em
[operação do agente](../../../operacao/agente-google-crm.md).
