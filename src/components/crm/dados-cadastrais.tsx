import type { DadosCadastrais as Dados } from '@/src/server/cnpj-biz/dados'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'

export function DadosCadastrais({ dados }: { dados: Dados | null }) {
  if (!dados) return null
  const endereco = [dados.logradouro, dados.numero, dados.complemento, dados.bairro, dados.cidade, dados.uf].filter(Boolean).join(', ')
  return <Card><CardHeader><CardTitle>Dados cadastrais do CNPJ.biz</CardTitle></CardHeader><CardContent>
    <p>Consultado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(dados.coletado_em))}.</p>
    <dl className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-[160px_1fr]">
      <dt>Situação cadastral</dt><dd>{dados.situacao ?? 'Não informada'}</dd>
      <dt>Porte</dt><dd>{dados.porte ?? 'Não informado'}</dd>
      <dt>Data de abertura</dt><dd>{dados.data_abertura?.split('-').reverse().join('/') ?? 'Não informada'}</dd>
      <dt>Endereço cadastral</dt><dd>{endereco || 'Não informado'}</dd>
      <dt>Telefones na origem</dt><dd>{dados.telefones.join(', ') || 'Não informados'}</dd>
    </dl>
  </CardContent></Card>
}
