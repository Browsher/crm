'use client'

import { startTransition, useActionState, useState } from 'react'
import { useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
import { Alert } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { removerVinculoAcao, salvarVinculoAcao, type EstadoVinculo } from './acoes'
import styles from './configuracao.module.css'
import { NativeSelect } from '@/src/components/ui/native-select'

const inicial: EstadoVinculo = { erro: null, sucesso: null }

function Retorno({ estado }: { estado: EstadoVinculo }) {
  return <>{estado.erro && <Alert variant="danger">{estado.erro}</Alert>}{estado.sucesso && <Alert variant="success" role="status">{estado.sucesso}</Alert>}</>
}

export function FormularioVinculo({ vendedores }: { vendedores: { id: string; nome: string }[] }) {
  const [salvo, setSalvo] = useState({ vendedorId: '', instancia: '' })
  const [valores, setValores] = useState(salvo)
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoVinculo, dados: FormData) => {
    const resultado = await salvarVinculoAcao(anterior, dados)
    if (resultado.sucesso) setSalvo(valores)
    return resultado
  }, inicial)
  const desabilitado = pendente || vendedores.length === 0
  const alterado = salvo.vendedorId !== valores.vendedorId || salvo.instancia !== valores.instancia
  const { pedir, confirmacao } = useDescarteEdicao(alterado, pendente)
  const cancelar = () => pedir(() => setValores(salvo))
  return <><form action={acao} className={styles.formulario} onKeyDown={e => {
    if (alterado && e.key === 'Escape') { e.preventDefault(); cancelar() }
  }} onSubmit={e => {
    // O reset automático das actions apagaria os campos mesmo em uma falha recuperável.
    e.preventDefault()
    const dados = new FormData(e.currentTarget)
    startTransition(() => acao(dados))
  }}>
    <label htmlFor="vinculo-vendedor">Vendedor ativo</label>
    <NativeSelect id="vinculo-vendedor" name="vendedorId" required disabled={desabilitado} value={valores.vendedorId} onChange={e => setValores({ ...valores, vendedorId: e.target.value })}>
      <option value="">Selecione um vendedor</option>
      {vendedores.map(vendedor => <option key={vendedor.id} value={vendedor.id}>{vendedor.nome}</option>)}
    </NativeSelect>
    {vendedores.length === 0 && <p>Nenhum vendedor ativo. Cadastre ou reative um vendedor em Usuários.</p>}
    <label htmlFor="vinculo-instancia">Nome exato da instância existente</label>
    <Input id="vinculo-instancia" name="instancia" required maxLength={100} disabled={desabilitado} autoComplete="off" aria-describedby="vinculo-ajuda"
      value={valores.instancia} onChange={e => setValores({ ...valores, instancia: e.target.value })} />
    <p id="vinculo-ajuda">Se o vendedor já tiver uma instância, salvar substitui o vínculo anterior. Uma instância só pode pertencer a um vendedor.</p>
    <Retorno estado={estado} />
    {alterado && <Button type="button" variant="outline" disabled={pendente} onClick={cancelar}>Cancelar</Button>}
    <Button type="submit" disabled={desabilitado}>{pendente ? 'Validando e salvando…' : 'Salvar ou substituir vínculo'}</Button>
  </form>{confirmacao}</>
}

export function FormularioRemover({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, pendente] = useActionState(removerVinculoAcao, inicial)
  return <form action={acao} className={styles.remover}>
    <input type="hidden" name="id" value={id} />
    <Button type="submit" variant="outline" disabled={pendente} aria-label={`Remover vínculo de ${nome}`}>{pendente ? 'Removendo…' : 'Remover vínculo'}</Button>
    <Retorno estado={estado} />
  </form>
}
