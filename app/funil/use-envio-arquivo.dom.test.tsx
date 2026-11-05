// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { useEnvioArquivo } from './use-envio-arquivo'
import { semInteresseAcao, type EstadoFunil } from './acoes'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
vi.mock('./acoes', () => ({ semInteresseAcao: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const chaveStorage = 'crm:funil:arquivo:v1:ator'
const linha = { id: '00000000-0000-4000-8000-000000000001', empresaId: '00000000-0000-4000-8000-000000000002', nome: 'Aurora', cidade: null, etapa: 'primeiro_contato', versao: 3, empresa: { situacao: 'primeiro_contato', negociacaoId: '00000000-0000-4000-8000-000000000001', versao: 3 } } as NegociacaoResumo
let root: ReturnType<typeof createRoot> | undefined
let host: HTMLDivElement
const consumidores: ReturnType<typeof useEnvioArquivo>[] = []
function Consumidor({ indice = 0 }: { indice?: number }) {
  const envio = useEnvioArquivo('ator')
  useLayoutEffect(() => { consumidores[indice] = envio })
  return null
}
async function montar() {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root!.render(<><Consumidor /><Consumidor indice={1} /></>))
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; host?.remove(); sessionStorage.clear(); vi.restoreAllMocks(); vi.mocked(semInteresseAcao).mockReset() })

test('persiste comando completo antes do envio e reutiliza a chave na recuperação pelo outro consumidor', async () => {
  vi.mocked(semInteresseAcao).mockImplementationOnce(async form => {
    const salvo = JSON.parse(sessionStorage.getItem(chaveStorage)!)
    expect(salvo.linha).toEqual(linha)
    expect(form.get('chave')).toBe(salvo.chave)
    throw Error('resposta perdida')
  }).mockResolvedValueOnce({ ok: true, repetida: true, atual: false })
  await montar()
  await act(async () => { expect(await consumidores[0].enviar(linha)).toBeNull() })
  const salvo = sessionStorage.getItem(chaveStorage)!
  expect(consumidores[1].comando?.linha).toEqual(linha)
  await act(async () => { expect(await consumidores[1].recuperar()).toEqual({ ok: true, repetida: true, atual: false }) })
  expect(vi.mocked(semInteresseAcao).mock.calls[1][0].get('chave')).toBe(JSON.parse(salvo).chave)
  expect(sessionStorage.getItem(chaveStorage)).toBeNull()
})

test('reload sem linha atual recupera exatamente o comando salvo', async () => {
  const comando = { linha, chave: crypto.randomUUID() }
  sessionStorage.setItem(chaveStorage, JSON.stringify(comando))
  vi.mocked(semInteresseAcao).mockResolvedValue({ ok: true, repetida: true, atual: false })
  await montar()
  await act(async () => { await consumidores[0].recuperar() })
  expect(Object.fromEntries(vi.mocked(semInteresseAcao).mock.calls[0][0])).toEqual({ id: linha.id, empresaId: linha.empresaId, versao: '3', chave: comando.chave })
})

test('storage indisponível não transmite nenhum comando novo', async () => {
  await montar()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  await act(async () => { expect(await consumidores[0].enviar(linha)).toBeNull() })
  expect(semInteresseAcao).not.toHaveBeenCalled()
  expect(consumidores[0].aviso).toContain('Nenhum envio foi feito')
})

test('duas instâncias compartilham trava e não sobrepõem a intenção anterior', async () => {
  let resolver!: (r: EstadoFunil) => void
  vi.mocked(semInteresseAcao).mockReturnValue(new Promise(r => { resolver = r }))
  await montar()
  let envio!: Promise<EstadoFunil | null>
  await act(async () => { envio = consumidores[0].enviar(linha) })
  expect(consumidores[1].pendente).toBe(true)
  await act(async () => { expect(await consumidores[1].recuperar()).toBeNull() })
  expect(semInteresseAcao).toHaveBeenCalledTimes(1)
  await act(async () => { resolver({ ok: false, motivo: 'sem_permissao' }); await envio })
  expect(consumidores[1].comando?.linha).toEqual(linha)
  await act(async () => { expect(await consumidores[1].enviar({ ...linha, id: 'outra' })).toBeNull() })
  expect(semInteresseAcao).toHaveBeenCalledTimes(1)
})

test.each(['sem_permissao', 'nao_encontrada'] as const)('recusa %s preserva recuperação', async motivo => {
  vi.mocked(semInteresseAcao).mockResolvedValue({ ok: false, motivo })
  await montar()
  await act(async () => { await consumidores[0].enviar(linha) })
  expect(sessionStorage.getItem(chaveStorage)).not.toBeNull()
})

test('recusa conclusiva libera comando sem emitir sucesso', async () => {
  vi.mocked(semInteresseAcao).mockResolvedValue({ ok: false, motivo: 'desatualizada' })
  await montar()
  await act(async () => { expect(await consumidores[0].enviar(linha)).toEqual({ ok: false, motivo: 'desatualizada' }) })
  expect(sessionStorage.getItem(chaveStorage)).toBeNull()
})

test('comando inválido bloqueia nova intenção sem trocar a chave', async () => {
  sessionStorage.setItem(chaveStorage, '{invalido')
  await montar()
  await act(async () => { expect(await consumidores[0].enviar(linha)).toBeNull() })
  expect(semInteresseAcao).not.toHaveBeenCalled()
  expect(sessionStorage.getItem(chaveStorage)).toBe('{invalido')
  expect(consumidores[0].aviso).toContain('recuperar')
})


test('resposta perdida após desmontagem mantém replay e a trava até o transporte terminar', async () => {
  let rejeitar!: (erro: Error) => void
  vi.mocked(semInteresseAcao).mockReturnValueOnce(new Promise((_r, rejeitarEnvio) => { rejeitar = rejeitarEnvio }))
  await montar()
  let envio!: Promise<EstadoFunil | null>
  await act(async () => { envio = consumidores[0].enviar(linha) })
  const salvo = sessionStorage.getItem(chaveStorage)!
  await act(async () => root!.unmount())
  host.remove()
  await montar()
  expect(consumidores[1].pendente).toBe(true)
  await act(async () => { expect(await consumidores[1].recuperar()).toBeNull() })
  expect(semInteresseAcao).toHaveBeenCalledTimes(1)
  await act(async () => { rejeitar(Error('resposta perdida')); expect(await envio).toBeNull() })
  expect(sessionStorage.getItem(chaveStorage)).toBe(salvo)
  vi.mocked(semInteresseAcao).mockResolvedValueOnce({ ok: true, repetida: true, atual: false })
  await act(async () => { await consumidores[1].recuperar() })
  expect(vi.mocked(semInteresseAcao).mock.calls[1][0].get('chave')).toBe(JSON.parse(salvo).chave)
})

test('resposta de A não remove outro comando salvo durante o transporte', async () => {
  let resolver!: (r: EstadoFunil) => void
  vi.mocked(semInteresseAcao).mockReturnValueOnce(new Promise(r => { resolver = r }))
  await montar()
  let envio!: Promise<EstadoFunil | null>
  await act(async () => { envio = consumidores[0].enviar(linha) })
  const outro = JSON.stringify({ linha: { ...linha, id: 'outra-negociacao' }, chave: crypto.randomUUID() })
  sessionStorage.setItem(chaveStorage, outro)
  await act(async () => { resolver({ ok: true, repetida: true, atual: false }); await envio })
  expect(sessionStorage.getItem(chaveStorage)).toBe(outro)
  expect(consumidores[1].comando?.linha.id).toBe('outra-negociacao')
})
