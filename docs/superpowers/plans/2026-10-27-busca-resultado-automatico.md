# Plano: abertura automática do resultado

Spec: ../specs/2026-10-27-busca-resultado-automatico-design.md
Execução nesta conversa, worktree crm-redesign, branch codex/redesign-crm e PR55.

1. RED no teste DOM de BuscaDialogo: inicialmente aberto com conteúdo do servidor, sem action, fecha e não reabre no rerender, reabre sob demanda pela action.
2. Adicionar props opcionais de conteúdo/abertura inicial e rótulo ao Dialog existente. Na página, reutilizar ConteudoBusca no Dialog em lugar dos resultados inline, com key UUID. Adicionar link para /fila/localizar?origem=banco.
3. GREEN: unidade focada, tipos/lint/build, jornadas de busca/histórico/filtros/importação. E2E passa a exigir Dialog visível após submissão e refresh sem chamada nova.
4. Revisão independente. Commit, PR, CI completo e publicação verificada no endereço estável. Registrar a fonte, sem merge e sem executar busca paga.

## Verificação local

RED confirmado: Dialog não abria com conteúdo inicial. GREEN em seis testes focados de Dialog/histórico/resultados. Typecheck, lint dos arquivos alterados e build E2E passaram. Seis jornadas afetadas passaram (incluindo popup automático após submissão e refresh, histórico, importação e pausa). Revisão independente estática final sem achados Critical/Important/Minor. Nenhuma consulta real ou mudança de configuração.

## Entrega

Fonte 06af7223d4d36f1842e8119d65e9ad93edf2a267 publicada e conferida no deployment dpl_78jzMvriTcSJh5ucE24jFkZmDM14. CI40546516169 aprovado: 1.725 unitários (2 ignorados), 713 integrações e 75 jornadas. Smoke no endereço estável aprovado, apenas sem autenticação; jornadas autenticadas testadas localmente. Sem consulta real ou mudança de configuração. PR55 atualizada e sem merge.
