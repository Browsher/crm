# Excluir CNPJs já entregues pelo Banco

A busca na Casa dos Dados deve excluir, antes do retorno do fornecedor, os CNPJs de empresas já entregues pelo Banco a qualquer vendedor. A origem inicial do vínculo identifica essas entregas, incluindo vínculos marcados como Sem interesse.

A reserva da busca mantém as regras de permissão, cota e reenvio. Para uma reserva nova, o mesmo comando lê os CNPJs dos vínculos do Banco. A lista fica no servidor e é enviada à Casa dos Dados em `excluir.cnpj` apenas quando preenchida. Os filtros salvos no histórico continuam representando a pesquisa preenchida pelo vendedor.

A checagem durante a inclusão continua cobrindo outras origens, telefone, e-mail e entregas que ocorrerem durante a consulta. Cada busca nova faz uma chamada. Em caso de rejeição do fornecedor, o histórico registra a falha para evitar uma segunda requisição sem exclusões.

Verificar a reserva com vendedores distintos no Postgres de teste e conferir o corpo da requisição com uma resposta simulada da API. A versão anterior do site deve continuar usando a função de reserva existente durante a transição da migração.
