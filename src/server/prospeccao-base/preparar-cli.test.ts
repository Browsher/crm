import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

test('CLI prepara pasta nova com pai ausente e recusa sobrescrever a saída', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'crm-base-cli-'))
  try {
    const fonte = { place_id: 'p1', nome_empresa: 'Cenário', cnpj: '', telefone: '(11) 2606-1244',
      endereco: 'Rua do cenário, 10', link_maps: 'https://maps.google.com/' }
    await writeFile(join(pasta, 'rastreio.json'), JSON.stringify({
      fontesOriginais: [fonte], termosPesquisados: ['CFTV'], arquivos: {},
    }))
    await writeFile(join(pasta, 'resultados.json'), JSON.stringify({ resultados: [{
      telefone: '551126061244', estado: 'encontrado', jid: '551126061244@s.whatsapp.net',
      verificadoEm: '2026-10-14T12:00:00Z', statusHTTP: 200,
    }] }))
    await writeFile(join(pasta, 'grupo.json'), JSON.stringify({ nome: 'Cenário' }))
    const saida = join(pasta, 'pai-novo', 'base')
    const args = ['--import', 'tsx', 'scripts/prospeccao-base/preparar.mts',
      '--rastreio', join(pasta, 'rastreio.json'), '--whatsapp', join(pasta, 'resultados.json'),
      '--grupo', join(pasta, 'grupo.json'), '--saida', saida]
    const { stdout } = await promisify(execFile)(process.execPath, args, { cwd: process.cwd() })
    expect(JSON.parse(stdout)).toMatchObject({ empresas: 1, telefonesUnicos: 1, encontrado: 1 })
    const antes = await readFile(join(saida, 'base.json'), 'utf8')
    await expect(promisify(execFile)(process.execPath, args, { cwd: process.cwd() })).rejects.toMatchObject({ code: 1 })
    expect(await readFile(join(saida, 'base.json'), 'utf8')).toBe(antes)
  } finally {
    await rm(pasta, { recursive: true, force: true })
  }
})
