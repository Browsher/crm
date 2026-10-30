# Arquivamento de bases antigas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Retirar as duas bases antigas e suas empresas do trabalho ativo, preservando o arquivo histórico autorizado pelo usuário.

**Architecture:** Marcadores persistentes de arquivo no banco são a autoridade para consultas e transições. A interface gerencial oferece consulta do arquivo, usando os componentes existentes. Uma operação administrativa separada, precedida de simulação e cópia recuperável, aplica o arquivamento aos IDs exatos de um manifesto; a migração instala apenas o contrato.

**Tech Stack:** PostgreSQL 18, Next.js 16.4.1, TypeScript, Vitest e Playwright existentes.

**Spec:** `docs/superpowers/specs/2026-10-30-arquivamento-bases-antigas-design.md`

## Global Constraints

- Preservar todas as empresas e linhas de histórico; não executar DELETE ou TRUNCATE para esta limpeza.
- Preservar as migrações 0000–0059; iniciar na 0060.
- O estado Arquivada tem identidade própria, distinta de Sem interesse.
- O menu Listas permanece; a importação manual continua desativada.
- Filtrar antes de paginar e contar; impedir mutação direta e concorrente contra empresa arquivada no banco.
- Conservar deduplicação, exclusividade e resultado original de replays; um replay somente consultivo pode retornar o resultado original, mas não reativar vínculos ou agenda.
- Não incluir IDs, clientes ou atividades de produção no código ou em fixtures públicas.
- Não instalar dependências, modificar automações ou escrever em produção durante esta implementação.

## Review Focus

- Cadastro com venda e negociação aberta sai do trabalho ativo sem perder autores, valores ou contatos.
- Cadastro sem vínculo e com pendência recebe o marcador sem inventar responsável.
- URLs antigas, mutações diretas, callbacks e replays não recolocam empresas arquivadas na operação.
- Totais, opções, paginação e arquivo gerencial usam os mesmos critérios e preservam a autorização.
- Simulação/manifestações divergentes, grupos mistos e empresas compartilhadas falham de modo fechado; aplicação repetida é idempotente.

### Task 1: Contrato completo de arquivo e operação administrativa simulada

**Responsabilidade:** um implementador é dono de toda esta tarefa porque leitura, escrita, paginação e arquivo compartilham os contratos do banco. Coordenador cuida da revisão independente, PR/CI e qualquer publicação posterior.

**File map inicial:**

- Criar migração(s) a partir de `db/migracoes/0060_arquivamento_legado.sql` e documento(s) `docs/db/0060.md`, sem dados de produção.
- Atualizar os contratos finais atualmente definidos por `0050_empresa_vinculo.sql` a `0058_leituras_atendimento.sql` por funções novas/substituições na migração, preservando os arquivos anteriores. Incluir as leituras de Gestão, Funil, Carteira, Meu dia, disponibilidade, resumos e entrega conforme consumidores reais.
- Adaptar `src/features/empresas/listagem.ts`, `src/features/empresas/grupos.ts`, consumidores de Gestão/Funil/Carteira/Meu dia e modelos compartilhados em `src/lib/empresa-visual.ts` conforme o contrato final necessário.
- Adaptar as páginas `app/empresas/page.tsx`, `app/empresas/grupos/page.tsx`, detalhes e ações atuais para modo de consulta de arquivadas; criar página gerencial `app/empresas/arquivadas/page.tsx` ou filtro equivalente se reduzir duplicação. Usar os componentes de lista/card e cabeçalho existentes.
- Criar operação administrativa em `scripts/empresas/arquivar-legado.mts`, com código compartilhado somente onde facilitar testes, sem rota pública de escrita. O construtor define a forma do manifesto e da cópia recuperável em arquivo operacional privado; exige explicitamente o manifesto exato para aplicar.
- Testes relevantes em `tests/integracao/`, `tests/e2e/` e nos módulos de domínio afetados; atualizar snapshots de migração e inventário quando os nomes mudarem.

**Interfaces:** definidas pelo implementador após ler as funções finais e seus consumidores. Antes da primeira alteração de runtime, enviar ao coordenador a escolha do marcador, o mapa exato de funções/readers/writers e a política de encerramento/agenda. Isso é revisão técnica dentro do escopo confirmado, não uma alteração das regras do usuário.

- [ ] Ler o padrão e registrar o mapa final antes de alterar runtime; checar todas as fronteiras de leitura e escrita.
- [ ] Escrever testes do novo contrato e observar RED: remoção das consultas ativas, acesso histórico do gestor, recusa de mutação e preservação de histórico.
- [ ] Implementar marcadores, políticas, guardas e leituras com serialização coerente entre atendimento, entrega e arquivamento. Encerrar negociação com motivo explícito e cancelar agenda sem apagar registros históricos.
- [ ] Implementar consulta gerencial do arquivo e tratamento somente leitura nos detalhes de empresas e bases; manter Listas e o design system.
- [ ] Implementar simulação da operação administrativa, verificação de manifesto, aplicação idempotente e exigência de cópia recuperável. Testar só com dados sintéticos locais.
- [ ] Cobrir concorrência, empresa compartilhada, conjunto vazio, divergência de manifesto, chamadas antigas e replays; preservar o resultado das buscas e todos os registros fora do alvo.
- [ ] Executar tipos, lint, convenções SQL, testes afetados e jornadas relevantes. Para Windows, limitar workers e usar Python real só no PATH do comando; evitar suítes pesadas em paralelo. Capturar JSON para inventário sem duplicar execução.
- [ ] Revisão independente de conformidade e qualidade, correção dos achados materiais e CI completo.
- [ ] Abrir PR contra main. Nenhuma integração, publicação ou operação de arquivamento em produção neste passo de implementação sem a autorização correspondente.
