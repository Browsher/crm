# Validação simples de WhatsApp no Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Ler a coleta da aba original, consultar os telefones únicos na Evolution e publicar duas listas e um arquivo compatível com a importação atual do CRM, mantendo três abas visíveis.

**Architecture:** Entrada, exportação e contratos do Sheets ficam em módulos puros de src/lib/prospeccao-base/. Um gerador separado em src/server/prospeccao-base/ monta o workflow manual e incorpora esses módulos com o compilador já existente. A consulta usa o nó comunitário Evolution API; as operações de matriz bruta, notas e substituição conjunta das saídas usam HTTP Request com a credencial Google Sheets existente.

**Tech Stack:** Node 24, TypeScript, Vitest 5, n8n 2.36.8, n8n-nodes-evolution-api 1.0.4, Evolution API 2.3.7, Google Sheets API v4. Sem dependência nova.

**Spec:** docs/superpowers/specs/2026-10-15-validacao-whatsapp-sheets-simples-design.md, aprovada pelo usuário em 15/10/2026.

## Global Constraints

- A coluna A deve ter o cabeçalho exato telefone; os telefones começam em A2.
- Organização: 1. Validar numero whatsapp; 2. planilha original scraping; 3. Planilha exportar CRM.
- Ocultar Empresas, Telefones e Coletas para manter somente essas três abas visíveis, sem excluir o histórico.
- Recusar coletas com mais de 5.000 empresas; não truncar silenciosamente a leitura.
- Manter fixos de oito dígitos locais; nunca inserir ou remover o nono dígito.
- Processar lotes de dez, com intervalo de 750 ms e no máximo uma tentativa adicional após falha.
- exists precisa ser booleano em resposta válida e associada exatamente ao número consultado.
- Pendências de consulta após a tentativa adicional interrompem a publicação das duas saídas.
- Pendências de entrada ou cadastro podem produzir saída parcial, com indicação expressa nas notas dos cabeçalhos e no relatório.
- Exportação com exatamente nove colunas: cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id.
- Telefone na consulta e na aba de validação: DDI + DDD + número; telefone exportado ao CRM: DDD + número.
- Uma execução por vez; não substituir a aba de origem enquanto o workflow estiver em andamento.
- A origem e as três abas históricas não são limpas nem reescritas por este fluxo.
- Não alterar compartilhamento da planilha, outros workflows, configuração global de concorrência ou banco do CRM.
- Credenciais Google e Evolution permanecem no n8n; o JSON de entrega não contém chaves, senhas ou dados fixados.
- Branch + PR, sem commit na main. Teste falhando primeiro para cada mudança de código.

## Review Focus

1. Linhas vazias no meio, números em notação científica e cabeçalho repetido: localizar a linha real e impedir perda de dados. Tarefa 1.
2. Identidades ligadas indiretamente por CNPJ/Place ID e aliases divergentes: não escolher a primeira ocorrência nem exportar parte de um conflito. Tarefa 2.
3. Resposta de sucesso com número ausente ou repetido: tentar novamente apenas os inconclusivos e bloquear a publicação se continuarem sem confirmação. Tarefa 4.
4. Execução menor, saída vazia e colunas extras introduzidas manualmente: eliminar sobras nos campos de saída e recusar conferência incompatível com o modelo. Tarefa 3.
5. Transporte da nota final falha depois da gravação: manter o estado incompleto e não emitir relatório de sucesso. Tarefas 3 e 4.

---

## Estado, isolamento e sequência

Reutilizar C:/Users/ADM/.codex/worktrees/producao-vercel/crm, branch codex/base-prospeccao-n8n, PR #53 contra main. Último commit conferido antes deste plano: 63bc98c. Não incluir arquivos locais, fontes reais, ambientes privados ou a outra branch de endereços.

Executar tarefas 1 → 2 → 3 → 4 → 5. Cada tarefa de código termina com seus testes verdes e um commit. Não alterar o gerador antigo, seus testes e os JSONs já entregues: o novo arquivo terá nome próprio, permitindo revisar a substituição no editor.

A etapa atual é planejamento. Revisão do plano e escolha da execução vêm antes de iniciar as tarefas.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| src/lib/prospeccao-base/simples-modelo.ts | Tipos de entrada, pendência e resultados |
| src/lib/prospeccao-base/entrada-sheets.ts | Matriz bruta, cabeçalhos, linhas reais e números únicos |
| src/lib/prospeccao-base/exportar-crm.ts | Cadastro elegível, identidades, listas finais e CSV |
| src/lib/prospeccao-base/sheets-simples.ts | Ranges, requests de publicação, notas e conferência |
| src/lib/cep.ts e src/lib/cnae.ts | Normalizadores existentes compartilhados, sem mudança de comportamento |
| src/server/cep/resolver.ts e src/features/empresas/cnae.ts | Reexportações compatíveis dos normalizadores movidos |
| src/server/prospeccao-base/codigo-simples.ts | Mapa de módulos puros para o compilador existente |
| src/server/prospeccao-base/workflow-simples.ts | Configuração, nós, expressões e conexões do novo fluxo |
| scripts/prospeccao-base/gerar-workflow-simples.mts | CLI fino, gravação exclusiva de JSON sem segredos |
| docs/operacao/validacao-whatsapp-sheets.md | Operação das três abas e instalação pelo editor |

Testes ao lado de cada módulo, com sufixo .test.ts. Teste do CLI em src/server/prospeccao-base/workflow-simples-cli.test.ts. Não criar migração nem alterar contrato do importador.

## Fontes técnicas conferidas

- [Credenciais predefinidas em HTTP Request](https://docs.n8n.io/integrations/builtin/custom-api-actions-for-existing-nodes/): reutilizar a conexão Google existente; sem token escrito no Code node.
- [Tipo da credencial Google Sheets no código oficial](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/credentials/GoogleSheetsOAuth2Api.credentials.ts): googleSheetsOAuth2Api. O código consultado é da branch master; conferir a disponibilidade no editor 2.36.8 durante o aceite.
- [Leitura de matriz pelo Sheets](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get): preservar a linha de cabeçalhos para detectar duplicações, em vez de transformar colunas repetidas em propriedades de objeto.
- [Atualização por lote](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate) e [requisições](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request): notas e dados usam máscaras explícitas; valores são stringValue, nunca formulaValue.

### Task 1: Ler a aba original sem perder identidade de linha

**Files:** Create src/lib/prospeccao-base/simples-modelo.ts, entrada-sheets.ts, entrada-sheets.test.ts. Read telefone.ts e telefone.test.ts, sem mudar a normalização existente.

**Interfaces:**

~~~~ts
export type PendenciaSimples = {
  linhas: number[]
  numero: string | null
  motivo: string
}
export type LinhaScraping = {
  linha: number
  dados: Record<string, string>
  numero: string | null
}
export type ColetaSheets = {
  linhas: LinhaScraping[]
  numeros: string[]
  pendencias: PendenciaSimples[]
}
export type LeituraSheets =
  | { ok: true; coleta: ColetaSheets }
  | { ok: false; motivo: 'estrutura_invalida' | 'excede_limite'; detalhes: string[] }

// Produz no máximo 5.000 linhas de empresa, sem contar cabeçalho/vazias.
export function lerColetaSheets(valores: unknown[][]): LeituraSheets
~~~~

- [ ] **Step 1: Escrever teste de leitura e número compartilhado antes do módulo.**

~~~~ts
import { expect, test } from 'vitest'
import { lerColetaSheets } from './entrada-sheets'

test('mantém a linha original e consulta o fixo compartilhado uma vez', () => {
  const r = lerColetaSheets([
    ['telefone', 'nome_empresa', 'place_id'],
    ['(11) 2600-0001', 'Empresa A', 'ChIJ-cenario-a'],
    [],
    ['+55 11 2600-0001', 'Empresa B', 'ChIJ-cenario-b'],
  ])
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error(r.motivo)
  expect(r.coleta.numeros).toEqual(['551126000001'])
  expect(r.coleta.linhas.map(l => l.linha)).toEqual([2, 4])
})

test('recusa dois cabeçalhos telefone', () => {
  expect(lerColetaSheets([['telefone', 'telefone'], ['1126000001', '1126000002']]))
    .toMatchObject({ ok: false, motivo: 'estrutura_invalida' })
})
~~~~

- [ ] **Step 2: Rodar e registrar RED.**

Run: node node_modules/vitest/vitest.mjs run --project unitario src/lib/prospeccao-base/entrada-sheets.test.ts

Expected: FAIL por módulo/função ainda ausente.

- [ ] **Step 3: Implementar o leitor puro.**

Validar matriz, cabeçalho A1 exato, nomes duplicados e valores sob coluna sem cabeçalho. Usar Object.fromEntries para campos e preservar a matriz recebida; não interpretar dados como expressões. Tratar linha totalmente vazia como vazia, sem deslocar as demais. Usar normalizarNumero para telefone. Célula sem DDD ou malformada gera pendência da linha; não gerar tentativa de consulta para ela. Manter números únicos na ordem da primeira ocorrência. Não consultar rede, banco ou abas históricas.

~~~~ts
const resultado = normalizarNumero(dados.telefone)
const numero = resultado.ok ? resultado.numero : null
const registro: LinhaScraping = { linha: indice + 2, dados, numero }
if (resultado.ok) numeros.add(resultado.numero)
else pendencias.push({
  linhas: [registro.linha], numero: null, motivo: resultado.motivo,
})
~~~~

- [ ] **Step 4: Acrescentar casos de celular com/sem +55, fixo, notação científica, ausência de DDD, dois números na célula, somente cabeçalho, 5.000 e 5.001 empresas e linhas vazias.**

Não preencher DDD presumido, não adicionar nove e não recuperar zeros perdidos. Recusar entradas estruturalmente ilegíveis antes de publicar saídas. Repetir o comando da etapa 2; esperado PASS.

- [ ] **Step 5: Commit da tarefa.**

Run: git add src/lib/prospeccao-base/simples-modelo.ts src/lib/prospeccao-base/entrada-sheets.ts src/lib/prospeccao-base/entrada-sheets.test.ts

Run: git commit -m "feat: ler coleta de prospeccao pelo Sheets"

### Task 2: Gerar as duas listas e cadastros aceitos pelo CRM

**Files:** Create src/lib/prospeccao-base/exportar-crm.ts, exportar-crm.test.ts, src/lib/cep.ts, src/lib/cnae.ts. Modify src/lib/prospeccao-base/simples-modelo.ts, src/server/cep/resolver.ts, src/features/empresas/cnae.ts. Read src/features/empresas/planilha.ts, csv.ts e telefone.ts.

**Interfaces:** Consome ColetaSheets, PendenciaSimples e TelefoneBase de modelo.ts, além de normalizarCnpj/validarCnpj de src/lib/cnpj.ts.

~~~~ts
export type SaidasSimples = {
  validos: string[]
  invalidos: string[]
  exportacao: string[][]
  pendencias: PendenciaSimples[]
  compartilhados: { numero: string; linhas: number[] }[]
  duplicadas: number[]
}
export type ResultadoSimples =
  | { ok: true; saidas: SaidasSimples }
  | { ok: false; motivo: 'consulta_incompleta'; pendencias: PendenciaSimples[] }

export const COLUNAS_CRM = [
  'cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone',
  'email', 'cep', 'cnae_principal', 'google_place_id',
] as const
export function montarSaidas(
  coleta: ColetaSheets, consultas: TelefoneBase[],
): ResultadoSimples
export function serializarCsvCrm(exportacao: string[][]): string

// Mover as implementações existentes, com a mesma assinatura:
export function normalizarCep(bruto: string): string | null
export function normalizarCnae(bruto: string):
  { ok: true; valor: string | null } | { ok: false }
~~~~

- [ ] **Step 1: Escrever teste RED usando o parser real como consumidor.**

~~~~ts
import { expect, test } from 'vitest'
import { analisarPlanilha, CABECALHO_GOOGLE } from '../../features/empresas/planilha'
import { lerColetaSheets } from './entrada-sheets'
import { classificarConsultaComunidade } from './whatsapp'
import { COLUNAS_CRM, montarSaidas, serializarCsvCrm } from './exportar-crm'

test('exporta prospect sem CNPJ com telefone nacional e Place ID', () => {
  const leitura = lerColetaSheets([
    ['telefone', 'nome_empresa', 'place_id', 'cep'],
    ['+55 11 2600-0001', 'Empresa do cenário', 'ChIJ-cenario-a', '01310-100'],
  ])
  if (!leitura.ok) throw new Error(leitura.motivo)
  const consultas = classificarConsultaComunidade(['551126000001'], {
    success: true, data: [{ number: '551126000001', exists: true }],
  }, true, '2026-10-15T12:00:00.000Z')
  const r = montarSaidas(leitura.coleta, consultas)
  if (!r.ok) throw new Error(r.motivo)
  expect(COLUNAS_CRM.join(',')).toBe(CABECALHO_GOOGLE)
  expect(r.saidas.exportacao[0][4]).toBe('1126000001')
  const analise = analisarPlanilha(new TextEncoder().encode(
    serializarCsvCrm(r.saidas.exportacao),
  ))
  expect(analise).toMatchObject({ ok: true, recusadas: [] })
  if (!analise.ok) throw new Error(analise.falha.motivo)
  expect(analise.aceitas).toHaveLength(1)
})
~~~~

- [ ] **Step 2: Rodar e registrar RED.**

Run: node node_modules/vitest/vitest.mjs run --project unitario src/lib/prospeccao-base/exportar-crm.test.ts

Expected: FAIL antes da implementação.

- [ ] **Step 3: Compartilhar somente CEP/CNAE necessários e implementar a transformação.**

Mover normalizarCep de resolver.ts para src/lib/cep.ts e normalizarCnae para src/lib/cnae.ts. Manter reexportações pelos caminhos antigos para preservar consumidores e testes. Nenhuma regra de validação muda. Não mover resolução de banco ou importar features no módulo de domínio.

Verificar que consultas correspondem exatamente ao conjunto de números da coleta, sem ausências, extras ou duplicações. Qualquer inconclusivo/pendente bloqueia a publicação. Listas só recebem encontrado/não encontrado confirmados, sem repetição. Revalidar todos os números da coleta atual.

Mapear place_id ↔ google_place_id e nome_empresa ↔ nome_fantasia, após trim; se ambos os aliases estiverem preenchidos e divergirem, registrar pendência de cadastro. Razão social é campo independente. Exigir nome e identidade conforme a spec. CNPJ preenchido e inválido é pendência, mesmo com Place ID; não apagar seu valor silenciosamente. Validar e-mail, CEP, CNAE, controles e quebras de linha conforme o parser real. Telefone exportado remove somente o prefixo 55 de um número já normalizado.

Agrupar por identidade usando componentes ligados por CNPJ/Place ID, antes de escolher qualquer linha. Mesmo cadastro e mesmos campos exportáveis: uma linha. Divergência: todas as ocorrências do componente ficam pendentes. Identidades distintas compartilhando telefone permanecem distintas.

~~~~ts
export function serializarCsvCrm(linhas: string[][]): string {
  const campo = (valor: string) => '"' + valor.replace(/"/g, '""') + '"'
  return [COLUNAS_CRM, ...linhas]
    .map(linha => linha.map(campo).join(',')).join('\n') + '\n'
}
~~~~

- [ ] **Step 4: Testar matriz de cadastros e as fronteiras do consumidor.**

Casos: somente telefone; sem nome; sem identidade; CNPJ válido sem Place ID; CNPJ inválido com Place ID; CEP com zero; CNAE com separadores; aspas/vírgulas em nome; nome literal iniciado por =; quebra de linha recusada como pendência; dois aliases diferentes; duplicata idêntica; conflito de CNPJ/Place ID em cadeia; duas empresas com mesmo telefone; retorno duplicado/ausente. Cada exportação não vazia deve ser aceita pelo parser real com zero recusadas. Saída vazia contém cabeçalho; não exigir que o parser aceite uma importação sem empresas.

Run: node node_modules/vitest/vitest.mjs run --project unitario src/lib/prospeccao-base/exportar-crm.test.ts src/features/empresas/planilha.test.ts src/features/empresas/cnae.test.ts src/server/cep/resolver.test.ts

Expected: PASS, mantendo os resultados dos validadores antigos.

- [ ] **Step 5: Commit da tarefa.**

Stage somente os arquivos desta tarefa e seus testes. Run: git commit -m "feat: gerar listas WhatsApp e exportacao compativel com CRM"

### Task 3: Publicar saídas sem sobras e conferir o que foi gravado

**Files:** Create src/lib/prospeccao-base/sheets-simples.ts e sheets-simples.test.ts.

**Interfaces:** Consome SaidasSimples. Produz contratos que os Code nodes da tarefa 4 executarão.

~~~~ts
export type DestinosSimples = { validacao: number; exportacao: number }
export type ExecucaoSimples = { id: string; data: string }
export type GradesSimples = {
  validacao: { linhas: number; colunas: number }
  exportacao: { linhas: number; colunas: number }
}
export type RequestSheets = Record<string, unknown>
export type PlanoSheets = {
  inicio: RequestSheets[]
  dados: RequestSheets[]
  conclusao: RequestSheets[]
  esperado: { validacao: string[][]; exportacao: string[][] }
}
export type ConferenciaSheets =
  | { ok: true }
  | { ok: false; motivo: 'gravacao_incompleta' }

export function rangeA1(titulo: string, linhas: number, colunas: number): string
export function prepararPublicacao(
  destinos: DestinosSimples, saidas: SaidasSimples,
  execucao: ExecucaoSimples, grades: GradesSimples,
): PlanoSheets
export function conferirSaidas(
  esperado: PlanoSheets['esperado'],
  lido: { validacao: unknown[][]; exportacao: unknown[][] },
): ConferenciaSheets
~~~~

- [ ] **Step 1: Escrever teste RED que simula sobras e impede conclusão.**

~~~~ts
import { expect, test } from 'vitest'
import { conferirSaidas, prepararPublicacao } from './sheets-simples'
import type { SaidasSimples } from './simples-modelo'

test('uma sobra da execução anterior impede confirmação de sucesso', () => {
  const saidas: SaidasSimples = {
    validos: ['551126000001'], invalidos: [], exportacao: [],
    pendencias: [], compartilhados: [], duplicadas: [],
  }
  const plano = prepararPublicacao({ validacao: 10, exportacao: 11 },
    saidas, { id: 'exec-cenario', data: '2026-10-15T12:00:00.000Z' }, {
      validacao: { linhas: 5001, colunas: 2 },
      exportacao: { linhas: 5001, colunas: 9 },
    })
  expect(conferirSaidas(plano.esperado, {
    validacao: [['Válidos', 'Inválidos'], ['551126000001', ''], ['sobra', '']],
    exportacao: plano.esperado.exportacao,
  })).toEqual({ ok: false, motivo: 'gravacao_incompleta' })
})
~~~~

- [ ] **Step 2: Rodar e registrar RED.**

Run: node node_modules/vitest/vitest.mjs run --project unitario src/lib/prospeccao-base/sheets-simples.test.ts

- [ ] **Step 3: Gerar três lotes de requests e um comparador puro.**

Inicio: updateCells apenas em note dos cabeçalhos das duas saídas, com execução/data/em processamento. Não alterar dados nesta fase.

Dados: uma chamada batchUpdate contendo limpeza das células de valores nas colunas A:B da validação e A:I da exportação, seguida da gravação dos cabeçalhos e dos novos resultados. Usar repeatCell com cell vazio e fields userEnteredValue para limpar sem apagar formato/notas. O range da limpeza começa na linha 1 e não limita o fim de linha, alcançando todas as sobras dessas colunas. Receber as dimensões atuais por grades. Se necessário, expandir grid de destino até o número de linhas esperado antes da escrita, usando Math.max(linhasAtuais, linhasEsperadas), sem reduzir a grade. A releitura usa a maior dimensão entre a grade original e a expandida; preservar colunas extras para detectar e relatar conteúdo incompatível. A chamada de dados não conclui notas.

Gravar com updateCells, stringValue em cada célula, faixa exatamente igual à matriz escrita e fields userEnteredValue. Listas de tamanhos diferentes são completadas com texto vazio. Mesmo zero resultados escreve o cabeçalho. As máscaras não incluem campos alheios.

Conclusao: somente notas dos cabeçalhos, com concluído ou concluído com pendências e as contagens. Só enviar após conferirSaidas retornar ok. Não colocar detalhes brutos de erro de transporte em notas.

~~~~ts
const limpar = (sheetId: number, colunas: number): RequestSheets => ({
  repeatCell: {
    range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: colunas },
    cell: {},
    fields: 'userEnteredValue',
  },
})
~~~~

rangeA1 deve produzir uma faixa limitada às dimensões reais lidas em metadata, escapando aspas no título e convertendo coluna 40 para AN. A releitura deve cobrir a grade dos destinos, e não apenas as linhas novas: dados fora das nove/duas colunas esperadas também impedem conclusão. No comparador, completar apenas células finais ausentes como vazias; não aplicar trim aos valores para esconder divergências.

- [ ] **Step 4: Executar cenários de publicação.**

Testar aplicação das requisições em uma grade de cenário com lista antiga maior e comparar o estado final esperado: lista menor, nenhum válido, nenhum inválido e fonte vazia. O simulador do teste aplica apenas repeatCell/updateCells/updateSheetProperties, com campos explícitos e validação prévia; usar grade clonada para simular falha de lote sem fingir escrita parcial. Conferir que os IDs da origem e do histórico jamais aparecem em requests.

Testar stringValue literal iniciado por =, telefone/CEP como texto, nota inicial mantida quando a escrita ou conferência falha, coluna extra detectada, metadados com limite de grade insuficiente e igualdade após o Google omitir vazios finais. IDs dos dois destinos precisam ser distintos.

Run: node node_modules/vitest/vitest.mjs run --project unitario src/lib/prospeccao-base/sheets-simples.test.ts

Expected: PASS.

- [ ] **Step 5: Commit da tarefa.**

Run: git add src/lib/prospeccao-base/sheets-simples.ts src/lib/prospeccao-base/sheets-simples.test.ts

Run: git commit -m "feat: publicar e conferir saidas de prospeccao no Sheets"

### Task 4: Gerar o workflow manual, o CLI e os testes de percurso

**Files:** Create src/server/prospeccao-base/codigo-simples.ts, codigo-simples.test.ts, workflow-simples.ts, workflow-simples.test.ts, workflow-simples-cli.test.ts e scripts/prospeccao-base/gerar-workflow-simples.mts. Read codigo-n8n.ts, workflow.ts, workflow.test.ts e scripts/prospeccao-base/gerar-workflow.mts como moldes; preservar seus contratos.

**Interfaces:**

~~~~ts
export type WorkflowSimplesConfig = {
  planilhaId: string
  evolutionUrl: string
  instancia: string
  abas: { origem: number; validacao: number; exportacao: number }
}
// WorkflowExport é o tipo já existente em workflow.ts.
export function gerarWorkflowSimples(config: WorkflowSimplesConfig): WorkflowExport
export function compilarBibliotecaSimples(): string
~~~~

compilarBibliotecaSimples retorna expressão que expõe lerColetaSheets, montarSaidas, prepararPublicacao, conferirSaidas, rangeA1 e classificarConsultaComunidade. Incluir os módulos de tipos, telefone, whatsapp, CNPJ, CEP, CNAE, entrada/exportação/publicação e usar compilarCodigoN8n existente. Sem módulo externo, banco ou segredo no bundle.

- [ ] **Step 1: Escrever testes RED da estrutura e da passagem pelo Code node.**

~~~~ts
import { expect, test } from 'vitest'
import { gerarWorkflowSimples } from './workflow-simples'

const config = {
  planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test',
  instancia: 'cenario',
  abas: { origem: 1, validacao: 2, exportacao: 3 },
}
test('entrada manual e conexão comunitária, sem upload ou mensagem', () => {
  const w = gerarWorkflowSimples(config)
  expect(w.nodes.some(n => n.type === 'n8n-nodes-base.manualTrigger')).toBe(true)
  expect(w.nodes.some(n => n.type === 'n8n-nodes-base.formTrigger')).toBe(false)
  expect(w.nodes.filter(n => n.type === 'n8n-nodes-evolution-api.evolutionApi'))
    .toHaveLength(2)
  expect(JSON.stringify(w)).not.toMatch(/"credentials"|"pinData"|\/message\//)
  expect(w.settings).not.toHaveProperty('concurrency')
})
~~~~

Adicionar um helper de teste usando runInNewContext, no molde do teste antigo, para executar os Code nodes realmente gerados. Ele recebe entrada, dados de nós nomeados, runIndex e $execution.id; não substituir regras de domínio por mocks. Testar também Object.defineProperty neutralizado como no runner seguro existente.

- [ ] **Step 2: Rodar e registrar RED.**

Run: node node_modules/vitest/vitest.mjs run --project unitario src/server/prospeccao-base/workflow-simples.test.ts src/server/prospeccao-base/codigo-simples.test.ts

- [ ] **Step 3: Implementar nós, conexões e transporte.**

Validar URL Evolution HTTPS sem userinfo/query/hash, ID da planilha sem delimitadores de URL e três sheetIds inteiros, não negativos e distintos. Os títulos esperados são fixos; se metadata mostrar que o ID aponta para outra aba, parar antes de escrever. Nenhum dado da coleta escolhe host, credencial ou destino.

Sequência inicial: Iniciar manual → Ler metadados → Ler scraping → Preparar coleta → Preparar lotes → Há lotes. Ler metadata com GET da planilha e fields explícitos de sheetId/title/gridProperties. Usar rangeA1 com as dimensões reais da origem e values.get com valueRenderOption FORMATTED_VALUE para receber matriz, inclusive cabeçalhos repetidos. Não usar Get Rows se ele já tiver descartado o cabeçalho original. Fonte vazia ou sem números elegíveis segue diretamente à montagem de saídas, sem consulta Evolution.

Loop: Loop lotes, Split In Batches 3, batchSize 1 → Verificar conexão → Consultar WhatsApp → Classificar primeira tentativa. Verificar conexão permanece HTTP Request 4.2, GET /instance/connectionState/{instancia codificada}, credencial predefinida evolutionApi, timeout 15 s e sem redirect. Conexão fechada/erro impede publicação com relatório sanitizado de números pendentes.

Consultar WhatsApp e Consultar novamente usam community type n8n-nodes-evolution-api.evolutionApi 1, resource chat-api, operation check-number, instanceName codificado e numbers como string separada por vírgulas. Classificar primeira tentativa usa classificarConsultaComunidade. Se houver inconclusivos, Wait 1.1 por 2 s → Consultar novamente somente os inconclusivos → Classificar segunda e combinar com os resultados conclusivos da primeira. Não repetir exists false válido. Retorno ainda inconclusivo impede publicação no fechamento.

Guardar resultado lote deve receber os resultados classificados, não a resposta de uma escrita. Wait 1.1 por 0,75 s → Loop lotes. Acumular resultados pelo fluxo de itens e saída done do Loop, sem staticData, globais mutáveis ou escrita por telefone na planilha.

Preparar publicação recebe também as GradesSimples obtidas em Ler metadados. Saída done → Montar saídas → Preparar publicação → Marcar processamento → Substituir saídas → Ler saídas → Conferir saídas → Concluir notas → Relatório final. O caminho sem lotes também entra em Montar saídas com zero consultas. Conferir deve lançar falha de infraestrutura se a regra retornar gravacao_incompleta, antes de Concluir notas.

As chamadas Sheets usam HTTP Request 4.2 com authentication predefinedCredentialType, nodeCredentialType googleSheetsOAuth2Api e a conexão Google existente. GET para metadata/values e POST para batchUpdate, sem enviar autorização dentro do JSON. Nunca ignorar erro Sheets. Limitar redirect e timeout como no transporte existente. Conferir as opções reais do nó no editor 2.36.8, sem confundir documentação master com compatibilidade já medida.

Preservar executionOrder v1, timezone America/Sao_Paulo e a política existente de não persistir dados de execução. Relatório final inclui execução/data, empresas lidas/exportadas, únicos válidos/inválidos, pendências por linha, duplicadas e compartilhamentos. mensagensEnviadas permanece zero.

- [ ] **Step 4: Testar percursos e CLI.**

O harness deve simular dois lotes e exercitar todos os Code nodes finais: consulta íntegra; sucesso parcial com número ausente que melhora na segunda tentativa; resposta duplicada que continua inconclusiva; lote posterior falha sem publicar o anterior; fonte vazia; todos os telefones inválidos de formato; primeiro lote positivo e segundo negativo sem perda de resultados. O nó Concluir notas não pode ser alcançado após falha no início, dados ou readback. Falha no HTTP da nota final também impede o Relatório final.

Usar o modelo CLI antigo para criar gerar-workflow-simples.mts com argumentos --config e --saida, escrita flag wx e saída de log sem caminhos privados ou valores de configuração. JSON não inclui credentials/pinData/id externo. Testar config inválida, caminho já existente, sintaxe JSON e correspondência do export gerado com gerarWorkflowSimples.

Run: node node_modules/vitest/vitest.mjs run --project unitario src/server/prospeccao-base/workflow-simples.test.ts src/server/prospeccao-base/codigo-simples.test.ts src/server/prospeccao-base/workflow-simples-cli.test.ts src/lib/prospeccao-base

Run: npm run typecheck

Run: npm run lint

Expected: PASS; verificar que os testes antigos do workflow continuam verdes.

- [ ] **Step 5: Commit da tarefa.**

Stage os arquivos novos desta tarefa. Run: git commit -m "feat: gerar workflow simples de validacao WhatsApp no Sheets"

### Task 5: Preparar três abas, entregar o JSON e conferir o aceite real

**Files:** Create docs/operacao/validacao-whatsapp-sheets.md. Artefatos privados em outputs/validacao-whatsapp-sheets-2026-10-15/: config-simples.json, workflow-whatsapp-sheets-simples.json, aceite-operacional.json. Não versionar esses artefatos.

**Interfaces:** Consome gerarWorkflowSimples, o CLI da tarefa 4 e os sheetIds retornados pelo conector. Produz documento de operação, JSON revisável e evidências que distinguem gerado/testado de instalado/executado.

- [ ] **Step 1: Rodar verificações locais e preparar o aceite operacional.**

Run: npm run typecheck

Run: npm run lint

Run: npm run test:unit

Não criar novos testes E2E de UI nem executar migração para esta mudança. O CI existente continuará exigindo suas verificações completas. Se houver falha nova, investigar antes de ampliar os testes ou publicar.

No método Native, solicitar uma revisão independente da branch inteira ao final, conforme a skill de execução. No método com subagentes, respeitar as revisões por tarefa. Corrigir achados materiais e verificar de novo somente o afetado.

- [ ] **Step 2: Preparar as abas pelo conector Google Sheets.**

Ler as skills Google Drive/Sheets e suas referências de edição antes de alterar a planilha. Confirmar spreadsheetId 17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU por metadata atual. Fonte esperada: sheetId 10151001. Ler fonte e possíveis abas de destino antes de criar/alterar. Se um destino já tiver dados, preservar o conteúdo até a primeira publicação feita pelo workflow.

Criar apenas os destinos ausentes. Validar numero whatsapp tem cabeçalhos Válidos/Inválidos; Planilha exportar CRM tem os nove cabeçalhos da spec. Primeira linha congelada, estilo neutro e números/identificadores como texto. Não inserir empresa ou telefone de exemplo nas abas reais.

Ordenar as três abas visíveis conforme o usuário pediu. Ocultar os IDs reais de Empresas/Telefones/Coletas lidos de metadata, sem deletar as abas ou seus dados. Não reformatar a origem inteira nem alterar telefones já colados.

Ler de volta metadata, cabeçalhos, notas e formatos dos destinos. Confirmar exatamente três abas visíveis, nomes corretos, origem intacta e histórico oculto. Registrar IDs reais em config-simples.json; não adivinhar IDs ou copiar os do cenário dos testes.

- [ ] **Step 3: Gerar e inspecionar a entrega.**

~~~~powershell
node --import tsx scripts/prospeccao-base/gerar-workflow-simples.mts --config outputs/validacao-whatsapp-sheets-2026-10-15/config-simples.json --saida outputs/validacao-whatsapp-sheets-2026-10-15/workflow-whatsapp-sheets-simples.json
~~~~

O config usa o host e a instância já existentes, mas nunca a chave. Ler o JSON gerado e verificar referências somente à planilha autorizada, origem correta, dois destinos, credenciais ausentes, nenhum envio e nenhum upload. Copiar a entrega verificada para C:/Users/ADM/projetos/crm/outputs/validacao-whatsapp-sheets-2026-10-15/ se o usuário estiver usando o workspace principal.

O manual explica: colar coleta completa; manter telefone na A; selecionar credenciais; executar uma vez; revisar pendências; baixar somente Planilha exportar CRM como CSV UTF-8; importar no grupo adequado do CRM com prévia e confirmação. Explicar que validar registro não confirma titularidade e que empresas distintas podem compartilhar um telefone.

- [ ] **Step 4: Instalar pelo editor e comprovar a execução.**

Respeitar o caminho já escolhido pelo usuário: importação no editor. Não pedir chave de API novamente nem modificar o instalador antigo, que aponta para outro workflow/projeto. Se o editor autenticado estiver acessível, conferir a URL/identidade da cópia atual e importar nela o JSON de entrega; selecionar as credenciais existentes e manter acionamento manual, sem publicar gatilho automático. Se não houver acesso pelo agente, entregar o JSON e os passos precisos ao usuário e registrar esta parte como pendente.

Usar a coleta autorizada da Mooca quando estiver na aba de origem. Resultados antigos 29/13 não são uma asserção para consulta nova; reconciliar a consulta desta execução, seus números únicos e as empresas exportáveis. Rodar somente números da coleta; não consultar telefones sintéticos em produção.

Depois de executar, ler novamente as três abas e o workflow salvo; registrar ID da execução, quantidade recebida, únicos consultados, válidos, inválidos, pendências e empresas exportadas. Conferir pelo parser real uma cópia baixada do CSV, preservando sigilo e sem importar automaticamente no banco. Se todos os registros forem inelegíveis, comprovar cabeçalho e relatório, sem forçar importação vazia.

Comprovar pelo menos uma execução nova menor removendo sobras em um cenário controlado ou pelo harness offline; não substituir a coleta real do usuário para fazer um teste destrutivo. Não chamar um teste offline de execução real no n8n.

- [ ] **Step 5: Encerrar documentação e revisão do PR.**

Run: node node_modules/vitest/vitest.mjs run --project unitario src/docs.test.ts

Run: git diff --check

Atualizar o manual e o título/corpo do PR #53 para a experiência final das três abas, com testes e pendência operacional explícita se existir. Usar corpo por arquivo e anexar novamente o PR apenas se necessário; não criar PR empilhado. Commitar somente a documentação desta tarefa. Fazer push e conferir o CI do commit final antes de merge. Não fazer merge automaticamente.

O aceite separa: código/testes locais concluídos; planilha preparada; JSON entregue; instalação e execução real comprovadas. Somente os itens com evidência ficam concluídos.

## Checagem de cobertura e passagem

Entrada e campos → tarefas 1/2. Fixos, deduplicação e consultas → tarefas 1/4. Cadastros/aliases e parser real → tarefa 2. Três abas, preservação e publicação → tarefas 3/5. Falhas, notas e readback → tarefas 3/4. Instalação manual, credenciais e aceite real → tarefa 5.

Este plano não amplia endereços no importador, não consulta Receita Federal e não altera usuários, senhas ou dados do CRM.

## Escolha da execução

Recomendação: Native, com implementação neste chat e revisão independente da branch no final. As cinco tarefas compartilham contratos pequenos em sequência; manter um implementador reduz repasse de contexto.

Alternativa: subagentes, com implementação e revisão por tarefa, ao custo de mais contextos. Começar somente depois de o usuário revisar o plano e escolher o método.
