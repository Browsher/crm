import { hojeEmSaoPaulo, semanaDe } from '../../src/features/google/regras'
import { criarUsuarioComSenha, type BancoDeTeste } from '../integracao/ajuda'
import { randomUUID } from 'node:crypto'

export const GOOGLE_PEDIDO_DEMO = '00000000-0000-4000-8000-000000009e01'
export const GOOGLE_PEDIDO_OUTRO = '00000000-0000-4000-8000-000000009e02'
export const GOOGLE_TOKEN_E2E = 'google-agente-token-somente-ficticio-e2e-2026'
export const GOOGLE_EMPRESA_DEMO = 'Brinquedos do Bairro (fictícia)'
export const reciboGoogleFixture = (id: string) => ({ pedido_id: id, origem_sha256: 'a'.repeat(64), final_sha256: 'b'.repeat(64),
  arquivo_original_id: 'original-ficticio', arquivo_final_id: 'final-ficticio', validacao_conferida: true })

export async function prepararGoogle(banco: BancoDeTeste) {
  const [{ id: vendedorId }] = await banco.sql<{ id: string }>("SELECT id FROM usuario WHERE email='redesigne2e@teste.local'")
  const [{ id: gestorId }] = await banco.sql<{ id: string }>("SELECT id FROM usuario WHERE email='gestore2e@teste.local'")
  const outro = await criarUsuarioComSenha(banco, 'vendedor', 'googleoutroe2e', 'Senha-e2e-2026')
  await banco.sql("UPDATE usuario SET nome='Outro vendedor da coleta' WHERE id=$1", [outro.id])
  const dias = semanaDe(hojeEmSaoPaulo())!
  for (const [id, usuario] of [[GOOGLE_PEDIDO_DEMO, vendedorId], [GOOGLE_PEDIDO_OUTRO, outro.id]]) {
    await banco.sql(`INSERT INTO google_planejamento(id,vendedor_id,dia,nicho,bairro,cidade,uf,estado,iniciado_em,snapshot)
      VALUES ($1,$2,$3,'Lojas de brinquedos','Brás','São Paulo','SP','coletando',now(),
        '{"nicho":"Lojas de brinquedos","bairro":"Brás","cidade":"São Paulo","uf":"SP"}')`, [id, usuario, dias[0]])
  }
  const empresas = [
    { google_place_id: 'google-demo-brinquedos', nome_fantasia: GOOGLE_EMPRESA_DEMO, telefone: '11999990601', email: 'brinquedos@exemplo.test', endereco: 'Rua Exemplo, 123, Brás, São Paulo/SP', validado: true },
    { google_place_id: 'google-demo-papel', nome_fantasia: 'Mundo de Papel (fictícia)', telefone: '11999990602', endereco: 'Rua Fictícia, 42, São Paulo/SP', validado: true },
    { google_place_id: 'google-demo-pendente', nome_fantasia: 'Telefone pendente (fictícia)', telefone: '', endereco: 'Endereço informado pela coleta fictícia', validado: false },
  ]
  for (const [id, resultados] of [[GOOGLE_PEDIDO_DEMO, empresas], [GOOGLE_PEDIDO_OUTRO, [empresas[0]]]] as const) {
    const executor=randomUUID()
    await banco.sql('INSERT INTO google_execucao(executor_id,gestor_id,pedido_id,contrato) VALUES ($1,$2,$3,1)',[executor,gestorId,id])
    await banco.sql(`SELECT google_agente_entregar($2,$3,$4,$5) FROM (SELECT set_config('app.usuario_id',$1,false) OFFSET 0) identidade`,
      [gestorId, id, JSON.stringify(resultados), JSON.stringify(reciboGoogleFixture(id)), executor])
  }
  await banco.sql(`INSERT INTO contato(empresa_id,tipo,nota) SELECT o.empresa_id,'nao_atendeu','Atendimento fictício após a entrega.'
    FROM empresa_origem_google o CROSS JOIN (SELECT set_config('app.usuario_id',$1,false) OFFSET 0) identidade WHERE o.google_place_id='google-demo-brinquedos'`, [vendedorId])
  return { vendedorId, gestorId, outroId: outro.id }
}
