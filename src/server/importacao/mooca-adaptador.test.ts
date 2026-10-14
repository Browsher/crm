import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { analisarPlanilha } from '../../features/empresas/planilha'
import { validarMetadadosGrupo } from '../../lib/grupo-metadados'
import { adaptarMooca, type FonteMooca } from './mooca-adaptador'

const fonte: FonteMooca = {
  nome_empresa: 'Aurora', cnpj: '', razao_social: '', telefone: '11987654321', email: '', cep: '03119010',
  place_id: 'ChIJ-ficticio-a', termo_pesquisado: 'CFTV Mooca', fontes_email: '',
  fontes_conferencia: 'https://empresa.test', observacoes: '',
}
const analisar = (csv: string) => analisarPlanilha(new TextEncoder().encode(csv))

// Os asserts exercem o parser real: copiar fantasia para razão, perder IDs,
// descartar originais ou mesclar pelo telefone quebra o contrato observado.
test('preserva Place ID e separa cadastro sem telefone', () => {
  const r = adaptarMooca([fonte, { ...fonte, nome_empresa: 'Boreal', place_id: 'ChIJ-ficticio-b', telefone: '' }])
  const a = analisar(r.csv)
  expect(a.ok && a.aceitas.length).toBe(1)
  expect(a.ok && a.aceitas[0]).toMatchObject({ cnpj: null, razaoSocial: null, nomeFantasia: 'Aurora', googlePlaceId: 'ChIJ-ficticio-a', cnaePrincipal: null, contatoNome: null })
  expect(r.pendencias).toContainEqual({ placeId: 'ChIJ-ficticio-b', nome: 'Boreal', motivo: 'telefone_ausente' })
})

test('escapa vírgula e aspas e normaliza telefone sem perder zero do CEP', () => {
  const r = adaptarMooca([{ ...fonte, nome_empresa: 'Aurora, "Eletrônicos"', telefone: '(11) 98765-4321', cep: '03119-010' }])
  const a = analisar(r.csv)
  expect(a.ok && a.aceitas[0]).toMatchObject({ nomeFantasia: 'Aurora, "Eletrônicos"', telefone: '11987654321', cep: '03119010' })
  expect(r.csv.split('\n')[0]).toBe('cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id')
})

test('escolhe primeiro email publicado válido e preserva alternativas com fontes', () => {
  const email = 'sem endereço | PRIMEIRO@empresa.test; segundo@empresa.test'
  const r = adaptarMooca([{ ...fonte, email, fontes_email: 'https://empresa.test/contato', observacoes: 'Contato publicado no site.' }])
  const a = analisar(r.csv)
  expect(a.ok && a.aceitas[0]?.email).toBe('primeiro@empresa.test')
  expect(r.rastreio[0]).toMatchObject({ emailsOriginais: email, emailEscolhido: 'primeiro@empresa.test', fontes: 'https://empresa.test', observacoes: 'Contato publicado no site.' })
})

test('ignora placeholder e nunca escolhe email do motor não reconfirmado', () => {
  const r = adaptarMooca([
    { ...fonte, email: 'example@gmail.com | PUBLICADO@empresa.test', emails_motor_nao_reconfirmados: 'motor@empresa.test' } as FonteMooca,
    { ...fonte, place_id: 'ChIJ-b', telefone: '1133332222', email: 'example@gmail.com' },
  ])
  const a = analisar(r.csv)
  expect(a.ok && a.aceitas.map(l => l.email)).toEqual(['publicado@empresa.test', null])
  expect(r.rastreio[0]?.emailsOriginais).toBe('example@gmail.com | PUBLICADO@empresa.test')
})

test('telefone inválido vai para pendência sem impedir outra linha válida', () => {
  const r = adaptarMooca([fonte, { ...fonte, place_id: 'ChIJ-b', telefone: 'ligar 11987654321' }])
  expect(analisar(r.csv)).toMatchObject({ ok: true, aceitas: [{ googlePlaceId: 'ChIJ-ficticio-a' }], recusadas: [] })
  expect(r.pendencias).toContainEqual({ placeId: 'ChIJ-b', nome: 'Aurora', motivo: 'telefone_invalido' })
})

test('telefone compartilhado sinaliza as duas linhas sem fundir IDs distintos', () => {
  const r = adaptarMooca([fonte, { ...fonte, nome_empresa: 'Boreal', place_id: 'ChIJ-b', telefone: '(11) 98765-4321' }])
  const a = analisar(r.csv)
  expect(a.ok && a.aceitas.map(l => l.googlePlaceId)).toEqual(['ChIJ-ficticio-a', 'ChIJ-b'])
  expect(r.pendencias).toEqual([
    { placeId: 'ChIJ-ficticio-a', nome: 'Aurora', motivo: 'aviso_telefone_compartilhado' },
    { placeId: 'ChIJ-b', nome: 'Boreal', motivo: 'aviso_telefone_compartilhado' },
  ])
  expect(r.rastreio).toEqual(expect.arrayContaining([
    expect.objectContaining({ placeId: 'ChIJ-ficticio-a', avisos: expect.arrayContaining(['aviso_telefone_compartilhado']) }),
    expect.objectContaining({ placeId: 'ChIJ-b', avisos: expect.arrayContaining(['aviso_telefone_compartilhado']) }),
  ]))
})

test('conserva apenas CNPJ e razão social conhecidos e encaminha inválidos à revisão', () => {
  const r = adaptarMooca([
    { ...fonte, cnpj: '11.222.333/0001-81', razao_social: 'Aurora LTDA' },
    { ...fonte, place_id: 'ChIJ-b', cnpj: '11.222.333/0001-00' },
    { ...fonte, place_id: 'ChIJ-c', cep: '3119010' },
  ])
  const a = analisar(r.csv)
  expect(a.ok && a.aceitas[0]).toMatchObject({ cnpj: '11222333000181', razaoSocial: 'Aurora LTDA' })
  expect(r.pendencias).toEqual(expect.arrayContaining([
    { placeId: 'ChIJ-b', nome: 'Aurora', motivo: 'cnpj_dv' },
    { placeId: 'ChIJ-c', nome: 'Aurora', motivo: 'cep_curto' },
  ]))
})

test('IDs repetidos no lote exigem revisão das duas linhas sem escolher uma', () => {
  const r = adaptarMooca([fonte, { ...fonte, nome_empresa: 'Boreal' }, { ...fonte, place_id: 'ChIJ-c', telefone: '1133332222' }])
  const a = analisar(r.csv)
  expect(a.ok && a.aceitas.map(l => l.googlePlaceId)).toEqual(['ChIJ-c'])
  expect(r.pendencias.filter(p => p.motivo === 'google_place_id_repetido')).toHaveLength(2)
})

test('controles em campo cadastral exigem revisão e não alteram dado bruto', () => {
  const suja = { ...fonte, nome_empresa: 'Aurora\u001b' }
  const r = adaptarMooca([suja, { ...fonte, place_id: 'ChIJ-b', telefone: '1133332222' }])
  expect(analisar(r.csv)).toMatchObject({ ok: true, aceitas: [{ googlePlaceId: 'ChIJ-b' }] })
  expect(r.pendencias).toContainEqual({ placeId: 'ChIJ-ficticio-a', nome: 'Aurora\u001b', motivo: 'caractere_invalido' })
})

const temporarias: string[] = []
afterEach(() => { for (const p of temporarias.splice(0)) rmSync(p, { recursive: true, force: true }) })
function entradaCli(texto?: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'mooca-teste-'))
  temporarias.push(pasta)
  const entrada = join(pasta, 'empresas_mooca.csv')
  const zip = join(pasta, 'original.zip')
  const saida = join(pasta, 'preparado')
  const dados = { ...fonte, cid: '0000123', data_id: '0x123:0x456', origens_brutas: 'piloto | lote' }
  const csv = Object.keys(dados).join(',') + '\n' + Object.values(dados).map(v => `"${v.replace(/"/g, '""')}"`).join(',') + '\n'
  writeFileSync(entrada, texto ?? csv, 'utf8')
  // O ZIP da CLI é opaco: só bytes/hash, sem tentativa de executar ou extrair.
  writeFileSync(zip, 'fixture opaca do arquivo fonte')
  return { pasta, entrada, zip, saida }
}
function executarCli(f: ReturnType<typeof entradaCli>) {
  return execFileSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/importacao/mooca.mts', '--entrada', f.entrada, '--zip-fonte', f.zip, '--saida', f.saida], { encoding: 'utf8', stdio: 'pipe' })
}

test('CLI prepara CSV conferido, metadados e hashes com campos originais em texto', () => {
  const f = entradaCli()
  const original = readFileSync(f.entrada)
  const zipOriginal = readFileSync(f.zip)
  executarCli(f)
  expect(existsSync(join(f.saida, 'empresas-crm.csv'))).toBe(true)
  const a = analisar(readFileSync(join(f.saida, 'empresas-crm.csv'), 'utf8'))
  expect(a.ok && a.aceitas.length).toBe(1)
  const r = JSON.parse(readFileSync(join(f.saida, 'rastreio.json'), 'utf8'))
  expect(r.arquivos.entrada.sha256).toBe(createHash('sha256').update(original).digest('hex'))
  expect(r.arquivos.zipFonte.sha256).toBe(createHash('sha256').update(zipOriginal).digest('hex'))
  expect(r.resumo).toMatchObject({ selecionadas: 1, prontas: 1, pendenciasImpeditivas: 0, avisosDuplicidade: 0 })
  expect(r.fontesOriginais[0]).toMatchObject({ cid: '0000123', data_id: '0x123:0x456', origens_brutas: 'piloto | lote', cnpj: '' })
  const grupo = JSON.parse(readFileSync(join(f.saida, 'grupo.json'), 'utf8'))
  expect(validarMetadadosGrupo(grupo).ok).toBe(true)
  expect(grupo.nome).toBe('Mooca | Segurança, informática e eletrônicos')
  expect(grupo.criterios.split('\n')).toHaveLength(8)
  expect(grupo.criterios).toContain('distribuidora CFTV Mooca São Paulo SP')
  expect(readFileSync(f.entrada)).toEqual(original)
  expect(readFileSync(f.zip)).toEqual(zipOriginal)
})

test('CLI recusa pasta existente e preserva seus arquivos', () => {
  const f = entradaCli()
  mkdirSync(f.saida)
  writeFileSync(join(f.saida, 'preservar.txt'), 'anterior')
  expect(() => executarCli(f)).toThrow()
  expect(readFileSync(join(f.saida, 'preservar.txt'), 'utf8')).toBe('anterior')
  expect(existsSync(join(f.saida, 'empresas-crm.csv'))).toBe(false)
})

test('CLI recusa entrega sem colunas requeridas antes de criar saída', () => {
  const f = entradaCli('nome_empresa,telefone\nAurora,11987654321\n')
  expect(() => executarCli(f)).toThrow()
  expect(existsSync(f.saida)).toBe(false)
})

test('CLI recusa bytes que não são UTF-8 antes de criar saída', () => {
  const f = entradaCli()
  writeFileSync(f.entrada, Buffer.from([0xff, 0xfe, 0xfd]))
  expect(() => executarCli(f)).toThrow()
  expect(existsSync(f.saida)).toBe(false)
})
