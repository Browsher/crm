'use client'

import { useEffect, useId, useState, type KeyboardEvent, type Ref } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { pesquisarProdutosProspeccao, type ProdutoProspeccao } from '@/src/lib/assistente-ia-catalogo'
import styles from './assistente-ia-busca.module.css'

type Props = {
  inputRef: Ref<HTMLInputElement>
  selecionar: (produto: ProdutoProspeccao) => void
  outroProduto: () => void
}

export function BuscaProdutoAssistente({ inputRef, selecionar, outroProduto }: Props) {
  const [consulta, setConsulta] = useState('')
  const [aberta, setAberta] = useState(false)
  const [ativa, setAtiva] = useState(-1)
  const id = useId()
  const resultados = aberta ? pesquisarProdutosProspeccao(consulta) : []
  const grupos = new Map<string, ProdutoProspeccao[]>()
  if (!consulta.trim()) {
    for (const produto of resultados) {
      const grupo = grupos.get(produto.familia)
      if (grupo) grupo.push(produto)
      else grupos.set(produto.familia, [produto])
    }
  }
  const produtos = grupos.size ? Array.from(grupos.values()).flat() : resultados
  const posicoes = new Map(produtos.map((produto, indice) => [produto.sku, indice]))
  const idAtivo = ativa >= 0 && produtos[ativa] ? id + '-' + ativa : undefined

  useEffect(() => {
    if (!aberta) return
    // O diálogo trata Escape na captura do documento. A lista fecha primeiro quando tem o foco.
    const fecharLista = (evento: globalThis.KeyboardEvent) => {
      if (evento.key !== 'Escape' || !(evento.target instanceof HTMLElement) || evento.target.id !== id + '-campo') return
      evento.preventDefault()
      setAberta(false)
      setAtiva(-1)
    }
    window.addEventListener('keydown', fecharLista, true)
    return () => window.removeEventListener('keydown', fecharLista, true)
  }, [aberta, id])

  useEffect(() => {
    if (idAtivo) document.getElementById(idAtivo)?.scrollIntoView?.({ block: 'nearest' })
  }, [idAtivo])

  function navegar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.nativeEvent.isComposing) return
    if (evento.key === 'Enter') {
      evento.preventDefault()
      if (idAtivo) selecionar(produtos[ativa])
      return
    }
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    evento.preventDefault()
    const quantidade = aberta ? produtos.length : pesquisarProdutosProspeccao(consulta).length
    if (!quantidade) return
    setAberta(true)
    const proxima = evento.key === 'ArrowDown' ? Math.min(ativa + 1, quantidade - 1) : ativa <= 0 ? quantidade - 1 : ativa - 1
    setAtiva(proxima)
  }

  function opcao(produto: ProdutoProspeccao) {
    const indice = posicoes.get(produto.sku)
    return <li key={produto.sku} id={id + '-' + indice} role="option" aria-selected={ativa === indice}
      onMouseDown={evento => evento.preventDefault()} onClick={() => selecionar(produto)}>
      <span>{produto.nome} · {produto.sku}</span>
      {produto.ficha && <small>{produto.ficha}</small>}
    </li>
  }

  return <div className={styles.buscaProduto}>
    <div className={styles.tituloBusca}>
      <label id={id + '-rotulo'} htmlFor={id + '-campo'}>Escolher produto</label>
      <Button type="button" variant="outline" size="sm" onClick={outroProduto}>Outro produto</Button>
    </div>
    <Input id={id + '-campo'} name="produto" ref={inputRef} value={consulta} placeholder="Busque por nome ou SKU" autoComplete="off"
      role="combobox" aria-autocomplete="list" aria-expanded={aberta && produtos.length > 0}
      aria-controls={aberta && produtos.length ? id + '-lista' : undefined} aria-activedescendant={idAtivo}
      onFocus={() => setAberta(true)}
      onClick={() => setAberta(true)}
      onBlur={() => { setAberta(false); setAtiva(-1) }}
      onChange={evento => { setConsulta(evento.target.value); setAberta(true); setAtiva(-1) }}
      onKeyDown={navegar} />
    {aberta && (produtos.length ? <ul id={id + '-lista'} role="listbox" aria-labelledby={id + '-rotulo'} className={styles.listaProdutos}>
      {grupos.size ? Array.from(grupos, ([familia, grupo]) => <li key={familia} role="group" aria-label={familia}>
        <strong className={styles.familia} aria-hidden="true">{familia}</strong>
        <ul role="presentation">{grupo.map(opcao)}</ul>
      </li>) : produtos.map(opcao)}
    </ul> : <p className={styles.ajuda} role="status">Nenhum produto encontrado. Confira o nome ou SKU, ou escolha Outro produto.</p>)}
  </div>
}
