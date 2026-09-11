import { expect, test } from 'vitest'
import { destinoDeVolta } from './destino'

// O campo `voltarPara` é input oculto de formulário: quem o manda é o
// navegador, não o servidor. O que o servidor de fato produz são duas formas,
// e só elas: `urlCarteira` (app/carteira/filtros.ts) monta
// `/carteira` com `nome`, `uf` e `retorno`; `urlMeuDia` (app/meu-dia/agenda.ts)
// monta `/meu-dia` com `nome` e `retorno`. Tudo o mais que chegar aqui é
// adulteração, e a resposta é o destino seguro, nunca o valor recebido.
const SEGURO = '/carteira'

test('sem destino nao redireciona', () => {
  expect(destinoDeVolta('')).toBe(null)
})

test('aceita a carteira sem filtro', () => {
  expect(destinoDeVolta('/carteira')).toBe('/carteira')
})

test('aceita a agenda sem filtro', () => {
  expect(destinoDeVolta('/meu-dia')).toBe('/meu-dia')
})

test('preserva os filtros da carteira', () => {
  expect(destinoDeVolta('/carteira?nome=Aurora&uf=SP&retorno=atrasado'))
    .toBe('/carteira?nome=Aurora&uf=SP&retorno=atrasado')
})

test('preserva os filtros da agenda', () => {
  expect(destinoDeVolta('/meu-dia?nome=Aurora&retorno=hoje'))
    .toBe('/meu-dia?nome=Aurora&retorno=hoje')
})

test('preserva acento e espaco do nome', () => {
  expect(destinoDeVolta('/carteira?nome=Cl%C3%ADnica+S%C3%A3o+Jo%C3%A3o'))
    .toBe('/carteira?nome=Cl%C3%ADnica+S%C3%A3o+Jo%C3%A3o')
})

// Cada linha é uma forma de sair do site ou de ir para uma rota que ninguém
// previu. O `//` e o `/\` são os dois que mais enganam: parecem caminho
// interno e o navegador lê os dois como host.
//
// O caminho da recusa é `/meu-dia`, nunca `/carteira`, e isso é deliberado:
// `SEGURO` é `/carteira`, então uma entrada como `https://exemplo.invalido/carteira`
// devolveria `/carteira` mesmo com o guarda apagado, e a asserção passaria por
// vacuidade. Com `/meu-dia`, apagar o guarda faz a função devolver `/meu-dia` e
// o teste morre. A prova de mutação achou exatamente isso: três guardas
// sobreviviam à primeira versão desta bateria.
test.for([
  ['host externo', 'https://exemplo.invalido/meu-dia'],
  ['sem protocolo', '//exemplo.invalido/meu-dia'],
  ['barra invertida', '/\exemplo.invalido/meu-dia'],
  ['duas barras invertidas', '\\exemplo.invalido/meu-dia'],
  ['javascript', 'javascript:alert(1)'],
  ['dados embutidos', 'data:text/html,<script>alert(1)</script>'],
  ['barra escapada', '/%2f%2fexemplo.invalido'],
  ['usuario no host', 'https://meu-dia@exemplo.invalido'],
  ['subida de diretorio', '/carteira/../usuarios'],
  ['outra rota do sistema', '/usuarios'],
  ['a propria ficha, que deixa de existir', '/carteira/empresa-1'],
  ['caixa diferente da rota', '/MEU-DIA'],
  ['caminho relativo', 'meu-dia'],
  ['barra no fim, forma que o servidor nao produz', '/meu-dia/'],
  ['ancora', '/meu-dia#fim'],
  ['filtro que a rota nao tem', '/meu-dia?uf=SP'],
  ['parametro inventado', '/meu-dia?redirecionar=https://exemplo.invalido'],
  ['filtro repetido', '/meu-dia?nome=a&nome=b'],
  ['nome acima do limite', `/meu-dia?nome=${'a'.repeat(121)}`],
  ['caractere de controle no filtro', '/meu-dia?nome=a%0Ab'],
])('recusa %s', ([, bruto]) => {
  expect(destinoDeVolta(bruto)).toBe(SEGURO)
})

// A ordem sai canônica, não a ordem que o cliente mandou: o destino é
// remontado a partir do que foi aceito, nunca ecoado.
test('remonta o destino em ordem canonica', () => {
  expect(destinoDeVolta('/carteira?retorno=hoje&nome=Aurora')).toBe('/carteira?nome=Aurora&retorno=hoje')
})

test('nome no limite de 120 continua valendo', () => {
  const nome = 'a'.repeat(120)
  expect(destinoDeVolta(`/carteira?nome=${nome}`)).toBe(`/carteira?nome=${nome}`)
})
