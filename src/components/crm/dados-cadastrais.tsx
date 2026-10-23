import type { DadosCadastrais as Dados } from '@/src/server/cnpj-biz/dados'
import { DetalhesBancoEmpresa } from './detalhes-banco'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'

export function DadosCadastrais({ dados }: { dados: Dados | null }) {
  if (!dados) return null
  const endereco = [dados.logradouro, dados.numero, dados.complemento, dados.bairro, dados.cidade, dados.uf].filter(Boolean).join(', ')
  return <Card className="min-w-0 break-words"><CardHeader><CardTitle><h2>Dados cadastrais do CNPJ.biz</h2></CardTitle></CardHeader><CardContent>
    <p className="text-sm text-muted-foreground">Consultado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(dados.coletado_em))}.</p>
    <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-muted-foreground sm:grid-cols-[160px_1fr]">
      <dt>Situação cadastral</dt><dd>{dados.situacao ?? 'Não informada'}</dd>
      <dt>Porte</dt><dd>{dados.porte ?? 'Não informado'}</dd>
      <DetalhesBancoEmpresa dados={dados.detalhes}/>
      <dt>Data de abertura</dt><dd>{dados.data_abertura?.split('-').reverse().join('/') ?? 'Não informada'}</dd>
      <dt>Endereço cadastral</dt><dd>{endereco || 'Não informado'}</dd>
      {dados.telefones.length > 0 && <><dt>Telefones na origem</dt><dd>{dados.telefones.join(', ')}</dd></>}
    </dl>
  </CardContent></Card>
}
