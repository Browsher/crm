import { randomUUID } from 'node:crypto'
import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { vincularGrupoAtivo } from '../integracao/grupos-fixtures'
export const ATENDIMENTO_A = '00000000-0000-4000-8000-000000009751'
export const ATENDIMENTO_B = '00000000-0000-4000-8000-000000009752'
export const ATENDIMENTO_ALHEIO = '00000000-0000-4000-8000-000000009753'
export const ATENDIMENTO_FONTE = '00000000-0000-4000-8000-000000009754'
export const BUSCA_ATENDIMENTO = '00000000-0000-4000-8000-000000009755'
export const GOOGLE_ATENDIMENTO = '00000000-0000-4000-8000-000000009756'
export const ATENDIMENTO_LATERAL = '00000000-0000-4000-8000-000000009757'
export const ATENDIMENTO_LATERAL_ARQUIVO = '00000000-0000-4000-8000-000000009758'
export const ATENDIMENTO_LATERAL_FUNIL = '00000000-0000-4000-8000-000000009759'
export const ATENDIMENTO_LATERAL_SEM_NAVIGATION = '00000000-0000-4000-8000-000000009760'
export const ATENDIMENTO_LATERAL_BANCO = '00000000-0000-4000-8000-000000009761'
export const ATENDIMENTO_HISTORICO_BANCO = {
  nome: 'Busca histórica de atendimento',
  iniciada: { id: '00000000-0000-4000-8000-000000009762', cnpj: '00000000009762', nome: 'Histórico empresa em atendimento' },
  nova: { id: '00000000-0000-4000-8000-000000009763', cnpj: '00000000009763', nome: 'Histórico empresa a contatar' },
  arquivada: { id: '00000000-0000-4000-8000-000000009764', cnpj: '00000000009764', nome: 'Histórico empresa sem interesse' },
}
export async function prepararAtendimentoDireto(banco: BancoDeTeste): Promise<void> {
  const eu = await criarUsuarioComSenha(banco, 'vendedor', 'diretoe2e', 'Senha-e2e-2026', { pendente: false })
  const outro = await criarUsuarioComSenha(banco, 'vendedor', 'diretooutroe2e', 'Senha-e2e-2026', { pendente: false })
  const empresasDiretas = [
    [ATENDIMENTO_A,'Direto Aurora',eu.id],
    [ATENDIMENTO_B,'Direto Brisa',eu.id],
    [ATENDIMENTO_ALHEIO,'Direto Privada',outro.id],
    [ATENDIMENTO_LATERAL,'Direto Lateral',eu.id],
    [ATENDIMENTO_LATERAL_ARQUIVO,'Direto para arquivo',eu.id],
    [ATENDIMENTO_LATERAL_FUNIL,'Direto para negociação',eu.id],
    [ATENDIMENTO_LATERAL_SEM_NAVIGATION,'Direto sem API de navegação',eu.id],
  ]
  for (const [id,nome,dono] of empresasDiretas) {
    await banco.sql("INSERT INTO empresa(id,razao_social,telefone) VALUES($1,$2,'11988887777')", [id,nome])
    await vincularEmpresaTeste(banco,id,dono,'legado')
    await vincularGrupoAtivo(banco,[id])
  }
  await banco.sql('UPDATE empresa_vinculo SET iniciada_em=now() WHERE empresa_id=ANY($1::uuid[])',
    [[ATENDIMENTO_LATERAL, ATENDIMENTO_LATERAL_ARQUIVO, ATENDIMENTO_LATERAL_FUNIL, ATENDIMENTO_LATERAL_SEM_NAVIGATION]])
  await banco.sql("INSERT INTO empresa(id,cnpj,razao_social,telefone) VALUES($1,'00000000009754','Direto Fontes','11988887776')",[ATENDIMENTO_FONTE])
  await vincularEmpresaTeste(banco,ATENDIMENTO_FONTE,eu.id,'banco')
  await vincularGrupoAtivo(banco,[ATENDIMENTO_FONTE])
  await banco.sql("INSERT INTO empresa(id,razao_social,telefone) VALUES($1,'Início pelo Banco E2E','11988887775')",[ATENDIMENTO_LATERAL_BANCO])
  await vincularEmpresaTeste(banco,ATENDIMENTO_LATERAL_BANCO,eu.id,'banco')
  const empresas = [{cnpj:'00000000009754',razao_social:'Direto Fontes',telefone:'11988887776',bairro:'Centro',cidade:'São Paulo',uf:'SP',telefones:[]},{cnpj:'00000000009755',razao_social:'Snapshot sem vínculo',telefone:null,telefones:[]}]
  await banco.sql("INSERT INTO busca_empresa(id,usuario_id,nome,filtros,quantidade,estado,empresas,inclusao_automatica_concluida) VALUES($1,$2,'Busca fontes','{\"quantidade\":2}',2,'concluida',$3,true)",[BUSCA_ATENDIMENTO,eu.id,JSON.stringify(empresas)])
  const { nome, iniciada, nova, arquivada } = ATENDIMENTO_HISTORICO_BANCO
  const empresasHistorico = [nova, arquivada, iniciada]
  for (const empresa of empresasHistorico) {
    await banco.sql("INSERT INTO empresa(id,cnpj,razao_social,telefone) VALUES($1,$2,$3,'11981239762')", [empresa.id, empresa.cnpj, empresa.nome])
    const versao = await vincularEmpresaTeste(banco, empresa.id, eu.id, 'banco')
    if (empresa !== nova) await banco.sql('UPDATE empresa_vinculo SET iniciada_em=now() WHERE empresa_id=$1', [empresa.id])
    if (empresa === arquivada) await banco.comoUsuario(eu.id, sql => sql('SELECT empresa_sem_interesse_definir($1,$2,$3,NULL)', [empresa.id, randomUUID(), versao]))
  }
  await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas,inclusao_automatica_concluida) VALUES($1,$2,'{\"quantidade\":3}',3,'concluida',$3,true)",
    [eu.id, nome, JSON.stringify(empresasHistorico.map(empresa => ({ cnpj: empresa.cnpj, razao_social: empresa.nome, telefone: '11981239762', telefones: [] })))])
  await banco.sql("INSERT INTO google_planejamento(id,vendedor_id,dia,nicho,bairro,cidade,uf,estado) VALUES($1,$2,'2026-10-29','Fontes','Centro','São Paulo','SP','concluido')",[GOOGLE_ATENDIMENTO,eu.id])
  await banco.sql("INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,$3,'entregue',now())",[GOOGLE_ATENDIMENTO,ATENDIMENTO_FONTE,JSON.stringify(empresas[0])])
}
