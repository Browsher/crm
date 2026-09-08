# Preferências

Gostos e decisões já tomadas. Não são regras de qualidade — são para eu não
ter que repetir a mesma escolha toda semana.

## Stack padrão

- Next.js (App Router) + TypeScript + Tailwind
- Vitest para unidade e integração
- npm (um gerenciador só por projeto)

## Como quero que você fale comigo

- Português.
- Direto. Sem "ótima pergunta", sem resumo do que eu acabei de pedir.
- Quando eu estiver errado, me diz. Não concorda por educação.
- Explica o **porquê** de decisões técnicas — estou aprendendo engenharia,
  não só querendo o código pronto.

## Como quero que você trabalhe

- Antes de mexer em algo que já existe, leia o padrão do projeto e siga.
- Não invente biblioteca, API ou campo. Se não tem certeza, procure no
  código ou me pergunte.
- Faça o que eu pedi. Se você acha que precisa de mais, **proponha antes**,
  não faça e me avise depois.
- Mudança grande vem em passos que eu consiga revisar.
- Uma pergunta por vez no brainstorm, com recomendação e motivo.

## Estilo de código

- TypeScript sem ponto e vírgula, aspas simples.
- Regra de negócio devolve resultado explícito `{ ok, motivo }`, não `throw`.
  Exceção é para falha de infraestrutura.
- Retorno cedo em vez de `else` aninhado.
- Lógica de domínio separada de onde os dados moram (repositório atrás de
  interface), para trocar armazenamento sem reescrever a regra.

## Decisões que já tomei (não reabrir sem motivo)

- Commit direto na main: não. Sempre branch + PR com CI verde.
- Teste: não é opcional.
- Feature grande (2+ arquivos ou regra de negócio): passa por brainstorm e
  spec antes do código.