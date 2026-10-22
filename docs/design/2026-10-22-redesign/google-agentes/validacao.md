# Validação dos agentes e da planilha

## Implementação antes da revisão

BASE `7b92660`, branch `codex/redesign-crm`. O usuário aprovou explicitamente
agente por vendedor, planilha/equipe compartilhadas, dias móveis, execução
inline, prévia e revisão independente.

- Banco novo: ausência dos objetos observada RED; integração Google 30/30
  após a migração, incluindo identidade do executor, pausa, privacidade e
  revisão transacional. Intenção de escrita também observada RED → GREEN.
- Cliente Sheets: ausência do módulo observada RED; sete testes confirmam
  assinatura OAuth, RAW, aba/linha divergente, resposta incerta e readback.
- Serviço: ausência observada RED; quatro integrações com banco real e
  fornecedor simulado confirmam gravação, retomada, destino e concorrência.
- Executor: protocolo sem identidade e CLI real observados RED; unidade17/17
  com cliente, subprocesso e dez casos Python. Nenhuma coleta foi iniciada.
- UI: datas, novas visões e sincronização observadas RED; unidade20/20 e
  integração34/34 aprovadas. Typecheck e lint aprovados.
- Jornada nova observada RED contra o build anterior: faltavam os títulos
  da agenda móvel e dos agentes. Isolamento Google observado RED → GREEN:
  cinco testes impedem herdar credenciais e rejeitam preloads fora do harness.

Verificações completas desta versão:

- Unidade: **1.415 aprovados e um ignorado**, 1.416 no inventário real.
- Integração: **638 aprovados e um ignorado**, em bancos locais descartáveis.
- Build de produção E2E, typecheck, lint, convenções de migração e
  `git diff --check`: aprovados.
- Navegador: **64/64 jornadas aprovadas**, incluindo os dois cenários novos
  com OAuth/Sheets locais e preservação das jornadas CNPJ.biz.
- Capturas novas: vendedor em desktop e 390 px escuro, gestor em desktop.

O inventário foi extraído do JSON da execução completa aprovada, sem inferir
nomes nem contagem. Os dois testes ignorados já pertenciam à suíte anterior.
Nenhuma planilha, chave, permissão, automação ou migração remota real alterada.

## Decisões do executor

1. `Ruling:` seguir do desenho aprovado diretamente pelo plano derivado,
   conforme autorização explícita para implementar aqui. Custo se incorreto:
   ajustar a divisão técnica das tarefas.
2. `Ruling:` persistir a matriz da intenção antes do HTTP e aceitar somente
   conteúdo de linha conhecido na retomada. Isso protege resposta incerta e
   edições manuais divergentes. Custo: auditoria por revisão e uma transação
   local adicional.

## Revisão independente

Revisão independente a executar sobre a implementação completa aprovada.
