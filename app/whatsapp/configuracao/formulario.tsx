'use client'

import { startTransition, useActionState } from 'react'
import { Alert } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { removerVinculoAcao, salvarVinculoAcao, type EstadoVinculo } from './acoes'
import styles from './configuracao.module.css'

const inicial: EstadoVinculo = { erro: null, sucesso: null }

function Retorno({ estado }: { estado: EstadoVinculo }) {
  return <>{estado.erro && <Alert variant="danger">{estado.erro}</Alert>}{estado.sucesso && <p role="status">{estado.sucesso}</p>}</>
}

export function FormularioVinculo({ vendedores }: { vendedores: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState(salvarVinculoAcao, inicial)
  const desabilitado = pendente || vendedores.length === 0
  return <form action={acao} className={styles.formulario} onSubmit={e => {
    // O reset automático das actions apagaria os campos mesmo em uma falha recuperável.
    e.preventDefault()
    const dados = new FormData(e.currentTarget)
    startTransition(() => acao(dados))
  }}>
    <label htmlFor="vinculo-vendedor">Vendedor ativo</label>
    <select id="vinculo-vendedor" name="vendedorId" required disabled={desabilitado} defaultValue="">
      <option value="">Selecione um vendedor</option>
      {vendedores.map(vendedor => <option key={vendedor.id} value={vendedor.id}>{vendedor.nome}</option>)}
    </select>
    {vendedores.length === 0 && <p>Nenhum vendedor ativo. Cadastre ou reative um vendedor em Usuários.</p>}
    <label htmlFor="vinculo-instancia">Nome exato da instância existente</label>
    <Input id="vinculo-instancia" name="instancia" required maxLength={100} disabled={desabilitado} autoComplete="off" aria-describedby="vinculo-ajuda" />
    <p id="vinculo-ajuda">Se o vendedor já tiver uma instância, salvar substitui o vínculo anterior. Uma instância só pode pertencer a um vendedor.</p>
    <Retorno estado={estado} />
    <Button type="submit" disabled={desabilitado}>{pendente ? 'Validando e salvando…' : 'Salvar ou substituir vínculo'}</Button>
  </form>
}

export function FormularioRemover({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, pendente] = useActionState(removerVinculoAcao, inicial)
  return <form action={acao} className={styles.remover}>
    <input type="hidden" name="id" value={id} />
    <Button type="submit" variant="outline" disabled={pendente} aria-label={`Remover vínculo de ${nome}`}>{pendente ? 'Removendo…' : 'Remover vínculo'}</Button>
    <Retorno estado={estado} />
  </form>
}
