import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Motor } from './coordenador-tipos.mts'
export type Registro = { versao: 1; imagem: string; volumeCache: string; recursos: { memoriaMiB: number; swapTotalMiB: number; cpus: number; pids: number; shmMiB: number }; motores: (Motor & { volumeDados: string })[] }
const imagem = 'gosom/google-maps-scraper@sha256:e205c02913c5a69c16fc2094b8e5b194a2f655166d2c1126d50548d216e6b1b2'
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const padroes = [
  ['01','gmaps-mooca-prospeccao','http://127.0.0.1:8087','.google-agente','mooca-prospeccao_gmaps_data'],
  ['02','gmaps-crm-motor-02','http://127.0.0.1:8088','.google-agente/slots/02','crm_google_motor02_data'],
  ['03','gmaps-crm-motor-03','http://127.0.0.1:8089','.google-agente/slots/03','crm_google_motor03_data'],
]
export async function lerRegistro(arquivo = fileURLToPath(new URL('./motores.json', import.meta.url))): Promise<Registro> {
  const r: unknown = JSON.parse(await readFile(arquivo,'utf8'))
  if (!objeto(r) || r.versao !== 1 || r.imagem !== imagem || r.volumeCache !== 'mooca-prospeccao_gmaps_cache' || !objeto(r.recursos)
    || Object.entries({memoriaMiB:2048,swapTotalMiB:2560,cpus:2,pids:512,shmMiB:64}).some(([k,v]) => !objeto(r.recursos) || r.recursos[k] !== v) || !Array.isArray(r.motores) || r.motores.length !== 3) throw new Error('Registro de motores divergente da configuração revisada.')
  for (const [i, valores] of padroes.entries()) {
    const m = r.motores[i]
    if (!objeto(m) || ['id','container','origem','pastaEstado','volumeDados'].some((k,j) => m[k] !== valores[j])) throw new Error('Motor, porta, volume ou pasta divergente da configuração revisada.')
  }
  return r as Registro
}
export async function carregarMotores(arquivo?: string): Promise<readonly Motor[]> {
  return (await lerRegistro(arquivo)).motores.map(({id,container,origem,pastaEstado}) => ({id,container,origem,pastaEstado}))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await lerRegistro(process.argv[2]))) }
  catch { console.error('Registro de motores inválido. Nenhum recurso foi alterado.'); process.exitCode=1 }
}