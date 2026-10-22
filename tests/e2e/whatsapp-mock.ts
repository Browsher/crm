import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import { createServer } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BancoDeTeste } from '../integracao/ajuda'

// Somente o harness local importa este módulo. Certificado efêmero confiado
// pelo processo de teste, sem desligar a validação TLS da aplicação.
export async function iniciarWhatsAppDeTeste(banco: BancoDeTeste) {
  const pasta = await mkdtemp(join(tmpdir(), 'crm-whatsapp-e2e-'))
  const chave = join(pasta, 'key.pem'), certificado = join(pasta, 'cert.pem')
  const limpar = async () => { await Promise.all([unlink(chave), unlink(certificado)]); await rmdir(pasta) }
  try {
    execFileSync(process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', chave, '-out', certificado,
      '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    ], { stdio: 'ignore' })
    await banco.sql("INSERT INTO empresa(id,cnpj,razao_social,telefone) VALUES('00000000-0000-4000-8000-000000009991','00000000009991','Cliente WhatsApp Aurora','11988889991')")
    const agora = Math.floor(Date.now() / 1000)
    const registros = [
      { key: { id: 'texto-aurora', remoteJid: '5511988889991@s.whatsapp.net', fromMe: false }, pushName: 'Contato Aurora', messageTimestamp: agora - 60, message: { conversation: 'Podemos conversar sobre o próximo pedido?' } },
      { key: { id: 'imagem-aurora', remoteJid: '5511988889991@s.whatsapp.net', fromMe: true }, messageTimestamp: agora - 120, message: { imageMessage: { mimetype: 'image/png', caption: 'Imagem local de teste' } } },
      { key: { id: 'documento-indisponivel', remoteJid: '5511988889991@s.whatsapp.net', fromMe: false }, messageTimestamp: agora - 180, message: { documentMessage: { mimetype: 'application/pdf', fileName: 'pedido.pdf' } } },
      { key: { id: 'texto-boreal', remoteJid: '5511988889992@s.whatsapp.net', fromMe: false }, pushName: 'Contato Boreal', messageTimestamp: agora - 240, message: { conversation: 'Mensagem da segunda conversa.' } },
    ]
    const servidor = createServer({ key: await readFile(chave), cert: await readFile(certificado) }, async (pedido, resposta) => {
      if (pedido.headers.apikey !== 'chave-apenas-e2e') { resposta.writeHead(403).end(); return }
      const partes: Buffer[] = []
      for await (const parte of pedido) partes.push(Buffer.from(parte))
      const corpo = JSON.parse(Buffer.concat(partes).toString() || '{}')
      resposta.setHeader('Content-Type', 'application/json')
      if (pedido.url?.startsWith('/chat/findMessages/')) {
        const id = corpo.where?.key?.id
        resposta.end(JSON.stringify({ messages: { records: id ? registros.filter(r => r.key.id === id) : registros, total: registros.length } }))
      } else if (pedido.url?.startsWith('/chat/getBase64FromMediaMessage/') && corpo.message?.key?.id === 'imagem-aurora') {
        resposta.end(JSON.stringify({ mimetype: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cXioAAAAASUVORK5CYII=' }))
      } else resposta.writeHead(503).end('{}')
    })
    servidor.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    const endereco = servidor.address()
    if (!endereco || typeof endereco === 'string') throw new Error('Porta do mock indisponível')
    return { url: `https://127.0.0.1:${endereco.port}`, certificado, fechar: async () => { servidor.closeAllConnections(); await new Promise<void>((resolve, reject) => servidor.close(erro => erro ? reject(erro) : resolve())); await limpar() } }
  } catch (erro) {
    await limpar().catch(() => {})
    throw erro
  }
}
