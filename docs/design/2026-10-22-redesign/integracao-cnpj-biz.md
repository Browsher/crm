# CNPJ.biz integrado ao redesign

A branch `codex/redesign-crm` incorpora a implementação do PR #56, commit
`b4ea0a2d0a7f8c72351e55b090070ea3761ebcaf`, a partir do redesign `4b50b43`.
O checkout compartilhado do outro chat permaneceu intacto. Cliente da API,
serviço e migrações do PR #56 não foram alterados.

## Acesso e composição

- Vendedor: **Prospecção → Buscar empresas** (`/fila/buscar`). **Localizar
  empresa** permanece no cabeçalho. As fontes Google e banco de dados usam
  links reais e estado na URL.
- Gestor: **Empresas → Busca de empresas** (`/empresas/busca`), com conexão,
  limites por vendedor, pausa, critérios e histórico.
- Fichas: dados cadastrais no perfil de Localizar e dentro da aba de dados
  da Carteira e da ficha administrativa, após autorização. A função SQL
  continua mascarando telefones conforme posse, reserva e papel.

As telas usam CabecalhoPagina, Card, Button e controles do redesign, tema
por área, foco visível e grade responsiva. UUIDs, FormData, ações e estado
permanecem sob os mesmos contratos.

## Prévia local

O harness `scripts/e2e/run.mts` prepara bancos `teste_<12 hex>` no Postgres
local. O vendedor `redesigne2e@teste.local` recebe limite fictício de 20,
uma consulta concluída, lista Google e metadados de um cliente da carteira.
O gestor é `gestore2e@teste.local`. Senha de ambos: `Senha-e2e-2026`, somente
nesses bancos de demonstração.

O mock HTTP retorna duas empresas sintéticas, uma com telefone e outra
somente com email. O preload é passado explicitamente apenas ao subprocesso
Next do harness. Recusa banco remoto ou não descartável, chave diferente
da fictícia e mock fora do loopback; intercepta apenas as duas operações
do cliente CNPJ.biz. Não existe configuração de endpoint na aplicação de
produção. As páginas identificam dados e consultas como simulados.

É possível consultar pelo formulário real, conferir, selecionar, importar
e navegar para a lista criada. A cota conta empresas solicitadas; atualizar
o resultado não faz nova chamada. O mock retorna as mesmas duas empresas
para diferentes filtros; a palavra `falha simulada` simula falta de créditos.
Isso não representa a base ou o saldo reais do fornecedor.

## Evidência e revisão

`busca-empresas.spec.ts` e `busca-redesign.spec.ts` cobrem fontes, importação,
pausa, histórico, dados nas abas, 390/1440 px e dois temas. A jornada de
consulta também mede chamadas antes/depois de refresh e confere o resultado
persistido. Importar não transfere posse: a passagem à Carteira nesse teste
usa fixture explícita; as jornadas de reserva cobrem o atendimento.

[Capturas](cnpj-biz/README.md). [Validação geral](validacao.md).

Revisão independente, contexto novo, somente leitura, por `gpt-6-astra`,
intervalo `4b50b43..d6cfdf7`: nenhum Critical/Important. Conferiu cliente,
serviço e migrações contra o PR #56, guardas, máscara SQL, UUID e isolamento.
Um Minor adiado: palavra/cidade sem espaços, até 100 caracteres, podem
ultrapassar o resumo dos filtros em 390 px. Não entrou em passe de correção,
conforme o processo de execução.

A revisão não certifica tarifação/retorno real do fornecedor, nova execução
do coletor Google, campanhas, infraestrutura remota nem reabre a revisão
do redesign anterior à base.

## Produção

Nenhuma consulta paga nem ativação remota foi realizada. Migrações 0038/0039,
chave `CNPJ_BIZ_API_KEY` no servidor e liberação de limites pelo gestor seguem
necessárias para ativar em produção. O coletor Google e seu agendamento não
mudaram. Email, campanhas e catálogo recorrente continuam adiados.
