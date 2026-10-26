import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { carregarMotores, lerRegistro } from '../scripts/google/motores.mts'
const executar = promisify(execFile)
const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh'

test('registro preserva os tres motores e suas pastas', async () => {
  expect((await carregarMotores()).map(m => [m.id, m.origem, m.pastaEstado])).toEqual([
    ['01','http://127.0.0.1:8087','.google-agente'],
    ['02','http://127.0.0.1:8088','.google-agente/slots/02'],
    ['03','http://127.0.0.1:8089','.google-agente/slots/03'],
  ])
  expect(await lerRegistro()).toMatchObject({ versao: 1, imagem: 'gosom/google-maps-scraper@sha256:e205c02913c5a69c16fc2094b8e5b194a2f655166d2c1126d50548d216e6b1b2', recursos: { memoriaMiB:2048,swapTotalMiB:2560,cpus:2,pids:512,shmMiB:64 } })
})

test.each(['origem','dados','imagem','porta','id'])('registro recusa %s divergente',async campo=>{
  const pasta=await mkdtemp(join(tmpdir(),'crm-motores-'))
  try {
    const registro=JSON.parse(await readFile('scripts/google/motores.json','utf8'))
    if(campo==='origem')registro.motores[1].origem='https://exemplo.org'
    if(campo==='dados')registro.motores[1].volumeDados=registro.motores[0].volumeDados
    if(campo==='imagem')registro.imagem='gosom/google-maps-scraper:latest'
    if(campo==='porta')registro.motores[1].origem='http://user:pass@127.0.0.1:8087'
    if(campo==='id')registro.motores[1].id='01'
    const arquivo=join(pasta,'registro.json')
    await writeFile(arquivo,JSON.stringify(registro))
    await expect(carregarMotores(arquivo)).rejects.toThrow()
  } finally { await rm(pasta,{recursive:true,force:true}) }
})

async function preparar(cenario: 'normal'|'conflito'|'ocupado') {
  const pasta=await mkdtemp(join(tmpdir(),'crm-docker-fixture-'))
  const fixture=join(pasta,'fixture.ps1')
  const log=join(pasta,'comandos.jsonl')
  const fonte=String.raw`
$ErrorActionPreference='Stop'
$global:crmFixtureCriados=@{}
function docker {
  $partes=@($args)
  [IO.File]::AppendAllText($env:FIXTURE_LOG,((ConvertTo-Json -InputObject $partes -Compress)+[Environment]::NewLine))
  $global:LASTEXITCODE=0
  if($partes[0] -eq 'image') { '[{"Id":"sha256:imagem-validada"}]'; return }
  if($partes[0] -eq 'volume') { '[{"Name":"volume-existente"}]'; return }
  if($partes[0] -eq 'create') { $global:crmFixtureCriados[$partes[2]]=$true; 'novo'; return }
  if($partes[0] -eq 'inspect') {
    $nome=$partes[1]
    if($nome -ne 'gmaps-mooca-prospeccao' -and !$global:crmFixtureCriados.ContainsKey($nome)) { $global:LASTEXITCODE=1; Write-Error 'fixture: container ausente'; return }
    $posicao=if($nome -eq 'gmaps-mooca-prospeccao'){'01'}elseif($nome -eq 'gmaps-crm-motor-02'){'02'}else{'03'}
    $porta=if($posicao -eq '01'){'8087'}elseif($posicao -eq '02'){'8088'}else{'8089'}
    $volume=if($posicao -eq '01'){'mooca-prospeccao_gmaps_data'}else{'crm_google_motor'+$posicao+'_data'}
    $imagem=if($env:FIXTURE_CENARIO -eq 'conflito'){'imagem-incompativel'}else{'sha256:imagem-validada'}
    $config=@{Id=('container-'+$posicao);Image=$imagem;State=@{Running=$true};Config=@{Cmd=@('-web','-data-folder','/gmapsdata','-c','2')};HostConfig=@{Memory=2147483648L;MemorySwap=2684354560L;NanoCpus=2000000000L;PidsLimit=512;ShmSize=67108864;PortBindings=@{'8080/tcp'=@(@{HostIp='127.0.0.1';HostPort=$porta})}};Mounts=@(@{Type='volume';Name=$volume;Destination='/gmapsdata';RW=$true},@{Type='volume';Name='mooca-prospeccao_gmaps_cache';Destination='/opt';RW=$true})}
    ConvertTo-Json -InputObject @($config) -Depth 12 -Compress; return
  }
  if($partes[0] -eq 'exec') { if($env:FIXTURE_CENARIO -eq 'ocupado'){'working'}else{'cache-ok'}; return }
  'ok'
}
function Invoke-RestMethod { param($Uri,$Method,$TimeoutSec); if($env:FIXTURE_CENARIO -eq 'ocupado') { return @(@{Status='working'}) }; return @() }
& $env:FIXTURE_SCRIPT -Acao Preparar
& $env:FIXTURE_SCRIPT -Acao Preparar
`
  await writeFile(fixture,fonte)
  try {
    let falhou=false
    let erro=''
    try { await executar(powershell,['-NoProfile','-NonInteractive','-File',fixture],{env:{...process.env,FIXTURE_SCRIPT:resolve('scripts/google/motores.ps1'),FIXTURE_LOG:log,FIXTURE_CENARIO:cenario},timeout:25000}) } catch (e) { falhou=true; erro=String((e as {stderr?:string}).stderr || e) }
    const comandos=(await readFile(log,'utf8').catch(()=>'' )).trim().split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l) as string[])
    return {falhou,comandos,erro}
  } finally { await rm(pasta,{recursive:true,force:true}) }
}

test('preparacao idempotente cria somente motores 02 e 03 sem remover recursos',async()=>{
  const {falhou,comandos,erro}=await preparar('normal')
  expect(falhou,erro).toBe(false)
  expect(comandos.filter(c=>c[0]==='create').map(c=>c[2])).toEqual(['gmaps-crm-motor-02','gmaps-crm-motor-03'])
  expect(comandos.some(c=>['rm','remove','prune','kill'].includes(c[0]))).toBe(false)
  expect(comandos.filter(c=>c[0]==='create').every(c=>c.includes('127.0.0.1:8088:8080')||c.includes('127.0.0.1:8089:8080'))).toBe(true)
},60000)

test('container divergente interrompe preparacao antes de criar ou apagar',async()=>{
  const {falhou,comandos}=await preparar('conflito')
  expect(falhou).toBe(true)
  expect(comandos.some(c=>['create','update','rm'].includes(c[0]))).toBe(false)
},30000)
test('motor original com job ativo impede criar motores e alterar limites',async()=>{
  const {falhou,comandos}=await preparar('ocupado')
  expect(falhou).toBe(true)
  expect(comandos.some(c=>['create','update','rm'].includes(c[0]))).toBe(false)
},30000)