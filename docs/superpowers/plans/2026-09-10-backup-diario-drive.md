# Backup diário no Drive — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Preparar backup criptografado dos dois bancos para execução pelo Windows às 18h.

**Architecture:** Um CLI local coleta dumps com Docker, cifra e publica pacotes no Drive. PowerShell protege a chave via DPAPI e registra a tarefa com identidade interativa do usuário. Recuperação e comprovação remota precedem a ativação.

**Tech Stack:** Node.js, TypeScript, Vitest, PostgreSQL/Docker e PowerShell do Windows; nenhuma dependência nova.

**Spec:** ../specs/2026-09-10-backup-diario-drive-design.md

## Restrições globais

- Destino proposto G:\Meu Drive\CRM Backups; separar local e railway.
- AES-256-GCM com chave aleatória de 32 bytes; recuperação em arquivo independente, sem chave no Drive, Git, stdout ou argumentos.
- Somente operações de leitura nos bancos. Não restaurar origens.
- Verificação remota não pode ser inferida da presença do arquivo em G:.
- Preservar 14 cópias válidas; não excluir arquivos até confirmação remota.
- Não ativar agendamento antes de chave guardada e recuperação externa testada.
- Branch codex/backup-diario-drive no checkout existente, seguindo o fluxo utilizado pelo projeto. Preservar AGENTS.md não rastreado.

## Tarefa 1 — pacote criptografado e seleção de retenção

Arquivos: src/server/backup/pacote.ts e pacote.test.ts.

Interfaces: cifrar(conteudo: Buffer, chave: Buffer): Buffer; decifrar(pacote: Buffer, chave: Buffer): Buffer; selecionarExpirados(nomes: string[], manter: number): string[].

- [ ] Escrever testes de roundtrip binário, chave errada, adulteração do cabeçalho/ciphertext/tag, truncamento, nonce distinto e nome alheio ignorado.
- [ ] Rodar `npx vitest run --project unitario src/server/backup/pacote.test.ts` e registrar RED.
- [ ] Implementar envelope com cabeçalho versionado autenticado, nonce aleatório de 12 bytes e tag de 16 bytes; recusar chaves com tamanho diferente de 32 e envelopes inválidos antes de devolver dados.
- [ ] Seleção pura de retenção aceita somente nomes gerados `crm-backup-AAAA-MM-DDTHH-mm-ss-sssZ-<hex>.crmbackup`, preserva nomes estranhos e recusa manter menor que 1.
- [ ] Rodar testes e typecheck, revisar diff e registrar GREEN.

Teste mínimo de aceitação:

```ts
const chave = randomBytes(32)
const origem = Buffer.from([0, 255, 1, 13, 10])
const pacote = cifrar(origem, chave)
expect(decifrar(pacote, chave)).toEqual(origem)
pacote[pacote.length - 1] ^= 1
expect(() => decifrar(pacote, chave)).toThrow()
```

## Tarefa 2 — execução e estado operacional

Arquivos: src/server/backup/executar.ts, executar.test.ts; scripts/backup/executar.mts e recuperar.mts.

- [ ] Testar com adaptadores temporários indisponibilidade de destino, falha isolada de alvo, publicação atômica, concorrência, resultados sanitizados e ausência de rotação sem confirmação remota.
- [ ] Implementar coleta com pg_dump custom e pg_dumpall roles-only no-role-passwords via Docker, ambiente do processo filho sanitizado e TLS verificado para Railway; reaproveitar padrões do backup manual sem depender do scratch.
- [ ] CLI consome configuração privada e chave via entrada padrão, nunca argumento. Pacote JSON versionado contém dumps base64 e manifesto de hash, origem e data, cifrado por Tarefa 1. Limitar tamanho antes de carregar em memória e falhar explicitamente se excedido.
- [ ] Escrever temporário exclusivo na pasta do alvo e renomear após cifra, validar pacote e registrar gravado_no_drive/sincronizacao_nao_confirmada. Lock exclusivo tem prazo conservador: não remover lock desconhecido automaticamente.
- [ ] Recuperar apenas para pasta nova e vazia escolhida explicitamente, validar hashes e nomes fixos antes de escrever; nenhuma execução SQL automática.
- [ ] Registrar falhas sem stderr bruto de ferramentas ou URLs privadas.

## Tarefa 3 — Windows e operação documentada

Arquivos: scripts/backup/windows.ps1; docs/operacao/backup-diario.md.

- [ ] Testar proteção DPAPI e ida/volta de chave em perfil local; sem exibir chave em ferramentas.
- [ ] Implementar comandos preparar, executar, situacao e instalar. Preparar gera chave de recuperação exclusiva em local privado fora do repositório e do Drive. Configuração referencia caminhos absolutos e nunca guarda senha Railway.
- [ ] Instalar é separado: tarefa diária 18h, usuário interativo sem elevação, StartWhenAvailable, IgnoreNew, repetição limitada após erro, execução oculta e prazo máximo. Recusar instalação ativa sem confirmações de recuperação e chave guardada.
- [ ] Documentar dependências, falhas, cópia da chave no celular e conferência no Drive web. Confirmar que presença local não comprova upload.
- [ ] Rodar testes, typecheck, lint e revisão independente. PR com CI verde antes da instalação operacional. Registrar tarefa inicialmente desativada caso ainda faltem as confirmações de ativação.

## Verificação operacional

- [ ] Conferir privacidade do destino web antes de publicar dados.
- [ ] Gerar chave, entregar arquivo ao usuário e aguardar confirmação de cópia no celular.
- [ ] Gerar cópias, conferir nuvem e baixar para testar decriptação e restauração em containers isolados.
- [ ] Só então ativar a tarefa autorizada; registrar próxima execução e limitações.
