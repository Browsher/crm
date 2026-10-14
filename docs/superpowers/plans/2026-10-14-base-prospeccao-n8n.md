# Planilha base e validação de WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma planilha Google Sheets privada com as 45 empresas da Mooca e um workflow manual que conserve empresas distintas e consulte cada telefone uma vez.

**Architecture:** Regras puras em `src/lib/prospeccao-base/`, adaptadores de arquivo e geração do workflow em `src/server/prospeccao-base/` e comandos em `scripts/prospeccao-base/`. A planilha tem Empresas, Telefones e Coletas. O workflow recebe CSV, lê as três abas, consolida por identidade, grava sequencialmente e consulta a Evolution; não faz importação automática no CRM.

**Tech Stack:** Node 24, TypeScript, Vitest 5, n8n, Google Sheets, Evolution API 2.3.7; runtime de planilhas com `@oai/artifact-tool` fornecido pelo aplicativo. Sem nova dependência de produção.

**Spec:** `docs/superpowers/specs/2026-10-14-base-prospeccao-n8n-design.md`, aprovada pelo usuário em 14/10/2026.

## Global Constraints

- O workflow não envia mensagens.
- Nome semelhante, endereço ou telefone compartilhado não autorizam fundir duas empresas automaticamente.
- Nunca acrescentar ou retirar nove automaticamente para tentar obter um resultado positivo.
- Se Place ID e CNPJ apontarem para empresas diferentes, parar a vinculação e marcar conflito para revisão do gestor.
- A v1 opera com uma importação por vez, escrita sequencial e conferência final de duplicidades.
- Não alterar o limite global de concorrência do n8n, pois isso afetaria outros workflows.
- Planilha privada, compartilhamento adicional somente quando solicitado.
- Telefones, CNPJ e CEP são texto para conservar zeros e formato.
- Credenciais permanecem em configuração privada, nunca na planilha ou no JSON exportado do workflow.
- Instalar somente em `NxCO8HiaJmwqJ8jK`, projeto `mIsmhrUTAVI1ZPnf`, no n8n indicado pelo usuário.
- Branch + PR. Nunca commit na main. TDD: teste falhando primeiro.
- Este plano não altera as 43 empresas no CRM. Endereços completos no CRM são tratados no plano `2026-10-14-enderecos-google-crm.md`.

## Review Focus

1. Telefone fixo, celular, DDI e ausência de DDD: preservar número publicado; formato incompleto fica pendente. Tarefa 1.
2. Mesmo telefone em duas empresas, CNPJ/Place ID conflitantes e repetição divergente no próprio arquivo: não fundir nem escolher silenciosamente. Tarefa 2.
3. Células começando com "=" e IDs/CEP com zero: conservar texto literal no Google Sheets, inclusive depois da conversão. Tarefa 3.
4. 429/5xx, timeout, desconexão, retorno duplicado ou sem exists booleano: inconclusivo; nenhuma falha vira resultado negativo. Tarefa 4.
5. Falha depois de uma escrita e reexecução da mesma coleta: recuperar por chave, preservar revisão humana e bloquear relatório de sucesso se houver duplicidades. Tarefas 2, 5 e 6.

---

## Ordem e insumos

Executar tarefas 1 → 2 → 3 → 4 → 5 → 6. O plano de endereços do CRM pode começar depois, sem depender da autenticação n8n.

Worktree já anexado: `C:/Users/ADM/.codex/worktrees/producao-vercel/crm`; branch `codex/base-prospeccao-n8n`; PR de desenho/plano [#53](https://github.com/Browsher/crm/pull/53). Antes de implementar, ler a spec, PREFERENCIAS.md e REGRAS.md; verificar branch e arquivos alterados. Não incluir `.superpowers/`, dados coletados, ambientes privados ou arquivos de outra tarefa no commit.

Insumos reais, somente para execução local:

- Original completo: `C:/Users/ADM/.codex/worktrees/prospeccao-grupos-cnpj-opcional/crm/outputs/01a13557-7004-7c53-be04-5cff6181c96a/mooca-grupo-2026-10-13/rastreio.json`, propriedade `fontesOriginais` com 45 registros. A propriedade `linhas` não contém o endereço original.
- Metadados: `grupo.json` na mesma pasta, com descrição, origem e os oito termos pesquisados.
- Resultados medidos: `C:/Users/ADM/projetos/crm/outputs/mooca-validacao-2026-10-14/whatsapp-resultados.json`, com 42 números, 29 encontrados e 13 não encontrados.
- Esses arquivos não são fixtures versionadas. Testes usam empresas fictícias. A reconciliação real é uma verificação operacional com relatório sem credenciais.
- Criar artefatos locais em `outputs/base-prospeccao-2026-10-14/` e trabalho de render em `.artifact-work/base-prospeccao/`; não incluir em deploy Vercel.

## Mapa de arquivos e contratos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/cnpj.ts` | Implementação atual de normalização/DV, movida sem alteração de comportamento |
| `src/features/empresas/cnpj.ts` | Reexportação compatível do módulo comum |
| `src/lib/prospeccao-base/modelo.ts` | Tipos, cabeçalhos e vocabulários das três abas |
| `src/lib/prospeccao-base/telefone.ts` | Normalização conservadora com DDI |
| `src/lib/prospeccao-base/consolidar.ts` | Identidades, associações, pendências e plano de gravação |
| `src/lib/prospeccao-base/whatsapp.ts` | Classificação de respostas e seleção de consulta |
| `src/server/prospeccao-base/entrada.ts` | Adapter dos 35 campos da coleta Mooca |
| `src/server/prospeccao-base/semente.ts` | Reconciliação das fontes e consultas já feitas |
| `src/server/prospeccao-base/workflow.ts` | JSON n8n gerado e grafo das operações |
| `src/server/prospeccao-base/codigo-n8n.ts` | Compilação dos módulos puros para Code nodes |
| `src/server/prospeccao-base/instalar.ts` | API pública n8n, alvo fixo, comparação e leitura posterior |
| `scripts/prospeccao-base/preparar.mts` | Geração local de dados para planilha |
| `scripts/prospeccao-base/gerar-workflow.mts` | Exportação sem credenciais nem dados reais |
| `scripts/prospeccao-base/instalar.mts` | Instalação autenticada, sem ativação automática |
| `docs/operacao/base-prospeccao-n8n.md` | Dicionário, mapeamento e operação manual |
| `.gitignore` | Ignorar somente os novos diretórios de artefatos desta feature |

Todos os testes de módulos ficam ao lado, com sufixo `.test.ts`, para entrar no projeto unitário do Vitest. Scripts apenas orquestram funções testadas; não adicionar uma suíte fora dos padrões descobertos.

Contratos a criar em `modelo.ts`:

```ts
export type FonteMaps = Record<string, string> & {
  place_id: string
  nome_empresa: string
  cnpj: string
  telefone: string
  endereco: string
  link_maps: string
}
export type EstadoWhatsApp = 'pendente' | 'encontrado' | 'nao_encontrado' | 'inconclusivo'
export type EmpresaBase = {
  id: string
  placeIds: string[]
  cnpj: string | null
  publicados: FonteMaps
  telefoneNormalizado: string | null
  coletas: string[]
  revisao: 'pendente' | 'revisada' | 'telefone_compartilhado'
  observacoes: string
}
export type TelefoneBase = {
  numero: string
  tipo: 'fixo' | 'celular'
  empresas: string[]
  estado: EstadoWhatsApp
  numeroRetornado: string | null
  jid: string | null
  verificadoEm: string | null
  statusHTTP: number | null
  motivo: string | null
  revalidar: boolean
}
export type ColetaEntrada = {
  id: string
  execucaoId: string
  fonte: string
  regiao: string
  termos: string[]
  data: string
  arquivo: string
  sha256: string
}
export type Ocorrencia = {
  chave: string
  coleta: ColetaEntrada
  tipo: 'resumo' | 'ocorrencia'
  linha: number | null
  empresaId: string | null
  fonteOriginal: FonteMaps | null
  motivos: string[]
  contagens: Record<string, number>
}
export type Base = { empresas: EmpresaBase[]; telefones: TelefoneBase[]; coletas: Ocorrencia[] }
export type PendenciaBase = { linha: number; motivo: string }
export type Consolidacao =
  | { ok: true; base: Base; pendencias: PendenciaBase[] }
  | { ok: false; motivo: 'base_duplicada' | 'entrada_invalida'; detalhes: string[] }
export type LinhaAba = Record<string, string>
```

Uma coleta tem um resumo e uma ocorrência por linha recebida na aba Coletas, distinguíveis pela coluna `tipo`. Isso conserva fontes anteriores e conflitos sem uma quarta aba ou JSON gigante numa célula. O resumo inicial é uma coleta, com 45 ocorrências. Nova execução acrescenta rastreabilidade; não duplica Empresas/Telefones. IDs de execução são UUID gerados no adaptador; ID da coleta é SHA-256 do conteúdo, nunca o nome do arquivo. ID inicial de empresa é `google:${place_id}`; reconhecimento posterior por CNPJ mantém o ID já existente e acrescenta Place ID ao conjunto de aliases.

### Task 1: Normalização e contrato de entrada

**Files:** Create `src/lib/cnpj.ts`, `src/lib/prospeccao-base/modelo.ts`, `telefone.ts`, `telefone.test.ts`, `src/server/prospeccao-base/entrada.ts`, `entrada.test.ts`. Modify `src/features/empresas/cnpj.ts`.

**Interfaces:** Consumes `normalizarCnpj(bruto: string): string | null`, `validarCnpj(cnpj: string): boolean`. Produces `normalizarNumero(bruto: string): { ok: true; numero: string; tipo: 'fixo' | 'celular' } | { ok: false; motivo: 'telefone_ausente' | 'ddd_ausente' | 'telefone_invalido' }` and `lerFontesMaps(linhas: Record<string, unknown>[]): { ok: true; fontes: FonteMaps[] } | { ok: false; motivo: 'entrada_invalida'; detalhes: string[] }`.

- [ ] **Step 1: Escrever testes falhando.**

```ts
import { expect, test } from 'vitest'
import { normalizarNumero } from './telefone'
test.each(['(11) 2606-1244', '+55 11 2606-1244'])('preserva fixo %s', bruto => {
  expect(normalizarNumero(bruto)).toEqual({ ok: true, numero: '551126061244', tipo: 'fixo' })
})
test('DDD ausente não é inferido pela região', () => {
  expect(normalizarNumero('2606-1244')).toEqual({ ok: false, motivo: 'ddd_ausente' })
})
test('telefone com ramal não é concatenado', () => {
  expect(normalizarNumero('(11) 2606-1244 ramal 2')).toEqual({ ok: false, motivo: 'telefone_invalido' })
})
```

Adicionar testes para celular com nove dígitos, vazio, letras, dois números na célula, UTF-8 inválido, cabeçalhos duplicados/ausentes e CEP começando em zero. CNPJ inválido fica registrado como pendência e não entra no índice de CNPJ; não apagar o valor publicado.

- [ ] **Step 2:** Run `npm run test:unit -- src/lib/prospeccao-base/telefone.test.ts src/server/prospeccao-base/entrada.test.ts`. Expected: falha por módulos ausentes.
- [ ] **Step 3: Implementar os contratos e o normalizador.**

```ts
export function normalizarNumero(bruto: string) {
  const texto = bruto.trim()
  if (!texto) return { ok: false as const, motivo: 'telefone_ausente' as const }
  const limpo = texto.replace(/[\s().-]/g, '').replace(/^\+/, '')
  if (/^[0-9]{8,9}$/.test(limpo)) return { ok: false as const, motivo: 'ddd_ausente' as const }
  const nacional = /^55[0-9]{10,11}$/.test(limpo) ? limpo.slice(2) : limpo
  if (!/^[0-9]{10,11}$/.test(nacional)) return { ok: false as const, motivo: 'telefone_invalido' as const }
  return { ok: true as const, numero: '55' + nacional, tipo: nacional.length === 10 ? 'fixo' as const : 'celular' as const }
}
```

Mover os três exports atuais de `cnpj.ts` para `lib/cnpj.ts`; o arquivo original passa a `export { normalizarCnpj, validarCnpj, pareceNotacaoCientifica } from '../../lib/cnpj'`. O adaptador exige strings, nome e Place ID; conserva os 35 campos originais e aceita adicionais como texto. Mapear campos pelo nome exato; nunca converter IDs em Number. CSV é UTF-8; delimitador e aspas são tratados antes da normalização.

- [ ] **Step 4:** Run os testes da Step 2 e `npm run test:unit -- src/features/empresas/cnpj.test.ts`; ambos verdes.
- [ ] **Step 5:** `git add src/lib/cnpj.ts src/features/empresas/cnpj.ts src/lib/prospeccao-base/modelo.ts src/lib/prospeccao-base/telefone.ts src/lib/prospeccao-base/telefone.test.ts src/server/prospeccao-base/entrada.ts src/server/prospeccao-base/entrada.test.ts`; `git commit -m "feat: normalizacao conservadora da base de prospeccao"`.

### Task 2: Consolidar empresas, telefones e ocorrências

**Files:** Create `src/lib/prospeccao-base/consolidar.ts`, `consolidar.test.ts`.

**Interfaces:** Consumes tipos da Tarefa 1 e `normalizarNumero`. Produces `consolidar(base: Base, fontes: FonteMaps[], coleta: ColetaEntrada): Consolidacao`. Não usa relógio, rede ou random dentro da função.

- [ ] **Step 1: Escrever teste falhando e factories locais.**

```ts
const vazia = (): Base => ({ empresas: [], telefones: [], coletas: [] })
const fonte = (place_id: string): FonteMaps => ({
  place_id, nome_empresa: 'Empresa fictícia ' + place_id, cnpj: '',
  telefone: '(11) 2606-1244', endereco: 'Rua do cenário, 10, sala 2', link_maps: 'https://maps.google.com/'
})
const coleta: ColetaEntrada = {
  id: 'a'.repeat(64), execucaoId: 'exec-1', fonte: 'Google Maps', regiao: 'Mooca',
  termos: ['CFTV'], data: '2026-10-14', arquivo: 'cenario.csv', sha256: 'a'.repeat(64)
}
test('duas empresas compartilham telefone sem fusão', () => {
  const r = consolidar(vazia(), [fonte('p1'), fonte('p2')], coleta)
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error(r.motivo)
  expect(r.base.empresas).toHaveLength(2)
  expect(r.base.telefones).toHaveLength(1)
  expect(r.base.telefones[0].empresas).toHaveLength(2)
  const novamente = consolidar(r.base, [fonte('p1'), fonte('p2')], { ...coleta, execucaoId: 'exec-2' })
  expect(novamente.ok && novamente.base.empresas.length).toBe(2)
  expect(novamente.ok && novamente.base.telefones.length).toBe(1)
})
```

Acrescentar: Place ID de A + CNPJ válido de B gera ocorrência conflitante e nenhuma fusão; duplicata idêntica no arquivo é consolidada com duas ocorrências; duplicata divergente fica pendente; fonte sem telefone continua em Empresas; número existente conserva WhatsApp/data; revisão e observação humana sobrevivem; nova fonte preserva o original anterior em Coletas. CNPJ fictício válido usar `11222333000181`, já presente nas fixtures do projeto, sem afirmar existência comercial.

- [ ] **Step 2:** Run `npm run test:unit -- src/lib/prospeccao-base/consolidar.test.ts`; esperado módulo ausente.
- [ ] **Step 3: Implementar resolução por índices antes de produzir escritas.**

```ts
const porPlace = new Map(base.empresas.flatMap(e => e.placeIds.map(p => [p, e] as const)))
const porCnpj = new Map(base.empresas.filter(e => e.cnpj !== null).map(e => [e.cnpj!, e]))
const porTelefone = new Map(base.telefones.map(t => [t.numero, t]))
const a = porPlace.get(fonteAtual.place_id)
const b = cnpjValido === null ? undefined : porCnpj.get(cnpjValido)
if (a && b && a.id !== b.id) {
  pendencias.push({ linha, motivo: 'identificadores_divergentes' })
} else {
  const existente = a ?? b
  const id = existente?.id ?? 'google:' + fonteAtual.place_id
  const telefone = normalizarNumero(fonteAtual.telefone)
  const numero = telefone.ok ? telefone.numero : null
  const empresas = numero === null ? [] : Array.from(new Set([...(porTelefone.get(numero)?.empresas ?? []), id])).sort()
  // Cada resultado é copiado para a nova Base, sem mutar a Base recebida.
}
```

A implementação percorre e valida a base existente antes da entrada: IDs, aliases, CNPJ e números duplicados bloqueiam a execução com `base_duplicada`. Para conflitos não gravar empresa nova como se estivesse resolvida: conservar a linha completa na ocorrência, motivo e pendência. Acrescentar associação somente após identidade resolvida; manter números antigos se uma nova fonte muda o telefone, com associação histórica e motivo de revisão. Revisão compartilhada prevalece sobre liberação comercial. Deduplicar aliases e empresas por telefone. Toda linha recebida ganha ocorrência com chave `execucaoId:linha`; resumo usa `execucaoId:resumo`. Reexecução parcial com o mesmo ID de execução atualiza por chave; novo ID registra nova ocorrência. Reconciliar base final antes de qualquer escrita.

- [ ] **Step 4:** Run teste da Step 2 e `npm run typecheck`; esperado verde.
- [ ] **Step 5:** `git add src/lib/prospeccao-base/consolidar.ts src/lib/prospeccao-base/consolidar.test.ts`; `git commit -m "feat: consolidacao por empresa e telefone com rastreio"`.

### Task 3: Preparar e criar a planilha nativa

**Files:** Create `src/server/prospeccao-base/semente.ts`, `semente.test.ts`, `scripts/prospeccao-base/preparar.mts`, `docs/operacao/base-prospeccao-n8n.md`. Modify `.gitignore`. Artefatos locais: `.artifact-work/base-prospeccao/criar-planilha.mjs` e `outputs/base-prospeccao-2026-10-14/`, nunca versionados.

**Interfaces:** Consumes `consolidar` e resultado JSON medido. Produces `prepararSemente(fontes: FonteMaps[], resultados: unknown, coleta: ColetaEntrada): Base`, que lança erro de reconciliação antes de escrever, e `serializarAbas(base: Base): Record<'Empresas' | 'Telefones' | 'Coletas', LinhaAba[]>`.

- [ ] **Step 1: Escrever teste falhando.**

```ts
test('consulta sem correspondência exata não é aplicada a outra empresa', () => {
  const base = prepararSemente([fonte('p1')], { resultados: [{
    telefone: '5511999999999', estado: 'encontrado', jid: '5511999999999@s.whatsapp.net',
    verificadoEm: '2026-10-14T12:00:00Z', statusHTTP: 200
  }] }, coleta)
  expect(base.telefones[0].estado).toBe('pendente')
})
```

Definir `fonte`/`coleta` no próprio teste conforme os tipos da Tarefa 1. Acrescentar resultados repetidos conflitantes, endereço com aspas/complemento, texto iniciando "=" e zeros em CEP/CNPJ. A carga real exige correspondência dos 42 números, 29/13/0; teste sintético não presume esses agregados.

- [ ] **Step 2:** Run `npm run test:unit -- src/server/prospeccao-base/semente.test.ts`; esperado falhar por módulo ausente.
- [ ] **Step 3: Implementar seed por correspondência exata e serialização somente de texto.**

```ts
const porNumero = new Map(resultadosConferidos.map(r => [r.telefone, r]))
const telefones = base.telefones.map(t => {
  const r = porNumero.get(t.numero)
  return r ? { ...t, estado: r.estado, jid: r.jid, numeroRetornado: r.telefone,
    verificadoEm: r.verificadoEm, statusHTTP: r.statusHTTP, revalidar: false } : t
})
const linha: LinhaAba = {
  numero: telefone.numero,
  tipo: telefone.tipo,
  empresas_ids: JSON.stringify(telefone.empresas),
  quantidade_empresas: String(telefone.empresas.length),
  whatsapp: telefone.estado,
  numero_retornado: telefone.numeroRetornado ?? '',
  jid: telefone.jid ?? '',
  verificado_em: telefone.verificadoEm ?? '',
  http: telefone.statusHTTP === null ? '' : String(telefone.statusHTTP),
  motivo: telefone.motivo ?? '',
  revalidar: telefone.revalidar ? 'sim' : 'nao'
}
```

Dicionário fixo de Empresas: `id,place_id,place_ids,cnpj,nome,razao_social,categoria,segmento,telefone_publicado,telefone_normalizado,email,site,endereco_publicado,bairro,cep,cidade,uf,link_maps,fonte_endereco,coletas_ids,data_coleta,revisao,observacoes`. Telefones usa o código acima. Coletas: `chave,coleta_id,execucao_id,tipo,fonte,regiao,termos,data,arquivo,sha256,linha,empresa_id,fonte_original,motivos,contagens`. Arrays/objetos são JSON textual com esquema validado; recusar célula acima de 49.000 caracteres antes de exportar, conservando o arquivo original e explicando a pendência. Não truncar.

CLI recebe `--rastreio`, `--whatsapp`, `--grupo` e `--saida`; usa diretório novo e escreve `base.json`, `reconciliacao.json` e um CSV do coletor completo para teste manual. Só resumo é impresso. Ignorar `/.artifact-work/base-prospeccao/` e `/outputs/base-prospeccao-2026-10-14/`.

Para criar a planilha, ler as skills Google Drive/Google Sheets/Spreadsheets e referências de criação, estilo e batch-update. Obter runtime com `load_workspace_dependencies`, marcar uma criação de XLSX com o helper da skill e usar `@oai/artifact-tool`:
```js
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool'
const workbook = Workbook.create()
for (const [nome, linhas] of Object.entries(abas)) {
  const sheet = workbook.worksheets.add(nome)
  const cabecalho = Object.keys(linhas[0])
  const valores = [cabecalho, ...linhas.map(l => cabecalho.map(c => l[c]))]
  let coluna = ''
  for (let n = cabecalho.length; n > 0; n = Math.floor((n - 1) / 26)) {
    coluna = String.fromCharCode(65 + (n - 1) % 26) + coluna
  }
  sheet.getRange('A1:' + coluna + valores.length).values = valores
  sheet.freezePanes.freezeRows(1)
}
await SpreadsheetFile.exportXlsx(workbook).then(arquivo => arquivo.save(caminhoXlsx))
```

Usar os métodos públicos de criação, formato, render e exportação documentados na skill; não inspecionar internals. Aplicar formato texto a IDs/telefones/CNPJ/CEP e células da fonte, valores literais sem fórmulas. Cabeçalho cinza claro, texto preto, fundo branco, filtros e wrap nos endereços. Renderizar para inspeção local. Procurar/criar pasta `ChatGPT` na conta Google conectada; converter com `import_spreadsheet(upload_mode: 'native_google_sheets')`. Ler metadados e intervalos depois da conversão; criar tabelas nativas nas três abas e dropdowns com a receita da skill. Não compartilhar.

- [ ] **Step 4:** Run testes da Step 2 e CLI sobre os arquivos reais. Conferir 45 Empresas, 42 Telefones, duas sem telefone, 29 encontrados/13 não encontrados e fontes completas. Ler valores e metadados do Google Sheets. Exportar a planilha nativa de volta a XLSX e renderizar essa exportação para verificar o resultado convertido; conferir que nenhuma célula de fonte foi interpretada como fórmula. Registrar ID/URL verificados no relatório local.
- [ ] **Step 5:** `git add src/server/prospeccao-base/semente.ts src/server/prospeccao-base/semente.test.ts scripts/prospeccao-base/preparar.mts docs/operacao/base-prospeccao-n8n.md .gitignore`; `git commit -m "feat: preparacao reconciliada da planilha base"`.

### Task 4: Classificar a resposta WhatsApp e limitar reconsultas

**Files:** Create `src/lib/prospeccao-base/whatsapp.ts`, `whatsapp.test.ts`.

**Interfaces:** Consumes `TelefoneBase`. Produces `precisaConsultar(telefone: TelefoneBase): boolean` e `classificarConsulta(numeros: string[], resposta: { statusHTTP: number | null; corpo: unknown; conectado: boolean; falha: string | null }, verificadoEm: string): TelefoneBase[]`. O resultado contém somente campos da consulta; os vínculos são recuperados do registro existente ao aplicar a atualização.

- [ ] **Step 1: Escrever teste falhando.**

```ts
test.each([429, 500, 503])('HTTP %s não descarta WhatsApp', statusHTTP => {
  const [r] = classificarConsulta(['551126061244'], {
    statusHTTP, corpo: [{ number: '551126061244', exists: false }], conectado: true, falha: null
  }, '2026-10-14T12:00:00Z')
  expect(r.estado).toBe('inconclusivo')
})
test('ausência na resposta não significa não encontrado', () => {
  const [r] = classificarConsulta(['551126061244'], {
    statusHTTP: 200, corpo: [], conectado: true, falha: null
  }, '2026-10-14T12:00:00Z')
  expect(r.estado).toBe('inconclusivo')
})
```

Adicionar existe true/false, exists string, número estrangeiro na resposta, número duplicado, JID diferente do número publicado, corpo não JSON, desconexão, timeout e número fixo. Registro conclusivo com revalidar=false não consulta; pendente, inconclusivo ou revalidar=true consulta uma vez nesta execução.

- [ ] **Step 2:** Run `npm run test:unit -- src/lib/prospeccao-base/whatsapp.test.ts`; esperado módulo ausente.
- [ ] **Step 3: Implementar o critério exato.**

```ts
export function precisaConsultar(t: TelefoneBase): boolean {
  return t.revalidar || t.estado === 'pendente' || t.estado === 'inconclusivo'
}
const correspondentes = Array.isArray(resposta.corpo)
  ? resposta.corpo.filter(r => typeof r === 'object' && r !== null && r.number === numero)
  : []
const r = correspondentes.length === 1 ? correspondentes[0] : null
const conclusiva = resposta.conectado && resposta.falha === null &&
  resposta.statusHTTP !== null && resposta.statusHTTP >= 200 && resposta.statusHTTP < 300 &&
  r !== null && typeof r.exists === 'boolean'
const estado: EstadoWhatsApp = conclusiva
  ? r.exists ? 'encontrado' : 'nao_encontrado'
  : 'inconclusivo'
```

Conservar JID e número retornado somente quando do registro correspondente e de tipos válidos. O JID pode representar a identidade normalizada pelo WhatsApp e ter dígitos diferentes do número publicado: conservar o retorno sem editar o telefone e sem transformar exists booleano válido em negativo por essa diferença. Nunca usar nome/foto para inferir titular. Aplicar resultado sobre o telefone existente preservando associações. Falhas locais têm motivo sanitizado, nunca mensagem bruta de erro que possa conter headers. Máximo duas tentativas por lote nesta execução; uma nova execução é uma nova revalidação explícita de pendências.

- [ ] **Step 4:** Run comando da Step 2 e `npm run typecheck`.
- [ ] **Step 5:** `git add src/lib/prospeccao-base/whatsapp.ts src/lib/prospeccao-base/whatsapp.test.ts`; `git commit -m "feat: classificacao segura da consulta de WhatsApp"`.

### Task 5: Gerar e testar o workflow manual

**Files:** Create `src/server/prospeccao-base/codigo-n8n.ts`, `codigo-n8n.test.ts`, `workflow.ts`, `workflow.test.ts`, `scripts/prospeccao-base/gerar-workflow.mts`. Modify `docs/operacao/base-prospeccao-n8n.md`.

**Interfaces:** Consumes `consolidar`, `classificarConsulta`, `precisaConsultar`, serialização da Tarefa 3. Produces `gerarWorkflow(config: { planilhaId: string; evolutionUrl: string; instancia: string }): WorkflowExport` e `compilarCodigoN8n(modulos: Record<string, string>, entrada: string): string`. `WorkflowExport` é definido em workflow.ts como `{ name: string; nodes: Array<{ id: string; name: string; type: string; typeVersion: number; position: [number, number]; parameters: Record<string, unknown>; [chave: string]: unknown }>; connections: Record<string, unknown>; settings: Record<string, unknown> }`; configuração aceita URLs/IDs, nunca API keys.

- [ ] **Step 1: Escrever teste falhando.**

```ts
test('workflow não recebe segredo, não envia mensagem e não altera concorrência global', () => {
  const w = gerarWorkflow({ planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'cenario' })
  const json = JSON.stringify(w)
  expect(json).not.toContain('/message/')
  expect(json).not.toContain('apiKey')
  expect(w.settings).not.toHaveProperty('concurrency')
  expect(w.nodes.some(n => n.type === 'n8n-nodes-base.formTrigger')).toBe(true)
})
```

Testar grafo com caminho vazio (nenhum telefone novo), uma aba vazia, múltiplos lotes, erro de escrita e leitura final duplicada. Executar Code nodes compilados em sandbox de teste com dados fictícios e comparer o resultado com as funções TypeScript, inclusive conflito e preservação de observações. Não limitar testes a snapshot de JSON.

- [ ] **Step 2:** Run `npm run test:unit -- src/server/prospeccao-base/codigo-n8n.test.ts src/server/prospeccao-base/workflow.test.ts`; esperado falhar.
- [ ] **Step 3: Construir grafo e export sem credenciais.**

Grafo sequencial: Formulário CSV → Extract from File → ler Empresas → ler Telefones → ler Coletas → consolidar → gravar Empresas por id → gravar associações de Telefones por numero → gravar ocorrências por chave → selecionar consultas → lotes de até 10 → verificar conexão Evolution → consulta → classificar → atualizar Telefones → releitura das três abas → conferir unicidade/contagens → relatório. Ramos sem registros usam sentinela explícita para não encerrar antes do relatório. Somente dados alterados passam para escrita; a reread reconcilia a base completa.

Form Trigger opera pelo Test URL, após Execute Workflow; não publicar nesta v1. Usar Basic Auth por credencial n8n, ou n8n User Auth se disponível na versão instalada, nunca deixar formulário público ativo. CSV em campo `csv`; campos textuais adicionais `regiao`, `termos` e `fonte`. Extract From File: CSV UTF-8, cabeçalho e preservação textual; conferir extração de zero inicial no teste de alvo.

Versões candidatas verificadas em fonte oficial: Form 2.2, Google Sheets 4.6, Code 2, HTTP Request 4.2, Extract From File 1. Antes da instalação, confrontar com os tipos disponíveis na instância autenticada; se faltar uma versão, gerar com a versão disponível e repetir teste de grafo e execução real. Não atualizar o servidor para instalar esta feature.

Nó de gravação Google Sheets:
```ts
const parameters = {
  resource: 'sheet',
  operation: 'appendOrUpdate',
  documentId: { __rl: true, value: config.planilhaId, mode: 'id' },
  sheetName: { __rl: true, value: 'Telefones', mode: 'name' },
  columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['numero'] },
  options: { cellFormat: 'RAW' }
}
```

Confrontar `cellFormat`/resource-mapper com o código oficial da versão instalada; definir schema dos cabeçalhos em vez de depender de autodetecção mutável. Escrever pelo ID exato da planilha, sem criar documentos pelo workflow.

HTTP Request Evolution:
```ts
const parameters = {
  method: 'POST',
  url: config.evolutionUrl + '/chat/whatsappNumbers/' + encodeURIComponent(config.instancia),
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ numbers: $json.numeros }) }}',
  options: { timeout: 15000, response: { response: { fullResponse: true, neverError: true } } }
}
```

Credencial Header Auth configura header `apikey` no n8n; nenhum valor desse header no gerador. Conexão usa GET `/instance/connectionState/{instance}`; estado diferente de open torna o lote inconclusivo. Loop over items processa um lote por vez, intervalo de 750 ms; branch 429/5xx/timeout usa no máximo uma nova tentativa com espera de dois segundos. Não usar retry automático que ignore o status com neverError. Erro de transporte segue ramo sanitizado; erro de Sheets interrompe sem relatório de sucesso.

Code nodes não importam pacotes externos nem leem env. Compilar módulos próprios com `typescript.transpileModule`, CommonJS e target ES2022, usando um mapa fechado de módulos e um require local que recusa módulo desconhecido. Incluir CNPJ comum e todos os módulos puros necessários; sem cópia manual divergente de lógica. Adapter n8n fornece `$input.all()` e resultados dos nós nomeados; cada nó declara entradas/saídas no gerador. Teste de execução compilada da Step 1 confirma equivalência.

- [ ] **Step 4:** Run testes da Step 2, `npm run typecheck`, `npm run lint` e gerador com IDs de cenário. Verificar export sem `credentials`, `pinData`, headers secretos ou dados reais. Gerar depois export local com ID nativo verificado, para instalação.
- [ ] **Step 5:** `git add src/server/prospeccao-base/codigo-n8n.ts src/server/prospeccao-base/codigo-n8n.test.ts src/server/prospeccao-base/workflow.ts src/server/prospeccao-base/workflow.test.ts scripts/prospeccao-base/gerar-workflow.mts docs/operacao/base-prospeccao-n8n.md`; `git commit -m "feat: workflow manual de base e validacao WhatsApp"`.

### Task 6: Instalar somente no alvo e comprovar operação

**Files:** Create `src/server/prospeccao-base/instalar.ts`, `instalar.test.ts`, `scripts/prospeccao-base/instalar.mts`. Modify `docs/operacao/base-prospeccao-n8n.md`. Evidências locais em `outputs/base-prospeccao-2026-10-14/instalacao.json`.

**Interfaces:** Consumes `WorkflowExport`. Produces `instalarAlvo(config: { baseUrl: string; apiKey: string; workflowId: string; projectId: string }, exportado: WorkflowExport, http: typeof fetch): Promise<{ ok: true; workflowId: string } | { ok: false; motivo: 'sem_acesso' | 'alvo_divergente' | 'alteracao_concorrente' | 'verificacao_falhou' }>`.

- [ ] **Step 1: Escrever teste falhando.**

```ts
test('ID diferente impede qualquer requisição', async () => {
  const http = vi.fn()
  const r = await instalarAlvo({
    baseUrl: 'https://primary-production-04eb.up.railway.app', apiKey: 'segredo-ficticio',
    workflowId: 'outro', projectId: 'mIsmhrUTAVI1ZPnf'
  }, { name: 'Cenário', nodes: [], connections: {}, settings: {} }, http)
  expect(r).toEqual({ ok: false, motivo: 'alvo_divergente' })
  expect(http).not.toHaveBeenCalled()
})
```

Adicionar mocks GET 401, projeto divergente, workflow alterado entre leituras, PUT falhando e GET final divergente. API key não aparece nos erros/relatórios. O plano não usa API não documentada para iniciar execução manual.

- [ ] **Step 2:** Run `npm run test:unit -- src/server/prospeccao-base/instalar.test.ts`; esperado falhar.
- [ ] **Step 3: Implementar instalação com leitura antes/depois e configurar credenciais legitimamente.**

```ts
if (config.workflowId !== 'NxCO8HiaJmwqJ8jK' ||
    config.projectId !== 'mIsmhrUTAVI1ZPnf' ||
    config.baseUrl !== 'https://primary-production-04eb.up.railway.app') {
  return { ok: false, motivo: 'alvo_divergente' }
}
const url = config.baseUrl + '/api/v1/workflows/' + config.workflowId
const headers = { 'X-N8N-API-KEY': config.apiKey, 'Content-Type': 'application/json' }
const resposta = await http(url, { headers })
if (resposta.status === 401 || resposta.status === 403) return { ok: false, motivo: 'sem_acesso' }
```

Ler o workflow atual e vínculo ao projeto pela API autenticada. Se a API da versão não expuser projeto, verificar no editor antes de PUT; não tratar ausência como confirmação. Preservar nome e configurações existentes compatíveis, comparar updatedAt e grafo em nova leitura imediatamente antes de PUT. Se mudou, não sobrescrever. Salvar export anterior privado para recuperação deste workflow. PUT envia só name/nodes/connections/settings; não alterar ativação nem publicar; GET posterior compara conteúdo esperado.

A credencial API n8n ainda não existe no ambiente. Caminho preferido: usuário cria chave no n8n e coloca localmente em `.env.n8n.local`, sem colar no chat. O instalador lê `N8N_API_URL`/`N8N_API_KEY` no processo; não imprime valor. Alternativa completa: importar export sem credenciais por Import from File no editor do workflow alvo, selecionar Google Sheets OAuth com escrita na planilha, Header Auth Evolution e autenticação de formulário; salvar e exportar de volta para conferir. Não acessar banco n8n, cookies ou chave de criptografia para fabricar autenticação. Finalizar todos os arquivos/testes antes de solicitar esse acesso; manter instalação pendente se faltarem acesso ou credenciais Google/Evolution.

- [ ] **Step 4:** Run teste da Step 2, suíte unitária pertinente e CI da PR. No alvo, executar primeiro CSV fictício isolado numa planilha temporária privada com três abas, sem resultados comerciais; configurar os nós para essa planilha apenas durante o ensaio e conferir limpeza do cenário. Depois configurar o ID definitivo e executar a coleta Mooca existente: 45/42 conservados, zero reconsultas conclusivas, novas ocorrências rastreáveis. Marcar somente o fixo já verificado para revalidação, executar novamente e conferir encontrado, timestamp renovado e zero mensagens. Conferir número compartilhado e duas pendências sem telefone. Ler workflow e Sheets de volta; guardar contagens, ID da execução e verificação do grafo no relatório, sem payloads secretos. Confirmar que os outros workflows e o limite global permanecem iguais.
- [ ] **Step 5:** `git add src/server/prospeccao-base/instalar.ts src/server/prospeccao-base/instalar.test.ts scripts/prospeccao-base/instalar.mts docs/operacao/base-prospeccao-n8n.md`; `git commit -m "feat: instalacao controlada do workflow de prospeccao"`. Atualizar PR com testes e resultado real; review final antes de merge.

## Entrega e limites da v1

Entregar URL nativa verificada, workflow alvo, export recuperável e instruções de operação: um gestor, um arquivo por vez, Execute Workflow, enviar CSV, aguardar relatório final. A escrita por chave recupera interrupções sequenciais; Google Sheets não fornece unicidade transacional nem um lock distribuído. Não prometer proteção contra dois operadores/processos simultâneos. Duplicidades detectadas impedem sucesso e pedem revisão, sem apagar empresas.

A origem postal já foi corrigida e a consulta inicial já aconteceu. Não repetir carga CEP ou consultas de todos os 42 números. Nenhum site novo, disparo comercial, assinatura paga, limpeza de dados reais ou sincronização automática com CRM integra este plano.

## Referências verificadas e revisão do plano

- [API pública n8n e autenticação](https://github.com/n8n-io/n8n-docs/blob/main/docs/connect/n8n-api/authentication.md)
- [Importação/exportação de workflows](https://github.com/n8n-io/n8n-docs/blob/main/docs/build/manage-workflows/export-and-import.md)
- [Form Trigger e Test URL](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger/)
- [HTTP Request: retorno completo e Never Error](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [Google Sheets: operações por aba](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/sheet-operations/)
- [Rota oficial Evolution whatsappNumbers](https://github.com/evolution-foundation/evolution-api/blob/main/src/api/routes/chat.router.ts)

Revisão própria: estrutura/identificação nas tarefas 1–2; criação/estilo/leitura nativa na 3; semântica WhatsApp na 4; entradas, erros e escritas no grafo na 5; autenticação, alvo e comprovação na 6. Cada Review Focus tem teste na tarefa indicada. Instalação só é declarada concluída após leitura posterior e execução real; gerar JSON não satisfaz esse aceite.
