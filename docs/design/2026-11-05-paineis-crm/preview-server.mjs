import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.dirname(fileURLToPath(import.meta.url))
const allowed = new Set(fs.readdirSync(root).filter(name => /\.(html|css|js|md|json|png)$/.test(name)))
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'}
const server = http.createServer((request,response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  if(request.method !== 'GET' && request.method !== 'HEAD'){response.writeHead(405);response.end();return}
  if(!allowed.has(name)){response.writeHead(404);response.end('Arquivo não encontrado');return}
  const file = path.join(root,name)
  response.writeHead(200,{
    'Content-Type':mime[path.extname(file)] || 'application/octet-stream',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'SAMEORIGIN',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; frame-ancestors 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"
  })
  if(request.method==='HEAD')response.end()
  else fs.createReadStream(file).pipe(response)
})
server.on('error',error=>{console.error(error.code);process.exitCode=1})
server.listen(Number(process.argv[2] || 4338),'127.0.0.1',()=>console.log('Galeria local: http://127.0.0.1:'+server.address().port+'/'))
