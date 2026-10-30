import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'
export const ATENDIMENTO_A = '00000000-0000-4000-8000-000000009751'
export const ATENDIMENTO_B = '00000000-0000-4000-8000-000000009752'
export const ATENDIMENTO_ALHEIO = '00000000-0000-4000-8000-000000009753'
export const ATENDIMENTO_FONTE = '00000000-0000-4000-8000-000000009754'
export const BUSCA_ATENDIMENTO = '00000000-0000-4000-8000-000000009755'
export const GOOGLE_ATENDIMENTO = '00000000-0000-4000-8000-000000009756'
export async function prepararAtendimentoDireto(banco: BancoDeTeste): Promise<void> {
  const eu = await criarUsuarioComSenha(banco, 'vendedor', 'diretoe2e', 'Senha-e2e-2026', { pendente: false })
  const outro = await criarUsuarioComSenha(banco, 'vendedor', 'diretooutroe2e', 'Senha-e2e-2026', { pendente: false })
  for (const [id,nome,dono] of [[ATENDIMENTO_A,'Direto Aurora',eu.id],[ATENDIMENTO_B,'Direto Brisa',eu.id],[ATENDIMENTO_ALHEIO,'Direto Privada',outro.id]]) {
    await banco.sql("INSERT INTO empresa(id,razao_social,telefone) VALUES($1,$2,'11988887777')", [id,nome])
    await vincularEmpresaTeste(banco,id,dono,'legado')
    await vincularGrupoAtivo(banco,[id])
  }
  await banco.sql("INSERT INTO empresa(id,cnpj,razao_social,telefone) VALUES($1,'00000000009754','Direto Fontes','11988887776')",[ATENDIMENTO_FONTE])
  await vincularEmpresaTeste(banco,ATENDIMENTO_FONTE,eu.id,'banco')
  await vincularGrupoAtivo(banco,[ATENDIMENTO_FONTE])
  const empresas = [{cnpj:'00000000009754',razao_social:'Direto Fontes',telefone:'11988887776',bairro:'Centro',cidade:'São Paulo',uf:'SP',telefones:[]},{cnpj:'00000000009755',razao_social:'Snapshot sem vínculo',telefone:null,telefones:[]}]
  await banco.sql("INSERT INTO busca_empresa(id,usuario_id,nome,filtros,quantidade,estado,empresas,inclusao_automatica_concluida) VALUES($1,$2,'Busca fontes','{\"quantidade\":2}',2,'concluida',$3,true)",[BUSCA_ATENDIMENTO,eu.id,JSON.stringify(empresas)])
  await banco.sql("INSERT INTO google_planejamento(id,vendedor_id,dia,nicho,bairro,cidade,uf,estado) VALUES($1,$2,'2026-10-29','Fontes','Centro','São Paulo','SP','concluido')",[GOOGLE_ATENDIMENTO,eu.id])
  await banco.sql("INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,$3,'entregue',now())",[GOOGLE_ATENDIMENTO,ATENDIMENTO_FONTE,JSON.stringify(empresas[0])])
}
