'use client'

import Link from 'next/link'
import { useActionState, useContext, useId } from 'react'
import { createPortal } from 'react-dom'
import type { BuscaSalva } from '@/src/features/busca-empresas/tipos'
import { Cartao } from '../cartao'
import { detalhesSnapshot, type ResumoEmpresa } from '@/src/lib/empresa-visual'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { ContextoResultadoBusca } from '@/src/components/crm/contexto-resultado-busca'
import { concluirInclusaoAcao, type EstadoImportarBusca } from './acoes'
import styles from '@/src/components/crm/busca-empresas.module.css'

const inicial: EstadoImportarBusca = { erro: null, grupoId: null, inseridas: 0, vinculadas: 0, concluido: false }
export function ResultadosBusca({ busca, bloqueada, resumos = [] }: { busca: BuscaSalva; bloqueada: boolean; resumos?: ResumoEmpresa[] }) {
  const [estado, acao, pendente] = useActionState(concluirInclusaoAcao, inicial)
  const contexto = useContext(ContextoResultadoBusca)
  const id = useId()
  const atuais = estado.resumos ?? resumos
  const grupo = estado.grupoId ?? busca.grupo_id
  const concluida = estado.concluido || busca.inclusao_automatica_concluida
  const retomar = !concluida && busca.empresas.some(e => e.telefone && !e.bloqueada_por_repeticao)
  const acoes = <>
    {retomar && <Button type="submit" form={id} disabled={bloqueada || pendente}>{pendente ? 'Incluindo empresas…' : 'Concluir inclusão'}</Button>}
    {grupo && <Button variant="outline" asChild><Link href="/fila/localizar?origem=banco">Localizar minhas empresas</Link></Button>}
  </>
  return <form id={id} action={acao} className={styles.resultado}>
    <input type="hidden" name="busca" value={busca.id} />
    {estado.erro && <Alert variant="danger" role="alert">{estado.erro}</Alert>}
    {estado.aviso && <Alert role="status">{estado.aviso}</Alert>}
    {estado.concluido && <p role="status">{estado.inseridas} empresas novas. A lista reúne {estado.vinculadas} empresas.</p>}
    {grupo && <p role="status">{concluida ? 'As empresas válidas desta busca já foram adicionadas automaticamente à sua lista de prospecção.' : 'Lista de prospecção disponível.'}</p>}
    {bloqueada && <Alert variant="warning">Inclusões pausadas pelo gestor. Você pode conferir as empresas.</Alert>}
    {!busca.empresas.length ? <p>Nenhuma empresa encontrada com esses filtros. Ajuste os critérios em uma nova busca.</p> : <>
      {retomar && <p>Conclua a inclusão das empresas válidas desta busca na mesma lista, sem refazer a pesquisa. Seus resultados estão salvos.</p>}
      {!grupo && !retomar && <p>Não há empresas novas com telefone válido disponíveis para esta lista.</p>}
      <ul className="grid list-none gap-4 p-0">{busca.empresas.map(e => <li key={e.cnpj} className="min-w-0">
        <Cartao empresa={atuais.find(r => r.cnpj === e.cnpj) ?? detalhesSnapshot(e, { tipo: 'busca', buscaId: busca.id, cnpj: e.cnpj }, busca.criado_em)} filtros={{ origem: 'banco' }} />
        {e.bloqueada_por_repeticao && <p className={styles.aviso}>Empresa ou contato já cadastrado na base global. Inclusão bloqueada.</p>}
      </li>)}</ul>
      <p className={styles.ajuda}>Somente empresas com telefone válido e sem repetição entram na lista de prospecção.</p>
    </>}
    {contexto ? contexto.rodape && createPortal(acoes, contexto.rodape) : acoes}
  </form>
}
