# Atendimento no histórico do Banco

No histórico do Banco de empresas, abrir os resultados de uma busca e escolher atendimento mantém o vendedor na mesma página. Usar o editor lateral de Localizar empresas. Fechar o editor volta aos resultados da mesma busca, na mesma aba, com a rolagem e o foco recuperados. Se a ação do card tiver mudado, focar sua ação atual ou o título dos resultados.

O painel usa a leitura autorizada da busca salva. A empresa precisa estar nos resultados e vinculada ao vendedor. Uma falha de leitura oferece nova tentativa ou volta à busca. A leitura e o retorno usam apenas dados salvos, sem solicitar nova busca ao fornecedor.

A lateral conserva as guardas de rascunho e envio. O início e a retomada continuam respeitando o destino confirmado pelo servidor. Se o destino for Atendimento, abrir o editor. A consulta cadastral, as entradas diretas e os fluxos fora do histórico conservam seus caminhos.

- [x] Reproduzir em navegador o atendimento saindo da busca e acrescentar regressões de fechamento, foco, rascunho e tela móvel.
- [x] Conectar o editor ao painel de resultados e validar o acesso e as leituras de retorno. Testar atualizações de situação e recuperação sem duplicar comandos.
- [x] Conferir o fluxo com banco isolado e revisar o diff. A entrega exige PR com CI aprovado.
