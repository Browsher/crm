# Inventário de pop-ups e painéis do CRM

Leitura de código em 05/11/2026, base d830a53 (PR #73). Não é auditoria autenticada do gestor ou teste de regra comercial.
Objetivo: fechar o alcance visual e relacionar cada mockup aos consumidores atuais.

## Método e alcance

Varredura em app/ e src/ de imports Dialog, AlertDialog e Sheet, PainelLateralCrm e padrões nativos de diálogo, excluindo testes. Leitura dos consumidores, campos e ações; comparação com as specs de Funil e Meu dia. Sem graphify-out/graph.json existente neste worktree; a leitura usou rg e os arquivos-fonte.

O comando de imports de primitivas encontrou 18 arquivos de aplicação/composição. Isso é contagem de arquivos, não de pop-ups. Funções com sucesso e confirmação no mesmo arquivo, além de componentes compartilhados, são separados abaixo pela tarefa do usuário. Os componentes de UI, a galeria /design e os testes não são instâncias comerciais adicionais.

## Conteúdos e formulários

| ID | Tarefa e áreas | Superfície atual confirmada | Fonte e consumidor | Proposta de organização |
| --- | --- | --- | --- | --- |
| P01 | Dados da empresa, vendedor e gestor | Dialog em listas; painel no Funil/Meu dia | src/components/crm/empresa-dialogo.tsx; app/fila/cartao.tsx; app/empresas/lista.tsx; app/funil/quadro.tsx; app/meu-dia/painel.tsx | Uma ficha lateral comum, com grupos cadastrais autorizados e contexto de origem |
| P02 | Abrir retorno, Meu dia | Painel lateral | app/meu-dia/retorno-painel.tsx; app/meu-dia/painel.tsx | Próximo passo direto, menu Dados/Histórico e Negociação no rodapé; sem Resumo |
| P03 | Negociação, Funil e Meu dia | Painel lateral, embutido na página em tela estreita | app/funil/modal.tsx; app/funil/quadro.tsx; app/meu-dia/painel.tsx | Menu Atendimento e próximo passo / Histórico; ações no rodapé; tela inteira A no celular |
| P04 | Registrar venda | Formulário no painel do Funil; Dialog na Carteira | app/funil/modal.tsx; app/carteira/registrar-venda.tsx; app/carteira/[id]/ficha.tsx | Formulário lateral, conferência central, preservando primeira/recompra |
| P05 | Três últimas Sem interesse, Funil | Painel lateral | app/funil/arquivo-lateral.tsx; app/funil/quadro.tsx | Até três, somente Devolver por item e Ver todos |
| P06 | Critérios Google | Dialog | app/fila/google/criterios.tsx; app/fila/google/planejamento.tsx | Menu com três grupos aprovado em 06/11; aplicar rascunho do dia |
| P07 | Espelhar planejamento | Dialog | app/fila/google/espelhar.tsx; app/fila/google/planejamento.tsx | Formulário direto aprovado em 06/11; Origem/campos/destinos; ação fixa; mesma guarda e revisão |
| P08 | Histórico de buscas do Banco | Dialog que pode abrir outro Dialog | src/components/crm/historico-buscas-dialogo.tsx; historico-buscas.tsx; app/fila/buscar/page.tsx | Decisão de 06/11: histórico em aba da página; empresas expansíveis sob cada card; filtros diretos na lateral |
| P09 | Ver busca / Ver resultados | Dialog, inclusive abertura após busca | src/components/crm/busca-dialogo.tsx; historico-buscas.tsx; app/fila/buscar/page.tsx | Decisão de 06/11: Ver empresas expande na página; Filtros usados só no grupo; Ver empresa abre ficha lateral |
| P10 | Novo usuário | Dialog | app/usuarios/formulario-criar.tsx; app/usuarios/tabela.tsx | Nome/e-mail/papel; Cancelar/Criar no rodapé |
| P11 | Entrega de senha provisória | Conteúdo dentro do Dialog após criação ou geração | app/usuarios/senha.tsx; formulario-criar.tsx; linha.tsx | Lateral de entrega única; copiar/concluir. Confirmação da geração continua central |
| P12 | Renomear lista | Dialog em controle compartilhado com ativação | app/empresas/grupos/controles.tsx | Painel curto só para nome; ativação mantém confirmação |
| P13 | Ampliar imagem WhatsApp | Dialog após carregamento autorizado de blob | app/whatsapp/midia-mensagem.tsx | A aprovado: imagem/legenda juntas, com Ampliar imagem na mesma lateral e Voltar; preservar carga e autorização |

Revisão de alcance em 06/11/2026: o usuário aprovou a ficha da Carteira em painel lateral, preservando contratos de rota e links diretos. Ver docs/design/2026-11-06-carteira-abertura-cliente/README.md. É uma decisão de desenho; o produto ainda não foi alterado. O acesso às ações dos usuários do gestor também foi aprovado em A, menu Ações na linha; Ver perfil mantém sua página atual.

| ID adicional | Tarefa | Superfície atual | Fonte | Alternativa em comparação |
| --- | --- | --- | --- | --- |
| P14 | Consultar cliente da Carteira | Página própria | app/carteira/[id]/page.tsx e ficha.tsx | A lateral com menu aprovada pelo usuário em 06/11; manter rotas e links diretos |
| P15 | Registrar atendimento do cliente | Editor inline na ficha | app/carteira/[id]/ficha.tsx; src/features/contato/formulario.tsx | Tarefa direta na mesma lateral aprovada com a ficha, preservando rascunho, permissões e recuperação |
| P16 | Acessar comandos de usuário | Botões diretamente na linha | app/usuarios/tabela.tsx, linha.tsx; src/features/usuarios/regras.ts | A menu Ações na linha aprovado em 06/11; confirmações centrais e entrega de senha lateral |

Revisão do perfil em 06/11/2026: a página comercial do vendedor está em comparação de organização: A com duas abas, B com dois blocos e C com botões abrindo Empresas e Atendimentos na lateral. C foi aprovada com 50 empresas por página; a página de identificação e indicadores permanece. Fonte: app/usuarios/vendedores/[id]/page.tsx e src/features/gestao/perfil-vendedor.ts; limites atuais de 50 empresas por página e 20 atividades preservados. Ver docs/design/2026-11-06-perfil-vendedor-organizacao/README.md.

## Confirmações

Padrão visual A aprovado em 06/11/2026: alvo destacado, consequência abaixo e ações no rodapé. Aplicar aos alvos próprios de cada ação na implementação posterior, preservando exceções de rascunho e regras atuais. Ver docs/design/2026-11-06-confirmacoes-padrao/README.md.

| Tarefa | Evidência atual | Direção e cuidado |
| --- | --- | --- |
| Sem interesse | app/funil/arquivo-lateral.tsx, consumidores Funil e Meu dia | Continuar central, com alvo, encerramento e cancelamento de retornos |
| Confirmar venda | app/funil/modal.tsx; app/carteira/registrar-venda.tsx | Padronizar central; Carteira atualmente confere dentro do próprio formulário |
| Descartar edição | src/components/crm/descarte-edicao.tsx; app/fila/google/guarda-edicao.tsx; app/funil/modal.tsx; app/carteira/[id]/ficha.tsx; app/carteira/registrar-venda.tsx | Central comum; preservar Fechar mantendo rascunho na Carteira e o envio já iniciado |
| Nova senha provisória | app/usuarios/linha.tsx, tipo nova_senha | Confirmação central antes de gerar; entrega única na lateral |
| Tornar gestor/vendedor | app/usuarios/linha.tsx, tipo mudar_papel | Central com consequência de privilégio; restrições atuais mantidas |
| Desativar/reativar usuário | app/usuarios/linha.tsx | Central; não mexer em conta real para testar |
| Desativar/reativar lista | app/empresas/grupos/controles.tsx | Central, com impacto real disponível; texto legado pede revisão com as regras vigentes |

## Outros elementos encontrados

- Menu móvel do CRM: Sheet à esquerda em src/components/crm/shell.tsx. Já é navegação lateral; não é conteúdo a mover para a direita.
- app/design/galeria.tsx: exemplos de Dialog, sem reintroduzir Design system no menu do gestor.
- Login e trocar senha: páginas completas, não pop-ups.
- Carteira/ficha, empresa/ficha, perfil do vendedor, configuração WhatsApp, detalhe/entrega Google, buscas e listas arquivadas: rotas completas existentes. Não entram na migração só por conterem formulários ou históricos. As exceções aprovadas são a ficha da Carteira na lateral e as consultas do perfil, preservando suas rotas diretas.
- Dropdown, select, tooltip, player de áudio, download de documento e detalhes expansíveis não viram painéis por serem elementos flutuantes.
- Histórico comercial tem componente comum e consumidores já mapeados na auditoria 2026-11-05-historicos-crm.md. A galeria inclui referência visual, sem autorizar consulta adicional.

## Diferenças e nível de evidência

| Achado | Nível de evidência | Como tratar |
| --- | --- | --- |
| Empresa e venda usam superfícies diferentes conforme consumidor | Confirmado por imports e render dos arquivos listados | Unificar composição |
| Histórico de buscas pode abrir outro Dialog de busca | Confirmado pela composição de historico-buscas.tsx dentro do Dialog pai | Histórico na página, empresas expansíveis e filtros na lateral |
| Funil estreito usa painel no fluxo da página | Confirmado pelo CSS da base e conferência da publicação #73 | Propor tela inteira móvel; era comportamento previsto na spec anterior, não afirmar regressão da #73 |
| Grupos menciona reservas/descanso em confirmação | Texto confirmado em controles.tsx; sem ensaio de efeito comercial nesta rodada | Revisar mensagem contra regra atual antes de implementar; não deduzir que a regra existe só pelo texto |
| Formulários longos podem perder ações na rolagem | Risco de UX, não defeito reproduzido em todos os consumidores | Rodapé fixo proposto; validar cada consumidor na implementação |
| Declaração “todos os históricos mostram tudo” | Não comprovada e incompatível com fontes atuais | Preservar recortes e declarar limites |

## Pendências do levantamento

O inventário cobre as superfícies encontradas por leitura na base indicada. A revisão visual do protótipo não é validação autenticada das jornadas reais de gestor, de mídia privada, de comandos incertos ou de todos os condicionais de contato. Esses ensaios pertencem à futura implementação isolada.

Não foram criados defeitos de negócio nem pedidos de alteração de consulta para completar os mockups.

## Atualização visual de estados e largura

Em 06/11/2026, o usuário aprovou o padrão dos estados: faixas compactas e ações no rodapé, distinguindo consulta, edição, envio e resultado incerto. A comparação seguinte trata apenas da largura comum no desktop, A até 520 px ou B até 640 px, ainda pendente. Ver docs/design/2026-11-06-estados-paineis/README.md e docs/design/2026-11-06-largura-paineis/README.md. Nenhuma destas revisões valida permissões, transações ou regras reais.

Decisão posterior em 06/11/2026: largura A aprovada, com máximo de 520 px no computador. A revisão móvel compara tela inteira e lateral abaixo da barra do CRM, ainda sem escolha. Ver docs/design/2026-11-06-painel-celular/README.md.

Consolidação de 06/11/2026: A, tela inteira, aprovada no celular. Conteúdo e escolhas visuais estão reunidos na spec e na galeria Modelos aprovados. As pendências restantes são planejamento executável e validação real na implementação; não novas escolhas de layout identificadas nesta revisão. Ver docs/design/2026-11-06-revisao-final/README.md.
