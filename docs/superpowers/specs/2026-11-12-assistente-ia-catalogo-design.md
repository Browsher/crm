# Catálogo de produtos no assistente de prospecção

O vendedor escolhe um produto da QS Importação por nome ou SKU, informa onde prospectar e recebe sugestões aplicáveis ao formulário do Google ou do Banco de empresas.

## Produtos disponíveis

A fonte do catálogo é a aba **Produtos** de `dados/catalogo.xlsx`, ao lado da pasta de fotos. A planilha tem 97 registros, com 40 marcados como **Publicar: sim**. As 41 fotos correspondem a esses 40 SKUs e ao `128GB`, marcado como **Publicar: não**. A primeira versão usa os 40 SKUs publicáveis, incluindo o `128GB-V`, que tem o mesmo nome comercial do `128GB`. As duas garrafas para cachorro são variantes ativas e devem ser distinguíveis pelo SKU e pelo material.

Proposta de manutenção: versionar no CRM um catálogo enxuto com SKU, nome comercial, família de prospecção e características úteis para identificar o produto. Atualizar a partir da planilha quando o catálogo mudar. O CRM consulta a ficha pelo SKU no servidor. Claude recebe a ficha do item escolhido e a matriz da família, com os dados comerciais de preço, GTIN, contatos e fotos fora do contexto. O catálogo do CRM funciona sem acesso à pasta do computador.

## Painel lateral

1. **Escolher produto**. Ao abrir, o painel mostra o campo pesquisável por SKU ou nome e a opção **Outro produto**. A lista mostra todas as famílias e agrupa produtos da mesma linha, como as câmeras de segurança. Cada SKU aparece uma vez. O resultado identifica cada SKU no formato “Massageador tartaruga · QS-030”. Ao selecionar, aparece a ficha curta do item e são liberados a região, o refinamento e o botão **Gerar sugestões**. Em **Outro produto**, uma descrição válida libera região e detalhes.
2. **Região**. Aparece após a escolha do SKU ou a descrição de outro produto. Usa os componentes e valores existentes de UF, cidade e bairro, com bairro opcional. Aproveita a região já preenchida no formulário. No Banco, mostra as regiões atuais e mantém todas por padrão ao aplicar a sugestão. Uma edição explícita no painel substitui o conjunto pelo conjunto revisado pelo vendedor, que aparece inteiro antes de aplicar. Se não houver região, a sugestão ainda pode ser gerada. As validações de localização do formulário permanecem na etapa de busca ou salvamento.
3. **Refinar busca**. Seção recolhida por padrão. Deixa a geração direta a partir do produto e da região e concentra os campos opcionais abaixo.
   - **Público-alvo**. Mostra quem pode comprar o item, como lojistas, distribuidores ou instaladores de câmeras. Sem seleção, apresenta até três públicos distintos, com prioridade para compradores de revenda, conforme o catálogo de venda por caixa fechada. Quando o vendedor escolher um público, as sugestões respeitam essa escolha.
   - **Especialidade do negócio**. Mostra em que o comprador atua. Sugere poucas opções ligadas ao SKU e ao público. Por exemplo, para uma câmera residencial, **CFTV residencial**. Para o massageador QS-030, **Aparelhos de cuidados pessoais**. Exibe o campo quando houver opção útil e mantém a escolha em branco por padrão.
   - **Detalhes da busca**. Campo opcional para orientar a prospecção, por exemplo “prefiro lojas com atendimento a instaladores”. Se o vendedor pedir uma palavra no nome empresarial no Banco ou atividades secundárias, a sugestão informa a restrição antes de aplicar.

**Gerar sugestões** mostra cards com público, motivo e filtros. **Aplicar filtros** preenche só o rascunho. Mantém as validações, o fluxo de confirmação, as ações existentes de salvar e buscar e a origem atual do formulário. Ao trocar o SKU, preserva a região e limpa público, especialidade e detalhes ligados ao produto anterior. Ao trocar o público, limpa a especialidade se ela deixar de ser compatível. Alterações em produto, região ou refinamentos invalidam os cards e descartam respostas atrasadas do contexto anterior.

### Especialidades iniciais por família

Usar esta lista para preparar as opções de cada SKU. Por exemplo, um ferro a vapor oferece **Cuidados com roupas** e um aspirador oferece **Limpeza doméstica**.

- **Câmeras de segurança e cabo**. CFTV residencial, CFTV comercial, monitoramento e acessórios de instalação.
- **Minicâmeras e foto/vídeo**. Foto e vídeo, eletrônicos portáteis.
- **Áudio, vídeo e projeção**. Streaming e TV, home theater e acessórios para TV no NTV. Projeção, karaokê e games nos projetores. Os usos comerciais podem coexistir no mesmo SKU e a ficha diferencia os acessórios de cada modelo.
- **Informática e armazenamento**. Periféricos, cartões de memória e suprimentos de informática.
- **Acessórios para celular**. Acessórios para smartphone e suportes veiculares, conforme a ficha.
- **Utilidades de cozinha**. Utensílios de cozinha, acessórios para vinho e embalagem e conservação.
- **Eletroportáteis**. Limpeza doméstica e cuidados com roupas.
- **Higiene e bem-estar**. Aparelhos de cuidados pessoais e higiene bucal.
- **Pet**. Passeio e hidratação de cães e higiene pet.
- **Acessórios automotivos**. Organização veicular e infladores e acessórios para pneus.
- **Ferramentas e jardim**. Ferramentas portáteis e irrigação e conexões.
- **Brinquedos**. Quebra-cabeças e jogos de lógica.

## Mapa inicial de públicos

Cada linha mostra uma família e seus SKUs. Os códigos abaixo representam a atividade econômica do comprador potencial. Os perfis comerciais são hipóteses de prospecção. Códigos de escopo amplo merecem identificação explícita no card do Banco, pois o cadastro fiscal pode abranger negócios de outros segmentos.

| Família | SKUs | Google, nichos e termos iniciais | Banco, CNAEs candidatos por público |
| --- | --- | --- | --- |
| Câmeras de segurança e cabo | ES-P9, ES-S6, IC-8177, IC-A31B, IC-A35, IC-A38, IC-A58, IC-A6-5V, IC-A8, IC-A8-5V, IC-Q10, QS-003 | Lojas de segurança eletrônica, distribuidores de CFTV, instaladores de câmeras. Termos como CFTV, câmeras Wi-Fi, câmera 4G ou acessórios de instalação conforme o SKU. | Loja **4759-8/99**. Atacado **4649-4/01**. Instalação **4321-5/00** e monitoramento **8020-0/01** em perfis separados, quando pertinentes. |
| Minicâmeras e foto/vídeo | QS-C-001, QS-C-002, QS-C-003 | Lojas de eletrônicos e de equipamentos de foto e vídeo. Termos como minicâmera e gravador de vídeo portátil. | Varejo de áudio e vídeo **4753-9/00**. Atacado de aparelhos eletrônicos **4649-4/02**. |
| Áudio, vídeo e projeção | NTV, QS-T-001, QS-T-002 | Lojas de áudio e vídeo, de eletrônicos e distribuidores. Para os projetores, também lojas de games quando o vendedor escolher esse público ou especialidade. | Varejo **4753-9/00**. Atacado **4649-4/02**. Para lojas de games, **4763-6/01**, que também abrange brinquedos e outros artigos recreativos. |
| Informática e armazenamento | 128GB-V, 32GB-V, 64GB-V, MN-TEC, QS-011 | Lojas e distribuidores de informática. Termos como microSD, periféricos, mini teclado ou mouse conforme o SKU. | Varejo **4751-2/01**. Atacado de equipamentos **4651-6/01** e de suprimentos **4651-6/02**, conforme o público. |
| Acessórios para celular | QS-010 | Lojas de acessórios para celular e revendas de telefonia. Termos como suporte para celular e acessórios para smartphone. | Varejo de telefonia **4752-1/00** como candidato, com escopo mais amplo que acessórios. |
| Utilidades de cozinha | QS-001, QS-008, QS-009, QS-027 | Lojas de utilidades domésticas, atacadistas de utensílios de cozinha e armarinhos com seção de utilidades. Termos como utensílios, acessórios para vinho ou selador de embalagens conforme o SKU. | Varejo de utilidades **4759-8/99**. Atacado **4649-4/99**. O Google permite procurar armarinhos pelo mix de produtos. |
| Eletroportáteis | QS-031, QS-032 | Lojas de eletroportáteis e distribuidores de eletrodomésticos. Termos como ferro a vapor portátil ou aspirador sem fio conforme o SKU. | Varejo **4753-9/00**. Atacado **4649-4/01**. |
| Higiene e bem-estar | QS-019, QS-030 | Lojas de aparelhos de cuidados pessoais e lojas de eletroportáteis. Esterilizador de escovas ou massageador portátil recarregável conforme o SKU. | Atacado de aparelhos elétricos de uso pessoal **4649-4/01**. Para loja especializada em bem-estar, priorizar o Google e só oferecer um card no Banco se houver atividade que represente o público escolhido. |
| Pet | QS-023, QS-023-1, QS-026 | Pet shops e distribuidores de acessórios pet. Garrafa portátil para cachorro ou purificador da linha pet conforme o SKU. | Varejo pet **4789-0/04**. Atacado de acessórios pet **4649-4/99**, com escopo amplo. |
| Acessórios automotivos | QS-025, QS-028 | Lojas e distribuidores de acessórios automotivos. Termos como inflador portátil ou organizador veicular conforme o SKU. | Varejo **4530-7/03**. Atacado **4530-7/01**. |
| Ferramentas e jardim | QS-004, QS-007 | Lojas de ferramentas para o soprador e lojas de jardinagem, irrigação ou conexões para o adaptador de mangueira. | Varejo de ferramentas **4744-0/01**, atacado **4672-9/00**. Para o adaptador, varejo de materiais hidráulicos **4744-0/03** como opção para revendas de conexões. |
| Brinquedos | QS-B-003 | Lojas e distribuidores de brinquedos e jogos. Termos como quebra-cabeça e jogos de lógica. | Varejo **4763-6/01**. Atacado **4649-4/99**, com escopo amplo. |

Fontes da classificação: [Subclasses oficiais do IBGE](https://servicodados.ibge.gov.br/api/v2/cnae/subclasses), [varejo de segurança e utilidades](https://cnae.ibge.gov.br/?chave=475&subclasse=4759899&tipo=cnae&versao=9.1.0&view=subclasse), [atacado de equipamentos elétricos](https://cnae.ibge.gov.br/?chave=46&subclasse=4649401&tipo=cnae&versao=9.1.0&view=subclasse), [instalação elétrica e de CFTV](https://cnae.ibge.gov.br/?chave=4321500&subclasse=4321500&view-subclasse=) e [atacado de acessórios e utensílios](https://cnae.ibge.gov.br/?subclasse=4649499&tipo=cnae&versao=9&view=subclasse).

## Como gerar e aplicar filtros

- **Google**. Sugere nicho, termos adicionais e produtos de interesse que ajudem a identificar o segmento. Pode marcar um tipo de negócio compatível com o público escolhido explicitamente pelo vendedor e com as opções atuais do Google, pois o tipo marcado pode excluir empresas. Exibe a região escolhida. Exclusões e outras preferências dependem de pedido expresso e devem ser visíveis no card antes de aplicar.
- **Banco**. Mostra atividade principal com código e descrição oficial. Usa CNAEs secundários e palavras no nome empresarial só mediante indicação do vendedor. Os critérios de situação, porte, contatos, quantidade e demais opções do formulário são preservados. O nome do produto não vira automaticamente palavra da razão social ou do nome fantasia.
- **Especialidade**. No Google, orienta nicho e termos. No Banco, ajuda a selecionar CNAEs compatíveis. Quando uma especialidade não tiver representação exata no CNAE, o card informa o alcance efetivo do código e pode indicar o Google para a procura específica.
- **Relevância**. Para um SKU conhecido no Banco, o servidor fornece candidatos limitados ao perfil escolhido, com código, descrição oficial e motivo do vínculo. Confere novamente se os códigos devolvidos estão na lista daquele perfil e no catálogo oficial. Um código de escopo amplo pode aparecer com aviso de menor precisão quando uma nota ou descritor oficial cobrir a atividade do público, como varejo de sistemas de segurança. Se houver só afinidade, como varejo de produtos de bem-estar sem uma atividade que cubra o perfil, omite a opção e indica o Google.
- **Descrição livre**. Se o texto corresponder a um SKU ou a um nome inequívoco, o painel pode sugerir a seleção. Em caso de ambiguidade, pede a função do produto ou o público. Para produtos fora do catálogo, os candidatos do Banco vêm de uma seleção do catálogo oficial com relação documentada ao público. Sem candidatos confiáveis, o vendedor recebe orientação para detalhar o público ou usar os filtros manuais. A validação usa o catálogo local.

## Verificações para implementação

- Comparar o catálogo importado com a lista publicável. Confirmar 40 SKUs únicos, os mesmos 40 no mapa e nenhuma imagem ou informação de preço enviada ao provedor.
- Validar os códigos do mapa no catálogo oficial versionado, inclusive a rejeição de um código válido fora do perfil. Testar os SKUs QS-030, IC-8177, QS-023 e 128GB-V nas duas origens. Testar também o fluxo de descrição livre e a falta de candidatos.
- No navegador, conferir pesquisa de SKU e nome, desbloqueio dos campos depois da escolha, geração com o refinamento recolhido, especialidades de dois SKUs da mesma família, troca de SKU com região preservada e limpeza do contexto anterior, navegação por teclado, celular, resposta atrasada, erro e aplicar sem salvar ou iniciar busca. Testes automatizados simulam Claude.
