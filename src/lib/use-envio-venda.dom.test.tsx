// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { type EstadoVenda, criarComandoVenda, lerComandoVenda } from './venda-envio'
import { useEnvioVenda } from './use-envio-venda'
const c=criarComandoVenda('ator','empresa',{tipo:'primeira',negociacaoId:'ciclo'},{valor:'23,40',data:'2026-01-01',observacao:'Original'})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
let estado:ReturnType<typeof useEnvioVenda>
function Tela({ator='ator',acao}:{ator?:string;acao:(f:FormData)=>Promise<EstadoVenda>}) {const atual=useEnvioVenda(ator,acao);useEffect(()=>{estado=atual});return <><p>{atual.erro}</p><button onClick={()=>void atual.enviar(c)}>Novo</button><button onClick={()=>void atual.enviar()}>Replay</button></>}
async function montar(acao:(f:FormData)=>Promise<EstadoVenda>,ator='ator'){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<Tela acao={acao} ator={ator}/>))}
async function clicar(i:number){await act(async()=>host.querySelectorAll('button')[i].click())}
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();sessionStorage.clear();vi.restoreAllMocks()})
test('persiste antes da rede; perde resposta, remonta e só replay explícito transmite entrada original',async()=>{
 const acao=vi.fn<(f:FormData)=>Promise<EstadoVenda>>(async()=>{expect(lerComandoVenda('ator')).toEqual(c);throw Error('rede')})
 await montar(acao);await clicar(0);expect(estado.comando).toEqual(c)
 await act(async()=>root.unmount());host.remove();await montar(acao)
 expect(acao).toHaveBeenCalledTimes(1);expect(estado.comando).toEqual(c)
 acao.mockResolvedValueOnce({ok:true});await clicar(1)
 expect([...acao.mock.calls[1][0].entries()]).toEqual([...acao.mock.calls[0][0].entries()])
 expect(lerComandoVenda('ator')).toBeNull();expect(estado.resultado?.ok).toBe(true)
})
test('storage indisponível bloqueia transmissão; não anuncia resposta desconhecida',async()=>{
 const acao=vi.fn();await montar(acao)
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota')})
 await clicar(0);expect(acao).not.toHaveBeenCalled();expect(estado.erro).toContain('armazenar');expect(estado.comando).toBeNull()
})
test('limpeza falha depois de confirmar e conserva sucesso; comando posterior não é removido',async()=>{
 const acao=vi.fn().mockResolvedValue({ok:true});await montar(acao)
 vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw Error('storage')})
 await clicar(0);expect(estado.resultado?.ok).toBe(true);expect(estado.erro).not.toContain('confirmar o resultado');expect(estado.comando).toBeNull()
 expect(estado.resultado).toMatchObject({aviso:expect.stringContaining('Venda registrada')})
})
test('resposta tardia limpa somente o próprio comando e não toca outro ator',async()=>{
 let liberar!:(r:EstadoVenda)=>void
 await montar(()=>new Promise(r=>liberar=r));await clicar(0)
 await act(async()=>root.unmount());host.remove();await montar(vi.fn(),'outro')
 const posterior=criarComandoVenda('ator','posterior',{tipo:'recompra'},c.entrada)
 sessionStorage.setItem('crm:venda:v1:ator',JSON.stringify(posterior))
 await act(async()=>liberar({ok:true}))
 expect(lerComandoVenda('ator')).toEqual(posterior);expect(estado.resultado).toBeNull();expect(estado.comando).toBeNull()
})
test('recusa inconclusiva conserva payload, conclusiva permite intenção nova com chave nova',async()=>{
 const acao=vi.fn().mockResolvedValueOnce({ok:false,erro:'Permissão'}).mockResolvedValueOnce({ok:false,erro:'Encerrada',recusaConclusiva:true})
 await montar(acao);await clicar(0);expect(estado.comando).toEqual(c)
 await clicar(1);expect(estado.comando).toBeNull();expect(lerComandoVenda('ator')).toBeNull()
})
test('confirmação é conhecida por outro consumidor do mesmo ator mesmo se limpeza falhar',async()=>{
 let outro:ReturnType<typeof useEnvioVenda>
 function DuasTelas(){const atual=useEnvioVenda('ator',vi.fn());useEffect(()=>{outro=atual});return <Tela acao={async()=>({ok:true})}/>}
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<DuasTelas/>))
 vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw Error('quota')})
 await clicar(0)
 expect(outro!.comando).toBeNull();expect(outro!.resultado).toBeNull()
})
test('nova intenção nunca confirma silenciosamente alvo antigo e clique duplo usa uma chamada',async()=>{
 let liberar!:(r:EstadoVenda)=>void
 const acao=vi.fn<(f:FormData)=>Promise<EstadoVenda>>(()=>new Promise(r=>liberar=r));await montar(acao)
 await act(async()=>{void estado.enviar(c);void estado.enviar(c)})
 expect(acao).toHaveBeenCalledTimes(1)
 await act(async()=>liberar({ok:false,erro:'Permissão'}))
 await act(async()=>root.unmount());host.remove();await montar(acao)
 const outra=criarComandoVenda('ator','outra',{tipo:'recompra'},c.entrada)
 await act(async()=>{await estado.enviar(outra)})
 expect(acao).toHaveBeenCalledTimes(1);expect(lerComandoVenda('ator')).toEqual(c)
})
test('confirmação antiga não encerra estado de outro editor do mesmo ator nem remove intenção posterior',async()=>{
 let liberar!:(r:EstadoVenda)=>void
 await montar(()=>new Promise(r=>liberar=r));await clicar(0)
 await act(async()=>root.unmount());host.remove()
 const posterior=criarComandoVenda('ator','posterior',{tipo:'recompra'},c.entrada)
 sessionStorage.setItem('crm:venda:v1:ator',JSON.stringify(posterior))
 await montar(vi.fn())
 await act(async()=>liberar({ok:true}))
 expect(estado.comando).toEqual(posterior);expect(estado.resultado).toBeNull();expect(lerComandoVenda('ator')).toEqual(posterior)
})

test('validação explícita da primeira transmissão libera correção, replay após perda conserva comando',async()=>{
 const acao=vi.fn<(f:FormData)=>Promise<EstadoVenda>>().mockResolvedValueOnce({ok:false,erro:'Data futura',erroDeCampos:true})
 await montar(acao);await clicar(0)
 expect(lerComandoVenda('ator')).toBeNull();expect(estado.comando).toBeNull()
 const corrigida=criarComandoVenda('ator','empresa',c.alvo,{...c.entrada,data:'2026-01-02'})
 acao.mockResolvedValueOnce({ok:true});await act(async()=>{await estado.enviar(corrigida)})
 expect(acao.mock.calls[1][0].get('chave')).not.toBe(acao.mock.calls[0][0].get('chave'))
 acao.mockRejectedValueOnce(Error('rede'));await act(async()=>{await estado.enviar(c)})
 expect(estado.resultado).toBeNull()
 await act(async()=>root.unmount());host.remove();await montar(acao)
 acao.mockResolvedValueOnce({ok:false,erro:'Data futura',erroDeCampos:true});await clicar(1)
 expect(estado.comando).toEqual(c);expect(lerComandoVenda('ator')).toEqual(c)
})
test('primeira recusa de campos tardia após desmontagem não libera um comando em recuperação',async()=>{
 let liberar!:(r:EstadoVenda)=>void
 await montar(()=>new Promise(r=>liberar=r));await clicar(0)
 await act(async()=>root.unmount());host.remove();await montar(vi.fn())
 await act(async()=>liberar({ok:false,erro:'Data futura',erroDeCampos:true}))
 expect(lerComandoVenda('ator')).toEqual(c);expect(estado.comando).toEqual(c);expect(estado.resultado).toBeNull()
})