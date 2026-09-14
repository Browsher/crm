import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Button } from '@/src/components/ui/button'
import styles from './gestao.module.css'

const areas = [
  { titulo: 'Empresas', texto: 'Consulte a base de empresas, filtre os dados e importe novas planilhas.', href: '/empresas', acao: 'Gerenciar empresas' },
  { titulo: 'Grupos', texto: 'Organize as importações e controle quais grupos ficam disponíveis para a equipe.', href: '/empresas/grupos', acao: 'Gerenciar grupos' },
  { titulo: 'Usuários', texto: 'Crie acessos e gerencie os papéis, as senhas e a situação dos usuários.', href: '/usuarios', acao: 'Gerenciar usuários' },
]

export default async function Gestao() {
  await exigir('gestor')
  return <main className={styles.pagina}>
    <header><h1>Gestão</h1><p>Organize a base de empresas e os acessos da sua equipe.</p></header>
    <div className={styles.grade}>{areas.map(area => <section key={area.href} className={styles.card}>
      <h2>{area.titulo}</h2><p>{area.texto}</p><Button asChild variant="outline"><Link href={area.href}>{area.acao}</Link></Button>
    </section>)}</div>
  </main>
}
