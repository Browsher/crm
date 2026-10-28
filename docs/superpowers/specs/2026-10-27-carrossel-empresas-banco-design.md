# Empresas recentes do Banco de empresas

Desenho aprovado pelo usuário nesta conversa: Nome em destaque, cards quadrados 1:1, carrossel manual com três por vez no computador, até 11 empresas individuais recentes e último card Ver todas buscas. Grupo de origem, nome e endereço ficam em uma linha com reticências; nome até 36 caracteres e grupo até 40. Somente Cliente aparece como selo quando aplicável. Os demais dados ficam em Ver empresa.

## Fonte e autoridade

Reutilizar prospeccao_pessoal com origem banco, que já ordena por entrada DESC e id e retorna 20 empresas únicas. A entrada mantém a semântica existente de primeiro recebimento; repetir uma importação não transforma a empresa em nova. Cortar em 11 no servidor e no componente. Não incluir candidatas apenas consultadas, listas Google ou vínculos de outro vendedor.

A migração 0048 substitui somente prospeccao_pessoal, conservando contrato de entrada, guardas, paginação, ordenação e demais campos. Acrescenta grupoOrigem ao resumo: nome atual do primeiro grupo de aquisição próprio, ordenado por entrada e nome em empate. Google/carteira sem vínculo banco recebem null. Nenhum novo GRANT, política ou função exposta. Grupo e associação permanecem protegidos por RLS; a função existente resolve o vínculo sob sua guarda nativa.

## Interface

Remover o texto Sua pesquisa fica salva no histórico do rodapé do formulário. Manter Buscar empresas e o pop-up automático de resultados. Logo abaixo, mostrar Todas as minhas empresas, origem Banco de empresas, setas e cards shadcn. Histórico de buscas permanece separado e acessível.

Três cards acima de 670px de conteúdo, dois de 481 a 670px e um até 480px. Sem rotação automática; botões e teclado no grupo de navegação mudam a página. Última posição contém Ver todas buscas, para /fila/localizar?origem=banco. Se houver menos de 11, mostrar apenas as existentes e o card final; sem empresas, informar a ausência e manter o atalho.

Cada card: nome, grupo de origem, bairro e cidade/UF, recebimento em São Paulo, selo Cliente somente se situacao=cliente e Ver empresa. Nunca expor telefone, email ou documento de sócio no carrossel. O botão abre Dialog com nomes completos, grupo, CNPJ, nicho, porte, abertura e localização já autorizados no resumo. Abrir ficha completa leva à rota existente, que conserva suas permissões de contatos e ações.

Nome e grupo completos permanecem no dado e nos detalhes. Truncamento é só apresentação, por caracteres Unicode e CSS ellipsis. Carrossel com região/descrição acessíveis, controles nomeados, foco visível, aviso de intervalo e sem links fora da página atual na ordem de Tab. Respeitar tema e movimento reduzido.

## Visual

Reutilizar Segoe UI, branco #fff / fundo escuro #1c242d, texto #202a35 / #e6ebef, borda #e1e5e9 / #34404d e verde #17634d / #8fd0b9. Nome como primeira informação. Sem números de desempenho ou dados inventados. Não adicionar dependências para paginação manual.

## Verificação e entrega

TDD em integração para grupo, deduplicação, origem e privacidade; DOM para 11+atalho, navegação, limites e detalhes. E2E com dados sintéticos, 1920x1080, 736px e celular, claro/escuro, formato 1:1, refresh/importação sem chamadas adicionais. Revisão independente final. PR55, CI verde, backup criptografado novo antes de aplicar apenas 0048, invariantes/contagens e limites preservados, publicação e conferência do alias. Nenhuma busca paga nem alterações em Google/n8n/planilha.
