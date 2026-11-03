'use client'

import { useId, useActionState, useState } from 'react'
import Link from 'next/link'
import { useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
import { FormularioSair } from '@/src/components/crm/formulario-sair'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import styles from '@/src/components/crm/acesso.module.css'
import { Alert } from '@/src/components/ui/alert'
import { trocarSenhaAcao, type EstadoTroca } from './acao'

const inicial: EstadoTroca = { erro: null }

export function Formulario({ obrigatoria = false }: { obrigatoria?: boolean }) {
  const [estado, acao, pendente] = useActionState(trocarSenhaAcao, inicial)
  const erroId = useId()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const { confirmacao } = useDescarteEdicao(senhaAtual !== '' || senhaNova !== '', pendente)
  return <>
    <form action={acao} className={styles.campos} aria-busy={pendente} aria-describedby={estado.erro ? erroId : undefined}>
      <label className={styles.campo}>
        Senha atual
        <Input name="senhaAtual" type="password" autoComplete="current-password" required disabled={pendente}
          value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} />
      </label>
      <label className={styles.campo}>
        Nova senha
        <Input
          name="senhaNova"
          type="password"
          autoComplete="new-password"
          required
          disabled={pendente}
          value={senhaNova}
          onChange={e => setSenhaNova(e.target.value)}
          minLength={8}
          maxLength={128}
        />
      </label>
      {estado.erro && (
        <Alert id={erroId} variant="danger">
          {estado.erro}
        </Alert>
      )}
      <Button type="submit" disabled={pendente}>
        {pendente ? 'Trocando…' : 'Trocar senha'}
      </Button>
    </form>
    <div className="mt-4 flex flex-wrap items-start gap-2">
      {!obrigatoria && <Button variant="outline" asChild><Link href="/">Voltar ao CRM</Link></Button>}
      <FormularioSair />
    </div>
    {confirmacao}
  </>
}
