# Conferência dos estados na galeria

Data: 06/11/2026. Somente mockup local. O usuário aprovou o padrão após a conferência registrada abaixo.

## Consultas, vazio e edição

- Tentar novamente na falha de leitura recuperou o menu de dados da mesma empresa fictícia, sem formulário de gravação.
- Carregando mostrou três linhas de exemplo, aria-busy verdadeiro e Fechar disponível. Fechar encerrou a consulta demonstrativa.
- Histórico sem registros não teve ação no rodapé. O filtro sem resultados manteve Todos, Atendimentos e Vendas visíveis; Ver todos mostrou três eventos. Atendimentos mostrou dois eventos.
- Conteúdo indisponível usou título Dados da empresa e orientação genérica, sem nome da empresa no painel ou ação para contornar o acesso.
- O rascunho de atendimento continha a anotação fictícia esperada. Sair abriu confirmação A com formulário e empresa destacados. Continuar editando manteve o texto. No celular, Escape abriu a confirmação e o segundo Escape cancelou-a, mantendo o rascunho.

## Envio, verificação e sucesso

- Registrando venda mostrou apenas o resumo enviado, sem campos editáveis. Cabeçalho e botão de envio ficaram desabilitados, aria-busy verdadeiro e Escape não fechou o painel.
- O resumo de Envio sem confirmação foi idêntico ao de Registrando venda. Fechar e Reabrir verificação preservaram o mesmo resumo na memória da prévia.
- Verificar registro mostrou Verificando registro, com ação e saída bloqueadas e aria-busy verdadeiro. Enter no botão funcionou no celular. Não foi produzido resultado fictício de servidor.
- O cenário separado Primeira venda confirmada abriu a ficha de cliente da Carteira, com aviso curto e o menu já aprovado. Histórico permaneceu navegável, com três eventos fictícios.

## Composição e dispositivos

- Conferidos desktop de 1280 e celular de 390 x 844, em claro e escuro para a falha de consulta; resposta perdida visualizada no celular claro.
- Desktop: largura do painel 520, documento 1280 e faixa de erro com altura aproximada 68.
- Celular: painel e documento mantiveram largura 390. Faixa de erro com altura aproximada 87 e botão com altura 44.
- Na resposta perdida do celular, o rodapé terminou em 844 e o botão de verificação mediu 44 de altura. O resumo permaneceu legível, sem transbordamento horizontal do documento.
- Após a conferência, o usuário aprovou o padrão; os estados passam a ser identificados como Aprovado pelo usuário. A prévia foi deixada em Falha ao carregar, desktop e tema escuro.

## Limites

Não houve gravação ou acesso a produção. Os cenários de envio são estáticos, a verificação não consulta servidor e a retomada demonstrada só mantém memória local da página. Não foram exercitados reload com comando real, concorrência, permissões, RLS, recibos reais ou todos os consumidores de vendedor e gestor. Esses ensaios continuam na implementação posterior isolada.

## Verificações dos arquivos

272 testes de documentação aprovados. ESLint da galeria, sintaxe de mockup.js, gallery.js e catalogue.js e git diff --check aprovados. Nenhum arquivo do produto foi alterado.
