# Conferência da galeria de painéis

Conferência concluída em 06/11/2026. Proposta iniciada em 05/11/2026, sobre a base d830a53.
Somente documentação e mockups locais. Não é homologação de produção.

## Verificações executadas

- Sintaxe dos arquivos gallery.js, mockup.js, catalogue.js e preview-server.mjs com node --check.
- Resposta HTTP 200 de index, mockup, estilos, scripts e README no servidor local.
- Teste existente src/docs.test.ts para a documentação e verificação de espaços do Git.
- Leitura independente da spec e do inventário, sem pergunta de produto essencial não respondida. Aprovação visual por área continua pendente.
- Revisão manual no navegador, com iframe de desktop e de celular, temas claro e escuro.

## Jornadas visuais conferidas

| Exemplo | O que foi observado |
| --- | --- |
| Meu dia | Início sem seleção; abrir retorno; Próximo passo/Histórico; expansão da linha do tempo |
| Celular | Viewport interno de 390 x 844; cabeçalho no topo 0; rodapé no limite 844; largura do documento 390 |
| Funil / Sem interesse | Três exemplos fictícios, três botões Devolver e acesso ao arquivo geral |
| Banco | A busca sem resultados abre seu próprio detalhe com 0 retornadas; Voltar restaura o histórico de buscas |
| Critérios | Quatro abas e campos organizados; exemplo da aba Evitar com situação no Google |
| Carteira / venda | Conferência central por teclado; Cancelar fecha a confirmação e preserva 1250,00 no formulário de exemplo |
| Descarte | Fechar formulário alterado abre confirmação; Continuar editando fecha só a confirmação e preserva o valor |
| Gestor | Campos de Novo usuário e painel Renomear lista presentes |
| Nova senha | Nenhuma credencial visível antes da confirmação; depois aparece somente EXEMPLO-SEM-ACESSO |
| WhatsApp | Imagem SVG fictícia visível na lateral; nenhuma mídia privada carregada |
| Resposta perdida | Aviso de resultado incerto, dados ilustrativos preservados e ação Confirmar envio anterior |

A conferência encontrou e corrigiu dois problemas do próprio protótipo: buscas distintas abriam o mesmo exemplo; Cancelar da confirmação era interceptado pelo bloqueio genérico de submit. Não eram alterações ou falhas diagnosticadas no CRM publicado.

A revisão independente também levantou a ordem de entrega de senha; a definição em tempo de execução já evitava exibição antecipada. A definição original da cena foi consolidada para tornar a sequência explícita, e o navegador confirmou ausência de credencial antes de confirmar.

## Limites e avisos

- Não foram executados banco, RLS, ações reais, reenvio real, rede lenta real ou reload de comandos reais. Os estados da galeria são desenhos interativos.
- Nem todas as combinações de resultado do FormularioContato, todas as confirmações administrativas ou leitor de tela foram ensaiadas. A implementação futura precisa desses testes em ambiente isolado.
- O navegador capturou uma mensagem de MutationObserver sem origem informada. A varredura dos arquivos da galeria não contém uso dessa API; a origem não foi determinada. Não usar esse aviso para afirmar defeito no CRM.
- Trocar um cenário da galeria ou o tema reinicia a simulação daquele exemplo. Isso não define o contrato de preservação de estado do produto.
- A confirmação nativa de saída/reload do navegador continua sendo uma exigência futura; o protótipo não a substitui.
- Não houve consulta autenticada de gestor, alteração de usuário ou acesso a mídia, contatos e vendas reais.

## Continuação

Revisar o desenho de cada área com o usuário e registrar as decisões na spec. Somente depois preparar o plano de implementação, testes, PRs e aprovação de publicação.
