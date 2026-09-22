import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { listarVendedores, listarVinculos } from '@/src/server/whatsapp/vinculos'
import { FormularioRemover, FormularioVinculo } from './formulario'
import styles from './configuracao.module.css'

export default async function PaginaConfiguracao() {
  const eu = await exigir('gestor')
  const [vendedores, vinculos] = await Promise.all([listarVendedores(eu.usuarioId), listarVinculos(eu.usuarioId)])
  return <main className={styles.pagina}>
    <header><Link href="/whatsapp">Voltar ao WhatsApp</Link><h1>Configurar vendedores</h1><p>Associe cada vendedor à sua conexão do WhatsApp.</p></header>
    <section className={styles.cartao} aria-labelledby="titulo-vincular">
      <h2 id="titulo-vincular">Vincular instância</h2>
      <FormularioVinculo vendedores={vendedores} />
    </section>
    <section className={styles.cartao} aria-labelledby="titulo-vinculos">
      <h2 id="titulo-vinculos">Vínculos cadastrados</h2>
      <p>Remover um vínculo não exclui a conexão nem o histórico.</p>
      {vinculos.length === 0 ? <p>Nenhum vínculo cadastrado.</p> : <ul className={styles.lista}>{vinculos.map(vinculo => <li key={vinculo.id}>
        <div><h3>{vinculo.nome}</h3><p>{vinculo.instancia}</p>{!vinculo.ativo && <><strong className={styles.indisponivel}>Indisponível</strong><p>Usuário inativo ou sem papel de vendedor.</p></>}</div>
        <FormularioRemover id={vinculo.id} nome={vinculo.nome} />
      </li>)}</ul>}
    </section>
  </main>
}
