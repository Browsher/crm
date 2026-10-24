'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import type { BuscaSalva } from '@/src/features/busca-empresas/tipos'
import { EmpresaEncontradaDetalhes } from '@/src/components/crm/empresa-encontrada'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { importarBuscaAcao, type EstadoImportarBusca } from './acoes'
import styles from '@/src/components/crm/busca-empresas.module.css'

const inicial: EstadoImportarBusca = { erro: null, grupoId: null, inseridas: 0, vinculadas: 0 }
export function ResultadosBusca({ busca, bloqueada }: { busca: BuscaSalva; bloqueada: boolean }) {
  const [estado, acao, pendente] = useActionState(importarBuscaAcao, inicial)
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const grupo = estado.grupoId ?? busca.grupo_id
  return <form action={acao} className={styles.resultado}>
    <input type="hidden" name="busca" value={busca.id} />
    {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
    {estado.grupoId && <p role="status">{estado.inseridas} empresas novas. A lista reúne {estado.vinculadas} empresas.</p>}
    {grupo && <Button variant="outline" asChild><Link href={`/fila?grupo=${grupo}`}>Prospectar esta lista</Link></Button>}
    {!busca.empresas.length ? <p>Nenhuma empresa encontrada com esses filtros. Ajuste os critérios em uma nova busca.</p> : <>
      <p>Selecione as empresas que deseja importar. Cadastros existentes serão vinculados à lista, preservando os dados e o responsável atual.</p>
      <fieldset disabled={bloqueada || pendente}>
        <legend className={styles.ajuda}>Empresas encontradas</legend>
        <ul>{busca.empresas.map(e => <li key={e.cnpj} className={styles.selecao}>
          <label className={styles.marcar}><input type="checkbox" name="cnpjs" value={e.cnpj} aria-label={`Selecionar ${e.razao_social}`}
            disabled={!e.telefone} checked={selecionadas.includes(e.cnpj)}
            onChange={evento => setSelecionadas(v => evento.target.checked ? [...v, e.cnpj] : v.filter(c => c !== e.cnpj))} /></label>
          <EmpresaEncontradaDetalhes empresa={e} />
        </li>)}</ul>
        <div className={styles.acoes}><Button type="submit" disabled={selecionadas.length === 0}>{pendente ? 'Importando…' : 'Importar selecionadas'}</Button>
          <span>{selecionadas.length} selecionadas</span></div>
      </fieldset>
      <p className={styles.ajuda}>Empresas sem telefone válido permanecem na conferência. Nenhuma empresa entra automaticamente na carteira.</p>
    </>}
  </form>
}
