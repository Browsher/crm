# CNAE opcional na importação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** importar e exibir CNAE principal opcional mantendo o CSV antigo válido.

**Architecture:** normalização pura, parser versionado pelo cabeçalho, persistência
na tabela empresa por migração aditiva. Leitura e escrita mantêm a autorização
existente. A listagem do gestor exibe o dado, fornecendo consumidor nesta entrega.

**Tech Stack:** TypeScript, Vitest, PostgreSQL, Next.js e gerador XLSX existente.

**Spec:** docs/superpowers/specs/2026-09-10-fila-interface-design.md.

## Global Constraints

- CNAE principal opcional, sem inferência por nome ou atividade.
- Preservar o cabeçalho antigo de sete colunas.
- Não implementar leitura direta de XLSX: modelo preenchido é exportado como CSV.
- Não adicionar capital ou sócios.
- Branch e PR, TDD, sem alterações nas migrações aplicadas.
- features não importa outra features.
- CNPJ já cadastrado continua ignorado; não fazer UPDATE implícito na reimportação.
- Validar formato, sem afirmar que o código existe no catálogo oficial.

## 1. Normalização e interpretação dos dois formatos

**Files:** criar src/features/empresas/cnae.ts e cnae.test.ts; modificar
planilha.ts, planilha.test.ts, mensagens.ts e mensagens.test.ts no mesmo diretório.

**Interfaces:** normalizarCnae recebe string e retorna resultado discriminado
com valor string de sete dígitos ou null. LinhaAceita ganha cnaePrincipal:
string | null, obrigatório no objeto normalizado. MotivoDeCampo ganha cnae_forma.

- [x] Escrever o teste primeiro:

```ts
test.each([
  ['', { ok: true, valor: null }],
  ['  ', { ok: true, valor: null }],
  ['4742-3/00', { ok: true, valor: '4742300' }],
  ['4742300', { ok: true, valor: '4742300' }],
  ['abc4742300', { ok: false }],
  ['474230', { ok: false }],
  ['47423000', { ok: false }],
])('normaliza %s', (entrada, esperado) => {
  expect(normalizarCnae(entrada)).toEqual(esperado)
})
```

- [x] Executar o teste e observar falha antes da implementação.
- [x] Implementar somente as duas formas aceitas:

```ts
export function normalizarCnae(bruto: string):
  { ok: true; valor: string | null } | { ok: false } {
  const v = bruto.trim()
  if (!v) return { ok: true, valor: null }
  if (!/^(?:[0-9]{7}|[0-9]{4}-[0-9]\/[0-9]{2})$/.test(v)) return { ok: false }
  return { ok: true, valor: v.replace(/[-/]/g, '') }
}
```

- [x] Acrescentar casos de parser: cabeçalho antigo com linha de sete colunas
  produz null; novo cabeçalho com oitava coluna vazia produz null; pontuação
  normaliza; inválido recusa linha; coluna excedente não é descartada.
- [x] Manter CABECALHO_LEGADO com o literal antigo; CABECALHO passa a acrescentar
  ,cnae_principal. Escolher colunas pelo cabeçalho e passar essa seleção para
  analisarLinha. Número de campos deve corresponder exatamente ao formato.
- [x] Incluir CNAE na detecção de NUL e de divergência entre duplicatas. Não
  comparar coluna ausente como undefined: resultado normalizado usa null.
- [x] Mensagem de colunas erradas deve informar o formato esperado da linha.
  Acrescentar esperado opcional a recusa de campo (7 | 8), preenchido neste
  motivo; não manter texto fixo de sete colunas para arquivo novo.
- [x] Rodar testes específicos, corrigir fixtures tipadas LinhaAceita com null,
  conferir que os testes de formato antigo continuam exercitando sete colunas.

## 2. Persistência e consumidor real

**Files:** nova db/migracoes/0023_empresa_cnae.sql e docs/db/0023.md;
src/features/empresas/repositorio.ts, listagem.ts; app/empresas/linha.tsx,
linha.test.tsx; tests/integracao/empresas.test.ts e empresas-listagem.test.ts.
Conferir a numeração livre imediatamente antes de criar a migração.

- [x] Teste de integração primeiro: gestor grava CNAE normalizado e lê; omissão
  grava null; vendedor não obtém nova permissão de INSERT; escrita SQL com
  formato inválido falha por CHECK. Usar os helpers existentes, sem banco real.
- [x] Executar e confirmar falha por coluna inexistente.
- [x] Criar migração aditiva:

```sql
-- ver docs/db/0023.md
BEGIN;
ALTER TABLE empresa ADD COLUMN cnae_principal text
  CHECK (cnae_principal IS NULL OR cnae_principal ~ '^[0-9]{7}$');
COMMIT;
```

- [x] Acrescentar coluna, oitavo parâmetro text[] e mapeamento cnaePrincipal ao
  INSERT/unnest existente. Nenhum UPDATE ou ON CONFLICT novo.
- [x] Acrescentar cnae_principal ao SELECT da listagem e traduzir para
  cnaePrincipal. Exibir código ou Não informado na linha existente, sem criar
  nova rota ou liberar listagem ao vendedor. Ler linha.tsx e seus testes inteiros
  antes de escrever; ler guia local de Next.js relevante antes da edição JSX.
- [x] Testar a exibição e a listagem com null e valor preenchido. Reimportação
  de CNPJ existente permanece ignorada, mesmo quando vier com CNAE.
- [x] Documentar backfill como operação futura explícita, não efeito implícito
  da importação. Explicar limite da validação de formato no documento da migração.

## 3. Modelo, mensagens e verificação da entrega

**Files:** src/features/empresas/modelo.ts e modelo.test.ts;
app/empresas/importar/formulario.tsx e formulario.test.tsx;
public/modelo-empresas.xlsx caso seja o destino confirmado do gerador.

- [x] Ler scripts/modelo-empresas.mts para confirmar destino antes de gerar.
- [x] Testar a oitava coluna cnae_principal e formato Texto na coluna inteira,
  inclusive abaixo da linha de exemplo. Teste falha antes de alterar o gerador.
- [x] Expandir dimensão, cabeçalho, estilos e exemplo do gerador existente;
  regenerar pelo comando npm run modelo:empresas. Não editar ZIP manualmente.
- [x] Atualizar instruções visíveis do formulário para CNAE opcional e exportação
  CSV. Preservar avisos sobre UTF-8, zeros à esquerda e modelo antigo.
- [ ] Executar typecheck, lint, db:checar, testes de empresas e a suíte completa
  contra ambiente de teste isolado. CI em PostgreSQL 18 e jornadas E2E verdes.
- [ ] Revisar diff e verificar que políticas, autenticação e dados reais não
  mudaram. Abrir PR com resultados medidos. Integrar somente com CI verde.

## Próximo plano

Consulta resumida, filtros e reservas exigem plano próprio: a projeção de
cadastro não pode expor contato por SELECT amplo em empresa. Só depois desses
contratos será ligada a tela aprovada. Não implementar esses subsistemas a
partir desta seção de encaminhamento.

## Evidência de execução

Implementação e revisão concluídas. Suíte local em PostgreSQL 18: 91 arquivos,
893 testes aprovados e um ignorado. Typecheck, lint e db:checar passaram.
Os testes de persistência ficaram em tests/integracao/empresas-cnae.test.ts.
CI, jornadas no navegador e integração serão conferidos no PR.
