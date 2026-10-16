import ts from 'typescript'

function resolver(atual: string, pedido: string): string {
  if (!pedido.startsWith('.')) throw new Error('Módulo externo não permitido: ' + pedido)
  const partes = atual.split('/').slice(0, -1)
  for (const p of pedido.replace(/\.ts$/, '').split('/')) {
    if (p === '.' || p === '') continue
    if (p === '..') {
      if (!partes.length) throw new Error('Módulo externo ao mapa')
      partes.pop()
    } else partes.push(p)
  }
  return partes.join('/')
}
export function compilarCodigoN8n(modulos: Record<string, string>, entrada: string): string {
  if (!Object.hasOwn(modulos, entrada)) throw new Error('Entrada ausente no mapa')
  const funcoes: string[] = []
  for (const [id, fonte] of Object.entries(modulos)) {
    for (const referencia of ts.preProcessFile(fonte).importedFiles) {
      const destino = resolver(id, referencia.fileName)
      if (!Object.hasOwn(modulos, destino)) throw new Error('Módulo externo ao mapa: ' + destino)
    }
    const r = ts.transpileModule(fonte, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, removeComments: true,
    }, reportDiagnostics: true })
    if (r.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw new Error('Fonte TypeScript inválida: ' + id)
    funcoes.push(JSON.stringify(id) + ': function(exports, require) {\n' + r.outputText + '\n}')
  }
  return '(function(){\nconst modulos = {' + funcoes.join(',\n') + '};\n' +
    String.raw`const cache = Object.create(null)
function resolver(atual,pedido) {
  if (!pedido.startsWith('.')) throw new Error('Modulo externo')
  const partes = atual.split('/').slice(0,-1)
  for (const p of pedido.replace(/\.ts$/, '').split('/')) {
    if (!p || p === '.') continue
    if (p === '..') { if (!partes.length) throw new Error('Modulo externo'); partes.pop() }
    else partes.push(p)
  }
  return partes.join('/')
}
function carregar(id) {
  if (Object.hasOwn(cache,id)) return cache[id]
  if (!Object.hasOwn(modulos,id)) throw new Error('Modulo externo')
  const exports = {}
  cache[id] = exports
  modulos[id](exports,pedido => carregar(resolver(id,pedido)))
  return exports
}
` + '\nreturn carregar(' + JSON.stringify(entrada) + ')\n})()'
}
