import { expect, test } from '@playwright/test'
import { comBancoGrupos } from './dados-grupos'

const fonteAlvo = '8f741a80-b006-4cad-b386-a3ee8efca010'
const fonteOutra = '8f741a80-b006-4cad-b386-a3ee8efca011'
const vendedorAlvo = '8f741a80-b006-4cad-b386-a3ee8efca020'
const vendedorOutro = '8f741a80-b006-4cad-b386-a3ee8efca021'

const identidadeGestor = "SELECT set_config('app.usuario_id', id::text, false) FROM usuario WHERE email='gestore2e@teste.local'"

test('retorno do WhatsApp restaura a conversa da página 2 pelo vínculo correto no celular', async ({ page }) => {
  test.setTimeout(45_000)
  await comBancoGrupos(async c => {
    await c.query(identidadeGestor)
    await c.query(`INSERT INTO usuario(id,nome,email,papel,ativo) VALUES
      ($1,'Vendedor do histórico','retorno-wpp-alvo@teste.local','vendedor',true),
      ($2,'Vendedor da outra fonte','retorno-wpp-outra@teste.local','vendedor',true)
      ON CONFLICT (id) DO NOTHING`, [vendedorAlvo, vendedorOutro])
    await c.query(`INSERT INTO whatsapp_vinculo(id,vendedor_id,instancia)
      VALUES($1,$2,'retorno-alvo-e2e'),($3,$4,'retorno-outra-e2e')
      ON CONFLICT (vendedor_id) DO UPDATE SET instancia=EXCLUDED.instancia`,
    [fonteAlvo, vendedorAlvo, fonteOutra, vendedorOutro])
  })
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('gestore2e@teste.local')
    await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/gestao')
    await page.goto('/whatsapp')
    const busca = page.getByRole('searchbox', { name: 'Buscar conversa' })
    const categoria = page.getByRole('button', { name: 'Sem resposta', exact: true })
    const lista = page.getByLabel('Lista de conversas', { exact: true })
    const alvo = lista.getByRole('button', { name: /Contato Aurora no histórico/ })
    const outra = lista.getByRole('button', { name: /Contato Aurora em outra fonte/ })
    const mensagens = page.getByRole('list', { name: 'Mensagens da conversa' })
    await busca.fill('Aurora')
    await categoria.click()
    await expect(outra).toBeVisible()
    await expect(alvo).toBeVisible()
    await alvo.focus()
    await page.keyboard.press('Enter')
    await expect(mensagens).toContainText('Histórico da fonte correta.')
    const ficha = page.getByRole('link', { name: 'Abrir ficha da empresa', exact: true })
    await expect(ficha).toHaveCount(1)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(ficha).toHaveCount(1)
    await expect(page.getByRole('complementary', { name: 'Contexto da empresa' }).getByRole('link')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await ficha.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Cliente WhatsApp Aurora', exact: true })).toBeVisible()
    await page.reload()
    const voltar = page.getByRole('link', { name: 'Voltar ao WhatsApp', exact: true })
    await expect(voltar).toBeVisible()
    await voltar.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(url => url.pathname === '/whatsapp' && url.searchParams.has('retorno'))
    const endereco = new URL(page.url())
    const recorte = JSON.parse(endereco.searchParams.get('retorno')!)
    expect(recorte).toEqual({ tipo: 'whatsapp', vendedor: 'todos', busca: 'Aurora', categoria: 'pendentes', painel: 'conversa',
      conversa: { fonteId: fonteAlvo, id: '5511988889991@s.whatsapp.net' } })
    await expect(mensagens).toContainText('Histórico da fonte correta.')
    await page.reload()
    await expect(mensagens).toContainText('Histórico da fonte correta.')
    await page.getByRole('button', { name: 'Voltar para conversas' }).click()
    await expect(alvo).toBeFocused()
    await expect(busca).toHaveValue('Aurora')
    await expect(categoria).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await outra.click()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Contato Aurora em outra fonte', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Vendedor do histórico', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Vendedor do histórico', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(busca).toHaveValue('Aurora')
    await expect(categoria).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Mensagens da conversa', { exact: true })).toHaveCount(0)
    await busca.fill('Aurora')
    await categoria.click()
    await page.getByRole('link', { name: 'Configurar vendedores', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Configurar vendedores', exact: true })).toBeVisible()
    await page.reload()
    await voltar.click()
    await expect(page.getByRole('link', { name: 'Vendedor do histórico', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(busca).toHaveValue('Aurora')
    await expect(categoria).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Mensagens da conversa', { exact: true })).toHaveCount(0)

    const historicoIniciado = Promise.withResolvers<void>()
    const liberarHistorico = Promise.withResolvers<void>()
    const liberarNavegacao = Promise.withResolvers<void>()
    const rotaAnterior = (url: URL) => url.pathname === '/whatsapp' && url.searchParams.get('retorno') === endereco.searchParams.get('retorno')
    const rotaNovoFiltro = (url: URL) => {
      const token = url.searchParams.get('retorno')
      return url.pathname === '/whatsapp' && token !== null && JSON.parse(token).vendedor === fonteOutra
    }
    await page.route(rotaAnterior, async rota => {
      if (rota.request().method() === 'POST') {
        historicoIniciado.resolve()
        await liberarHistorico.promise
      }
      await rota.continue()
    })
    await page.route(rotaNovoFiltro, async rota => {
      await liberarNavegacao.promise
      await rota.continue()
    })
    try {
      await page.goto(endereco.href)
      const pendente = page.getByText('Localizando a conversa anterior no histórico…', { exact: true })
      await expect(pendente).toBeVisible()
      await historicoIniciado.promise
      const novoFiltro = page.getByRole('link', { name: 'Vendedor da outra fonte', exact: true })
      await novoFiltro.evaluate(link => {
        // Cancela a abertura da aba no document, depois do handler do Link na raiz do React.
        document.addEventListener('click', evento => evento.preventDefault(), { once: true })
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
      })
      await expect(pendente).toBeVisible()

      await novoFiltro.dispatchEvent('click')
      await expect(page).toHaveURL(endereco.href)
      const respostaAntiga = page.waitForResponse(resposta => resposta.request().method() === 'POST'
        && rotaAnterior(new URL(resposta.url())))
      liberarHistorico.resolve()
      await respostaAntiga
      await expect(pendente).toHaveCount(0)
      await expect(page.getByLabel('Mensagens da conversa', { exact: true })).toHaveCount(0)
    } finally {
      liberarHistorico.resolve()
      liberarNavegacao.resolve()
      await page.unroute(rotaAnterior)
      await page.unroute(rotaNovoFiltro)
    }
    await expect(page.getByRole('link', { name: 'Vendedor da outra fonte', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByLabel('Mensagens da conversa', { exact: true })).toHaveCount(0)

    await comBancoGrupos(async c => {
      await c.query(identidadeGestor)
      await c.query('DELETE FROM whatsapp_vinculo WHERE id=$1', [fonteAlvo])
      await c.query("INSERT INTO whatsapp_vinculo(id,vendedor_id,instancia) VALUES($1,$2,'retorno-falha-e2e')", [fonteAlvo, vendedorAlvo])
    })
    await page.goto(endereco.href)
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível restaurar a conversa anterior' })).toBeVisible()
    await expect(mensagens).toHaveCount(0)
    await comBancoGrupos(c => c.query('DELETE FROM whatsapp_vinculo WHERE id=$1', [fonteAlvo]))
    await page.reload()
    await expect(page.getByRole('status').filter({ hasText: 'Conversa anterior indisponível' })).toBeVisible()
    await expect(mensagens).toHaveCount(0)
  } finally {
    await comBancoGrupos(async c => {
      await c.query('DELETE FROM whatsapp_vinculo WHERE id = ANY($1::uuid[])', [[fonteAlvo, fonteOutra]])
      await c.query('DELETE FROM google_agente WHERE vendedor_id = ANY($1::uuid[])', [[vendedorAlvo, vendedorOutro]])
      await c.query('DELETE FROM usuario WHERE id = ANY($1::uuid[])', [[vendedorAlvo, vendedorOutro]])
    })
  }
})
