param(
  [ValidateSet('preparar','executar','situacao','instalar','ativar')]
  [string]$Modo = 'situacao',
  [string]$Estado = (Join-Path $env:LOCALAPPDATA 'CRM Backup'),
  [string]$Destino = 'G:\Meu Drive\CRM Backups',
  [string]$Repositorio = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
  [switch]$DestinoPrivadoConfirmado,
  [switch]$ChaveGuardada,
  [switch]$RecuperacaoValidada
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$nomeTarefa = 'CRM Backup Diario'
$Estado = [IO.Path]::GetFullPath($Estado)
$Repositorio = [IO.Path]::GetFullPath($Repositorio)
$configArquivo = Join-Path $Estado 'config.json'
$chaveArquivo = Join-Path $Estado 'chave.dpapi'
$confirmacaoDestino = Join-Path $Estado 'destino-privado.confirmado'
$utf8 = New-Object System.Text.UTF8Encoding($false)

try {
  # O processo Node pode herdar PSModulePath do PowerShell 7. Carregar o
  # modulo da propria versao evita escolher um modulo incompativel no 5.1.
  Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -Force
  Add-Type -AssemblyName System.Security
  $raizLocal = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\') + '\'
  if (!$Estado.StartsWith($raizLocal, [StringComparison]::OrdinalIgnoreCase)) { throw 'Estado deve estar no perfil local.' }
  if ($Modo -eq 'preparar') {
    if (Test-Path -LiteralPath $Estado) { throw 'Estado ja existe; nao sobrescrever a chave.' }
    $repoPrefixo = $Repositorio.TrimEnd('\') + '\'
    $drivePrefixo = [IO.Path]::GetFullPath($Destino).TrimEnd('\') + '\'
    if ($Estado.StartsWith($repoPrefixo, [StringComparison]::OrdinalIgnoreCase) -or $Estado.StartsWith($drivePrefixo, [StringComparison]::OrdinalIgnoreCase)) { throw 'Estado deve ficar fora do repositorio e do destino.' }
    [IO.Directory]::CreateDirectory($Estado) | Out-Null
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $Estado -AclObject $acl
    $chave = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($chave) } finally { $rng.Dispose() }
    try {
      $protegida = [Security.Cryptography.ProtectedData]::Protect($chave, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
      [IO.File]::WriteAllBytes($chaveArquivo, $protegida)
      [IO.File]::WriteAllText((Join-Path $Estado 'recuperacao.txt'), [Convert]::ToBase64String($chave), $utf8)
    } finally { [Array]::Clear($chave, 0, $chave.Length) }
    $node = (Get-Command node -ErrorAction Stop).Source
    $config = @{ repositorio=$Repositorio; destino=[IO.Path]::GetFullPath($Destino); estado=$Estado; node=$node }
    [IO.File]::WriteAllText($configArquivo, ($config | ConvertTo-Json), $utf8)
    Write-Output ('Preparado. Guarde no celular o arquivo: ' + (Join-Path $Estado 'recuperacao.txt'))
    Write-Output 'Nenhum backup enviado e nenhuma tarefa ativada.'
    exit 0
  }
  if (!(Test-Path -LiteralPath $configArquivo)) { throw 'Preparacao ausente.' }
  $config = Get-Content -LiteralPath $configArquivo -Raw | ConvertFrom-Json
  $Repositorio = $config.repositorio
  if ($Modo -eq 'situacao') {
    $wrapper = Join-Path $Estado 'wrapper-resultado.json'
    if (Test-Path -LiteralPath $wrapper) { Get-Content -LiteralPath $wrapper -Raw }
    $resultado = Join-Path $Estado 'resultado.json'
    if (Test-Path -LiteralPath $resultado) { Get-Content -LiteralPath $resultado -Raw } else { Write-Output 'Nenhuma execucao registrada.' }
    Get-ScheduledTask -TaskName $nomeTarefa -ErrorAction SilentlyContinue | Select-Object TaskName, State
    exit 0
  }
  if ($Modo -eq 'instalar') {
    if (Get-ScheduledTask -TaskName $nomeTarefa -ErrorAction SilentlyContinue) { throw 'Tarefa ja existe; inspecione antes de substituir.' }
    $script = Join-Path $Repositorio 'scripts\backup\windows.ps1'
    foreach ($caminho in @($script,$Estado)) { if ($caminho -match '["\r\n]') { throw 'Caminho invalido.' } }
    $argsTarefa = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $script + '" -Modo executar -Estado "' + $Estado + '"'
    $acao = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument $argsTarefa -WorkingDirectory $Repositorio
    $gatilho = New-ScheduledTaskTrigger -Daily -At '18:00'
    $settings = New-ScheduledTaskSettingsSet -Disable -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -ExecutionTimeLimit (New-TimeSpan -Minutes 45)
    $usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $nomeTarefa -Action $acao -Trigger $gatilho -Settings $settings -Principal $principal -Description 'Backups criptografados do CRM. Inicialmente desativada ate validar recuperacao e chave.' | Select-Object TaskName, State
    exit 0
  }
  if ($Modo -eq 'ativar') {
    if (!$ChaveGuardada -or !$RecuperacaoValidada -or !(Test-Path -LiteralPath $confirmacaoDestino)) { throw 'Confirme chave guardada, recuperacao externa e destino privado antes de ativar.' }
    if (!(Test-Path -LiteralPath (Join-Path $Estado 'resultado.json'))) { throw 'Execute e confira os backups primeiro.' }
    $ultimo = Get-Content -LiteralPath (Join-Path $Estado 'resultado.json') -Raw | ConvertFrom-Json
    if (!$ultimo.ok -or !$ultimo.alvos.local.ok -or !$ultimo.alvos.railway.ok) { throw 'Ambos os backups devem ter sido concluidos.' }
    Enable-ScheduledTask -TaskName $nomeTarefa | Select-Object TaskName, State
    Get-ScheduledTaskInfo -TaskName $nomeTarefa | Select-Object NextRunTime, LastTaskResult
    exit 0
  }
  if ($DestinoPrivadoConfirmado) { [IO.File]::WriteAllText($confirmacaoDestino, [DateTime]::UtcNow.ToString('o'), $utf8) }
  if (!(Test-Path -LiteralPath $confirmacaoDestino)) { throw 'Privacidade do destino ainda nao confirmada.' }
  if (!(Test-Path -LiteralPath $config.destino -PathType Container)) { throw 'Pasta do Drive indisponivel.' }
  $chave = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($chaveArquivo), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  try {
    Push-Location -LiteralPath $Repositorio
    try {
      $cli = Join-Path $Repositorio 'scripts\backup\executar.mts'
      [Convert]::ToBase64String($chave) | & $config.node --import tsx $cli $configArquivo
      $codigo = $LASTEXITCODE
    } finally { Pop-Location }
  } finally { [Array]::Clear($chave, 0, $chave.Length) }
  if ($codigo -ne 0) { throw 'Execucao falhou; confira resultado.json.' }
  [IO.File]::WriteAllText((Join-Path $Estado 'wrapper-resultado.json'), (@{ok=$true;quando=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json), $utf8)
  exit 0
} catch {
  # Mensagem fixa: excecoes de processos podem conter caminhos ou credenciais.
  Write-Output ('Etapa interrompida na linha ' + $_.InvocationInfo.ScriptLineNumber + ' (' + $_.Exception.GetType().Name + ').')
  if ($Modo -eq 'executar' -and (Test-Path -LiteralPath $configArquivo)) {
    try {
      $falha = @{ok=$false;quando=[DateTime]::UtcNow.ToString('o');motivo='falha_no_wrapper';linha=$_.InvocationInfo.ScriptLineNumber}
      [IO.File]::WriteAllText((Join-Path $Estado 'wrapper-resultado.json'), ($falha | ConvertTo-Json), $utf8)
      # Aviso local, limitado a oito segundos. Falha do aviso nao apaga o registro.
      if ([Environment]::UserInteractive -and !$env:VITEST) {
        $aviso = New-Object -ComObject WScript.Shell
        $aviso.Popup('O backup do CRM falhou. Consulte a situacao do backup antes de confiar na ultima copia.', 8, 'Backup CRM', 48) | Out-Null
      }
    } catch { Write-Output 'Nao foi possivel registrar ou mostrar o aviso de falha.' }
  }
  Write-Error 'Backup CRM: operacao nao concluida. Confira preparacao, destino, Docker e resultado.json.' -ErrorAction Continue
  exit 1
}
