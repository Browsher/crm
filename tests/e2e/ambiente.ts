import { exigirHostLocal } from '../../src/server/db/host-local'

export function exigirAdminLocal(url: string) {
  exigirHostLocal(url)
  const parsed = new URL(url)
  if (parsed.search || !['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('E2E exige URL Postgres local sem parâmetros de conexão')
  }
}

export function ambienteDoBuild(fonte: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...fonte, CRM_E2E: '1', NODE_ENV: 'production', ALVO: '',
    DATABASE_URL: '', DATABASE_URL_ADMIN: '', DATABASE_URL_CONFERENCIA: '', CNPJ_BIZ_API_KEY: '', CNPJ_BIZ_MOCK_URL: '',
    IMPORTACAO_CONFERENCIA_SEGREDO: '', GOOGLE_AGENTE_TOKEN: '', GOOGLE_AGENTE_USUARIO_ID: '', GOOGLE_CRM_URL: '',
    GOOGLE_PLANILHA_ID:'', GOOGLE_PLANILHA_ABA_ID:'', GOOGLE_PLANILHA_CLIENT_EMAIL:'', GOOGLE_PLANILHA_PRIVATE_KEY:'', GOOGLE_PLANILHA_MOCK_URL:'',
    EVOLUTION_API_URL: '', EVOLUTION_API_KEY: '', EVOLUTION_INSTANCE_NAME: '',
    PG_SSL: '', PG_SSL_CA: '', PG_SSL_NOME_SERVIDOR: '',
  }
}

export function ambienteDoServidor(fonte: NodeJS.ProcessEnv, urlApp: string): NodeJS.ProcessEnv {
  exigirAdminLocal(urlApp)
  const url = new URL(urlApp)
  if (url.username !== 'app_teste' || !/^\/teste_[0-9a-f]{12}$/.test(url.pathname) || url.search) {
    throw new Error('E2E exige app_teste em banco temporário, sem parâmetros de conexão')
  }
  return {
    ...fonte,
    DATABASE_URL: urlApp, DATABASE_URL_ADMIN: '', DATABASE_URL_CONFERENCIA: '', CNPJ_BIZ_API_KEY: '', CNPJ_BIZ_MOCK_URL: '',
    ALVO: '', PG_SSL: 'off', PG_SSL_CA: '', PG_SSL_NOME_SERVIDOR: '', GOOGLE_AGENTE_TOKEN: '', GOOGLE_AGENTE_USUARIO_ID: '', GOOGLE_CRM_URL: '',
    GOOGLE_PLANILHA_ID:'', GOOGLE_PLANILHA_ABA_ID:'', GOOGLE_PLANILHA_CLIENT_EMAIL:'', GOOGLE_PLANILHA_PRIVATE_KEY:'', GOOGLE_PLANILHA_MOCK_URL:'',
    CRM_E2E: '1', NODE_ENV: 'production',
    EVOLUTION_API_URL: '', EVOLUTION_API_KEY: '', EVOLUTION_INSTANCE_NAME: '',
    // Exclusivamente teste: nunca herdar a chave real do ambiente pai.
    IMPORTACAO_CONFERENCIA_SEGREDO: 'e2'.repeat(32),
  }
}
