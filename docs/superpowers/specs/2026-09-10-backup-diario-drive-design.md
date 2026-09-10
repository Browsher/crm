# Backup diário do CRM no Google Drive

Proposta para revisão — 10/09/2026. Nada ativado.

## Objetivo e destinos

Gerar cópias lógicas independentes dos bancos crm local (Docker) e railway. Destino proposto: G:\Meu Drive\CRM Backups, com subpastas local e railway. A raiz G:\Meu Drive foi conferida; permissões de compartilhamento e sincronização remota ainda precisam de verificação. Não enviar dados enquanto a privacidade do destino não estiver confirmada.

Essa alternativa aproveita o Drive instalado. Não exige PITR nem ativação de snapshots pagos. Pode consumir espaço da conta Google e tráfego de saída Railway; não há contratação ou mudança de plano autorizada por esta especificação.

## Execução

Agendamento proposto: diariamente às 18h, horário de Brasília, enquanto o usuário estiver conectado. Se perder o horário, tentar na próxima oportunidade; falhas de Docker, rede ou Drive geram resultado explícito e tentativa posterior limitada. Não iniciar execuções sobrepostas. Computador desligado pode deixar o backup atrasado por mais de 24 horas.

Usar os clientes PostgreSQL compatíveis disponíveis no Docker e as configurações privadas já existentes, sem gravar credenciais em argumentos, logs, Git ou Drive. Conferir destino e TLS antes da conexão. Consultas de backup somente leitura. Não aplicar migrações nem restaurar os bancos de origem.

## Proteção e publicação

Criptografia autenticada antes de copiar qualquer arquivo ao Drive. Gerar chave de recuperação dedicada; proteger a cópia operacional pelo Windows e entregar ao usuário instrução para guardar uma cópia separada, por exemplo em um gerenciador de senhas. Nunca colocar a chave junto dos backups. Ativação depende da confirmação de que a chave de recuperação foi guardada fora deste computador.

Gerar arquivo temporário em diretório local privado, validar e publicar o pacote criptografado com nome único somente após sucesso. Pacote inclui dump, papéis sem senhas e manifesto de versão e integridade. Credenciais de conexão serão reconfiguradas separadamente numa recuperação.

Não confundir escrita na unidade virtual com envio concluído: registrar etapas separadas para criação, criptografia, gravação no Drive e verificação remota. Na ausência de verificação remota, declarar sincronização não confirmada. A primeira ativação exige conferir a cópia pela interface web do Drive e testar sua recuperação a partir do download.

## Retenção e falhas

Manter as últimas 14 cópias diárias válidas por origem, preservando a última cópia válida em qualquer falha. Rotação só poderá remover arquivos reconhecidos como gerados por esta automação, dentro das duas subpastas autorizadas, depois de uma nova cópia validada. Sem confirmação de sincronização remota, adiar exclusão automática das cópias anteriores.

Registrar resultado local sem dados pessoais ou segredos e disponibilizar comando de consulta de situação. Notificação no Windows para falhas quando a sessão estiver ativa; nenhuma mensagem por e-mail ou Telegram nesta etapa. Computador desligado também impede avisos locais.

## Verificação e entrega

Testes antes do código: integridade e falha de autenticação criptográfica; arquivo incompleto; destino incorreto; indisponibilidade do Drive; execução concorrente; retenção restrita aos arquivos próprios; falha de um alvo sem falso sucesso do outro; logs sem segredos.

Restaurar as primeiras cópias baixadas do Drive em containers isolados e temporários, conferir esquema e invariantes e registrar o resultado. Não substituir bancos existentes.

Implementar em branch codex/, com plano, testes, revisão e PR com CI verde. Somente após integração, confirmação da chave de recuperação e teste da cópia externa, ativar a execução recorrente por mecanismo compatível com o ambiente. A especificação não afirma que uma automação já foi criada.