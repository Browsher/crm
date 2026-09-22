# Mídias no WhatsApp do gestor

Escopo aprovado: visualizar imagem com ampliação, ouvir áudio e baixar documento. O vendedor continua respondendo no celular. Vídeos e envio ficam fora desta etapa.

## Fluxo

O histórico entrega apenas descritores de mídia, sem URL externa, chave ou conteúdo binário. O gestor clica para carregar o arquivo. Imagens mostram miniatura e diálogo de ampliação; áudios usam controles nativos sem reprodução automática; documentos oferecem download. Falhas permitem tentar novamente.

Uma rota autenticada verifica a sessão e o papel gestor a cada pedido. O servidor confirma a mensagem na instância configurada, pelo identificador e conversa, e pede a mídia à Evolution. Não aceita URL ou instância do navegador. Respostas privadas sem cache, tipos de imagem/áudio permitidos e documentos como anexos. Limite inicial de 20 MiB por arquivo, timeout e limite na leitura da resposta. Arquivos antigos podem não estar mais disponíveis. Nenhum arquivo fica gravado no CRM.

## Plano de implementação (TDD)

1. Testar descritores seguros, leitura de mídia, vínculo à conversa, tamanho e falhas antes do adaptador.
2. Testar autorização da rota antes de implementá-la (anônimo, vendedor, senha provisória, gestor).
3. Testar carregamento sob demanda, erro/repetição e liberação de blobs antes do componente.
4. Integrar no painel, preservando atualização, paginação e seleção. Testar regressões, tipos e lint.
5. Validar leitura real sem imprimir mensagens, chaves ou arquivos; registrar limites e commit local na branch da funcionalidade.

## Verificação

- 64 testes passaram para WhatsApp e diretivas do servidor. Tipos, lint dos arquivos envolvidos e build isolado passaram.
- A instância de teste devolveu os três arquivos: imagem JPEG, áudio Ogg e documento, sem expor o conteúdo ou as credenciais no diagnóstico.
- No navegador do CRM, a imagem foi decodificada e ampliada; o áudio foi decodificado com duração e sem erro. O documento gerou link de download, mas o navegador de teste não confirmou o evento de download. Conferir o salvamento no Chrome do usuário.
- Continua somente leitura, com limite de 20 MiB por arquivo. Não há garantia de recuperação de arquivos expirados no WhatsApp.
