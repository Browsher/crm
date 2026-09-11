# Consulta resumida de empresas: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** permitir que usuários ativos localizem empresas por nome e filtros,
vendo cadastro resumido e disponibilidade sem obter contatos alheios.

**Architecture:** funções de leitura no PostgreSQL retornam somente campos
permitidos. Uma unidade em features/prospeccao valida parâmetros e traduz os
resultados; app/fila/localizar fornece o consumidor real nesta entrega.

**Tech Stack:** PostgreSQL, TypeScript, Next.js App Router, Vitest e Playwright.

**Spec:** docs/superpowers/specs/2026-09-10-fila-interface-design.md.

## Restrições globais

- Input somente para nome; CNAE, estado, cidade e bairro são seletores.
- Incluir cadastro resumido das empresas de outros vendedores.
- Textos separados: "Indisponível" e "Com outro vendedor". Sem travessões no site.
- Não expor telefone, e-mail, contato, histórico, identidade de outro vendedor
  ou CNPJ nesta projeção. As leituras completas existentes mantêm sua RLS.
- Não mudar reserva, troca de empresa, registro, recentes ou visual final.
- Não criar função concedida sem consumidor. Não ampliar SELECT de empresa.
- Sem import entre features. Somente app compõe funcionalidades distintas.
- Branch codex/consulta-empresas; PR contra main e CI verde antes de integrar.
- AGENTS.md não rastreado pertence ao usuário; não incluir no commit.

## Evidências e decisões técnicas

Conferidos: app/empresas/page.tsx exige gestor e listagem.ts retorna contatos;
0016_empresa_fila.sql restringe leitura de empresa à posse/reserva do vendedor;
0015_empresa_busca.sql fornece busca normalizada sem acentos; 0013_cep.sql
fornece localidade, UF, bairro e IBGE. A 0023 já fornece cnae_principal.

Usar funções SECURITY DEFINER com search_path vazio, referências qualificadas,
REVOKE de PUBLIC, GRANT para app_usuario e guarda public.pode_ler(). Essa guarda
recusa usuário inexistente, ausente ou desativado com SQLSTATE 42501.
As funções serão acrescentadas à lista fechada de invariantes.

Alternativas descartadas: liberar SELECT de empresa exporia contatos;
duplicar o cadastro resumido em outra tabela exigiria sincronização desnecessária.

## Contratos compartilhados

Criar src/features/prospeccao/filtros.ts e tipos.ts.

```ts
export type Filtros = {
  nome: string
  cnae: string | null // null: todos; 'nao_informado': coluna nula
  uf: string | null
  cidade: string | null // código IBGE, não nome livre
  bairro: string | null
  pagina: number
}
export type Disponibilidade =
  | 'disponivel' | 'comigo' | 'reservada_comigo'
  | 'outro_vendedor' | 'em_descanso'
export type ResumoEmpresa = {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnaePrincipal: string | null
  cidade: string | null
  uf: string | null
  bairro: string | null
  disponibilidade: Disponibilidade
}
export type ResultadoConsulta =
  | { ok: true; empresas: ResumoEmpresa[]; temProxima: boolean }
  | { ok: false; motivo: 'sem_permissao' }
```

20 resultados por página, ordenados por razão social e id; buscar 21 para
determinar temProxima, sem contagem total enganosa em página vazia.
Limite de página: 10000. Nome até 100 caracteres. Bairro até 200.
Parâmetros inválidos retornam erro de filtro, sem executar busca ampliada.
UF exige duas letras maiúsculas, cidade sete dígitos, CNAE sete dígitos ou
nao_informado. Cidade exige UF; bairro exige cidade. Todos os filtros combinam AND.
Nome busca trecho de razão social/nome fantasia sem diferenciar acento ou caixa;
%, _ e barra invertida são literais. Não pesquisar CNPJ pelo input de nome.

Disponibilidade é calculada no banco, com precedência:
1. Posse do usuário: comigo.
2. Posse de outro usuário ativo: outro_vendedor.
3. Reserva vigente: reservada_comigo ou outro_vendedor.
4. Descanso futuro: em_descanso.
5. Demais casos: disponivel. Posse de usuário desativado segue elegibilidade
   existente da fila; reserva expirada não conta como vigente.
Status é informativo, não promessa de reserva: as futuras escritas revalidam.

## Tarefa 1: parâmetros e mensagens

Arquivos novos: src/features/prospeccao/{tipos,filtros,mensagens}.ts e testes.
lerFiltros(params) retorna {ok:true,filtros: Filtros} ou
{ok:false,motivo:'filtro_invalido'}. Arrays usam primeiro valor, como consulta.ts.
mensagemDisponibilidade recebe Disponibilidade e devolve {titulo, detalhe}.

- [ ] Escrever testes antes da implementação, incluindo:

```ts
expect(lerFiltros({ cnae: 'abc' })).toEqual({ ok: false, motivo: 'filtro_invalido' })
expect(lerFiltros({ cidade: '3550308' })).toEqual({ ok: false, motivo: 'filtro_invalido' })
expect(mensagemDisponibilidade('outro_vendedor')).toEqual({
  titulo: 'Indisponível', detalhe: 'Com outro vendedor',
})
```

- [ ] Rodar npx vitest run --project unitario src/features/prospeccao e observar
  falha por módulos ausentes. Implementar validação pura conforme contrato.
- [ ] Cobrir vazio, filtros combinados, limites, parâmetros duplicados, números
  de página inválidos e mensagens sem travessão. Rodar novamente até verde.

## Tarefa 2: projeção segura, filtros e disponibilidade

Arquivos: criar db/migracoes/0024_empresa_consulta.sql (conferir número livre),
docs/db/0024.md, src/features/prospeccao/repositorio.ts e
tests/integracao/prospeccao-consulta.test.ts. Atualizar docs/db/0014.md,
src/server/db/migracoes/invariantes.ts, seus testes e inventários de migração.

Interfaces SQL, sem receber identidade do usuário como argumento:

```sql
empresa_consultar(p_nome text, p_cnae text, p_uf text,
                  p_cidade text, p_bairro text, p_pagina integer)
-- RETURNS TABLE: id uuid, razao_social text, nome_fantasia text,
-- cnae_principal text, cidade text, uf text, bairro text, disponibilidade text

empresa_filtros(p_uf text, p_cidade text)
-- RETURNS TABLE: tipo text, valor text, rotulo text
-- tipos: cnae, uf, cidade, bairro
```

empresa_filtros retorna DISTINCT valores presentes nas empresas importadas,
não todas as localidades da base CEP. CNAEs e UFs independem dos demais campos;
cidades dependem de UF, bairros dependem de UF+IBGE. CNAE nulo gera a opção
nao_informado com rótulo Não informado quando existir na base. Demais códigos
CNAE aparecem sem descrição inventada. CEP ausente/não resolvido não fornece
localidade; bairro vazio vira null. Não eliminar essas empresas da consulta
sem filtro geográfico. Ordenar opções por rótulo e valor.

- [ ] Criar bancos isolados com ajuda.ts. Testar consulta antes da migração:
  vendedor lê resumo de empresa alheia, mas SELECT direto de empresa e leitura
  de histórico continuam negados pela política existente.
- [ ] Testar funções sem identidade, com usuário desativado e papel PUBLIC;
  usuário ativo consegue apenas as colunas listadas no contrato.
- [ ] Testar estados de posse, reserva vigente/expirada, descanso e dono inativo.
- [ ] Testar nome com acento, %, _, barra, coincidência só no CNPJ que não deve
  casar; filtros AND, CNAE nulo, cidades homônimas com IBGE diferente, bairro
  nulo, CEP ausente/desconhecido e paginação com nomes iguais.
- [ ] Observar falhas por funções inexistentes. Implementar SELECT com JOIN
  empresa/cep/empresa_fila/usuario, guarda explícita e projeção fechada.
  Validar limites no SQL também, com 22023 para parâmetros fora do contrato.
  Não interpolar SQL; usar parâmetros posicionais.
- [ ] Conferir COUNT/nomes das colunas devolvidas no teste, não apenas ausência
  de dados em fixtures. Comparar permissões antes/depois com invariantes.
- [ ] Implementar consultarEmpresas(usuarioId, filtros): Promise<ResultadoConsulta>
  e listarOpcoes(usuarioId, uf, cidade), ambos por comoUsuario. Tratar somente
  42501 como sem_permissao; exceção de infraestrutura sobe.
- [ ] Rodar testes novos, schema e políticas existentes. Documentar RLS mantida,
  funções novas, limites e ponteiro no documento da tabela original.

## Tarefa 3: consumidor funcional na Fila

Criar app/fila/localizar/{page,formulario,resultados,paginacao}.tsx e testes de
componentes. Modificar app/fila/page.tsx para link Localizar empresa.
Ler inteiros app/empresas/page.tsx, app/empresas/importar/formulario.tsx e
app/fila/page.tsx como moldes; ler os guias locais Next de page e use-client.

- [ ] Escrever testes de renderização para labels, opções, estados, ausência de
  contatos e navegação de páginas preservando filtros. Observar vermelho.
- [ ] Página usa exigir('usuario'), searchParams assíncronos e lerFiltros.
  Erro de filtro mostra mensagem e link Limpar filtros, sem executar consulta.
- [ ] Formulário GET tem nome e quatro selects. Alterar UF limpa cidade/bairro;
  alterar cidade limpa bairro. Atualizar a URL para recarregar opções dependentes,
  preservar nome/CNAE e retornar à primeira página. Botão Consultar aplica busca.
- [ ] Cards mostram somente ResumoEmpresa e mensagemDisponibilidade. Não criar
  botão Ver perfil sem destino implementado nem botão de reserva fictício.
- [ ] Sem nome/filtro, instruir a pessoa a pesquisar. Recentes e sugestões
  automáticas continuam na fatia própria; não simular histórico nesta entrega.
- [ ] Estado vazio: Nenhuma empresa encontrada. Status não depende só da cor.
  Campo Nome, labels dos selects, botão e links acessíveis por teclado.
- [ ] Paginação calcula anterior/próxima por pagina e temProxima, preservando
  filtros com URLSearchParams. Página vazia permite voltar.
- [ ] Rodar testes de componentes e revisar textos, inclusive ausência de travessão.

## Tarefa 4: verificação e integração

- [ ] Acrescentar jornada Playwright ao padrão existente em tests/e2e, com gestor
  e vendedor de teste: localizar empresa alheia, filtrar, ver indisponibilidade,
  confirmar que telefone/e-mail de fixture não aparecem no HTML da consulta.
- [ ] Rodar typecheck, lint, db:checar, suíte completa em PostgreSQL 18 isolado,
  build:e2e e test:e2e. Corrigir falhas antes de declarar a entrega pronta.
- [ ] Revisar diff contra esta fatia; revisar a projeção SQL e os grants.
  Confirmar AGENTS.md fora do stage e branch diferente da main antes de commit.
- [ ] Abrir PR com resultado medido e limitações: localização funcional, reserva
  por empresa e visual final em fatias seguintes. CI verde antes do merge.
- [ ] Após integração, backup configurado, checagem de pendentes e aplicação da
  migração local/Railway seguindo o fluxo autorizado. Conferir invariantes.

## Autorrevisão de escopo

Busca e filtros: tarefas 1 a 3. Projeção e disponibilidade: tarefa 2.
Textos aprovados: tarefas 1 e 3. Segurança e regressão: tarefas 2 e 4.
Reservas, recentes e redesign não fazem parte desta entrega. As interfaces
acima pertencem a esta fatia e não pressupõem funções de futuras etapas.

## Registro de execução

- Trabalho no checkout existente, branch codex/consulta-empresas, conforme
  fluxo já usado no projeto. Nenhum commit na main.
- TDD observado: filtros/mensagens e UI falharam por módulos ausentes; 28
  testes SQL falharam por funções inexistentes. Registro de grants e
  repositório também tiveram falha antes da implementação.
- Decisão de revisão: filtro de URL antiga sem opção correspondente continua
  selecionado com rótulo Sem correspondência, sem ampliar a busca silenciosamente.
- Decisão de revisão: bairro só com espaços é inválido no TypeScript e SQL;
  rótulos reais são preservados. Teste vermelho seguido de verde.
- Rótulos dos selects usam associação explícita; a jornada no navegador
  comprovou nome, seletores dependentes, paginação e alerta de filtro inválido.
- Verificação local: 974 testes aprovados, um ignorado em PostgreSQL 18 isolado;
  8 jornadas Playwright aprovadas, incluindo gestor/vendedor, ausência de
  contatos no HTML, teclado e largura de 390 pixels. Build de produção passou.
- CI e integração são registrados no PR da entrega.
