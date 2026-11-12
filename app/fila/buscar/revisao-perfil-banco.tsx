'use client'

import { useId } from 'react'
import { Choice } from '@/src/components/ui/choice'
import { Input } from '@/src/components/ui/input'
import type { PerfilEmpresaSugerido, SelecaoPerfilBanco } from '@/src/lib/assistente-ia-banco'
import { CONTATOS_BANCO } from '@/src/lib/banco-empresas'
import styles from './revisao-perfil-banco.module.css'

const ROTULOS_MEI = { qualquer: 'Qualquer', somente: 'Somente MEI', excluir: 'Excluir MEI' }
const ROTULOS_REGIME = { qualquer: 'Qualquer', simples: 'Optante pelo Simples Nacional', fora_simples: 'Fora do Simples Nacional' }

type Hipotese = { campo: keyof PerfilEmpresaSugerido; rotulo: string; valor: string; motivo: string }

export function RevisaoPerfilBanco({ perfil, selecao, alterar }: {
  perfil?: PerfilEmpresaSugerido
  selecao: SelecaoPerfilBanco
  alterar: (proxima: SelecaoPerfilBanco) => void
}) {
  const id = useId()
  const hipoteses: (Hipotese | undefined)[] = [
    perfil?.portes && { campo: 'portes', rotulo: 'Porte sugerido', valor: perfil.portes.valor.join(', '), motivo: perfil.portes.motivo },
    perfil?.mei && { campo: 'mei', rotulo: 'MEI sugerido', valor: ROTULOS_MEI[perfil.mei.valor], motivo: perfil.mei.motivo },
    perfil?.regime && { campo: 'regime', rotulo: 'Regime tributário sugerido', valor: ROTULOS_REGIME[perfil.regime.valor], motivo: perfil.regime.motivo },
    perfil?.estabelecimento && { campo: 'estabelecimento', rotulo: 'Estabelecimento sugerido', valor: perfil.estabelecimento.valor === 'matriz' ? 'Matriz' : 'Filial', motivo: perfil.estabelecimento.motivo },
    perfil?.aberturaUltimosDias && { campo: 'aberturaUltimosDias', rotulo: 'Data de abertura sugerida', valor: `Últimos ${perfil.aberturaUltimosDias.valor} dias`, motivo: perfil.aberturaUltimosDias.motivo },
    perfil?.contato && { campo: 'contato', rotulo: 'Contato disponível sugerido', valor: CONTATOS_BANCO.find(([valor]) => valor === perfil.contato?.valor)?.[1] ?? perfil.contato.valor, motivo: perfil.contato.motivo },
  ]

  return <form className={styles.formulario} onSubmit={evento => {
    evento.preventDefault()
    // O portal separa os formulários no DOM, mas o evento React chega ao formulário do Banco.
    evento.stopPropagation()
  }}>
    <fieldset className={styles.perfil}>
      <legend>Perfil da empresa</legend>
      {hipoteses.map(hipotese => hipotese && <div key={hipotese.campo} className={styles.hipotese}>
        <label>
          <Choice type="checkbox" checked={selecao.campos.includes(hipotese.campo)} aria-describedby={`${id}-${hipotese.campo}`}
            onChange={evento => alterar({ ...selecao, campos: evento.target.checked
              ? [...selecao.campos, hipotese.campo]
              : selecao.campos.filter(campo => campo !== hipotese.campo) })} />
          <span>{hipotese.rotulo}: <strong>{hipotese.valor}</strong></span>
        </label>
        <p id={`${id}-${hipotese.campo}`} className={styles.ajuda}>{hipotese.motivo}</p>
      </div>)}
      <div className={styles.capital}>
        <label>Capital mínimo (R$, sem centavos)
          <Input inputMode="numeric" autoComplete="off" value={selecao.capitalMinimo ?? ''} aria-describedby={`${id}-capital`}
            onChange={evento => alterar({ ...selecao, capitalMinimo: evento.target.value })} />
        </label>
        <label>Capital máximo (R$, sem centavos)
          <Input inputMode="numeric" autoComplete="off" value={selecao.capitalMaximo ?? ''} aria-describedby={`${id}-capital`}
            onChange={evento => alterar({ ...selecao, capitalMaximo: evento.target.value })} />
        </label>
        <p id={`${id}-capital`} className={styles.ajuda}>Deixe o campo em branco para manter o valor do formulário.</p>
      </div>
    </fieldset>
  </form>
}
