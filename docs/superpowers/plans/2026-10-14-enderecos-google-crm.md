# Endereços publicados no Google Maps no CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar o endereço completo publicado na coleta Google na ficha do CRM e permitir que o gestor confira e atualize os endereços das 43 empresas da Mooca pelo fluxo autenticado.

**Architecture:** Ampliar CSV/XLSX Google com duas colunas opcionais e conservar os formatos atuais. Persistir endereço/link/versão na origem Google associada ao Place ID, com confirmação versionada e funções do banco. Um componente comum mostra endereço coletado e referência por CEP com suas fontes, tanto para gestor quanto nas fichas de vendedor já autorizadas.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, PostgreSQL, Vitest 5, Playwright; parser CSV e ExcelJS já existentes. Nenhuma nova dependência de produção.

**Spec:** `docs/superpowers/specs/2026-10-14-base-prospeccao-n8n-design.md`, aprovada pelo usuário em 14/10/2026.

## Global Constraints

- Persistir a informação associada ao Place ID, com auditoria e autoridade do banco.
- A confirmação acontece no fluxo autenticado do gestor, com pode_escrever() e sem usar postgres para contornar a autorização.
- Não sobrescrever responsável, reserva, notas, histórico, vendas, telefones ou CNPJ.
- Não inventar número/complemento a partir do CEP nem decompor texto ambíguo silenciosamente.
- Endereço original e referência por CEP podem divergir sem que uma fonte seja silenciosamente apresentada como a outra.
- Código passa por branch e PR com CI verde antes da publicação.
- Regra de fronteira: features/ não importa de outra features/. Se precisar, o que é comum sobe para lib/ ou server/.
- TDD: teste falhando primeiro. Sempre.
- Não editar migrações anteriores. A próxima é 0038 na situação medida em 14/10/2026; confirmar numeração antes de criar.
- Antes de escrever código Next.js, ler a documentação pertinente em node_modules/next/dist/docs/ e consultar Context7 para API/configuração afetada.
- Manter o papel gestor/vendedor e todas as regras de senha provisória, RLS e leitura existentes.
- O banco local é usado apenas pelo harness de testes; não passa a ser requisito do site hospedado.

## Review Focus

1. Arquivos legados de 7/8/9 colunas e novo Google de 11: nenhum campo é descartado, CNPJ opcional continua restrito à identidade Google válida. Tarefa 1.
2. Endereço/link vazio, texto de controle, URL com esquema impróprio, complemento e fonte discordante do CEP: recusa clara ou conservação literal sem apagar dado existente. Tarefas 1 e 4.
3. Outra confirmação altera a origem entre preview e confirmar: pedir nova conferência; replay de operação já gravada devolve o resultado original sem nova escrita. Tarefas 2 e 3.
4. Vendedor, gestor com senha provisória e acesso direto a tabela/função: banco nega escrita e leitura não autorizada. Tarefas 2 e 4.
5. Empresa já tem vendedor, reserva, contato e venda: atualizar endereço conserva todos os dados comerciais e o CNPJ/telefone. Tarefas 2 e 5.

---

## Ordem, estado atual e limites

Executar tarefas 1 → 2 → 3 → 4 → 5. O sistema de planilha/n8n funciona independentemente deste plano. Não repetir a carga CEP já concluída: a Railway contém 1.209.313 CEPs, e as 43 empresas resolvem rua/bairro/cidade. Falta armazenar e exibir o endereço completo publicado, incluindo número/complemento.

Usar branch `codex/enderecos-google-crm`, PR contra main, sem empilhar contra branch temporária. Primeiro integrar documentos da PR #53 ou copiar apenas os planos aprovados para o worktree de execução conforme a skill; não misturar mudanças pendentes do checkout principal. Não publicar uma implementação do plano enquanto a revisão deste documento estiver pendente.

Leituras já medidas que o implementador deve reabrir: `planilha.ts`, `arquivo.ts`, `servico.ts`, `repositorio.ts`, `conferencia.ts`, `app/empresas/importar/acao.ts`, `formulario.tsx`, `relatorio.tsx`, migrações 0034/0035 e docs correspondentes. A importação atual reconhece identidade, vincula ao grupo e preenche CNPJ/razão social vazios; ela não atualiza o endereço Google. HMAC atual vincula usuário, operação, hash do arquivo e seleção. Não substituir esse fluxo por gravação administrativa direta.

## Mapa de arquivos e contratos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/endereco-google.ts` | Tipo compartilhado e validação do endereço publicado/link |
| `src/features/empresas/planilha.ts` e `arquivo.ts` | Novo formato de 11 colunas, mantendo os três formatos atuais |
| `src/server/importacao/mooca-adaptador.ts` e `scripts/importacao/mooca.mts` | Preservar endereço Maps/link ao preparar CSV do CRM |
| `db/migracoes/0038_empresa_endereco_google.sql` | Colunas, versão, funções de confirmar/ler e grants |
| `docs/db/0038.md` | Contratos SQL e motivo das escolhas; comentários de SQL só na primeira linha |
| `src/server/db/migracoes/invariantes.ts` | Admitir somente a nova função pública de leitura |
| `src/features/empresas/repositorio.ts` | Ler versão da origem e enviar confirmação de endereço |
| `src/features/empresas/servico.ts` e `conferencia.ts` | Preview detalhado, seleção autenticada e proteção contra origem alterada |
| `app/empresas/importar/relatorio.tsx` e `formulario.tsx` | Antes/depois e contagem da atualização |
| `src/server/empresas/enderecos-google.ts` | Leitura comum, com usuário atual e função autorizada |
| `src/components/crm/enderecos-empresa.tsx` | Render compartilhado das fontes |
| `app/empresas/[id]/page.tsx` | Ficha do gestor |
| `app/fila/localizar/[id]/page.tsx` | Perfil público empresarial já autorizado ao vendedor |
| `app/fila/page.tsx` e `cartao.tsx` | Atendimento com reserva válida |
| `app/carteira/[id]/page.tsx` e `ficha.tsx` | Ficha da empresa da carteira |
| `next.config.ts` | Folga de transporte para o comprovante ampliado, medida antes de escolher limite |
| `tests/integracao/enderecos-google.test.ts` | RLS, atomicidade, replay e preservação |
| `tests/e2e/enderecos-google.spec.ts` | Importação preview/confirmar e fichas no celular |

Tipos compartilhados em `src/lib/endereco-google.ts`:

```ts
export type EnderecoGoogle = { enderecoPublicado: string; linkOrigem: string }
export type OrigemEnderecoGoogle = EnderecoGoogle & { googlePlaceId: string; versao: string }
export type CadastroOrigemGoogle = {
  empresaId: string
  googlePlaceId: string
  versao: string
  enderecoPublicado: string | null
  linkOrigem: string | null
}
export type EnderecoConferido = {
  linha: number
  empresaId: string | null
  versaoAnterior: string | null
}
export type DetalheEndereco = {
  linha: number
  googlePlaceId: string
  empresaId: string | null
  anterior: EnderecoGoogle | null
  novo: EnderecoGoogle
}
```

`LinhaAceita` recebe `enderecoGoogle: EnderecoGoogle | null`. `Conferencia` recebe `enderecosConferidos: EnderecoConferido[]`. `Relatorio` recebe `enderecosPropostos: DetalheEndereco[]` e `enderecosAtualizados: number`; resultados legados ausentes normalizam para [] e 0 na borda. `Preparo` recebe `origensGoogle: Map<string, CadastroOrigemGoogle>`.

A conferência assinada carrega somente linha, identidade e versão anterior; endereço novo vem do arquivo cujo SHA-256 já integra o contexto HMAC. Endereço anterior completo pertence ao relatório de preview, não ao comprovante. Isso evita duplicar o conteúdo do arquivo no multipart. A versão é string decimal para não perder bigint do PostgreSQL em Number.

### Task 1: Contrato de endereço no CSV/XLSX

**Files:** Create `src/lib/endereco-google.ts`, `endereco-google.test.ts`. Modify `src/features/empresas/planilha.ts`, `planilha.test.ts`, `arquivo.ts`, `arquivo.test.ts`, `mensagens.ts`, `mensagens.test.ts`, `src/server/importacao/mooca-adaptador.ts`, `mooca-adaptador.test.ts`, `scripts/importacao/mooca.mts`.

**Interfaces:** Consumes `CABECALHO_GOOGLE` e `analisarLinhas` atuais. Produces `CABECALHO_GOOGLE_ENDERECO = CABECALHO_GOOGLE + ',endereco_publicado,link_origem'` e `validarEnderecoGoogle(endereco: string, link: string): { ok: true; valor: EnderecoGoogle | null } | { ok: false; motivo: 'endereco_google_invalido' | 'link_origem_invalido' }`.

- [ ] **Step 1: Escrever testes falhando.**

```ts
test('preserva número e complemento no formato Google estendido', () => {
  const texto = CABECALHO_GOOGLE_ENDERECO + '\n' +
    ',,Empresa fictícia,,1126061244,,03123000,,place-cenario,"Rua do cenário, 12, sala 4",https://maps.google.com/\n'
  const r = analisarPlanilha(new TextEncoder().encode(texto))
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error(r.falha.motivo)
  expect(r.aceitas[0].enderecoGoogle).toEqual({
    enderecoPublicado: 'Rua do cenário, 12, sala 4', linkOrigem: 'https://maps.google.com/'
  })
})
test('URL que executa script não entra no endereço', () => {
  expect(validarEnderecoGoogle('Rua do cenário, 12', 'javascript:alert(1)'))
    .toEqual({ ok: false, motivo: 'link_origem_invalido' })
})
```

Testar CSV legado 7, padrão 8, Google 9, Google 11, colunas a mais/a menos, ambas novas vazias, apenas uma preenchida, NUL/controles, aspas, acentos e XLSX com fórmula. Nenhum arquivo de 7/8 passa a aceitar CNPJ vazio. O limite atual de 5.000 linhas e 1.500.000 bytes permanece; medir um arquivo novo perto do limite para a etapa de transporte.

- [ ] **Step 2:** Run `npm run test:unit -- src/lib/endereco-google.test.ts src/features/empresas/planilha.test.ts src/features/empresas/arquivo.test.ts src/server/importacao/mooca-adaptador.test.ts`; esperado falhar pelo novo contrato.
- [ ] **Step 3: Implementar validação e cabeçalho.**

```ts
export function validarEnderecoGoogle(endereco: string, link: string) {
  const texto = endereco.trim()
  const origem = link.trim()
  if (!texto && !origem) return { ok: true as const, valor: null }
  if (!texto || [...texto].length > 1000 || /[\u0000-\u001f\u007f-\u009f]/u.test(texto)) {
    return { ok: false as const, motivo: 'endereco_google_invalido' as const }
  }
  try {
    const url = new URL(origem)
    if (url.protocol !== 'https:' || url.username || url.password || [...origem].length > 2000) {
      return { ok: false as const, motivo: 'link_origem_invalido' as const }
    }
  } catch {
    return { ok: false as const, motivo: 'link_origem_invalido' as const }
  }
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(origem)) {
    return { ok: false as const, motivo: 'link_origem_invalido' as const }
  }
  return { ok: true as const, valor: { enderecoPublicado: texto, linkOrigem: origem } }
}
```

Exigir Place ID quando endereço Google não nulo. Ampliar união de número de colunas para 7|8|9|11 e reconhecimento em CSV e XLSX; manter o guard estrutural de XLSX (11 continua abaixo das 16 células permitidas). Novos campos participam da detecção de duplicata divergente. O adaptador Mooca recebe `endereco_maps` e `link_maps` e os exporta como endereço publicado/link da mesma fonte; conserva `endereco`, `endereco_site` e situação no rastreio original. Não rotular endereço do site como se fosse publicado no Maps. A CLI passa os campos adicionais ao adaptador e usa o parser real ampliado para conferir saída.

- [ ] **Step 4:** Run comando da Step 2, testes de mensagens e `npm run typecheck`; esperado verde. Preparar CSV real em uma pasta nova, conferir 43 linhas aceitas, sem recriar/importar empresas nesta etapa.
- [ ] **Step 5:** `git add src/lib/endereco-google.ts src/lib/endereco-google.test.ts src/features/empresas/planilha.ts src/features/empresas/planilha.test.ts src/features/empresas/arquivo.ts src/features/empresas/arquivo.test.ts src/features/empresas/mensagens.ts src/features/empresas/mensagens.test.ts src/server/importacao/mooca-adaptador.ts src/server/importacao/mooca-adaptador.test.ts scripts/importacao/mooca.mts`; `git commit -m "feat: endereco publicado no contrato de importacao Google"`.

### Task 2: Persistência, autoridade e replay no banco

**Files:** Create `db/migracoes/0038_empresa_endereco_google.sql`, `docs/db/0038.md`, `tests/integracao/enderecos-google.test.ts`. Modify `src/server/db/migracoes/invariantes.ts`, `invariantes.test.ts`.

**Interfaces:** Consumes tipos da Tarefa 1 e confirmação de endereço da Tarefa 3. Produces overload SQL
`grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb)`, preservando a assinatura de sete argumentos como wrapper compatível, e `empresa_enderecos_google(uuid)` para leitura autorizada.

O oitavo argumento é array de objetos com chaves fechadas:
`{ linha, google_place_id, empresa_id, versao_anterior, endereco_publicado, link_origem }`.
`empresa_id` e `versao_anterior` podem ser null; todos os demais são obrigatórios. Cada item aponta a uma única linha selecionada e Place ID do payload cadastral; nenhuma origem estranha pode ser atualizada. A resposta continua `grupo_id,inseridas,vinculadas,relatorio`.

- [ ] **Step 1: Escrever teste de integração falhando, usando o harness existente.**

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
let banco: BancoDeTeste
let gestor: string
let vendedor: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'EnderecoGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'EnderecoVendedor')
})
afterAll(async () => { await banco?.derrubar() })
test('vendedor não confirma endereço pela função pública', async () => {
  await expect(banco.comoUsuario(vendedor, e => e(
    'SELECT * FROM grupo_importacao_confirmar($1,$2,$3,$4,$5,$6,$7,$8)',
    [randomUUID(), 'Cenário', 'cenario.csv', 'a'.repeat(64),
      '[]', '{}', JSON.stringify({ descricao: 'Cenário', origem: 'Google Maps', criterios: null }), '[]']
  ))).rejects.toMatchObject({ code: '42501' })
})
```

Adicionar teste de gestor definitivo positivo, gestor provisório negado, DML direto negado, constraints de endereço/link, origem de outra empresa, identidade conflitante, Place ID ausente, lado antigo de endereço alterado, replay idêntico, replay divergente e rollback de um lote parcialmente válido. O teste principal prepara empresa com CNPJ/telefone, fila, reserva, contato e venda via fixtures já existentes; confirma endereço e compara antes/depois de cada tabela, permitindo só origem/auditoria e vínculo de grupo da operação. Não executar harness contra Railway.

- [ ] **Step 2:** Run `npm run test:integracao -- tests/integracao/enderecos-google.test.ts`; esperado falhar porque overload e colunas não existem.
- [ ] **Step 3: Criar migração aditiva e ampliar a confirmação.**

```sql
ALTER TABLE empresa_origem_google
  ADD COLUMN endereco_publicado text,
  ADD COLUMN link_origem text,
  ADD COLUMN endereco_versao bigint NOT NULL DEFAULT 0 CHECK (endereco_versao >= 0),
  ADD CONSTRAINT empresa_origem_google_endereco_par CHECK (
    (endereco_publicado IS NULL AND link_origem IS NULL)
    OR (endereco_publicado IS NOT NULL AND link_origem IS NOT NULL
      AND endereco_publicado = btrim(endereco_publicado)
      AND length(endereco_publicado) BETWEEN 1 AND 1000
      AND endereco_publicado !~ '[[:cntrl:]]'
      AND link_origem = btrim(link_origem)
      AND length(link_origem) BETWEEN 1 AND 2000
      AND link_origem ~ '^https://[^[:space:]]+$'
      AND link_origem !~ '[[:cntrl:]]')
  );
```

Incluir recusa C1 e userinfo URL na função SQL, com paridade do validador; testes de TypeScript e SQL usam os mesmos casos. Não adicionar UPDATE/INSERT grants da tabela a app_usuario. O trigger de auditoria da 0034 já existe e permanece.

Implementar overload de oito argumentos a partir da função vigente da 0035, preservando: guarda gestor/pode_escrever antes e depois do advisory lock, validação de metadados/linhas, conflito de identificadores, transação única, pedido persistido e replay. Acrescentar validação fechada do array de endereços, duplicatas de linha/Place ID, comprimentos e versão decimal. Pedido com array vazio conserva o formato histórico, sem acrescentar chave nova, para replay das operações antigas continuar válido. Array não vazio integra o pedido e a comparação de replay.

Replay persistido é verificado antes de comparar versão atual. Para uma operação nova, bloquear a empresa e a origem e comparar identidade/versão aprovadas. Mudança de identidade ou versão exige nova conferência, SQLSTATE 22023. Com endereço aprovado para empresa existente, pular o preenchimento cadastral de CNPJ/razão social: esta linha só atualiza endereço/link. As linhas sem endereço continuam no comportamento anterior.

```sql
SELECT o.endereco_versao::text INTO v_versao
  FROM public.empresa_origem_google o
  WHERE o.google_place_id = v_endereco->>'google_place_id' FOR UPDATE;
IF v_versao IS DISTINCT FROM (v_endereco->>'versao_anterior') THEN
  RAISE EXCEPTION 'endereco mudou desde a conferencia' USING ERRCODE = '22023';
END IF;
UPDATE public.empresa_origem_google
  SET endereco_publicado = v_endereco->>'endereco_publicado',
      link_origem = v_endereco->>'link_origem',
      endereco_versao = endereco_versao + 1
  WHERE google_place_id = v_endereco->>'google_place_id'
    AND (endereco_publicado,link_origem)
      IS DISTINCT FROM (v_endereco->>'endereco_publicado',v_endereco->>'link_origem');
```

Conferir versão antes de inserir uma origem ausente (versão esperada null); origem já existente sem endereço tem versão "0". Associar a origem nova somente após identidade revalidada. Não executar o snippet de comparação depois de inserir e transformar null em 0. Registrar contagem pelo ROW_COUNT, incrementar apenas em mudança efetiva e persistir o relatório do primeiro commit. Wrapper de sete argumentos invoca overload com array vazio; não destrói replay histórico.

Leitura pública retorna somente origens com par endereço/link não nulo: `google_place_id,endereco_publicado,link_origem,endereco_versao::text`, ordenado por Place ID. O preparo da importação continua lendo todas as origens, inclusive endereço nulo com versão zero, pelo acesso de gestor já existente. Exige pode_ler(); gestor pode consultar cadastro, vendedor só origens de empresa que a função vigente empresa_perfil(uuid) devolve. Não ampliar RLS da tabela origem para leitura irrestrita. `SECURITY DEFINER SET search_path = ''`, nomes public qualificados, REVOKE PUBLIC e GRANT apenas app_usuario. Invariantes autorizam `public.empresa_enderecos_google`; a função confirmar já pertence à lista, sem liberar helpers novos. Primeira linha do SQL referencia `docs/db/0038.md`; explicação completa fica nesse documento.

- [ ] **Step 4:** Run comando da Step 2, `npm run test:integracao -- tests/integracao/grupos-importacao.test.ts tests/integracao/grupos-importacao-migracao.test.ts`, `npm run test:unit -- src/server/db/migracoes/invariantes.test.ts` e `npm run db:checar`; esperado verde e migrações antigas inalteradas.
- [ ] **Step 5:** `git add db/migracoes/0038_empresa_endereco_google.sql docs/db/0038.md tests/integracao/enderecos-google.test.ts src/server/db/migracoes/invariantes.ts src/server/db/migracoes/invariantes.test.ts`; `git commit -m "feat: persistencia autorizada dos enderecos Google"`.

### Task 3: Preview de endereço e confirmação autenticada

**Files:** Modify `src/features/empresas/repositorio.ts`, `servico.ts`, `servico.test.ts`, `conferencia.ts`, `conferencia.test.ts`, `app/empresas/importar/acao.ts`, `acao.test.tsx`, `next.config.ts`, `app/empresas/importar/formulario-transporte.test.tsx`.

**Interfaces:** Consumes `EnderecoConferido`, `DetalheEndereco` e overload SQL da Tarefa 2. Produces extensão de `RepositorioEmpresas.gravar(operacao: OperacaoGrupo, linhas: LinhaAceita[], relatorio: Relatorio, enderecos: EnderecoConferido[]): Promise<ConfirmacaoGrupo | Falha>`; `analisar`/`importar` mantêm seus nomes e argumentos públicos, com os tipos ampliados.

- [ ] **Step 1: Escrever testes falhando.**

```ts
test('comprovante vincula versão da origem e não permite alterar a seleção', () => {
  const env = { IMPORTACAO_CONFERENCIA_SEGREDO: 'a'.repeat(64) }
  const contexto = {
    usuarioId: '00000000-0000-4000-8000-000000000001',
    operacao: { chave: '00000000-0000-4000-8000-000000000002', nome: 'Mooca', arquivoNome: 'cenario.csv',
      assinatura: 'b'.repeat(64), metadados: { descricao: 'Cenário', origem: 'Google Maps', criterios: null } }
  }
  const conferencia = {
    linhasAceitas: [2], recusadasIdentidade: [],
    enderecosConferidos: [{ linha: 2, empresaId: '00000000-0000-4000-8000-000000000003', versaoAnterior: '0' }]
  }
  const token = emitirConferencia(contexto, conferencia, env)
  expect(verificarConferencia(token, contexto, env)).toEqual(conferencia)
})
```

Testar alteração do arquivo/usuário/metadados/versão, versão enorme inválida, linha repetida, endereço fora da seleção, envio de endereço pelo form fora do arquivo, input desconhecido no token e ausência do segredo. Testes de serviço: preview não grava, existente com endereço diferente entra no relatório, SQL recebe somente seleção assinada e versão anterior; retry mantém versão original apesar do novo preview interno.

- [ ] **Step 2:** Run `npm run test:unit -- src/features/empresas/conferencia.test.ts src/features/empresas/servico.test.ts app/empresas/importar/acao.test.tsx`; esperado falhar no contrato.
- [ ] **Step 3: Ampliar preparo e comprovante.**

```ts
const detalhe: DetalheEndereco = {
  linha: linha.linha,
  googlePlaceId: linha.googlePlaceId!,
  empresaId: identidade.empresaId,
  anterior: origem?.enderecoPublicado && origem.linkOrigem ? {
    enderecoPublicado: origem.enderecoPublicado, linkOrigem: origem.linkOrigem
  } : null,
  novo: linha.enderecoGoogle!
}
const conferido: EnderecoConferido = {
  linha: linha.linha,
  empresaId: identidade.empresaId,
  versaoAnterior: origem?.versao ?? null
}
```

O preparo lê empresa/origem e versão na transação atual; emitir token versão 2, validando esquema fechado e índices da seleção. Tokens versão 1 em andamento pedem nova conferência com mensagem recuperável, sem escrever. Nunca confiar em contador ou versão enviados por campos livres do formulário. Repositório monta o oitavo JSON a partir de linhas do arquivo aprovado e `enderecosConferidos`; liga todos os itens aos respectivos índices. SQL recebe versões originais do token, não versões da reanálise. Contagem real de atualizações vem do retorno persistido SQL, não do preview.

`Relatorio` conserva contadores de empresa/CEP e ganha antes/depois; `ResultadoImportar` conserva a discriminação ok e inclui contagem por relatório. Não exportar constante de um arquivo "use server"; reabrir o molde `app/usuarios/acoes.ts` e a Action existente antes de alterar.

Medir bytes do token de 5.000 itens com versão, identidade e seleção, somados ao arquivo permitido e overhead multipart. Fixar limite máximo do comprovante em 2.000.000 caracteres e transporte em 4mb somente se a medição do pior caso válido couber; recusar comprimento maior antes do decode/HMAC. Não duplicar o endereço no token. Guard de transporte tem teste com arquivo de 11 colunas próximo a 1,5 MB e token válido; verificar envio na Vercel antes de afirmar cobertura online.

- [ ] **Step 4:** Run testes da Step 2, `npm run test:unit -- app/empresas/importar/formulario-transporte.test.tsx` e `npm run typecheck`; esperado verde. Verificar que todos os doubles de RepositorioEmpresas/Relatorio ganharam valores explícitos, sem ocultar erro com cast ou propriedades opcionais espalhadas.
- [ ] **Step 5:** `git add src/features/empresas/repositorio.ts src/features/empresas/servico.ts src/features/empresas/servico.test.ts src/features/empresas/conferencia.ts src/features/empresas/conferencia.test.ts app/empresas/importar/acao.ts app/empresas/importar/acao.test.tsx next.config.ts app/empresas/importar/formulario-transporte.test.tsx`; `git commit -m "feat: conferencia autenticada da atualizacao de enderecos"`.

### Task 4: Exibir origem e endereço nas fichas

**Files:** Create `src/server/empresas/enderecos-google.ts`, `src/components/crm/enderecos-empresa.tsx`, `enderecos-empresa.test.tsx`. Modify `app/empresas/importar/relatorio.tsx`, `relatorio.test.tsx`, `formulario.tsx`, `formulario.test.tsx`, `formulario.dom.test.tsx`, `app/empresas/[id]/page.tsx`, `app/fila/localizar/[id]/page.tsx`, `app/fila/page.tsx`, `app/fila/cartao.tsx`, `cartao.test.tsx`, `app/carteira/[id]/page.tsx`, `ficha.tsx`, `ficha.test.tsx`, `tests/integracao/enderecos-google.test.ts`. Se for necessário CSS, modificar apenas o módulo da página já existente; evitar redesign.

**Interfaces:** Consumes função SQL `empresa_enderecos_google(uuid)`. Produces
`lerEnderecosGoogle(usuarioId: string, empresaId: string): Promise<OrigemEnderecoGoogle[]>` em server, e
`EnderecosEmpresa({ publicados, referenciaPostal }: { publicados: OrigemEnderecoGoogle[]; referenciaPostal: string }): ReactNode`.
Erro 42501 não vira lista vazia silenciosa: usar a guarda da página e propagar falha de leitura com mensagem recuperável sem expor dados.

- [ ] **Step 1: Escrever teste de render falhando.**

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
test('mostra endereço coletado e referência postal discordante com suas fontes', () => {
  const html = renderToStaticMarkup(<EnderecosEmpresa
    publicados={[{ googlePlaceId: 'p1', versao: '1',
      enderecoPublicado: 'Rua do cenário, 12, sala 4', linkOrigem: 'https://maps.google.com/' }]}
    referenciaPostal="Rua da base postal, Outro bairro, São Paulo/SP" />)
  expect(html).toContain('Rua do cenário, 12, sala 4')
  expect(html).toContain('Endereço publicado')
  expect(html).toContain('Referência por CEP')
  expect(html).toContain('Rua da base postal')
})
```

Adicionar sem origem (mantém fallback CEP atual), várias origens sem escolher uma silenciosamente, URL/texto escapados e comprimento que não estoura tela em 390px. Preview lista antes/depois das linhas existentes e diz quais dados serão preservados; depois de confirmar, mostra contagem SQL real. Integração da leitura cobre gestor, vendedor com perfil elegível, usuário sem pode_ler e empresa que empresa_perfil não devolve; impedir leitura através de UUID fora do universo permitido.

- [ ] **Step 2:** Run `npm run test:unit -- src/components/crm/enderecos-empresa.test.tsx app/empresas/importar/relatorio.test.tsx`; esperado módulo/campos ausentes.
- [ ] **Step 3: Implementar leitura comum e componente.**

```tsx
export function EnderecosEmpresa({ publicados, referenciaPostal }: {
  publicados: OrigemEnderecoGoogle[]
  referenciaPostal: string
}) {
  return <section aria-label="Endereços da empresa">
    {publicados.map(p => <div key={p.googlePlaceId}>
      <p><strong>Endereço publicado:</strong> {p.enderecoPublicado}</p>
      <a href={p.linkOrigem} target="_blank" rel="noopener noreferrer">Ver origem do endereço</a>
    </div>)}
    <p><strong>Referência por CEP:</strong> {referenciaPostal}</p>
  </section>
}
```

A leitura chama `comoUsuario(usuarioId, executar => executar('SELECT * FROM empresa_enderecos_google($1::uuid)', [empresaId]))` e converte nomes SQL para os tipos comuns. Não fazer consulta direta como administrador. O componente não busca URL externa, não interpreta HTML e não inventa geocódigo. Referência postal usa os fallbacks atuais, com rótulo explícito.

Gestor consulta após exigir('gestor') e existência de perfil. Perfil do vendedor consulta após exigir('vendedor') e `lerPerfil` permitido. Carteira consulta depois de encontrar a empresa em `r.carteira`; atendimento consulta somente para reserva válida. Passar `publicados` como nova prop de Cartao/Ficha, definida com default [] para renders existentes; não importar de features/empresas dentro de features/fila/prospeccao. Reabrir cada arquivo irmão antes da edição, particularmente `app/fila/cartao.tsx`, `app/carteira/[id]/ficha.tsx` e `app/empresas/importar/formulario.tsx`, incluindo os comentários de efeitos e drafts.

Na conferência, mostrar "Endereços publicados a atualizar", antes/depois e texto: "A confirmação atualiza somente o endereço publicado e a origem das empresas já cadastradas com endereço nesta lista." Preservar descrição dos efeitos cadastrais para linhas legadas sem endereço. Confirmar não vira automático; manter arquivo, seleção e senha provisória bloqueando escrita.

- [ ] **Step 4:** Run comando da Step 2, testes unitários dos componentes alterados, integração de endereços e `npm run typecheck`. Executar a checklist React da skill aplicável após múltiplos TSX e corrigir qualquer leitura duplicada, importação de feature ou efeito desnecessário.
- [ ] **Step 5:** Stage somente os arquivos enumerados desta tarefa e qualquer double ajustado pela mudança, conferindo `git diff --cached --stat`; `git commit -m "feat: fontes de endereco nas fichas e na conferencia"`.

### Task 5: Testar fluxo completo, publicar e preparar atualização real

**Files:** Create `tests/e2e/enderecos-google.spec.ts`, `docs/operacao/enderecos-google.md`. Modify fixtures existentes somente se o harness exigir. Evidências e CSV reais em `outputs/mooca-enderecos-2026-10-14/`, não versionados.

**Interfaces:** Consumes CSV Google de 11 colunas, Action e fichas da Tarefa 4. Produces fluxo publicado e CSV real conferível pelo gestor; nenhuma nova API administrativa de backfill.

- [ ] **Step 1: Escrever E2E antes de implementar qualquer ajuste restante.**

```ts
test('gestor confere endereço e só grava depois da confirmação', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.goto('/empresas/importar')
  await page.getByLabel('Nome do grupo').fill('Cenário de endereço')
  await page.getByLabel('Resumo da lista').fill('Empresa fictícia para teste')
  await page.getByLabel('Origem dos dados').fill('Google Maps')
  const csv = CABECALHO_GOOGLE_ENDERECO + '\n' +
    ',,Cenário endereço,,1126061244,,03123000,,place-e2e,"Rua do cenário, 12, sala 4",https://maps.google.com/\n'
  await page.locator('input[type=file]').setInputFiles({
    name: 'cenario.csv', mimeType: 'text/csv', buffer: Buffer.from(csv)
  })
  await page.getByRole('button', { name: 'Conferir arquivo' }).click()
  await expect(page.getByText('Rua do cenário, 12, sala 4', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar importação' }).click()
})
```

Nomes dos botões foram conferidos em `app/empresas/importar/formulario.tsx`: Conferir arquivo e Confirmar importação. Completar assertions por leitura do banco de teste: preview não altera origem, confirmar altera uma origem, repetir a operação não altera de novo, grupo/link aparecem. Segundo cenário parte de empresa existente com responsável/contatos/venda, usa novo grupo de endereço e confirma que número de empresas não cresce e tabelas comerciais permanecem iguais. Fichas de gestor/vendedor mostram endereço e CEP em 390 e 1280px, temas claro/escuro, sem overflow; vendedor e gestor provisório não importam. Usar guarda `exigirAdminLocal` para qualquer fixture SQL.

- [ ] **Step 2:** Run `npm run build:e2e` e `npm run test:e2e -- --sem-build` no harness local. Se falhar, identificar o caso antes de qualquer correção; não alterar autorização para fazer teste passar.
- [ ] **Step 3: Corrigir somente divergências observadas, mantendo os contratos anteriores.**

```ts
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'
async function lerEmpresaDoCenario(empresaId: string) {
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('Execute pelo harness de E2E local')
  exigirAdminLocal(url)
  return comAdmin(url, async cliente => {
    const r = await cliente.query('SELECT cnpj,telefone FROM empresa WHERE id=$1', [empresaId])
    return r.rows
  })
}
const antes = await lerEmpresaDoCenario(empresaId)
// Depois da confirmação pelo usuário de teste:
const depois = await lerEmpresaDoCenario(empresaId)
expect(depois).toEqual(antes)
```

Cada correção nova nasce de teste falhando. Não introduzir update de empresa, script postgres de negócio ou sessão fabricada. Preparar arquivo real usando as fontes preservadas e o adaptador da Tarefa 1; nome sugerido `empresas-mooca-com-enderecos.csv`. Conferir que as 43 identidades/telefones/CEPs correspondem ao CSV já importado e que todo endereço/link deriva da mesma fonte Maps. Guardar metadados do grupo e relatório de preparação. Nenhum número de casa é inferido da base CEP.

- [ ] **Step 4:** Run `npm run test:unit`, `npm run test:integracao`, `npm run typecheck`, `npm run lint`, `npm run db:checar` e E2E já construído se não houve mudança após o build. Se mudou código, rebuild antes de repetir os E2E. Review final da branch, PR contra main e CI verde. Antes de deploy, ler skills de deploy/env/CLI Vercel já aplicáveis; preservar Hobby, projeto crm-prospeccao, runtime app_conexao, TLS e ambientes privados. Aplicar apenas migração nova na Railway usando o operador existente com verificação de versão/hash; isso é DDL, não atualização de cadastros. Publicar código após migração aditiva e checar compatibilidade da versão anterior durante a troca.
- [ ] **Step 5:** `git add tests/e2e/enderecos-google.spec.ts docs/operacao/enderecos-google.md`; `git commit -m "test: fluxo completo de enderecos Google no CRM"`. Push, anexar PR ao chat, integrar conforme autorizações da sessão e registrar verificação do deploy. Abrir /empresas/importar no CRM com o arquivo preparado. A senha definitiva do usuário não é conhecida pelo agente: o gestor autenticado confere e confirma. Se o navegador autenticado não estiver disponível, entregar arquivo e instrução curta para esse clique; não declarar os 43 endereços atualizados antes dele. Ler depois contagem e campos, conservando identificadores e dados comerciais.

## Aceite final e recuperação

A feature publicada precisa demonstrar os quatro formatos suportados, endereço/link associados ao Place ID, auditoria/versão, preview antes/depois, reexecução e RLS. Endereço de uma fonte não apaga referência postal. Mesma empresa com duas origens exibe ambas.

Depois da confirmação real, os 43 cadastros permanecem 43; quantidade real de origens atualizadas vem do relatório SQL e da leitura posterior, sem inventar agregado. A nova origem continua auditada pelo usuário que confirmou. Compartilhamentos/vendedores/reservas e histórico não mudam.

Migração é aditiva e mantém wrapper antigo para rollback do código. Não apagar colunas ou reverter dados reais automaticamente; se houver problema, recuperar versão anterior do site e preservar registros/origens para diagnóstico. JSON do workflow n8n e a planilha permanecem independentes da publicação do CRM.

## Revisão do plano

Cobertura: contrato/compatibilidade na Tarefa 1; persistência/guarda/replay na 2; preview/HMAC/transporte na 3; exibição/fonte/leitura autorizada na 4; operação real/publicação na 5. Cinco Review Focus estão associados a testes explícitos. Nenhuma etapa exige apagar cadastro real ou escrever como postgres em nome do gestor. Plano e spec viajam juntos; código só começa depois da revisão do usuário e escolha do método de execução.
