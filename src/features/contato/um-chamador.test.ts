import { globSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Duas telas registram contato — /fila e /carteira/[id] — e as duas devem
// passar pela MESMA action e pelo MESMO repositório. Esta catraca pega o caso
// concreto: uma segunda tela chamando o banco por conta própria.
//
// LIMITE DECLARADO: não pega duas actions IMPORTANDO o mesmo repositório e
// validando cada uma do seu jeito. Aí `contato_registrar` continua num arquivo
// só e a regra está em dois. Não há catraca boa para isso — exigiria contar
// chamadores de uma função de domínio, e o tsc não expõe isso sem ferramenta
// nova. A defesa é `regras.ts` ser função pura testada. Isso é BILHETE, e está
// rotulado como bilhete de propósito: bilhete com aparência de catraca ocupa o
// lugar da proteção real (R-013).
const ARQUIVOS = [...globSync('src/**/*.ts'), ...globSync('app/**/*.{ts,tsx}')]
  .map((caminho) => caminho.replaceAll('\\', '/'))
  .filter((caminho) => !caminho.includes('.test.'))

// `SELECT contato_registrar(`, não o nome solto. O nome solto tem acertos
// legítimos que não são chamada — a lista de FUNCOES_CONCEDIDAS_A_APP_USUARIO
// em invariantes.ts precisa nomeá-la, e comentários a citam. Procurar a
// CHAMADA em vez do NOME é o que separa "quem executa" de "quem menciona".
const CHAMADA = 'SELECT contato_registrar('

const COM_LITERAL = ARQUIVOS.filter((c) => readFileSync(c, 'utf8').includes(CHAMADA))

describe('contato_registrar tem um chamador só', () => {
  // Sem este, renomear a função deixa a catraca verde vigiando zero arquivos.
  // Mesma lição da lista de políticas irrestritas que a `cep` deixou vazia.
  test('existe pelo menos um arquivo com o literal, senão esta catraca não vigia nada', () => {
    expect(COM_LITERAL.length).toBeGreaterThan(0)
  })

  test('o literal aparece em exatamente um arquivo fora de tests/', () => {
    expect(COM_LITERAL).toEqual(['src/features/contato/repositorio.ts'])
  })
})

// A regra de validação mora em regras.ts, função pura, e a action só a chama.
// Se alguém copiar a validação para dentro da action, este teste não pega — é
// o LIMITE declarado acima. O que ele pega é a action deixar de usar a regra,
// que é a metade automatizável.
test('a action importa a regra pura em vez de validar por conta propria', () => {
  const fonte = readFileSync('src/features/contato/acao.ts', 'utf8')
  expect(fonte).toContain("from './regras'")
})

// Achado da verificação manual: devolver pela ficha mostrava erro E funcionava.
// A ação dava certo, e em seguida a revalidação de /carteira/[id] renderizava
// uma página cuja empresa já não está na carteira — `notFound()`. A tela
// raciocinava sobre o estado anterior à ação: depois de devolver, a rota da
// ficha deixa de existir para aquele vendedor, e o lugar para onde ir é a
// carteira.
test('a action redireciona quando o desfecho tira a empresa da mao do vendedor', () => {
  const fonte = readFileSync('src/features/contato/acao.ts', 'utf8')
  expect(fonte).toContain("from 'next/navigation'")
  expect(fonte).toContain('redirect(')
})

test('a ficha diz para onde voltar depois de devolver', () => {
  const fonte = readFileSync('app/carteira/[id]/ficha.tsx', 'utf8')
  expect(fonte).toContain('voltarPara')
})

// O destino do redirecionamento chega do cliente, por input oculto. A regra
// de "que destino é aceitável" mora em destino.ts, função pura, pelo mesmo
// motivo de regras.ts: arquivo 'use server' só exporta função, e validação
// copiada para dentro da action deixa de ser testável sozinha.
test('a action confere o destino do redirecionamento em vez de confiar no formulario', () => {
  const fonte = readFileSync('src/features/contato/acao.ts', 'utf8')
  expect(fonte).toContain("from './destino'")
  expect(fonte).toContain('destinoDeVolta(')
})
