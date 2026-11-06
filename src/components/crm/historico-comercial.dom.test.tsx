// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { filtrarEventosHistorico, type FiltroHistoricoComercial, type EventoHistoricoComercial } from '@/src/lib/historico-comercial'
import { HistoricoComercial } from './historico-comercial'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const notaLonga = 'Anotação completa com os detalhes combinados.\n'.repeat(40)
const eventos: EventoHistoricoComercial[] = [
  { id: 'venda:1', empresa: 'empresa-a', natureza: 'venda', titulo: 'Venda registrada', criadoEm: '2026-11-05T13:30:00Z', autor: 'Junior', nota: null, venda: { centavos: '125050', data: '2026-11-04' } },
  { id: 'contato:1', empresa: 'empresa-a', natureza: 'contato', titulo: 'Retorno combinado', criadoEm: '2026-11-05T01:30:00Z', autor: null, nota: notaLonga, resultado: 'Falei, e ficou combinado o próximo passo', proximoPasso: { descricao: 'Confirmar os pontos de instalação', data: '2026-10-01' } },
  { id: 'contato:2', empresa: 'empresa-a', natureza: 'contato', titulo: 'Ligação sem contato', criadoEm: '2026-11-03T12:15:00Z', autor: 'Antigo responsável', nota: null, resultado: 'Liguei, não falei com ninguém' },
  { id: 'atividade:1', empresa: 'empresa-a', natureza: 'atividade_sem_ligacao', titulo: 'Atividade sem ligação', criadoEm: '2026-11-02T14:40:00Z', autor: 'Junior', nota: 'Separei os modelos do catálogo.', resultado: 'Não liguei' },
]
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<HistoricoComercial eventos={eventos} rotulo="Histórico da empresa A" />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
function registros() { return [...host.querySelectorAll('details')] }
async function clicar(nome: string) {
  const botao = [...host.querySelectorAll('button')].find(b => b.textContent?.startsWith(nome))
  expect(botao).toBeDefined()
  await act(async () => botao!.click())
}

test('quatro registros iniciam recolhidos na ordem recebida, com cabeçalhos completos', () => {
  expect(registros()).toHaveLength(4)
  expect(registros().every(d => !d.open)).toBe(true)
  const titulos = [...host.querySelectorAll('summary strong')].map(e => e.textContent)
  expect(titulos).toEqual(['Venda registrada', 'Retorno combinado', 'Ligação sem contato', 'Atividade sem ligação'])
  const cabecalho = registros()[0].querySelector('summary')!
  expect(cabecalho.textContent).toContain('Venda registrada')
  expect(cabecalho.textContent).toContain('05/11/2026')
  expect(cabecalho.textContent).toContain('10:30')
  expect(cabecalho.textContent).toContain('Junior')
  expect(host.querySelector('summary button, summary a, [role="button"]')).toBeNull()
  expect(host.querySelector('[aria-label="Histórico da empresa A"]')).not.toBeNull()
})

test('Enter expande só o registro focado e a anotação completa fica nos detalhes', async () => {
  const registro = registros()[1]
  const summary = registro.querySelector('summary')!
  expect(summary.textContent).not.toContain('Anotação completa')
  expect(registro.textContent).toContain(notaLonga)
  summary.focus()
  await act(async () => summary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })))
  expect(document.activeElement).toBe(summary)
  expect(registro.open).toBe(true)
  expect(registros().filter(d => d.open)).toHaveLength(1)
  await act(async () => summary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })))
  expect(registro.open).toBe(false)
})

test('instantes usam Brasília, autoria ausente é explícita e retorno histórico mantém data civil', async () => {
  const registro = registros()[1]
  const summary = registro.querySelector('summary')!
  expect(summary.textContent).toContain('04/11/2026')
  expect(summary.textContent).toContain('22:30')
  expect(summary.textContent).toContain('Autor não informado')
  expect(summary.querySelector('time')?.dateTime).toBe('2026-11-05T01:30:00Z')
  await clicar('Expandir todos')
  expect(registro.textContent).toContain('Confirmar os pontos de instalação')
  expect(registro.querySelector('time[datetime="2026-10-01"]')?.textContent).toBe('01/10/2026')
  expect(registro.textContent).not.toMatch(/atrasad|atraso|hoje/i)
  expect(registros()[2].querySelector('summary')?.textContent).toContain('Antigo responsável')
})

test('venda distingue o instante do registro da data da venda e conserva centavos em texto', async () => {
  await clicar('Vendas')
  expect(registros()).toHaveLength(1)
  expect(registros()[0].querySelector('summary')?.textContent).toContain('05/11/2026')
  await clicar('Expandir todos')
  expect(registros()[0].textContent).toContain('1.250,50')
  expect(registros()[0].textContent).toContain('Data da venda: 04/11/2026')
  expect(eventos[0].venda?.centavos).toBe('125050')
})

test('filtros separam vendas e atendimentos, incluindo atividades sem ligação', async () => {
  await clicar('Atendimentos')
  expect(registros()).toHaveLength(3)
  expect(host.querySelector('ol')?.textContent).not.toContain('Venda registrada')
  expect(host.querySelector('ol')?.textContent).toContain('Atividade sem ligação')
  expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain('Atendimentos')
  await clicar('Vendas')
  expect(registros()).toHaveLength(1)
  expect(host.querySelector('ol')?.textContent).not.toContain('Retorno combinado')
  await clicar('Todos')
  expect(registros()).toHaveLength(4)
})

test('expandir e recolher todos atuam somente no filtro ativo e preservam os demais', async () => {
  await clicar('Vendas')
  await clicar('Expandir todos')
  expect(registros()[0].open).toBe(true)
  await clicar('Atendimentos')
  expect(registros().every(d => !d.open)).toBe(true)
  await clicar('Expandir todos')
  expect(registros().every(d => d.open)).toBe(true)
  await clicar('Recolher todos')
  expect(registros().every(d => !d.open)).toBe(true)
  await clicar('Todos')
  expect(registros().map(d => d.open)).toEqual([true, false, false, false])
})

test('trocar a identidade da empresa reinicia expansão mesmo com os mesmos IDs e ao voltar', async () => {
  await clicar('Expandir todos')
  await act(async () => root.render(<HistoricoComercial eventos={eventos.map(e => ({ ...e, empresa: 'empresa-b' }))} rotulo="Histórico da empresa A" />))
  expect(registros().every(d => !d.open)).toBe(true)
  await clicar('Expandir todos')
  await act(async () => root.render(<HistoricoComercial eventos={eventos} rotulo="Histórico da empresa A" />))
  expect(registros().every(d => !d.open)).toBe(true)
})

test('ausência de anotação e atividade continuam legíveis; filtro vazio não oferece expansão inútil', async () => {
  await clicar('Expandir todos')
  expect(registros()[0].textContent).toContain('Sem anotação')
  expect(registros()[3].textContent).toContain('Não liguei')
  await act(async () => root.render(<HistoricoComercial eventos={eventos.slice(1)} />))
  await clicar('Vendas')
  expect(registros()).toHaveLength(0)
  expect(host.textContent).toContain('Nenhum registro')
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Expandir todos')?.disabled).toBe(true)
})

test('clique nativo no summary sincroniza expansão individual com o comando global', async () => {
  await clicar('Vendas')
  const summary = registros()[0].querySelector('summary')!
  await act(async () => {
    summary.click()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(registros()[0].open).toBe(true)
  expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Recolher todos')).toBe(true)
  await act(async () => {
    summary.click()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(registros()[0].open).toBe(false)
  expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Expandir todos')).toBe(true)
})


test('empresa é identificação separada no cabeçalho somente no histórico multiempresa', async () => {
  const uuid = '11111111-1111-4111-8111-111111111111'
  await act(async () => root.render(<HistoricoComercial eventos={[{ ...eventos[1], empresa: uuid }]} />))
  expect(registros()[0].querySelector('summary')?.textContent).not.toContain(uuid)
  await act(async () => root.render(<HistoricoComercial mostrarEmpresa eventos={[{ ...eventos[1], empresa: 'Aurora Comercial' }]} />))
  const registro = registros()[0]
  const summary = registro.querySelector('summary')!
  expect(registro.open).toBe(false)
  expect(summary.textContent).toContain('Aurora Comercial')
  expect(summary.querySelector('strong')?.textContent).toBe('Retorno combinado')
  expect(summary.textContent).toContain('Autor não informado')
  expect(summary.textContent).toContain('22:30')
  await act(async () => root.render(<HistoricoComercial mostrarEmpresa eventos={[{ ...eventos[1], empresa: undefined }]} />))
  expect(registros()[0].querySelector('summary')?.textContent).not.toContain('Aurora Comercial')
  expect(registros()[0].querySelector('strong')?.textContent).toBe('Retorno combinado')
})

test('filtro controlado mantém controles e permite limpar vazio sem descartar eventos', async () => {
  function Dono() {
    const [valor, aoMudar] = useState<FiltroHistoricoComercial>('vendas')
    return <><HistoricoComercial eventos={eventos.slice(1)} controleFiltro={{ valor, aoMudar }} conteudoVazio={<p role="status">Sem vendas neste recorte</p>} />
      <button onClick={() => aoMudar('todos')}>Ver todos</button></>
  }
  await act(async () => root.render(<Dono />))
  expect(host.querySelector('[aria-label="Filtrar eventos"]')).not.toBeNull()
  expect(host.textContent).toContain('Sem vendas neste recorte')
  expect(registros()).toHaveLength(0)
  await clicar('Atendimentos')
  expect(registros()).toHaveLength(3)
  await clicar('Vendas')
  expect(registros()).toHaveLength(0)
  await clicar('Ver todos')
  expect(registros()).toHaveLength(3)
  expect(host.querySelector('button[aria-pressed=true]')?.textContent).toContain('Todos')
  expect(eventos).toHaveLength(4)
})

test('projeção do filtro preserva ordem, referências e entrada readonly incluindo atividade em atendimentos', () => {
  const entrada = Object.freeze([...eventos])
  expect(filtrarEventosHistorico(entrada, 'vendas').map(e => e.id)).toEqual(['venda:1'])
  expect(filtrarEventosHistorico(entrada, 'atendimentos').map(e => e.id)).toEqual(['contato:1', 'contato:2', 'atividade:1'])
  const todos = filtrarEventosHistorico(entrada, 'todos')
  expect(todos).toEqual(eventos)
  expect(todos).not.toBe(entrada)
  expect(todos[0]).toBe(entrada[0])
})
