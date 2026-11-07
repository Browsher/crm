import { vendaCarteiraAcao } from '../carteira/venda-acao'
// @vitest-environment jsdom
import { act, useEffect, useState, type RefObject } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Quadro } from './quadro'
import { devolverFunilAcao, etapaAcao, semInteresseAcao, vendaAcao } from './acoes'
import { ETAPAS_FUNIL } from '@/src/lib/comercial'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
import type { ArquivoFunilRecente } from '@/src/lib/funil-arquivo'
const guardaPainel=vi.hoisted(()=>vi.fn<(depois?:()=>void)=>void>())
const replace=vi.hoisted(()=>vi.fn())
const refresh=vi.hoisted(()=>vi.fn())
vi.mock('next/navigation',()=>({useRouter:()=>({refresh,replace})}))
vi.mock('../carteira/venda-acao',()=>({vendaCarteiraAcao:vi.fn()}))
vi.mock('./acoes',()=>({etapaAcao:vi.fn(),semInteresseAcao:vi.fn(),vendaAcao:vi.fn(),devolverFunilAcao:vi.fn()}))
vi.mock('./modal', () => {
  function Painel({ fechar, fecharRef, aoPedirArquivar, aoMudarBloqueioDeArraste }: {
    fechar: (aviso?: string) => void
    fecharRef?: RefObject<((depois?: () => void) => void) | null>
    aoPedirArquivar?: (detalhe: NegociacaoResumo) => void
    aoMudarBloqueioDeArraste?: (bloqueado: boolean) => void
  }) {
    const [editando, setEditando] = useState(false)
    useEffect(() => {
      aoMudarBloqueioDeArraste?.(editando)
      return () => aoMudarBloqueioDeArraste?.(false)
    }, [aoMudarBloqueioDeArraste, editando])
    useEffect(() => {
      if (fecharRef) fecharRef.current = depois => guardaPainel(depois)
      return () => { if (fecharRef) fecharRef.current = null }
    }, [fecharRef])
    return <aside aria-label="Negociação operacional">
      <p>Negociação operacional</p>
      <button onClick={() => setEditando(true)}>Editar rascunho de teste</button>
      {aoPedirArquivar && <button onClick={() => aoPedirArquivar(linha())}>Marcar como Sem interesse</button>}
      <button onClick={() => fechar('Atendimento registrado.')}>Fechar modal de teste</button>
    </aside>
  }
  return { ModalFunil: Painel, PainelNegociacao: Painel }
})
vi.mock('@/src/components/crm/empresa-dialogo', () => {
  const Dados = () => <aside aria-label="Ficha da empresa">Ficha da empresa</aside>
  return { EmpresaDialogo: Dados, DadosEmpresaPainel: Dados }
})
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
const linha=(etapa:NegociacaoResumo['etapa']='primeiro_contato'):NegociacaoResumo=>({id:'00000000-0000-4000-8000-000000000001',empresaId:'00000000-0000-4000-8000-000000000002',nome:'Aurora',cidade:null,etapa,versao:3,empresa:{referencia:{tipo:'cadastro',empresaId:'00000000-0000-4000-8000-000000000002'},id:'00000000-0000-4000-8000-000000000002',nome:'Aurora',cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['legado'],recebidaEm:null,situacao:etapa,versao:3,negociacaoId:'00000000-0000-4000-8000-000000000001'}})
beforeEach(()=>{vi.resetAllMocks();guardaPainel.mockImplementation(depois=>depois?.());sessionStorage.clear();vi.stubGlobal('requestAnimationFrame',(f:()=>void)=>{f();return 1});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))})
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})
async function montar(dados=[linha()],selecionada:string|null=null,usuarioId='teste',arquivos:ArquivoFunilRecente[]=[]){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<Quadro usuarioId={usuarioId} linhas={dados} negociacaoInicial={selecionada} arquivos={arquivos}/>))}
async function evento(alvo:Element,tipo:string){const e=new Event(tipo,{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{setData:vi.fn(),effectAllowed:'move'}});await act(async()=>{alvo.dispatchEvent(e)})}
async function clicar(nome: string) {
  const botao = [...document.querySelectorAll('button')].find(item => item.textContent === nome)
  expect(botao, nome).toBeDefined()
  await act(async () => { botao?.focus(); botao?.click() })
}
const arquivo = (nome: string, sufixo: string): ArquivoFunilRecente => ({
  empresaId: '00000000-0000-4000-8000-00000000010' + sufixo,
  negociacaoId: '00000000-0000-4000-8000-00000000020' + sufixo,
  nome, arquivadaEm: '2026-11-05T14:00:00Z', versao: 4,
})
async function pedirArquivamento() {
  if (!host.textContent?.includes('Negociação operacional')) await clicar('Negociação')
  await clicar('Marcar como Sem interesse')
}
async function confirmarArquivamento() {
  await pedirArquivamento()
  await clicar('Confirmar Sem interesse')
}
test.each(ETAPAS_FUNIL)('arquivamento individual de %s mantém o card durante envio e falha',async etapa=>{
 let resolver!:(r:{ok:boolean;erro:string})=>void
 vi.mocked(semInteresseAcao).mockReturnValue(new Promise(r=>resolver=r))
 await montar([linha(etapa)])
 expect(ETAPAS_FUNIL).toEqual(['primeiro_contato','em_negociacao','proposta_enviada'])
 expect(host.querySelectorAll('[data-etapa]')).toHaveLength(3)
 expect(host.querySelector('[data-descarte]')).not.toBeNull()
 expect(host.textContent).not.toContain('ou para Sem interesse')
 expect(host.querySelector('[draggable=true]')).not.toBeNull()
 await pedirArquivamento()
 expect(host.textContent).toContain('Aurora');expect(semInteresseAcao).not.toHaveBeenCalled()
 await clicar('Confirmar Sem interesse')
 expect(host.textContent).toContain('Aurora')
 expect(semInteresseAcao).toHaveBeenCalledTimes(1)
 await act(async()=>resolver({ok:false,erro:'Falha simulada'}))
 expect(host.querySelector('[data-etapa] article')?.textContent).toContain('Aurora');expect(host.textContent).toContain('Falha simulada')
})

test('ver empresa mostra dados; ação comum e deep-link abrem negociação operacional',async()=>{
 await montar();await clicar('Dados da empresa');expect(host.textContent).toContain('Ficha da empresa');expect(host.textContent).not.toContain('Negociação operacional')
 await clicar('Negociação');expect(host.textContent).toContain('Negociação operacional')
 await act(async()=>root.unmount());host.remove();await montar([linha()],linha().id);expect(host.textContent).toContain('Negociação operacional')
})
test('menu por teclado/toque e retry desconhecido preservam chave; replay não anima',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:true,repetida:true,atual:false})
 await montar();await confirmarArquivamento()
 expect(host.textContent).toContain('Não foi possível confirmar');expect(host.textContent).toContain('Aurora')
 const primeiro=vi.mocked(semInteresseAcao).mock.calls[0][0]
 await clicar('Confirmar envio anterior')
 expect(vi.mocked(semInteresseAcao).mock.calls[1][0].get('chave')).toBe(primeiro.get('chave'))
 expect(host.querySelector('[data-efeito-arquivo]')).toBeNull()
 expect(host.textContent).toContain('Aurora')
})
test('origem indisponível não recebe intenção nova',async()=>{
 const l=linha();l.empresa={...l.empresa,situacao:'indisponivel',motivoIndisponibilidade:'origem_inativa'}
 await montar([l]);expect(host.querySelector('[draggable=true]')).toBeNull();expect(host.textContent).not.toContain('Marcar como Sem interesse')
})
test('avanço continua limitado à próxima etapa e restaura card após falha',async()=>{
 await montar();const card=host.querySelector('[draggable=true]')!,colunas=host.querySelectorAll('[data-etapa]')
 await evento(card,'dragstart');await evento(colunas[2],'drop');expect(etapaAcao).not.toHaveBeenCalled()
 vi.mocked(etapaAcao).mockResolvedValue({ok:false,erro:'Falhou avanço'})
 await evento(card,'dragstart');await evento(colunas[1],'drop');expect(etapaAcao).toHaveBeenCalledTimes(1);expect(colunas[0].textContent).toContain('Aurora')
})

test('resposta confirmada atual retira card e devolve foco ao status',async()=>{
 vi.mocked(semInteresseAcao).mockResolvedValue({ok:true,repetida:false,atual:true})
 await montar();await confirmarArquivamento()
 expect(host.querySelector('[role=status]')?.textContent).toContain('Empresa marcada como Sem interesse')
 expect(host.textContent).not.toContain('Aurora')
 expect(host.querySelector('[data-efeito-arquivo]')).toBeNull()
 expect(document.activeElement).toBe(host.querySelector('[role=status]'))
})

test('refresh recupera card e comando desconhecido mesmo ausente na consulta atual',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede'))
 await montar();await confirmarArquivamento()
 const chave=vi.mocked(semInteresseAcao).mock.calls[0][0].get('chave')
 await act(async()=>root.unmount());host.remove();await montar([])
 expect(host.textContent).toContain('Aurora');expect(host.textContent).toContain('Confirme o envio anterior')
 vi.mocked(semInteresseAcao).mockResolvedValue({ok:true,repetida:true,atual:true})
 await clicar('Confirmar envio anterior')
 expect(vi.mocked(semInteresseAcao).mock.calls[1][0].get('chave')).toBe(chave)
 expect(host.textContent).toContain('Envio anterior confirmado')
})

test('troca de usuário não recupera o card nem o comando privado da sessão anterior',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede'))
 await montar();await confirmarArquivamento()
 await act(async()=>root.unmount());host.remove();await montar([],null,'outro')
 expect(host.textContent).not.toContain('Aurora');expect(host.textContent).not.toContain('Confirmar envio anterior')
})

test.each(['sem_permissao','nao_encontrada'] as const)('recusa inconclusiva %s conserva envio após remontagem até replay',async motivo=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:false,motivo,erro:'Acesso temporariamente recusado'}).mockResolvedValueOnce({ok:true,repetida:true,atual:false})
 await montar();await confirmarArquivamento()
 const original=Object.fromEntries(vi.mocked(semInteresseAcao).mock.calls[0][0])
 await clicar('Confirmar envio anterior')
 expect(sessionStorage.getItem('crm:funil:arquivo:v1:teste')).not.toBeNull()
 await clicar('Dados da empresa');expect(host.textContent).toContain('Ficha da empresa')
 await act(async()=>root.unmount());host.remove();await montar([])
 await clicar('Confirmar envio anterior')
 expect(Object.fromEntries(vi.mocked(semInteresseAcao).mock.calls[2][0])).toEqual(original)
 expect(sessionStorage.getItem('crm:funil:arquivo:v1:teste')).toBeNull()
})

test('recusa conclusiva libera nova intenção sem manter chave antiga',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:false,motivo:'desatualizada',erro:'Mudou'})
 await montar();await confirmarArquivamento();await clicar('Confirmar envio anterior')
 expect(sessionStorage.getItem('crm:funil:arquivo:v1:teste')).toBeNull()
 expect(host.textContent).not.toContain('Confirmar envio anterior')
 expect(host.textContent).toContain('Marcar como Sem interesse')
})

test('mudança de identidade na mesma tela não carrega memória privada de envio',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede'))
 await montar();await confirmarArquivamento()
 await act(async()=>root.render(<Quadro usuarioId="outro" linhas={[]}/>))
 expect(host.textContent).not.toContain('Aurora')
 expect(host.textContent).not.toContain('Confirmar envio anterior')
 expect(sessionStorage.getItem('crm:funil:arquivo:v1:teste')).not.toBeNull()
})

test('fechar deep-link remove somente negociação e conserva consulta/hash',async()=>{
 history.replaceState({origem:'teste'},'','/funil?negociacao='+linha().id+'&origem=google&pagina=3#negociacoes')
 await montar([linha()],linha().id)
 await clicar('Fechar modal de teste')
 expect(replace).toHaveBeenCalledWith('/funil?origem=google&pagina=3#negociacoes',{scroll:false})
 expect(history.state.origem).toBe('teste')
 expect(host.textContent).not.toContain('Negociação operacional')
 history.replaceState(null,'','/')
})

test('abertura manual sem deep-link conserva refresh após contato e não faz replace redundante',async()=>{
 history.replaceState(null,'','/funil')
 await montar();await clicar('Negociação')
 expect(location.pathname+location.search).toBe('/funil')
 await clicar('Fechar modal de teste')
 expect(refresh).toHaveBeenCalledTimes(1);expect(replace).not.toHaveBeenCalled()
 expect(host.textContent).toContain('Atendimento registrado.')
 expect(host.textContent).not.toContain('Negociação operacional')
})

test('Funil vazio recupera venda sem consultar negociação e abre a ficha autorizada',async()=>{
 const comando={usuarioId:'teste',empresaId:'forjada',chave:'original',alvo:{tipo:'primeira',negociacaoId:'encerrada'},entrada:{valor:'123,45',data:'2026-01-01',observacao:'Original'}}
 sessionStorage.setItem('crm:venda:v1:teste',JSON.stringify(comando))
 vi.mocked(vendaAcao).mockResolvedValue({ok:true,leituraDestino:{ok:true,destino:{tipo:'carteira',empresaId:'real'}}})
 await montar([])
 expect(vendaAcao).not.toHaveBeenCalled();expect(host.textContent).toContain('Confirmar venda anterior')
 await clicar('Confirmar venda anterior')
 const f=vi.mocked(vendaAcao).mock.calls[0][0]
 expect(f.get('id')).toBe('encerrada');expect(f.get('chave')).toBe('original');expect(f.get('valor')).toBe('123,45')
 expect(replace).toHaveBeenCalledWith('/carteira/real?venda=registrada')
 expect(sessionStorage.getItem('crm:venda:v1:teste')).toBeNull()
})
test('leitura do destino ou router falha depois de confirmar mantém recibo sem incentivo a nova venda',async()=>{
 sessionStorage.setItem('crm:venda:v1:teste',JSON.stringify({usuarioId:'teste',empresaId:'forjada',chave:'original',alvo:{tipo:'primeira',negociacaoId:'encerrada'},entrada:{valor:'123,45',data:'2026-01-01',observacao:'Original'}}))
 vi.mocked(vendaAcao).mockResolvedValue({ok:true,leituraDestino:{ok:false,motivo:'leitura_indisponivel'}})
 await montar([]);await clicar('Confirmar venda anterior')
 expect(host.textContent).toContain('Venda registrada. Não foi possível abrir a ficha');expect(host.textContent).not.toContain('Confirmar venda anterior')
 expect(replace).not.toHaveBeenCalled()
})
test('replay de recompra no Funil preserva contexto e mostra recibo',async()=>{
 sessionStorage.setItem('crm:venda:v1:teste',JSON.stringify({usuarioId:'teste',empresaId:'empresa',chave:'original',alvo:{tipo:'recompra'},entrada:{valor:'123,45',data:'2026-01-01',observacao:'Original'}}))
 vi.mocked(vendaCarteiraAcao).mockResolvedValue({ok:true,leituraDestino:{ok:true,destino:{tipo:'carteira',empresaId:'real'}}})
 await montar([]);await clicar('Confirmar venda anterior')
 expect(replace).not.toHaveBeenCalled();expect(refresh).toHaveBeenCalledOnce()
 expect(host.textContent).toContain('Venda registrada.')
})
test('card abre um painel por vez sem abrir diálogo de conteúdo', async () => {
  await montar()
  expect([...host.querySelectorAll('[data-etapa] article button')].map(botao => botao.textContent)).toEqual(['Dados da empresa', 'Negociação'])
  await clicar('Dados da empresa')
  expect(host.textContent).toContain('Ficha da empresa')
  expect(document.querySelector('[role=dialog]')).toBeNull()
  await clicar('Negociação')
  expect(host.textContent).toContain('Negociação operacional')
  expect(host.textContent).not.toContain('Ficha da empresa')
  await clicar('Sem interesse')
  expect(host.textContent).not.toContain('Negociação operacional')
  const link = [...host.querySelectorAll('a')].find(item => item.textContent === 'Ver todos em Sem interesse')
  expect(link?.getAttribute('href')).toBe('/fila/localizar?disponibilidade=sem_interesse&pagina=1')
  expect(link?.closest('[data-painel-rodape]')).not.toBeNull()
  expect(link?.closest('[data-painel-corpo]')).toBeNull()
})

test('troca de Negociação para Sem interesse espera a decisão sobre o rascunho', async () => {
  await montar()
  await clicar('Negociação')
  let continuar: (() => void) | undefined
  guardaPainel.mockImplementation(depois => { continuar = depois })
  await clicar('Sem interesse')
  expect(host.textContent).toContain('Negociação operacional')
  expect(host.querySelector('a[href*="disponibilidade=sem_interesse"]')).toBeNull()
  await act(async () => continuar?.())
  expect(host.textContent).not.toContain('Negociação operacional')
  expect(host.querySelector('a[href*="disponibilidade=sem_interesse"]')).not.toBeNull()
})

test('arraste para a lixeira pede confirmação e permite cancelar sem arquivar', async () => {
  await montar()
  const card = host.querySelector('[draggable=true]')!
  const lixeira = host.querySelector('[data-descarte]')!
  expect(lixeira).not.toBeNull()
  await evento(card, 'dragstart')
  await evento(lixeira, 'drop')
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Marcar como Sem interesse?')
  await clicar('Cancelar')
  expect(semInteresseAcao).not.toHaveBeenCalled()
  expect(document.querySelector('[role=dialog]')).toBeNull()
  expect(host.querySelector('[data-etapa]')?.textContent).toContain('Aurora')
})

test('Devolver recupera a chave e versão mesmo fora das três recentes', async () => {
  const item = arquivo('Fora do recorte', '1')
  vi.mocked(devolverFunilAcao).mockRejectedValueOnce(new Error('rede'))
  await montar([], null, 'teste', [item])
  await clicar('Sem interesse')
  await clicar('Devolver')
  const original = Object.fromEntries(vi.mocked(devolverFunilAcao).mock.calls[0][0])
  expect(original).toEqual({ empresaId: item.empresaId, negociacaoId: item.negociacaoId, versao: '4', chave: expect.any(String) })
  await act(async () => root.unmount())
  host.remove()
  await montar([], null, 'teste', ['Mais recente', 'Segunda', 'Terceira'].map((nome, i) => arquivo(nome, String(i + 2))))
  expect(host.textContent).toContain('Confirmar devolução anterior')
  await clicar('Sem interesse')
  expect(host.textContent).toContain('Fora do recorte')
  vi.mocked(devolverFunilAcao).mockResolvedValueOnce({ ok: true, repetida: true, versao: 5 })
  await clicar('Confirmar devolução anterior')
  expect(Object.fromEntries(vi.mocked(devolverFunilAcao).mock.calls[1][0])).toEqual(original)
  expect(host.textContent).toContain('Devolução anterior confirmada')
  expect(refresh).toHaveBeenCalledOnce()
})

test('arquivo recente mostra no máximo três e devolução confirmada retira a linha', async () => {
  await montar([], null, 'teste', ['Primeira', 'Segunda', 'Terceira', 'Fora do recorte'].map((nome, i) => arquivo(nome, String(i + 1))))
  await clicar('Sem interesse')
  expect(host.textContent).not.toContain('Fora do recorte')
  vi.mocked(devolverFunilAcao).mockResolvedValueOnce({ ok: true, repetida: false, versao: 5 })
  await clicar('Devolver')
  expect(host.querySelector('#painel-sem-interesse ul')?.textContent ?? '').not.toContain('Primeira')
  expect(host.textContent).toContain('Segunda')
  expect(host.textContent).toContain('Empresa devolvida para Primeiro contato')
})

test.each(['armazenamento', 'recusa', 'incerto', 'sucesso'] as const)('Arquivo anuncia %s dentro da tarefa sem duplicar a mensagem global', async caso => {
  if (caso === 'armazenamento') {
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, chave, valor) {
      if (chave === 'crm:funil:devolver:v1:teste') throw Error('quota sintética')
      original.call(this, chave, valor)
    })
  } else if (caso === 'recusa') vi.mocked(devolverFunilAcao).mockResolvedValueOnce({ ok: false, motivo: 'chave_reutilizada' })
  else if (caso === 'incerto') vi.mocked(devolverFunilAcao).mockRejectedValueOnce(Error('resposta perdida'))
  else vi.mocked(devolverFunilAcao).mockResolvedValueOnce({ ok: true, repetida: false, versao: 5 })
  await montar([], null, 'teste', [arquivo('Alvo da devolução', '1')])
  await clicar('Sem interesse')
  await clicar('Devolver')
  const painel = host.querySelector('#painel-sem-interesse')!
  const tipo = caso === 'armazenamento' || caso === 'recusa' ? 'erro' : caso
  const feedback = painel.querySelector(`[data-tipo="${tipo}"]`)
  expect(feedback).not.toBeNull()
  expect(feedback?.getAttribute('role')).toBe(tipo === 'erro' ? 'alert' : 'status')
  expect(feedback?.textContent).toContain('Alvo da devolução')
  expect(feedback?.closest('[inert]')).toBeNull()
  const texto = feedback!.querySelector('p')!.textContent!
  expect(host.querySelector(':scope > p[role=status]')?.textContent ?? '').not.toContain(texto)
  if (caso === 'armazenamento') {
    expect(devolverFunilAcao).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('crm:funil:devolver:v1:teste')).toBeNull()
  }
  if (caso === 'incerto') expect(painel.querySelector('section[aria-label="Devolução pendente"] button')).not.toBeNull()
})

test.each(['fechar', 'trocar', 'desmontar'] as const)('devolução não rouba foco após %s o contexto antes do frame', async destino => {
  vi.mocked(devolverFunilAcao).mockResolvedValueOnce({ ok: true, repetida: false, versao: 5 })
  await montar([linha()], null, 'teste', [arquivo('Alvo', '1')])
  await clicar('Sem interesse')
  const frames: (() => void)[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { frames.push(callback); return frames.length })
  await clicar('Devolver')
  const anteriores = frames.splice(0)
  if (destino === 'trocar') await clicar('Negociação')
  else if (destino === 'fechar') await act(async () => { host.querySelector<HTMLButtonElement>('#painel-sem-interesse header button')!.click() })
  else { await act(async () => root.unmount()); host.remove() }
  const alvo = document.createElement('button')
  document.body.append(alvo)
  alvo.focus()
  await act(async () => anteriores.forEach(callback => callback()))
  expect(document.activeElement).toBe(alvo)
  alvo.remove()
})

test('aviso de avanço no desktop continua visível com Arquivo aberto', async () => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta.includes('min-width'), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.mocked(etapaAcao).mockResolvedValueOnce({ ok: true })
  await montar([linha()], null, 'teste', [arquivo('Alvo', '1')])
  await clicar('Sem interesse')
  await evento(host.querySelector('[draggable=true]')!, 'dragstart')
  await evento(host.querySelectorAll('[data-etapa]')[1], 'drop')
  expect(host.querySelector(':scope > p[role=status]')?.textContent).toContain('Etapa atualizada')
  expect(host.querySelector('#painel-sem-interesse')).not.toBeNull()
})

test('arquivamento novo anima o cartão e partículas apenas sem movimento reduzido', async () => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: !consulta.includes('prefers-reduced-motion'), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.mocked(semInteresseAcao).mockResolvedValue({ ok: true, repetida: false, atual: true })
  await montar()
  const card = host.querySelector('[draggable=true]')!
  const lixeira = host.querySelector('[data-descarte]')!
  await evento(card, 'dragstart')
  await evento(lixeira, 'drop')
  expect(host.querySelector('[data-efeito-arquivo]')).toBeNull()
  await clicar('Confirmar Sem interesse')
  expect(host.querySelector('[data-efeito-arquivo]')).not.toBeNull()
})

test('cancelar arquivamento mantém a Negociação e devolve foco à ação de origem', async () => {
  await montar()
  await pedirArquivamento()
  expect(document.activeElement?.textContent).toBe('Cancelar')
  await clicar('Cancelar')
  expect(host.textContent).toContain('Negociação operacional')
  expect(semInteresseAcao).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Marcar como Sem interesse'))
})

test('um vendedor não vê nem reenvia o comando de devolução de outro', async () => {
  vi.mocked(devolverFunilAcao).mockRejectedValueOnce(new Error('rede'))
  await montar([], null, 'teste', [arquivo('Arquivo privado', '1')])
  await clicar('Sem interesse')
  await clicar('Devolver')
  expect(sessionStorage.getItem('crm:funil:devolver:v1:teste')).not.toBeNull()
  await act(async () => root.render(<Quadro usuarioId="outro" linhas={[]}/>))
  await clicar('Sem interesse')
  expect(host.textContent).not.toContain('Arquivo privado')
  expect(host.textContent).not.toContain('Confirmar devolução anterior')
  expect(devolverFunilAcao).toHaveBeenCalledOnce()
})

test('resumo limpo permite arrastar o próprio card e cancelamento preserva a lateral', async () => {
  await montar()
  await clicar('Negociação')
  const card = host.querySelector('[draggable=true]')
  expect(card).not.toBeNull()
  await evento(card!, 'dragstart')
  await evento(host.querySelector('[data-descarte]')!, 'drop')
  await clicar('Cancelar')
  expect(host.textContent).toContain('Negociação operacional')
  expect(semInteresseAcao).not.toHaveBeenCalled()
})

test('edição na negociação desativa o arraste em todo o quadro', async () => {
  const outra = linha('em_negociacao')
  outra.id = 'outro-ciclo'
  outra.empresa = { ...outra.empresa, negociacaoId: outra.id }
  await montar([linha(), outra])
  await clicar('Negociação')
  await clicar('Editar rascunho de teste')
  expect(host.querySelectorAll('[draggable=true]')).toHaveLength(0)
})

test('avançar o card selecionado fecha o resumo e limpa o deep link', async () => {
  const dados = linha()
  history.replaceState(null, '', '/funil?negociacao=' + dados.id + '&origem=google')
  vi.mocked(etapaAcao).mockResolvedValue({ ok: true })
  try {
    await montar([dados], dados.id)
    const card = host.querySelector('[draggable=true]')
    expect(card).not.toBeNull()
    await evento(card!, 'dragstart')
    await evento(host.querySelector('[data-etapa=em_negociacao]')!, 'drop')
    expect(host.querySelector('[data-etapa=em_negociacao] article')?.textContent).toContain('Aurora')
    expect(host.textContent).not.toContain('Negociação operacional')
    expect(replace).toHaveBeenCalledWith('/funil?origem=google', { scroll: false })
  } finally { history.replaceState(null, '', '/') }
})

test('devolução de arquivo obsoleto retira a linha e atualiza o recorte', async () => {
  await montar([], null, 'teste', [arquivo('Arquivo obsoleto', '1')])
  await clicar('Sem interesse')
  vi.mocked(devolverFunilAcao).mockResolvedValueOnce({ ok: false, motivo: 'desatualizada' })
  await clicar('Devolver')
  expect(host.querySelector('#painel-sem-interesse ul')?.textContent ?? '').not.toContain('Arquivo obsoleto')
  expect(host.querySelector('#painel-sem-interesse [role=alert]')?.textContent).toContain('O arquivo desta empresa mudou')
  expect(sessionStorage.getItem('crm:funil:devolver:v1:teste')).toBeNull()
  expect(refresh).toHaveBeenCalledOnce()
})

test('novo recorte pode reexibir o mesmo ciclo e versão após recusa anterior', async () => {
  const item = arquivo('Arquivo reativado', '1')
  await montar([], null, 'teste', [item])
  await clicar('Sem interesse')
  vi.mocked(devolverFunilAcao).mockResolvedValueOnce({ ok: false, motivo: 'desatualizada' })
  await clicar('Devolver')
  expect(host.querySelector('#painel-sem-interesse ul')?.textContent ?? '').not.toContain(item.nome)

  await act(async () => root.render(<Quadro usuarioId="teste" linhas={[]} arquivos={[{ ...item }]}/>))

  expect(host.textContent).toContain(item.nome)
  expect(host.querySelector('button[aria-label="Devolver Arquivo reativado para Primeiro contato"]')).not.toBeNull()
})

test('card informa quando a negociação não tem próximo passo nem retorno', async () => {
  await montar()
  expect(host.querySelector('[data-etapa] article')?.textContent).toContain('Sem próximo passo combinado')
})
