'use client'
import { acaoEmpresa, rotuloSituacao, formatarCnpj, dataEmpresa, MOTIVOS_INDISPONIBILIDADE, type ResumoEmpresa, type ReferenciaEmpresa, type AcaoEmpresa } from '@/src/lib/empresa-visual'
import { Card, CardContent, CardHeader, CardFooter } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import styles from './empresa.module.css'
import type { ReactNode } from 'react'
import type { ResumoEmpresaGestor } from '@/src/lib/empresa-visual'

export function CardEmpresa({ empresa: e, aoVer, aoAcionar, responsavel, acoesAdicionais }: { empresa: ResumoEmpresa; aoVer: (referencia: ReferenciaEmpresa) => void; aoAcionar?: (acao: AcaoEmpresa) => void; responsavel?: ResumoEmpresaGestor['responsavel']; acoesAdicionais?: ReactNode }) {
  const acao = aoAcionar ? acaoEmpresa(e) : null
  return <Card className={styles.card}>
    <CardHeader><h3 className={styles.nome}>{e.nome}</h3><Badge variant={e.situacao === 'cliente' ? 'success' : 'outline'}>{rotuloSituacao(e.situacao)}</Badge>{e.motivoIndisponibilidade && <p className={styles.muted}>{MOTIVOS_INDISPONIBILIDADE[e.motivoIndisponibilidade]}</p>}</CardHeader>
    <CardContent><dl className={styles.dados}><div><dt>CNPJ</dt><dd>{formatarCnpj(e.cnpj)}</dd></div><div><dt>CNAE</dt><dd>{e.cnae || 'Não informado'}</dd></div><div><dt>Atividade</dt><dd>{e.atividade || 'Não informado'}</dd></div><div><dt>Localização</dt><dd>{[e.bairro, e.cidade, e.uf].filter(Boolean).join(' / ') || 'Não informado'}</dd></div><div><dt>Origem</dt><dd>{e.origens.map(o => ({ google: 'Google', banco: 'Banco', legado: 'Legado' })[o]).join(', ') || 'Não informado'}</dd></div><div><dt>Recebida em</dt><dd>{dataEmpresa(e.recebidaEm)}</dd></div></dl></CardContent>
    {responsavel !== undefined && <CardContent><dl className={styles.dados}><div><dt>Responsável</dt><dd>{responsavel ? <>{responsavel.nome} <Badge variant={responsavel.ativo ? 'outline' : 'warning'}>{responsavel.ativo ? 'Ativo' : 'Inativo'}</Badge></> : 'Sem responsável'}</dd></div></dl></CardContent>}
    <CardFooter className={styles.acoes}><Button type="button" variant="outline" aria-label={`Ver empresa: ${e.nome}`} onClick={() => aoVer(e.referencia)}>Ver empresa</Button>{acao && <Button type="button" onClick={() => aoAcionar?.(acao)}>{acao.rotulo}</Button>}{acoesAdicionais}</CardFooter>
  </Card>
}
