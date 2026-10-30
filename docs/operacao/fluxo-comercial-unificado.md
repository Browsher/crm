# Transição para atendimento com vínculo permanente

Este procedimento é manual e exige janela de indisponibilidade. A 0050 classifica evidências existentes; a 0057 retira permissões usadas pelo aplicativo antigo. Não existe chave de manutenção na aplicação. Não executar migrações com a versão antiga ou seus escritores ainda em atividade. Este documento não representa autorização de implantação.

## Preparação e ensaio

O operador identifica o banco, a versão atualmente servida e todos os escritores: instâncias da aplicação, processos de importação, agentes Google, chamadas agendadas e automações externas que usem as credenciais desse banco. Registra os serviços concretos e seus controles de parada no ambiente de hospedagem. Verifica também outros papéis de conexão com permissão de escrita; bloquear apenas o site não bloqueia os agentes.

Antes da janela, guardar uma cópia consistente e restaurável do banco pelo mecanismo de backup do provedor. Ensaiar a restauração em banco isolado e o avanço pelo runner deste repositório. Não usar reset de esquema nem alterar somas de migrações. Manter juntos a versão antiga da aplicação, o backup e as somas anteriores, com acesso restrito.

Na cópia local restaurada, configurar as variáveis de conexão para a cópia (nunca o endereço de produção). Os comandos existentes são:

```sh
npm run db:pendentes
npm run db:aplicar
npm run db:pendentes
node --import tsx scripts/atendimento/inventariar.mts --gestor UUID_DO_GESTOR_REAL --limite 100
```

`db:aplicar` usa `DATABASE_URL_ADMIN`, aplica somente arquivos pendentes e confere invariantes. `db:pendentes` usa `DATABASE_URL_CONFERENCIA` quando definida, senão a administrativa. O carregador usa `.env.local`; `ALVO=railway` seleciona `.env.railway.local`. Variáveis já presentes no processo prevalecem. Conferir o destino de ambas as conexões sem imprimir senhas. Não existe argumento `--production` ou `--maintenance`. A CLI de inventário recusa hosts remotos; foi feita para a cópia local, com identidade de gestor real. Paginar com `--depois UUID` usando o cursor retornado.

Comparar IDs, autores, datas e quantidades de empresas, contatos, negociações, vendas, entregas e grupos. As migrações não apagam reservas históricas nem redistribuem empresas. Reserva expirada pode documentar um responsável anterior, mas nunca volta a autorizar leitura ou aquisição. Evidência conflitante, responsável inativo, ausência de evidência e Sem interesse contradito continuam em `empresa_vinculo_pendencia`. Encaminhar a análise ao gestor; não escolher um vendedor por ordem, data ou conveniência. Este pacote não oferece comando automático de resolução das pendências.

## Corte sem concorrência com escritores antigos

1. Na janela aprovada, bloquear novas aquisições e disparos pelos controles reais de entrada e agendamento do provedor. Aguardar graciosamente as chamadas já em curso, inclusive resposta de consulta paga e sua persistência no banco; conferir seus recibos antes de parar os serviços. Não interromper uma coleta ou consulta entre pagamento/resposta e gravação. Depois, suspender as instâncias e automações identificadas, desabilitando reinício automático. Abas abertas não podem alcançar o servidor antigo. Se não houver controle para drenar a entrada preservando chamadas em curso, não iniciar o corte até o operador definir esse procedimento no provedor.
2. Em sessão administrativa separada, registrar a situação original de login dos papéis usados pelos serviços. O papel de conexão normal deste projeto é `app_conexao`. Somente se for o login aplicativo real, identificado e dedicado ao destino, executar `ALTER ROLE app_conexao NOLOGIN;` como barreira adicional. Isso vale para o cluster e não desconecta sessões existentes; se o papel atende outro banco fora da janela, não executar a alteração: resolver o isolamento com o operador antes de avançar. Aplicar barreira equivalente apenas aos outros logins escritores efetivamente identificados e dedicados. Não alterar o papel administrativo usado pelo runner, nem `app_usuario`, que já é NOLOGIN.
3. Conferir as sessões do banco e esperar a drenagem. O operador pode consultar `SELECT usename, application_name, state, xact_start FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid();`. Nenhuma sessão escritora antiga pode permanecer, inclusive conexões ociosas de pools que poderiam voltar a escrever. Se persistirem, localizar e parar o serviço responsável pelo procedimento do provedor; não matar processos desconhecidos. Não avançar enquanto houver escritor não explicado.
4. Fazer o backup final após a drenagem, guardar o inventário de IDs/autores/datas/contagens e `_migracao(nome,soma)`. Confirmar que o backup pode ser restaurado. Manter a barreira durante aplicação e conferência.
5. Com as credenciais administrativas do destino correto, executar `npm run db:pendentes`, `npm run db:aplicar`, `npm run db:pendentes`. O último deve informar nenhuma pendência, com 0050–0058 presentes e somas antigas intactas. O runner faz a conferência fechada de permissões. Falha ou divergência interrompe a liberação.
6. Comparar os registros históricos ao inventário final. Para inventariar a transição no próprio destino, o operador pode usar uma transação de leitura na sessão administrativa: `BEGIN READ ONLY; SET LOCAL ROLE app_usuario; SELECT set_config('app.usuario_id','UUID_DO_GESTOR_REAL',true); SELECT atendimento_transicao_inventariar(NULL,100); ROLLBACK;`. Substituir a identidade por um gestor ativo existente e autorizado, nunca por identidade de vendedor ou observador. Paginar com o cursor real. Não conceder helpers privados nem remover pendências para obter um relatório verde.
7. Instalar a versão nova da aplicação e dos consumidores migrados enquanto permanecem parados. Confirmar que nenhuma automação chama reserva global, contato legado, devolução ou catálogo aposentado; a lista exata está em [0057](../db/0057.md). Não reativar a versão antiga contra o esquema novo.
8. Restaurar `LOGIN` somente para os papéis que tinham login antes da janela (para o padrão: `ALTER ROLE app_conexao LOGIN;`), iniciar apenas as instâncias novas e verificar login, lista pessoal, detalhe sem início automático, contato, Funil, arquivo/retomada e histórico de cliente. Usar registros de teste previamente autorizados para verificações que escrevem; não criar vendas fictícias em dados reais. Reativar automações identificadas gradualmente após confirmar seus consumidores. Conferir erros e operações recusadas.

## Uso e recuperação

Abrir detalhes não inicia atendimento. Iniciar não cria contato nem negociação. Contato com interesse ou retorno combinado leva ao Funil; primeira venda torna cliente. Sem interesse cancela a agenda e encerra negociação, preservando vínculo e histórico. Retomar não recupera agenda cancelada nem reabre negociação de cliente; nova venda de cliente é feita na Carteira.

Origem inativa ou pendência impede nova operação no banco. Aba antiga recebe conflito e mantém os dados digitados. Cliente arquivado precisa ser retomado antes de venda nova. Uma confirmação histórica já registrada continua consultável por replay autorizado, mesmo depois dessas mudanças. Falta de autorização não é prova de que um envio anterior falhou: conservar chave e dados para recuperar o resultado com a identidade autorizada. Não limpar localStorage/sessionStorage ou descartar rascunhos para destravar a transição; preservar IDs e recibos até confirmar o resultado.

Se a migração ou a validação falhar, manter escritores suspensos e a barreira de login, guardar logs sem segredos e investigar o estado real de `_migracao`. O runner retoma somente as pendentes; nunca reescrever SQL aplicado ou sua soma. Preferir correção aditiva e novo ensaio. Se for necessário voltar à versão anterior, restaurar o backup completo validado em banco isolado e associá-lo à versão antiga antes de qualquer liberação. Não basta restaurar grants ou voltar o binário. Se houve escrita após a abertura, preservar e reconciliar essas operações antes de qualquer troca de banco para evitar perda ou duplicação de contatos e vendas.

## Evidência automatizada

`atendimento-transicao.test.ts` começa na 0049 pelo runner real e compara o conteúdo integral das tabelas históricas e somas anteriores. `atendimento-migracao.test.ts` verifica permissões retiradas e limites de leitura. `atendimento-autoridade.test.ts` verifica indisponibilidade, replay e mudanças durante espera por trava. A jornada `fluxo-comercial-unificado.spec.ts` atravessa agenda, Funil, arquivo, retomada e vendas, incluindo editor antigo recusado sem perder dados. A validação usa PostgreSQL 18 local descartável e provedores simulados do harness.

A [0058](../db/0058.md) mantém empresas arquivadas na consulta mesmo quando uma origem é desativada ou surge pendência. O motivo de indisponibilidade continua visível e uma nova retomada continua bloqueada. Na verificação da versão nova, conferir também a agenda canônica do Funil e a confirmação explícita da tentativa anterior após resposta perdida ou recusa temporária de acesso.
