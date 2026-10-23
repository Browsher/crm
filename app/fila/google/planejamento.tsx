'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { type PlanoGoogle, type PlanoEntrada } from '@/src/features/google/tipos'
import { normalizarCriterios, criteriosVazios } from '@/src/lib/google/criterios'
import { salvarSemanaAcao, type EstadoPlano } from './acoes'
import { DialogoCriterios } from './criterios'
import { EspelharPlanejamento } from './espelhar'
import { SincronizarPlanejamento } from './sincronizar'
import styles from './google.module.css'

const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const diaDaSemana = (dia: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))
const dataCurta = (dia: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))
function entrada(dia: string, plano?: PlanoGoogle): PlanoEntrada {
  const criterios = normalizarCriterios(plano?.criterios)
  return { dia, nicho: plano?.nicho ?? '', bairro: plano?.bairro ?? '', cidade: plano?.cidade ?? '', uf: plano?.uf ?? '', criterios: criterios.ok ? criterios.valor : criteriosVazios() }
}
export function PlanejamentoSemanal({ dias, planos, hoje, historico = [] }: { dias: string[]; planos: PlanoGoogle[]; hoje: string; rotinaIniciada?: boolean; historico?: PlanoGoogle[] }) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<PlanoEntrada[]>([])
  const [tentou, setTentou] = useState(false)
  const [conferido, setConferido] = useState(false)
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoPlano, form: FormData) => {
    setTentou(true)
    setConferido(false)
    const r = await salvarSemanaAcao(anterior, form)
    if (r.salvo) setEditando(false)
    return r
  }, { erro: null, salvo: false })
  useEffect(() => {
    if (!editando) return
    const proteger = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', proteger)
    return () => window.removeEventListener('beforeunload', proteger)
  }, [editando])
  const mover = (n: number) => { const d = new Date(dias[0] + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return '/fila/google?semana=' + d.toISOString().slice(0, 10) }
  const alterar = (dia: string, campos: Partial<PlanoEntrada>) => setRascunho(anteriores => anteriores.map(p => p.dia === dia ? { ...p, ...campos } : p))
  const temFuturo = dias.some(d => d > hoje)
  return <section className={styles.semana}>
    <div className={styles.cabecalhoSemana}><div><h2>Planejamento da semana</h2><p className={styles.ajuda}>{dataCurta(dias[0])} a {dataCurta(dias.at(-1)!)}. Sem bairro, a busca cobre a cidade inteira.</p></div>
      <div className={styles.acoes}>
        {!editando && <><Button asChild variant="outline"><Link href={mover(-7)}>Semana anterior</Link></Button><Button asChild variant="outline"><Link href={mover(7)}>Próxima semana</Link></Button></>}
        <EspelharPlanejamento dias={dias} hoje={hoje} historico={historico} disabled={editando || !historico.length} />
        {!editando && <Button type="button" disabled={!temFuturo} onClick={() => { setRascunho(dias.map(d => entrada(d, planos.find(p => p.dia === d)))); setTentou(false); setEditando(true) }}>Editar planejamento</Button>}
      </div>
    </div>
    <form action={acao}>
      <input type="hidden" name="dias" value={JSON.stringify(rascunho.filter(p => p.dia > hoje))} />
      <div className={styles.tabelaRolagem}><table className={styles.tabelaSemana}><caption className="sr-only">Planejamento semanal das buscas no Google</caption><thead><tr><th>Dia</th><th>Nicho</th><th>Bairro</th><th>Cidade / UF</th><th>Grupo de destino</th></tr></thead><tbody>
        {dias.map(dia => {
          const plano = planos.find(p => p.dia === dia)
          const p = editando ? rascunho.find(r => r.dia === dia)! : entrada(dia, plano)
          const editavel = editando && dia > hoje
          const rotulo = diaDaSemana(dia) + ', ' + dataCurta(dia)
          return <tr key={dia} data-hoje={dia === hoje ? true : undefined}><th scope="row"><span className={styles.data}>{diaDaSemana(dia)}<time dateTime={dia}>{dataCurta(dia)}</time>{dia === hoje && <span className={styles.hoje}>Hoje</span>}</span></th>
            <td><div className={styles.nichoCelula}>{editavel ? <Input aria-label={'Nicho de ' + rotulo} name={'nicho-' + dia} maxLength={100} value={p.nicho} onChange={e => alterar(dia, { nicho: e.target.value })} disabled={pendente} /> : <span>{p.nicho || <span className={styles.ajuda}>Não definido</span>}</span>}{(editavel || p.nicho) && <DialogoCriterios dia={dia} valor={p.criterios ?? criteriosVazios()} leitura={!editavel || pendente} onAplicar={criterios => alterar(dia, { criterios })} />}</div></td>
            <td>{editavel ? <Input aria-label={'Bairro de ' + rotulo} name={'bairro-' + dia} maxLength={100} value={p.bairro} onChange={e => alterar(dia, { bairro: e.target.value })} disabled={pendente} /> : p.nicho ? p.bairro || 'Cidade inteira' : 'Não definido'}</td>
            <td>{editavel ? <div className={styles.cidadeUf}><Input aria-label={'Cidade de ' + rotulo} name={'cidade-' + dia} maxLength={100} value={p.cidade} onChange={e => alterar(dia, { cidade: e.target.value })} disabled={pendente} /><NativeSelect aria-label={'UF de ' + rotulo} name={'uf-' + dia} value={p.uf} onChange={e => alterar(dia, { uf: e.target.value })} disabled={pendente}><option value="">UF</option>{ufs.map(uf => <option key={uf}>{uf}</option>)}</NativeSelect></div> : p.cidade ? p.cidade + ' / ' + p.uf : 'Não definido'}</td>
            <td>{p.nicho && p.cidade && p.uf ? p.nicho + ' · ' + (p.bairro || p.cidade) + ' / ' + p.uf : <span className={styles.ajuda}>Montado automaticamente</span>}
              {plano?.execucao_revisao && plano.execucao_revisao !== plano.revisao && <small className={styles.avisoRevisao}>A busca iniciada usa o planejamento anterior.</small>}</td>
          </tr>
        })}
      </tbody></table></div>
      {editando && <div className={styles.rodapeSemana}><p className={styles.ajuda}>Hoje e dias anteriores ficam bloqueados. Um dia vazio não gera busca.</p><div className={styles.acoes}><Button type="button" variant="outline" disabled={pendente} onClick={() => setEditando(false)}>Cancelar</Button><Button type="submit" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar planejamento'}</Button></div></div>}
      {tentou && estado.erro && <p role="alert" className={styles.aviso}>{estado.erro}</p>}
      {tentou && estado.salvo && <p role="status" className={estado.sincronizacao === 'pendente' ? styles.aviso : styles.sucesso}>{estado.aviso ?? 'Planejamento salvo.'}</p>}
    </form>
    {planos.filter(p => p.dia > hoje && p.sincronizado === false).map(p => <div key={p.id} className={styles.rodapeSemana}>
      <div><strong>Planilha pendente · {dataCurta(p.dia)}</strong><p className={styles.ajuda}>{p.sincronizacao_erro || 'O planejamento está salvo no CRM. Confira a sincronização antes da coleta.'}</p></div>
      <SincronizarPlanejamento pedido={p.id} onSucesso={() => setConferido(true)} />
    </div>)}
    {conferido && <p role="status" className={styles.sucesso}>Sincronizado com a planilha.</p>}
  </section>
}
