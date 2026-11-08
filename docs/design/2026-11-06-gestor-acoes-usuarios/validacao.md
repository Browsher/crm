# Conferência das ações de usuários

Data: 06/11/2026. Somente galeria local com pessoas e senha fictícias.

## Comparação e navegação

- As ações de cada pessoa foram coletadas em A e B pelo DOM e comparadas: iguais.
- Vendedor ativo mostrou Nova senha provisória, Tornar gestor, Desativar e Ver perfil.
- Outro gestor ativo mostrou Nova senha provisória, Tornar vendedor e Desativar, sem Ver perfil.
- Pessoa inativa mostrou somente Reativar. A própria conta não ofereceu alterações administrativas.
- A confirmação Tornar gestor identificou Pessoa de exemplo e seu e-mail; Cancelar devolveu o foco ao acionador Ações.
- A confirmação Reativar identificou Pessoa inativa e seu e-mail.
- Na opção A, confirmar a geração simulada abriu a lateral de entrega para Pessoa de exemplo, com EXEMPLO-SEM-ACESSO. Copiar senha foi acionado como simulação; Concluir fechou a entrega.
- Na opção B, a entrega ocupou a mesma lateral. Concluir recuperou Senha de acesso e não apresentou a senha anterior; gerar outra exige nova confirmação.
- Enter abriu o menu Ações. Escape o fechou e conservou o foco no seu acionador.

## Apresentação

- A e B foram visualizadas em desktop e celular de 390 x 844, usando os temas claro e escuro.
- No celular, a opção B mediu documento e painel com largura 390, topo 0 e limite inferior 844; os dois botões de Papel e situação mediram 44 de altura.
- O menu Ações da opção A ficou entre 35 e 245 de posição horizontal, dentro do viewport 390, sem transbordamento do documento.
- A galeria ficou na opção A em desktop e tema escuro, com o menu da primeira pessoa aberto para facilitar a comparação.

## Limites

São demonstrações das regras visuais lidas na fonte. Não foram testados RLS, sessão real, gestor único, validações do servidor, lista revalidada, filtros/paginação reais, pendência, resposta perdida ou recuperação de um comando.

As confirmações não alteram pessoas ou permissões. A entrega usa um texto público de exemplo e não cria credencial. Não houve chamada administrativa, envio de mensagem ou gravação real na área de transferência.

A ficha da Carteira já está aprovada na lateral. Após esta conferência, o usuário escolheu A, menu Ações na linha. O conteúdo de Ver perfil foi posteriormente conferido por leitura da página atual, sem validação autenticada ou novo desenho dessa página.
