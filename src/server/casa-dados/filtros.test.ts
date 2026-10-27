import { expect, test } from 'vitest'
import { bancoInicial } from '@/src/lib/banco-empresas'
import type { FiltrosBusca } from '@/src/features/busca-empresas/tipos'
import { prepararConsultaCasa } from './filtros'
const base = (): FiltrosBusca => ({ palavra: '', cnae: '4755502', uf: 'SP', cidade: 'São Paulo', bairro: 'Brás', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 1, offset: 0 })
const completo = (patch = {}): FiltrosBusca => ({ ...base(), avancados: { ...bancoInicial(), cnaes: ['4755502'], regioes: [{ estado: 'SP', cidade: 'São Paulo', bairros: ['Brás'] }], ...patch } })
function pedido(f: FiltrosBusca) { const r = prepararConsultaCasa(f); expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.erro); return r.pedido }

test('mapeia CNAE e região diretamente sem IDs de outro fornecedor', () => {
  expect(pedido(base())).toMatchObject({ limite: 1, pagina: 1, codigo_atividade_principal: ['4755502'], uf: ['sp'], municipio: ['sao paulo'], bairro: ['bras'], situacao_cadastral: ['ATIVA'], mais_filtros: { com_telefone: true, excluir_empresas_visualizadas: true } })
})
test('nome e fantasia usam o modo radical documentado sem pesquisar sócios', () => {
  expect(pedido(completo({ palavras: ['armarinhos', 'variedades'] }))).toHaveProperty('busca_textual', [{ texto: ['armarinhos', 'variedades'], tipo_busca: 'radical', razao_social: true, nome_fantasia: true, nome_socio: false }])
})
test('CNAE secundário e busca em ambos conservam o significado', () => {
  expect(pedido(completo({ atividadeTipo: ['secundaria'] }))).toHaveProperty('codigo_atividade_secundaria', ['4755502'])
  expect(pedido(completo({ atividadeTipo: ['principal', 'secundaria'] }))).toMatchObject({ codigo_atividade_principal: ['4755502'], incluir_atividade_secundaria: true })
})
test('Brasil inteiro e múltiplos estados inteiros não acrescentam cidade', () => {
  const brasil = pedido(completo({ regioes: [] }))
  expect(brasil).not.toHaveProperty('uf'); expect(brasil).not.toHaveProperty('municipio')
  expect(pedido(completo({ regioes: [{ estado: 'SP', cidade: '', bairros: [] }, { estado: 'RJ', cidade: '', bairros: [] }] }))).toMatchObject({ uf: ['sp', 'rj'] })
})
test('cidades da mesma UF com bairros iguais são representáveis', () => {
  expect(pedido(completo({ regioes: [{ estado: 'SP', cidade: 'São Paulo', bairros: ['Centro'] }, { estado: 'SP', cidade: 'Guarulhos', bairros: ['Centro'] }] }))).toMatchObject({ uf: ['sp'], municipio: ['sao paulo', 'guarulhos'], bairro: ['centro'] })
})
test.each([
  [{ estado: 'SP', cidade: 'São Paulo', bairros: ['Brás'] }, { estado: 'RJ', cidade: 'Rio de Janeiro', bairros: ['Centro'] }],
  [{ estado: 'SP', cidade: 'São Paulo', bairros: [] }, { estado: 'SP', cidade: 'Guarulhos', bairros: ['Centro'] }],
  [{ estado: 'SP', cidade: '', bairros: [] }, { estado: 'RJ', cidade: 'Rio de Janeiro', bairros: [] }],
])('não amplia regiões por cruzamento silencioso de arrays (%j)', (...regioes) => {
  expect(prepararConsultaCasa(completo({ regioes }))).toMatchObject({ ok: false })
})
test('regime sem equivalente e combinação MEI com outro porte falham antes do HTTP', () => {
  expect(prepararConsultaCasa(completo({ regimes: ['Lucro Real'] }))).toMatchObject({ ok: false })
  expect(prepararConsultaCasa(completo({ portes: ['MEI', 'EPP'] }))).toMatchObject({ ok: false })
  expect(pedido(completo({ portes: ['MEI'], regimes: ['Simples Nacional'] }))).toMatchObject({ mei: { optante: true }, simples: { optante: true } })
})
test('contatos com E mapeiam flags; OR de telefone/e-mail não é trocado por E', () => {
  expect(pedido(completo({ contato: 'celulareemail' }))).toHaveProperty('mais_filtros', { com_telefone: true, somente_celular: true, com_email: true, excluir_empresas_visualizadas: true })
  expect(prepararConsultaCasa(completo({ contato: 'telefoneoucelularouemail' }))).toMatchObject({ ok: false })
})
test('página substitui offset arbitrário sem solicitar empresas extras', () => {
  expect(pedido({ ...base(), quantidade: 10, offset: 20 })).toMatchObject({ limite: 10, pagina: 3 })
  expect(prepararConsultaCasa({ ...base(), quantidade: 10, offset: 3 })).toMatchObject({ ok: false })
})
test('capital, abertura, natureza, situação e portes conservam os valores', () => {
  expect(pedido(completo({ capitalMinimo: '1000', capitalMaximo: '5000', aberturaDe: '2020-01-01', aberturaAte: '2025-01-01', naturezas: ['2062'], portes: ['ME', 'EPP'], tipos: ['2'], situacoes: ['ativa'], ddds: ['11'], semEmailContabil: true }))).toMatchObject({ capital_social: { minimo: 1000, maximo: 5000 }, data_abertura: { inicio: '2020-01-01', fim: '2025-01-01' }, codigo_natureza_juridica: ['2062'], porte_empresa: { codigos: ['01', '03'] }, matriz_filial: 'MATRIZ', ddd: ['11'], mais_filtros: { excluir_email_contab: true } })
})


test('capital fracionário é recusado sem arredondar ou consumir cota', () => {
  expect(prepararConsultaCasa(completo({ capitalMinimo: '1000.50' }))).toMatchObject({ ok: false })
  expect(prepararConsultaCasa(completo({ capitalMaximo: '5000.01' }))).toMatchObject({ ok: false })
})


test('novas listas CNAE são independentes e não ativam mistura de atividades',()=>{
 const r=pedido(completo({cnaes:['4755502'],cnaesSecundarios:['4742300']}))
 expect(r).toMatchObject({codigo_atividade_principal:['4755502'],codigo_atividade_secundaria:['4742300']})
 expect(r.incluir_atividade_secundaria).not.toBe(true)
 const soSecundario=pedido(completo({cnaes:[],cnaesSecundarios:['4742300']}))
 expect(soSecundario).not.toHaveProperty('codigo_atividade_principal')
 expect(soSecundario).toHaveProperty('codigo_atividade_secundaria',['4742300'])
})
test('últimos dias e exclusões são traduzidos sem confundir os dois regimes',()=>{
 expect(pedido(completo({aberturaUltimosDias:'7',excluirMei:true,meiExclusaoDe:'2026-01-01',excluirSimples:true,simplesExclusaoAte:'2026-10-01'}))).toMatchObject({
 data_abertura:{ultimos_dias:7},mei:{excluir_optante:true,data_exclusao:{inicio:'2026-01-01'}},simples:{excluir_optante:true,data_exclusao:{fim:'2026-10-01'}}})
})
