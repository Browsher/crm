# Consultar buscas em pop-up

Pedido: abrir as informações das empresas sem atualizar a página, com cards shadcn e opção Ver mais. A mudança segue o pedido direto e o fluxo de implementação nesta conversa com revisão independente.

## Comportamento

- Ver busca no histórico abre Dialog shadcn, preservando URL, formulário e rolagem da página.
- Abertura lê exclusivamente a busca persistida, com sessão e RLS atuais. Não chama fornecedor, reserva, importa nem consome limite.
- Exibe nome, fornecedor, data, vendedor quando gestor, quantidade solicitada/retornada e filtros usados em card expansível.
- Estados de carregamento, falha com tentativa de leitura, busca em processamento e resultado vazio permanecem claros.
- Cada empresa tem resumo com nome, CNPJ, localização e contatos. Ver mais revela cadastro, endereço com CEP, contatos, atividades/tributação e nomes/funções dos sócios. Campos ausentes dizem Não informado.
- Usa somente dados normalizados já persistidos. Documentos e representantes de sócios continuam exclusivos do gestor, reutilizando SociosGestor no servidor.
- Seleção, importação, bloqueios por pausa/repetição/telefone e confirmação continuam funcionando dentro do pop-up para vendedor. Gestor continua com consulta e acesso à lista importada.
- Links antigos com ?busca= continuam válidos como página de consulta. Nova busca mantém o fluxo atual.

## Visual e acessibilidade

Preservar o tema do CRM: Segoe UI, fundo #fff / #1c242d, texto #202a35 / #e6ebef, borda #e1e5e9 / #34404d e verde #17634d / #8fd0b9. Dialog largo limitado à viewport, cabeçalho fixo e conteúdo rolável, cards alinhados à esquerda em duas colunas no desktop e uma no celular. Sem nova paleta ou dependência.

Botões explícitos para abrir/expandir. Título e descrição acessíveis, foco contido no Dialog e devolvido ao gatilho, Escape para fechar, foco visível, rolagem contida e respeito a movimento reduzido. Expansões de leitura continuam disponíveis mesmo com importação pausada.

## Limites

Não alterar migrações, permissões, filtros pagos, limites de 100/dia, Google, n8n, planilha ou cadastro manual. Não executar busca real para validar interface.
