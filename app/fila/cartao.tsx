'use client'
import Link from 'next/link'
import { useContext, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CardEmpresa } from '@/src/components/crm/card-empresa'
import { EmpresaDialogo } from '@/src/components/crm/empresa-dialogo'
import { ContextoResultadoBusca } from '@/src/components/crm/contexto-resultado-busca'
import { Button } from '@/src/components/ui/button'
import type { AcaoEmpresa, ReferenciaEmpresa, ResumoEmpresa } from '@/src/lib/empresa-visual'
import { urlPessoal, type FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { textoDoMotivo } from '@/src/features/contato/mensagens'
import { iniciarAtendimentoAcao, retomarAtendimentoAcao } from './atendimento/acoes'
import { idGatilhoAtendimento, urlAtendimento, urlAtendimentoLateral } from './localizar/navegacao'
import { useRetomadaNaConsulta } from './localizar/recuperacao-retomada'

export function Cartao({ empresa, filtros = {}, hrefCarteira, bloquearRetomada = false, escopoConsulta, naFichaCarteira, consultaRecolhida }: {
  empresa: ResumoEmpresa; filtros?: FiltrosPessoais; hrefCarteira?: string; bloquearRetomada?: boolean; escopoConsulta?: string
  naFichaCarteira?: 'direta' | 'interceptada'
  consultaRecolhida?: boolean
}) {
  const router = useRouter()
  const retomarNaConsulta = useRetomadaNaConsulta()
  const resultadoBusca = useContext(ContextoResultadoBusca)
  const [consulta, setConsulta] = useState<{ referencia: ReferenciaEmpresa; gatilho: HTMLButtonElement; escopo?: string } | null>(null)
  if (consulta && consulta.escopo !== escopoConsulta) setConsulta(null)
  const [erro, setErro] = useState('')
  const [confirmarNaConsulta, setConfirmarNaConsulta] = useState(false)
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
    if (ocupado.current || resolvido) return
    let salvo: string | null
    try {
      salvo = sessionStorage.getItem(storage)
      const c: unknown = salvo ? JSON.parse(salvo) : null
      // O comando transmitido tem precedência sobre a ação do snapshot atual.
      // Identificados só podem sair pelo controlador autenticado da consulta.
      if (c && typeof c === 'object' && 'usuarioId' in c) {
        if (retomarNaConsulta?.({ empresaId: empresa.id ?? '' }, filtros)) return
        if (!retomarNaConsulta || ('tipo' in c && c.tipo === 'retomar')) {
          setConfirmarNaConsulta(true)
          setErro('Há um envio identificado pendente. Abra Localizar empresas para conferir e confirmar a retomada.')
          return
        }
      }
    } catch { setErro('Não foi possível recuperar o envio anterior. Confira o armazenamento desta aba.'); return }
    if (bloquearRetomada && acao.tipo === 'retomar') return
    if (acao.tipo === 'retomar' && retomarNaConsulta?.(acao, filtros)) return
    ocupado.current = true
    iniciar(async () => {
      try {
        if ('href' in acao && !salvo) {
          if (acao.tipo === 'continuar' && empresa.id && consultaRecolhida !== undefined) {
            router.push(urlAtendimentoLateral(empresa.id, filtros, consultaRecolhida), { scroll: false })
            return
          }
          const href = destino(acao)
          if (acao.tipo === 'carteira' && hrefCarteira === href) router.push(href, { scroll: false })
          else router.push(href)
          return
        }
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
            if (naFichaCarteira && d.empresaId === empresa.id) { router.refresh(); return }
            const canonico = '/carteira/' + encodeURIComponent(d.empresaId)
            const href = hrefCarteira?.startsWith(canonico + '?') ? hrefCarteira : canonico
            if (naFichaCarteira === 'direta') location.assign(href)
            else if (hrefCarteira === href) router.push(href, { scroll: false })
            else router.push(href)
          }
          if (d.tipo === 'sem_interesse') router.push(urlPessoal({ ...filtros, disponibilidade: 'sem_interesse' }, 1))
        } catch { setErro('Envio confirmado. Atualize a página para conferir a situação atual.') }
      } catch { setErro('Não foi possível confirmar. Tente novamente para confirmar o mesmo envio.') }
      finally { ocupado.current = false }
    })
  }
  const idAcao = consultaRecolhida !== undefined && empresa.situacao === 'atendimento' && empresa.id ? idGatilhoAtendimento(empresa.id) : undefined
  return <div aria-busy={pendente}><CardEmpresa empresa={empresa} idAcao={idAcao} aoVer={resultadoBusca?.verEmpresa ?? ((referencia, gatilho) => setConsulta({ referencia, gatilho, escopo: escopoConsulta }))} aoAcionar={acionar} acaoBloqueada={bloquearRetomada && empresa.situacao === 'sem_interesse'} />
    {erro && <p role="alert">{erro}</p>}
    {confirmarNaConsulta && <Button asChild variant="outline"><Link href={urlPessoal(filtros, Number(filtros.pagina || 1))}>Confirmar em Localizar empresas</Link></Button>}
    {resolvido && <Button variant="outline" onClick={() => {
      try {
        const salvo = sessionStorage.getItem(storage)
        if (salvo && JSON.parse(salvo).chave === chaveResolvida.current) sessionStorage.removeItem(storage)
        setResolvido(false); setErro(''); router.refresh()
      } catch { setErro('Envio resolvido. Atualize a página para conferir as anotações desta aba.') }
    }}>Atualizar empresa</Button>}
    {consulta && <EmpresaDialogo referencia={consulta.referencia} origem={consulta.gatilho} aoFechar={() => setConsulta(null)} />}
  </div>
}
