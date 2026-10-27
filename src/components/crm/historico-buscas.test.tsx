import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { HistoricoBuscas } from './historico-buscas'
import type { ResumoBusca } from '@/src/features/busca-empresas/repositorio'

const busca: ResumoBusca = {
  id: '12345678-1234-1234-1234-123456789012', nome: 'Armarinhos do Centro', usuario_id: 'vendedor', vendedor: 'Vendedor',
  fornecedor: 'Casa dos Dados', criado_em: '2026-10-27T15:57:00Z', estado: 'concluida', motivo: null, grupo_id: null, retornadas: 0,
  filtros: { palavra: 'armarinhos', cnae: '', uf: 'SP', cidade: 'São Paulo', bairro: 'Centro', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 5, offset: 0 },
}

test('histórico abre consulta em botão, sem link que navega para outra página', () => {
  const html = renderToStaticMarkup(<HistoricoBuscas buscas={[busca]} />)
  expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"/)
  expect(html).not.toContain('href="/fila/buscar?busca=')
  expect(html).toContain('5 solicitadas')
})
