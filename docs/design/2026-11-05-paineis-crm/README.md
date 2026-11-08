# Galeria de painéis do CRM

Desenho consolidado em 06/11/2026, após as escolhas individuais do usuário. Somente documentos e mockups locais; o produto não foi alterado.

Base observada: d830a53, PR #73. Branch de documentação: codex/padroes-paineis-mockups. Não afirmar que essa base é a main remota atual sem nova conferência.

## Abrir os modelos aprovados

http://127.0.0.1:4338/?area=revisao-final&view=dia

A galeria reúne Meu dia, Funil, dados da empresa, buscas e critérios, Carteira, gestor, perfil, imagem, confirmações e estados. As áreas de comparação anteriores permanecem como referência; não são escolhas ainda pendentes.

## Padrão escolhido

- Desktop: largura atual A, adaptável e com máximo de 520 px.
- Celular: A, tela inteira, acima da barra do CRM.
- Uma lateral por vez. Várias seções usam menu; tarefas curtas abrem direto.
- Cabeçalho e rodapé fixos; corpo com rolagem própria.
- Confirmações A centrais, com alvo destacado e consequência curta.
- Estados em faixas compactas; distinguir consulta, edição e envio sem confirmação.
- Imagem ampliada conserva a exceção aprovada de área maior na mesma lateral.

## Documentos vigentes

- docs/superpowers/specs/2026-11-05-padronizacao-paineis-crm-design.md: desenho consolidado e contratos.
- docs/design/2026-11-06-revisao-final/README.md: matriz aprovada e proposta de entregas.
- docs/auditorias/2026-11-05-inventario-paineis-crm.md: consumidores atuais e alcance observado.
- historico-revisoes.md: histórico das rodadas, com pendências superadas.

## Usar a galeria

Escolher uma área e um cenário; alternar Desktop, Notebook, Celular e tema claro/escuro. Ampliar mockup abre a prévia sem a moldura. A área Painel no celular começa no celular para comparar as opções antigas; Modelos aprovados usa a base escolhida.

Para reiniciar a prévia, executar node preview-server.mjs a partir desta pasta. O servidor usa somente 127.0.0.1:4338 e serve os arquivos permitidos da própria galeria. Porta alternativa: node preview-server.mjs 4339.

## Limites e próximos passos

HTML/CSS/JavaScript autocontidos, dados e ações fictícios. Sem acesso ao CRM, banco, Google, WhatsApp, e-mail ou autenticação. As datas, CNPJ, contagens e imagem são ilustrativos. A prévia não valida permissões, transações, idempotência, recuperação real ou mídia privada.

Próximo passo: planos executáveis por entrega, com testes e revisão independente. Não há autorização de implementação, PR de produto, merge ou publicação nesta rodada.
