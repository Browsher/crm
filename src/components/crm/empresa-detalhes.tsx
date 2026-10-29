import type { ReactNode } from 'react'
import { dataEmpresa, formatarCnpj, telefoneEmpresa, type DetalhesEmpresa } from '@/src/lib/empresa-visual'
import { Card, CardContent, CardHeader } from '@/src/components/ui/card'
import styles from './empresa.module.css'

function Campo({ nome, children }: { nome: string; children?: ReactNode }) { return <div><dt>{nome}</dt><dd>{children || 'Não informado'}</dd></div> }
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) { return <Card><CardHeader><h4>{titulo}</h4></CardHeader><CardContent><dl className={styles.dados}>{children}</dl></CardContent></Card> }
export function EmpresaDetalhes({ empresa: e }: { empresa: DetalhesEmpresa }) {
  const d = e.dadosCadastrais
  const telefones = [...new Set([e.telefone, ...e.telefones].filter((t): t is string => Boolean(t)))]
  const capital = d?.capital_social
  return <div className={styles.grade}>
    <Secao titulo="Cadastro"><Campo nome="Razão social">{e.razaoSocial}</Campo><Campo nome="Nome fantasia">{e.nomeFantasia}</Campo><Campo nome="CNPJ">{formatarCnpj(e.cnpj)}</Campo><Campo nome="Situação cadastral">{e.situacaoCadastral}</Campo><Campo nome="Porte">{e.porte}</Campo><Campo nome="Data de abertura">{dataEmpresa(e.dataAbertura)}</Campo><Campo nome="Natureza jurídica">{d?.natureza_juridica}</Campo><Campo nome="Capital social">{capital && /^[0-9]+(?:\.[0-9]+)?$/.test(capital) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(capital)) : capital}</Campo></Secao>
    <Secao titulo="Endereço"><Campo nome="Logradouro">{e.logradouro}</Campo><Campo nome="Número">{e.numero}</Campo><Campo nome="Complemento">{e.complemento}</Campo><Campo nome="Bairro">{e.bairro}</Campo><Campo nome="Cidade / UF">{[e.cidade, e.uf].filter(Boolean).join(' / ')}</Campo><Campo nome="CEP">{e.cep?.replace(/^(\d{5})(\d{3})$/, '$1-$2')}</Campo></Secao>
    <Secao titulo="Contatos"><Campo nome="Telefone principal">{telefoneEmpresa(e.telefone)}</Campo><Campo nome="Telefones na origem">{telefones.length ? <ul>{telefones.map(t => <li key={t}>{telefoneEmpresa(t)}</li>)}</ul> : null}</Campo><Campo nome="Email">{e.email}</Campo></Secao>
    <Secao titulo="Atividades e tributação"><Campo nome="CNAE principal">{e.cnae}</Campo><Campo nome="Atividade">{e.atividade}</Campo><Campo nome="Atividades secundárias">{d?.atividades_secundarias?.length ? <ul>{d.atividades_secundarias.map((a,i) => <li key={i}>{a}</li>)}</ul> : null}</Campo><Campo nome="Regime tributário">{d?.regime_tributario?.join(', ')}</Campo></Secao>
    <Secao titulo="Sócios e administradores"><Campo nome="Nome e função">{d?.socios?.length ? <ul>{d.socios.map((s,i) => <li key={i}>{typeof s === 'string' ? s : <>{s.nome || 'Não informado'}<p className={styles.muted}>{s.funcao?.descricao || 'Não informado'}</p></>}</li>)}</ul> : null}</Campo></Secao>
  </div>
}
