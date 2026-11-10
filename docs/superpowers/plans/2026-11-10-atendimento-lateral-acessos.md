# Entradas do atendimento lateral e fechamento da ficha

**Objetivo.** Completar a abertura lateral no percurso Prospecção, Localizar empresas, Banco de empresas, e simplificar o fechamento da ficha de cliente.

## Localizar empresas

- [x] Reproduzir em teste o clique em Iniciar atendimento na consulta filtrada. Após confirmar o comando existente, usar a lateral quando o destino autorizado for Atendimento. Aplicar o mesmo caminho à retomada que retorna esse destino.
- [x] Reaproveitar a rota lateral já usada por Continuar atendimento e as guardas de rascunho, envio e recarga. Manter os destinos Funil, Carteira e Sem interesse, a rota direta e os consumidores de fora de Localizar empresas.
- [x] Verificar o fechamento no desktop e em tela de celular, a pesquisa e página de origem e a recuperação de um comando com resposta perdida. Restaurar o foco ao botão equivalente quando a empresa ainda está na lista, ou ao título da lista quando saiu do recorte.

## Carteira

- [x] Reproduzir na ficha lateral aberta pela URL direta a presença do link Voltar para a carteira junto do botão Fechar.
- [x] Retirar esse link do corpo da lateral. Fechar continua usando a guarda atual e recupera o filtro da Carteira. Preservar a navegação da ficha em página inteira e a origem Meu dia.

## Entrega

- [x] Executar testes focados e jornadas com banco isolado, revisar as duas mudanças e abrir PR para `main`.
