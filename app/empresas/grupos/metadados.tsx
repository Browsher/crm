'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { atualizarMetadadosGrupoAcao, type EstadoGrupo } from './acoes'
import { Textarea } from '@/src/components/ui/textarea'
import styles from './grupos.module.css'

type Props = { id: string; descricao: string | null; origem: string | null; criterios: string | null }
export function MetadadosGrupo({ id, descricao, origem, criterios }: Props) {
  const [valores, setValores] = useState({ descricao: descricao ?? '', origem: origem ?? '', criterios: criterios ?? '' })
  const inicial: EstadoGrupo = { erro: null, sucesso: false }
  const [estado, acao, pendente] = useActionState(atualizarMetadadosGrupoAcao, inicial)
  return <section aria-label="Contexto da lista">
    <h2>Contexto da lista</h2>
    <dl>
      <dt>Resumo da lista</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{descricao ?? 'Resumo não informado'}</dd>
      <dt>Origem dos dados</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{origem ?? 'Origem não informada'}</dd>
      <dt>Critérios usados</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{criterios ?? 'Critérios não informados'}</dd>
    </dl>
    <details>
      <summary>Corrigir contexto da lista</summary>
      <form action={acao} className={styles.formulario}>
        <input type="hidden" name="id" value={id} />
        <fieldset disabled={pendente}>
          {([
            ['descricao', 'Resumo da lista', 500], ['origem', 'Origem dos dados', 500], ['criterios', 'Critérios usados', 2000],
          ] as const).map(([campo, rotulo, limite]) => <label key={campo} className={styles.campo}>
            {rotulo}
            <Textarea name={campo} aria-label={rotulo} value={valores[campo]} required={campo !== 'criterios'} rows={3}
              aria-describedby={`correcao-${campo}`} onChange={e => setValores(anterior => ({ ...anterior, [campo]: e.target.value }))} />
            <span id={`correcao-${campo}`}>Até {limite} caracteres. {campo === 'criterios' ? 'Opcional.' : 'Obrigatório.'}</span>
          </label>)}
          <Button type="submit">{pendente ? 'Salvando…' : 'Salvar contexto'}</Button>
        </fieldset>
        {estado.erro && <p role="alert">{estado.erro}</p>}
        {estado.sucesso && <p role="status">Contexto atualizado.</p>}
      </form>
    </details>
  </section>
}
