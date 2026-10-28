import { afterEach, expect, test, vi } from 'vitest'
import { bancoInicial } from '@/src/lib/banco-empresas'
import type { FiltrosBusca } from '@/src/features/busca-empresas/tipos'
import { criarClienteCasaDados, normalizarRespostaCasa } from './cliente'
const filtros = (): FiltrosBusca => ({ palavra: '', cnae: '4755502', uf: 'SP', cidade: 'São Paulo', bairro: 'Brás', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 1, offset: 0 })
const empresa = () => ({ cnpj: '11222333000181', razao_social: 'Armarinhos fictício LTDA', nome_fantasia: 'Loja fictícia', data_abertura: '2020-01-15T00:00:00Z', capital_social: 20000, porte_empresa: { codigo: '01', descricao: 'Micro Empresa' }, situacao_cadastral: { situacao_atual: 'ATIVA', motivo: '', data: '2020-01-15' }, codigo_natureza_juridica: '2062', descricao_natureza_juridica: 'Sociedade Empresária Limitada', endereco: { cep: '01001-000', tipo_logradouro: 'Rua', logradouro: 'fictícia', numero: '10', complemento: '', bairro: 'Brás', uf: 'SP', municipio: 'São Paulo' }, atividade_principal: { codigo: '4755502', descricao: 'Comércio varejista de artigos de armarinho' }, atividade_secundaria: [{ codigo: '4742300', descricao: 'Comércio de material elétrico' }], mei: { optante: false, cpf: 'DOCUMENTO-MEI-NAO-EXPOR' }, simples: { optante: true }, bloqueado: false, contato_telefonico: [{ completo: '11988887777', ddd: '11', numero: '988887777', tipo: 'CELULAR' }], contato_email: [{ email: 'COMERCIAL@EXEMPLO.TEST', valido: true, dominio: 'exemplo.test' }], quadro_societario: [{ nome: 'Sócio fictício', qualificacao_socio: 'Sócio-Administrador', qualificacao_socio_codigo: 49, documento: '***111222**', data_entrada_sociedade: '2020-01-15T00:00:00Z', pais_socio: '', nome_representante_legal: 'Representante fictício', cpf_representante_legal: '***333444**', faixa_etaria_descricao: 'Faixa fictícia' }] })
const resposta = () => ({ total: 711, cnpjs: [empresa()] })
afterEach(() => vi.restoreAllMocks())
test('faz uma única chamada completa com chave apenas no header e origem fixa', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(resposta()))
  const r = await criarClienteCasaDados('chave-teste', fetcher).buscar(filtros())
  expect(r.ok).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe('https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=completo')
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { 'api-key': 'chave-teste' }, redirect: 'error', cache: 'no-store' })
  expect(fetcher.mock.calls[0][1].body).not.toContain('chave-teste')
})
test('normaliza o contrato completo observado, inclusive datas com horário e contatos estruturados', () => {
  const r = normalizarRespostaCasa(resposta(), filtros())
  expect(r.ok).toBe(true); if (!r.ok) return
  expect(r.empresas[0]).toMatchObject({ telefone: '11988887777', telefones: ['11988887777'], email: 'comercial@exemplo.test', data_abertura: '2020-01-15', porte: 'ME', situacao: 'ATIVA', cep: '01001000', cnae_principal: '4755502', cidade: 'São Paulo', uf: 'SP', detalhes: { capital_social: '20000.00', regime_tributario: ['Simples Nacional'] } })
  expect(JSON.stringify(r)).not.toContain('DOCUMENTO-MEI')
  expect(JSON.stringify(r)).not.toContain('111222')
})
test('sócios completos são normalizados apenas quando solicitados para sanitização posterior no banco', () => {
  const f = { ...filtros(), avancados: { ...bancoInicial(), socios: true } }
  const r = normalizarRespostaCasa(resposta(), f)
  expect(r.ok).toBe(true); if (!r.ok) return
  expect(r.empresas[0].detalhes?.socios?.[0]).toMatchObject({ nome: 'Sócio fictício', funcao: { codigo: '49', descricao: 'Sócio-Administrador' }, cnpj_cpf_socio: '***111222**', representante_legal: { nome: 'Representante fictício', cpf: '***333444**' } })
})
test('contatos ausentes ou inválidos permanecem sem telefone/email inventado', () => {
  const a = empresa(); a.contato_telefonico = []; a.contato_email[0].valido = false
  const r = normalizarRespostaCasa({ total: 1, cnpjs: [a] }, filtros())
  expect(r.ok).toBe(true); if (r.ok) expect(r.empresas[0]).toMatchObject({ telefone: null, telefones: [], email: null })
})
test('bloqueio do fornecedor, CNPJ inválido e quantidade além da solicitada são recusados', () => {
  expect(normalizarRespostaCasa({ total: 1, cnpjs: [{ ...empresa(), bloqueado: true }] }, filtros())).toEqual({ ok: false, motivo: 'resposta_invalida' })
  expect(normalizarRespostaCasa({ total: 1, cnpjs: [{ ...empresa(), cnpj: '00000000000000' }] }, filtros())).toEqual({ ok: false, motivo: 'resposta_invalida' })
  expect(normalizarRespostaCasa({ total: 2, cnpjs: [empresa(), empresa()] }, filtros())).toEqual({ ok: false, motivo: 'resposta_invalida' })
})
test.each([[401, 'credencial_invalida'], [403, 'sem_creditos'], [429, 'fornecedor_ocupado'], [500, 'fornecedor_indisponivel']] as const)('classifica HTTP %s sem retry', async (status, motivo) => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status }))
  expect(await criarClienteCasaDados('chave-teste', fetcher).buscar(filtros())).toEqual({ ok: false, motivo })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
test('chave ausente ou com quebra de linha e filtros incompatíveis não fazem HTTP', async () => {
  const fetcher = vi.fn()
  expect(await criarClienteCasaDados('', fetcher).buscar(filtros())).toEqual({ ok: false, motivo: 'nao_configurado' })
  expect(await criarClienteCasaDados('invalida\nchave', fetcher).buscar(filtros())).toEqual({ ok: false, motivo: 'nao_configurado' })
  expect(await criarClienteCasaDados('chave-teste', fetcher).buscar({ ...filtros(), quantidade: 2, offset: 1 })).toEqual({ ok: false, motivo: 'resposta_invalida' })
  expect(fetcher).not.toHaveBeenCalled()
})
test('falha de rede não repete pesquisa', async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError('rede'))
  expect(await criarClienteCasaDados('chave-teste', fetcher).buscar(filtros())).toEqual({ ok: false, motivo: 'fornecedor_indisponivel' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
test('recusa resposta maior que 2MB e JSON inválido', async () => {
  expect(await criarClienteCasaDados('chave-teste', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'content-length': '2000001' } }))).buscar(filtros())).toEqual({ ok: false, motivo: 'resposta_invalida' })
  expect(await criarClienteCasaDados('chave-teste', vi.fn().mockResolvedValue(new Response('invalido'))).buscar(filtros())).toEqual({ ok: false, motivo: 'resposta_invalida' })
})
