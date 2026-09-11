# Dados para Carteira e Meu dia

> **For agentic workers:** Use superpowers:executing-plans, tarefa por tarefa.

**Goal:** fornecer resumo do último contato e classificação dos retornos pela
consulta autorizada existente, sem alterar telas ou regras de escrita.

**Architecture:** ampliar a projeção do LEFT JOIN LATERAL já usado por
lerMinhasEmpresas. Preservar assinatura, contexto, reserva e carteira.
O banco continua responsável por acesso, desempate e data civil.

**Tech Stack:** TypeScript, PostgreSQL 18, Vitest e harness local existente.

**Spec:** ../specs/2026-09-11-carteira-meu-dia-design.md

## Restrições globais

- Nenhuma feature importa outra feature.
- Não alterar SQL de migrações existentes, credenciais, reserva ou escrita.
- Sem dependências novas. Sem tarefas ou conclusão de retorno independentes.
- Classificar datas em America/Sao_Paulo no banco, não no navegador.
- Trabalhar em branch e PR contra main. Preservar AGENTS.md não rastreado.
- RED/GREEN antes de implementar cada mudança de comportamento.

## Tarefa 1: resumo do último contato

Arquivos: modificar `src/features/fila/consulta.ts`; criar
`tests/integracao/carteira-resumo.test.ts`; ajustar fixtures tipadas afetadas.
Ler antes `tests/integracao/contato-politicas.test.ts`,
`tests/integracao/ajuda.ts` e `src/features/contato/historico.ts`.

Consome `lerMinhasEmpresas(usuarioId: string): Promise<ResultadoMinhasEmpresas>`.
Produz campos adicionais obrigatórios em EmpresaComigo:

```ts
cnaePrincipal: string | null
ultimoContato: {
  nota: string | null
  criadoEm: Date
} | null
```

- [ ] Criar cenário no harness com dois vendedores e uma empresa própria de
  cada. Usar preparação SQL administrativa somente no banco temporário e
  chamar o leitor real com identidade de usuário. Para cada cenário limpar
  contato e empresa_fila como no teste vizinho.
- [ ] Escrever teste para ausência, contato com nota nula e dois contatos com
  datas distintas. Afirmar valores reais do leitor:

```ts
const r = await lerMinhasEmpresas(vendedorA)
expect(r.ok).toBe(true)
if (!r.ok) throw new Error('leitura recusada')
expect(r.carteira).toHaveLength(1)
expect(r.carteira[0].ultimoContato?.nota).toBe('Conversa mais recente')
expect(r.carteira[0].cnaePrincipal).toBe(null)
```

- [ ] Rodar `npx vitest run --project integracao tests/integracao/carteira-resumo.test.ts`
  e registrar falha por campo ausente, não por infraestrutura.
- [ ] Acrescentar `e.cnae_principal` à projeção existente e
  `c.id, c.nota, c.criado_em` à subconsulta lateral, mantendo
  `ORDER BY c.criado_em DESC, c.id DESC LIMIT 1`. Projetar id para distinguir
  nenhum contato de contato existente com nota nula:

```ts
ultimoContato: l.ultimo_contato_id === null ? null : {
  nota: l.ultima_nota,
  criadoEm: l.ultimo_contato_em!,
}
```

- [ ] Tipar campos crus, atualizar mocks tipados com valores nulos e provar
  desempate por id em dois contatos de mesmo criado_em. Não trocar fixtures
  por `any`, não esconder erro de types com casts genéricos.
- [ ] Reexecutar teste focal e `npm run typecheck`. Commit explícito dos arquivos.

## Tarefa 2: classificação do retorno

Arquivos: modificar `src/features/fila/consulta.ts`; criar
`tests/integracao/carteira-retornos.test.ts`; atualizar fixtures tipadas.
Produz `situacaoRetorno: 'atrasado' | 'hoje' | 'futuro' | 'sem_data'` em
EmpresaComigo, mantendo `vencido` compatível com os consumidores atuais.

- [ ] Preparar datas relativas ao dia civil do banco, usando
  `(now() AT TIME ZONE 'America/Sao_Paulo')::date` mais -1, 0 e 1 dia.
  Testar também ausência de próximo passo. Não congelar relógio JS para
  testar decisões SQL. Afirmar associação por id, não ordem incidental.
- [ ] Rodar `npx vitest run --project integracao tests/integracao/carteira-retornos.test.ts`
  e confirmar RED pelos quatro valores ausentes.
- [ ] Acrescentar projeção SQL e mapear resultado sem comparação em TS:

```sql
CASE
  WHEN ultimo.proximo_passo_data IS NULL THEN 'sem_data'
  WHEN ultimo.proximo_passo_data < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'atrasado'
  WHEN ultimo.proximo_passo_data = (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'hoje'
  ELSE 'futuro'
END AS situacao_retorno
```

- [ ] Provar que contato mais recente substitui data antiga, inclusive se sua
  data for nula; sem fallback para um compromisso velho. Provar que reserva
  não entra em carteira e que empresa devolvida deixa de aparecer.
- [ ] Provar isolamento: vendedorB não recebe empresa/nota/data de A e gestor
  não ganha visão global. Manter os testes existentes de RLS e contexto.
- [ ] Reexecutar testes focais e tipos. Commit explícito dos arquivos.

## Tarefa 3: revisão e integração da base

- [ ] Comparar diff com as duas interfaces acima: nenhum endpoint novo,
  biblioteca, migração, comparação de datas JS ou alteração das actions.
- [ ] Executar `npm run test:unit`, `npm run test:integracao`,
  `npm run typecheck`, `npm run lint` e `npm run db:checar`.
  Banco de integração exclusivamente local e descartável.
- [ ] Executar build/E2E pelo runner existente para provar que Fila e Carteira
  antigas seguem funcionando com a projeção ampliada.
- [ ] Abrir PR contra main com evidências; CI verde antes do merge.

## Próximas fatias

Depois da base integrada, escrever plano de Carteira/ficha com os contratos
medidos acima. Sua entrega é cards, filtros, ficha equilibrada e shell comum,
preservando formulário de contato e proteção contra perda de rascunho.
Após essa entrega, escrever plano de Meu dia: rota separada, lista do dia,
seleção autorizada e rolagem independente, reutilizando ficha e dados.
Não iniciar PR empilhado sobre branch da fatia anterior.
