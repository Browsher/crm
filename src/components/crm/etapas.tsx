import styles from './etapas.module.css'

type ItemEtapa = { id: string; rotulo: string; acao?: React.ReactNode }
type PropsEtapas = {
  rotulo: string
  atual: string
  itens: readonly ItemEtapa[]
}

export function Etapas({ rotulo, atual, itens }: PropsEtapas) {
  return <nav aria-label={rotulo} className={styles.etapas}>
    {itens.map(item => <div key={item.id} aria-current={item.id === atual ? 'step' : undefined}>
      {item.acao ?? <span>{item.rotulo}</span>}
    </div>)}
  </nav>
}
