'use client'
import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import styles from './usuarios.module.css'

export function SenhaProvisoria({ senha, nome, concluir }: { senha: string; nome: string; concluir: () => void }) {
  const [aviso, setAviso] = useState('')
  async function copiar() {
    try { await navigator.clipboard.writeText(senha); setAviso('Senha copiada.') }
    catch { setAviso('Não foi possível copiar. Selecione a senha e copie manualmente.') }
  }
  return <div className={styles.formulario}>
    <p>Entregue esta senha provisória a <strong>{nome}</strong>.</p>
    <code className={styles.senha}>{senha}</code>
    <p className={styles.muted}>Ao fechar, você não poderá consultar esta senha novamente. A pessoa deverá trocá-la no primeiro acesso.</p>
    <p role="status">{aviso}</p>
    <div className={styles.acoes}><Button variant="outline" onClick={copiar}>Copiar senha</Button><Button onClick={concluir}>Concluir</Button></div>
  </div>
}
