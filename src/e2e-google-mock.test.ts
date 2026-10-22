import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'
import { ambienteDoBuild, ambienteDoServidor } from '../tests/e2e/ambiente'

test('harness não herda credenciais Google reais',()=>{
  const origem: NodeJS.ProcessEnv={NODE_ENV:'test',GOOGLE_PLANILHA_PRIVATE_KEY:'chave-real-que-nao-pode-ir',GOOGLE_PLANILHA_CLIENT_EMAIL:'real@real.iam.gserviceaccount.com',GOOGLE_PLANILHA_ID:'real',GOOGLE_PLANILHA_ABA_ID:'5'}
  for(const env of [ambienteDoBuild(origem),ambienteDoServidor(origem,'postgres://app_teste:teste@localhost/teste_0123456789ab')]) {
    expect(env.GOOGLE_PLANILHA_PRIVATE_KEY).toBe('')
    expect(env.GOOGLE_PLANILHA_CLIENT_EMAIL).toBe('')
    expect(env.GOOGLE_PLANILHA_ID).toBe('')
  }
})
test.each([{CRM_E2E:''},{DATABASE_URL:'postgres://app_teste:teste@remoto.test/teste_0123456789ab'},{GOOGLE_PLANILHA_ID:'real'},{GOOGLE_PLANILHA_MOCK_URL:'http://remoto.test:1234'}])('preload Sheets recusa ambiente fora do isolamento: %j',alterado=>{
  const env={...process.env,CRM_E2E:'1',ALVO:'',DATABASE_URL:'postgres://app_teste:teste@localhost/teste_0123456789ab',GOOGLE_PLANILHA_ID:'planilha-somente-e2e',GOOGLE_PLANILHA_ABA_ID:'123',GOOGLE_PLANILHA_CLIENT_EMAIL:'sheets-e2e@crm-test.iam.gserviceaccount.com',GOOGLE_PLANILHA_MOCK_URL:'http://127.0.0.1:1234',...alterado}
  const r=spawnSync(process.execPath,['--import',pathToFileURL(resolve('scripts/e2e/google-planilha-preload.mjs')).href,'-e',''],{env,encoding:'utf8',timeout:10000,windowsHide:true})
  expect(r.status).not.toBe(0)
  expect(r.stderr).toContain('Ambiente de simulação Sheets inválido')
})
