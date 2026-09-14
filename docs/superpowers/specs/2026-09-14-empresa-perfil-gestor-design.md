# Ficha de empresa para o gestor

Escopo aprovado: acesso pelo nome da empresa somente em `/empresas`. Não
adicionar links dentro de grupos. Consulta sem escrita, reserva ou registro
automático de visita. A ficha do vendedor e suas regras permanecem iguais.

Nova rota `/empresas/[id]`, protegida como gestor na página e na consulta SQL.
Exibe dados cadastrais/contato, endereço, responsável e sua situação ativa ou
desativada, reserva quando válida, situação da empresa, próximo retorno,
histórico com autor/data/tipo/nota e grupos de origem com situação.

Reutilizar leitura de histórico e vocabulário de contato na composição da
página, sem importação entre features. Não inferir venda ou desfecho que não
esteja registrado. Datas de retorno são civis; horários em America/Sao_Paulo.
Mostrar campos ausentes explicitamente e erro de histórico distinto de vazio.

Visual segue ficha equilibrada: dados e acompanhamento à esquerda, histórico
à direita, uma coluna no celular, componentes e temas existentes. Sem editar,
transferir, assumir, devolver ou registrar atendimento. Grupos aparecem como
informação, sem alterar suas páginas.

Voltar remonta somente filtros conhecidos e paginação para `/empresas`; nunca
aceita URL arbitrária. ID inválido/inexistente retorna 404 sem consultar
histórico. Sem migração prevista. Testes somente em bancos locais temporários.

Aceite: gestor abre qualquer empresa visível, inclusive sem dono/histórico;
vendedor não acessa a rota nem a consulta administrativa; nenhuma escrita;
voltar preserva filtros; grupos não ganham entrada para esta ficha.
