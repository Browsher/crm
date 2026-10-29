'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CardEmpresa } from '@/src/components/crm/card-empresa'
import { EmpresaDialogo } from '@/src/components/crm/empresa-dialogo'
import { Button } from '@/src/components/ui/button'
import type { AcaoEmpresa, ReferenciaEmpresa, ResumoEmpresa } from '@/src/lib/empresa-visual'
import type { FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { textoDoMotivo } from '@/src/features/contato/mensagens'
import { iniciarAtendimentoAcao, retomarAtendimentoAcao } from './atendimento/acoes'
import { urlAtendimento } from './localizar/navegacao'

export function Cartao({ empresa, filtros = {} }: { empresa: ResumoEmpresa; filtros?: FiltrosPessoais }) {
  const router = useRouter()
  const [referencia, setReferencia] = useState<ReferenciaEmpresa | null>(null)
  const [erro, setErro] = useState('')
  const [resolvido, setResolvido] = useState(false)
  const [pendente, iniciar] = useTransition()
  const ocupado = useRef(false)
  const storage = 'crm:acao-empresa:v1:' + empresa.id
  function acionar(acao: AcaoEmpresa) {
    if (ocupado.current || resolvido) return
    ocupado.current = true
    iniciar(async () => {
      try {
        const salvo = sessionStorage.getItem(storage)
        if ('href' in acao && !salvo) { router.push(acao.tipo === 'continuar' && empresa.id ? urlAtendimento(empresa.id, filtros) : acao.href); return }
        const comando = salvo ? JSON.parse(salvo) : 'empresaId' in acao ? { id: acao.empresaId, chave: crypto.randomUUID(), versao: acao.versao, tipo: acao.tipo } : null
        if (!comando) return
        sessionStorage.setItem(storage, JSON.stringify(comando))
        const form = new FormData()
        form.set('id', comando.id); form.set('chave', comando.chave); form.set('versao', String(comando.versao))
        const r = await (comando.tipo === 'retomar' ? retomarAtendimentoAcao : iniciarAtendimentoAcao)(form)
        if (!r.ok) { setErro(textoDoMotivo(r.motivo)); setResolvido(true); return }
        sessionStorage.removeItem(storage); setErro(''); router.refresh()
        if ('href' in acao) router.push(acao.tipo === 'continuar' && empresa.id ? urlAtendimento(empresa.id, filtros) : acao.href)
        else if (comando.tipo === acao.tipo) router.push(urlAtendimento(acao.empresaId, filtros))
        else setErro('Envio anterior confirmado. Confira a situação atual antes de continuar.')
      } catch { setErro('Não foi possível confirmar. Tente novamente para confirmar o mesmo envio.') }
      finally { ocupado.current = false }
    })
  }
  return <div aria-busy={pendente}><CardEmpresa empresa={empresa} aoVer={setReferencia} aoAcionar={acionar} />
    {erro && <p role="alert">{erro}</p>}
    {resolvido && <Button variant="outline" onClick={() => { sessionStorage.removeItem(storage); setResolvido(false); setErro(''); router.refresh() }}>Atualizar empresa</Button>}
    {referencia && <EmpresaDialogo referencia={referencia} aoFechar={() => setReferencia(null)} />}
  </div>
}
