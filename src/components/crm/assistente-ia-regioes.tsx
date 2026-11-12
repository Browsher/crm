import { MapPin, Plus } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import type { RegiaoAssistente } from '@/src/lib/assistente-ia'
import { ESTADOS_BR } from '@/src/lib/banco-empresas'
import styles from './assistente-ia-busca.module.css'

export type LinhaRegiaoAssistente = Omit<RegiaoAssistente, 'bairros'> & { id: number; bairros: string }
type CampoRegiao = 'estado' | 'cidade' | 'bairros'

export const linhaRegiaoVazia = (id: number): LinhaRegiaoAssistente => ({ id, estado: '', cidade: '', bairros: '' })

export function regioesPreenchidas(linhas: LinhaRegiaoAssistente[], limite: 1 | 20): RegiaoAssistente[] {
  return linhas.map(({ estado, cidade, bairros }) => ({
    estado,
    cidade,
    bairros: (limite === 1 ? [bairros] : bairros.split(',')).map(bairro => bairro.trim()).filter(Boolean),
  })).filter(regiao => regiao.estado || regiao.cidade.trim() || regiao.bairros.length)
}

type Props = {
  linhas: LinhaRegiaoAssistente[]
  limite: 1 | 20
  aoEditar: (id: number, campo: CampoRegiao, valor: string) => void
  aoRemover: (id: number) => void
  aoAdicionar: () => void
}

export function RegioesAssistente({ linhas, limite, aoEditar, aoRemover, aoAdicionar }: Props) {
  const multiplas = limite > 1
  return <fieldset className={styles.campoRegioes}>
    <legend>Região</legend>
    {multiplas && <p className={styles.ajuda}>Sem cidade, a busca cobre o estado inteiro.</p>}
    {linhas.map(({ id, estado, cidade, bairros }, indice) => {
      const ordem = linhas.length > 1 ? ' ' + (indice + 1) : ''
      return <div key={id} className={styles.linhaRegiao} role="group" aria-label={'Região' + ordem}>
        <div className={styles.camposRegiao}>
          <label>UF<NativeSelect name="estado" value={estado} onChange={evento => aoEditar(id, 'estado', evento.target.value)}>
            <option value="">Selecione…</option>
            {ESTADOS_BR.map(uf => <option key={uf}>{uf}</option>)}
          </NativeSelect></label>
          <label>Cidade<Input name="cidade" value={cidade} maxLength={100} autoComplete="off"
            onChange={evento => aoEditar(id, 'cidade', evento.target.value)} /></label>
          <label>{multiplas ? 'Bairros (opcional)' : 'Bairro (opcional)'}
            <Input name="bairros" value={bairros} maxLength={multiplas ? 1500 : 100} autoComplete="off"
              placeholder={multiplas ? 'Separe por vírgula' : undefined}
              onChange={evento => aoEditar(id, 'bairros', evento.target.value)} />
          </label>
        </div>
        {(estado || cidade || bairros || linhas.length > 1) && <Button type="button" variant="ghost" size="sm" onClick={() => aoRemover(id)}>
          {multiplas ? 'Remover região' + ordem : 'Limpar região'}
        </Button>}
      </div>
    })}
    {multiplas && linhas.length < limite && <Button type="button" size="sm" variant="outline" onClick={aoAdicionar}>
      <Plus aria-hidden="true" />Adicionar região
    </Button>}
  </fieldset>
}

function descreverRegiao({ cidade, estado, bairros }: RegiaoAssistente) {
  const local = cidade && estado ? cidade + '/' + estado : cidade || estado
  return [local, bairros.join(', ')].filter(Boolean).join(' · ')
}

export function PreviaRegioesAssistente({ regioes }: { regioes: RegiaoAssistente[] }) {
  return <section className={styles.previaRegioes} aria-label="Regiões ao aplicar">
    <div><MapPin aria-hidden="true" size={16} /><strong>Regiões ao aplicar</strong></div>
    {regioes.length ? <ul>{regioes.map((regiao, indice) => <li key={indice}>{descreverRegiao(regiao)}</li>)}</ul>
      : <p className={styles.ajuda}>Nenhuma região definida.</p>}
  </section>
}
