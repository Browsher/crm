# WhatsApp: vínculo com vendedores e filtros

## Objetivo

Permitir ao gestor associar instâncias existentes da Evolution a vendedores cadastrados e consultar as conversas por vendedor ou em Todos. O CRM continua somente para visualização. Esta etapa não conecta telefones, envia mensagens nem marca mensagens como lidas.

## Situação conferida

Em 22/09/2026 foram lidos `app/whatsapp/page.tsx`, `app/whatsapp/historico-acao.ts`, `src/server/whatsapp/evolution.ts`, `src/server/whatsapp/midia.ts`, `src/features/usuarios/repositorio.ts` e `src/server/db/como-usuario.ts`.

O adaptador usa uma única `EVOLUTION_INSTANCE_NAME`. O histórico recebe página e data de corte. A leitura de mídia também depende da instância do ambiente. O repositório de usuários acessa dados por `comoUsuario`, com identidade da sessão e autorização no banco.

## Abordagem

Recomendação: guardar vínculos no banco do CRM e administrá-los em uma tela exclusiva do gestor. Isso permite trocar o vendedor associado sem editar variáveis do servidor.

Alternativa: lista de vínculos em variáveis de ambiente. Evita tabela, mas cada alteração exige configuração operacional e não acompanha o cadastro de usuários.

Alternativa: importar automaticamente todas as instâncias da Evolution. Não adotar nesta etapa: uma instância de teste ou de outro uso não deve aparecer automaticamente no CRM.

## Funcionamento da tela

- Adicionar a ação Configurar vendedores na página WhatsApp.
- O gestor escolhe um vendedor ativo e informa o nome exato de uma instância já criada na Evolution.
- Validar a existência e a disponibilidade de consulta da instância antes de salvar. Falha de autenticação, instância inexistente ou indisponibilidade devolvem mensagem segura, sem credenciais ou resposta bruta.
- Uma instância pertence a um vendedor, e cada vendedor tem uma instância nesta etapa. Rejeitar duplicidade; permitir substituir ou remover o vínculo explicitamente.
- Mostrar Todos e os vendedores vinculados. Cada conversa em Todos identifica seu vendedor. Selecionar um vendedor restringe mensagens, histórico e mídia à sua instância.
- Remover vínculo somente remove a associação no CRM. Não exclui instância nem histórico da Evolution.
- Vendedor inativo ou que mudou de papel deixa de aparecer nos filtros; o gestor vê o vínculo indisponível na configuração e pode removê-lo ou substituí-lo.

## Piloto

O número de teste continua separado, com identificação Número de teste. Enquanto não houver vínculos, permanece a experiência atual. Com vendedores vinculados, Todos reúne apenas vendedores; o piloto fica em um filtro separado. Se a própria instância piloto for vinculada, ela aparece somente sob o vendedor, sem duplicação.

Não associar o número de teste a uma pessoa por suposição. A funcionalidade pode ser implementada e testada sem efetuar esse vínculo real.

## Persistência e autorização

Criar migração nova e imutável para a tabela de vínculos, com identificador UUID, vendedor, nome da instância e unicidades de vendedor e instância. Não armazenar a chave da API nessa tabela.

Leitura e escrita somente para gestor, com RLS habilitada e forçada. Escrita exige `pode_escrever()`. A validação de vendedor ativo e papel vendedor deve existir no banco; a aplicação apenas apresenta o resultado. Usuários com senha provisória não administram vínculos.

A sessão fornece a identidade para `comoUsuario`. Página, ações de histórico, atualização e rota de mídia verificam gestor a cada requisição. O cliente envia o identificador do vínculo; o servidor resolve a instância autorizada. Identificador desconhecido, vínculo removido e vendedor inativo não caem silenciosamente no piloto.

URL e chave continuam somente no servidor. Não permitir URL externa nem nome arbitrário de instância vindo das requisições de leitura do navegador.

## Separação das conversas

A identidade passa a incluir vínculo/instância, conversa e mensagem. O mesmo cliente falando com dois vendedores gera duas conversas independentes. Identificadores de mensagem repetidos entre instâncias não misturam texto ou arquivos.

Trocar filtro reinicia seleção e paginação e descarta respostas pendentes do filtro anterior. Atualização automática preserva a conversa selecionada quando ela ainda pertence ao escopo.

## Histórico e indisponibilidade

Manter página e data de corte por instância, com 50 mensagens por consulta. Em Todos, agregar os resultados ordenados por data, com concorrência limitada a três consultas. Não usar uma página global para pular registros de instâncias diferentes.

Cada instância mantém seu avanço: falha não avança página e permite tentar novamente. Uma instância indisponível não apaga conversas carregadas nem impede consultar as demais. Mostrar aviso identificando o vendedor afetado. Totais parciais devem ser apresentados como parciais.

Os quatro cards continuam indisponíveis nesta etapa. Métricas completas precisam de uma definição e de dados além das páginas carregadas; serão a próxima etapa.

## Implementação e verificação

Seguir os padrões de `app/usuarios/acoes.ts` e `app/usuarios/formulario-criar.tsx` para ação e formulário. Manter domínio e repositório separados; não importar uma feature de outra. Ler a documentação local do Next antes de modificar páginas, ações e rotas.

Escrever testes falhando antes da implementação:

1. Banco: gestor administra; vendedor e senha provisória não escrevem; duplicidades e vínculo com alvo inválido são recusados.
2. Seleção: Todos, vendedor individual e piloto; vendedor desativado e vínculo inexistente não liberam consultas.
3. Identidade: mesmo contato e mesmo ID de mensagem em duas instâncias permanecem separados, inclusive na mídia.
4. Paginação: ritmos diferentes entre instâncias, falha parcial, repetição e troca de filtro durante consulta.
5. Formulário: salvar, substituir, remover, erros esperados e acesso somente do gestor.
6. Regressão: telefone, imagens, áudio, documentos, atualização automática e leitura sem envio.

Validar migração e invariantes do banco, testes focados de unidade e integração, tipos, lint e build isolado. Conferir tela de gestor em desktop e celular e recusa de acesso do vendedor. Usar dados sintéticos nos testes automatizados; não copiar mensagens reais para fixtures.

## Estado

Implementação aprovada e concluída em 22/09/2026. Migração 0032 aplicada somente no banco local, com invariantes aprovadas. Nenhum vínculo real criado automaticamente. A interface está disponível em `/whatsapp/configuracao`; os cards permanecem para a etapa seguinte.

Verificação: testes de unidade, integração em banco descartável, tipos, lint e build isolado aprovados. No navegador local, o piloto continuou consultável, o histórico avançou de 50 para 100 mensagens e o formulário foi conferido em desktop e celular (390px, sem transbordamento horizontal). Várias instâncias foram verificadas com dados sintéticos nos testes; ainda não foram vinculados telefones reais dos vendedores.
