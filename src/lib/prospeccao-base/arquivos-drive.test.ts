import { createHash } from 'node:crypto'
import { expect, test } from 'vitest'
import { criarCsvDrive, escreverManifestoDrive, lerManifestoDrive, nomeSeguroDrive, nomePastaDrive,
  resolverOrigemDrive, criarExportacaoDrive, conferirPastaDrive, queryArquivoDrive } from './arquivos-drive'

const matriz = [['telefone', 'nome', 'extra'], ['001122', 'A, "B"\nSão', 'á']]
const csv = '\ufeff"telefone","nome","extra"\r\n"001122","A, ""B""\nSão","á"\r\n'
const hash = (texto: string) => createHash('sha256').update(texto).digest('hex')
const origem = { versao: 1 as const, tipo: 'origem' as const, raizId: 'raiz-teste', pastaId: 'pasta-teste',
  bairro: 'Brás', cidade: 'São Paulo', uf: 'SP', dataColeta: '2026-10-16', lote: 'lote-1',
  nome: 'original.csv', csvSha256: hash(csv), linhas: 1, estado: 'salvo' as const, arquivoId: 'original-teste' }

test('CSV preserva bytes UTF-8 BOM, aspas, quebras, acentos e zeros', () => {
  expect(criarCsvDrive(matriz)).toEqual({ ok: true, csv, csvSha256: hash(csv),
    bytes: Buffer.byteLength(csv), linhas: 1, matriz })
})
test.each([[], [[]], [['a'], [1]], [['a'], ['a', 'b']], [['a', 'b'], ['a']], [['a'], ['\ud800']]].map(valor => ({ valor })))('recusa matriz inválida sem converter identificadores: $valor', ({ valor }) => {
  expect(criarCsvDrive(valor)).toMatchObject({ ok: false, motivo: 'csv_invalido' })
})
test('CSV vazio de empresas contém apenas cabeçalho e linha final', () => {
  expect(criarCsvDrive([['telefone']])).toMatchObject({ ok: true, csv: '\ufeff"telefone"\r\n', linhas: 0 })
})
test('SHA256 confere também para conteúdo extenso e Unicode fora do BMP', () => {
  const r = criarCsvDrive([['texto'], [('😀é'.repeat(100))]])
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.csvSha256).toBe(hash(r.csv))
})
test('nomes são injetivos e seguros em Windows e Drive', () => {
  expect(nomeSeguroDrive('Brás/Pari%2F')).toBe('Brás%2FPari%252F')
  expect(nomeSeguroDrive('a<>:"\\|?*\n')).toBe('a%3C%3E%3A%22%5C%7C%3F%2A%0A')
  expect(nomePastaDrive(origem)).toBe('2026-10-16 - Brás - São Paulo-SP')
})
test('nota preserva texto humano e substitui só manifesto versionado', () => {
  const nota = escreverManifestoDrive('Comentário humano\nSegunda linha', origem)
  expect(lerManifestoDrive(nota, 'raiz-teste')).toEqual({ ok: true, manifesto: origem })
  expect(escreverManifestoDrive(nota, origem)).toBe(nota)
  expect(nota).toContain('Comentário humano\nSegunda linha\nCRM_DRIVE_V1:')
})
test('nota legada não afirma arquivo salvo', () => {
  expect(lerManifestoDrive('Execução anterior', 'raiz-teste')).toEqual({ ok: true, manifesto: null })
})
test.each([
  'CRM_DRIVE_V1:{',
  'CRM_DRIVE_V1:' + JSON.stringify({ ...origem, raizId: 'outra' }),
  'CRM_DRIVE_V1:' + JSON.stringify({ ...origem, arquivoId: undefined }),
  'CRM_DRIVE_V1:' + JSON.stringify({ ...origem, dataColeta: '2026-02-30' }),
  'CRM_DRIVE_V1:' + JSON.stringify({ ...origem, pastaId: '../desvio' }),
  'CRM_DRIVE_V1:' + JSON.stringify({ ...origem, csvSha256: '00' }),
  'CRM_DRIVE_V1:' + JSON.stringify(origem) + '\nCRM_DRIVE_V1:' + JSON.stringify(origem),
])('manifesto inválido é bloqueado sem executar conteúdo', nota => {
  expect(lerManifestoDrive(nota, 'raiz-teste')).toMatchObject({ ok: false, motivo: 'manifesto_drive_invalido' })
})
test('associa origem apenas quando matriz e manifesto conferem', () => {
  const r = resolverOrigemDrive(matriz, escreverManifestoDrive('', origem), 'raiz-teste')
  expect(r).toMatchObject({ ok: true, contexto: { ...origem, legado: false } })
  expect(resolverOrigemDrive([matriz[0], ['alterada', '', '']], escreverManifestoDrive('', origem), 'raiz-teste'))
    .toMatchObject({ ok: false, motivo: 'origem_drive_divergente' })
})
test('preenche células omitidas no fim pelo Sheets sem perder extras', () => {
  const completa = [['telefone', 'nome', 'extra'], ['0011', '', '']]
  const arquivo = criarCsvDrive(completa)
  if (!arquivo.ok) throw new Error('fixture')
  expect(resolverOrigemDrive([completa[0], ['0011']], escreverManifestoDrive('', {
    ...origem, csvSha256: arquivo.csvSha256,
  }), 'raiz-teste')).toMatchObject({ ok: true })
})
test('fallback manual exige região e dia inequívocos e aceita UF ausente', () => {
  const manual = [['telefone', 'bairro', 'cidade', 'data_coleta'], ['0011', 'Brás', 'São Paulo', '2026-10-16 09:30:00']]
  const r = resolverOrigemDrive(manual, 'Manual', 'raiz-teste')
  expect(r).toMatchObject({ ok: true, contexto: { bairro: 'Brás', cidade: 'São Paulo', uf: '',
    dataColeta: '2026-10-16', legado: true, pastaId: '' } })
  if (r.ok) expect(nomePastaDrive(r.contexto)).toBe('2026-10-16 - Brás - São Paulo')
  expect(resolverOrigemDrive([['telefone', 'bairro'], ['0011', 'Brás']], '', 'raiz-teste')).toMatchObject({ ok: false, motivo: 'contexto_origem_ausente' })
  expect(resolverOrigemDrive([...manual, ['0022', 'Pari', 'São Paulo', '2026-10-16']], '', 'raiz-teste'))
    .toMatchObject({ ok: false, motivo: 'contexto_origem_ambiguo' })
})
test('fallback aceita cidade/UF sem inventar estado e recusa datas vagas', () => {
  expect(resolverOrigemDrive([['bairro', 'cidade', 'data_coleta'], ['Brás', 'São Paulo/SP', '2026-10-16']], '', 'raiz-teste'))
    .toMatchObject({ ok: true, contexto: { cidade: 'São Paulo', uf: 'SP' } })
  expect(resolverOrigemDrive([['bairro', 'cidade', 'data_coleta'], ['Brás', 'São Paulo', '16/10/26']], '', 'raiz-teste').ok).toBe(false)
})
test('cada execução ganha nome distinto; retomada mantém nome e hash', () => {
  const exec = { id: 'run/1', data: '2026-10-17T00:15:00.000Z' }
  const a = criarExportacaoDrive(origem, matriz, exec)
  expect(a).toEqual(criarExportacaoDrive(origem, matriz, exec))
  expect(a).toMatchObject({ ok: true, manifesto: { tipo: 'exportacao', estado: 'pendente', dataColeta: '2026-10-16',
    dataExecucao: exec.data, execucaoId: exec.id, nome: 'Planilha exportar CRM - 2026-10-16_21-15-00 - exec-run%2F1.csv' } })
  const b = criarExportacaoDrive(origem, matriz, { ...exec, id: 'run/2' })
  if (a.ok && b.ok) expect(a.manifesto.nome).not.toBe(b.manifesto.nome)
})
test.each([
  { id: 'pasta-teste', mimeType: 'application/vnd.google-apps.folder', parents: ['outra'], trashed: false },
  { id: 'pasta-teste', mimeType: 'text/csv', parents: ['raiz-teste'], trashed: false },
  { id: 'pasta-teste', mimeType: 'application/vnd.google-apps.folder', parents: ['raiz-teste'], trashed: true },
])('recusa desvio ou pasta inválida', meta => {
  expect(conferirPastaDrive(meta, 'raiz-teste', 'pasta-teste')).toMatchObject({ ok: false })
})
test('confere pai e escapa query sem interpretar células', () => {
  expect(conferirPastaDrive({ id: 'pasta-teste', mimeType: 'application/vnd.google-apps.folder',
    parents: ['raiz-teste'], trashed: false }, 'raiz-teste', 'pasta-teste')).toEqual({ ok: true })
  expect(queryArquivoDrive('pasta-teste', "A'B\\C.csv")).toBe("'pasta-teste' in parents and name = 'A\\'B\\\\C.csv' and trashed = false")
})

test('nome já escapado de execução continua um manifesto válido', () => {
  const r = criarExportacaoDrive(origem, matriz, { id: 'run/1', data: '2026-10-17T00:15:00.000Z' })
  if (!r.ok) throw new Error('fixture')
  expect(lerManifestoDrive(escreverManifestoDrive('', r.manifesto), 'raiz-teste')).toMatchObject({ ok: true })
})
test('nome da pasta não colide por separadores internos ou controles Unicode', () => {
  expect(nomePastaDrive({ ...origem, bairro: 'A - B', cidade: 'C' })).toBe('2026-10-16 - A %2D B - C-SP')
  expect(nomePastaDrive({ ...origem, bairro: 'A', cidade: 'B - C' })).toBe('2026-10-16 - A - B %2D C-SP')
  expect(nomeSeguroDrive('A\u2028B\u200eC')).toBe('A%E2%80%A8B%E2%80%8EC')
})
test('separadores entre componentes não criam colisões nas bordas', () => {
  expect(nomePastaDrive({ ...origem, bairro: 'A -', cidade: 'B' })).toBe('2026-10-16 - A %2D - B-SP')
  expect(nomePastaDrive({ ...origem, bairro: 'A', cidade: '- B' })).toBe('2026-10-16 - A - %2D B-SP')
  expect(nomeSeguroDrive('Vila-Nova')).toBe('Vila%2DNova')
})

test('fallback ISO UTC usa o dia em São Paulo e preserva dia literal/local', () => {
  const matriz = (data: string) => [['bairro','cidade','data_coleta'], ['Brás','São Paulo',data]]
  expect(resolverOrigemDrive(matriz('2026-10-17T00:15:00Z'), '', 'raiz-teste'))
    .toMatchObject({ ok: true, contexto: { dataColeta: '2026-10-16' } })
  expect(resolverOrigemDrive(matriz('2026-10-17 00:15:00'), '', 'raiz-teste'))
    .toMatchObject({ ok: true, contexto: { dataColeta: '2026-10-17' } })
  expect(resolverOrigemDrive(matriz('2026-10-17'), '', 'raiz-teste'))
    .toMatchObject({ ok: true, contexto: { dataColeta: '2026-10-17' } })
})
test.each(['2026-10-16T24:00:00Z','2026-10-16 24:00:00','2026-10-16T23:60:00Z'])('fallback recusa hora impossível: %s', data => {
  expect(resolverOrigemDrive([['bairro','cidade','data_coleta'],['Brás','São Paulo',data]], '', 'raiz-teste').ok).toBe(false)
})

test('origem manual informa os cabeçalhos de região ausentes', () => {
  expect(resolverOrigemDrive([['telefone'],['0011']], '', 'raiz-teste')).toMatchObject({
    ok: false, motivo: 'contexto_origem_ausente', faltas: ['bairro','cidade','data_coleta'] })
})

test('manifesto e fallback exigem UF brasileira válida quando presente', () => {
  expect(lerManifestoDrive(escreverManifestoDrive('', { ...origem, uf: 'ZZ' }), 'raiz-teste').ok).toBe(false)
  expect(resolverOrigemDrive([['bairro','cidade','uf','data_coleta'],['Brás','São Paulo','ZZ','2026-10-16']], '', 'raiz-teste').ok).toBe(false)
})
