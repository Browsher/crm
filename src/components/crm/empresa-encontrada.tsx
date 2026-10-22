import type { EmpresaEncontrada } from '@/src/features/busca-empresas/tipos'
import { formatarCnpj, formatarTelefone } from '@/src/features/empresas/formato'

export function EmpresaEncontradaDetalhes({ empresa: e }: { empresa: EmpresaEncontrada }) {
  return <div>
    <h3>{e.nome_fantasia ?? e.razao_social}</h3>
    {e.nome_fantasia && <p>{e.razao_social}</p>}
    <p>{formatarCnpj(e.cnpj)} · {e.cidade ?? 'Cidade não informada'}{e.uf ? '/' + e.uf : ''}</p>
    <dl>
      <dt>Telefone</dt><dd>{e.telefone ? formatarTelefone(e.telefone) : 'Sem telefone válido'}</dd>
      <dt>Email</dt><dd>{e.email ?? 'Não informado'}</dd>
      <dt>CNAE principal</dt><dd>{e.cnae_principal ?? 'Não informado'}</dd>
      <dt>Situação / porte</dt><dd>{[e.situacao, e.porte].filter(Boolean).join(' / ') || 'Não informado'}</dd>
    </dl>
    <details><summary>Ver dados cadastrais</summary><dl>
      <dt>Endereço</dt><dd>{[e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf].filter(Boolean).join(', ') || 'Não informado'}</dd>
      <dt>Data de abertura</dt><dd>{e.data_abertura?.split('-').reverse().join('/') ?? 'Não informada'}</dd>
      <dt>Telefones na origem</dt><dd>{e.telefones.map(formatarTelefone).join(', ') || 'Não informados'}</dd>
    </dl></details>
  </div>
}
