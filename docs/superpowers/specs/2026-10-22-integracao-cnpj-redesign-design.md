# CNPJ.biz no redesign

Autorização: pedido de 22/10/2026 para integrar as implementações, atualizar a prévia e realizar revisão independente. Complementa o desenho do redesign e a especificação de busca de empresas; não exige outra decisão visual do usuário.

## Resultado

No vendedor, Prospecção oferece Buscar empresas e Localizar empresa. Buscar empresas mantém as duas fontes, filtros, consulta, conferência, seleção, importação e histórico. No gestor, Empresas oferece Busca de empresas, conexão, limites por vendedor, pausa e histórico. Os dados cadastrais de origem permanecem separados dos campos manuais e dentro da área autorizada das fichas.

## Integração e visual

Incorporar a branch do PR #56 no worktree e na branch do PR #55; preservar o checkout compartilhado. Resolver o cabeçalho de Prospecção combinando ambas as ações. Reutilizar CabecalhoPagina, Button, Card e os tokens existentes: branco #ffffff, fundo #f5f6f8, texto #202a35, secundário #65707d, verde #17634d. Tipografia, tema por área, navegação e abas das fichas seguem o redesign aprovado.

Layout: cabeçalho alinhado à esquerda; navegação entre fontes com links reais; filtros em duas colunas e limite ao lado no desktop, coluna única no celular; resultados e histórico abaixo. A gestão mostra conexão e formulários legíveis por vendedor, sem colunas comprimidas. Não acrescentar animação decorativa nem dependências. A distinção vem da hierarquia entre critérios, disponibilidade e conferência.

## Regras preservadas

Manter CNPJ_BIZ_API_KEY apenas no servidor; UUID estável na tentativa, novo em nova busca; cobrança por empresas solicitadas inclusive falhas no dia de São Paulo; resultados persistidos e importação do servidor; reaproveitamento de CNPJ sem sobrescrever campos manuais, responsável, reserva ou carteira; bloquear importação sem telefone válido; autoridade dos telefones no banco; mensagens de erro, espera, sucesso e bloqueio. Não mudar o agente Google, agenda ou escopo adiado de email/campanhas.

## Prévia e verificação

Banco local descartável, com migrações 0038/0039 somente nele, mesmas credenciais fictícias já entregues e limites de demonstração. Fornecedor simulado exclusivamente no processo local de teste, sem chave real e sem alterar cliente/serviço de produção. Exibir claramente a simulação na prévia. Deve ser possível consultar, conferir e importar pelo fluxo real do CRM. Nenhuma migração, ativação ou consulta paga em produção.

Validar testes existentes das duas branches, regressão integrada de navegação e fichas, busca simulada e atualização sem repetir cobrança, pausa/limites, Google, tema claro/escuro e celular. Fazer revisão independente do delta da integração e corrigir achados materiais antes de atualizar a prévia.
