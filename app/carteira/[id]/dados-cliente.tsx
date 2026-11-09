import type { ReactNode } from 'react'
import { DetalhesBancoEmpresa } from '@/src/components/crm/detalhes-banco'
import type { GrupoEmpresa } from '@/src/components/crm/empresa-detalhes'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'
import { dataEmpresa } from '@/src/lib/empresa-visual'
import type { DadosCadastrais } from '@/src/server/cnpj-biz/dados'
import styles from './ficha.module.css'

export const GRUPOS_CLIENTE = {
  contato: 'Contato e localização',
  cadastro: 'Cadastro e origem',
  atividades: 'Atividades e sócios',
} satisfies Record<GrupoEmpresa, string>

const ORIGENS = { google: 'Google', banco: 'Banco de empresas', legado: 'Legado' }

export function enderecoCliente(empresa: EmpresaComigo) {
  const endereco = empresa.endereco
  if (endereco) return [endereco.logradouro, endereco.bairro, `${endereco.localidade}/${endereco.uf}`].filter(Boolean).join(', ')
  if (empresa.cep) return `CEP ${empresa.cep}. Endereço não encontrado na base de CEP.`
  return 'Localização não cadastrada'
}

function Campo({ nome, children }: { nome: string; children?: ReactNode }) {
  return <><dt>{nome}</dt><dd>{children || 'Não informado'}</dd></>
}

export function DadosCliente({ grupo, empresa, cadastrais }: {
  grupo: GrupoEmpresa
  empresa: EmpresaComigo
  cadastrais?: DadosCadastrais | null
}) {
  const detalhes = cadastrais?.detalhes
  if (grupo === 'contato') {
    const endereco = cadastrais && [cadastrais.logradouro, cadastrais.numero, cadastrais.complemento, cadastrais.bairro, cadastrais.cidade, cadastrais.uf].filter(Boolean).join(', ')
    return <dl className={styles.dados}>
      <Campo nome="Contato principal">{empresa.contatoNome}</Campo>
      <Campo nome="Telefone">{empresa.telefone}</Campo>
      <Campo nome="E-mail">{empresa.email}</Campo>
      <Campo nome="Localização">{enderecoCliente(empresa)}</Campo>
      {cadastrais && <Campo nome="Endereço cadastral">{endereco}</Campo>}
      {!!cadastrais?.telefones.length && <Campo nome="Telefones na origem">{cadastrais.telefones.join(', ')}</Campo>}
    </dl>
  }
  if (grupo === 'cadastro') return <>
    {cadastrais && <div>
      <h4>Dados cadastrais {cadastrais.fonte === 'Casa dos Dados' ? 'da Casa dos Dados' : 'do CNPJ.biz'}</h4>
      <p className="text-sm text-muted-foreground">Consultado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(cadastrais.coletado_em))}.</p>
    </div>}
    <dl className={styles.dados}>
      <Campo nome="Razão social">{empresa.razaoSocial}</Campo>
      <Campo nome="Nome fantasia">{empresa.nomeFantasia}</Campo>
      <Campo nome="CNPJ">{empresa.cnpj}</Campo>
      <Campo nome="Situação cadastral">{cadastrais?.situacao}</Campo>
      <Campo nome="Porte">{cadastrais?.porte}</Campo>
      <Campo nome="Data de abertura">{dataEmpresa(cadastrais?.data_abertura ?? null)}</Campo>
      {empresa.empresa && <>
        <Campo nome="Origem">{empresa.empresa.origens.map(origem => ORIGENS[origem]).join(', ')}</Campo>
        <Campo nome="Recebida em">{dataEmpresa(empresa.empresa.recebidaEm)}</Campo>
      </>}
      {detalhes && <DetalhesBancoEmpresa dados={{ capital_social: detalhes.capital_social, natureza_juridica: detalhes.natureza_juridica }} />}
    </dl>
  </>
  return <dl className={styles.dados}>
    <Campo nome="CNAE principal">{empresa.cnaePrincipal}</Campo>
    {empresa.empresa?.atividade && <Campo nome="Atividade">{empresa.empresa.atividade}</Campo>}
    {detalhes && <DetalhesBancoEmpresa dados={{ regime_tributario: detalhes.regime_tributario, atividades_secundarias: detalhes.atividades_secundarias, socios: detalhes.socios }} />}
  </dl>
}
