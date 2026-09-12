# Meu dia como entrada do CRM

Comportamento aprovado pelo usuário em 12/09/2026: acessar `/` encaminha
para `/meu-dia`. Login e troca de senha continuam usando `/` como destino
padrão; a guarda de autenticação e a troca obrigatória permanecem ativas.
Carteira continua separada. O menu deixa de repetir Início. A saída de sessão,
antes disponível na página inicial antiga, fica no shell compartilhado.
Agenda vazia oferece Prospecção e Carteira; filtros sem resultado continuam
oferecendo limpar filtros.

Implementação: substituir a página raiz por guarda seguida de redirect,
ajustar o shell e o estado vazio sem mudar consultas ou regras do banco.
Testes: RED para o redirect, menu e atalhos; atualizar jornadas cujo destino
de login mudou; conferir login, troca obrigatória, permissões e logout no
navegador. Typecheck, lint, inventário, unidade, integração e E2E com build.
Branch e PR contra main, preservando documentos locais não rastreados.
