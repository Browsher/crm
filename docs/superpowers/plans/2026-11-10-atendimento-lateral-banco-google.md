# Atendimento lateral nas buscas do Banco e nas entregas do Google

## Escopo aprovado

Iniciar, continuar ou retomar um atendimento abre o editor lateral a partir dos resultados novos do Banco, do carrossel de Últimas buscas e dos cards das empresas em uma entrega do Google. O comportamento se aplica quando a ação comercial resolve para atendimento. Destinos já definidos para Funil, Carteira e Sem interesse continuam com suas regras atuais.

O atendimento de um resultado novo substitui o conteúdo do painel de resultados, como no Histórico do Banco. Fechar recupera os resultados, a rolagem e o acionador. Nos outros dois acessos, a página e os cards permanecem montados sob a lateral. Fechar conserva a seleção do carrossel ou a página e semana da entrega, além do foco e da posição quando o card continua disponível.

## Implementação e verificação

- [x] Ligar os resultados novos à leitura autorizada já usada no Histórico do Banco. Atualizar os resultados persistidos sem repetir a busca nem reabrir o painel após fechar.
- [x] Reutilizar o editor e sua proteção de saída em Últimas buscas e nas entregas do Google. Validar a empresa na origem e na sessão do vendedor. Preservar os comandos existentes e sua recuperação, descartar leituras atrasadas e manter um painel por vez.
- [x] Reproduzir a navegação antiga nas três origens em navegador com dados fictícios.
- [x] Conferir desktop, celular, rolagem/foco, troca de página, descarte de rascunho e recuperação de resposta perdida. Conferir também Histórico do Banco e Localizar empresas, que já abrem na lateral.
- [x] Revisar separadamente a implementação e rodar as verificações locais. A entrega exige PR com CI aprovado. Merge e publicação ficam para uma autorização posterior.
