import type { Relatorio } from '@/src/features/empresas/servico'
import { textoDaRecusa, textoDoEndereco } from '@/src/features/empresas/mensagens'
import styles from './importar.module.css'

export function RelatorioImportacao({ relatorio: r }: { relatorio: Relatorio }) {
  return <div className={styles.relatorio}>
    <dl className={styles.resumo}>
      <div><dt>Novas empresas</dt><dd>{r.novas}</dd></div>
      <div><dt>Já cadastradas</dt><dd>{r.jaCadastradas}</dd></div>
      <div><dt>Linhas recusadas</dt><dd>{r.recusadas.length}</dd></div>
    </dl>
    {textoDoEndereco(r) && <p role="status" className={styles.aviso}>{textoDoEndereco(r)}</p>}
    {r.recusadas.length > 0 && <section aria-label="Linhas recusadas">
      <h3>Corrija estas linhas na planilha</h3>
      <ul className={styles.recusas}>{r.recusadas.map(rec => <li key={`${rec.linha}-${rec.tipo}`}>{textoDaRecusa(rec)}</li>)}</ul>
    </section>}
    <p>Nada foi gravado. A confirmação adiciona somente as novas empresas aceitas.</p>
    {r.novas === 0 && <p>Não há novas empresas para importar. Volte a Enviar para conferir outro arquivo.</p>}
  </div>
}
