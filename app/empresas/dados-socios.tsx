import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'

type Socio = {
  nome?: string | null
  funcao?: string | null
  documento?: string | null
  entrada?: string | null
  pais?: string | null
  faixaEtaria?: string | null
  representante?: string | null
  documentoRepresentante?: string | null
}

export type LinhaSocios = { cnpj: string; dados: (string | Socio)[] }

export function DadosSocios({ linhas }: { linhas: LinhaSocios[] }) {
  if (!linhas.length) return null
  return <Card><CardHeader><CardTitle><h2>Dados dos sócios e representantes</h2></CardTitle><p className="text-sm text-muted-foreground">Acesso exclusivo do gestor. Vendedores recebem somente nome e função.</p></CardHeader><CardContent className="grid gap-5">
    {linhas.map((l, indice) => <section key={l.cnpj + '-' + indice}><h3 className="font-semibold">CNPJ {l.cnpj}</h3><ul className="mt-3 grid gap-4">{l.dados.map((s, i) => <li key={i}>{typeof s === 'string' ? s : <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[180px_1fr] [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere]">
      <dt>Nome</dt><dd>{s.nome || 'Não informado'}</dd><dt>Função</dt><dd>{s.funcao || 'Não informada'}</dd>
      {s.documento && <><dt>Documento</dt><dd>{s.documento}</dd></>}{s.entrada && <><dt>Entrada na sociedade</dt><dd>{s.entrada}</dd></>}{s.pais && <><dt>País</dt><dd>{s.pais}</dd></>}{s.faixaEtaria && <><dt>Faixa etária</dt><dd>{s.faixaEtaria}</dd></>}
      {s.representante && <><dt>Representante legal</dt><dd>{s.representante}</dd></>}{s.documentoRepresentante && <><dt>Documento do representante</dt><dd>{s.documentoRepresentante}</dd></>}
    </dl>}</li>)}</ul></section>)}
  </CardContent></Card>
}
