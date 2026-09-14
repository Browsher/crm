# Empresas: Excel direto e filtros

Escopo aprovado em 14/09/2026: continuar no PR38, aceitar o modelo XLSX diretamente e adicionar selects iguais à Prospecção. Não integrar o PR até nova validação visual. Lotes não entram.

## Importação

Aceitar CSV UTF-8 e XLSX. O arquivo oferecido em /modelo-empresas.xlsx deve funcionar sem conversão. Preservar Enviar, Conferir e Concluir, File original e reanálise no servidor ao confirmar. Reutilizar as validações de campos, duplicatas, relatório e gravação existentes. Guardas de gestor continuam antes de processar arquivos.

Ler uma única planilha de dados com cabeçalhos legados de sete colunas ou atuais de oito. Rejeitar arquivo corrompido, planilhas ambíguas e células de fórmula nos dados, com mensagem recuperável, sem executar fórmulas nem escolher silenciosamente dados. Preservar strings, zeros à esquerda e número original das linhas. Limitar tamanho e quantidade de linhas antes de alocar dados sem limite. Usar biblioteca mantida, com documentação oficial conferida, em vez de implementar um leitor OOXML artesanal. O limite atual de 5000 empresas continua. CSV continua compatível.

## Filtros

Manter busca atual por nome/CNPJ e paginação de 50. Adicionar CNAE, Estado, Cidade e Bairro como selects com dados existentes. CNAE inclui Não informado, como na Prospecção. Cidade depende de estado; bairro depende de cidade. Trocar estado limpa cidade/bairro, trocar cidade limpa bairro; atualizar opções e retornar à primeira página. Busca nova também volta à primeira página; paginação conserva todos os filtros. Limpar remove busca e selects.

Aplicar filtros por AND no banco, envolvendo o OR atual da busca em parênteses. Cidade usa código IBGE, bairro valor exato. Opções vêm da função existente empresa_filtros, acessada pelo contexto do gestor, se confirmado seu contrato. Não importar outra feature a partir de features/empresas. Parâmetros inválidos devem produzir aviso recuperável, sem consulta irrestrita silenciosa. Canonicalização não pode descartar filtros quando q estiver vazio.

## Verificação

TDD nos parsers, action e componentes; integração real para interseção de filtros, permissões e nenhuma gravação durante conferência; navegador para arquivo XLSX real, confirmação, selects dependentes e paginação. Revisão independente, suíte completa e CI no commit final. Inspeção em 390/820/1280, claro/escuro. Não alterar banco Railway nem migrações sem necessidade demonstrada.
