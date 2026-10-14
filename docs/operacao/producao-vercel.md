# CRM na Vercel com Postgres na Railway

O site usa HTTPS na Vercel e o banco CRM CH já existente na Railway. O computador e o Docker local não fazem parte da operação dos vendedores. O endereço inicial pode ser crm-prospeccao.vercel.app, se disponível; um domínio próprio pode ser conectado depois.

## Estado em 14/10/2026

- Ambiente de testes publicado em https://crm-prospeccao-bice.vercel.app/login, deployment dpl_7Q9ZqYNVeAEQeWpq1St5uSZKMDzy, estado READY. Código corresponde à main 8019b990b59831389d63618eb38e3fbe5a213b9e, integrado no PR #51 após CI aprovado.
- Grupos e CNPJ opcional integrados no PR #50, commit 0c7585161ee858810b75a707a727b016a016869d.
- Railway CRM CH: 38 migrações aplicadas, sem divergências, invariantes aprovadas. Zero empresas e vendedores; um gestor ativo preservado.
- O usuário autorizou explicitamente a nova senha de app_conexao e sua configuração na Vercel. A conexão usa TLS verificado, sem SUPERUSER, BYPASSRLS ou acesso direto à tabela empresa. A senha e os dados do gestor foram preservados.
- Projeto separado crm-prospeccao na equipe icamera6688-4728s-projects, Node 24.x e Next.js. Seis variáveis Production configuradas. Nenhuma credencial administrativa enviada ao site, nenhum Git conectado.
- O usuário autorizou a publicação para testes no Hobby e recusou ativar Pro neste momento. Nenhuma alteração de plano ou cobrança executada. A importação real da Mooca e o cadastro dos vendedores reais ficam para depois da validação pelo gestor.
- HTTPS, login HTTP 200, login inválido com resposta esperada do banco e redirecionamento de /fila sem sessão aprovados. A tela de login não excede a largura em 390, 820 ou 1280 pixels; nenhum erro JavaScript ou HTTP 5xx observado nessa verificação.
- Gestor remoto ainda precisa trocar a senha provisória no primeiro acesso. Login autenticado, cookie real e jornadas privadas online dependem desse acesso; não contornar pode_escrever nem fabricar sessão.
- Limpeza local concluída em transação: 66 empresas, três vendedores e seus registros de teste removidos sem backup. Gestor e sua credencial, 1.209.313 CEPs, a carga de CEP e as 38 migrações preservados. Arquivos originais da coleta permanecem no disco.
- Atalho existente CRM Prospecção atualizado para o endereço hospedado. Não inicia Docker, banco ou servidor local. CRM Social permaneceu intacto.

## Configuração do projeto

Foi criado um projeto separado chamado crm-prospeccao. A publicação atual foi feita pelo CLI, com código já integrado e validado. Uma conexão futura com Browsher/crm deve usar main e a raiz do repositório; ela ainda não foi ativada. Não reutilizar os projetos ntvbox, ta-hora ou outros sites existentes.

O vercel.json declara Next.js, npm ci e npm run build. package.json fixa Node 24.x, a mesma versão principal do CI. O .vercelignore exclui arquivos de ambiente, certificados locais, bases coletadas, logs e artefatos de teste da carga de código.

Configurar as variáveis abaixo no ambiente Production. Previews comuns permanecem sem acesso ao banco operacional. Não configurar CRM_E2E, ALVO, DATABASE_URL_ADMIN ou DATABASE_URL_CONFERENCIA no site. VERCEL é definido pela plataforma; não cadastrar manualmente.

| Variável | Valor/uso |
| --- | --- |
| DATABASE_URL | Conexão do papel app_conexao pelo proxy público da Railway, banco railway. Nunca a URL de postgres. |
| PG_SSL | verify |
| PG_SSL_CA | Conteúdo PEM completo do CA, inline e com quebras de linha reais. Não caminho para arquivo do computador. |
| PG_SSL_NOME_SERVIDOR | postgres.railway.internal |
| PG_POOL_MAX | 2 |
| IMPORTACAO_CONFERENCIA_SEGREDO | 32 bytes aleatórios em 64 caracteres hex; mesmo valor em todas as instâncias de produção. |

Nenhuma variável sensível recebe NEXT_PUBLIC_. Inserir secrets pelo painel ou por stdin no CLI, nunca em argumentos, commits ou logs. Valores production permanecem separados dos segredos locais de desenvolvimento.

A URL interna postgres.railway.internal só resolve dentro da Railway. A Vercel deve conectar a altaria.proxy.rlwy.net:19413; o certificado continua validado contra o CA e o nome interno esperado. Não usar sslmode que sobrescreva o configSsl nem desligar rejectUnauthorized.

O pool é reutilizado por processo e por URL. Na Vercel, attachDatabasePool registra a liberação de conexões ociosas antes da suspensão. PG_POOL_MAX limita cada pool entre 1 e 10; padrão de desenvolvimento 10 e valor de produção 2. Instâncias diferentes somam conexões: isso não garante um limite global. app_conexao continua com CONNECTION LIMIT 20. Acompanhar erros de limite e concorrência antes de ampliar a equipe; não remover o limite nem elevar privilégios como solução.

A integração Evolution é opcional nesta publicação. Se for ativada, manter EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME somente no servidor e conectar a instância autorizada. Não copiar vínculos de vendedores de teste.

## Publicação e validação

1. Para a fase atual, manter o ambiente de testes Hobby autorizado pelo usuário. Uma contratação futura precisa de autorização própria; não alterar serviços pagos.
2. Criar/linkar o projeto separado; configurar as variáveis Production e conferir Node 24.x.
3. O ambiente de testes publicado usa o alvo técnico Production para receber as variáveis e um endereço estável. Isso não inicia a operação comercial. Build funciona sem banco; runtime usa somente app_conexao com TLS verificado.
4. Conferir HTTPS, login e troca de senha do gestor, cookie crm_sessao Secure e HttpOnly, navegação em 390/820/1280 e um login inválido sem falha de infraestrutura. Confirmar o acesso ao banco pelo site; HTTP 200 da tela de login sozinho não prova conexão.
5. Importar a Mooca pelo fluxo de conferência e confirmação do gestor, depois de trocar a senha. O arquivo empresas-crm.csv preparado tem 43 linhas aptas; duas empresas sem telefone ficaram em pendencias.csv. As advertências de telefone compartilhado e CEP continuam documentadas no rastreio.
6. Criar vendedores reais em /usuarios com nomes/e-mails fornecidos pelo gestor. A senha provisória aparece uma vez e deve ser trocada no primeiro acesso.
7. Validar como vendedor: selecionar o grupo, reservar empresa, registrar contato/retorno e voltar sem perder notas. Provar que não acessa /usuarios, /empresas/importar e /grupos por URL direta.
8. Limpeza local e atualização do atalho já concluídas após a validação técnica online. Preservados gestor, configurações, CEP, migrações e os arquivos da coleta.

Não compartilhar acesso do gestor. Os vendedores entram no CRM; não precisam de conta ou assento de desenvolvimento na Vercel.

## Atualizações

Mudanças futuras passam por PR e CI verde antes de main. Não dar a previews acesso de escrita à base operacional. Migrações são aplicadas separadamente pelo operador com a conexão administrativa; não colocar db:aplicar no build, no start ou em requisições da aplicação.

Next e eslint-config-next foram atualizados para o patch 16.3.8, que cobre os avisos atuais de segurança sem avançar para a versão 16.4. As dependências transitivas vulneráveis de produção foram corrigidas dentro das faixas compatíveis do lockfile; não usar --force ou --legacy-peer-deps.

Fontes: [Node e runtime](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [pool na Vercel](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), [uso comercial](https://vercel.com/docs/limits/fair-use-guidelines), [Next 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8). A configuração de TLS está detalhada em docs/db/fundacao.md.

Validação desta preparação: 1266 testes unitários e 587 de integração passaram, com dois skips existentes; 44 jornadas passaram; typecheck, lint, db:checar e build sem env aprovados. npm audit --omit=dev não aponta vulnerabilidades. A auditoria completa mantém cinco avisos altos na cadeia de ESLint de desenvolvimento, sem correção compatível indicada pelo npm; não aplicar o downgrade sugerido para eslint-config-next 14.

A revisão automática inicialmente bloqueou a rotação de app_conexao por falta de autorização explícita para o alvo e o impacto em outros consumidores. Depois de o usuário autorizar a troca e a configuração, a senha foi definida e validada; DATABASE_URL foi enviada por stdin como variável sensível. Não reutilizar a credencial local, que havia devolvido 28P01 no remoto, nem repetir a rotação sem necessidade.
