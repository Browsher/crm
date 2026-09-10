# Backup diário no Windows

O banco local e o da Railway são independentes. A tarefa Windows chama o CLI que cria uma cópia lógica criptografada de cada um e grava no Google Drive para computador. O arquivo gravado na unidade virtual ainda não comprova envio à nuvem.

## Preparação

O usuário deve estar conectado ao Windows, com Node.js 24, dependências npm do CRM, Docker Desktop e Google Drive disponíveis. Usar o checkout principal atualizado após merge do PR. O script não inicia nem restaura bancos.

```powershell
powershell.exe -NoProfile -File scripts/backup/windows.ps1 -Modo preparar
```

Isso gera a configuração em `%LOCALAPPDATA%\CRM Backup` e uma chave protegida pela conta Windows (DPAPI). O arquivo `recuperacao.txt` contém a chave portátil: guardar no celular, de preferência em gerenciador de senhas ou nota protegida, separado do computador e da pasta de backups. Não enviar a chave para o Git ou junto dos pacotes. O preparo recusa sobrescrever estado existente.

O destino padrão é `G:\Meu Drive\CRM Backups`. Antes da primeira execução, criar e conferir pela interface web que a pasta pertence à conta correta e tem acesso geral Restrito, sem outros usuários. Não confiar só na letra da unidade.

## Primeira execução e recuperação

Após conferir a privacidade, executar:

```powershell
powershell.exe -NoProfile -File scripts/backup/windows.ps1 -Modo executar -DestinoPrivadoConfirmado
```

A chave é passada ao CLI pela entrada padrão e não aparece no comando. O estado local registra falhas sem imprimir erros brutos de conexão. Cópias incompletas não devem ser consideradas backups; `sincronizacao_nao_confirmada` exige conferência no Drive web.

Baixar pelo Drive web um pacote de cada origem. Usar o CLI `scripts/backup/recuperar.mts` com o pacote e uma pasta nova, fornecendo a chave pela entrada padrão. A extração valida autenticação e integridade antes de escrever os arquivos. Ela não executa SQL. Restaurar os arquivos extraídos somente em um Postgres isolado da versão correspondente; conferir dados e invariantes antes de considerar a recuperação validada.

Papéis são incluídos sem senhas. Na reconstrução de um servidor, configurar separadamente as senhas de conexão. O dump inclui dados privados do CRM: arquivos extraídos devem permanecer em diretório privado e nunca ir para o Git.

## Agendador

```powershell
powershell.exe -NoProfile -File scripts/backup/windows.ps1 -Modo instalar
```

Cria `CRM Backup Diario` inicialmente desativada, com horário diário às 18h do Windows, identidade interativa do usuário e sem privilégios administrativos. Configura execução quando o horário foi perdido, impede sobreposição e repete após falha até três vezes, com intervalo de 15 minutos. Confirmar que o Windows está no horário de Brasília. Drive mapeado pode não estar disponível sem a sessão interativa.

Somente após guardar a chave e testar a recuperação externa:

```powershell
powershell.exe -NoProfile -File scripts/backup/windows.ps1 -Modo ativar -ChaveGuardada -RecuperacaoValidada
powershell.exe -NoProfile -File scripts/backup/windows.ps1 -Modo situacao
```

Os dois parâmetros registram a declaração do operador; o programa não consegue verificar se a chave foi guardada no celular. Não os usar antes das verificações reais.

## Falhas e limites

- Computador desligado ou sem sessão, Docker parado, Drive desconectado e internet indisponível podem atrasar cópias. Não há garantia de perda máxima de 24 horas nessas condições.
- `resultado.json` e o histórico do Agendador são as fontes de diagnóstico. Não enviar esse arquivo automaticamente para terceiros.
- Se uma execução for terminada à força, conferir o processo e o lock antes de nova tentativa. Nunca remover um lock sem verificar que seu dono terminou.
- Meta de retenção: 14 cópias válidas por origem. A remoção fica suspensa enquanto não houver confirmação remota; por segurança, a implementação inicial conserva os arquivos. Isso pode aumentar o espaço ocupado.
- Nenhum PITR, snapshot pago ou novo serviço contratado. O espaço usado no Drive e o tráfego de saída da Railway continuam sujeitos aos planos existentes.

Referências: [Agendador Microsoft](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset), [DPAPI](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata.protect).
