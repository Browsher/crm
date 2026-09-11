import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Client } from 'pg'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'
import {
  EMPRESA_MEU_DIA_DEVOLUCAO,
  EMPRESA_MEU_DIA_POSSE_PERDIDA,
  EMPRESA_MEU_DIA_PRIVADA,
  EMPRESA_MEU_DIA_REAGENDA,
  NOME_MEU_DIA_BUSCA_UNICA,
  NOME_MEU_DIA_ROLAGEM,
  NOME_MEU_DIA_ULTIMO,
} from './dados-meu-dia'

const ORDEM_AGENDA = [
  'Meu Dia Atraso A14', 'Meu Dia Atraso A13', 'Meu Dia Atraso A12', 'Meu Dia Atraso A11', 'Meu Dia Atraso A10',
  NOME_MEU_DIA_ROLAGEM, 'Meu Dia Posse Perdida', NOME_MEU_DIA_BUSCA_UNICA, 'Meu Dia Atraso Devolucao', 'Meu Dia Atraso Reagenda',
  'Meu Dia Aurora', 'Meu Dia Cedro', 'Meu Dia Dourada', NOME_MEU_DIA_ULTIMO,
]

// A única forma real de simular "outra sessão mudou a posse enquanto a
// agenda estava aberta" é falar com o banco por fora do app, como admin.
// `DATABASE_URL_ADMIN` só existe no processo do Playwright (scripts/e2e/run.mts),
// nunca no processo do servidor testado.
async function comBancoAdmin<T>(trabalho: (cliente: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('DATABASE_URL_ADMIN ausente: scripts/e2e/run.mts precisa repassá-la ao Playwright')
  exigirAdminLocal(url)
  return comAdmin(url, trabalho)
}

async function revogarPosse(empresaId: string) {
  await comBancoAdmin((cliente) => cliente.query('UPDATE empresa_fila SET vendedor_id = NULL WHERE empresa_id = $1', [empresaId]))
}

async function dataCivilFutura(dias: number): Promise<string> {
  const r = await comBancoAdmin((cliente) =>
    cliente.query<{ data: string }>(
      `SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + $1::integer, 'YYYY-MM-DD') AS data`,
      [dias],
    ))
  return r.rows[0].data
}

async function entrar(page: Page, apelido: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido.toLowerCase()}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/meu-dia')
}

function perfilAtual(page: Page): Locator {
  return page.getByRole('article')
}

// Tabula de verdade até o alvo ficar focado, em vez de presumir a posição
// exata na ordem de tabulação. O `expect` final falha com uma mensagem clara
// se o alvo nunca for alcançado dentro do limite.
async function tabAte(page: Page, alvo: Locator, maximo = 30) {
  for (let i = 0; i < maximo; i++) {
    if (await alvo.evaluate((el) => el === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(alvo).toBeFocused()
}

async function conferirTamanhos(page: Page, tela: string) {
  for (const tema of ['light', 'dark'] as const) {
    await page.getByRole('combobox', { name: 'Tema do Meu dia' }).selectOption(tema)
    for (const width of [390, 820, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

      // "Abrir atendimento" precisa existir e caber inteiro na largura, dos
      // dois lados: nem cortado à direita, nem começando fora à esquerda.
      const abrir = page.getByRole('link', { name: 'Abrir atendimento', exact: true })
      await expect(abrir).toBeVisible()
      const caixa = (await abrir.boundingBox())!
      expect(caixa.x).toBeGreaterThanOrEqual(0)
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(width)

      if (width === 390) {
        // Empilhamento de verdade no celular: o perfil começa depois do fim
        // da lista, não ao lado dela.
        const listaBox = (await page.getByTestId('lista-meu-dia').boundingBox())!
        const perfilBox = (await perfilAtual(page).boundingBox())!
        expect(perfilBox.y).toBeGreaterThanOrEqual(listaBox.y + listaBox.height)
      }

      await page.screenshot({ path: `test-results/meu-dia-${tela}-${tema}-${width}.png`, fullPage: true })
    }
  }
}

test('Meu dia recorta a agenda, prova a rolagem, filtra e preserva os filtros na ida e volta', async ({ page }) => {
  test.setTimeout(60_000)
  await entrar(page, 'meudiae2e')

  const lista = page.getByTestId('lista-meu-dia')
  await expect(page.getByRole('main')).toContainText('14 de 14 retornos')
  await expect(lista.getByRole('button')).toHaveCount(14)
  expect(await lista.locator('li strong').allTextContents()).toEqual(ORDEM_AGENDA)
  await expect(lista.getByRole('listitem').filter({ hasText: 'Meu Dia Atraso A14' })).toContainText('Atrasado')
  await expect(lista.getByRole('listitem').filter({ hasText: NOME_MEU_DIA_ULTIMO })).toContainText('Hoje')

  // Recorte: a futura e a sem contato existem na carteira, mas não na agenda.
  await expect(page.getByRole('main')).not.toContainText('Meu Dia Futuro Ignorado')
  await expect(page.getByRole('main')).not.toContainText('Meu Dia SemContato Ignorado')

  // Privacidade: a empresa do outro vendedor não aparece, e a ficha dela é 404.
  await expect(page.getByRole('main')).not.toContainText('Meu Dia Privada Ignorada')
  await page.goto(`/carteira/${EMPRESA_MEU_DIA_PRIVADA}?de=meu-dia`)
  await expect(page.locator('body')).toContainText('404')
  await page.goto('/meu-dia')

  await conferirTamanhos(page, 'lista')
  await page.setViewportSize({ width: 1280, height: 800 })
  await lista.evaluate((el) => { el.scrollTop = 0 })

  // Rolagem provada, não presumida: a lista TRANSBORDA de verdade antes de
  // qualquer medição de posição.
  const medida = await lista.evaluate((el) => ({ scroll: el.scrollHeight, cliente: el.clientHeight }))
  expect(medida.scroll).toBeGreaterThan(medida.cliente)

  // O item de rolagem não é o último: precisa ficar dentro do viewport do
  // NAVEGADOR (não só do container) depois de uma rolagem moderada, para que
  // o clique NATIVO logo abaixo exerça a própria acionabilidade (visível,
  // sem overlay, hit-test no lugar certo) em vez de contorná-la. "Dentro do
  // container" não basta: o container começa em y≈351 (depois do cabeçalho e
  // dos filtros) e é mais alto que a fatia do viewport de 800px que sobra
  // para ele, então uma rolagem calculada só pela caixa do container ainda
  // pode deixar o item fora da tela — a rolagem abaixo mira o viewport.
  const viewportAltura = 800
  const listaBox = (await lista.boundingBox())!
  const alvoRolagem = lista.getByRole('button', { name: NOME_MEU_DIA_ROLAGEM })
  const antesAlvo = (await alvoRolagem.boundingBox())!
  // Fora da tela antes de rolar: só existe visível depois.
  expect(antesAlvo.y + antesAlvo.height).toBeGreaterThan(viewportAltura)

  const margem = 8
  const rolagemNecessaria = Math.ceil(antesAlvo.y + antesAlvo.height - viewportAltura + margem)
  await lista.evaluate((el, alvo) => { el.scrollTop = alvo }, rolagemNecessaria)
  const scrollAplicado = await lista.evaluate((el) => el.scrollTop)
  expect(scrollAplicado).toBeGreaterThan(0)
  const depoisAlvo = (await alvoRolagem.boundingBox())!
  // Dentro do viewport do navegador E do container depois de rolar: acionável de verdade.
  expect(depoisAlvo.y).toBeGreaterThanOrEqual(Math.max(0, listaBox.y))
  expect(depoisAlvo.y + depoisAlvo.height).toBeLessThanOrEqual(Math.min(viewportAltura, listaBox.y + listaBox.height))

  const perfil = perfilAtual(page)
  const antesPerfil = await perfil.boundingBox()
  const antesPagina = await page.evaluate(() => window.scrollY)
  await alvoRolagem.click()
  await expect(perfil.getByRole('heading', { name: NOME_MEU_DIA_ROLAGEM, exact: true })).toBeVisible()

  expect(await lista.evaluate((el) => el.scrollTop)).toBe(scrollAplicado)
  expect((await perfil.boundingBox())?.y).toBe(antesPerfil?.y)
  expect(await page.evaluate(() => window.scrollY)).toBe(antesPagina)

  // Filtros e busca.
  await page.getByLabel('Nome', { exact: true }).fill(NOME_MEU_DIA_BUSCA_UNICA)
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(lista.getByRole('button')).toHaveCount(1)
  await expect(page.getByRole('main')).toContainText('1 de 14 retornos')

  await page.getByLabel('Nome', { exact: true }).fill('')
  await page.getByLabel('Retorno', { exact: true }).selectOption('atrasado')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(lista.getByRole('button')).toHaveCount(10)
  await expect(page.getByRole('main')).toContainText('10 de 14 retornos')

  // Os dois vazios são distintos: busca sem resultado não é agenda vazia.
  await page.getByLabel('Nome', { exact: true }).fill('Empresa que não existe na agenda')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Nenhum cliente corresponde à busca', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Nenhum retorno pendente para hoje')

  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).first().click()
  await expect(page).toHaveURL('/meu-dia')
  await expect(lista.getByRole('button')).toHaveCount(14)

  // Ida e volta com filtros: abrir a ficha filtrada e voltar preserva a URL.
  await page.getByLabel('Nome', { exact: true }).fill('irassol')
  await page.getByLabel('Retorno', { exact: true }).selectOption('atrasado')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(lista.getByRole('button')).toHaveCount(1)
  const filtros = new URL(page.url()).search
  await perfil.getByRole('link', { name: 'Abrir atendimento', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/carteira/[0-9a-f-]+\\?de=meu-dia`))
  expect(new URL(page.url()).search).toContain(filtros.slice(1))
  await expect(page.getByRole('heading', { name: NOME_MEU_DIA_BUSCA_UNICA, exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar para o Meu dia', exact: true }).click()
  await expect(page).toHaveURL(`/meu-dia${filtros}`)
  await expect(lista.getByRole('button')).toHaveCount(1)
  await expect(lista.getByRole('button', { name: NOME_MEU_DIA_BUSCA_UNICA })).toBeVisible()

  // Teclado: busca, filtro, itens da lista e "Abrir atendimento" são alcançáveis;
  // Enter e Espaço selecionam, e o foco não é sequestrado ao trocar de item.
  // O foco chega por `Tab` de verdade (não `.focus()`): só assim o Chromium
  // acende o anel de foco que a checagem de `outlineStyle` abaixo prova.
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).first().click()
  await expect(lista.getByRole('button')).toHaveCount(14)

  await page.getByLabel('Nome', { exact: true }).focus()
  await expect(page.getByLabel('Nome', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Retorno', { exact: true })).toBeFocused()

  const primeiroItem = lista.getByRole('button', { name: 'Meu Dia Atraso A14' })
  await tabAte(page, primeiroItem)
  const contorno = await primeiroItem.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(contorno).not.toBe('none')
  await page.keyboard.press('Enter')
  await expect(perfil.getByRole('heading', { name: 'Meu Dia Atraso A14', exact: true })).toBeVisible()
  await expect(primeiroItem).toBeFocused()

  const segundoItem = lista.getByRole('button', { name: 'Meu Dia Atraso A13' })
  await page.keyboard.press('Tab')
  await expect(segundoItem).toBeFocused()
  await page.keyboard.press(' ')
  await expect(perfil.getByRole('heading', { name: 'Meu Dia Atraso A13', exact: true })).toBeVisible()
  await expect(segundoItem).toBeFocused()

  const abrirAtendimento = perfil.getByRole('link', { name: 'Abrir atendimento', exact: true })
  await tabAte(page, abrirAtendimento)
  const contornoLink = await abrirAtendimento.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(contornoLink).not.toBe('none')
})

test('Sem retorno pendente, a agenda mostra o vazio com caminho para a Carteira', async ({ page }) => {
  await entrar(page, 'meudiavazioe2e')
  await expect(page.getByRole('heading', { name: 'Nenhum retorno pendente para hoje', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Nenhum cliente corresponde à busca')
  await expect(page.getByRole('link', { name: 'Ver carteira completa', exact: true })).toHaveAttribute('href', '/carteira')
})

test('Reagendar para o futuro pela ficha tira a empresa da agenda e mantém na Carteira', async ({ page }) => {
  test.setTimeout(45_000)
  await entrar(page, 'meudiae2e')
  const lista = page.getByTestId('lista-meu-dia')
  const perfil = perfilAtual(page)
  await lista.getByRole('button', { name: 'Meu Dia Atraso Reagenda' }).click()
  await perfil.getByRole('link', { name: 'Abrir atendimento', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/carteira/${EMPRESA_MEU_DIA_REAGENDA}\\?de=meu-dia`))

  await page.getByRole('button', { name: 'Registrar atendimento', exact: true }).click()
  await page.getByLabel('Nota', { exact: true }).fill('Reagendado para o futuro pelo Meu dia')
  await page.getByLabel('Próximo passo', { exact: true }).fill('Retomar contato mais adiante')
  await page.getByLabel('Data do próximo passo', { exact: true }).fill(await dataCivilFutura(7))
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByText('Reagendado para o futuro pelo Meu dia', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar para o Meu dia', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await expect(page.getByRole('main')).toContainText('13 de 13 retornos')
  await expect(page.getByTestId('lista-meu-dia')).not.toContainText('Meu Dia Atraso Reagenda')

  await page.goto('/carteira')
  await expect(page.getByRole('heading', { name: 'Meu Dia Atraso Reagenda', exact: true })).toBeVisible()
})

test('Devolver pela ficha com filtros ativos some da agenda e da Carteira, e volta preserva os filtros', async ({ page }) => {
  test.setTimeout(45_000)
  await entrar(page, 'meudiae2e')
  await page.getByLabel('Nome', { exact: true }).fill('Devolucao')
  await page.getByLabel('Retorno', { exact: true }).selectOption('atrasado')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  const filtros = new URL(page.url()).search
  const lista = page.getByTestId('lista-meu-dia')
  await expect(lista.getByRole('button')).toHaveCount(1)
  const perfil = perfilAtual(page)
  await perfil.getByRole('link', { name: 'Abrir atendimento', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/carteira/${EMPRESA_MEU_DIA_DEVOLUCAO}\\?de=meu-dia`))
  const fichaUrl = page.url()

  await page.getByRole('button', { name: 'Registrar atendimento', exact: true }).click()
  await page.getByLabel('Nota', { exact: true }).fill('Devolvida pelo Meu dia')
  await page.getByLabel('Próximo passo', { exact: true }).fill('Combinado antes de devolver')
  await page.getByLabel('Data do próximo passo', { exact: true }).fill(await dataCivilFutura(3))
  await page.getByRole('button', { name: 'Registrar e devolver', exact: true }).click()

  await expect(page).toHaveURL(`/meu-dia${filtros}`)
  await expect(page.getByRole('heading', { name: 'Nenhum cliente corresponde à busca', exact: true })).toBeVisible()

  await page.goto('/carteira')
  await expect(page.getByRole('heading', { name: 'Meu Dia Atraso Devolucao', exact: true })).toHaveCount(0)

  await page.goto(fichaUrl)
  await expect(page.locator('body')).toContainText('404')
})

test('Posse perdida durante a sessão avisa sem expor dado nenhum da empresa', async ({ page }) => {
  await entrar(page, 'meudiae2e')
  const lista = page.getByTestId('lista-meu-dia')
  const perfil = perfilAtual(page)

  // A agenda já está aberta com a posse intacta; a posse muda por fora agora.
  await revogarPosse(EMPRESA_MEU_DIA_POSSE_PERDIDA)
  await lista.getByRole('button', { name: 'Meu Dia Posse Perdida' }).click()

  await expect(page.getByRole('alert').getByRole('heading', { name: 'Esta empresa não está mais na sua carteira', exact: true })).toBeVisible()
  await expect(perfil).toHaveCount(0)
  // '11999990401' é o telefone real de "Meu Dia Posse Perdida" na fixture:
  // ele só apareceria na tela se o perfil vazasse os dados da empresa.
  await expect(page.getByRole('main')).not.toContainText('11999990401')
  // O item continua na lista até a agenda recarregar: só o perfil foi limpo.
  await expect(lista.getByRole('button', { name: 'Meu Dia Posse Perdida' })).toBeVisible()

  await page.getByRole('link', { name: 'Recarregar a agenda', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await expect(page.getByTestId('lista-meu-dia')).not.toContainText('Meu Dia Posse Perdida')
})
