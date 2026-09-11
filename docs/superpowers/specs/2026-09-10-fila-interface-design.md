# Interface da Fila — decisões aprovadas e investigação

Estado: desenho visual e regras de domínio abaixo aprovados na conversa.
Implementação depende do plano técnico e de testes das permissões no banco.

## Referência e decisões aprovadas

Referência visual: shadcn-admin do diretório irmão crm-disable/shadcn-admin.
Protótipo: fila-combinada.html, no diretório de visualizações desta conversa.
Componentes básicos compartilhados, composição por funcionalidade, tokens
centrais e página de referência. Manter Next.js, autenticação existente e RLS.

- Título: Começar a prospecção.
- Subtítulo: Puxe a próxima empresa disponível. A reserva mantém o cliente
  com você enquanto registra a conversa.
- Card Localizar empresa: texto apenas para nome; CNAE, estado, cidade e
  bairro em seletores. Bairro acompanha cidade, cidade acompanha estado.
- Resultados da busca abaixo dos filtros. Sem busca nem filtro: empresas com
  contato recente ou perfil acessado recentemente pelo próprio usuário.
- Ver perfil leva ao passo Consultar, mostrando a empresa selecionada.
- Etapas Puxar, Consultar e Registrar: clicar permite voltar, nunca avançar.
- Buscar cliente avança para Consultar. Registrar resultado avança para Registrar.
- Próxima troca a empresa sem entrar em Registrar e sem gravar contato.
- Registro mantém nome, contato e telefone visíveis ao lado do formulário.
- Voltar preserva o rascunho da mesma empresa; não transportar notas para outra.

## Evidências no código, conferidas em 2026-09-10

- app/empresas/page.tsx exige gestor. A listagem atual não é uma busca pública
  de prospecção para vendedor.
- db/migracoes/0016_empresa_fila.sql: empresa_leitura permite ao vendedor sua
  carteira e reserva válida; gestor pode ler todas. Consulta ampla antes da
  reserva não está autorizada por essa política.
- fila_puxar() libera a reserva anterior, exclui essa empresa da próxima
  seleção e reserva uma candidata elegível por 30 minutos. A função precisa
  mudar: hoje libera a anterior mesmo sem encontrar outra e não recebe filtros.
  Próxima não equivale a devolver por 30 dias.
- src/features/fila/repositorio.ts expõe puxarProxima. Assumir/devolver ocorre
  por contato_registrar, não por funções isoladas da interface.
- empresa guarda CEP. Cidade, UF e bairro podem vir de cep (0013), com estados
  explícitos para CEP ausente, não encontrado ou bairro nulo.
- Migrações e features consultadas não possuem CNAE nem histórico de abertura
  de perfil. Não preencher esses recursos com dados fictícios na aplicação.

## Divisão proposta

1. Base visual e componentes: tokens, shell, campos, botões, estados e galeria.
2. Contrato de prospecção: consulta permitida, origem do CNAE, filtros e recentes.
3. Interface integrada: etapas, seleção, reserva, próxima e registro existentes.

## Regras de domínio aprovadas

### Consulta e atendimento

Antes da reserva, mostrar nome, cidade, estado, bairro e CNAE. Ver perfil abre
Consultar sem reservar. Reservar para ligar adquire reserva de 30 minutos e
libera telefone e histórico. Empresa da própria carteira mantém acesso aos
dados completos. Não habilitar registro sem posse ou reserva válida.
A autorização desses campos é do banco, não apenas da renderização da tela.

### Busca e próxima

Buscar cliente e Próxima respeitam os filtros e selecionam somente empresas
disponíveis. Próxima libera a reserva atual e reserva outra sem registrar
contato ou aplicar descanso de 30 dias. Se não existir outra candidata,
manter a reserva atual e avisar. A troca deve ser atômica sob concorrência.
Pedir confirmação antes de descartar anotações não salvas ao trocar empresa.

### Recentes

Guardar as 10 últimas empresas cujo perfil o próprio vendedor abriu ou nas
quais registrou contato, sem duplicatas. A interação mais recente sobe para
o topo. Persistir por usuário para continuar em outro computador. Recentes
não concedem acesso ao telefone ou histórico. Sem recentes, mostrar sugestões
de empresas disponíveis. A visualização sempre revalida as permissões atuais.

### Expiração e rascunho

Exibir tempo restante na consulta e no registro. Voltar de etapa mantém reserva
e anotações. Ao expirar, preservar o texto e bloquear envio. Oferecer Tentar
reservar novamente, sujeito à disponibilidade. Não renovar automaticamente
nem apagar texto sem avisar. O relógio da tela não substitui a validação no banco.

### CNAE

Origem: planilha importada pelo gestor. Usar CNAE principal, aceitar código com
ou sem pontuação e normalizar ao importar. Ausência de CNAE não impede a
importação; apresentar Não informado. Seletor contém CNAEs presentes na base
e a opção Não informado. Não inventar classificações ou descrições.

## Preparação técnica do plano

Modelo fornecido pelo usuário: C:/Users/ADM/Downloads/modelo-empresas.xlsx.
Cabeçalho conferido por leitura do XML interno: cnpj, razao_social,
nome_fantasia, contato_nome, telefone, email, cep. Não contém CNAE nem Atividade.
O usuário decidiu começar simples, deixando capital e sócios para depois.
Adicionar ao novo modelo a coluna opcional cnae_principal, preservando a
aceitação do cabeçalho antigo de sete colunas. Não inferir CNAE por nome.
Cidade, estado e bairro continuam derivados do CEP quando resolvido.
O arquivo XLSX é modelo de preenchimento; o importador atual recebe CSV.
Não ampliar implicitamente esta fatia para leitura direta de XLSX.

O plano deve separar importação/dados, permissões e reservas, recentes,
componentes e integração visual. Preservar as regras aprovadas acima em todas
as etapas; não tratar os controles simulados do protótipo como backend pronto.

## Critérios de verificação

Testar ida e volta entre etapas, impossibilidade de avanço pelos indicadores,
rascunhos separados por empresa, próxima sem contato nem descanso de 30 dias,
fila vazia, manutenção da reserva sem próxima candidata e reserva expirada.
Validar CNAE opcional/normalizado, recentes por usuário sem duplicação,
filtros dependentes e consultas sob RLS,
incluindo vendedor tentando acessar empresa alheia. Conferir teclado, foco,
rótulos, erros e viewport estreito no navegador. PR e CI verde antes do merge.
