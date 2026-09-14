# Empresas e importação: desenho visual aprovado

## Decisões do usuário

Em 12/09/2026 o usuário escolheu tabela compacta para Empresas e importação
passo a passo, usando o mesmo padrão visual da Prospecção. Esta fatia não
altera Meu dia, Carteira, situação comercial ou tags.

## Empresas

- Acesso exclusivo do gestor, preservando a guarda existente.
- Shell compartilhado, área Empresas ativa, temas claro, escuro e sistema.
- Título Empresas, descrição curta e ação Importar empresas.
- Busca existente por razão social, nome fantasia ou CNPJ; preservar `q`,
  paginação, canonização e limites atuais. Não acrescentar filtros novos.
- Tabela com Empresa (razão social, fantasia e CNPJ), Localização, Contato
  (telefone e e-mail) e CNAE. Não inventar perfil, edição ou situação comercial.
- Preservar os três estados de localização: cidade/UF; CEP informado mas não
  encontrado; sem CEP. Ausência de e-mail e CNAE deve ter texto legível.
- Em telas estreitas, manter todos os campos acessíveis, com tabela em região
  de rolagem horizontal identificada. Não reduzir a tipografia para caber.
- Busca sem resultados e falha de leitura têm mensagens e caminhos de retorno.

## Importação

Mesma rota `/empresas/importar`, um formulário e um input de arquivo persistente.
Etapas Enviar, Conferir e Concluir, com linha superior e indicação da etapa
atual como na Prospecção. Indicadores nunca avançam o fluxo por conta própria.

1. Enviar: baixar modelo XLSX, instruções de CSV UTF-8 e colunas como Texto,
   CNAE opcional e compatibilidade com sete colunas. Selecionar arquivo CSV e
   avançar apenas por Conferir arquivo.
2. Conferir: relatório real de novas, já cadastradas, recusadas e situação da
   base de CEP. Recusas mostram linha, motivo e correção. Informar que nada foi
   gravado. Confirmar apenas quando há novas empresas. Voltar a Enviar preserva
   o mesmo File; trocar o arquivo invalida o relatório e exige nova conferência.
3. Concluir: mostrar a quantidade efetivamente inserida, Ver empresas e
   Importar outro arquivo. Não permitir voltar a uma confirmação já consumida.

A confirmação reenvia o arquivo e repete a validação no servidor, como hoje.
Não criar autorização baseada apenas em etapa de cliente. Não introduzir upload
temporário, armazenamento de arquivo ou migração. Durante requisições, bloquear
troca de arquivo, navegação de etapas e duplo envio. Erros ficam próximos à ação,
anunciados e com foco útil. Falha não pode deixar relatório antigo confirmável.
Na conclusão, o resultado real prevalece sobre a estimativa da conferência.

## Reuso e limites

Usar componentes e tokens existentes. Extrair somente a apresentação das etapas
para componente compartilhado, mantendo navegação específica nas respectivas
telas. `features/` não importa outra `features/`. Sem dependência nova.
Textos novos não usam travessão. Corrigir travessões nas mensagens e linhas
efetivamente apresentadas nesta fatia, sem faxina de mensagens alheias.

## Aceite

- Visual da tabela e das etapas conferido em 390, 820 e 1280 px, claro e escuro.
- Vendedor não acessa Empresas nem importar por URL ou action direta.
- Arquivo permanece selecionado ao voltar; arquivo novo não usa relatório velho.
- Conferir não grava; confirmar grava só as novas aceitas; zero novas não oferece
  confirmação; sucesso não permite reenviar por indicador de etapa.
- Cliques reais no navegador verificam importação, navegação, erro e conclusão.
- TDD, suíte completa, revisão e PR contra main com CI verde no commit final.
