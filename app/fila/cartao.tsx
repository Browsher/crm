'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CardEmpresa } from '@/src/components/crm/card-empresa'
import { EmpresaDialogo } from '@/src/components/crm/empresa-dialogo'
import { Button } from '@/src/components/ui/button'
import type { AcaoEmpresa, ReferenciaEmpresa, ResumoEmpresa } from '@/src/lib/empresa-visual'
import { urlPessoal, type FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { textoDoMotivo } from '@/src/features/contato/mensagens'
import { iniciarAtendimentoAcao, retomarAtendimentoAcao } from './atendimento/acoes'
import { urlAtendimento } from './localizar/navegacao'
import { useRetomadaNaConsulta } from './localizar/recuperacao-retomada'

export function Cartao({ empresa, filtros = {}, hrefCarteira, bloquearRetomada = false }: { empresa: ResumoEmpresa; filtros?: FiltrosPessoais; hrefCarteira?: string; bloquearRetomada?: boolean }) {
  const router = useRouter()
  const retomarNaConsulta = useRetomadaNaConsulta()
  const [referencia, setReferencia] = useState<ReferenciaEmpresa | null>(null)
  const [erro, setErro] = useState('')
  const [resolvido, setResolvido] = useState(false)
  const [pendente, iniciar] = useTransition()
  const ocupado = useRef(false)
  const chaveResolvida = useRef<string | null>(null)
  const storage = 'crm:acao-empresa:v1:' + empresa.id
  function destino(acao: Extract<AcaoEmpresa, { href: string }>) {
    if (acao.tipo === 'continuar' && empresa.id) return urlAtendimento(empresa.id, filtros)
    if (acao.tipo === 'carteira' && hrefCarteira?.startsWith(acao.href + '?')) return hrefCarteira
    return acao.href
  }
  function acionar(acao: AcaoEmpresa) {
    if (ocupado.current || resolvido || (bloquearRetomada && acao.tipo === 'retomar')) return
    if (acao.tipo === 'retomar' && retomarNaConsulta?.(acao, filtros)) return
    ocupado.current = true
    iniciar(async () => {
      try {
        const salvo = sessionStorage.getItem(storage)
        if ('href' in acao && !salvo) { router.push(destino(acao)); return }
        const comando = salvo ? JSON.parse(salvo) : 'empresaId' in acao ? { id: acao.empresaId, chave: crypto.randomUUID(), versao: acao.versao, tipo: acao.tipo } : null
        if (!comando) return
        sessionStorage.setItem(storage, JSON.stringify(comando))
        const form = new FormData()
        form.set('id', comando.id); form.set('chave', comando.chave); form.set('versao', String(comando.versao))
        const r = await (comando.tipo === 'retomar' ? retomarAtendimentoAcao : iniciarAtendimentoAcao)(form)
        chaveResolvida.current = comando.chave
        if (!r.ok) { setErro(textoDoMotivo(r.motivo)); setResolvido(!['sem_permissao','nao_encontrada'].includes(r.motivo)); return }
        // RPC confirmada: limpeza/navegação não podem anunciar resultado desconhecido.
        setResolvido(true)
        setErro('Envio confirmado. Atualize a página para conferir a situação atual.')
        try {
          const atual = sessionStorage.getItem(storage)
          if (atual && JSON.parse(atual).chave !== comando.chave) return
          sessionStorage.removeItem(storage)
          const leitura = r.leituraDestino
          if (!leitura?.ok || leitura.destino.tipo === 'indisponivel') { router.refresh(); return }
          const d = leitura.destino
          setErro(r.aviso ?? '')
          if (d.tipo === 'atendimento') router.push(urlAtendimento(d.empresaId, filtros))
          if (d.tipo === 'funil') router.push('/funil?negociacao=' + encodeURIComponent(d.negociacaoId))
          if (d.tipo === 'carteira') {
            const canonico = '/carteira/' + encodeURIComponent(d.empresaId)
            router.push(hrefCarteira?.startsWith(canonico + '?') ? hrefCarteira : canonico)
          }
          if (d.tipo === 'sem_interesse') router.push(urlPessoal({ ...filtros, disponibilidade: 'sem_interesse' }, 1))
        } catch { setErro('Envio confirmado. Atualize a página para conferir a situação atual.') }
      } catch { setErro('Não foi possível confirmar. Tente novamente para confirmar o mesmo envio.') }
      finally { ocupado.current = false }
    })
  }
  return <div aria-busy={pendente}><CardEmpresa empresa={empresa} aoVer={setReferencia} aoAcionar={acionar} acaoBloqueada={bloquearRetomada && empresa.situacao === 'sem_interesse'} />
    {erro && <p role="alert">{erro}</p>}
    {resolvido && <Button variant="outline" onClick={() => {
      try {
        const salvo = sessionStorage.getItem(storage)
        if (salvo && JSON.parse(salvo).chave === chaveResolvida.current) sessionStorage.removeItem(storage)
        setResolvido(false); setErro(''); router.refresh()
      } catch { setErro('Envio resolvido. Atualize a página para conferir as anotações desta aba.') }
    }}>Atualizar empresa</Button>}
    {referencia && <EmpresaDialogo referencia={referencia} aoFechar={() => setReferencia(null)} />}
  </div>
}
