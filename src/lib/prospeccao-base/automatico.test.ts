import { expect, test } from 'vitest'
import { validarSinalColetaPronta, conferirPublicacaoAutomatica, escreverAssinaturaAutomatica, conferirExportacaoAutomatica, montarRespostaAutomatica } from './automatico'
import { criarCsvDrive, escreverManifestoDrive, type ManifestoDrive } from './arquivos-drive'

const matriz = [['telefone','bairro','cidade'],['1122223333','Brás','São Paulo']]
const csv = criarCsvDrive(matriz)
if (!csv.ok) throw new Error('fixture')
const sinal = { versao: 1 as const, lote: 'coleta-teste', origemCsvSha256: csv.csvSha256, planilhaId: 'sheet-teste', origemId: 1, pastaId: 'pasta-teste', arquivoOriginalId: 'original-teste' }
const origem: ManifestoDrive = { versao: 1, tipo: 'origem', estado: 'salvo', lote: sinal.lote, raizId: 'raiz-teste', pastaId: sinal.pastaId, arquivoId: sinal.arquivoOriginalId, bairro: 'Brás', cidade: 'São Paulo', uf: 'SP', dataColeta: '2026-10-16', nome: 'original.csv', csvSha256: csv.csvSha256, linhas: 1 }
const manifesto: ManifestoDrive = { ...origem, tipo: 'exportacao', execucaoId: '689', dataExecucao: '2026-10-16T10:00:00.000Z', nome: 'final.csv', arquivoId: 'final-teste' }
const contagens = { empresasLidas: 1, empresasExportadas: 1, validos: 1, invalidos: 0, pendencias: 0 }
const destinos = { planilhaId: 'sheet-teste', origemId: 1 }

test('aceita somente corpo exato com destinos configurados', () => {
  expect(validarSinalColetaPronta(sinal,destinos)).toEqual({ ok: true, sinal })
})
test.each([null, [], {}, { ...sinal, versao: 2 }, { ...sinal, origemId: '1' }, { ...sinal, origemCsvSha256: 'F'.repeat(64) }, { ...sinal, lote: ' lote' }, { ...sinal, pastaId: '../pasta' }, { ...sinal, token: 'nao-vazar' }, { ...sinal, planilhaId: 'outra' }, { ...sinal, origemId: 2 }])('recusa corpo/destino inválido sem expor valores', body => {
  expect(validarSinalColetaPronta(body,destinos)).toEqual({ ok: false, motivo: 'sinal_coleta_invalido' })
})
test('confere sinal contra manifesto e hash de toda matriz', () => {
  expect(conferirPublicacaoAutomatica(sinal,matriz,escreverManifestoDrive('Humano',origem),'raiz-teste')).toEqual({ ok: true, manifesto: origem })
})
test.each(['lote','pastaId','arquivoId','csvSha256'] as const)('recusa manifesto de outra identidade %s', campo => {
  const outro = { ...origem, [campo]: campo === 'csvSha256' ? '0'.repeat(64) : 'outro' }
  expect(conferirPublicacaoAutomatica(sinal,matriz,escreverManifestoDrive('',outro),'raiz-teste').ok).toBe(false)
})
test('recusa matriz alterada e manifesto ausente', () => {
  expect(conferirPublicacaoAutomatica(sinal,[...matriz,['1122224444','Brás','São Paulo']],escreverManifestoDrive('',origem),'raiz-teste').ok).toBe(false)
  expect(conferirPublicacaoAutomatica(sinal,matriz,'Sem manifesto','raiz-teste').ok).toBe(false)
})
test('assinatura versionada preserva humano e manifesto e retorna contagens', () => {
  const nota = escreverAssinaturaAutomatica(escreverManifestoDrive('Humano',manifesto),sinal,contagens)
  expect(nota).toContain('Humano\nCRM_DRIVE_V1:')
  expect(nota).toContain('CRM_AUTOMATICO_V1:')
  expect(conferirExportacaoAutomatica(sinal,manifesto,nota,1)).toEqual({ ok: true, mesmoLote: true, contagens })
  expect(escreverAssinaturaAutomatica(nota,sinal,contagens).split('CRM_AUTOMATICO_V1:')).toHaveLength(2)
})
test('mesmo lote com hash ou arquivo original conflitante é recusado', () => {
  const nota = escreverAssinaturaAutomatica('',sinal,contagens)
  for (const outro of [{ ...sinal, origemCsvSha256: 'f'.repeat(64) }, { ...sinal, arquivoOriginalId: 'outro' }]) {
    expect(conferirExportacaoAutomatica(outro,manifesto,nota,1)).toEqual({ ok: false, motivo: 'assinatura_origem_conflitante' })
  }
})
test('legado 689 concluído usa último bloco humano correspondente', () => {
  const nota = 'Humano\nExecução: antiga\nSituação: concluído\nválidos: 99\ninválidos: 99\nexportadas: 99\npendências: 99\nExecução: 689\nData: 2026-10-16T10:00:00.000Z\nSituação: concluído\nválidos: 1\ninválidos: 0\nexportadas: 1\npendências: 0'
  expect(conferirExportacaoAutomatica(sinal,manifesto,nota,1)).toEqual({ ok: true, mesmoLote: true, contagens })
  expect(conferirExportacaoAutomatica(sinal,manifesto,'Execução: outra\nválidos: 1',1).ok).toBe(false)
})
test('outro lote segue sem reaproveitar contagens e assinatura malformada é recusada', () => {
  expect(conferirExportacaoAutomatica(sinal,{ ...manifesto, lote: 'outro' },'',1)).toEqual({ ok: true, mesmoLote: false })
  expect(conferirExportacaoAutomatica(sinal,manifesto,'CRM_AUTOMATICO_V1:{segredo',1)).toEqual({ ok: false, motivo: 'assinatura_automatica_invalida' })
})
test('resposta exata sem segredo com arquivo salvo e contagens explícitas', () => {
  expect(montarRespostaAutomatica(sinal,manifesto,contagens,'ja_concluido')).toEqual({ ok: true, resposta: { versao: 1, estado: 'ja_concluido', lote: sinal.lote, origemCsvSha256: sinal.origemCsvSha256, execucaoId: '689', ...contagens, mensagensEnviadas: 0, arquivoDrive: { id: 'final-teste', pastaId: 'pasta-teste', link: 'https://drive.google.com/file/d/final-teste/view', nome: 'final.csv', csvSha256: csv.csvSha256 } } })
  expect(montarRespostaAutomatica(sinal,{ ...manifesto, estado: 'pendente', arquivoId: undefined },contagens,'concluido').ok).toBe(false)
})
