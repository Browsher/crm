# Identificação de contatos no piloto

## Escopo

Correção pontual após diagnóstico e orientação ao usuário: o CRM hoje trata pushName numérico como nome e descarta remoteJidAlt. Exibir nomes não numéricos recebidos e telefone confirmado pelo JID telefônico original ou alternativo. Sem consulta adicional, mudança no WhatsApp ou associação a vendedores.

## Comportamento

- Preservar remoteJid como chave da conversa. Nunca deduzir telefone de um LID nem unir conversas por nome.
- Aceitar telefone de JID individual com sufixo @s.whatsapp.net e 7 a 15 dígitos, começando por dígito não zero. Para LID usar remoteJidAlt quando válido. Ignorar alternativo de grupos.
- No painel escolher o nome não numérico da mensagem recebida mais recente. Desconsiderar nomes de mensagens enviadas.
- Mostrar telefone confirmado no cabeçalho e como título quando não houver nome. Se houver telefones conflitantes na mesma conversa LID, não escolher arbitrariamente.
- Sem nome nem telefone, mostrar Contato não identificado; subtítulo Número não disponibilizado pela integração.
- Manter paginação, atualização automática, somente leitura e guarda de gestor.

## Verificação

TDD: testes do adaptador para telefone original/alternativo e dados inválidos; testes de renderização para nome, código numérico, fallback e conflito. Executar testes WhatsApp, typecheck e lint. Diagnóstico real limitado a contagens sem imprimir conteúdo ou credenciais.
