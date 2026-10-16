import { expect, test } from 'vitest'
import { COLUNAS_CRM } from './exportar-crm'
import { lerColetaSheets } from './entrada-sheets'
import { consolidarBackupTelefones, filtrarColetaPorBackup, conferirBackup, prepararAcrescimoBackup } from './backup-telefones'

const exportacao = (telefone: unknown) => [[...COLUNAS_CRM], ['', '', 'Loja', '', telefone, '', '', '', 'p1']]

test('conserva máscaras, duplicações e linhas anteriores e acrescenta fixos normalizados sem inventar nono dígito', () => {
  const r = consolidarBackupTelefones([['telefone'], ['(11) 2606-1244'], ['+55 11 2606-1244'], [], ['11988887777']],
    exportacao('(21) 2222-3333'))
  expect(r).toEqual({ ok: true, backup: {
    matriz: [['telefone'], ['(11) 2606-1244'], ['+55 11 2606-1244'], [''], ['11988887777'], ['552122223333']],
    numeros: ['551126061244', '5511988887777', '552122223333'],
  } })
})

test('exportação já presente por máscara/DDI não cria outra reserva', () => {
  expect(consolidarBackupTelefones([['telefone'], ['551126061244']], exportacao('(11) 2606-1244')))
    .toEqual({ ok: true, backup: { matriz: [['telefone'], ['551126061244']], numeros: ['551126061244'] } })
})

test.each([
  { backup: [['outro']], anterior: [[...COLUNAS_CRM]], motivo: 'backup_invalido' },
  { backup: [['telefone'], ['26061244']], anterior: [[...COLUNAS_CRM]], motivo: 'backup_invalido' },
  { backup: [['telefone'], [{ privado: 'segredo' }]], anterior: [[...COLUNAS_CRM]], motivo: 'backup_invalido' },
  { backup: [['telefone'], ['1126061244', 'segredo']], anterior: [[...COLUNAS_CRM]], motivo: 'backup_invalido' },
  { backup: [['telefone']], anterior: [['telefone']], motivo: 'exportacao_anterior_invalida' },
  { backup: [['telefone']], anterior: exportacao('26061244'), motivo: 'exportacao_anterior_invalida' },
  { backup: [['telefone']], anterior: exportacao(''), motivo: 'exportacao_anterior_invalida' },
])('valor ilegível bloqueia preservação: $motivo', ({ backup, anterior, motivo }) => {
  const r = consolidarBackupTelefones(backup, anterior)
  expect(r).toMatchObject({ ok: false, motivo })
  expect(JSON.stringify(r)).not.toContain('segredo')
})

test('exclui todas as empresas de número histórico e mantém pendências de telefone inválido', () => {
  const r = lerColetaSheets([['telefone', 'nome_empresa', 'place_id'],
    ['(11) 2606-1244', 'A', 'p1'], ['+55 11 2606-1244', 'B', 'p2'],
    ['(21) 2222-3333', 'C', 'p3'], ['abc', 'D', 'p4']])
  if (!r.ok) throw new Error('fixture inválida')
  const f = filtrarColetaPorBackup(r.coleta, ['551126061244'])
  expect(f.repetidos).toEqual([{ numero: '551126061244', linhas: [2, 3] }])
  expect(f.coleta.numeros).toEqual(['552122223333'])
  expect(f.coleta.linhas.map(l => l.linha)).toEqual([4, 5])
  expect(f.coleta.pendencias).toEqual([{ linhas: [5], numero: null, motivo: 'telefone_invalido' }])
})

test('backup só acrescenta linhas de texto e expande a grade antes da escrita, sem limpar o histórico', () => {
  const r = prepararAcrescimoBackup(10151005, [['telefone'], ['1126061244']],
    [['telefone'], ['1126061244'], ['552122223333']], { linhas: 2, colunas: 1 })
  expect(r).toEqual([
    { appendDimension: { sheetId: 10151005, dimension: 'ROWS', length: 1 } },
    { repeatCell: { range: { sheetId: 10151005, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } }, fields: 'userEnteredFormat.numberFormat' } },
    { appendCells: { sheetId: 10151005, rows: [{ values: [{ userEnteredValue: { stringValue: '552122223333' } }] }], fields: 'userEnteredValue' } },
  ])
})

test('conferência ignora somente células vazias e detecta alteração, perda e conteúdo extra', () => {
  const esperado = [['telefone'], ['1126061244'], ['1126061244']]
  expect(conferirBackup(esperado, [['telefone', ''], ['1126061244'], ['1126061244'], []])).toEqual({ ok: true })
  for (const lido of [[['telefone'], ['1126061244']], [['telefone'], ['551126061244'], ['1126061244']],
    [['telefone'], ['1126061244', 'extra'], ['1126061244']], []]) {
    expect(conferirBackup(esperado, lido)).toEqual({ ok: false, motivo: 'backup_alterado' })
  }
})
