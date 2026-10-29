'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { EmpresaEncontrada } from '@/src/features/busca-empresas/tipos'
import { formatarCnpj, formatarTelefone } from '@/src/features/empresas/formato'
import { Card, CardContent, CardHeader } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import styles from './busca-dialogo.module.css'

function Campo({ nome, children }: { nome: string; children?: ReactNode }) {
  return <div><dt>{nome}</dt><dd>{children || 'Não informado'}</dd></div>
}
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <Card className={styles.card}><CardHeader><h4>{titulo}</h4></CardHeader><CardContent><dl className={styles.dados}>{children}</dl></CardContent></Card>
}
function dataAbertura(data: string | null) {
  if (!data) return null
  const d = new Date(data + 'T00:00:00Z')
  return Number.isNaN(d.valueOf()) ? data : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}
function capital(valor?: string | null) {
  if (!valor) return null
  return /^[0-9]+(?:\.[0-9]+)?$/.test(valor) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor)) : valor
}
export function EmpresaEncontradaDetalhes({ empresa: e }: { empresa: EmpresaEncontrada }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  const d = e.detalhes
  const telefones = [...new Set([e.telefone, ...e.telefones].filter((t): t is string => Boolean(t)))]
  return <Card className={styles.empresa}>
    <CardHeader className="gap-3">
      <div className={styles.resumo}><div className={styles.nome}><h3>{e.nome_fantasia ?? e.razao_social}</h3>{e.nome_fantasia && <p className="text-sm text-muted-foreground">{e.razao_social}</p>}</div>
        <Badge variant="outline">{e.situacao || 'Situação não informada'}</Badge></div>
      <p className="text-sm text-muted-foreground">{formatarCnpj(e.cnpj)} · {[e.bairro, e.cidade, e.uf].filter(Boolean).join(' / ') || 'Localização não informada'}</p>
      <div className={styles.contatos}><p>{e.telefone ? formatarTelefone(e.telefone) : 'Sem telefone válido'}</p><p>{e.email || 'Email não informado'}</p></div>
    </CardHeader>
    <CardContent className="grid gap-4">
      <Button type="button" variant="outline" className="w-fit" aria-label={`${aberto ? 'Ver menos' : 'Ver mais'}: ${e.razao_social}`} aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(!aberto)}>
        {aberto ? 'Ver menos' : 'Ver mais'}<ChevronDown aria-hidden="true" className={aberto ? 'rotate-180' : ''} />
      </Button>
      {aberto && <div id={id} className={styles.grade}>
        <Secao titulo="Cadastro"><Campo nome="Razão social">{e.razao_social}</Campo><Campo nome="Nome fantasia">{e.nome_fantasia}</Campo><Campo nome="CNPJ">{formatarCnpj(e.cnpj)}</Campo>
          <Campo nome="Situação cadastral">{e.situacao}</Campo><Campo nome="Porte">{e.porte}</Campo><Campo nome="Data de abertura">{dataAbertura(e.data_abertura)}</Campo><Campo nome="Natureza jurídica">{d?.natureza_juridica}</Campo><Campo nome="Capital social">{capital(d?.capital_social)}</Campo></Secao>
        <Secao titulo="Endereço"><Campo nome="Logradouro">{e.logradouro}</Campo><Campo nome="Número">{e.numero}</Campo><Campo nome="Complemento">{e.complemento}</Campo><Campo nome="Bairro">{e.bairro}</Campo><Campo nome="Cidade / UF">{[e.cidade, e.uf].filter(Boolean).join(' / ')}</Campo><Campo nome="CEP">{e.cep?.replace(/^(\d{5})(\d{3})$/, '$1-$2')}</Campo></Secao>
        <Secao titulo="Contatos"><Campo nome="Telefone principal">{e.telefone ? formatarTelefone(e.telefone) : 'Sem telefone válido'}</Campo><Campo nome="Telefones na origem">{telefones.length ? <ul className="grid gap-1">{telefones.map(t => <li key={t}>{formatarTelefone(t)}</li>)}</ul> : null}</Campo><Campo nome="Email">{e.email}</Campo></Secao>
        <Secao titulo="Atividades e tributação"><Campo nome="CNAE principal">{e.cnae_principal}</Campo><Campo nome="Atividades secundárias">{d?.atividades_secundarias?.length ? <ul className="grid gap-1">{d.atividades_secundarias.map((a, i) => <li key={i}>{a}</li>)}</ul> : null}</Campo><Campo nome="Regime tributário">{d?.regime_tributario?.join(', ')}</Campo></Secao>
        <Secao titulo="Sócios e administradores"><Campo nome="Nome e função">{d?.socios?.length ? <ul className="grid gap-3">{d.socios.map((s, i) => <li key={i}>{typeof s === 'string' ? s : <><p className="font-medium">{s.nome || 'Nome não informado'}</p><p className="text-muted-foreground">{s.funcao?.descricao || 'Função não informada'}</p></>}</li>)}</ul> : null}</Campo></Secao>
      </div>}
    </CardContent>
  </Card>
}
