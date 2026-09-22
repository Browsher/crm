# Histórico automático do WhatsApp

Desenho aprovado na conversa: recentes primeiro, demais páginas automaticamente
em segundo plano, arquivos sob demanda e atualização dos recentes a cada 15 s.
O histórico permanece na sessão do painel; recarregar a página inicia nova carga.

## Escopo

- Reutilizar cursores por fonte e autorização das actions existentes.
- Buscar sequencialmente com intervalo de 500 ms entre páginas, sem duplicatas.
- Preservar seleção e âncora da leitura; não baixar mídias automaticamente.
- Exibir contagem carregada e total informado, sem tratar total como critério
  de parada: a Evolution determina o fim pelo cursor.
- Pausar novas páginas com aba oculta, offline ou erro. Erro exige nova tentativa.
- Atualizações recentes não reiniciam cursores já concluídos.

## Execução

1. Testes DOM com relógio controlado: páginas automáticas, progresso, fim,
   falha/retomada, aba oculta/offline, seleção e rolagem preservadas.
2. Agendar próxima página no painel; transmitir total da página do servidor.
3. Executar testes WhatsApp, typecheck e lint. Revisar diff e guardar na branch
   existente, sem incluir alterações externas ao escopo.
