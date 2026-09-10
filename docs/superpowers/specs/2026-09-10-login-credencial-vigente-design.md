# P1: emissão de sessão exige credencial vigente

Data: 10/09/2026. Diagnóstico: 061bb2c. Base atual: 0ac5ae7, após merge do PR #23. Branch: codex/login-credencial-vigente. Status: implementada e revisada; validação local concluída, aguardando CI e integração. Migração Railway não aplicada.

## Problema confirmado

O login lê a credencial e verifica o hash no Node. Depois chama sessao_criar apenas com usuário, token e expiração. A função SQL não verifica se a credencial lida continua vigente.

Reprodução executada em Postgres 17 descartável na porta 55433, com banco temporário e duas conexões app_teste. Os módulos entrar, sessao e senha são reais; o adaptador de SQL foi substituído para concluir a revogação imediatamente após a leitura da credencial. O transporte HTTP não foi exercitado.

| Cenário | Senha antiga confere ao fim? | Login aceito? | Sessão emitida válida? |
|---|---|---|---|
| Controle sem troca | sim | sim | sim |
| Titular troca antes da emissão | não | sim | sim |
| Gestor redefine antes da emissão | não | sim | sim |

O resultado demonstra o defeito, não sua frequência em produção. Reprodução local preservada em C:/Users/ADM/.codex/visualizations/2026/09/10/01a08c6e-d13a-7721-9cb2-f221e09723cc/diagnostico-login-p1.cjs. Os testes de regressão desta entrega devem ser versionados no projeto e independentes desse arquivo local. Revisão independente do código confirmou a causa e examinou a ordem das travas; a solução proposta ainda não foi implementada nem testada.

## Contrato recomendado

Uma emissão baseada em credencial revogada deve ser recusada pelo banco. A aplicação devolve credenciais_invalidas, sem token e sem registrar essa tentativa como sucesso.

Se a emissão concluir antes da troca, a troca deve revogar a sessão emitida. Se a troca concluir primeiro, a emissão deve recusar a versão antiga. Preservar a sessão usada pelo titular para trocar sua própria senha, como no contrato atual. A redefinição pelo gestor continua encerrando todas as sessões do alvo.

## Alternativas

1. **Versão dedicada da credencial (recomendada).** Campo bigint com valor inicial 1; cada substituição pelos caminhos de senha_trocar e credencial_definir incrementa a versão na mesma transação. A leitura da credencial entrega hash e versão juntos. A versão atravessa o TypeScript como string, evitando perda de precisão. O seed apenas insere uma credencial nova e utiliza o valor inicial. É uma mudança maior que comparar hashes, mas representa exatamente o evento de revogação.
2. **Comparar o hash verificado.** Menos alterações, mas redefinir literalmente o mesmo hash ou fazer A → B → A não distingue a revogação. O SQL atual aceita repetir o hash e mesmo assim revoga sessões, portanto essa opção enfraquece esse contrato.
3. **Manter uma transação aberta durante a verificação da senha.** Aumenta o tempo de conexão e de trava enquanto o scrypt roda. Não há necessidade de prender o banco durante esse cálculo se a versão for conferida na emissão.

## Desenho proposto

- credencial_por_email devolve também a versão.
- sessao_criar recebe a versão verificada, bloqueia primeiro a credencial, confere a versão e depois bloqueia o usuário para conferir seu estado ativo. Só então insere a sessão e devolve o estado atual da marca provisória.
- Ordem explícita de travas: credencial → usuário → sessão. Não depender da ordem de um JOIN. A proposta preserva a ordem dos caminhos atuais de troca/redefinição.
- A trava de usuário precisa conflitar com atualização de ativo: propor FOR SHARE; a credencial usa FOR UPDATE. Validar a interação com as funções existentes por testes com duas conexões.
- A assinatura antiga de três argumentos é removida; não manter um caminho que emita sem conferir a versão.
- Ao recriar funções por mudança de assinatura ou retorno, restabelecer dono, search_path e privilégios restritos; nenhuma função nova permanece executável por PUBLIC.
- entrar e criarSessao tratam a recusa explicitamente e só registram sucesso depois de uma emissão aceita. A marca provisória vem da decisão final, não da leitura anterior.
- Mapa de funções, aridades, tipos e fixtures de teste acompanham o novo contrato.
- Aplicar por nova migração, prevista como 0022 se continuar sendo o próximo número quando a implementação começar. Não editar migrações já aplicadas.
- Atualizar docs/db/0007.md, 0009.md e 0012.md com ponteiros para o novo documento, conforme R-015, e atualizar a fundação.

## Verificação exigida

Antes da correção, teste de regressão falhando pelo resultado incorreto, não por falta de coluna ou função. Depois, verificar:

- emissão normal com versão vigente;
- revogação por titular e gestor no intervalo do login;
- ambas as ordens concorrentes, com a primeira transação ainda aberta e a segunda efetivamente esperando pela trava;
- rollback da troca, que deve preservar a versão anterior;
- redefinição com mesmo hash e sequência A → B → A;
- ausência de credencial, versão incorreta/nula e usuário inativo;
- desativação concorrente em ambas as ordens: emissão anterior é revogada; desativação anterior impede emissão;
- transporte de versão bigint acima do limite seguro de Number sem arredondamento;
- preservação da sessão do titular e revogação das demais;
- ausência de token e de sucesso falso quando a emissão é recusada;
- remoção da assinatura antiga e manutenção de privilégios restritos;
- fluxo integrado real de entrar e regressões da suíte existente.

Testes concorrentes usam barreiras/transações e verificações de espera com prazo, sem depender de sleeps para ordenar eventos. O scrypt continua fora da transação de emissão.

## Limites e integração

Esta proposta trata o P1 de emissão de sessão. Não corrige a fila, a RLS do vendedor inativo ou a equivalência Unicode, que permanecem tarefas separadas. Credenciais administrativas continuam sendo parte da fronteira de confiança existente.

A revisão identificou uma hipótese adjacente: senha_trocar resolve a sessão antes de esperar pela credencial e não a revalida depois da espera. Uma troca concorrente pode prosseguir com autorização revogada nesse intervalo. Foi identificada por leitura, sem reprodução nesta etapa; exige decisão de escopo própria e não deve ser apresentada como resolvida por este trabalho.

Remover a assinatura SQL antiga exige coordenar código e banco: usar janela curta com o aplicativo parado, aplicar a migração e iniciar a versão nova; evitar instâncias antigas recebendo logins durante a mudança. Antes de executar em produção, preparar comandos e verificar o processo real de deploy. Não há autorização implícita nesta proposta para parar ou migrar produção.

Próximas etapas: aprovação desta especificação, plano versionado nesta branch, TDD, revisão independente da implementação, checks e PR contra main. A entrega local deve passar também pelos cinco testes Playwright integrados no PR #23. Backup/restauração e observabilidade são etapas posteriores independentes. Nenhuma alteração de produção foi feita durante o diagnóstico.

## Conferência da base atual

Em 10/09/2026, a leitura de src/server/autenticacao/entrar.ts e sessao.ts confirmou a emissão sem versão e o registro de sucesso anterior à emissão. A leitura de db/migracoes/0009_funcoes_autenticacao.sql e 0012_situacao_e_auditoria.sql confirmou os contratos SQL descritos. O mapa src/server/db/sem-identidade.ts ainda declara sessao_criar com três argumentos. A listagem de db/migracoes confirmou 0021 como último número existente. O PR #23 alterou infraestrutura de testes, sem corrigir esses caminhos de autenticação.
