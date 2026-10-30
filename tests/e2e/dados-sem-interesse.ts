import { randomUUID } from 'node:crypto'
import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'

export const EMPRESAS_SEM_INTERESSE=[1,2,3,4].map(n=>'00000000-0000-4000-8000-'+String(9800+n).padStart(12,'0'))
export const NUNCA_NEGOCIADA='00000000-0000-4000-8000-000000009811'
export async function prepararSemInteresse(banco:BancoDeTeste):Promise<void>{
  const eu=await criarUsuarioComSenha(banco,'vendedor','seminteressee2e','Senha-e2e-2026',{pendente:false})
  for(let n=1;n<=27;n++){
    const id='00000000-0000-4000-8000-'+String(9800+n).padStart(12,'0')
    const nome=n===27?'Descarte toque':n===26?'Descarte visual':n<=4?'Descarte '+n:'Arquivo '+String(n-4).padStart(2,'0')
    await banco.sql("INSERT INTO empresa(id,cnpj,razao_social,telefone) VALUES($1,$2,$3,'11977778888')",[id,String(9800+n).padStart(14,'0'),nome])
    const versao=await vincularEmpresaTeste(banco,id,eu.id,'legado')
    await vincularGrupoAtivo(banco,[id])
    if(n<=4||n>=26){
      const r=await banco.comoUsuario(eu.id,e=>e<{r:{ok:boolean}}>("SELECT contato_registrar_direto($1,$2,$3,'interessado','Interesse real','Retornar',to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD')) AS r",[id,randomUUID(),versao]))
      if(!r.linhas[0].r.ok)throw new Error('Cenário Sem interesse não abriu negociação')
      await banco.sql('UPDATE negociacao SET etapa=$2 WHERE empresa_id=$1',[id,['primeiro_contato','em_negociacao','proposta_enviada','proposta_enviada'][n-1]??'primeiro_contato'])
    }else{
      const r=await banco.comoUsuario(eu.id,e=>e<{r:{ok:boolean}}>('SELECT empresa_sem_interesse_definir($1,$2,$3,NULL) AS r',[id,randomUUID(),versao]))
      if(!r.linhas[0].r.ok)throw new Error('Cenário Sem interesse não arquivou empresa')
    }
  }
}
