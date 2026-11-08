# Consolidação dos painéis do CRM

Data: 06/11/2026. Conteúdo e escolhas visuais aprovados; implementação ainda não iniciada.

## Matriz vigente

| Área | Decisão aprovada | Referência |
| --- | --- | --- |
| Base | Desktop A até 520 px; celular A em tela inteira; uma lateral por vez | 2026-11-06-largura-paineis; 2026-11-06-painel-celular |
| Negociação | Menu Atendimento e próximo passo / Histórico; sem Resumo | 2026-11-06-estrutura-negociacao |
| Ações | Rodapé; Registrar venda e Sem interesse; edição Cancelar/Salvar | 2026-11-06-botoes-negociacao |
| Dados da empresa | Contato e localização / Cadastro e origem / Atividades e sócios | 2026-11-06-dados-empresa |
| Meu dia | Sem seleção inicial; próximo passo direto e acesso a Dados/Histórico | 2026-11-06-meu-dia-navegacao |
| Banco | Histórico na página; empresas expansíveis; filtros só no grupo | 2026-11-06-banco-historico |
| Google | Critérios em três grupos; espelhar como formulário direto | 2026-11-06-criterios-google-grupos; 2026-11-06-espelhar-planejamento |
| Carteira | Ficha lateral com menu; atendimento e recompra diretos | 2026-11-06-carteira-abertura-cliente |
| Gestor | Menu Ações na linha; criação e entrega de acesso diretas | 2026-11-06-gestor-acoes-usuarios |
| Perfil | Indicadores na página; Empresas/Atendimentos laterais; 50 empresas por página | 2026-11-06-perfil-vendedor-organizacao |
| Imagem | Imagem e legenda juntas; Ampliar imagem na mesma lateral | 2026-11-06-whatsapp-imagem |
| Confirmações | A, alvo destacado, consequência e ações | 2026-11-06-confirmacoes-padrao |
| Estados | Faixas compactas; recuperação no rodapé; preservar o mesmo envio | 2026-11-06-estados-paineis |

As referências são pastas em docs/design. A spec consolidada é docs/superpowers/specs/2026-11-05-padronizacao-paineis-crm-design.md. Alternativas antigas não representam decisões pendentes.

## Próxima etapa: dividir a implementação

Proposta de entregas, ainda sem código e sem planos executáveis:

1. Base compartilhada e adaptação de Meu dia/Funil. Uma lateral, largura/tela inteira, cabeçalho, rodapé, menu, foco, guardas e estados. Preservar comandos de atendimento/venda e Sem interesse existentes.
2. Dados da empresa e Banco. Reutilizar a ficha autorizada; histórico em aba da página, expansão por grupo e filtros na lateral. Preservar retorno de pesquisa, página, rolagem, grupos e comando de busca.
3. Critérios e espelhamento Google. Mesmos campos e contratos, com os grupos escolhidos e formulário direto. Aplicar critérios continua sendo rascunho; espelhar não dispara coleta.
4. Carteira e confirmação de venda. Ficha e tarefas laterais; primeira venda na ficha correta; recompra e agenda preservadas. Manter rascunhos, recibos, idempotência e rotas diretas de compatibilidade.
5. Gestor. Ações na linha, formulários diretos, entrega única de senha e consultas de perfil paginadas. Preservar limites, permissões e restrições de própria conta. Adequar textos de Listas após confirmar o comportamento vigente.
6. Mídia WhatsApp. Somente visualização autorizada em lateral, legenda e ampliação. Preservar carregamento manual, conversa/fonte, aborto de requisição e liberação de blob.

Cada entrega deve receber um plano específico com arquivos, contratos, testes e critérios de conclusão antes de escrever produto. A ordem é proposta pelo autor para reduzir dependências, não uma autorização de execução. Manter a preferência já informada por implementação e revisão em agentes separados por etapa; não perguntar de novo esse método.

Cada PR deverá ter revisão e CI verdes antes de ser considerada pronta. Abrir as PRs contra main, sem empilhá-las em branches que serão apagadas. Merge e publicação exigem a autorização específica pertinente; não fazem parte desta rodada.

## O que está decidido e o que continua como verificação

Não há nova escolha visual identificada nesta consolidação. Existem verificações reais ainda necessárias: ler o código na base de implementação atual, preservar as rotas diretas e os estados de origem, ajustar textos legados de Listas ao efeito vigente, testar todos os consumidores e falhas em ambiente isolado.

O inventário observado é da base d830a53, não uma afirmação sobre a main remota atual. Atualizar essa comparação antes do plano executável. Não ampliar consultas, DTOs ou permissões para preencher exemplos de tela.

Mockups não comprovam RLS, gravação, concorrência, recibos, recuperação após reload, mídia privada, teclado virtual ou comportamento em todos os dispositivos. Os ensaios futuros deverão cobrir isso sem usar dados/usuários reais nem buscas pagas.

Prévia consolidada: http://127.0.0.1:4338/?area=revisao-final&view=dia

## Revisão independente

Conferida em 06/11/2026 por revisor de leitura separado. Resultado: nothing important left. Não foram encontradas decisões de produto pendentes nem contradição material entre a spec e esta consolidação. As verificações reais já registradas continuam obrigatórias antes e durante a implementação.

## Plano da primeira entrega

Preparado em docs/superpowers/plans/2026-11-06-paineis-entrega-1.md: quatro etapas revisáveis, base comum, Meu dia, Funil e validação completa. Interfaces novas, testes e comandos previstos estão definidos. A main remota foi conferida e correspondeu à base observada. Não houve alteração do produto; o plano está para revisão antes de executar, com o método de agentes separados já preservado.
