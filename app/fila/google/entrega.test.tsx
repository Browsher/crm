import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { DetalheEntrega } from './entrega'
import type { PlanoGoogle } from '@/src/features/google/tipos'
import { criteriosVazios } from '@/src/lib/google/criterios'
const plano: PlanoGoogle = { id: 'p', vendedor_id: 'v', vendedor: 'Ana', dia: '2026-10-26', nicho: 'Plano editado', bairro: '', cidade: 'São Paulo', uf: 'SP', estado: 'concluido', snapshot: { nicho: 'Pesquisa original', bairro: 'Brás', cidade: 'São Paulo', uf: 'SP' }, motivo: null, iniciado_em: null, concluido_em: null, encontradas: 1, entregues: 1, trabalhadas: 0, pendentes: 0, indisponiveis: 0 }
test('histórico usa snapshot e diferencia ausência de contato de validação', () => {
  const html = renderToStaticMarkup(<DetalheEntrega plano={plano} recibo={null} resultados={[{ id:'r', empresa_id:null, situacao:'entregue', dados:{nome_fantasia:'Loja',telefone:null},motivo:null,entregue_em:null,trabalhada:false }]} gestor />)
  expect(html).toContain('Pesquisa original')
  expect(html).toContain('Sem telefone informado')
  expect(html).toContain('Não verificado')
  expect(html).not.toContain('Pendente de validação')
})
test('critérios usados ficam consultáveis inclusive quando o mínimo é zero', () => {
  const p = {...plano,snapshot:{...plano.snapshot!,criterios:{...criteriosVazios(),nota:0,telefone:['fixo' as const]}}}
  const html=renderToStaticMarkup(<DetalheEntrega plano={p} recibo={null} resultados={[]} />)
  expect(html).toContain('Nota mínima')
  expect(html).toContain('Telefone fixo')
})

test('recibo legado não apresenta validação antiga como uma entrega direta V2', () => {
  const html = renderToStaticMarkup(<DetalheEntrega plano={plano} recibo={{ validacao_conferida: true }} resultados={[]} />)
  expect(html).toContain('validação de contatos do fluxo anterior')
  expect(html).not.toContain('Entrega direta')
})

test('histórico com falha usa aviso e resultados sem empresas orientam a voltar ao planejamento', () => {
  const html = renderToStaticMarkup(<DetalheEntrega plano={{ ...plano, estado: 'falhou', motivo: 'Falha na coleta' }} recibo={null} resultados={[]} />)
  expect(html).toContain('data-slot="alert"')
  expect(html).toContain('role="alert"')
  expect(html).toContain('Nenhuma empresa liberada nesta entrega')
  expect(html).toContain('>Ver planejamento</a>')
})