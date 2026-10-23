import type { DetalhesBanco } from '@/src/lib/banco-empresas'
export function DetalhesBancoEmpresa({dados}:{dados?:DetalhesBanco}) {
  if(!dados)return null
  return <>
    {dados.capital_social&&<><dt>Capital social</dt><dd>{dados.capital_social}</dd></>}
    {dados.natureza_juridica&&<><dt>Natureza jurídica</dt><dd>{dados.natureza_juridica}</dd></>}
    {!!dados.regime_tributario?.length&&<><dt>Regime tributário</dt><dd>{dados.regime_tributario.join(', ')}</dd></>}
    {!!dados.atividades_secundarias?.length&&<><dt>Atividades secundárias</dt><dd>{dados.atividades_secundarias.join('; ')}</dd></>}
    {!!dados.socios?.length&&<><dt>Sócios e administradores</dt><dd><ul>{dados.socios.map((s,i)=><li key={i}>{typeof s==='string'?s:<><strong>{s.nome||'Nome não informado'}</strong>{s.funcao?.descricao&&<p>{s.funcao.descricao}</p>}</>}</li>)}</ul></dd></>}
  </>
}
