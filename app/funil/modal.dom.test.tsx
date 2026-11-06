// @vitest-environment jsdom
import { act, createRef, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { PainelNegociacao, type PedirFecharNegociacao } from './modal'
import { detalheAcao, vendaAcao, telefoneAcao, etapaAcao } from './acoes'
import { vendaCarteiraAcao } from '../carteira/venda-acao'
import { criarComandoVenda, lerComandoVenda, persistirComandoVenda } from '@/src/lib/venda-envio'
import { detalhesSnapshot } from '@/src/lib/empresa-visual'
import { pedirSaidaDaEdicao } from '@/src/components/crm/descarte-edicao'
vi.mock('../carteira/venda-acao',()=>({vendaCarteiraAcao:vi.fn()}))
vi.mock('./acoes',()=>({detalheAcao:vi.fn(),telefoneAcao:vi.fn(),etapaAcao:vi.fn(),vendaAcao:vi.fn(),devolverAcao:vi.fn()}))
const editorReal = vi.hoisted(() => ({ ativo: false }))
const prepararContato = vi.hoisted(() => vi.fn())
const gravarContato = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/src/features/contato/acao', () => ({ prepararContatoAcao: prepararContato, registrarContatoAcao: gravarContato }))
vi.mock('@/src/features/contato/formulario', async importar => {
  const real = await importar<typeof import('@/src/features/contato/formulario')>()
  return { FormularioContato: (props: ComponentProps<typeof real.FormularioContato>) => editorReal.ativo ? <real.FormularioContato {...props} /> : <>
    <button onClick={() => props.onDraftChange?.({tipo:'acompanhamento',nota:'Preservar',proximoPasso:'',proximoPassoData:''})}>Editar rascunho de teste</button>
    <button onClick={() => props.onDraftChange?.({tipo:'acompanhamento',nota:'',proximoPasso:'',proximoPassoData:''})}>Reverter rascunho de teste</button>
    <button onClick={() => props.onSaved?.('e',{ok:true,erro:null,repetida:false,chave:'teste',rascunho:{tipo:'acompanhamento',nota:'',proximoPasso:'',proximoPassoData:''},leituraDestino:{ok:true,destino:{tipo:'funil',negociacaoId:'atual'}}})}>Confirmar contato de teste</button>
    <button onClick={props.onCancel}>Cancelar</button>
  </> }
})
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
const detalhe={id:'a',empresaId:'e',nome:'Aurora',cidade:null,uf:null,cnpj:'123',etapa:'primeiro_contato' as const,versao:3,empresa:{...detalhesSnapshot({razao_social:'Aurora'},{tipo:'cadastro',empresaId:'e'}),id:'e',versao:3,situacao:'primeiro_contato' as const,negociacaoId:'a'},proximoPasso:null,retorno:null,historico:[]}
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();sessionStorage.clear();editorReal.ativo=false;vi.restoreAllMocks()})
async function montar(id='a', props: Partial<ComponentProps<typeof PainelNegociacao>> = {}){host=document.createElement('div');document.body.append(host);root=createRoot(host);const fechar=vi.fn();await act(async()=>root.render(<PainelNegociacao usuarioId="teste" id={id} fechar={fechar} {...props}/>));return fechar}
async function popstate(){await act(async()=>{window.dispatchEvent(new PopStateEvent('popstate'));await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))})}
async function clicar(nome:string){const b=[...document.querySelectorAll('button')].find(e=>(e.textContent===nome||e.getAttribute('aria-label')===nome)&&!e.closest('[hidden]'));expect(b, nome).toBeTruthy();await act(async()=>{b!.focus();b!.click()})}
async function escapar(){await act(async()=>document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))}
async function escrever(valor:string){const e=document.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(e,valor);e.dispatchEvent(new Event('input',{bubbles:true}))})}


test('negociação mantém dados cadastrais no painel da empresa e abre sem modal', async () => {
  vi.mocked(detalheAcao).mockResolvedValue({ ...detalhe, cidade: 'Campinas', uf: 'SP', proximoPasso: 'Enviar amostra', retorno: '2026-11-12' })
  await montar()
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(host.textContent).toContain('Aurora')
  expect(host.textContent).toContain('Primeiro contato')
  expect(host.textContent).toContain('Enviar amostra')
  expect(host.textContent).toContain('12/11/2026')
  expect(host.textContent).not.toContain('Campinas')
  expect(host.textContent).not.toContain('CNPJ')
})

test('ação Sem interesse solicita confirmação ao quadro sem sair do painel', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  const aoPedirArquivar = vi.fn()
  const fechar = await montar('a', { aoPedirArquivar })
  await abrirArquivo()
  expect(aoPedirArquivar).toHaveBeenCalledOnce()
  expect(aoPedirArquivar).toHaveBeenCalledWith(detalhe)
  expect(fechar).not.toHaveBeenCalled()
  expect(document.body.textContent).not.toContain('Confirmar Sem interesse')
})

test('troca de painel limpo usa apenas o destino fornecido pelo quadro', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  const fecharRef = createRef<PedirFecharNegociacao>()
  const fechar = await montar('a', { fecharRef })
  const depois = vi.fn()
  await act(async () => fecharRef.current?.(depois))
  expect(depois).toHaveBeenCalledOnce()
  expect(fechar).not.toHaveBeenCalled()
})

test('troca de painel sujo só segue depois do descarte e restauração do histórico', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  const voltar = vi.spyOn(history, 'back').mockImplementation(() => {})
  const fecharRef = createRef<PedirFecharNegociacao>()
  const fechar = await montar('a', { fecharRef })
  await abrirVenda()
  await escrever('25,00')
  const cancelar = vi.fn()
  await act(async () => fecharRef.current?.(cancelar))
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Descartar alterações?')
  await clicar('Continuar editando')
  expect(cancelar).not.toHaveBeenCalled()
  expect(document.querySelector('input')?.value).toBe('25,00')
  const depois = vi.fn()
  await act(async () => fecharRef.current?.(depois))
  await clicar('Descartar')
  expect(depois).not.toHaveBeenCalled()
  expect(voltar).toHaveBeenCalledOnce()
  await popstate()
  expect(depois).toHaveBeenCalledOnce()
  expect(fechar).not.toHaveBeenCalled()
})

test('troca após manter rascunho preserva o envio desconhecido de atendimento', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.spyOn(history, 'back').mockImplementation(() => {})
  const salvo = JSON.stringify({ envio: { chave: 'original', versao: 2, valor: { nota: 'Preservar' } } })
  sessionStorage.setItem('crm:contato:v1:e', salvo)
  const fecharRef = createRef<PedirFecharNegociacao>()
  const fechar = await montar('a', { fecharRef })
  await abrirAtendimento()
  const depois = vi.fn()
  await act(async () => fecharRef.current?.(depois))
  await clicar('Fechar mantendo rascunho')
  await popstate()
  expect(depois).toHaveBeenCalledOnce()
  expect(fechar).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
})

test('troca de painel durante confirmação de venda em voo fica sem destino', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.spyOn(history, 'back').mockImplementation(() => {})
  const fecharRef = createRef<PedirFecharNegociacao>()
  const fechar = await montar('a', { fecharRef })
  await abrirVenda()
  await escrever('25,00')
  await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Confirmar venda de R$ 25,00')
  let liberar!: (r: { ok: false; erro: string; erroDeCampos: true }) => void
  vi.mocked(vendaAcao).mockReturnValueOnce(new Promise(r => liberar = r))
  await clicar('Confirmar venda')
  const depois = vi.fn()
  const sair = vi.fn()
  await act(async () => fecharRef.current?.(depois))
  await act(async () => pedirSaidaDaEdicao(sair))
  expect(depois).not.toHaveBeenCalled()
  await act(async () => liberar({ ok: false, erro: 'Corrija os dados.', erroDeCampos: true }))
  expect(sair).not.toHaveBeenCalled()
  expect(depois).not.toHaveBeenCalled()
  expect(fechar).not.toHaveBeenCalled()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Corrija os dados.')
  await clicar('Corrigir dados')
  expect(document.querySelector('input')?.value).toBe('25,00')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})


test('link interno do CRM protege rascunho do Funil com a confirmação existente', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  const armar = vi.spyOn(history, 'pushState')
  await montar()
  const link = document.createElement('a')
  link.href = '/carteira'
  link.textContent = 'Carteira'
  host.append(link)
  await abrirVenda()
  await escrever('38,00')
  const clicouComModificador = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
  let bloqueouModificador = true
  link.addEventListener('click', evento => { bloqueouModificador = evento.defaultPrevented; evento.preventDefault() }, { once: true })
  await act(async () => { link.dispatchEvent(clicouComModificador) })
  expect(bloqueouModificador).toBe(false)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  const clicou = new MouseEvent('click', { bubbles: true, cancelable: true })
  let bloqueouLink = false
  link.addEventListener('click', evento => { bloqueouLink = evento.defaultPrevented; evento.preventDefault() }, { once: true })
  await act(async () => { link.focus(); link.dispatchEvent(clicou) })
  expect(bloqueouLink).toBe(true)
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Descartar alterações?')
  expect(armar).toHaveBeenCalledOnce()
  await clicar('Continuar editando')
  expect(document.querySelector('input')?.value).toBe('38,00')
})

test('saída do CRM aguarda o Back da guarda do Funil antes de continuar', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  const voltar = vi.spyOn(history, 'back').mockImplementation(() => {})
  const salvo = JSON.stringify({ envio: { chave: 'original', versao: 2, valor: { nota: 'Preservar' } } })
  sessionStorage.setItem('crm:contato:v1:e', salvo)
  await montar()
  await abrirAtendimento()
  const sair = vi.fn(() => {
    const evento = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(false)
  })
  await act(async () => pedirSaidaDaEdicao(sair))
  expect(sair).not.toHaveBeenCalled()
  await clicar('Fechar mantendo rascunho')
  expect(voltar).toHaveBeenCalledOnce()
  expect(sair).not.toHaveBeenCalled()
  await popstate()
  expect(sair).toHaveBeenCalledOnce()
  expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
  const tentarNovamente = vi.fn()
  await act(async () => pedirSaidaDaEdicao(tentarNovamente))
  expect(tentarNovamente).not.toHaveBeenCalled()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Descartar alterações?')
})


test('arraste fica bloqueado durante edição e volta a ser permitido no resumo', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  const aoMudarBloqueioDeArraste = vi.fn()
  await montar('a', { aoMudarBloqueioDeArraste })
  expect(aoMudarBloqueioDeArraste).toHaveBeenLastCalledWith(false)
  await abrirAtendimento()
  expect(aoMudarBloqueioDeArraste).toHaveBeenLastCalledWith(true)
  await clicar('Voltar')
  expect(aoMudarBloqueioDeArraste).toHaveBeenLastCalledWith(false)
})

test('envio desconhecido do quadro bloqueia nova operação no modal do deep-link',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe)
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<PainelNegociacao usuarioId="teste" id="a" fechar={vi.fn()} bloqueada/>))
 await abrirVenda()
 expect(document.querySelector('input')).toBeNull()
 expect(document.body.textContent).toContain('Confirme o envio anterior no Funil')
})

test('descarte externo não perde envio desconhecido e permite fechar mantendo sessão',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.spyOn(history,'back').mockImplementation(()=>{})
  const salvo=JSON.stringify({envio:{chave:'original',versao:2,valor:{nota:'Preservar'}}})
  sessionStorage.setItem('crm:contato:v1:e',salvo)
  const fechar=await montar();await abrirAtendimento();await clicar('Editar rascunho de teste');await clicar('Voltar');await clicar('Descartar')
  expect(document.body.textContent).toContain('Confirme o envio anterior')
  expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
  await clicar('Fechar mantendo rascunho')
  await popstate()
  expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
  expect(fechar).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('Etapa atual:')
})

test('modal oferece apenas próximo avanço e última etapa não tem select nem avanço',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(etapaAcao).mockResolvedValue({ok:true})
  vi.spyOn(history,'back').mockImplementation(()=>{})
  const fechar=await montar()
  expect(document.querySelector('select')).toBeNull()
  await abrirPasso(); await clicar('Avançar para Em negociação')
  await popstate()
  const f=vi.mocked(etapaAcao).mock.calls.at(-1)![0]
  expect(f.get('etapa')).toBe('em_negociacao');expect(f.get('anterior')).toBe('primeiro_contato')
  expect(fechar).toHaveBeenCalledWith('Etapa atualizada.')
  await act(async()=>root.unmount());host.remove()
  vi.mocked(detalheAcao).mockResolvedValue({...detalhe,etapa:'proposta_enviada'})
  await montar('ultima')
  expect(document.querySelector('select')).toBeNull()
  expect(document.body.textContent).not.toContain('Avançar para')
  await abrirPasso(); expect(document.body.textContent).toContain('Registrar venda')
})


test('Histórico usa eventos próprios recolhidos e preserva o próximo passo histórico', async () => {
  vi.mocked(detalheAcao).mockResolvedValue({ ...detalhe, historico: [
    { id: 'recente', em: '2026-10-21T12:00:00Z', tipo: 'acompanhamento', nota: 'Negociar prazo com Aurora', proximoPasso: 'Enviar proposta antiga', retorno: '2026-10-22' },
    { id: 'antigo', em: '2026-10-20T12:00:00Z', tipo: 'nao_liguei', nota: 'Primeira nota da Aurora', proximoPasso: null, retorno: null },
  ] })
  await montar()
  expect(host.textContent).not.toContain('Negociar prazo com Aurora')
  await abrirHistoricoMantendoRascunho()
  expect(host.querySelectorAll('details')).toHaveLength(2)
  expect([...host.querySelectorAll('details')].every(evento => !evento.open)).toBe(true)
  expect(host.textContent).toContain('Por Você')
  await clicar('Expandir todos')
  expect([...host.querySelectorAll('details')].every(evento => evento.open)).toBe(true)
  expect(host.textContent).toContain('Negociar prazo com Aurora')
  expect(host.textContent).toContain('Enviar proposta antiga')
  expect(host.textContent).toContain('22/10/2026')
})

test('resposta tardia após desmontagem não apresenta dados em outra abertura',async()=>{
  let liberar!:(d:typeof detalhe)=>void
  vi.mocked(detalheAcao).mockReturnValueOnce(new Promise(r=>liberar=r))
  await montar();expect(document.body.textContent).toContain('Carregando negociação')
  await act(async()=>root.unmount());host.remove()
  vi.mocked(detalheAcao).mockResolvedValueOnce({...detalhe,id:'b',nome:'Boreal'})
  await montar('b');await act(async()=>liberar(detalhe))
  expect(document.body.textContent).toContain('Boreal');expect(document.body.textContent).not.toContain('Aurora')
})
test('rascunho sobrevive ao Escape e erro de venda; envio bloqueia fechamento',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.spyOn(history,'back').mockImplementation(()=>{})
  const fechar=await montar();await abrirVenda();await escrever('25,00')
  await escapar()
  expect(document.body.textContent).toContain('Descartar alterações?');await clicar('Continuar editando');expect(document.querySelector('input')?.value).toBe('25,00')
  await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  let liberar!:(r:{ok:boolean;erro:string})=>void
  vi.mocked(vendaAcao).mockReturnValueOnce(new Promise(r=>liberar=r))
  await clicar('Confirmar venda')
  await escapar()
  expect(fechar).not.toHaveBeenCalled()
  await act(async()=>liberar({ok:false,erro:'Falha simulada'}))
  expect(document.body.textContent).toContain('Falha simulada');expect(document.querySelector('input')?.value).toBe('25,00')
  expect(vi.mocked(vendaAcao).mock.calls[0][0].get('chave')).toMatch(/^[0-9a-f-]{36}$/)
})
test('perda de posse bloqueia escrita mas preserva rascunho para copiar',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.spyOn(history,'back').mockImplementation(()=>{})
  const fechar=await montar();await abrirVenda();await escrever('32,10')
  await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  vi.mocked(vendaAcao).mockResolvedValue({ok:false,erro:'Indisponível',indisponivel:true});await clicar('Confirmar venda')
  expect(fechar).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Rascunho preservado')
  expect(document.querySelector('textarea')?.value).toContain('32,10')
})
test('telefone tardio não reabre seção nem fecha novo formulário de venda',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.spyOn(history,'back').mockImplementation(()=>{})
  let liberar!:(t:string|null)=>void;vi.mocked(telefoneAcao).mockReturnValue(new Promise(r=>liberar=r))
  const fechar=await montar();await abrirAtendimento();await clicar('Voltar');await abrirVenda();await escrever('40,00')
  await act(async()=>liberar(null));expect(fechar).not.toHaveBeenCalled();expect(document.querySelector('input')?.value).toBe('40,00')
 expect(host.querySelector('section:not([hidden]) form')).toBeNull()
 expect(host.querySelector('form')?.textContent).toContain('Registrar primeira venda')
})

test('contato confirmado no modal conserva callback de fechamento contextual',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const fechar=await montar();await abrirAtendimento();await clicar('Confirmar contato de teste')
 expect(fechar).toHaveBeenCalledWith('Atendimento registrado.')
})
test('acompanhamento intocado do modal volta à leitura de origem sem descarte',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const fechar=await montar();await abrirAtendimento();await clicar('Voltar')
 expect(document.body.textContent).not.toContain('Descartar alterações?')
 expect(document.body.textContent).toContain('Registrar venda')
 expect(document.activeElement?.textContent).toBe('Registrar atendimento')
 expect(fechar).not.toHaveBeenCalled()
})

test('reverter ao baseline remove proteção temporária do histórico do modal',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirAtendimento();await clicar('Editar rascunho de teste');await clicar('Reverter rascunho de teste')
 expect(voltar).toHaveBeenCalledTimes(1)
 await popstate()
 expect(document.body.textContent).not.toContain('Descartar alterações?')
 expect(fechar).not.toHaveBeenCalled()
})

test('fechamento após contato aguarda popstate da sentinela e só então chama o Quadro',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirAtendimento();await clicar('Editar rascunho de teste')
 await clicar('Confirmar contato de teste')
 expect(voltar).toHaveBeenCalledTimes(1)
 expect(fechar).not.toHaveBeenCalled()
 await popstate()
 expect(fechar).toHaveBeenCalledTimes(1)
 expect(fechar).toHaveBeenCalledWith('Atendimento registrado.')
})
test('Escape durante retirada por reversão aguarda a mesma navegação sem recuar duas vezes',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirAtendimento();await clicar('Editar rascunho de teste');await clicar('Reverter rascunho de teste')
 await escapar()
 expect(voltar).toHaveBeenCalledTimes(1);expect(fechar).not.toHaveBeenCalled()
 await popstate()
 expect(fechar).not.toHaveBeenCalled();expect(voltar).toHaveBeenCalledTimes(1)
 expect(host.querySelector('section:not([hidden]) h3')?.textContent).toBe('Atendimento e próximo passo')
})
test('Escape intocado fecha imediatamente sem recuo de histórico',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe)
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar()
 await escapar()
 expect(fechar).toHaveBeenCalledTimes(1);expect(voltar).not.toHaveBeenCalled()
})

test('X intocado fecha sem sentinela e Voltar ao resumo não navega',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirAtendimento();await clicar('Voltar')
 expect(fechar).not.toHaveBeenCalled();expect(voltar).not.toHaveBeenCalled()
 await fecharPeloMenu()
 expect(fechar).toHaveBeenCalledTimes(1);expect(voltar).not.toHaveBeenCalled()
})
test.each(['Voltar','Escape'])('retorno interno com %s preserva comando desconhecido e mantém guarda no passo',async(como)=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const valor={tipo:'acompanhamento',nota:'',proximoPasso:'',proximoPassoData:''}
 const salvo=JSON.stringify({valor,envio:{chave:'anterior',versao:2,valor}})
 sessionStorage.setItem('crm:contato:v1:e',salvo)
 const fechar=await montar();await abrirAtendimento()
 if(como==='Escape')await escapar()
 else await clicar('Voltar')
 await clicar('Fechar mantendo rascunho')
 expect(fechar).not.toHaveBeenCalled();expect(voltar).toHaveBeenCalledTimes(1)
 await popstate()
 expect(fechar).not.toHaveBeenCalled();expect(voltar).toHaveBeenCalledTimes(1)
 expect(host.querySelector('section:not([hidden]) h3')?.textContent).toBe('Atendimento e próximo passo')
 await fecharPeloMenu()
 expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Descartar alterações?')
 expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
})
test('Voltar do navegador confirmado remove só a sentinela e a intenção original de voltar',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{}),ir=vi.spyOn(history,'go').mockImplementation(()=>{})
 const fechar=await montar();await abrirAtendimento();await clicar('Editar rascunho de teste')
 await popstate()
 await clicar('Descartar')
 expect(ir).toHaveBeenCalledTimes(1);expect(ir).toHaveBeenCalledWith(-2)
 expect(voltar).not.toHaveBeenCalled();expect(fechar).not.toHaveBeenCalled()
})

test('nova edição enquanto a sentinela sai continua protegida no próximo Voltar',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirAtendimento();await clicar('Editar rascunho de teste');await clicar('Reverter rascunho de teste');await clicar('Editar rascunho de teste')
 await popstate()
 await popstate()
 expect(document.body.textContent).toContain('Descartar alterações?')
 expect(fechar).not.toHaveBeenCalled()
})

test('Voltar ao resumo durante retirada reavalia edição antes do popstate e rearma próxima guarda',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirAtendimento();await clicar('Editar rascunho de teste');await clicar('Reverter rascunho de teste')
 await clicar('Voltar');await clicar('Editar rascunho de teste')
 await popstate()
 await popstate()
 expect(document.body.textContent).toContain('Descartar alterações?')
 expect(voltar).toHaveBeenCalledTimes(1);expect(fechar).not.toHaveBeenCalled()
})
test('venda desconhecida congela correção e descarte e oferece fechar mantendo envio',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.spyOn(history,'back').mockImplementation(()=>{})
 await montar();await abrirVenda();await escrever('33,40')
 await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 vi.mocked(vendaAcao).mockRejectedValueOnce(Error('rede'));await clicar('Confirmar venda')
 const salvo=sessionStorage.getItem('crm:venda:v1:teste')
 expect(salvo).toContain('33,40')
 expect([...document.querySelectorAll('button')].some(b=>b.textContent==='Corrigir dados')).toBe(false)
 expect(document.body.textContent).toContain('Fechar mantendo envio')
 await act(async()=>{await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))})
 expect(document.activeElement?.textContent).toBe('Verificar registro')
 await clicar('Fechar mantendo envio');await popstate()
 expect(sessionStorage.getItem('crm:venda:v1:teste')).toBe(salvo)
})
test('primeira venda confirmada entrega destino ao Quadro somente depois de retirar a sentinela',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirVenda();await escrever('81,50')
 await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 const confirmacao={ok:true as const,leituraDestino:{ok:true as const,destino:{tipo:'carteira' as const,empresaId:'autorizada'}}}
 vi.mocked(vendaAcao).mockResolvedValueOnce(confirmacao);await clicar('Confirmar venda')
 expect(fechar).not.toHaveBeenCalled();expect(voltar).toHaveBeenCalledTimes(1)
 await popstate()
 expect(fechar).toHaveBeenCalledWith('Venda registrada.',confirmacao)
})
test('callback de destino falha após venda confirmada sem oferecer nova gravação',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.spyOn(history,'back').mockImplementation(()=>{})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<PainelNegociacao usuarioId="teste" id="a" fechar={()=>{throw Error('callback')}}/>))
 await abrirVenda();await escrever('81,50');await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 vi.mocked(vendaAcao).mockResolvedValueOnce({ok:true,leituraDestino:{ok:false,motivo:'leitura_indisponivel'}});await clicar('Confirmar venda')
 await popstate()
 expect(document.body.textContent).toContain('Venda registrada.')
 expect(document.querySelector('a[href="/carteira"]')).not.toBeNull()
 expect(document.body.textContent).not.toContain('Não foi possível confirmar o resultado')
 expect([...document.querySelectorAll('button')].find(b=>b.textContent==='Conferir venda')?.matches(':disabled')).toBe(true)
})
test('destino aguarda os demais listeners de popstate para não ser substituído pelo restore do App Router',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.spyOn(history,'back').mockImplementation(()=>{})
 const ordem:string[]=[]
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<PainelNegociacao usuarioId="teste" id="a" fechar={()=>ordem.push('destino')}/>))
 const restaurar=()=>ordem.push('restore');window.addEventListener('popstate',restaurar)
 await abrirVenda();await escrever('81,50');await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 vi.mocked(vendaAcao).mockResolvedValueOnce({ok:true});await clicar('Confirmar venda')
 await popstate()
 window.removeEventListener('popstate',restaurar)
 expect(ordem).toEqual(['restore','destino'])
})
test('desmontar antes do frame impede callback antigo sem perder a confirmação já recebida',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirVenda();await escrever('81,50')
 await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 vi.mocked(vendaAcao).mockResolvedValueOnce({ok:true});await clicar('Confirmar venda')
 expect(sessionStorage.getItem('crm:venda:v1:teste')).toBeNull()
 await act(async()=>{window.dispatchEvent(new PopStateEvent('popstate'));root.unmount();await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))})
 expect(fechar).not.toHaveBeenCalled()
})
test('edição refeita continua guardada se próximo Back chega antes do frame de conclusão',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999');vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await abrirAtendimento();await clicar('Editar rascunho de teste');await clicar('Reverter rascunho de teste');await clicar('Voltar');await clicar('Editar rascunho de teste')
 await act(async()=>{window.dispatchEvent(new PopStateEvent('popstate'));window.dispatchEvent(new PopStateEvent('popstate'))})
 expect(document.body.textContent).toContain('Descartar alterações?');expect(fechar).not.toHaveBeenCalled()
})
test('modal aberto por negociação recupera recompra pelo alvo salvo e permanece no Funil',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(null)
 vi.mocked(vendaAcao).mockReset().mockResolvedValue({ok:false,erro:'Ação de primeira venda indevida'})
 vi.mocked(vendaCarteiraAcao).mockReset().mockResolvedValue({ok:true})
 const comando=criarComandoVenda('teste','cliente',{tipo:'recompra'},{valor:'21,00',data:'2026-01-01',observacao:'Nota congelada'})
 persistirComandoVenda(comando)
 const fechar=await montar('negociacao-do-deep-link')
 await clicar('Verificar registro')
 expect(vendaAcao).not.toHaveBeenCalled()
 expect(vendaCarteiraAcao).toHaveBeenCalledOnce()
 const form=vi.mocked(vendaCarteiraAcao).mock.calls[0][0]
 expect(Object.fromEntries(form)).toEqual({id:'cliente',chave:comando.chave,confirmado:'sim',...comando.entrada})
 expect(fechar).not.toHaveBeenCalled()
 expect(document.body.textContent).toContain('Venda registrada.')
 expect(sessionStorage.getItem('crm:venda:v1:teste')).toBeNull()
})

test('confirmar recompra não fecha nem desarma a guarda de um rascunho de atendimento',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 vi.mocked(vendaAcao).mockReset().mockResolvedValue({ok:true})
 vi.mocked(vendaCarteiraAcao).mockReset().mockResolvedValue({ok:true})
 const fechar=await montar()
 await abrirAtendimento();await clicar('Editar rascunho de teste')
 const comando=criarComandoVenda('teste','cliente',{tipo:'recompra'},{valor:'22,00',data:'2026-01-01',observacao:'Outra venda'})
 await act(async()=>{persistirComandoVenda(comando);window.dispatchEvent(new Event('crm-venda'))})
 await clicar('Verificar registro')
 expect(fechar).not.toHaveBeenCalled()
 expect(document.body.textContent).toContain('Venda registrada.')
 await popstate()
 expect(document.body.textContent).toContain('Descartar alterações?')
})


test('editor inicia no menu e mantém ações fixas em passo e histórico', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  await montar('a', { aoPedirArquivar: vi.fn() })
  expect(host.querySelector('[role="tablist"]')).toBeNull()
  expect([...host.querySelectorAll('nav button')].map(b => b.textContent)).toEqual(['Atendimento e próximo passo', 'Histórico'])
  expect(host.textContent).not.toContain('Resumo')
  expect(host.textContent).not.toContain('Editar rascunho de teste')
  await abrirHistoricoMantendoRascunho()
  expect([...host.querySelectorAll('footer button')].map(b => b.textContent)).toEqual(['Registrar venda', 'Sem interesse'])
})

test('Atendimento monta somente na primeira abertura e preserva o editor ao visitar Histórico', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockClear().mockResolvedValue('11999999999')
  await montar()
  expect(host.querySelector('button')?.textContent).toBe('Fechar')
  expect(host.textContent).not.toContain('Editar rascunho de teste')
  await abrirAtendimento()
  const editor = [...host.querySelectorAll('button')].find(b => b.textContent === 'Editar rascunho de teste')!
  await clicar('Editar rascunho de teste')
  await abrirHistoricoMantendoRascunho()
  expect(editor.isConnected).toBe(true)
  expect(editor.closest('[hidden]')).not.toBeNull()
  await abrirAtendimento()
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Editar rascunho de teste')).toBe(editor)
  expect(telefoneAcao).toHaveBeenCalledTimes(1)
})

test('envio de contato bloqueia descarte e arquivo mesmo com Histórico ativo', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.spyOn(history, 'back').mockImplementation(() => {})
  const salvo = JSON.stringify({ envio: { chave: 'anterior', versao: 2, valor: { nota: 'Preservar' } } })
  sessionStorage.setItem('crm:contato:v1:e', salvo)
  const aoPedirArquivar = vi.fn()
  await montar('a', { aoPedirArquivar })
  await abrirHistoricoMantendoRascunho()
  await abrirArquivo()
  expect(aoPedirArquivar).not.toHaveBeenCalled()
  await clicar('Descartar')
  expect(document.body.textContent).toContain('Confirme o envio anterior')
  expect(aoPedirArquivar).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
})


test('preparação real captura versão só ao abrir Atendimento e preserva snapshot em outra aba', async () => {
  editorReal.ativo = true
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockClear().mockResolvedValue('11999999999')
  prepararContato.mockReset().mockResolvedValue({ ok: true, fase: 'negociacao', empresa: { versao: 9, situacao: 'primeiro_contato' } })
  await montar()
  await abrirHistoricoMantendoRascunho()
  expect(prepararContato).not.toHaveBeenCalled()
  expect(telefoneAcao).not.toHaveBeenCalled()
  expect(host.querySelector('form')).toBeNull()
  await abrirAtendimento()
  expect(prepararContato).toHaveBeenCalledOnce()
  prepararContato.mockResolvedValue({ ok: true, fase: 'negociacao', empresa: { versao: 12, situacao: 'primeiro_contato' } })
  const formulario = host.querySelector('form')!
  const nota = formulario.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(nota, 'Rascunho real')
    nota.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await abrirHistoricoMantendoRascunho()
  expect(document.activeElement?.textContent).toBe('Histórico')
  await abrirAtendimento()
  expect(host.querySelector('form')).toBe(formulario)
  expect(nota.value).toBe('Rascunho real')
  expect(prepararContato).toHaveBeenCalledOnce()
  expect(host.querySelector('button[type=submit]')?.textContent).toBe('Salvar atendimento')
  gravarContato.mockRejectedValueOnce(Error('resposta perdida'))
  await act(async () => formulario.requestSubmit())
  expect(gravarContato.mock.calls.at(-1)![1].get('versao')).toBe('9')
  vi.spyOn(history, 'back').mockImplementation(() => {})
  await clicar('Cancelar')
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Descartar alterações?')
  expect(nota.value).toBe('Rascunho real')
})

test('Voltar do cabeçalho é único e retorna ao menu; rótulo contextual permanece na raiz', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  const fechar = await montar('a', { rotuloFechar: 'Voltar' })
  await abrirHistoricoMantendoRascunho()
  expect([...host.querySelectorAll('button')].filter(b => b.textContent === 'Voltar')).toHaveLength(1)
  await clicar('Voltar')
  expect(host.querySelector('nav[aria-label="Seções da negociação"]')).not.toBeNull()
  expect(document.activeElement?.textContent).toBe('Histórico')
  expect(fechar).not.toHaveBeenCalled()
  await clicar('Voltar')
  expect(fechar).toHaveBeenCalledOnce()
})

test('arquivo aguarda descarte do rascunho em aba inativa e retirada da sentinela', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.spyOn(history, 'back').mockImplementation(() => {})
  const arquivar = vi.fn()
  await montar('a', { aoPedirArquivar: arquivar })
  await abrirAtendimento()
  await clicar('Editar rascunho de teste')
  await abrirHistoricoMantendoRascunho()
  await abrirArquivo()
  expect(arquivar).not.toHaveBeenCalled()
  await clicar('Descartar')
  expect(arquivar).not.toHaveBeenCalled()
  await popstate()
  expect(arquivar).toHaveBeenCalledWith(detalhe)
})


test('envio de contato desconhecido também impede abrir venda pela ação do Histórico', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  sessionStorage.setItem('crm:contato:v1:e', JSON.stringify({ envio: { chave: 'original', versao: 2, valor: { nota: 'Preservar' } } }))
  await montar()
  await abrirHistoricoMantendoRascunho()
  await abrirVenda()
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Descartar alterações?')
  expect(document.querySelector('[role=dialog]')?.textContent).not.toContain('Fechar mantendo rascunho')
  await clicar('Descartar')
  expect(host.querySelector('input')).toBeNull()
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Confirme o envio anterior')
})

test('confirmar venda de outra negociação mantém editor aberto e utilizável', async () => {
  const outra = { ...detalhe, id: 'b', empresaId: 'e-b', nome: 'Boreal', empresa: { ...detalhe.empresa, id: 'e-b', nome: 'Boreal', referencia: { tipo: 'cadastro' as const, empresaId: 'e-b' }, negociacaoId: 'b' } }
  persistirComandoVenda({ usuarioId: 'teste', empresaId: 'e', chave: 'venda-original-a', alvo: { tipo: 'primeira', negociacaoId: 'a' }, entrada: { valor: '20', data: '2026-11-05', observacao: 'A' } })
  vi.mocked(detalheAcao).mockResolvedValue(outra)
  vi.mocked(vendaAcao).mockResolvedValue({ ok: true, leituraDestino: { ok: true, destino: { tipo: 'carteira', empresaId: 'e' } } })
  const fechar = await montar('b')
  await clicar('Verificar registro')
  await popstate()
  expect(fechar).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Boreal')
  expect(vi.mocked(vendaAcao).mock.calls.at(-1)![0].get('id')).toBe('a')
  expect(vi.mocked(vendaAcao).mock.calls.at(-1)![0].get('chave')).toBe('venda-original-a')
  await abrirVenda()
  expect(host.textContent).toContain('Registrar primeira venda')
  expect(host.querySelector('input')).not.toBeNull()
  await escrever('30,00')
  const reload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(reload)
  expect(reload.defaultPrevented).toBe(true)
  expect(typeof history.state?.__funilRascunho).toBe('string')
  await clicar('Voltar')
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Descartar alterações?')
  await clicar('Continuar editando')
  expect(host.querySelector('input')?.value).toBe('30,00')
})


test('empresa indisponível desde a abertura bloqueia novas operações por clique e teclado e conserva Histórico', async () => {
  vi.mocked(detalheAcao).mockResolvedValue({ ...detalhe, empresa: { ...detalhe.empresa, situacao: 'indisponivel' } })
  vi.mocked(telefoneAcao).mockClear()
  vi.mocked(vendaAcao).mockClear()
  vi.mocked(etapaAcao).mockClear()
  prepararContato.mockClear()
  const arquivar = vi.fn()
  await montar('a', { aoPedirArquivar: arquivar })
  await abrirPasso()
  for (const nome of ['Registrar venda', 'Sem interesse', 'Avançar para Em negociação']) {
    const botao = [...host.querySelectorAll('button')].find(b => b.textContent === nome)!
    expect(botao.matches(':disabled'), nome).toBe(true)
    await clicar(nome)
  }
  const atendimento = [...host.querySelectorAll('button')].find(b => b.textContent === 'Registrar atendimento')!
  expect(atendimento.matches(':disabled')).toBe(true)
  await clicar('Registrar atendimento')
  await clicar('Voltar'); await clicar('Histórico')
  expect(host.querySelector('[aria-label="Histórico comercial"]')).not.toBeNull()
  expect(host.querySelector('form')).toBeNull()
  expect(telefoneAcao).not.toHaveBeenCalled()
  expect(prepararContato).not.toHaveBeenCalled()
  expect(vendaAcao).not.toHaveBeenCalled()
  expect(etapaAcao).not.toHaveBeenCalled()
  expect(arquivar).not.toHaveBeenCalled()
})

test('empresa indisponível mantém replay da venda anterior com identidade e entrada originais', async () => {
  vi.mocked(detalheAcao).mockResolvedValue({ ...detalhe, empresa: { ...detalhe.empresa, situacao: 'indisponivel' } })
  vi.mocked(vendaAcao).mockReset().mockResolvedValue({ ok: false, erro: 'Ainda sem confirmação' })
  const comando = criarComandoVenda('teste', 'e', { tipo: 'primeira', negociacaoId: 'a' }, { valor: '43,20', data: '2026-11-05', observacao: 'Entrada original' })
  persistirComandoVenda(comando)
  await montar()
  await clicar('Verificar registro')
  expect(vendaAcao).toHaveBeenCalledOnce()
  expect(Object.fromEntries(vi.mocked(vendaAcao).mock.calls[0][0])).toEqual({ id: 'a', chave: comando.chave, confirmado: 'sim', ...comando.entrada })
  expect(JSON.parse(sessionStorage.getItem('crm:venda:v1:teste')!)).toEqual(comando)
})



function botaoVisivel(nome: string) { return [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === nome && !b.closest('[hidden]')) }
async function abrirPasso() {
  if (botaoVisivel('Atendimento e próximo passo')) await clicar('Atendimento e próximo passo')
}
async function abrirAtendimento() {
  if (botaoVisivel('Ver todos') || host.querySelector('[aria-label="Histórico comercial"]')) await clicar('Voltar')
  await abrirPasso(); await clicar('Registrar atendimento')
}
async function abrirVenda() { await abrirPasso(); await clicar('Registrar venda') }
async function abrirArquivo() { await abrirPasso(); await clicar('Sem interesse') }
async function fecharPeloMenu() {
  if (!botaoVisivel('Fechar')) await clicar('Voltar')
  await clicar('Fechar')
}
async function abrirHistoricoMantendoRascunho() {
  if (!botaoVisivel('Histórico')) {
    vi.spyOn(history, 'back').mockImplementation(() => {})
    await clicar('Voltar')
    if (document.querySelector('[role=dialog]')) { await clicar('Fechar mantendo rascunho'); await popstate() }
    if (!botaoVisivel('Histórico')) await clicar('Voltar')
  }
  await clicar('Histórico')
}
test('negociação começa no menu sem abas ou Resumo e só prepara atendimento após tarefa explícita', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockClear().mockResolvedValue('11999999999')
  await montar()
  expect(host.querySelector('[role="tablist"]')).toBeNull()
  expect(host.textContent).not.toContain('Resumo')
  await clicar('Atendimento e próximo passo')
  expect(telefoneAcao).not.toHaveBeenCalled()
  await clicar('Registrar atendimento')
  expect(telefoneAcao).toHaveBeenCalledOnce()
})
test('tarefa volta à seção de origem e confirmação central não fecha o painel', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  const fechar = await montar()
  await clicar('Histórico'); await clicar('Registrar venda'); await escrever('25,00')
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(document.querySelector('[data-confirmacao-alvo]')?.textContent).toContain('Aurora')
  await clicar('Corrigir dados')
  expect(host.querySelector('input')?.value).toBe('25,00')
  vi.spyOn(history, 'back').mockImplementation(() => {})
  await clicar('Cancelar'); await clicar('Descartar'); await popstate()
  expect(host.querySelector('[aria-label="Histórico comercial"]')).not.toBeNull()
  expect(document.activeElement?.textContent).toBe('Registrar venda')
  expect(fechar).not.toHaveBeenCalled()
})
test('retry repete somente a leitura autorizada', async () => {
  vi.mocked(detalheAcao).mockReset().mockRejectedValueOnce(Error('rede')).mockResolvedValueOnce(detalhe)
  vi.mocked(vendaAcao).mockClear(); gravarContato.mockClear()
  await montar()
  expect(host.querySelector('[data-tipo="erro"]')).not.toBeNull()
  await clicar('Tentar novamente')
  expect(detalheAcao).toHaveBeenCalledTimes(2)
  expect(vendaAcao).not.toHaveBeenCalled(); expect(gravarContato).not.toHaveBeenCalled()
  expect(host.querySelector('nav')).not.toBeNull()
})
test('ações externas continuam no formulário certo e viewport não remonta envio', async () => {
  editorReal.ativo = true
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  prepararContato.mockReset().mockResolvedValue({ ok: true, fase: 'negociacao', empresa: { versao: 9, situacao: 'primeiro_contato' } })
  let resolver!: (r: { ok: false; erro: string }) => void
  gravarContato.mockReset().mockReturnValue(new Promise(r => { resolver = r }))
  await montar(); await clicar('Atendimento e próximo passo'); await clicar('Registrar atendimento')
  const painel = host.querySelector('aside')!, formulario = painel.querySelector('form')!
  const submit = painel.querySelector<HTMLButtonElement>('button[type=submit]')!
  expect(submit.form).toBe(formulario)
  expect(painel.querySelector('[data-painel-corpo]')?.contains(submit)).toBe(false)
  await act(async () => submit.click())
  const original = sessionStorage.getItem('crm:contato:v1:e')
  await act(async () => { window.dispatchEvent(new Event('resize')); submit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); submit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); submit.click() })
  expect(painel.querySelector('form')).toBe(formulario)
  expect(prepararContato).toHaveBeenCalledOnce(); expect(gravarContato).toHaveBeenCalledOnce()
  expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(original)
  await act(async () => resolver({ ok: false, erro: 'Sem resposta conclusiva' }))
})
test('venda incerta apresenta comando original e replay após viewport conserva identidade', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(vendaCarteiraAcao).mockReset().mockRejectedValue(Error('rede'))
  const comandoAntes = criarComandoVenda('teste', 'outra-empresa', { tipo: 'recompra' }, { valor: '91,00', data: '2026-11-06', observacao: 'Original' })
  persistirComandoVenda(comandoAntes)
  await montar()
  expect(host.textContent).toContain('outra-empresa'); expect(host.textContent).toContain('91,00'); expect(host.textContent).toContain('06/11/2026')
  await act(async () => window.dispatchEvent(new Event('resize'))); await clicar('Verificar registro')
  const comandoDepois = lerComandoVenda('teste')!
  expect(comandoDepois.chave).toBe(comandoAntes.chave)
  expect(comandoDepois.entrada).toEqual(comandoAntes.entrada)
  expect(comandoDepois.alvo).toEqual(comandoAntes.alvo)
})
test('filtro vazio oferece Ver todos fora do corpo e mantém foco ao restaurar ações', async () => {
  vi.mocked(detalheAcao).mockClear().mockResolvedValue(detalhe)
  await montar(); await clicar('Histórico'); await clicar('Vendas 0')
  const verTodos = [...host.querySelectorAll('button')].find(b => b.textContent === 'Ver todos')!
  expect(verTodos?.closest('[data-painel-rodape]')).not.toBeNull()
  expect(host.querySelector('[data-painel-rodape]')?.textContent).not.toContain('Registrar venda')
  await clicar('Ver todos')
  expect(document.activeElement).not.toBe(document.body)
  expect(host.querySelector('[data-painel-rodape]')?.textContent).toContain('Registrar venda')
  expect(detalheAcao).toHaveBeenCalledOnce()
})


test('retry de telefone mantém autorização da tarefa e resposta tardia não entra em outra empresa', async () => {
  editorReal.ativo = true
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(telefoneAcao).mockReset().mockRejectedValueOnce(Error('rede'))
  prepararContato.mockClear(); gravarContato.mockClear(); vi.mocked(vendaAcao).mockClear()
  await montar(); await clicar('Atendimento e próximo passo'); await clicar('Registrar atendimento')
  expect(host.querySelector('[data-tipo="erro"]')?.textContent).toContain('telefone')
  let resolver!: (telefone: string) => void
  vi.mocked(telefoneAcao).mockReturnValueOnce(new Promise(r => { resolver = r }))
  await clicar('Tentar novamente')
  expect(telefoneAcao).toHaveBeenCalledTimes(2)
  expect(vi.mocked(telefoneAcao).mock.calls).toEqual([['a'], ['a']])
  await clicar('Voltar')
  await act(async () => root.unmount()); host.remove()
  vi.mocked(detalheAcao).mockResolvedValue({ ...detalhe, id: 'b', empresaId: 'b', nome: 'Boreal' })
  await montar('b')
  await act(async () => resolver('11999999999'))
  expect(host.textContent).toContain('Boreal')
  expect(host.textContent).not.toContain('11999999999')
  expect(host.querySelector('form')).toBeNull()
  expect(prepararContato).not.toHaveBeenCalled(); expect(gravarContato).not.toHaveBeenCalled(); expect(vendaAcao).not.toHaveBeenCalled()
})

test('venda externa confere o próprio formulário e viewport não duplica comando em voo', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.spyOn(history, 'back').mockImplementation(() => {})
  let resolver!: (r: { ok: false; erro: string }) => void
  vi.mocked(vendaAcao).mockReset().mockReturnValue(new Promise(r => { resolver = r }))
  await montar(); await clicar('Atendimento e próximo passo'); await clicar('Registrar venda')
  const formulario = host.querySelector('form')!
  const submit = host.querySelector<HTMLButtonElement>('button[type=submit]')!
  expect(submit.form).toBe(formulario)
  expect(host.querySelector('[data-painel-corpo]')?.contains(submit)).toBe(false)
  await escrever('73,00')
  const data = formulario.querySelector<HTMLInputElement>('input[type=date]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(data, '2026-11-06'); data.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => submit.click())
  expect(document.querySelector('[data-confirmacao-alvo]')?.textContent).toContain('06/11/2026')
  await clicar('Confirmar venda')
  const comandoAntes = lerComandoVenda('teste')!
  const confirmar = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Registrando...')!
  await act(async () => { window.dispatchEvent(new Event('resize')); confirmar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); confirmar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); confirmar.click(); formulario.requestSubmit() })
  expect(host.querySelector('form')).toBe(formulario)
  expect(vendaAcao).toHaveBeenCalledOnce()
  const comandoDepois = lerComandoVenda('teste')!
  expect(comandoDepois.chave).toBe(comandoAntes.chave)
  expect(comandoDepois.entrada).toEqual(comandoAntes.entrada)
  expect(comandoDepois.alvo).toEqual(comandoAntes.alvo)
  await act(async () => resolver({ ok: false, erro: 'Sem resposta conclusiva' }))
})


test('erro de replay continua visível sem detalhe da negociação e preserva comando', async () => {
  vi.mocked(detalheAcao).mockResolvedValue(null)
  vi.mocked(vendaCarteiraAcao).mockReset().mockResolvedValue({ ok: false, erro: 'Recompra ainda não confirmada' })
  const comando = criarComandoVenda('teste', 'cliente', { tipo: 'recompra' }, { valor: '48,00', data: '2026-11-06', observacao: '' })
  persistirComandoVenda(comando)
  await montar('negociacao-indisponivel'); await clicar('Verificar registro')
  expect(host.querySelector('[role=alert]')?.textContent).toContain('Recompra ainda não confirmada')
  expect(lerComandoVenda('teste')).toEqual(comando)
})
