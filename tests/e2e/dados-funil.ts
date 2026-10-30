import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'
import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { randomUUID } from 'node:crypto'
export const FUNIL_EMPRESA='00000000-0000-4000-8000-000000000801'
export async function prepararFunil(banco:BancoDeTeste) {
  const retornoUsuario=await criarUsuarioComSenha(banco,'vendedor','retornoe2e','Senha-e2e-2026',{pendente:false})
  const [retorno]=await banco.sql<{id:string}>("INSERT INTO empresa(cnpj,razao_social,telefone,cnae_principal) VALUES('00000000000901','Retorno Combinado','11977779001','7777799') RETURNING id")
  await vincularEmpresaTeste(banco,retorno.id,retornoUsuario.id,'legado')
  const eu=await criarUsuarioComSenha(banco,'vendedor','funile2e','Senha-e2e-2026',{pendente:false})
  const outro=await criarUsuarioComSenha(banco,'vendedor','funiloutroe2e','Senha-e2e-2026',{pendente:false})
  for(let i=1;i<=9;i++){
    const id=`00000000-0000-4000-8000-${String(800+i).padStart(12,'0')}`,dono=i===9?outro.id:eu.id
    await banco.sql("INSERT INTO empresa(id,cnpj,razao_social,telefone) VALUES($1,$2,$3,'11977778888')",[id,String(800+i).padStart(14,'0'),i===1?'Funil Aurora':i===9?'Funil Privado':`Negociação ${i}`])
    const versao=await vincularEmpresaTeste(banco,id,dono,'legado')
    await vincularGrupoAtivo(banco,[id])
    const r=await banco.comoUsuario(dono,e=>e<{r:{ok:boolean}}>("SELECT contato_registrar_direto($1,$2,$3,'interessado',$4,$5,$6) AS r",[id,randomUUID(),versao,i===1?'Nota própria Aurora':null,i===1?'Retornar hoje':null,i===1?new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}):null]))
    if(!r.linhas[0].r.ok)throw new Error('Cenário Funil não abriu negociação')
    await banco.sql('UPDATE negociacao SET etapa=$2 WHERE empresa_id=$1',[id,['primeiro_contato','em_negociacao','proposta_enviada'][(i-1)%3]])
  }
  await banco.sql('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
  try{await banco.sql("INSERT INTO contato(empresa_id,tipo,nota,criado_por,criado_em) VALUES($1,'acompanhamento','SEGREDO DO COLEGA',$2,now()-interval '1 day')",[FUNIL_EMPRESA,outro.id])}
  finally{await banco.sql('ALTER TABLE contato ENABLE TRIGGER contato_auditoria')}
}
