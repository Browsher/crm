# Últimas buscas e inclusão automática no Banco de empresas

O usuário corrigiu a implementação do carrossel: a seção antiga Últimas buscas deve ser substituída pelos11 cards de empresas recentes no mesmo local/visual, sem acrescentar Todas as minhas empresas. A busca Empresas · Brasil f198661a do Junior possui5resultados e grupoNULL; o carrossel anterior os excluía por mostrar apenas importadas. Depois o usuário esclareceu que as empresas devem ir automaticamente à prospecção e pediu mais informações úteis no desktop.

## Leitura e apresentação

Usar busca_empresa sob comoUsuario e RLS, com filtro explícito do vendedor atual. Projetar somente resumo permitido: nome, grupo planejado/busca, CNPJ para selecionar o detalhe, localização, porte/abertura, nicho da busca e indicadores booleanos de contato. Sem telefones/emails efetivos ou documentos de sócios no resumo. Ordenar por consulta mais recente, ID e posição original; deduplicar CNPJ e limitar11 no SQL. Sem limite arbitrário de50buscas para encontrar11empresas. Falhas, processamento e buscas vazias não geram cards, mas continuam no histórico acessível por botão/Dialog.

Ver empresa abre só o resultado persistido correspondente ao CNPJ, em action que exige vendedor e confirma vínculo na busca própria. Reutilizar dados detalhados/privacidade do fluxo existente, com dados restritos de sócios exclusivos do gestor. Erro, retry, fechamento e resize não disparam fornecedor; o foco volta ao gatilho ou à região quando o gatilho saiu da página. Dados completos ficam no popup. Só Cliente aparece como selo, com posse e venda legíveis do vendedor atual.

Carrossel manual: três/dois/um cards conforme largura;1:1, teclado/controles/tema preservados. Celular36/40caracteres para nome/grupo; conteúdo amplo>=1120permite80/120 e acrescenta porte, abertura, nicho, endereço e disponibilidade de telefone/email. Não inferir WhatsApp. Campos burocráticos adicionais permanecem no detalhe. O último Ver todas buscas conserva o destino aprovado /fila/localizar?origem=banco.

## Inclusão automática

Depois de concluir e persistir a consulta paga, incluir automaticamente todas as candidatas válidas na lista de prospecção própria, sem seleção manual. Isso não cria posse, reserva ou cliente na Carteira. A migração0049 reutiliza busca_empresa_importar com p_cnpjsNULL, sem novo privilégio. O banco conserva guardas de papel/escrita/identidade/pausa, ordem de travas e contrato da seleção explícita. Deriva candidatas dos dados salvos, revalida repetição global sob trava, marca repetições descobertas agora e ignora inválidas/repetidas. Nenhum grupo vazio; repetição usa a mesma lista e não altera cadastros manuais/responsável/reserva.

Concluir a aquisição e incluir são transações separadas: falha de inclusão não desfaz os resultados pagos. Repetir o UUID retoma resultados/lista sem novo HTTP. Zero resultado, falha ou processamento não tenta incluir; UI mostra o estado e permite Concluir inclusão para recuperação sem refazer busca. A pausa bloqueia a inclusão pelo banco.

## Operação e verificação

Nesta entrega está autorizada a inclusão das válidas das5empresas já salvas de f198661a para Junior, sem outra consulta paga ou importação de outros históricos. Conferir antes/depois, preservar dados anteriores, cotas100e rotinasGoogle/n8n/planilha.

TDD unidade/integração/E2E: fontes e privacidade, CNPJ repetido entre consultas, semgrupo, telefones inválidos, concorrência, pausa, replay, erro de inclusão, recuperação, camposdesktop, geometria e foco. Revisão independente final, CI, novo backup criptografado, aplicar somente0049, publicação exata e smoke. Não criar consultas reais para testar.
