'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import styles from './usuarios.module.css'

export function useCopiarSenha() {
  const [aviso, setAviso] = useState('')
  async function copiar(senha: string) {
    try { await navigator.clipboard.writeText(senha); setAviso('Senha copiada.') }
    catch { setAviso('Não foi possível copiar. Selecione a senha e copie manualmente.') }
  }
  return { aviso, copiar }
}

export function SenhaProvisoria({ senha, nome, aviso, focar = false }: { senha: string; nome: string; aviso: string; focar?: boolean }) {
  const instrucao = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => {
    if (focar) instrucao.current?.focus({ preventScroll: true })
  }, [focar])

  return <div className={styles.formulario}>
    <p ref={instrucao} tabIndex={focar ? -1 : undefined}>Entregue esta senha provisória a <strong>{nome}</strong>.</p>
    <code className={styles.senha}>{senha}</code>
    <p className={styles.muted}>Ao fechar, você não poderá consultar esta senha novamente. A pessoa deverá trocá-la no primeiro acesso.</p>
    <p role="status">{aviso}</p>
  </div>
}
