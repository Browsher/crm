'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { importarAcao, type EstadoImportar } from './acao'
import { EtapasImportacao, type EtapaImportacao } from './etapas-importacao'
import { RelatorioImportacao } from './relatorio'
import styles from './importar.module.css'

const inicial: EstadoImportar = { erro: null, relatorio: null, inseridas: null }

export function FormularioImportar() {
  const [etapa, setEtapa] = useState<EtapaImportacao>('enviar')
  const [limpo, setLimpo] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const erroRef = useRef<HTMLParagraphElement>(null)
  const focarAoVoltarRef = useRef(false)
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoImportar, form: FormData) => {
    const resultado = await importarAcao(anterior, form)
    setLimpo(false)
    setEtapa(resultado.inseridas !== null ? 'concluir' : resultado.relatorio ? 'conferir' : 'enviar')
    return resultado
  }, inicial)
  const erro = limpo ? null : estado.erro

  useEffect(() => {
    if (limpo) {
      if (focarAoVoltarRef.current) tituloRef.current?.focus()
      focarAoVoltarRef.current = false
      return
    }
    if (erro) erroRef.current?.focus()
    else tituloRef.current?.focus()
  }, [estado, etapa, erro, limpo])

  function voltar(focar = false) {
    focarAoVoltarRef.current = focar
    setLimpo(true)
    setEtapa('enviar')
  }
  function reiniciar() {
    if (inputRef.current) inputRef.current.value = ''
    voltar(true)
  }

  return <form action={acao} className={styles.formulario} onReset={e => e.preventDefault()}>
    {/* React pode resetar campos não controlados após uma action bem-sucedida.
        Conferir também é sucesso: impedir esse reset mantém o File para confirmar.
        O input nunca desmonta ao voltar. Apenas reiniciar limpa explicitamente. */}
    <EtapasImportacao etapa={etapa} voltar={() => voltar(true)} bloqueado={pendente} />
    <div className={styles.painel}>
      <h2 ref={tituloRef} tabIndex={-1} className={styles.titulo}>
        {etapa === 'enviar' ? 'Enviar arquivo' : etapa === 'conferir' ? 'Confira antes de importar' : 'Importação concluída'}
      </h2>
      {erro && <p ref={erroRef} tabIndex={-1} role="alert" className={styles.erro}>{erro}</p>}
      <fieldset disabled={pendente}>
        <div hidden={etapa !== 'enviar'}>
          <p>Preencha o modelo e salve como CSV UTF-8 antes de enviar.</p>
          <label className={styles.arquivo}>
            Arquivo CSV
            <input ref={inputRef} name="arquivo" type="file" accept=".csv,text/csv" required={etapa !== 'concluir'} onChange={() => voltar()} />
          </label>
          <details className={styles.orientacoes}>
            <summary>Modelo e orientações de preenchimento</summary>
            <ol>
              <li><a href="/modelo-empresas.xlsx" download>Baixe o modelo Excel</a> e preencha uma empresa por linha.</li>
              <li>Mantenha as colunas como Texto para preservar zeros à esquerda.</li>
              <li>No Excel, use Salvar como &gt; CSV UTF-8 (delimitado por vírgulas). A opção CSV comum pode estragar os acentos.</li>
            </ol>
            <p>O CNAE principal é opcional: preencha a oitava coluna cnae_principal com sete dígitos (4742300) ou no formato 4742-3/00. Se não souber, deixe em branco. O modelo antigo de sete colunas continua válido.</p>
          </details>
          <div className={styles.acoes}><Button type="submit">{pendente ? 'Conferindo…' : 'Conferir arquivo'}</Button></div>
        </div>
        {etapa === 'conferir' && estado.relatorio && <>
          <RelatorioImportacao relatorio={estado.relatorio} />
          <div className={styles.acoes}>
            {estado.relatorio.novas > 0 && <Button type="submit" name="confirmar" value="1">{pendente ? 'Importando…' : `Importar ${estado.relatorio.novas} ${estado.relatorio.novas === 1 ? 'empresa' : 'empresas'}`}</Button>}
            <Button type="button" variant="outline" onClick={() => voltar(true)}>Voltar ao arquivo</Button>
          </div>
        </>}
        {etapa === 'concluir' && <>
          <p>{estado.inseridas} {estado.inseridas === 1 ? 'empresa importada' : 'empresas importadas'}.</p>
          <p>As empresas já podem ser consultadas na base.</p>
          <div className={styles.acoes}>
            <Button asChild><Link href="/empresas">Ver empresas</Link></Button>
            <Button type="button" variant="outline" onClick={reiniciar}>Importar outro arquivo</Button>
          </div>
        </>}
      </fieldset>
      {pendente && <p role="status" className={styles.pendente}>Aguarde a conclusão antes de sair desta página.</p>}
    </div>
  </form>
}
