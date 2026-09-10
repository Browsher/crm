import { describe, expect, test } from 'vitest'
import { destinoCanonico, escaparLike, lerConsulta, POR_PAGINA, totalDePaginas } from './consulta'

describe('lerConsulta', () => {
  test('sem parâmetro nenhum: termo vazio, página 1', () => {
    expect(lerConsulta({})).toEqual({ termo: '', padrao: '', cnpjPrefixo: null, pagina: 1 })
  })

  test('apara o termo', () => {
    expect(lerConsulta({ q: '  sao joao  ' }).termo).toBe('sao joao')
  })

  test('corta o termo em 100 caracteres', () => {
    expect(lerConsulta({ q: 'a'.repeat(500) }).termo).toHaveLength(100)
  })

  test('parâmetro repetido: usa o primeiro', () => {
    expect(lerConsulta({ q: ['sao', 'outro'] }).termo).toBe('sao')
  })

  test('página lida do parâmetro', () => {
    expect(lerConsulta({ pagina: '3' }).pagina).toBe(3)
  })

  test.each(['0', '-2', 'abc', '2.5', ''])('página inválida (%s) vira 1', (p) => {
    expect(lerConsulta({ pagina: p }).pagina).toBe(1)
  })

  // As oito primeiras posições do CNPJ são a RAIZ: identificam a empresa. As
  // quatro seguintes são o estabelecimento (matriz 0001, filiais 0002…) e as
  // duas últimas são os dígitos verificadores. Digitar a raiz não é procurar
  // "pedaço de CNPJ": é procurar a empresa e esperar os estabelecimentos dela.
  test('CNPJ com máscara vira prefixo completo', () => {
    expect(lerConsulta({ q: '11.222.333/0001-81' }).cnpjPrefixo).toBe('11222333000181')
  })

  test('a raiz de oito dígitos vira prefixo', () => {
    expect(lerConsulta({ q: '11222333' }).cnpjPrefixo).toBe('11222333')
  })

  test('raiz com pontuação também vira prefixo', () => {
    expect(lerConsulta({ q: '11.222.333' }).cnpjPrefixo).toBe('11222333')
  })

  test('abaixo da raiz não vira prefixo: sete dígitos não identificam empresa', () => {
    expect(lerConsulta({ q: '1122233' }).cnpjPrefixo).toBeNull()
  })

  test('pedaço curto de CNPJ não vira prefixo', () => {
    expect(lerConsulta({ q: '1122' }).cnpjPrefixo).toBeNull()
  })

  test('acima de 14 não vira prefixo', () => {
    expect(lerConsulta({ q: '112223330001811' }).cnpjPrefixo).toBeNull()
  })

  test('texto com acento não vira prefixo', () => {
    expect(lerConsulta({ q: 'São João' }).cnpjPrefixo).toBeNull()
  })
})

describe('escaparLike', () => {
  // Sem isto, digitar % na busca traz a base inteira e _ casa qualquer
  // caractere — resultado que o gestor não consegue explicar.
  test('escapa % e _', () => {
    expect(escaparLike('100% _luz')).toBe('100\\% \\_luz')
  })

  // A barra primeiro, senão ela escaparia as barras que o próprio replace
  // acabou de inserir.
  test('escapa a própria barra invertida', () => {
    expect(escaparLike('a\\b')).toBe('a\\\\b')
  })

  test('texto sem metacaractere passa intacto', () => {
    expect(escaparLike('São João')).toBe('São João')
  })

  test('lerConsulta devolve o padrão já escapado', () => {
    expect(lerConsulta({ q: '100%' }).padrao).toBe('100\\%')
  })
})

// Buscar e apagar o campo deixava `?q=` pendurado na URL: o navegador manda
// todo campo com nome, vazio ou não. Não muda resultado nenhum — lerConsulta
// trata os dois igual — mas é a URL que a pessoa copia e manda para alguém.
describe('destinoCanonico', () => {
  test('sem q na URL, nada a limpar', () => {
    expect(destinoCanonico({})).toBeNull()
  })

  test('com termo de verdade, nada a limpar', () => {
    expect(destinoCanonico({ q: 'sao joao' })).toBeNull()
  })

  test('q vazio manda para a URL sem q', () => {
    expect(destinoCanonico({ q: '' })).toBe('/empresas')
  })

  test('q só com espaço também limpa', () => {
    expect(destinoCanonico({ q: '   ' })).toBe('/empresas')
  })

  test('a página sobrevive à limpeza', () => {
    expect(destinoCanonico({ q: '', pagina: '3' })).toBe('/empresas?pagina=3')
  })

  test('página 1 é o padrão e não precisa aparecer', () => {
    expect(destinoCanonico({ q: '', pagina: '1' })).toBe('/empresas')
  })

  // Sem esta linha o redirecionamento se chamaria de novo para sempre: o
  // destino não tem `q`, então precisa devolver null quando `q` está ausente.
  test('o próprio destino já é canônico', () => {
    expect(destinoCanonico({ pagina: '3' })).toBeNull()
  })
})

describe('totalDePaginas', () => {
  test('lista vazia ainda é uma página', () => {
    expect(totalDePaginas(0)).toBe(1)
  })

  test.each([
    [1, 1],
    [POR_PAGINA, 1],
    [POR_PAGINA + 1, 2],
    [POR_PAGINA * 3, 3],
  ])('%i empresas dão %i páginas', (total, paginas) => {
    expect(totalDePaginas(total)).toBe(paginas)
  })
})
