import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

// CNPJ do exemplo do arquivo oferecido pelo CRM, distinto da fixture CSV.
const CNPJ_MODELO = '11222333000181'

async function empresaDoModelo() {
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('Use o harness E2E')
  exigirAdminLocal(url)
  if (!/^\/teste_[0-9a-f]{12}$/.test(new URL(url).pathname)) throw new Error('Banco temporário obrigatório')
  return comAdmin(url, async cliente => {
    const resultado = await cliente.query<{ cnpj: string; cep: string; cnae_principal: string }>(
      'SELECT cnpj, cep, cnae_principal FROM empresa WHERE cnpj = $1', [CNPJ_MODELO],
    )
    return resultado.rows
  })
}

test('modelo Excel baixado passa pela conferência e só grava ao confirmar', async ({ page }) => {
  expect(await empresaDoModelo()).toEqual([])
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/empresas/importar')
  await page.getByText('Modelo e orientações de preenchimento', { exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Baixe o modelo Excel' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('modelo-empresas.xlsx')
  const caminho = await download.path()
  if (!caminho) throw new Error('Download do modelo ausente')
  const input = page.locator('input[name="arquivo"]')
  await expect(input).toHaveAttribute('accept', /\.xlsx/)
  await input.setInputFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await readFile(caminho),
  })
  await page.getByRole('button', { name: 'Conferir arquivo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Confira antes de importar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importar 1 empresa', exact: true })).toBeVisible()
  expect(await empresaDoModelo()).toEqual([])
  await page.getByRole('button', { name: 'Importar 1 empresa', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible()
  expect(await empresaDoModelo()).toEqual([{ cnpj: CNPJ_MODELO, cep: '01310100', cnae_principal: '4742300' }])
})
