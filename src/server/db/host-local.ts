// O harness apaga bancos e altera papéis do cluster. Papel é global, então
// rodar a suíte contra a Railway não estraga só o banco de teste: estraga o
// cluster de produção. A conferência é sobre o host da URL — o que se digita
// no .env —, e não sobre o que o Postgres enxerga: numa conexão do Windows
// para o container, o servidor vê o IP do bridge (172.18.0.1) enquanto o host
// da URL é localhost. Quem lê a URL é o cliente, e o cliente é o harness.
const LOCAIS = new Set(['localhost', '127.0.0.1', '::1'])

export class HostNaoLocal extends Error {
  constructor(host: string) {
    super(
      'a suíte só roda contra banco local — ela apaga bancos e altera papéis do cluster. ' +
        `DATABASE_URL_ADMIN aponta para ${host}.`,
    )
    this.name = 'HostNaoLocal'
  }
}

export function exigirHostLocal(url: string): void {
  let host: string
  try {
    // Medido em 2026-09-10: `hostname` devolve [::1] COM os colchetes para a
    // forma [::1] da URL. Tirar os colchetes deixa a lista com um nome só por
    // endereço.
    host = new URL(url).hostname.replace(/^\[(.*)\]$/, '$1')
  } catch {
    throw new HostNaoLocal('uma URL que não pôde ser lida')
  }
  if (!LOCAIS.has(host)) throw new HostNaoLocal(host)
}
