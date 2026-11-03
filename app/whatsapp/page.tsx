import { exigir } from '@/src/server/autenticacao/guarda'
import { consultarFontes } from '@/src/server/whatsapp/consulta'
import { lerRetornoGestor } from '@/src/lib/retorno-gestor'
import { CabecalhoWhatsApp } from './cabecalho'
import { PainelWhatsApp } from './painel'
import styles from './whatsapp.module.css'
import { VisaoGeralWhatsApp } from './visao-geral'

export default async function PaginaWhatsApp({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('gestor')
  const parametros = await searchParams
  const contexto = lerRetornoGestor(parametros?.retorno)
  const retorno = contexto?.tipo === 'whatsapp' ? contexto : undefined
  const filtro = retorno?.vendedor ?? (typeof parametros?.vendedor === 'string' ? parametros.vendedor : 'todos')
  const resultado = await consultarFontes(eu.usuarioId, filtro)

  const piloto = resultado.fontes.length === 1 && resultado.fontes[0].id === 'piloto'
  const semPainel = !resultado.configurado || resultado.fontes.length === 0

  return <main className={styles.pagina}>
    {semPainel && <CabecalhoWhatsApp piloto={piloto} retorno={retorno ?? { tipo: 'whatsapp', vendedor: filtro, busca: '', categoria: 'todas', painel: 'lista' }} />}
    {semPainel && retorno?.conversa && <p role="status">Conversa anterior indisponível neste filtro.</p>}
    {(!resultado.configurado || resultado.fontes.length === 0) && <VisaoGeralWhatsApp retorno={retorno} opcoes={resultado.opcoes.map(f => ({ id: f.id, nome: f.nome }))} filtro={filtro} />}
    {resultado.fontes.length === 0 ? <section className={styles.estado} role="status"><h2>Nenhuma instância disponível neste filtro</h2><p>Escolha outro vendedor ou configure um vínculo.</p></section> : !resultado.configurado ? <section className={styles.estado} role="status">
      <h2>Integração ainda não configurada</h2>
      <p>Configure a conexão do WhatsApp no servidor do CRM.</p>
    </section> : <PainelWhatsApp key={filtro} piloto={piloto} retorno={retorno} opcoes={resultado.opcoes.map(f => ({ id: f.id, nome: f.nome }))} consultaParcial={resultado.avisos.length > 0} fontesAtivas={resultado.fontes.map(f => f.id)} filtro={filtro} cursores={resultado.cursores} mensagens={resultado.mensagens} total={resultado.avisos.length ? undefined : resultado.total} limiteHistorico={resultado.limiteHistorico} temMais={resultado.temMais}>
      {resultado.avisos.length > 0 && <p role="status">Consulta parcial. Indisponível: {resultado.avisos.join(', ')}. A atualização automática tentará novamente.</p>}
    </PainelWhatsApp>}
  </main>
}
