import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { bancoInicial } from '@/src/lib/banco-empresas'
import { CriteriosBanco } from './criterios-banco'

test('histórico mostra listas e exclusões de cada regime sem misturar datas',()=>{
 const html=renderToStaticMarkup(createElement(CriteriosBanco,{filtros:{...bancoInicial(),cnaes:['4755502'],cnaesSecundarios:['4742300'],aberturaUltimosDias:'7',excluirMei:true,meiExclusaoDe:'2025-01-01',excluirSimples:true,simplesExclusaoAte:'2026-01-01'}}))
 for(const texto of ['CNAEs principais','CNAEs secundários','4755502','4742300','Abertas nos últimos dias','Excluir optantes do MEI','Exclusão do MEI a partir de','Exclusão do Simples até'])expect(html).toContain(texto)
})
test('histórico anterior mantém a descrição de uma lista e onde pesquisar',()=>{
 const html=renderToStaticMarkup(createElement(CriteriosBanco,{filtros:{...bancoInicial(),cnaes:['4755502'],atividadeTipo:['principal','secundaria']}}))
 expect(html).toContain('CNAEs</dt>');expect(html).toContain('principal, secundaria')
 expect(html).not.toContain('CNAEs secundários');expect(html).not.toContain('Excluir optantes')
})
