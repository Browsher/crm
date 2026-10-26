param(
  [ValidateSet('Conferir','Preparar')][string]$Acao='Conferir',
  [string]$Registro=(Join-Path $PSScriptRoot 'motores.json')
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Chamar-Docker {
  param([string[]]$Partes,[switch]$AceitarAusente)
  $preferenciaAnterior=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    $retornoDocker = & docker @Partes 2>$null
    $codigoDocker=$LASTEXITCODE
  } finally { $ErrorActionPreference=$preferenciaAnterior }
  if($codigoDocker -ne 0) {
    if($AceitarAusente) { return $null }
    throw ('Docker recusou a operação '+$Partes[0]+'. Nenhum recurso foi removido.')
  }
  return ($retornoDocker -join "`n")
}
function Ler-Container {
  param([string]$Nome)
  $textoContainer=Chamar-Docker -Partes @('inspect',$Nome) -AceitarAusente
  if(!$textoContainer) { return $null }
  return @(ConvertFrom-Json -InputObject $textoContainer)[0]
}
function Conferir-Estrutura {
  param($Motor,$Container,[string]$ImagemId,[string]$Cache)
  if($Container.Image -ne $ImagemId -or ($Container.Config.Cmd -join ' ') -ne '-web -data-folder /gmapsdata -c 2') { throw ('Imagem ou argumentos divergentes: '+$Motor.container) }
  $dados=@($Container.Mounts | Where-Object {$_.Destination -eq '/gmapsdata'})
  $binarios=@($Container.Mounts | Where-Object {$_.Destination -eq '/opt'})
  $portas=@($Container.HostConfig.PortBindings.'8080/tcp')
  if($dados.Count -ne 1 -or $dados[0].Type -ne 'volume' -or $dados[0].Name -ne $Motor.volumeDados -or !$dados[0].RW -or $binarios.Count -ne 1 -or $binarios[0].Type -ne 'volume' -or $binarios[0].Name -ne $Cache -or !$binarios[0].RW) { throw ('Volumes divergentes: '+$Motor.container) }
  if($portas.Count -ne 1 -or $portas[0].HostIp -ne '127.0.0.1' -or [int]$portas[0].HostPort -ne ([uri]$Motor.origem).Port -or @($Container.HostConfig.PortBindings.PSObject.Properties).Count -ne 1) { throw ('Portas divergentes: '+$Motor.container) }
}
function Recursos-Corretos {
  param($Container,$Recursos)
  return ($Container.HostConfig.Memory -eq ($Recursos.memoriaMiB*1MB) -and $Container.HostConfig.MemorySwap -eq ($Recursos.swapTotalMiB*1MB) -and $Container.HostConfig.NanoCpus -eq ($Recursos.cpus*1000000000L) -and $Container.HostConfig.PidsLimit -eq $Recursos.pids -and $Container.HostConfig.ShmSize -eq ($Recursos.shmMiB*1MB))
}
function Conferir-Cache {
  param([string]$Nome)
  $null=Chamar-Docker -Partes @('exec',$Nome,'test','-x','/opt/ms-playwright-go/node')
  $null=Chamar-Docker -Partes @('exec',$Nome,'test','-f','/opt/ms-playwright-go/package/cli.js')
  $navegador=Chamar-Docker -Partes @('exec',$Nome,'find','/opt/browsers','-type','f','-name','chrome','-print','-quit')
  if(!$navegador -or !$navegador.StartsWith('/opt/browsers/') -or $navegador.Contains("`n")) { throw 'Cache de navegadores nao confirmado. Nao iniciar jobs.' }
  $null=Chamar-Docker -Partes @('exec',$Nome,'test','-x',$navegador)
}
Push-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
try {
  $textoRegistro=& node --import tsx (Join-Path $PSScriptRoot 'motores.mts') ([IO.Path]::GetFullPath($Registro))
  if($LASTEXITCODE -ne 0) { throw 'Registro não validado. Nada foi preparado.' }
  $config=ConvertFrom-Json -InputObject ($textoRegistro -join "`n")
  $imagem=@(ConvertFrom-Json -InputObject (Chamar-Docker -Partes @('image','inspect',$config.imagem)))[0]
  if(!(Chamar-Docker -Partes @('volume','inspect',$config.volumeCache) -AceitarAusente)) { throw 'Cache original ausente. Não recriar nem substituir o volume.' }
  $existentes=@{}
  foreach($motor in $config.motores) {
    $container=Ler-Container -Nome $motor.container
    if($null -ne $container) {
      Conferir-Estrutura -Motor $motor -Container $container -ImagemId $imagem.Id -Cache $config.volumeCache
      $existentes[$motor.id]=$container
      if($motor.id -ne '01' -and !(Recursos-Corretos -Container $container -Recursos $config.recursos)) { throw ('Limites divergentes: '+$motor.container) }
    }
  }
  if(!$existentes.ContainsKey('01')) { throw 'Motor original ausente. Não será recriado.' }
  if($Acao -eq 'Preparar') {
    if(!$existentes['01'].State.Running) { throw 'Inicie o motor original para conferir os jobs antes da preparação.' }
    $jobs=Invoke-RestMethod -Method Get -Uri ($config.motores[0].origem+'/api/v1/jobs') -TimeoutSec 5
    if($null -eq $jobs) { $jobs=@() }
    foreach($job in @($jobs)) {
      $situacao=[string]$job.Status
      if($situacao -notin @('ok','failed')) { throw 'Motor original ocupado ou retorno desconhecido. Preparação suspensa.' }
    }
    Conferir-Cache -Nome $config.motores[0].container
    if(!(Recursos-Corretos -Container $existentes['01'] -Recursos $config.recursos)) {
      if($existentes['01'].HostConfig.ShmSize -ne ($config.recursos.shmMiB*1MB)) { throw 'SHM do original divergente; não recriar container.' }
      $null=Chamar-Docker -Partes @('update','--memory',($config.recursos.memoriaMiB.ToString()+'m'),'--memory-swap',($config.recursos.swapTotalMiB.ToString()+'m'),'--cpus',([string]$config.recursos.cpus),'--pids-limit',([string]$config.recursos.pids),$config.motores[0].container)
    }
    foreach($motor in $config.motores | Where-Object {$_.id -ne '01'}) {
      if(!$existentes.ContainsKey($motor.id)) {
        if(!(Chamar-Docker -Partes @('volume','inspect',$motor.volumeDados) -AceitarAusente)) { $null=Chamar-Docker -Partes @('volume','create',$motor.volumeDados) }
        $null=Chamar-Docker -Partes @('create','--name',$motor.container,'--label',('crm.google.motor='+$motor.id),'--restart','no','--publish',('127.0.0.1:'+([uri]$motor.origem).Port+':8080'),'--memory',($config.recursos.memoriaMiB.ToString()+'m'),'--memory-swap',($config.recursos.swapTotalMiB.ToString()+'m'),'--cpus',([string]$config.recursos.cpus),'--pids-limit',([string]$config.recursos.pids),'--shm-size',($config.recursos.shmMiB.ToString()+'m'),'--mount',('type=volume,source='+$motor.volumeDados+',target=/gmapsdata'),'--mount',('type=volume,source='+$config.volumeCache+',target=/opt'),'--env','PLAYWRIGHT_BROWSERS_PATH=/opt/browsers','--env','PLAYWRIGHT_DRIVER_PATH=/opt/ms-playwright-go',$config.imagem,'-web','-data-folder','/gmapsdata','-c','2')
        $null=Chamar-Docker -Partes @('start',$motor.container)
      } elseif(!$existentes[$motor.id].State.Running) { $null=Chamar-Docker -Partes @('start',$motor.container) }
    }
  }
  $resumo=@()
  foreach($motor in $config.motores) {
    $container=Ler-Container -Nome $motor.container
    $pronto=$false
    if($null -ne $container) {
      Conferir-Estrutura -Motor $motor -Container $container -ImagemId $imagem.Id -Cache $config.volumeCache
      $pronto=($container.State.Running -and (Recursos-Corretos -Container $container -Recursos $config.recursos))
      if($pronto) { Conferir-Cache -Nome $motor.container }
    }
    $resumo+=@{motor=$motor.id;container=$motor.container;pronto=$pronto}
  }
  $todos=(@($resumo | Where-Object {!$_.pronto}).Count -eq 0)
  ConvertTo-Json -InputObject @{ok=$todos;motores=$resumo} -Depth 5 -Compress
  if(!$todos) { exit 2 }
} finally { Pop-Location }