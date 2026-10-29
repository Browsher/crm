# Adaptação da PR 53 ao CRM atual

Data: 28/10/2026. PR: https://github.com/Browsher/crm/pull/53

## Objetivo e autorização

Integrar o suporte legado de prospecção da PR 53 à main atual, com ferramentas reproduzíveis e testes offline, mantendo o fluxo Google V2 de produção. O usuário pediu ajustar a PR para integrar na main e respondeu “Segue” à recomendação de preservar a rotina atual, sem reinstalar nem ativar workflows. A execução usa implementador e revisor separados por etapa, conforme escolha já registrada pelo usuário.

Base fixa: aeccc1bc84363fc6dac49ec500054b7d8afba41a. Head original da PR: 61a374bc54d415b15569ff04a44c452f75524597. A integração preserva esse head como ancestral, sem force-push. O código novo terá revisão independente e CI completo no head exato antes de integrar. Não haverá publicação em produção nesta tarefa.

## Fronteira atual e legado

A autoridade operacional permanece em docs/operacao/agente-google-crm.md e agente-google-rotina.md: planejamento por vendedor, 17h, critérios condicionais, identidade e evidências V2. Preservar integralmente scripts/google/ e os contratos Google atuais.

A PR antiga contém uma campanha global às 09h, validação obrigatória de WhatsApp e recibos V1. Seus geradores, parser/exportador, preparação offline, biblioteca histórica de instalação e testes serão versionados como legado. Não conectar o disparador V1 ao produtor V2, não converter recibos nem fabricar evidência V2. A lógica antiga não será artificialmente renomeada para simular a rotina atual.

O coletor continua dependendo de um kit externo para operação real. Os testes usarão apenas campanha de exemplo pública e diretórios temporários. Versionar o coletor não certifica nem substitui a instalação externa.

## Alterações autorizadas

1. Transportar a allowlist fechada da análise técnica para uma árvore baseada na main. Resolver a união dos ignores, mantendo /.google-agente/, __pycache__/, configuração privada e outputs da campanha ignorados. Conservar src/features/empresas/cnpj.ts exatamente como main.
2. Extrair somente os helpers puros de tamanho de arquivo (1.500.000 bytes), CNAE e CEP, mantendo os caminhos públicos por reexports, assinaturas e comportamento dos importadores atuais. Não duplicar parsers nem reestruturar aplicação.
3. Omitir scripts/prospeccao-base/instalar.mts. A biblioteca de instalação com alvo histórico fixo e testes injetados permanece; não criar CLI substituto, stub ou instalador genérico. Remover a recomendação de executar o instalador nos guias.
4. Tornar campaign_lock de scripts/prospeccao-campanha/coletor.py portátil: aquisição sem espera e exclusão mútua com msvcrt em Windows e fcntl.flock em POSIX; liberação normal, por exceção e por encerramento do processo; arquivo persistente, sem remoção que crie corridas entre donos.
5. Acrescentar fixture offline da ponte Google carregando o coletor versionado e uma campanha temporária. Importação sem rede/coleta/kit real; V2 neutro preserva candidata sem telefone, endereço e CSV bruto; process/profile legados devem falhar se forem chamados nesse caminho. Os arquivos scripts/google/ permanecem intactos.
6. Incluir a suíte Python da campanha no Vitest por src/prospeccao-base-python.test.ts, seguindo src/google-agente-python.test.ts. Usar Python 3.10+ disponível, biblioteca padrão, UTF-8, sem bytecode, timeout limitado e status obrigatório. Não adicionar pip nem job de CI. Atualizar o inventário pelo gerador existente.
7. Qualificar os cinco guias operacionais e README/INSTRUCOES da campanha com aviso inicial uniforme: histórico/legado V1; testes locais não comprovam instalação atual; novos pedidos seguem a documentação Google atual; não usar o material como prompt de reinstalação. Agenda antiga, piloto e relatos de ativação recebem atribuição histórica. Comandos com efeitos externos não são próximos passos desta adaptação; separar geração/testes offline das operações dependentes do kit externo.

## Global Constraints

- Preservar Google V2 atual, planejamento por vendedor e rotina das 17h; não alterar scripts/google/ nem os contratos Google de produção.
- Não instalar, ativar ou modificar n8n, Drive, Sheets, Evolution, prompts, agenda, credenciais ou kit externo; não executar coleta, importação, reserva ou envio real; não publicar produção.
- Não alterar package.json, package-lock.json, UI, SQL, migrações, RLS, arquivos .env, configuração CI ou Vercel.
- Omitir scripts/prospeccao-base/instalar.mts; preservar a biblioteca histórica sem generalizar seu alvo.
- Preservar src/features/empresas/cnpj.ts exatamente como main; os outros três consumidores compartilhados recebem somente extrações mecânicas com reexports.
- Testes Python usam somente stdlib, fixtures públicas e diretórios temporários; não ler configuração instalada ou dados privados.
- Antes de testes locais, isolar .env.local sem ler valores; limpar GOOGLE_PLANILHA_N8N_URL, GOOGLE_PLANILHA_N8N_TOKEN, GOOGLE_VERIFICACOES_URL e GOOGLE_VERIFICACOES_TOKEN de cada processo operacional. Testes de banco usam somente o banco local descartável, sem herdar DATABASE_URL_ADMIN externo.
- Não executar scripts com configuração operacional nem criar marcador de confirmação de backup; preservar VITEST, LOCALAPPDATA, TEMP/TMP e PATH nos testes Windows existentes.
- Nenhum commit na main, nenhuma alteração no checkout principal, nenhum force-push; atualizar a PR 53 existente por fast-forward e exigir revisão independente e CI verde no head exato.

## Verificação e aceitação

A cobertura existente de CSV deve passar pelo parser real, incluindo BOM/CRLF, Unicode/aspas e limites de 1.500.000 e 1.500.001 bytes. Reutilizar os testes de repetição, resposta incerta/reconciliação, backup e quatro flags de retenção desligadas; não substituir essas provas por assertions de versão ou listas de arquivos.

O novo teste de lock deve observar exclusão entre processos, liberação normal/erro/morte e persistência do arquivo. Registrar RED antes da correção. Se Windows não reproduzir o defeito POSIX, obter RED em Linux isolado ou na CI da PR ainda draft; nunca simular o sucesso escondendo o lock real. A fixture de compatibilidade pode já passar e não precisa de falha artificial.

Rodar typecheck, lint, convenções de banco, inventário, unidade (ambas as suítes Python), integração e build/E2E limpo pelos comandos atuais. Aceitar somente CI Linux completo no candidato exato e revalidar a main antes do merge. As duas exclusões Windows já existentes na CI Linux não serão ampliadas.

Revisão por tarefa deve conferir conformidade e qualidade; revisão final independente cobre a combinação inteira e a allowlist. A ausência de instalação real é limite expresso, não teste faltante a ser resolvido operando produção.

## Risco preexistente separado

A ponte atual escolhe o ramo V2 pela versão do recibo e mantém fallback legado. Um recibo antigo fabricado com campos adequados pode alcançar esse fallback para pedido contrato 2. Esse comportamento precede a PR; esta adaptação não o modifica e não promete rejeição bilateral universal. Eventual endurecimento exige trabalho próprio. O contrato aqui é não ligar a produção V2 ao produtor V1.

## Rastreabilidade

Análise estática e allowlist: .superpowers/sdd/2026-10-28-adaptacao-pr53-preflight/technical-adaptation.md (artefato local ignorado). O plano versionado contém a allowlist completa para a execução e revisão. O histórico original da PR preserva documentos e instalador que ficam fora do transporte atual.
