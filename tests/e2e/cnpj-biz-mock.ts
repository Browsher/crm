import { once } from 'node:events'
import { createServer } from 'node:http'
import { criarClienteCnpjBiz } from '../../src/server/cnpj-biz/cliente'
import type { BancoDeTeste } from '../integracao/ajuda'
import { CLIENTE_REDESIGN } from './dados-redesign'
import type { FiltrosBusca } from '../../src/features/busca-empresas/tipos'

export const FILTROS_DEMO: FiltrosBusca = { palavra: 'iluminação', cnae: '4742300', uf: 'SP', cidade: 'São Paulo', bairro: '', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 2, offset: 0 }
const empresas = [
  { cnpj: '99887766000105', razao_social: 'Luminárias Horizonte fictícia', nome_fantasia: null,
    email: 'comercial@horizonte.example', data_abertura: '2020-01-15', situacao: 'ATIVA', porte_empresa: 'ME',
    endereco: { tipo_logradouro: 'Rua', logradouro: 'de demonstração', numero: '120', complemento: 'Sala 2', bairro: 'Centro', cidade: { nome: 'São Paulo' }, estado: { sigla: 'SP' } },
    telefones: ['11955550123'], atividades_principal: ['47.42-3-00 - Comércio varejista de material elétrico'] },
  { cnpj: '99887766000288', razao_social: 'Comércio sem telefone fictício', nome_fantasia: null,
    email: 'contato@semtelefone.example', data_abertura: '2022-03-10', situacao: 'ATIVA', porte_empresa: 'ME',
    endereco: { bairro: 'Centro', cidade: { nome: 'São Paulo' }, estado: { sigla: 'SP' } },
    telefones: [], atividades_principal: ['47.42-3-00 - Comércio varejista de material elétrico'] },
]

const empresasCasa = empresas.map(e => ({ cnpj: e.cnpj, razao_social: e.razao_social, nome_fantasia: e.nome_fantasia,
  data_abertura: e.data_abertura + 'T00:00:00Z', situacao_cadastral: { situacao_atual: e.situacao }, porte_empresa: { codigo: '01', descricao: 'Micro Empresa' },
  endereco: { ...e.endereco, cidade: undefined, estado: undefined, municipio: e.endereco.cidade.nome, uf: e.endereco.estado.sigla },
  contato_telefonico: e.telefones.map(t => ({ completo: t, ddd: t.slice(0, 2), numero: t.slice(2) })), contato_email: [{ email: e.email, valido: true }],
  atividade_principal: { codigo: '4742300', descricao: 'Comércio varejista de material elétrico' }, bloqueado: false }))

export async function prepararBuscaDemo(banco: BancoDeTeste) {
  const [{ id }] = await banco.sql<{ id: string }>("SELECT id FROM usuario WHERE email='redesigne2e@teste.local'")
  await banco.sql('INSERT INTO busca_empresa_limite(usuario_id,limite_diario) VALUES($1,20)', [id])
  const resultado = await criarClienteCnpjBiz('chave-apenas-e2e', async (url) => Response.json(String(url).includes('/atividades/') ? [{ atividade_id: 1, codigo: '47.42-3-00' }] : empresas)).buscar(FILTROS_DEMO)
  if (!resultado.ok || resultado.empresas.length !== 2) throw new Error('Fixture CNPJ.biz inválida')
  await banco.sql(`INSERT INTO busca_empresa(id,usuario_id,nome,filtros,quantidade,estado,empresas,concluido_em)
    VALUES('00000000-0000-4000-8000-000000009f01',$1,'Iluminação em São Paulo — demonstração',$2,2,'concluida',$3,now())`, [id, JSON.stringify(FILTROS_DEMO), JSON.stringify(resultado.empresas)])
  await banco.sql(`INSERT INTO empresa_dados_cadastrais(empresa_id,fonte,coletado_em,situacao,porte,data_abertura,logradouro,numero,bairro,cidade,uf,telefones)
    VALUES($1,'CNPJ.biz',now(),'ATIVA','ME','2020-01-15','Rua de demonstração','120','Centro','São Paulo','SP','["11955559701"]')`, [CLIENTE_REDESIGN])
  const [{ id: googleEmpresa }] = await banco.sql<{ id: string }>("INSERT INTO empresa(nome_fantasia,telefone) VALUES('Loja Google de demonstração','11955550456') RETURNING id")
  await banco.sql("INSERT INTO empresa_origem_google(google_place_id,empresa_id) VALUES('google-demo-integracao',$1)", [googleEmpresa])
  await banco.sql("INSERT INTO grupo_importacao(id,nome,origem,vinculadas) VALUES('00000000-0000-4000-8000-000000009f02','Google — lista de demonstração','Google Maps',1)")
  await banco.sql("INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES('00000000-0000-4000-8000-000000009f02',$1)", [googleEmpresa])
  const buscaPessoal='00000000-0000-4000-8000-000000009f03'
  const pessoal={...resultado.empresas[0],cnpj:'99887766000369',razao_social:'Armarinhos Horizonte (fictícia)',nome_fantasia:null,telefone:'11955550888',telefones:['11955550888'],cnae_principal:'4755502'}
  await banco.comoUsuario(id,async sql=>{
    await sql('SELECT busca_empresa_reservar($1,$2,$3)',[buscaPessoal,'Armarinhos · Centro · São Paulo/SP',JSON.stringify({...FILTROS_DEMO,palavra:'Armarinhos',cnae:'4755502',quantidade:1})])
    await sql('SELECT busca_empresa_concluir($1,$2,NULL)',[buscaPessoal,JSON.stringify([pessoal])])
    await sql('SELECT * FROM busca_empresa_importar($1,$2)',[buscaPessoal,[pessoal.cnpj]])
  })
}

// Importado somente pelo harness. Nunca faz requisições ao fornecedor.
export async function iniciarCnpjBizDeTeste() {
  let consultas = 0
  const servidor = createServer(async (pedido, resposta) => {
    resposta.setHeader('Content-Type', 'application/json')
    if (pedido.method === 'GET' && pedido.url === '/estatisticas') { resposta.end(JSON.stringify({ consultas })); return }
    if (pedido.url === '/v5/cnpj/pesquisa?tipo_resultado=completo') {
      if (pedido.method !== 'POST' || pedido.headers['api-key'] !== 'chave-apenas-e2e') { resposta.writeHead(403).end('{}'); return }
      let corpo = ''
      for await (const parte of pedido) { corpo += parte; if (corpo.length > 20_000) { resposta.writeHead(413).end('{}'); return } }
      try {
        const filtros = JSON.parse(corpo)
        consultas++
        if (filtros.busca_textual?.texto?.includes('falha simulada')) { resposta.writeHead(403).end('{}'); return }
        resposta.end(JSON.stringify({ total: 2, cnpjs: empresasCasa.slice(0, Math.min(2, Number(filtros.limite) || 1)) }))
      } catch { resposta.writeHead(400).end('{}') }
      return
    }
    if (pedido.method !== 'POST' || pedido.headers.authorization !== 'Bearer chave-apenas-e2e') { resposta.writeHead(403).end('{}'); return }
    if (pedido.url === '/api/v2/atividades/buscar') { resposta.end(JSON.stringify([{ atividade_id: 1, codigo: '47.42-3-00' }])); return }
    if (pedido.url === '/api/v2/naturezas-juridicas/buscar') { resposta.end(JSON.stringify([{natureza_juridica_id:10,codigo:'206-2',nome:'Sociedade Empresária Limitada'}])); return }
    if (pedido.url === '/api/v2/empresas/contar') {resposta.end(JSON.stringify({result:true,count:'2'}));return}
    if (pedido.url !== '/api/v2/empresas/listar-com-dados') { resposta.writeHead(404).end('{}'); return }
    let corpo = ''
    for await (const parte of pedido) {
      corpo += parte
      if (corpo.length > 20_000) { resposta.writeHead(413).end('{}'); return }
    }
    try {
      const filtros = JSON.parse(corpo)
      consultas++
      if (filtros.razao_fantasia?.includes('falha simulada')) { resposta.writeHead(402).end('{}'); return }
      resposta.end(JSON.stringify(empresas.slice(0, Math.min(2, Number(filtros.limit) || 1))))
    } catch { resposta.writeHead(400).end('{}') }
  })
  servidor.listen(0, '127.0.0.1')
  await once(servidor, 'listening')
  const endereco = servidor.address()
  if (!endereco || typeof endereco === 'string') throw new Error('Porta do mock CNPJ indisponível')
  return { url: `http://127.0.0.1:${endereco.port}`, fechar: async () => {
    servidor.closeAllConnections()
    await new Promise<void>((resolve, reject) => servidor.close(erro => erro ? reject(erro) : resolve()))
  } }
}
