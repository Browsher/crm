// Para onde a ficha volta depois de devolver a empresa.
//
// O valor chega por input oculto do formulário, então chega do CLIENTE, e o
// servidor não pode entregá-lo ao `redirect` sem conferir: uma URL externa ali
// faz a própria aplicação levar o vendedor para fora do site, com a autoridade
// do nosso domínio. A conferência mora aqui, em função pura, e não na action,
// porque a action é `'use server'` e só exporta função.
//
// A lista fechada não é palpite: são as duas formas que o servidor de fato
// produz, `urlCarteira` em app/carteira/filtros.ts e `urlMeuDia` em
// app/meu-dia/agenda.ts. Ela é repetida aqui de propósito, e não importada
// dessas telas: quem autoriza o redirecionamento tem que ser independente de
// quem monta o link. `src/` também não importa de `app/`.
// O `| undefined` no valor não é decoração: sem ele o `tsc` considera
// `chaves` sempre presente e a guarda de rota desconhecida vira código morto
// aos olhos do tipo, embora seja ela que faz o trabalho (R-012).
const ROTAS: Record<string, readonly string[] | undefined> = {
  '/carteira': ['nome', 'uf', 'retorno'],
  '/meu-dia': ['nome', 'retorno'],
}

// Base descartável só para o parser resolver o caminho. `.invalido` é TLD
// reservado (RFC 2606), logo nunca é um host de verdade.
const BASE = 'http://interno.invalido'

// O mesmo limite que `lerFiltrosCarteira` e `lerFiltrosMeuDia` aplicam ao nome.
const LIMITE_FILTRO = 120

// Destino de recusa. `/carteira` existe para todo vendedor e não depende de a
// empresa continuar na mão dele, que é justamente o que acabou de mudar.
const SEGURO = '/carteira'

// Bloco C0 mais DEL, por ponto de código e sem escrever o caractere (R-020).
function temControle(valor: string): boolean {
  for (const caractere of valor) {
    const ponto = caractere.codePointAt(0) ?? 0
    if (ponto < 0x20 || ponto === 0x7f) return true
  }
  return false
}

// Devolve `null` quando ninguém pediu destino (a /fila não manda o campo), o
// destino remontado quando ele é previsto, e `/carteira` quando não é. Recusar
// não é deixar de redirecionar: sem redirect a tela fica numa rota que a
// devolução acabou de derrubar, que era o erro que o redirect veio consertar.
export function destinoDeVolta(bruto: string): string | null {
  if (!bruto) return null
  if (!bruto.startsWith('/')) return SEGURO

  let url: URL
  try {
    url = new URL(bruto, BASE)
  } catch {
    return SEGURO
  }

  // Pega `//host` e `/\host`, que começam com barra e mesmo assim trocam de
  // host, e qualquer protocolo próprio que o parser tenha aceitado.
  if (url.origin !== BASE) return SEGURO
  if (url.hash) return SEGURO

  const chaves = ROTAS[url.pathname]
  if (!chaves) return SEGURO

  for (const chave of url.searchParams.keys()) {
    if (!chaves.includes(chave)) return SEGURO
    if (url.searchParams.getAll(chave).length > 1) return SEGURO
  }

  // Remonta na ordem das chaves previstas, em vez de ecoar a query recebida.
  const filtros = new URLSearchParams()
  for (const chave of chaves) {
    const valor = url.searchParams.get(chave)
    // Ausente e vazio são a mesma coisa: nenhum dos dois montadores escreve a
    // chave sem valor, e `?nome=` não filtra nada.
    if (!valor) continue
    if (valor.length > LIMITE_FILTRO) return SEGURO
    if (temControle(valor)) return SEGURO
    filtros.set(chave, valor)
  }

  const query = filtros.toString()
  return query ? `${url.pathname}?${query}` : url.pathname
}
