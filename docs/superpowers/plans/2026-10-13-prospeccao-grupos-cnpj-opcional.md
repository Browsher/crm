# Grupos na Prospecção e cadastro com CNPJ opcional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir importar empresas identificadas pelo Google Place ID, sem inventar CNPJ ou razão social, e permitir ao vendedor entender e prospectar uma lista específica.

**Architecture:** Preservar o UUID da tabela `empresa` e os vínculos existentes com contatos, carteira e vendas. Acrescentar uma associação de identidade de origem e contexto comercial em `grupo_importacao`; o banco controla identificação, autorização e reserva por grupo. Leituras compartilhadas ficam em `server/` e apresentação comum em `lib/`, mantendo as páginas atuais `/fila` e `/fila/localizar`.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript, Tailwind, PostgreSQL, `pg`, ExcelJS, Vitest e Playwright; npm e dependências existentes. O CI atual usa Node 24 e PostgreSQL 18.

**Spec:** [Especificação aprovada](../specs/2026-10-13-prospeccao-cnpj-opcional-design.md).

Status do plano: aprovado pelo usuário em 13/10/2026; código implementado e revisão SDD final concluída. Este documento registra o checkpoint de fechamento local após a correção 7398e00. A criação do PR, seu CI e a entrega são acompanhados no GitHub e no registro final da execução, posteriores a este checkpoint.

## Global Constraints

- “Telefone válido continua obrigatório, conforme o cadastro atual.”
- “Deve existir pelo menos um nome conhecido: razão social ou nome fantasia/comercial.”
- “CNPJ e razão social podem ser nulos. Nome comercial não será copiado para o campo de razão social.”
- “CNPJ informado continua sujeito às validações atuais de formato e dígito verificador. Um valor inválido não será tratado como ausente.”
- “Resumo e origem são obrigatórios nas novas importações.” `descricao`: 500 caracteres; `origem`: 500; `criterios`: 2.000; `google_place_id`: 255.
- O novo cabeçalho é exatamente `cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id`. Preservar os cabeçalhos anteriores de sete e oito colunas para entrada identificada por CNPJ.
- “A conferência permanece sem gravações; confirmar reanalisa o arquivo e mantém o protocolo de assinatura e chave da operação.”
- “Grupos inexistentes ou desativados produzem um aviso recuperável; não causam uma busca irrestrita silenciosa.”
- “Alterar apenas a seleção de grupo não devolve a empresa nem apaga as anotações.”
- “Novas migrações permitem CNPJ e razão social nulos”; “As migrações já aplicadas permanecem imutáveis.”
- “A autoridade permanece no banco.” Preservar `pode_ler()`, `pode_escrever()`, RLS, papel, contexto de reserva e regras de cliente, carteira, descanso e posse.
- `features/` não importa outra `features/`. Não criar entidade paralela de prospects, classificação comercial, tela de edição cadastral, scraper ou publicação nesta entrega.
- TDD: registrar o teste falhando pelo comportamento esperado antes da implementação de cada comportamento. Um erro de instalação ou configuração não conta como vermelho.
- Branch `codex/`, PR e CI verde; nunca commit na `main`. Preservar alterações alheias e os arquivos brutos da coleta. Não aplicar migração nem importar dados em produção nesta execução.
- UTF-8 sem BOM nos arquivos de parser/SQL e LF nas novas migrações. Não escrever controles literais nos documentos; fixtures usam escapes.
- Paginação do catálogo comercial: 20 cartões por página, buscando 21 linhas para detectar próxima página; ordenação `criado_em DESC, id DESC`. A busca de empresas conserva sua página de 20 resultados.

## Review Focus

1. Place ID reconhecido e CNPJ pertencente a outro UUID: recusar a linha e preservar contatos/posse de ambas as empresas; teste da tarefa 2.
2. Grupo desativado enquanto uma reserva espera o bloqueio: negar a nova reserva, preservar a anterior e devolver aviso; teste concorrente da tarefa 4.
3. Textos com CRLF, emoji no limite e controles: normalização e contagem por caracteres iguais em TypeScript e SQL; alteração do pedido idempotente deve ser recusada; testes da tarefa 3.
4. CNPJ nulo em empresas diferentes, nome fantasia acentuado e XLSX com fórmula: identidade não se agrupa pelo nulo, busca encontra o nome e a proteção do arquivo permanece; tarefas 1 e 2.
5. Empresa em duas listas e reserva atual de outra lista: não duplicar resultados/contagens, não atribuir origem falsa, conservar `grupo` em paginação e atendimento; tarefas 4 e 5.

---

## Execução SDD e preparação

SDD aqui combina requisitos rastreáveis à especificação com a execução por **Subagent-Driven Development**. Executar as tarefas 1 a 6 sequencialmente: um implementador com contexto novo e responsabilidade pelos arquivos da tarefa; um revisor independente verifica conformidade e qualidade antes da tarefa seguinte. Fazer uma revisão da branch completa na tarefa 7. Não executar implementadores em paralelo, nem permitir que um implementador delegue sua revisão.

- [x] Ler `AGENTS.md`, `PREFERENCIAS.md`, `REGRAS.md`, a especificação e as skills `using-git-worktrees`, `subagent-driven-development` e `test-driven-development` na execução. Antes de TSX/Actions, ler os guias instalados `node_modules/next/dist/docs/01-app/02-guides/forms.md`, `server-actions.md` e `03-api-reference/03-file-conventions/page.md`. Usar Context7 se houver dúvida de API; não mudar versões para esta feature.
- [x] Inspecionar os worktrees anexados e reutilizar um adequado ou criar um isolado com branch `codex/prospeccao-grupos-cnpj-opcional`. A árvore principal estava na `main`, com alterações anteriores em `PREFERENCIAS.md` e diretórios não rastreados; não transportar nem descartar esses arquivos. Levar ao worktree somente esta especificação e este plano.
- [x] Registrar o commit-base e o workspace/ledger usando os scripts da skill SDD: `scripts/sdd-workspace`, `scripts/task-brief` e `scripts/review-package`, executados da pasta da skill via Git Bash. O workspace fica em `.superpowers/sdd/` e seu `progress.md` começa com `# SDD ledger — plan: <caminho deste plano>`. Em cada despacho, fornecer o brief extraído da tarefa, a especificação, os contratos das dependências e os caminhos de relatório/diff. Dizer que o trabalhador não está sozinho no código e não deve reverter alterações de outros.
- [x] Revalidar o próximo número de migração. Em 13/10/2026, a última era `0032_whatsapp_vinculo.sql`; os números 0033 a 0037 deste plano são os próximos previstos. Se já ocupados na execução, renumerar apenas as migrações novas e registrar a correspondência no ledger.
- [x] Usar o harness local existente: `npm run db:subir`, `.env.test` local e `criarBancoDeTeste()`. O harness exige host local, cria `teste_<hex>` e remove somente seu próprio banco. Não usar `db:aplicar` contra o banco compartilhado para preparar testes, nem imprimir credenciais.

Procedimento de commit de cada tarefa: `git add --` recebe **apenas os arquivos da lista da tarefa**, incluindo seus testes e o inventário regenerado quando houver novos unitários. Antes de `git commit`, executar o guarda abaixo no mesmo script PowerShell. Se já houver arquivos de outro trabalho no índice, parar o commit e preservar o índice, sem retirar alterações alheias.

```powershell
$branchDaFeature = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branchDaFeature -ne 'codex/prospeccao-grupos-cnpj-opcional') {
  throw 'Commit exige a branch codex/prospeccao-grupos-cnpj-opcional'
}
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Revisar os arquivos preparados para commit' }
# Executar então git commit -m com a mensagem indicada na tarefa.
```

## Task 1: Cadastro parcial no banco e apresentação em todos os consumidores

**Files:**

- Create: `db/migracoes/0033_empresa_identificacao_parcial.sql`, `docs/db/0033.md`, `src/lib/empresa-apresentacao.ts`, `src/lib/empresa-apresentacao.test.ts`, `tests/integracao/empresa-cadastro-parcial.test.ts`.
- Modify: `src/features/empresas/formato.ts`, `src/features/empresas/listagem.ts`, `src/features/empresas/perfil.ts`, `src/features/empresas/grupos.ts`; `src/features/fila/consulta.ts`; `src/features/prospeccao/tipos.ts`, `src/features/prospeccao/repositorio.ts`, `src/features/prospeccao/recentes.ts`; `src/features/funil/consulta.ts`; `src/features/gestao/consulta.ts`, `src/features/gestao/perfil-vendedor.ts`; `src/server/whatsapp/empresas.ts`.
- Modify: `app/empresas/linha.tsx`, `app/empresas/[id]/page.tsx`, `app/empresas/grupos/[id]/page.tsx`, `app/fila/cartao.tsx`, `app/fila/formulario.tsx`, `app/fila/localizar/resultados.tsx`, `app/carteira/lista.tsx`, `app/carteira/[id]/ficha.tsx`, `app/carteira/filtros.ts`, `app/meu-dia/agenda.ts`, `app/meu-dia/painel.tsx`, `app/funil/modal.tsx`.
- Test/modify: `src/features/empresas/formato.test.ts`, `app/empresas/linha.test.tsx`, `app/carteira/filtros.test.tsx`, `app/meu-dia/agenda.test.tsx`, `app/fila/cartao.test.tsx`, `tests/integracao/empresas-busca.test.ts`, `tests/integracao/whatsapp-empresas.test.ts`, `tests/inventario-unitario.txt`.

**Interfaces:**

- Consumes: `empresa.id` UUID e os vínculos existentes; `formatarCnpj(cnpj: string): string` atual.
- Produces: `nomeEmpresa(empresa: { razaoSocial: string | null; nomeFantasia: string | null }): string`; `formatarCnpj(cnpj: string | null): string`. DTOs com as duas identificações reais anuláveis; projeções SQL `nome`/`empresa` continuam strings usando `coalesce(razao_social,nome_fantasia)`.

- Verify read-only consumers: `app/fila/localizar/[id]/page.tsx`, `app/usuarios/vendedores/[id]/page.tsx`; os contratos compartilhados alterados já fornecem os nomes e CNPJs opcionais, sem exigir alterações sem efeito nestas páginas.

- [x] **Step 1: Escrever os testes vermelhos do nome e do cadastro parcial.**

```ts
import { expect, test } from 'vitest'
import { nomeEmpresa, formatarCnpj } from './empresa-apresentacao'

test('usa o nome conhecido sem transformar fantasia em razão social', () => {
  expect(nomeEmpresa({ razaoSocial: null, nomeFantasia: 'Câmeras Aurora' })).toBe('Câmeras Aurora')
  expect(nomeEmpresa({ razaoSocial: 'Aurora LTDA', nomeFantasia: 'Aurora' })).toBe('Aurora LTDA')
  expect(formatarCnpj(null)).toBe('Não informado')
})
```

Em `empresa-cadastro-parcial.test.ts`, preparar/limpar o banco com `criarBancoDeTeste`, `beforeAll` e `afterAll` de `tests/integracao/ajuda.ts`. O teste de persistência usa o dono somente para montar o cenário:

```ts
const [empresa] = await banco.sql<{ id: string; busca: string }>(
  `INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone)
   VALUES (NULL,NULL,'Câmeras Aurora','11987654321') RETURNING id,busca`,
)
expect(empresa.busca).toContain('cameras aurora')
await expect(banco.sql(
  "INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone) VALUES (NULL,NULL,NULL,'11987654321')",
)).rejects.toMatchObject({ code: '23514' })
```

Acrescentar casos de duas empresas com CNPJ nulo, CNPJ informado repetido negado, nome vazio negado, telefone inválido negado, busca pelo nome fantasia, ordenação na Carteira/Meu dia e WhatsApp resolvendo o mesmo telefone/nome. Nos testes de componentes, reutilizar a fixture existente com `cnpj: null`, `razaoSocial: null` e fantasia preenchida; verificar o título e “Não informado”.

- [x] **Step 2: Rodar o vermelho.** `npm run test:unit -- src/lib/empresa-apresentacao.test.ts` e `npm run test:integracao -- tests/integracao/empresa-cadastro-parcial.test.ts`. Esperado: helper ausente e inserção negada por `NOT NULL`, respectivamente.
- [x] **Step 3: Implementar a apresentação e a migração.** Mover a formatação existente para `lib` e reexportar em `features/empresas/formato.ts`, evitando importação entre features:

```ts
export function nomeEmpresa(empresa: { razaoSocial: string | null; nomeFantasia: string | null }): string {
  return empresa.razaoSocial ?? empresa.nomeFantasia ?? 'Não informado'
}

export function formatarCnpj(cnpj: string | null): string {
  if (cnpj === null) return 'Não informado'
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return cnpj
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}
```

Na migração nova, manter a unicidade e os checks existentes, remover somente `NOT NULL` de CNPJ/razão social e impor o nome conhecido:

```sql
ALTER TABLE public.empresa ALTER COLUMN cnpj DROP NOT NULL;
ALTER TABLE public.empresa ALTER COLUMN razao_social DROP NOT NULL;
ALTER TABLE public.empresa ADD CONSTRAINT empresa_nome_conhecido
  CHECK (coalesce(razao_social,nome_fantasia) IS NOT NULL);
ALTER TABLE public.empresa ALTER COLUMN busca SET EXPRESSION AS (
  public.sem_acento(coalesce(razao_social,'') || ' ' || coalesce(nome_fantasia,''))
);
```

Recriar na migração as versões vigentes de `empresa_consultar` e `empresa_sugestoes` da 0028, alterando suas ordenações para `coalesce(razao_social,nome_fantasia), id`. Conservar suas permissões, filtros e exclusões comerciais. Alterar a expressão da coluna existente sem DROP COLUMN, conforme a catraca do projeto e suporte verificado no PostgreSQL 17/18. Nas consultas TS da lista, fila, funil e gestão, ajustar ordenação/projeções equivalentes. Incluir `nome_fantasia` no DTO e SELECT de `EmpresaGrupo`. Nas comparações JS, usar `nomeEmpresa(a).localeCompare(nomeEmpresa(b),'pt-BR')`; na concatenação de busca usar `razaoSocial ?? ''` para não pesquisar a palavra `null`.

- [x] **Step 4: Rodar verde e verificar todos os consumidores.** Repetir os testes direcionados; rodar `npm run typecheck`, `npm run test:unit` e `npm run test:integracao -- tests/integracao/empresa-cadastro-parcial.test.ts tests/integracao/empresas-busca.test.ts tests/integracao/whatsapp-empresas.test.ts`. Esperado: sucesso sem casts para esconder nulos e sem alterar a precedência das datas da agenda.
- [x] **Step 5: Regenerar inventário, revisar e commit.** `npm run test:inventario`; revisão SDD do diff desta tarefa e dos negativos SQL. Commit: `feat: permitir identificacao cadastral parcial de empresas`.

## Task 2: Importação por CNPJ ou Google Place ID, reimportação e complemento seguro

**Files:**

- Create: `db/migracoes/0034_empresa_origem_google.sql`, `docs/db/0034.md`, `src/features/empresas/identidade.ts`, `src/features/empresas/identidade.test.ts`, `tests/integracao/empresas-origem-google.test.ts`.
- Modify: `src/features/empresas/planilha.ts`, `src/features/empresas/arquivo.ts`, `src/features/empresas/servico.ts`, `src/features/empresas/repositorio.ts`, `src/features/empresas/mensagens.ts`, `src/features/empresas/modelo.ts`; `public/modelo-empresas.xlsx`; `app/empresas/importar/relatorio.tsx`.
- Test/modify: `src/features/empresas/planilha.test.ts`, `src/features/empresas/arquivo.test.ts`, `src/features/empresas/servico.test.ts`, `src/features/empresas/repositorio.test.ts`, `src/features/empresas/mensagens.test.ts`, `src/features/empresas/modelo.test.ts`; `tests/integracao/grupos-importacao.test.ts`, `tests/integracao/empresas-importar.test.ts`; `tests/inventario-unitario.txt`.

- Additional files from T2-01 review: `src/features/empresas/conferencia.ts`, `src/features/empresas/conferencia.test.ts`, `docs/importacao-conferencia.md`; `.env.example`; Action, formulário e testes do protocolo; `tests/e2e/ambiente.ts`, `src/e2e-ambiente.test.ts` e as duas razões sociais positivas de `tests/e2e/grupos-importacao.spec.ts`.

**Interfaces:**

- Consumes: empresa anulável da tarefa 1, o analisador existente `analisarPlanilha(bytes): Analise` e `grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb)`.
- Produces: `CABECALHO_GOOGLE = CABECALHO + ',google_place_id'`; `LinhaAceita` mantém seus campos e passa a `cnpj: string | null`, `razaoSocial: string | null`, `googlePlaceId: string | null`.
- `CadastroIdentificado = { id: string; cnpj: string | null; razaoSocial: string | null }`; `IdentidadeImportada = Pick<LinhaAceita,'linha' | 'cnpj' | 'razaoSocial' | 'googlePlaceId'>`.
- `Preparo` substitui `jaCadastrados` por `porCnpj: Map<string,CadastroIdentificado>` e `porGoogle: Map<string,CadastroIdentificado>`, conservando `enderecos` e `basePublicadaEm`. `RepositorioEmpresas.preparar(identidades: IdentidadeImportada[], ceps: string[]): Promise<Preparo | Falha>`.
- `resolverIdentidade(linha: IdentidadeImportada, preparo: Pick<Preparo,'porCnpj' | 'porGoogle'>)` retorna `{ ok: true; empresaId: string | null }` ou `{ ok: false; motivo: 'identificadores_divergentes' | 'cnpj_divergente' | 'razao_social_divergente' }`.
- `Recusa` repetida passa a `{ tipo:'repetido'; linha:number; par:number; identificador:'cnpj'|'google_place_id'; valor:string; divergencia:string|null }`; acrescentar `{ tipo:'identidade'; linha:number; motivo:<os três motivos de resolverIdentidade> }`. Atualizar mensagens e todos os consumidores no mesmo commit.

- Conference integrity after review T2-01: `analisar` produces `Conferencia` with original accepted row positions and identity refusals. `importar` requires this selection as its fourth argument. The Action emits/verifies a stateless HMAC receipt bound to authenticated manager and the entire operation, including file hash; the browser state alone is not trusted. Reparse the same bytes and send exactly the approved rows to SQL, so new conflicts roll back the whole lot and persisted replay remains available. Configure dedicated `IMPORTACAO_CONFERENCIA_SEGREDO` (32 random bytes as 64 hex characters) identically across server instances; missing/invalid configuration fails closed. Metadata in Task 3 joins this signed operation.

- [x] **Step 1: Testar dois prospects sem CNPJ e identificação conflitante.**

```ts
test('aceita identidades diferentes sem CNPJ nem razão social', () => {
  const cabecalho = `${CABECALHO},google_place_id`
  const a = analisarPlanilha(new TextEncoder().encode([
    cabecalho,
    ',,Câmeras Aurora,,11987654321,,,,ChIJ-ficticio-a',
    ',,Câmeras Boreal,,11987654322,,,,ChIJ-ficticio-b',
  ].join('\n')))
  expect(a.ok).toBe(true)
  if (!a.ok) throw new Error(a.falha.motivo)
  expect(a.aceitas).toHaveLength(2)
  expect(a.aceitas[0]).toMatchObject({ cnpj: null, razaoSocial: null, googlePlaceId: 'ChIJ-ficticio-a' })
})
```

```ts
test('dois identificadores que apontam para UUIDs diferentes exigem revisão', () => {
  const porCnpj = new Map([['11222333000181', { id: 'empresa-a', cnpj: '11222333000181', razaoSocial: 'Aurora LTDA' }]])
  const porGoogle = new Map([['ChIJ-ficticio-b', { id: 'empresa-b', cnpj: null, razaoSocial: null }]])
  expect(resolverIdentidade({ linha: 2, cnpj: '11222333000181', razaoSocial: 'Aurora LTDA', googlePlaceId: 'ChIJ-ficticio-b' },
    { porCnpj, porGoogle })).toEqual({ ok: false, motivo: 'identificadores_divergentes' })
})
```

Adicionar unitários explícitos para: nove colunas; sete/oito com CNPJ; sete/oito sem CNPJ recusados; CNPJ inválido informado com Place ID válido recusado; ambos os nomes vazios; ausência de telefone; ID ausente, 256 caracteres ou com controle; CNPJ/Place ID repetidos retirando todas as linhas envolvidas; mesmo telefone com IDs distintos não deduplicado. XLSX: nona coluna como texto, fórmulas recusadas e proteções anteriores mantidas.

No novo arquivo de integração, usar `criarBancoDeTeste` e `criarUsuario` para os papéis. Preparar um helper `confirmar(linhas: unknown[], chave = randomUUID())` que chama a assinatura de seis parâmetros e retorna `{ grupo_id,inseridas,vinculadas,relatorio }`. Testar criação de dois nulos; Place ID único; reimportação em dois grupos mantendo UUID; repetição da mesma chave mantendo resultado; complemento de CNPJ/razão social vazios mantendo contato e carteira; conflito entre dois UUIDs desfazendo toda a transação; um CNPJ com dois Place IDs em arquivos diferentes; controles negativos de vendedor, gestor inativo e senha pendente. Limpar a nova tabela de origem antes de apagar empresas nos fixtures existentes.

- [x] **Step 2: Rodar vermelho.** `npm run test:unit -- src/features/empresas/planilha.test.ts src/features/empresas/identidade.test.ts` e `npm run test:integracao -- tests/integracao/empresas-origem-google.test.ts`. Esperado: cabeçalho recusado, helper ausente e confirmação SQL rejeitando a linha nula.
- [x] **Step 3: Implementar análise, identidade e confirmação atômica.** A coluna nula nunca entra na chave do Map; obter CNPJs/IDs não nulos separados. A classificação usa os dois mapas antes de contar novas/já cadastradas:

```ts
const porCnpj = linha.cnpj === null ? undefined : preparo.porCnpj.get(linha.cnpj)
const porGoogle = linha.googlePlaceId === null ? undefined : preparo.porGoogle.get(linha.googlePlaceId)
if (porCnpj && porGoogle && porCnpj.id !== porGoogle.id) {
  return { ok: false, motivo: 'identificadores_divergentes' }
}
const existente = porGoogle ?? porCnpj
if (existente?.cnpj && linha.cnpj && existente.cnpj !== linha.cnpj) {
  return { ok: false, motivo: 'cnpj_divergente' }
}
if (existente?.razaoSocial && linha.razaoSocial && existente.razaoSocial !== linha.razaoSocial) {
  return { ok: false, motivo: 'razao_social_divergente' }
}
return { ok: true, empresaId: existente?.id ?? null }
```

Criar `empresa_origem_google(google_place_id text PRIMARY KEY,empresa_id uuid REFERENCES empresa(id) ON DELETE RESTRICT,criado_em,criado_por,atualizado_em,atualizado_por)`, com auditoria existente, RLS e SELECT apenas para gestor. CHECK: texto aparado, não vazio, até 255 caracteres e sem controles. Não conceder INSERT/UPDATE/DELETE direto à aplicação. O repositório consulta essa associação para montar `porGoogle`; `gravar` envia `google_place_id` no JSON.

Recriar a confirmação na migração nova, preservando sua assinatura de seis argumentos nesta tarefa. Sob o advisory exclusivo existente `(27,1)`, revalidar permissão, linhas, repetição de identificadores e resolução dos dois UUIDs; conflito retorna SQLSTATE `22023` e rollback integral. Resolver cadastro por ambos os identificadores, criar empresa somente se nenhum reconhecer, preencher somente CNPJ/razão social nulos e acrescentar nova origem somente se livre ou já da mesma empresa. Nunca usar nome/telefone como chave. Vincular a empresa ao novo grupo com PK composta. `pedido` inclui as novas linhas; reexecução idêntica devolve o resultado armazenado antes de reclassificar o lote.

Manter a validação de DV existente do TypeScript. Na confirmação SQL, acrescentar o helper interno `empresa_cnpj_valido(text) RETURNS boolean`, sem EXECUTE para PUBLIC/aplicação: mesmo cálculo ASCII menos 48 e pesos cíclicos 2 a 9 de `cnpj.ts`, rejeitando repetição de um caractere. Testar `11222333000181` e `12ABC34501DE35` aceitos; variantes terminadas em `82`/`36` recusadas. Aplicar à entrada da confirmação, sem acrescentar um CHECK retroativo sobre cadastros legados. Fixtures que confirmam CNPJ sintético inválido devem gerar DV correto; inserções diretas destinadas a outros contratos não precisam mudar. Divergência de razão social em reimportação passa a revisão, conforme a especificação; atualizar o teste anterior que apenas ignorava essa divergência.

No parser, exigir CNPJ nos cabeçalhos antigos e Place ID quando CNPJ ausente no novo; normalizar campos opcionais a nulo. Aceitar pelo menos um nome sem copiá-lo entre colunas. Adicionar motivos de campo `nome_ausente`, `identidade_ausente`, `google_place_id_invalido`, mantendo os motivos existentes de CNPJ/telefone; o campo `esperado` de recusa de colunas passa a `7 | 8 | 9`. Medir Place ID em pontos de código, aparar espaços e rejeitar controles. Estender os limites de cabeçalho de XLSX para nove, conservando 5.000 linhas, 1,5 MB de entrada, 16 MB descompactados e demais proteções atuais. Gerar o modelo com nove colunas de texto e exemplo fictício; ajustar dimensão/colunas XML de `A1:H2`/8 para `A1:I2`/9.

- [x] **Step 4: Rodar verde.** Repetir os direcionados; `npm run modelo:empresas`, `npm run test:unit -- src/features/empresas`, `npm run test:integracao -- tests/integracao/empresas-origem-google.test.ts tests/integracao/grupos-importacao.test.ts tests/integracao/empresas-importar.test.ts`, `npm run typecheck`. Confirmar que analisar não escreve e que conflito surgido depois da análise produz “A confirmação mudou. Confira o arquivo novamente.” sem gravação parcial.
- [x] **Step 5: Regenerar inventário, revisar e commit.** Revisão independente inclui histórico/UUID, controles SQL e modelo binário comparado com gerador. Commit: `feat: reconhecer empresas por origem na importacao`.

## Task 3: Contexto das listas na importação e correção pelo gestor

**Files:**

- Create: `src/lib/grupo-metadados.ts`, `src/lib/grupo-metadados.test.ts`, `db/migracoes/0035_grupo_metadados.sql`, `docs/db/0035.md`, `app/empresas/grupos/metadados.tsx`, `app/empresas/grupos/metadados.test.tsx`, `tests/integracao/grupos-metadados.test.ts`.
- Modify: `src/features/empresas/repositorio.ts`, `src/features/empresas/grupos.ts`, `src/features/empresas/grupos.test.ts`, `src/features/empresas/repositorio.test.ts`, `src/features/empresas/servico.test.ts`; `app/empresas/importar/acao.ts`, `app/empresas/importar/formulario.tsx`, `app/empresas/importar/acao.test.tsx`, `app/empresas/importar/formulario.test.tsx`, `app/empresas/importar/formulario.dom.test.tsx`; `app/empresas/grupos/acoes.ts`, `app/empresas/grupos/acoes.test.tsx`, `app/empresas/grupos/[id]/page.tsx`.
- Modify: `src/server/db/migracoes/invariantes.ts`, `src/server/db/migracoes/invariantes.test.ts`; os helpers de confirmação nos testes das tarefas 2/3 e `tests/integracao/grupos-importacao.test.ts`; `tests/e2e/grupos-importacao.spec.ts`, `tests/e2e/empresas-excel.spec.ts`; `tests/inventario-unitario.txt`.

- Test/modify after T2-01: `src/features/empresas/conferencia.test.ts` and metadata cases in Action/DOM must verify that the normalized metadata belongs to the signed operation in both conference and confirmation. Changing only metadata invalidates the old receipt. Preserve the HMAC runtime configuration from Task 2.

- Verify read-only consumer: `app/empresas/importar/etapas-importacao.tsx`; o resumo dos metadados na conferência é fornecido por `FormularioImportar`, com o componente de etapas preservado.

**Interfaces:**

- Produces em `lib`: `MetadadosGrupo = { descricao: string; origem: string; criterios: string | null }`; `validarMetadadosGrupo(entrada: { descricao: unknown; origem: unknown; criterios: unknown }): { ok:true; metadados:MetadadosGrupo } | { ok:false; campo:'descricao'|'origem'|'criterios'; motivo:'obrigatorio'|'limite'|'controle' }`.
- `OperacaoGrupo` mantém seus campos e recebe `metadados: MetadadosGrupo`; a assinatura SQL passa a `grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb,jsonb)`, com o sétimo parâmetro `{descricao,origem,criterios}`. Sem default para burlar obrigatoriedade.
- `grupo_importacao_metadados_definir(p_grupo uuid,p_descricao text,p_origem text,p_criterios text) RETURNS text`, com vocabulário `ok`/`nao_encontrado`, autorizado somente ao gestor com escrita.
- `atualizarMetadadosGrupo(usuarioId:string,id:string,metadados:MetadadosGrupo): Promise<{ok:true}|{ok:false;motivo:'sem_permissao'|'nao_encontrado'|'metadados_invalidos'}>` no repositório administrativo; `atualizarMetadadosGrupoAcao(anterior:EstadoGrupo,form:FormData): Promise<EstadoGrupo>` na Action.

- [x] **Step 1: Escrever os testes de normalização/limite e pedido imutável.**

```ts
test('normaliza CRLF e conta caracteres Unicode como o banco', () => {
  expect(validarMetadadosGrupo({ descricao: 'Mooca\r\nCFTV', origem: 'Google Maps', criterios: '' }))
    .toEqual({ ok: true, metadados: { descricao: 'Mooca\nCFTV', origem: 'Google Maps', criterios: null } })
  expect(validarMetadadosGrupo({ descricao: '📷'.repeat(500), origem: 'Google Maps', criterios: null }).ok).toBe(true)
  expect(validarMetadadosGrupo({ descricao: '📷'.repeat(501), origem: 'Google Maps', criterios: null }).ok).toBe(false)
  expect(validarMetadadosGrupo({ descricao: 'Mooca\u0001', origem: 'Google Maps', criterios: null }).ok).toBe(false)
})
```

No teste SQL, chamar a nova assinatura com os mesmos bytes/chave/pedido duas vezes, conferindo resultado persistido. Trocar somente `origem` na segunda confirmação deve produzir `22023` e deixar grupo/pedido/empresas intactos. Editar os metadados pela função do gestor altera a apresentação/auditoria, conservando o `pedido` original; repetir a confirmação original continua idempotente. Testar limites 500/501 e 2.000/2.001 no SQL, CRLF/emoji, JSON com campos adicionais ou tipos incorretos, vendedor impedido de editar e grupos anteriores com três nulos legíveis.

No componente de importação, testar presença dos três rótulos, requisitos dos dois primeiros, resumo na conferência e manutenção do input de arquivo. No DOM, alterar metadados depois de conferir deve invalidar a etapa anterior e gerar nova chave; duplo envio sem mudança usa a mesma chave.

- [x] **Step 2: Rodar vermelho.** `npm run test:unit -- src/lib/grupo-metadados.test.ts app/empresas/importar/formulario.test.tsx app/empresas/importar/formulario.dom.test.tsx`; `npm run test:integracao -- tests/integracao/grupos-metadados.test.ts`. Esperado: campos/validador ausentes e assinatura SQL ausente.
- [x] **Step 3: Implementar contrato comum, banco e formulários.** A normalização é CRLF/CR para LF, remoção de espaço ASCII/LF nas extremidades e rejeição dos demais controles, antes de medir comprimento em pontos de código. Não usar `string.length` para comparar emoji com `length(text)` do Postgres:

```ts
const normalizar = (texto: string) => texto.replace(/\r\n?/g, '\n').replace(/^[ \n]+|[ \n]+$/g, '')
const temControle = (texto: string) => /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/u.test(texto)
const tamanho = (texto: string) => Array.from(texto).length
```

Adicionar colunas anuláveis à tabela para conservar grupos antigos. Os CHECKs validam texto normalizado, limites e controles removendo somente LF antes de testar controles. Campos novos vazios são recusados; `criterios` vazio vira nulo. Recriar confirmação com sétimo argumento, validar metadados também no SQL, incluir no `pedido` e persistir ao criar o grupo. Retirar a assinatura de seis argumentos e sua concessão, sem manter caminho privilegiado que permita criar lista nova sem origem. Atualizar todos os consumidores/fixtures da assinatura no mesmo commit; testes de idempotência anterior mantêm seu propósito com metadados válidos.

Adicionar a função de correção com `SECURITY DEFINER SET search_path=''`, permissão antes/depois do bloqueio da linha, auditoria existente e `REVOKE ... FROM PUBLIC`. Conceder somente com o consumidor implementado e registrar seu nome na whitelist `FUNCOES_CONCEDIDAS_A_APP_USUARIO`. Não liberar UPDATE direto.

No formulário, manter os valores controlados de nome/metadados e o file input montado entre etapas, com proteção `onReset` atual; mudanças de qualquer valor do pedido renovam a chave e retiram a confirmação anterior. A Action valida o contrato comum, mantém `exigir('gestor')`, não exporta estado inicial em arquivo `'use server'` e passa metadados ao serviço. Revalidar as rotas administrativas e `/fila`/`/fila/localizar` após correção. Mostrar nulos antigos com “Origem não informada”; não preencher metadados de forma inventada.

- [x] **Step 4: Rodar verde.** Repetir os direcionados; `npm run test:unit -- src/lib/grupo-metadados.test.ts src/features/empresas app/empresas/importar app/empresas/grupos src/server/diretivas.test.ts src/server/db/migracoes/invariantes.test.ts`; `npm run test:integracao -- tests/integracao/grupos-metadados.test.ts tests/integracao/grupos-importacao.test.ts tests/integracao/empresas-origem-google.test.ts`; `npm run typecheck`.
- [x] **Step 5: Regenerar inventário, revisar e commit.** Verificar protocolo de chave/pedido, limites Unicode idênticos e inexistência de overload antigo concedido. Commit: `feat: registrar e corrigir o contexto das listas importadas`.

## Task 4: Grupo como restrição real de consulta, filtros e reserva

**Files:**

- Create: `db/migracoes/0036_prospeccao_grupo.sql`, `docs/db/0036.md`, `src/server/grupos/prospeccao.ts`, `src/server/grupos/prospeccao.test.ts`, `app/fila/localizar/contexto-grupo.tsx`, `app/fila/localizar/contexto-grupo.test.tsx`, `tests/integracao/prospeccao-grupos.test.ts`, `app/fila/localizar/navegacao.test.tsx`.
- Modify: `src/features/prospeccao/tipos.ts`, `src/features/prospeccao/filtros.ts`, `src/features/prospeccao/repositorio.ts`, `src/features/prospeccao/mensagens.ts`, `src/features/prospeccao/filtros.test.ts`, `src/features/prospeccao/mensagens.test.ts`; `src/features/fila/repositorio.ts`, `src/features/fila/repositorio.test.ts`; `src/server/db/migracoes/invariantes.ts`, `src/server/db/migracoes/invariantes.test.ts`.
- Modify: `app/fila/localizar/navegacao.ts`, `app/fila/localizar/formulario.tsx`, `app/fila/localizar/page.tsx`, `app/fila/localizar/[id]/page.tsx`; `app/fila/entrada-reserva.ts`, `app/fila/entrada-reserva.test.tsx`, `app/fila/campos-reserva.tsx`, `app/fila/page.tsx`, `app/fila/formulario.tsx`.
- Test/modify: `app/fila/localizar/componentes.test.tsx`, `app/fila/localizar/reservar.test.tsx`, `app/fila/entrada-sem-reserva.test.tsx`, `app/fila/etapas.test.tsx`, `tests/integracao/fila-reservar.test.ts`, `tests/integracao/prospeccao-consulta.test.ts`, `tests/inventario-unitario.txt`.

- Verify read-only consumers/tests: `app/fila/localizar/paginacao.tsx`, `app/fila/localizar/resultados.tsx`, `app/fila/localizar/reservar.tsx`, `app/fila/acoes.ts`, `app/fila/etapas.tsx`, `app/fila/formulario.test.tsx`, `tests/integracao/fila-puxar.test.ts`; propagam o grupo pelos helpers alterados e verificam compatibilidade sem exigir hunks sem efeito.

- Test/modify for T4-02 recovery: `app/fila/localizar/perfil.test.tsx`.

**Interfaces:**

- Consumes: metadados da tarefa 3, associação `grupo_importacao_empresa`, reserva/contexto vigentes e regras SQL da 0028.
- `Filtros` e `FiltrosReserva` recebem `grupo: string | null`. A ausência sempre vira nulo, não `undefined`. `listarOpcoes(usuarioId:string,uf:string|null,cidade:string|null,grupo:string|null): Promise<ResultadoOpcoes>`.
- SQL: `empresa_consultar(text,text,text,text,text,integer,p_grupo uuid DEFAULT NULL)`; `empresa_filtros(text,text,p_grupo uuid DEFAULT NULL)`; `fila_reservar(uuid,text,text,text,text,text,uuid,p_grupo uuid DEFAULT NULL)`. Substituir assinaturas antigas para não criar overload ambíguo; chamadas antigas continuam funcionando pelo default final. `empresa_filtros_administracao` conserva seu universo e contrato.
- `GrupoProspeccao = { id:string; nome:string; descricao:string|null; origem:string|null; criterios:string|null; criadoEm:string; total:number; disponiveis:number }` em `server/grupos/prospeccao.ts`.
- `grupo_prospeccao_ler(p_grupo uuid)` retorna zero/uma linha apenas com os campos comerciais acima em snake_case. `lerGrupoProspeccao(usuarioId:string,grupoId:string): Promise<{ok:true;grupo:GrupoProspeccao}|{ok:false;motivo:'sem_permissao'|'grupo_indisponivel'}>`.
- Consultas/filtros recebem falha explícita `grupo_indisponivel`; SQL dessas leituras usa `P0002` para grupo ausente/inativo e `42501` para permissão. Reserva acrescenta resultado `grupo_indisponivel` ao vocabulário existente, conservando as colunas `empresa_id,reservado_ate,contexto` da reserva mantida.
- Navegação: `selecionarGrupo(grupo:string|null): Filtros` produz somente grupo + demais filtros vazios e página 1; `limparFiltros(filtros:Filtros): Filtros` chama `selecionarGrupo(filtros.grupo)`; `urlConsulta(filtros,pagina)` conserva todos os campos atuais e grupo.

- [x] **Step 1: Escrever testes vermelhos de navegação e reserva fora da lista.**

```ts
test('a paginação conserva grupo e limpar conserva somente a lista', () => {
  const filtros = { nome:'Aurora', cnae:null, uf:'SP', cidade:null, bairro:null, pagina:3,
    grupo:'00000000-0000-4000-8000-000000000701' }
  const url = new URL(urlConsulta(filtros,4), 'https://crm.test')
  expect(url.searchParams.get('grupo')).toBe(filtros.grupo)
  expect(url.searchParams.get('pagina')).toBe('4')
  expect(limparFiltros(filtros)).toEqual({ nome:'',cnae:null,uf:null,cidade:null,bairro:null,pagina:1,grupo:filtros.grupo })
  expect(selecionarGrupo(null).grupo).toBeNull()
})
```

O fixture SQL do novo teste cria duas listas ativas e três empresas: A só na lista 1, B em ambas e C só na lista 2. Testar AND com nome/CNAE/geografia, filtros limitados ao grupo, B aparecendo uma vez e pesquisa sem grupo conservada. Reservar C com grupo 1 deve retornar `indisponivel` e não criar nem substituir reserva. Puxar próxima do grupo 1 deve escolher somente A/B disponíveis. Grupo inexistente/desativado deve devolver falha própria; nunca executar a busca geral como recuperação automática.

- [x] **Step 2: Escrever o teste concorrente determinístico antes da mudança SQL.** Preparar uma reserva anterior de A e grupo 2 selecionado. Usar `Client` conectado a `banco.urlAdmin`: iniciar transação, definir a identidade do gestor, obter `pg_advisory_xact_lock(27,1)` e executar `grupo_importacao_situacao_definir(grupo2,false)` sem commit. Disparar a reserva de C pelo papel da aplicação. Esperar a sessão do teste estar em espera de lock consultando `pg_stat_activity` com prazo máximo de cinco segundos; então confirmar a transação do gestor. A reserva deve retornar `grupo_indisponivel`, mantendo A, sua versão de contexto e registros. Não usar atraso fixo para decidir a ordem da corrida.

```ts
async function esperarReservaBloqueada(banco: BancoDeTeste) {
  const inicio = Date.now()
  while (Date.now() - inicio < 5_000) {
    const [{ esperando }] = await banco.sql<{ esperando:boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_stat_activity
       WHERE datname=current_database() AND pid<>pg_backend_pid()
       AND wait_event_type='Lock' AND query LIKE '%fila_reservar%') AS esperando`,
    )
    if (esperando) return
    await new Promise(resolve => setTimeout(resolve,50))
  }
  throw new Error('A sessão de reserva não entrou na espera pelo lock')
}

const admin = new Client({ connectionString:banco.urlAdmin })
await admin.connect()
let aberta = false
let reservando: Promise<{ linhas:{resultado:string;empresa_id:string|null}[] }> | undefined
try {
  await admin.query('BEGIN')
  aberta = true
  await admin.query("SELECT set_config('app.usuario_id',$1,true)", [gestor])
  await admin.query('SELECT pg_advisory_xact_lock(27,1)')
  await admin.query('SELECT grupo_importacao_situacao_definir($1,false)', [grupo2])
  reservando = banco.comoUsuario(vendedor, executar => executar<{
    resultado:string; empresa_id:string|null
  }>(`SELECT * FROM fila_reservar($1,'',NULL,NULL,NULL,NULL,
    (SELECT versao FROM fila_contexto WHERE usuario_id=usuario_atual()),$2)`, [empresaC, grupo2]))
  await esperarReservaBloqueada(banco)
  await admin.query('COMMIT')
  aberta = false
  expect((await reservando).linhas[0]).toMatchObject({ resultado:'grupo_indisponivel',empresa_id:empresaA })
} finally {
  if (aberta) await admin.query('ROLLBACK')
  await reservando?.catch(() => undefined)
  await admin.end()
}
```

Importar `Client` de `pg` e `BancoDeTeste` de `./ajuda`; `empresaA`, `empresaC`, `grupo2`, `gestor` e `vendedor` vêm do cenário A/B/C definido neste teste. A consulta de espera observa somente o banco temporário deste arquivo, sem sessões de produção.

Testar também renovar a reserva atual após a desativação sem exigir que ela pertença ao grupo da próxima busca, senha provisória/inatividade negando escrita e duas sessões conservando os controles de contexto.

- [x] **Step 3: Rodar vermelho.** `npm run test:unit -- src/features/prospeccao/filtros.test.ts app/fila/localizar/navegacao.test.tsx app/fila/entrada-reserva.test.tsx`; `npm run test:integracao -- tests/integracao/prospeccao-grupos.test.ts`. Esperado: grupo perdido na URL/formulário e contratos SQL sem grupo.
- [x] **Step 4: Implementar os contratos SQL e ligar toda a navegação existente.** Nas consultas, validar grupo ativo antes de selecionar empresas e restringir por `EXISTS`, não por JOIN que multiplica resultados:

```sql
AND (p_grupo IS NULL OR EXISTS (
  SELECT 1 FROM public.grupo_importacao_empresa ge
  WHERE ge.empresa_id = e.id AND ge.grupo_id = p_grupo
))
```

Na reserva, manter advisory compartilhado `(27,1)`, lock por usuário e locks de empresa da função vigente. Após adquirir os locks, revalidar escrita/contexto e o estado ativo do grupo antes de escolher uma nova candidata. Alvo explícito novo também verifica associação; não ignora o grupo. Caminho de manutenção/renovação da própria reserva conserva as regras anteriores e não a perde por mudança do grupo da busca. Se grupo inválido ou nenhuma candidata, retornar sem liberar reserva anterior ou trocar contexto. Revisar todos os retornos iniciais da função para essa distinção.

O leitor comercial exige `pode_ler()` e retorna apenas grupo ativo com metadados/contagens; não conceder SELECT administrativo ao vendedor. Aplicar `SECURITY DEFINER`, `search_path=''`, revoke PUBLIC e whitelist, com consumidor `lerGrupoProspeccao` implementado nesta tarefa. Reproduzir nas contagens o predicado vigente de nova reserva: origem ativa, ausência de cliente, posse ausente, reserva não vigente e descanso vencido. Contar empresas distintas. Não alterar `empresa_filtros_administracao` nem conceder seu helper interno.

Validar UUID de `grupo` em `lerFiltros` e incluir `grupo` nos campos ocultos, leitura de FormData, chamadas de repositório e testes de mocks. Na busca, presença de grupo conta como filtro mesmo sem nome/CNAE, evitando recentes/sugestões de outra lista. Mostrar `ContextoGrupo` acima dos resultados, com “Lista da próxima busca”, nome, resumo, origem e critérios como texto escapado. Grupo inválido/inativo produz alerta com link “Todas as listas ativas”, sem resultados gerais automáticos. Alterações de filtros reiniciam página e mantêm grupo; limpar conserva grupo; escolher lista limpa os demais. URL do perfil, voltar, reservar e redirecionamento para atendimento conservam grupo.

Na `/fila`, obter a reserva antes de exibir alerta de grupo: grupo inválido não pode ocultar o atendimento vigente. Mostrar contexto da próxima busca separadamente do cartão da empresa atual; não rotular esse contexto como origem daquela empresa. Mudar grupo por navegação não chama Action de reserva nem limpa rascunhos. Preservar confirmação atual ao trocar efetivamente de empresa com anotações.

- [x] **Step 5: Rodar verde.** Repetir os direcionados; `npm run test:unit -- src/features/prospeccao src/features/fila app/fila src/server/grupos src/server/db/migracoes/invariantes.test.ts`; `npm run test:integracao -- tests/integracao/prospeccao-grupos.test.ts tests/integracao/prospeccao-consulta.test.ts tests/integracao/fila-reservar.test.ts tests/integracao/fila-puxar.test.ts`; `npm run typecheck`. Confirmar os contratos sem grupo e erros recuperáveis de grupo nos dois papéis.
- [x] **Step 6: Regenerar inventário, revisar e commit.** Revisão SDD inclui o cenário bloqueado por desativação e os retornos precoces da reserva, evitando que a proteção exista apenas na aplicação. Commit: `feat: restringir consulta e reserva ao grupo selecionado`.

## Task 5: Catálogo de listas para vendedores e jornada completa no navegador

**Files:**

- Create: `db/migracoes/0037_prospeccao_catalogo_grupos.sql`, `docs/db/0037.md`, `app/fila/grupos.tsx`, `app/fila/grupos.test.tsx`, `app/fila/grupos.module.css`, `tests/e2e/prospeccao-grupos.spec.ts`.
- Modify: `src/server/grupos/prospeccao.ts`, `src/server/grupos/prospeccao.test.ts`; `app/fila/page.tsx`, `app/fila/entrada-sem-reserva.tsx`, `app/fila/entrada-sem-reserva.test.tsx`; `src/server/db/migracoes/invariantes.ts`, `src/server/db/migracoes/invariantes.test.ts`; `tests/integracao/prospeccao-grupos.test.ts`; `tests/e2e/dados-grupos.ts`, `tests/e2e/grupos-importacao.spec.ts`; `tests/inventario-unitario.txt`.

- Modify after chooser URL ruling: `app/fila/localizar/page.tsx` and its component tests render the catalog when `escolher_lista=1`, because lookup/profile chooser links target this route. Preserve current filtros and independent catalog pagination; closing chooser does not reset the search.

- Modify existing journeys `tests/e2e/consulta.spec.ts`, `recentes.spec.ts`, `reserva.spec.ts`, `retorno-combinado.spec.ts`: navigate through real catalog/search links after the approved new landing. Keep group/refinements on post-contact search and all existing result, pagination, history and privacy assertions; verify contact/form disappears on landing as well. No contact Action behavior change.

- Modify for composition fixture: `app/fila/formulario.dom.test.tsx`; retain actual links, notes, instance/context and zero-Action assertions.
- Read-only consumer verification: `app/fila/entrada-reserva.test.tsx` and `app/fila/localizar/componentes.test.tsx`; new page/catalog compositions are exercised in `app/fila/grupos.test.tsx`, preserving existing tests without cosmetic hunks.

- Modify `tests/e2e/dados-funil.ts` only for the existing today-return civil date: use the agenda explicit America/Sao_Paulo date after measured UTC boundary failure; preserve all domain behavior and assertions.

- Preparatory build fix: `app/whatsapp/page.tsx` and its existing page callers in tests remove the optional default page argument rejected by generated Next PageProps, preserving all behavior and assertions. Local E2E uses explicit Webpack build because the managed dependency junction is outside Turbopack root; normal CI build remains unchanged.

**Interfaces:**

- Consumes: `GrupoProspeccao`, `selecionarGrupo`, `urlConsulta`, consulta/reserva por grupo da tarefa 4.
- SQL: `grupos_prospeccao_listar(p_pagina integer DEFAULT 1)` devolve somente os campos comerciais do DTO, 21 linhas por página, grupos ativos, com os mesmos predicados de contagem de `grupo_prospeccao_ler`.
- `listarGruposProspeccao(usuarioId:string,pagina=1): Promise<{ok:true;grupos:GrupoProspeccao[];temProxima:boolean}|{ok:false;motivo:'sem_permissao'}>` corta a linha 21. Validar página inteira entre 1 e 10.000, sem converter valor inválido em seleção global.
- `GruposProspeccao({grupos,pagina,temProxima,escolha}: {grupos:GrupoProspeccao[];pagina:number;temProxima:boolean;escolha?:{filtros:Filtros;atendimento:boolean}})` apresenta os cartões. Sem escolha contextual, a paginação usa `listas_pagina` em `/fila`, independente da `pagina` de empresas. Com escolha, usa `urlEscolhaLista(filtros,atendimento,true)` e preserva grupo/refinamentos/página da busca, acrescentando só `listas_pagina`. No atendimento, selecionar cartão aponta para `/fila?grupo=...`, preservando Formulario/draft; na busca e sem reserva segue para `/fila/localizar?grupo=...`. Só a seleção efetiva usa `selecionarGrupo` para resetar refinamentos/página.

- [x] **Step 1: Escrever teste vermelho de cartões antigos/novos e contagens privadas.**

```tsx
test('explica uma lista antiga sem inventar a origem', () => {
  const html = renderToStaticMarkup(<GruposProspeccao grupos={[{
    id:'00000000-0000-4000-8000-000000000701',nome:'Mooca',descricao:null,origem:null,criterios:null,
    criadoEm:'2026-10-13T12:00:00Z',total:3,disponiveis:1,
  }]} pagina={1} temProxima={false} />)
  expect(html).toContain('Origem não informada')
  expect(html).toContain('Prospectar esta lista')
  expect(html).toContain('grupo=00000000-0000-4000-8000-000000000701')
})
```

SQL: duas listas compartilham B, uma inclui cliente, carteira, reserva vigente e descanso. Cada total conta suas empresas distintas; disponíveis exclui essas condições e não considera a própria reserva como nova candidata. Confirmar página 1/2 com 21 listas, desempate estável, lista sem membros com contagem zero e grupo desativado ausente. Pelo vendedor, `SELECT * FROM grupo_importacao` continua sem linhas e o resultado público não contém `arquivo_nome`, `pedido`, `assinatura` ou autor administrativo.

- [x] **Step 2: Escrever a jornada E2E antes dos cartões.** Em `prospeccao-grupos.spec.ts`, usar o banco temporário de `dados-grupos.ts` e credenciais sintéticas já preparadas; montar lote CSV de nove colunas sem CNPJ, importar como gestor com resumo/origem/termos, conferir que análise não mudou tabelas, confirmar e entrar como vendedor.

```ts
const nomeLista = 'Mooca | Jornada de prospecção fictícia'
await page.goto('/fila')
const cartao = page.locator('article').filter({ has:page.getByRole('heading', { name:nomeLista,exact:true }) })
await cartao.getByRole('link', { name:'Prospectar esta lista',exact:true }).click()
await expect(page).toHaveURL(/\/fila\/localizar\?.*grupo=/)
await expect(page.getByText('Lista da próxima busca', { exact:true })).toBeVisible()
await page.getByLabel('Nome', { exact:true }).fill('Aurora')
```

O CTA de cada cartão é um link com estilo de botão. O cenário de importação anterior utiliza exatamente `nomeLista`, para localizar seu cartão sem confiar na posição global após a preparação de outras jornadas.

Completar os cenários: grupo isolado com mais de 20 empresas para paginação; refinar/limpar mantendo grupo; abrir perfil/voltar; reservar e puxar próxima da lista; mostrar nome comercial e CNPJ desconhecido no atendimento; registrar contato e assumir no fluxo atual; listar na Carteira/Meu dia/Funil/gestão; reimportar sem duplicar UUID; corrigir metadados como gestor; vendedor sem controles de edição; grupo desativado entre tela e Action com aviso; reserva/anotações vigentes ao mudar lista; contexto selecionado sem alegar origem da reserva atual. Usar seletores semânticos dos formulários atuais e não inserir dados reais na suíte.

- [x] **Step 3: Rodar vermelho.** `npm run test:unit -- app/fila/grupos.test.tsx`; `npm run test:integracao -- tests/integracao/prospeccao-grupos.test.ts`. Esperado: catálogo/componente ausentes. A primeira execução E2E pelo harness deve falhar na ausência do cartão escolhido.
- [x] **Step 4: Implementar leitor e catálogo.** Criar a função de listagem com os mesmos guardas e privacidade da leitura individual; conceder apenas junto com o consumidor e whitelist. Compartilhar o predicado de contagem num helper SQL interno sem concessão, se a duplicação entre leitura individual/listagem for necessária. O helper, se criado, tem assinatura `grupo_prospeccao_contagens(p_grupo uuid) RETURNS TABLE(total integer,disponiveis integer)`, usada pelos dois leitores; migrar a contagem individual para ele nesta tarefa.

Na entrada sem reserva, renderizar catálogo ativo e opção “Todas as listas ativas”; reserva vigente mantém o formulário de atendimento prioritário e acesso à busca por lista. Cartão usa nome, descrição, origem, data, total/disponíveis e `<details><summary>Critérios usados</summary>...</details>` quando houver texto. O CTA é `<Link href={urlConsulta(selecionarGrupo(grupo.id),1)}>Prospectar esta lista</Link>`. Campos são texto simples, nunca HTML. Grupo sem disponíveis conserva contexto visível e o estado vazio explica a falta de candidatas.

Manter o estilo do CRM, contraste/foco e tema existente. Verificar larguras 390, 820 e 1.280 px, sem rolagem horizontal, com critérios extensos e nomes longos. Não redesenhar Carteira/Meu dia. Teclado alcança escolher lista, expandir critérios, refinar, limpar e próxima página.

- [x] **Step 5: Rodar verde e verificar o fluxo completo.** `npm run test:unit -- app/fila src/server/grupos`; `npm run test:integracao -- tests/integracao/prospeccao-grupos.test.ts`; `npm run test:e2e` pelo harness atual. O runner atual não repassa filtros de nome de spec; não usar comandos que aparentem selecionar um teste e rodem outra coisa. Registrar screenshots dos novos estados e resultado das jornadas. Usar `build:e2e` + `test:e2e -- --sem-build` apenas quando o código não mudou desde esse build.
- [x] **Step 6: Regenerar inventário, revisar e commit.** Revisor verifica privacidade, contagens, duas origens, navegação/rascunhos e evidências de celular/desktop. Commit: `feat: apresentar listas de prospeccao com origem e disponibilidade`.

## Task 6: Preparar o arquivo da Mooca com rastreabilidade e pendências

**Files:**

- Create: `scripts/importacao/mooca.mts`, `src/server/importacao/mooca-adaptador.ts`, `src/server/importacao/mooca-adaptador.test.ts`.
- Saídas locais, fora do commit: `outputs/01a13557-7004-7c53-be04-5cff6181c96a/mooca-grupo-2026-10-13/empresas-crm.csv`, `pendencias.csv`, `rastreio.json`, `grupo.json`. Não sobrescrever o ZIP nem o XLSX anterior.
- Modify: `tests/inventario-unitario.txt`. O entrypoint é um arquivo .mts, conforme a regra do projeto para top-level await.

**Interfaces:**

- Consumes: CSV extraído `empresas_mooca.csv`, os nove campos do contrato da tarefa 2, metadados da tarefa 3 e fontes preservadas no ZIP.
- `FonteMooca = { nome_empresa:string; cnpj:string; razao_social:string; telefone:string; email:string; cep:string; place_id:string; termo_pesquisado:string; fontes_email:string; fontes_conferencia:string; observacoes:string }`.
- `adaptarMooca(linhas:FonteMooca[]): { csv:string; pendencias:{placeId:string;nome:string;motivo:string}[]; rastreio:{placeId:string;fontes:string;emailsOriginais:string;emailEscolhido:string|null;observacoes:string}[] }` em `server/importacao`, sem conexão de banco.
- CLI: `npx tsx scripts/importacao/mooca.mts --entrada <empresas_mooca.csv> --zip-fonte <entrega.zip> --saida <pasta-nova>`. A entrada deve ser CSV da entrega; o script não extrai ZIP nem navega na internet. O ZIP é lido somente para calcular SHA-256. Escrever em diretório novo, rejeitar destino já existente e registrar SHA-256 da entrada e do ZIP original no rastreio.

- [x] **Step 1: Testar adaptação sem preencher desconhecidos.**

```ts
test('preserva Place ID e separa cadastro sem telefone', () => {
  const fonte: FonteMooca = { nome_empresa:'Aurora',cnpj:'',razao_social:'',telefone:'11987654321',email:'',cep:'03119010',
    place_id:'ChIJ-ficticio-a',termo_pesquisado:'CFTV Mooca',fontes_email:'',fontes_conferencia:'https://empresa.test',observacoes:'' }
  const r = adaptarMooca([fonte,{...fonte,nome_empresa:'Boreal',place_id:'ChIJ-ficticio-b',telefone:''}])
  const a = analisarPlanilha(new TextEncoder().encode(r.csv))
  expect(a.ok && a.aceitas.length).toBe(1)
  expect(a.ok && a.aceitas[0]).toMatchObject({cnpj:null,razaoSocial:null,nomeFantasia:'Aurora',googlePlaceId:'ChIJ-ficticio-a'})
  expect(r.pendencias).toContainEqual({placeId:'ChIJ-ficticio-b',nome:'Boreal',motivo:'telefone_ausente'})
})
```

Testar nomes com vírgula/aspas, telefone normalizado, CEP com zero, email com mais de um endereço preservado no rastreio, placeholder de email ignorado e dois anúncios com telefone compartilhado sinalizados sem fusão. Usar fixtures sintéticas; dados reais ficam nas saídas locais.

- [x] **Step 2: Rodar vermelho.** `npm run test:unit -- src/server/importacao/mooca-adaptador.test.ts`. Esperado: adaptador ausente.
- [x] **Step 3: Implementar adaptação e executar em modo de preparação.** Mapeamento exato: `nome_empresa → nome_fantasia`, `place_id → google_place_id`, `cnpj/razao_social` conhecidos preservados, `contato_nome/cnae_principal` vazios quando desconhecidos. Usar os normalizadores existentes e escape CSV `"${valor.replace(/"/g,'""')}"`; reanalisar a saída pelo parser real antes de escrevê-la.

Telefone ausente/ inválido vai para pendências. Mais de um email publicado: selecionar o primeiro endereço válido da coluna conferida `email`, conservando todos no rastreio; não usar `emails_motor_nao_reconfirmados`. Não importar `example@gmail.com`. Registrar separadamente a escolha quando existirem alternativas e fontes. Telefone compartilhado gera aviso de possível duplicidade no rastreio e em `pendencias.csv`, mas não apaga nem mescla as linhas válidas. O resumo diferencia pendência impeditiva de aviso; as contagens de linhas prontas não são contagens de compradores distintos qualificados.

No lote real, recontar 45 selecionadas, 43 com telefone e duas pendentes sem telefone. Sinalizar GABSENS/Conserto Notebook por telefone compartilhado e IDs distintos, conservando as fontes e os dados de contato somente no rastreio da saída local. Preservar a divergência de CEP da JRC entre Maps e a conferência anterior, sem importar silenciosamente o CEP de outra fonte. Não acrescentar automaticamente os CNPJs de outra lista por semelhança de nome/telefone; o cadastro existente pode reconhecer CNPJ somente quando publicado/documentado na entrada ou por Place ID já associado.

A divergência conhecida de CEP da JRC é anotação local complementar da preparação, com referência/hash do XLSX anterior do piloto separados das colunas originais. O passo ignorado após o CLI usa o CNPJ publicado exato para obter o Place ID; não introduz identificadores reais no código versionado. Registrar esse passo e revalidar as saídas finais, mantendo o CEP da entrega.

`grupo.json` usa: nome “Mooca | Segurança, informática e eletrônicos”; descrição “Empresas de segurança eletrônica, informática, eletrônicos e automação na região da Mooca, selecionadas para qualificação comercial.”; origem “Coleta por web scraping no Google Maps, com conferência de contatos publicados nos sites das empresas.”; critérios com os oito termos **reais** do lote: loja de câmeras de segurança Mooca São Paulo SP; distribuidora CFTV Mooca São Paulo SP; distribuidora segurança eletrônica Mooca São Paulo SP; loja de informática Mooca São Paulo SP; loja de eletrônicos Mooca São Paulo SP; automação residencial Mooca São Paulo SP; instalador CFTV Mooca São Paulo SP; segurança eletrônica Mooca São Paulo SP. Preservar o contexto do piloto/rastreamento, sem afirmar compra em caixas ou atividade comercial ainda não confirmada.

- [x] **Step 4: Rodar verde e conferir o resultado sem gravar no CRM.** Repetir o unitário; extrair a entrega original em um diretório temporário novo e usar seu `empresas_mooca.csv` no comando abaixo. A extração não altera o ZIP e a leitura deve validar que o nome escolhido fica dentro do diretório temporário.

```powershell
$entradaMooca = Join-Path ([IO.Path]::GetTempPath()) ('crm-mooca-' + [guid]::NewGuid().ToString('N'))
$zipMooca = 'C:\Users\ADM\Desktop\Web Scraping\coleta_mooca_2026-10-13\entrega_mooca_2026-10-13.zip'
Expand-Archive -LiteralPath $zipMooca -DestinationPath $entradaMooca
$csvMooca = Join-Path $entradaMooca 'empresas_mooca.csv'
if (-not (Test-Path -LiteralPath $csvMooca -PathType Leaf)) { throw 'CSV selecionado ausente na entrega' }
npx tsx scripts/importacao/mooca.mts --entrada $csvMooca --zip-fonte $zipMooca --saida 'outputs/01a13557-7004-7c53-be04-5cff6181c96a/mooca-grupo-2026-10-13'
if ($LASTEXITCODE -ne 0) { throw 'A preparação da Mooca falhou' }
```

Conferir cabeçalho/quantidade pelo parser real, hashes, ID de cada linha, alertas e limites de `grupo.json`. ZIP tem 45 selecionadas e 43 telefones, mas o resultado deve ser medido de novo, não fixado artificialmente em 43 aceitas se outro campo for inválido.
- [x] **Step 5: Revisar e commit somente do código.** Regenerar inventário, revisar os alertas e fornecer os arquivos preparados ao usuário. Commit: `feat: preparar coleta da Mooca para importacao rastreavel`. A importação efetiva é posterior à disponibilização da versão e à conferência do arquivo pelo gestor.

## Task 7: Verificação final, revisão da branch e PR

**Files:** revisão dos arquivos das tarefas 1 a 6, da especificação e deste plano; sem novos componentes. Atualizar status/checklists do plano e docs das migrações com evidências. Não incluir `.bases/`, `outputs/`, catálogo comercial ou coleta bruta no PR.

**Interfaces:** consome os contratos implementados e evidências de cada tarefa; produz PR revisável, CI e arquivos da Mooca preparados. Nenhuma migração/importação/publicação em produção integra este resultado.

- [x] **Step 1: Validar escopo e evidências de TDD.** Para cada requisito da matriz abaixo, apontar teste e commit. Revisar retornos de reserva, overloads concedidos, dependências entre features e o comportamento dos consumidores com nulos. Registrar divergências da especificação e suas decisões no ledger SDD, com custo caso estejam erradas.
- [x] **Step 2: Rodar os gates finais uma vez no código final.** Se a tarefa 5 já executou uma suíte sem alterações posteriores naquele código, reutilizar a evidência; após mudanças relevantes, repetir somente os gates atingidos. A base completa de fechamento é:

```text
npm run typecheck
npm run lint
npm run db:checar
npm run test:inventario
npm run test:integracao
npm run build:e2e
npm run test:e2e -- --sem-build
git diff --check
```

`test:inventario` já executa a suíte unitária inteira; não rodar outra vez `test:unit` somente para duplicar evidência. Integração/E2E devem usar exclusivamente o banco temporário local. Conferir que os checksums das migrações 0001 a 0032 não mudaram e que cada nova migração aplica desde banco vazio. Não chamar verificação de produção nem trocar variáveis de conexão para completar teste local.

- [x] **Step 3: Revisão independente da branch inteira.** Entregar o diff desde o merge-base, especificação, plano, relatórios de teste e ledger ao revisor SDD final, incluindo achados adiados e decisões. Resolver achados com um implementador e uma revisão do diff de correção conforme a skill; sem alterações silenciosas pelo controlador.
- [ ] **Step 4: Preparar PR e acompanhar CI.** Confirmar branch com guarda, estado do índice e arquivos do escopo; commit das evidências/documentos somente quando necessário. Criar PR com problema/resultado, migrações novas, novos contratos, testes e limite do lote da Mooca. Anexar o URL do PR ao chat com `attach_artifact`. Não fazer merge automático nem mudar produção. Se gates locais não puderem rodar, informar precisamente quais faltam; não declarar CI verde por inferência.
- [ ] **Step 5: Entregar o resultado.** Informar funcionalidades verificadas, PR/CI, arquivos preparados e eventuais limitações de dados. Relacionar decisões registradas no ledger conforme a skill SDD. Operações seguintes: implantação da versão, aplicação das migrações verificadas e conferência/importação do grupo pelo gestor, em etapa própria.

## Rastreabilidade e critérios de conclusão

| Requisito aprovado | Tarefa | Evidência exigida |
|---|---:|---|
| UUID e histórico preservados; CNPJ/razão social opcionais | 1, 2 | Persistência parcial, busca, leitura em todos os módulos, reimportação e complemento |
| Telefone e um nome conhecido; CNPJ inválido recusado | 1, 2 | Negativos de parser e SQL, incluindo DV numérico/alfanumérico |
| Cabeçalhos 7/8 preservados, novo 9; CSV/XLSX protegidos | 2 | Compatibilidade, limites, fórmula negada e modelo gerado |
| Identidade por Place ID, conflitos e duplicatas | 2 | Identificadores distintos/nulos, duas origens por empresa, conflito sem fusão |
| Conferência sem escrita e pedido idempotente | 2, 3 | Snapshot antes/depois; repetição e mudança de metadados recusada |
| Resumo/origem/critérios e correção auditada pelo gestor | 3 | Limites Unicode, controles, edição autorizada e vendedor negado |
| Catálogo ativo, contagens reais, contexto antigo legível | 4, 5 | Distintos, elegibilidade, privacidade, paginação e estado sem origem |
| Grupo AND nome/CNAE/local; opções e reserva restritas | 4 | SQL direto, alvo fora da lista, próxima candidata e grupo desativado |
| Reserva/anotações preservadas e grupo carregado nas URLs | 4, 5 | Corrida de desativação, navegação e jornada de atendimento |
| Apresentação no celular/desktop e teclado | 5 | E2E e revisão nas três larguras, temas e foco |
| Arquivo da Mooca pronto, fontes e pendências preservadas | 6 | Parser real, hashes, dois telefones ausentes e possível duplicidade sinalizada |
| Branch, PR, CI e revisão final | 7 | Gates com saída verificada, revisão independente e PR anexado |

## Evidências de execução da branch

Base remota main conferida: `30099cfc509ebb9f5ac618b74f60446d24206640`. Código das tarefas 1–6 entregue até `ee07120909f30e98cdd149e01861dad04e9283de`, com revisão de conformidade e qualidade aprovada em cada tarefa. Execuções vermelhas comportamentais precederam as implementações; erros de instalação/build não foram contados como TDD.

| Requisito | Testes/artefatos verificados | Commits |
| --- | --- | --- |
| Cadastro parcial, apresentação e UUID | `tests/integracao/empresa-cadastro-parcial.test.ts`, `src/lib/empresa-apresentacao.test.ts`, consumidores existentes | `36a9d66` |
| Identidade Google e conflito sem fusão | `tests/integracao/empresas-origem-google.test.ts`, `src/features/empresas/identidade.test.ts`, parser e reimportação | `1ea20dd`, `68dd564`, `27620de` |
| Conferência sem escrita e transporte confiável | `src/features/empresas/conferencia.test.ts`, `app/empresas/importar/formulario-transporte.test.tsx`, protocolo/replay SQL | `68dd564`, `27620de`, `90ccd67` |
| Metadados, Unicode e edição autorizada | `tests/integracao/grupos-metadados.test.ts`, formulário/Action/validador de metadados | `90ccd67` |
| Consulta/reserva AND grupo, concorrência e contexto | `tests/integracao/prospeccao-consulta.test.ts`, `prospeccao-grupos.test.ts`, `app/fila/formulario.dom.test.tsx` | `9bfb2ca`, `6ab7ec0` |
| Catálogo privado/ativo, contagens e paginação | `app/fila/grupos.test.tsx`, `src/server/grupos/prospeccao.test.ts`, integração catálogo | `fd37751` |
| Jornada, rascunho, temas e teclado | `tests/e2e/prospeccao-grupos.spec.ts`, suite original completa e 18 capturas locais/6 snapshots AX | `fd37751` |
| Mooca: desconhecidos, fontes e pendências | `src/server/importacao/mooca-adaptador.test.ts`, CLI real e verificador local de hashes/parser/originais | `ee07120` |

Gates finais no código `7398e00`: unitário completo/inventário **1251 PASS + 1 SKIP**, integração completa **587 PASS + 1 SKIP**, E2E original completo **44 PASS**, typecheck/lint global/checador de migrações exit0 e diff-check desde a base limpo. O build local usou `--webpack` devido à junction de dependências fora da raiz do Turbopack; CI conserva o build padrão e continua como gate próprio antes do merge. O E2E final usa a aplicação recompilada após a correção da conferência; seu banco temporário foi removido pelo harness. Os 38 arquivos SQL versionados (0000–0037) mantêm os hashes; integração aplica o histórico em bancos temporários vazios locais. Nenhuma operação em produção.

A revisão integral identificou a conferência de aliases que resolvem ao mesmo UUID e quatro ajustes concretos de títulos/documentação. A única wave de correção `7398e00` recusa todas essas linhas antes da confirmação, preserva seleção assinada/conflito posterior/replay, corrige títulos na fonte e regenera fielmente o inventário, atualiza a documentação do recibo e remove o contato real do plano. Evidências: `src/features/empresas/servico.test.ts`, `conferencia.test.ts`, `mensagens.test.ts`, `tests/integracao/empresas-origem-google.test.ts` e teste de transporte do formulário. A re-revisão focal encerrou os cinco achados sem nova quebra.

Duas execuções locais iniciais falharam: timeout do teste de exportação de Server Action e caso de limite de conexões do pool. Os testes inalterados passaram isoladamente e nas execuções integrais finais, com os limites e assertions preservados; as causas não foram demonstradas. Logs de falha e de sucesso foram conservados. O lint global também detectou um auxiliar local de auditoria não versionado; ele foi arquivado como texto com hash idêntico antes do lint final verde. Avisos existentes de Vite/DEP0190 e flags de cor permanecem registrados; não houve correção especulativa de streams/act/timestamp. O defeito comprovado de data civil da fixture Funil segue separado, usando a data de São Paulo.

Saídas locais da Mooca: 45 originais preservadas/43 linhas válidas no CSV, duas impeditivas por telefone ausente, três avisos (dois anúncios com telefone compartilhado e uma divergência de CEP). ZIP, XLSX anterior e fontes preservados; código usa fixtures sintéticas. Não são contagens de compradores qualificados. Conferência/importação pelo gestor e implantação seguem como operações posteriores.

## Autorrevisão do plano

- Todas as seções da especificação têm tarefa e evidência na matriz.
- Contratos novos têm nome, parâmetros, retorno, consumidor e localização definidos; tarefas dependentes são sequenciais.
- Os cinco riscos de Review Focus possuem testes nas tarefas responsáveis.
- As tarefas 1 a 6 definem vermelho, implementação, verde e revisão; a tarefa 7 verifica a entrega, sem inventar teste falhando para código já correto.
- A publicação e a importação real não foram antecipadas como tarefas de código. O arquivo da Mooca permanece uma base de candidatos para qualificação, com desconhecidos e alertas visíveis.
