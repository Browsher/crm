'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { UFS } from '@/src/features/busca-empresas/filtros'
import { buscarEmpresasAcao, type EstadoBusca } from './acoes'
import styles from '@/src/components/crm/busca-empresas.module.css'

const inicial: EstadoBusca = { erro: null }
type Props = { bloqueado: boolean; restante: number; chaveInicial: string; buscaConcluidaId?: string }
export function FormularioBusca(props: Props) {
  return <OperacaoBusca key={props.buscaConcluidaId ?? 'nova'} {...props} />
}
function OperacaoBusca({ bloqueado, restante, chaveInicial }: Props) {
  const [estado, acao, pendente] = useActionState(buscarEmpresasAcao, inicial)
  const [chave] = useState(chaveInicial)
  const [valores, setValores] = useState({ nome: '', palavra: '', cnae: '', uf: '', cidade: '', bairro: '',
    porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: String(Math.max(1, Math.min(10, restante))), offset: '0' })
  function mudar(campo: keyof typeof valores, valor: string) { setValores(v => ({ ...v, [campo]: valor })) }
  return <form action={acao} className={styles.formulario}>
    <input type="hidden" name="chave" value={chave} />
    {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
    <fieldset disabled={bloqueado || pendente}>
      <label className={styles.campo}>Nome da lista<Input name="nome" required maxLength={100} value={valores.nome} onChange={e => mudar('nome', e.target.value)} /></label>
      <div className={styles.grade}>
        <label className={styles.campo}>Palavra no nome<Input name="palavra" maxLength={100} value={valores.palavra} onChange={e => mudar('palavra', e.target.value)} placeholder="Ex.: iluminação" /></label>
        <label className={styles.campo}>CNAE principal<Input name="cnae" maxLength={20} value={valores.cnae} onChange={e => mudar('cnae', e.target.value)} placeholder="Ex.: 4742-3/00" /></label>
      </div>
      <p className={styles.ajuda}>Informe uma palavra no nome, um CNAE ou os dois. Os filtros se combinam. A busca traz empresas ativas.</p>
      <div className={styles.grade}>
        <label className={styles.campo}>UF<NativeSelect name="uf" required value={valores.uf} onChange={e => mudar('uf', e.target.value)}><option value="">Selecione</option>{UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}</NativeSelect></label>
        <label className={styles.campo}>Cidade<Input name="cidade" maxLength={100} value={valores.cidade} onChange={e => mudar('cidade', e.target.value)} /><small>Nome completo da cidade. Opcional.</small></label>
        <label className={styles.campo}>Bairro<Input name="bairro" maxLength={100} value={valores.bairro} onChange={e => mudar('bairro', e.target.value)} /><small>Preencha também a cidade.</small></label>
        <label className={styles.campo}>Porte<NativeSelect name="porte" value={valores.porte} onChange={e => mudar('porte', e.target.value)}><option value="">Todos os portes</option><option value="MEI">MEI</option><option value="ME">Microempresa</option><option value="EPP">Empresa de pequeno porte</option><option value="DEMAIS">Demais</option></NativeSelect></label>
        <label className={styles.campo}>Estabelecimento<NativeSelect name="tipo" value={valores.tipo} onChange={e => mudar('tipo', e.target.value)}><option value="">Matriz e filial</option><option value="2">Matriz</option><option value="1">Filial</option></NativeSelect></label>
        <label className={styles.campo}>Contato disponível<NativeSelect name="contato" value={valores.contato} onChange={e => mudar('contato', e.target.value)}><option value="telefoneoucelular">Telefone ou celular</option><option value="telefoneoucelulareemail">Telefone ou celular e email</option><option value="email">Email</option><option value="telefoneoucelularouemail">Telefone, celular ou email</option></NativeSelect></label>
        <label className={styles.campo}>Quantidade de empresas<Input name="quantidade" type="number" min={1} max={Math.max(1, Math.min(100, restante))} required value={valores.quantidade} onChange={e => mudar('quantidade', e.target.value)} /><small>Até 100 por consulta, dentro do seu limite diário.</small></label>
        <label className={styles.campo}>Pular resultados<Input name="offset" type="number" min={0} max={1000000} required value={valores.offset} onChange={e => mudar('offset', e.target.value)} /><small>Use 0 na primeira busca. Para continuar, informe quantas empresas já consultou.</small></label>
      </div>
      <div className={styles.acoes}><Button type="submit" disabled={!chave}>{pendente ? 'Buscando empresas…' : 'Buscar no CNPJ.biz'}</Button></div>
    </fieldset>
    <p className={styles.ajuda}>Esta consulta usa a API e pode consumir créditos do CNPJ.biz. O resultado fica salvo no histórico.</p>
    {pendente && <p role="status">Aguarde a conclusão. A consulta não será repetida automaticamente.</p>}
  </form>
}
