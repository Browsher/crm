import type { QueryResultRow } from 'pg'
import type { FiltrosBusca } from '@/src/features/busca-empresas/tipos'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { bancoInicial } from '@/src/lib/banco-empresas'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outro: string
const filtros: FiltrosBusca = { palavra: 'iluminação', cnae: '', uf: 'SP', cidade: '', bairro: '', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 2, offset: 0 }
const empresa = { cnpj: '11222333000181', razao_social: 'Loja teste LTDA', nome_fantasia: 'Loja teste', email: 'loja@exemplo.test',
  telefone: '11988887777', cep: '01001000', cnae_principal: '4742300', situacao: 'ATIVA', porte: 'ME', data_abertura: '2020-01-15',
  logradouro: 'Praça teste', numero: '10', complemento: 'Sala 2', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', telefones: ['11988887777'] }
const chamar = <T extends QueryResultRow = { resultado: string }>(usuario: string, sql: string, params: unknown[]) => banco.comoUsuario(usuario, e => e<T>(sql, params)).then(r => r.linhas)
const configurar = (limite = 4, pausado = false) => chamar(gestor, 'SELECT busca_empresa_limite_definir($1,$2,$3)', [vendedor, limite, pausado])
const reservar = (id = randomUUID(), usuario = vendedor, f = filtros) => chamar(usuario, 'SELECT busca_empresa_reservar($1,$2,$3) AS resultado', [id, 'Lojas SP', JSON.stringify(f)])
const concluir = (id: string, empresas: unknown[] = [empresa], usuario = vendedor) => chamar(usuario, 'SELECT busca_empresa_concluir($1,$2,NULL)', [id, JSON.stringify(empresas)])
const importar = (id: string, cnpjs = [empresa.cnpj], usuario = vendedor) => chamar<{ grupo_id: string; inseridas: number; vinculadas: number }>(usuario, 'SELECT * FROM busca_empresa_importar($1,$2)', [id, cnpjs])

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'BuscaGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'BuscaVendedor')
  outro = await criarUsuario(banco, 'vendedor', 'BuscaOutro')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM busca_empresa')
  await banco.sql('DELETE FROM busca_empresa_limite')
  await banco.sql('DELETE FROM empresa_dados_cadastrais')
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM empresa_origem_google')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql('DELETE FROM empresa_vinculo')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
  await banco.sql("UPDATE usuario SET ativo=true,senha_provisoria_pendente=false,papel='vendedor' WHERE id=$1", [vendedor])
})
test('sem limite configurado não permite consulta', async () => {
  expect(await reservar()).toEqual([{ resultado: 'limite' }])
})

test('filtros completos persistem com UUID idempotente e validação autoritária no banco',async()=>{
  await configurar(10)
  const avancados={...bancoInicial(),palavras:['iluminação'],regioes:[{estado:'SP' as const,cidade:'São Paulo',bairros:['Brás','Sé']}]}
  const f={...filtros,avancados}
  const id=randomUUID()
  expect(await reservar(id,vendedor,f)).toEqual([{resultado:'ok'}])
  expect(await reservar(id,vendedor,f)).toEqual([{resultado:'repetida'}])
  expect(await banco.sql('SELECT filtros->\'avancados\' AS f FROM busca_empresa WHERE id=$1',[id])).toEqual([{f:avancados}])
  await expect(reservar(randomUUID(),vendedor,{...f,avancados:{...avancados,...{pais:'US'}}})).rejects.toMatchObject({code:'22023'})
  await expect(reservar(randomUUID(),vendedor,{...f,avancados:{...avancados,capitalMinimo:'1000',capitalMaximo:'1'}})).rejects.toMatchObject({code:'22023'})
})

test('detalhes empresariais são persistidos na conferência e na ficha sem campos de sócios',async()=>{
  await configurar()
  const id=randomUUID(),detalhes={capital_social:'20000.00',natureza_juridica:'Sociedade Empresária Limitada',regime_tributario:['Simples Nacional']}
  await reservar(id)
  await concluir(id,[{...empresa,detalhes}])
  await importar(id)
  expect(await banco.sql('SELECT detalhes FROM empresa_dados_cadastrais')).toEqual([{detalhes}])
  const outroId=randomUUID()
  await reservar(outroId)
  await expect(concluir(outroId,[{...empresa,detalhes:{...detalhes,campoDesconhecido:'Não expor'}}])).rejects.toMatchObject({code:'22023'})
})

test('vendedor recebe só nome e função dos sócios; gestor acessa os demais dados protegidos por RLS',async()=>{
  await configurar()
  const id=randomUUID(),socio={nome:'Sócio fictício',cnpj_cpf_socio:'***111222**',funcao:{codigo:'49',descricao:'Sócio-Administrador'},representante_legal:{nome:'Representante fictício',cpf:'***333444**'}}
  await reservar(id)
  await concluir(id,[{...empresa,detalhes:{socios:[socio]}}])
  const [resumo]=await chamar<{empresas:unknown}>(vendedor,'SELECT empresas FROM busca_empresa WHERE id=$1',[id])
  expect(JSON.stringify(resumo)).toContain('Sócio fictício')
  expect(JSON.stringify(resumo)).not.toContain('111222')
  expect(JSON.stringify(resumo)).not.toContain('Representante fictício')
  expect(await chamar(vendedor,'SELECT dados FROM busca_empresa_socios WHERE busca_id=$1',[id])).toEqual([])
  expect(await chamar(gestor,'SELECT dados FROM busca_empresa_socios WHERE busca_id=$1',[id])).toEqual([{dados:[socio]}])
  await importar(id)
  const [{id:empresaId}]=await banco.sql<{id:string}>('SELECT id FROM empresa WHERE cnpj=$1',[empresa.cnpj])
  const ver=(u:string)=>chamar<{detalhes:unknown}>(u,'SELECT detalhes FROM empresa_dados_cadastrais_ler($1)',[empresaId])
  expect(JSON.stringify(await ver(vendedor))).not.toContain('111222')
  expect(JSON.stringify(await ver(gestor))).not.toContain('111222')
})
test('apenas gestor configura limite e senha provisória impede escrita', async () => {
  await expect(chamar(vendedor, 'SELECT busca_empresa_limite_definir($1,10,false)', [vendedor])).rejects.toMatchObject({ code: '42501' })
  await configurar()
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1', [vendedor])
  await expect(reservar()).rejects.toMatchObject({ code: '42501' })
})
test('quota concorrente é reservada antes do HTTP sem ultrapassar o limite', async () => {
  await configurar(2)
  const resultados = await Promise.all([reservar(), reservar(), reservar()])
  expect(resultados.flat().map(r => r.resultado).sort()).toEqual(['limite', 'limite', 'ok'])
  expect(await banco.sql('SELECT count(*)::int AS n FROM busca_empresa')).toEqual([{ n: 1 }])
})
test('repetir mesma chave não consome novamente, divergência é recusada', async () => {
  await configurar(2)
  const id = randomUUID()
  expect(await reservar(id)).toEqual([{ resultado: 'ok' }])
  expect(await reservar(id)).toEqual([{ resultado: 'repetida' }])
  await expect(reservar(id, vendedor, { ...filtros, palavra: 'outro' })).rejects.toMatchObject({ code: '22023' })
  await expect(reservar(id, outro)).rejects.toMatchObject({ code: '42501' })
})
test('pausa bloqueia consulta e importação, mas preserva resultado em andamento', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  await configurar(4, true)
  expect(await reservar()).toEqual([{ resultado: 'pausada' }])
  await concluir(id)
  await expect(importar(id)).rejects.toMatchObject({ code: '42501' })
})
test('buscas são isoladas por usuário, gestor pode acompanhar todas', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  expect(await chamar(outro, 'SELECT id FROM busca_empresa', [])).toEqual([])
  expect(await chamar(gestor, 'SELECT id FROM busca_empresa', [])).toEqual([{ id }])
  await expect(concluir(id, [empresa], outro)).rejects.toMatchObject({ code: '42501' })
})
test('importa seleção em grupo, preserva campos adicionais e não assume a carteira', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  await concluir(id)
  const [r] = await importar(id)
  expect(r).toMatchObject({ inseridas: 1, vinculadas: 1 })
  expect(await banco.sql('SELECT cnpj,telefone,email,criado_por FROM empresa')).toEqual([{ cnpj: empresa.cnpj, telefone: empresa.telefone, email: empresa.email, criado_por: vendedor }])
  expect(await banco.sql('SELECT fonte,numero,porte FROM empresa_dados_cadastrais')).toEqual([{ fonte: 'CNPJ.biz', numero: '10', porte: 'ME' }])
  expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual([])
  expect(await importar(id)).toEqual([{ ...r, inseridas: 0 }])
})
test('cnpj existente conserva cadastro e vínculo comercial, sem sobrescrever', async () => {
  await configurar()
  const [{ id: empresaId }] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,telefone,email) VALUES ($1,'Nome revisado','1133332222','revisado@exemplo.test') RETURNING id", [empresa.cnpj])
  const id = randomUUID()
  await reservar(id)
  await concluir(id)
  expect(await importar(id)).toMatchObject([{ inseridas: 0, vinculadas: 1 }])
  expect(await banco.sql('SELECT id,razao_social,telefone,email FROM empresa')).toEqual([{ id: empresaId, razao_social: 'Nome revisado', telefone: '1133332222', email: 'revisado@exemplo.test' }])
})
test('resultado incompleto permanece salvo, telefone ausente e seleção adulterada não entram na fila', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  await concluir(id, [{ ...empresa, telefone: null, telefones: [] }])
  expect(await chamar(vendedor, 'SELECT jsonb_array_length(empresas)::int AS n FROM busca_empresa WHERE id=$1', [id])).toEqual([{ n: 1 }])
  await expect(importar(id)).rejects.toMatchObject({ code: '22023' })
  await expect(importar(id, ['11444777000161'])).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 0 }])
})
test('falha conserva quota e não permite resultado maior que a solicitação', async () => {
  await configurar(2)
  const id = randomUUID()
  await reservar(id)
  await expect(concluir(id, [empresa, empresa, empresa])).rejects.toMatchObject({ code: '22023' })
  await chamar(vendedor, "SELECT busca_empresa_concluir($1,'[]','tempo_esgotado')", [id])
  expect(await reservar()).toEqual([{ resultado: 'limite' }])
  await expect(concluir(id)).rejects.toMatchObject({ code: '22023' })
})
test('tabelas não aceitam escrita direta nem dados cadastrais de empresa invisível', async () => {
  await expect(chamar(vendedor, 'INSERT INTO busca_empresa_limite(usuario_id,limite_diario) VALUES ($1,1000)', [vendedor])).rejects.toMatchObject({ code: '42501' })
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ('11222333000181','Oculta','11988887777') RETURNING id")
  await banco.sql("INSERT INTO empresa_dados_cadastrais(empresa_id,fonte,coletado_em,telefones) VALUES ($1,'CNPJ.biz',now(),'[]')", [id])
  expect(await chamar(vendedor, 'SELECT * FROM empresa_dados_cadastrais', [])).toEqual([])
})

test('repositório real lê somente a busca própria e informa o consumo de São Paulo', async () => {
  const { repositorioBusca } = await import('@/src/features/busca-empresas/repositorio')
  await configurar(4)
  const repo = repositorioBusca(vendedor)
  const id = randomUUID()
  expect(await repo.reservar(id, 'Lojas SP', filtros)).toEqual({ ok: true, repetida: false })
  await repo.concluir(id, { ok: true, empresas: [empresa] })
  expect(await repo.ler(id)).toMatchObject({ id, estado: 'concluida', empresas: [empresa] })
  expect(await repositorioBusca(outro).ler(id)).toBeNull()
  expect(await repo.meuLimite()).toMatchObject({ limite_diario: 4, usado: 2 })
})

test('trocar papel para gestor revoga importação da antiga busca de vendedor', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  await concluir(id)
  await banco.sql("UPDATE usuario SET papel='gestor' WHERE id=$1", [vendedor])
  await expect(importar(id)).rejects.toMatchObject({ code: '42501' })
})
test('serviço e cliente HTTP com banco real emitem uma chamada para duas submissões da mesma chave', async () => {
  const { repositorioBusca } = await import('@/src/features/busca-empresas/repositorio')
  const { iniciarBusca } = await import('@/src/features/busca-empresas/servico')
  const { criarClienteCnpjBiz } = await import('@/src/server/cnpj-biz/cliente')
  await configurar(2)
  let chamadas = 0
  const fetcher: typeof fetch = async () => {
    chamadas++
    return new Response(JSON.stringify([{ cnpj: empresa.cnpj, razao_social: empresa.razao_social, email: empresa.email,
      telefones: ['(11) 98888-7777'], atividades_principal: ['47.42-3-00 - Material elétrico'],
      situacao: 'ATIVA', porte_empresa: 'ME', data_abertura: '2020-01-15', endereco: { numero: '10' } }]))
  }
  const repo = repositorioBusca(vendedor)
  const deps = { repo, cliente: criarClienteCnpjBiz('somente-fixture', fetcher), configurado: true }
  const id = randomUUID()
  const resultados = await Promise.all([iniciarBusca(deps, id, 'Lojas SP', filtros), iniciarBusca(deps, id, 'Lojas SP', filtros)])
  expect(resultados).toEqual([{ ok: true, id }, { ok: true, id }])
  expect(chamadas).toBe(1)
  expect(await repo.ler(id)).toMatchObject({ estado: 'concluida', empresas: [{ cnpj: empresa.cnpj, telefone: empresa.telefone }] })
  expect(await repo.importar(id, [empresa.cnpj])).toMatchObject({ ok: true, inseridas: 1, vinculadas: 1 })
})
test('quota anterior à meia-noite de São Paulo não reduz o limite do novo dia', async () => {
  const { repositorioBusca } = await import('@/src/features/busca-empresas/repositorio')
  await configurar(2)
  const id = randomUUID()
  await reservar(id)
  await banco.sql("UPDATE busca_empresa SET criado_em=(date_trunc('day',clock_timestamp() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')-interval '1 microsecond' WHERE id=$1", [id])
  expect(await repositorioBusca(vendedor).meuLimite()).toMatchObject({ usado: 0, limite_diario: 2 })
  expect(await reservar()).toEqual([{ resultado: 'ok' }])
})
test('Google oferece somente grupos ativos com vínculo de origem real', async () => {
  const { repositorioBusca } = await import('@/src/features/busca-empresas/repositorio')
  const [{ id: empresaId }] = await banco.sql<{ id: string }>("INSERT INTO empresa(nome_fantasia,telefone) VALUES ('Google fictício','11988887777') RETURNING id")
  const [{ id: grupoId }] = await banco.sql<{ id: string }>("INSERT INTO grupo_importacao(nome) VALUES ('Lista Google fictícia') RETURNING id")
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES ($1,$2)', [grupoId, empresaId])
  const repo = repositorioBusca(vendedor)
  expect(await repo.gruposGoogle()).toEqual([])
  await banco.sql("INSERT INTO empresa_origem_google(google_place_id,empresa_id) VALUES ('place-fixture',$1)", [empresaId])
  expect(await repo.gruposGoogle()).toMatchObject([{ id: grupoId, total: 1 }])
  await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id=$1', [grupoId])
  expect(await repo.gruposGoogle()).toEqual([])
})

test('perfil público conserva dados cadastrais mas oculta telefone sem posse ou reserva vigente', async () => {
  const { lerDadosCadastrais } = await import('@/src/server/cnpj-biz/dados')
  await configurar()
  const id = randomUUID()
  await reservar(id)
  await concluir(id)
  await importar(id)
  const [{ id: empresaId }] = await banco.sql<{ id: string }>('SELECT id FROM empresa WHERE cnpj=$1', [empresa.cnpj])
  expect(await lerDadosCadastrais(gestor, empresaId)).toMatchObject({ telefones: [empresa.telefone] })
  expect(await lerDadosCadastrais(outro, empresaId)).toMatchObject({ porte: 'ME', telefones: [] })
  await banco.sql('INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES ($1,$2,now()+interval \'10 minutes\')', [empresaId, vendedor])
  expect(await lerDadosCadastrais(vendedor, empresaId)).toMatchObject({ telefones: [empresa.telefone] })
  expect(await lerDadosCadastrais(outro, empresaId)).toMatchObject({ telefones: [] })
  await banco.sql('UPDATE empresa_fila SET reservado_ate=now()-interval \'1 second\' WHERE empresa_id=$1', [empresaId])
  expect(await lerDadosCadastrais(vendedor, empresaId)).toMatchObject({ telefones: [] })
})
