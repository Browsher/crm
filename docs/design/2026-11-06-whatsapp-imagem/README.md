# WhatsApp: imagem e legenda no painel lateral

Data: 06/11/2026. Comparação visual local, usando a ilustração já existente na galeria.

## Decisões anteriores

O perfil do vendedor foi aprovado na opção C: identificação e indicadores na página, Empresas e Atendimentos em consultas laterais e 50 empresas por página. CNPJ deve permanecer como texto selecionável para consulta manual.

O conteúdo dos painéis já foi aprovado. Menu interno é usado para várias seções; tarefas curtas abrem diretamente. Ações aplicáveis ficam no rodapé e confirmações curtas no centro.

## Itens do gestor conferidos antes desta rodada

Novo usuário, entrega de senha e Renomear lista já têm conteúdo na galeria e seguem o padrão de tarefa curta direta. Não criar novas comparações de menu para esses formulários.

A revisão de app/empresas/grupos/controles.tsx confirmou os textos legados de reserva e descanso. A pendência de adequar essas mensagens ao contrato vigente continua registrada para a implementação; não é uma regra comercial aprovada nesta comparação de mídia.

## O que estamos decidindo

Somente a relação entre imagem e legenda ao Ampliar imagem. O conteúdo continua como uma consulta direta na lateral, sem abas ou menu interno.

### A · Imagem e legenda juntas

Opção A aprovada pelo usuário em 06/11/2026, com o pedido adicional de um botão Ampliar imagem.

Imagem contida no corpo, com legenda logo abaixo quando existir. Os dois compartilham uma única área de rolagem. Fechar permanece no cabeçalho e Ampliar imagem fica no rodapé como controle de visualização, sem comando comercial.

Benefício: mantém a mensagem visual e seu texto na mesma sequência de leitura.
Custo: uma legenda extensa pode exigir rolar para alternar entre texto e imagem.

### B · Legenda fixa no rodapé

Imagem centralizada e contida no corpo. A legenda ocupa uma área separada no rodapé, sem comandos. Seu espaço tem altura limitada e rolagem própria quando necessário.

Benefício: mantém a legenda separada da área da imagem.
Custo: textos extensos criam uma segunda área rolável e reduzem o espaço disponível para a imagem.

Além dos exemplos curtos, a galeria tem uma legenda longa fictícia em A e B para avaliar esse caso. A ilustração é exatamente a mesma nas duas composições.

## Ampliar imagem

O usuário pediu o botão Ampliar imagem ao aprovar A.

Para tornar o pedido visível, o protótipo usa uma visualização maior na mesma lateral, sem outro pop-up ou mudança de página. A imagem fica sozinha nesse modo; a legenda é preservada para o retorno.

- Ampliar imagem abre a área maior a partir do rodapé.
- O cabeçalho passa a Imagem ampliada e Voltar.
- Voltar ou o primeiro Escape recupera o painel normal, a legenda, a posição de leitura e o foco no botão de ampliação.
- Um segundo Escape, no modo normal, fecha e retorna à conversa.
- Reabrir a imagem a partir da conversa começa no modo normal.
- No desktop a lateral pode crescer até 1100 de largura; no celular conserva a tela inteira e permite rolar a imagem maior para os lados.
- O canvas de leitura tem mínimo de 720 de largura, como escolha de composição do autor para demonstrar detalhes em telas pequenas. Não é aumento de resolução nem transformação do arquivo.

A ampliação usa o mesmo SVG de exemplo, sem alteração da imagem e sem nova requisição. A implementação real continua usando somente o arquivo já autorizado e carregado.

## Fonte e contexto

Fonte lida nesta rodada: app/whatsapp/midia-mensagem.tsx.

- O acesso continua por Carregar imagem e depois Ampliar imagem, conforme os estados atuais.
- A prévia já tem a ilustração fictícia embutida; não simula uma requisição a mídia privada.
- Preservar a autorização por conversa e fonte, carregamento manual, abortar requisições pendentes e liberação do blob quando aplicável.
- Fechar ou Escape deve recuperar a mesma conversa, fonte, posição e acionador.
- A legenda só aparece quando existe na mensagem. Não criar texto ou legenda para mídias reais.
- Manter imagem sem corte, respeitando proporções.
- Áudio conserva seu player e documentos conservam o download atual. Não adicionar galeria, navegação entre arquivos, transcrição, envio ou comandos de download da imagem nesta rodada. A ampliação solicitada muda apenas a visualização.
- Preservar os estados de carregamento, erro, arquivo indisponível e acesso não autorizado na implementação posterior.

## Limites da prévia

A imagem é o SVG fictício de equipamentos já usado na galeria. Não foi editado nem carregado um arquivo do WhatsApp. As legendas são exemplos de organização, sem mensagem ou pessoa real.

Fechar e reabrir recupera o mesmo card demonstrativo de conversa. Não é teste de mídia privada, blob real, conversa paginada, fontes diferentes ou rede.

A legenda fixa de B é uma área informativa; não reabre a decisão de pôr ações no rodapé dos formulários.

## Prévia

- A: http://127.0.0.1:4338/?area=imagem&view=integrada
- B: http://127.0.0.1:4338/?area=imagem&view=separada
- A com legenda longa: http://127.0.0.1:4338/?area=imagem&view=integrada-longa
- B com legenda longa: http://127.0.0.1:4338/?area=imagem&view=separada-longa

## Situação

Composição aprovada: A, imagem e legenda juntas, com botão Ampliar imagem. A alternativa B permanece como referência não escolhida. Nenhuma mídia privada ou operação real foi acessada.
