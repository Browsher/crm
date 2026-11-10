'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import { FechamentoFichaContexto } from '@/src/components/crm/navegacao-ficha'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { Button } from '@/src/components/ui/button'
import { Dialog } from '@/src/components/ui/dialog'
import { lerFichaEmpresaAcao } from './ficha-acao'
import { ConteudoFicha, IdentificacaoFicha } from './ficha'
import styles from './perfil.module.css'

export function LinkFichaEmpresa({ href, ...props }: ComponentPropsWithoutRef<'a'> & { href: string }) {
  const gatilho = useRef<HTMLAnchorElement>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  if (aberta && aberta !== href) setAberta(null)

  return <>
    <Link {...props} ref={gatilho} href={href} prefetch={false} aria-haspopup="dialog" onNavigate={evento => {
      evento.preventDefault()
      setAberta(href)
    }} />
    {aberta && <FichaSobreposta key={aberta} href={aberta} aoFechar={() => setAberta(null)} aoRestaurarFoco={() => {
      if (gatilho.current?.isConnected) gatilho.current.focus({ preventScroll: true })
    }} />}
  </>
}

function FichaSobreposta({ href, aoFechar, aoRestaurarFoco }: { href: string; aoFechar: () => void; aoRestaurarFoco: () => void }) {
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof lerFichaEmpresaAcao>> | null>(null)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let atual = true
    lerFichaEmpresaAcao(href).then(
      resposta => { if (atual) setResultado(resposta) },
      () => { if (atual) setResultado({ ok: false, motivo: 'falha_leitura' }) },
    )
    return () => { atual = false }
  }, [href, tentativa])

  const falha = resultado?.ok === false && resultado.motivo === 'falha_leitura'
  return <Dialog open>
    <PainelSobrepostoCrm titulo={resultado?.ok ? resultado.ficha.empresa.nome : 'Ficha da empresa'} descricao="Consulta completa da empresa" ocupado={!resultado}
      aoFechar={aoFechar} onCloseAutoFocus={evento => { evento.preventDefault(); aoRestaurarFoco() }}>
      {!resultado && <p role="status">Carregando ficha da empresa…</p>}
      {resultado?.ok === false && <div className="grid justify-items-start gap-3">
        <p role="alert">{falha ? 'Não foi possível carregar a ficha da empresa.' : 'Esta empresa não está disponível para você.'}</p>
        {falha && <Button type="button" variant="outline" onClick={() => {
          setResultado(null)
          setTentativa(anterior => anterior + 1)
        }}>Tentar novamente</Button>}
      </div>}
      {resultado?.ok && <FechamentoFichaContexto.Provider value={aoFechar}>
        <div className={styles.pagina}>
          <IdentificacaoFicha empresa={resultado.ficha.empresa} />
          <ConteudoFicha ficha={resultado.ficha} abaInicial={resultado.abaInicial} origemHistorico={resultado.origemHistorico} lateral />
        </div>
      </FechamentoFichaContexto.Provider>}
    </PainelSobrepostoCrm>
  </Dialog>
}
