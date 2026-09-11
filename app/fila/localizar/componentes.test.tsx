import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
vi.mock('next/navigation', () => ({useRouter: () => ({push: () => {}})}))
import { Formulario } from './formulario'
import { Reservar } from './reservar'
import { Resultados } from './resultados'
import { Paginacao } from './paginacao'
import { urlConsulta } from './navegacao'

const filtros = { nome: 'Luz & Cia', cnae: '4742300', uf: 'SP', cidade: '3550308', bairro: 'Centro', pagina: 2 }

test('formulário tem nome e seletores com rótulos e valores atuais', () => {
  const html = renderToStaticMarkup(<Formulario filtros={filtros} opcoes={[
    { tipo: 'cnae', valor: '4742300', rotulo: '4742300' },
    { tipo: 'uf', valor: 'SP', rotulo: 'SP' },
    { tipo: 'cidade', valor: '3550308', rotulo: 'São Paulo' },
    { tipo: 'bairro', valor: 'Centro', rotulo: 'Centro' },
  ]} />)
  for (const label of ['Nome', 'CNAE', 'Estado', 'Cidade', 'Bairro']) expect(html).toContain(label)
  expect(html.match(/<select /g)).toHaveLength(4)
  expect(html).toContain('name="nome"')
  expect(html).toContain('Luz &amp; Cia')
  expect(html).toMatch(/<option(?=[^>]*value="3550308")(?=[^>]*selected="")[^>]*>/)
  expect(html).not.toContain('name="pagina"')
  expect(html).toContain('data-slot="input"')
  expect(html.match(/data-slot="native-select"/g)).toHaveLength(4)
  expect(html).toContain('data-slot="button"')
})

test('seletores dependentes ficam desabilitados sem seus pais', () => {
  const html = renderToStaticMarkup(<Formulario filtros={{ ...filtros, uf: null, cidade: null, bairro: null }} opcoes={[]} />)
  expect(html.match(/disabled=""/g)).toHaveLength(2)
})

test('filtro de URL antiga ausente nas opções continua visível e selecionado', () => {
  const html = renderToStaticMarkup(<Formulario filtros={filtros} opcoes={[]} />)
  expect(html).toContain('Sem correspondência: 4742300')
  expect(html).toMatch(/<option(?=[^>]*value="4742300")(?=[^>]*selected="")[^>]*>/)
})

test('resultado de empresa alheia só contém cadastro resumido e estado separado', () => {
  const html = renderToStaticMarkup(<Resultados empresas={[{
    id: 'empresa', razaoSocial: 'Empresa de teste', nomeFantasia: null,
    cnaePrincipal: null, cidade: null, uf: null, bairro: null,
    disponibilidade: 'outro_vendedor',
    ...{ telefone: '11999998888', email: 'privado@teste.local', contatoNome: 'Contato privado' },
  }]} />)
  expect(html).toContain('Indisponível')
  expect(html).toContain('Com outro vendedor')
  expect(html).toContain('Não informado')
  for (const privado of ['11999998888', 'privado@teste.local', 'Contato privado', '—']) expect(html).not.toContain(privado)
  expect(html).not.toContain('<button')
  expect(html).toContain('data-slot="card-footer"')
})

test('ação automática usa puxar sem empresa e preserva os filtros', () => {
  const html = renderToStaticMarkup(<Reservar empresaId={null} contexto="00000000-0000-4000-8000-000000000002" filtros={filtros} empresaAtual={null} />)
  expect(html).toContain('Buscar cliente')
  expect(html).toMatch(/<button(?=[^>]*name="acao")(?=[^>]*value="puxar")[^>]*>/)
  expect(html).not.toContain('name="empresaId"')
  expect(html).toContain('name="nome" value="Luz &amp; Cia"')
})

test('resultado vazio informa ausência', () => {
  expect(renderToStaticMarkup(<Resultados empresas={[]} />)).toContain('Nenhuma empresa encontrada')
})

test('paginação preserva filtros e oferece retorno mesmo em página vazia', () => {
  const html = renderToStaticMarkup(<Paginacao filtros={filtros} temProxima={false} />)
  expect(html).toContain('Anterior')
  expect(html).not.toContain('Próxima página')
  expect(html).toContain('cnae=4742300')
  expect(html).toContain('cidade=3550308')
  expect(html).toContain('pagina=1')
})

test('URL usa codificação segura e mudança de filtro volta para página um', () => {
  const url = new URL(urlConsulta({ ...filtros, nome: 'A&B #1' }, 1), 'http://localhost')
  expect(url.searchParams.get('nome')).toBe('A&B #1')
  expect(url.searchParams.get('pagina')).toBe('1')
})
