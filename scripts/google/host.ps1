param([ValidateSet('Memoria','Processo')][string]$Acao='Memoria',[ValidateRange(1,2147483647)][int]$PidAlvo=1)
$ErrorActionPreference='Stop'
try {
  if($Acao -eq 'Memoria') {
    $memoria=Get-CimInstance Win32_OperatingSystem
    ConvertTo-Json -Compress -InputObject @{ok=$true;disponivelMiB=[math]::Floor($memoria.FreePhysicalMemory/1024);instante=[datetime]::UtcNow.ToString('o',[Globalization.CultureInfo]::InvariantCulture)}
  } else {
    $processo=Get-Process -Id $PidAlvo -ErrorAction SilentlyContinue
    if($null -eq $processo) { ConvertTo-Json -Compress -InputObject @{ok=$true;processo=$null} }
    else { ConvertTo-Json -Depth 3 -Compress -InputObject @{ok=$true;processo=@{pid=$processo.Id;inicio=$processo.StartTime.ToUniversalTime().ToString('o',[Globalization.CultureInfo]::InvariantCulture)}} }
  }
} catch {
  if($Acao -eq 'Memoria') { ConvertTo-Json -Compress -InputObject @{ok=$false;motivo='medicao_indisponivel'} }
  else { ConvertTo-Json -Compress -InputObject @{ok=$false} }
}