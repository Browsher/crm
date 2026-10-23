// Exclusivo do subprocesso local E2E. O cliente de produção continua inalterado.
const banco = new URL(process.env.DATABASE_URL || 'postgres://invalido/invalido')
const mock = new URL(process.env.CNPJ_BIZ_MOCK_URL || 'http://invalido')
if (process.env.CRM_E2E !== '1' || process.env.ALVO ||
    banco.username !== 'app_teste' || !['localhost', '127.0.0.1', '[::1]'].includes(banco.hostname) ||
    !/^\/teste_[0-9a-f]{12}$/.test(banco.pathname) || banco.search ||
    mock.protocol !== 'http:' || mock.hostname !== '127.0.0.1' || !mock.port ||
    mock.username || mock.password || mock.pathname !== '/' || mock.search || mock.hash ||
    process.env.CNPJ_BIZ_API_KEY !== 'chave-apenas-e2e') {
  throw new Error('Ambiente de simulação CNPJ.biz inválido')
}
const original = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.hostname !== 'cnpj.biz') return original(input, init)
  if (url.origin !== 'https://cnpj.biz' || !['/api/v2/atividades/buscar', '/api/v2/naturezas-juridicas/buscar', '/api/v2/empresas/contar', '/api/v2/empresas/listar-com-dados'].includes(url.pathname)) {
    return Promise.reject(new Error('Rota CNPJ.biz fora da simulação'))
  }
  const destino = new URL(url.pathname, mock)
  return original(input instanceof Request ? new Request(destino, input) : destino, init)
}
