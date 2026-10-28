# Banco da empresa com Casa dos Dados

## Autorização e objetivo

Em 27/10, o usuário autorizou a migração do CNPJ.biz para Casa dos Dados, conferência dos filtros e dados, validação real de uma empresa para Junior (Armarinhos, Brás, São Paulo/SP), importação e revisão independente final. Informou saldo de 2.000 créditos e forneceu chave em arquivo local ignorado. A leitura autenticada de /v5/saldo confirmou 2.000, sem consultar empresas. Não pedir novamente aprovação dessa migração.

## Contrato externo verificado

Documentação oficial: https://docs.casadosdados.com.br/pesquisa-avan%C3%A7ada-de-empresas-16579062e0.md e /consulta-cnpj-16579054e0.md. O Markdown contém o OpenAPI completo. Host fixo https://api.casadosdados.com.br, header api-key, pesquisa POST /v5/cnpj/pesquisa?tipo_resultado=completo. Padrão simples não traz todos os dados; completo deve ser explícito. Retorno contém total e cnpjs. Filtros incluem busca_textual, CNAEs principal/secundário, natureza jurídica, situação, matriz/filial, UF, município, bairro, DDD, abertura, capital, MEI, Simples e disponibilidade de contatos. API pagina a partir de 1. Não inventar campos ou equivalentes. HTTP401 significa chave inválida; HTTP403 é sem saldo no contrato desta rota.

A documentação não detalha todos os campos de contato do retorno completo. Antes de fixar seu parser, obter uma única resposta real autorizada, com reserva de cota no banco e intenção durável antes do HTTP. Guardar a resposta privadamente, sem mostrar telefones, documentos ou a chave no chat. Nenhum segundo POST para compensar vazio, falha ou parser. Essa mesma resposta deve concluir a mesma reserva e importação depois da adaptação, sem outra compra.

## Preservação e escopo

- Banco da empresa mantém nome, cartões recolhíveis e acesso por papel; Google, agendamento, motores, workflows, planilha e campanhas adiadas não serão alterados.
- Até 100 empresas solicitadas por consulta e cota diária do CRM em São Paulo. Cota conta solicitadas inclusive em falhas; saldo do fornecedor é conceito separado.
- Repetir UUID/nome/filtros não consulta nem cobra de novo. Importação usa resultados persistidos, é repetível e não toma posse nem cria interesse, venda ou reserva.
- Campos manuais, cadastro, responsável, reserva e carteira existentes preservados. Telefones protegidos pelo banco. Sócios: vendedor apenas nome/função; demais dados em armazenamento RLS de gestor.
- CNPJ.biz histórico permanece identificado como CNPJ.biz. Novas aquisições e fichas usam Casa dos Dados. Não reetiquetar origens antigas nem mudar migrações publicadas.
- Nova chave CASA_DOS_DADOS_API_KEY apenas no servidor, sem NEXT_PUBLIC_, sem log/commit; não usar endpoints alternativos, raspagem ou fallback automático para outro fornecedor.

## Decisões do implementador

### Banco e deduplicação

Migração0046 aditiva: busca_empresa recebe fornecedor com default CNPJ.biz para preservar linhas/callers antigos e domínio fechado CNPJ.biz/Casa dos Dados. Novo wrapper busca_empresa_reservar_casa(uuid,text,jsonb) chama a reserva existente e registra Casa dos Dados somente em operação nova; replay de operação de outro fornecedor é recusado. RLS e a validação atual de filtros permanecem. O repositório de novas aquisições usa o wrapper; histórico pode ler as duas fontes.

Ampliar o CHECK de empresa_dados_cadastrais.fonte, e adaptar a importação para usar o fornecedor salvo. Para novas buscas Casa dos Dados, duplicidade de CNPJ, telefone ou e-mail deve ser verificada no banco global antes de permitir importação. Resultados adquiridos ficam no histórico próprio, com indicador genérico de repetição e seleção desativada; não expor dono/reserva alheios. A rechecagem atômica na importação impede corrida e não depende da interface. Reimportar empresa já vinculada à própria busca preserva idempotência. Empresas duplicadas entre candidatas também não entram duas vezes. Helpers sem GRANT público, sem nova listagem global acessível ao vendedor. Escolha exata de lock transacional é do implementador, com teste de concorrência.

### Filtros

Manter o DTO histórico. Mapear somente equivalentes documentados. Combinações que a API não consegue representar fielmente falham antes da reserva/HTTP, com mensagem útil; nunca ignorar filtro ou ampliar região silenciosamente.

- Regiões: aceitar conjuntos representáveis por arrays de UF/cidade/bairro sem cruzamento indevido (inclui estado inteiro, uma cidade com vários bairros e cidades de uma mesma UF com o mesmo conjunto de bairros). Rejeitar combinações não representáveis, orientando buscas separadas.
- Regime: nova UI oferece Simples Nacional; outros regimes históricos continuam legíveis, mas não executáveis pela nova API. MEI em separado dos demais portes; combinação OR não representável é recusada.
- Contatos: suportar qualquer, e-mail, fixo/celular e combinações E documentadas; OR telefone/e-mail sem equivalente não deve ser oferecido nem silenciosamente convertido em E.
- Substituir entrada de offset arbitrário por Página; persistir offset calculado para compatibilidade. Backend recusa offset não múltiplo da quantidade. Sem mudanças no histórico antigo.
- Remover Contar resultados como chamada independente: não há endpoint gratuito documentado. A busca única fornece o total; não executar pesquisa extra para pré-contagem. Não prometer equivalência de todos os filtros antigos.

### Cliente e dados

Cliente Casa separado, timeout25s, máximo2MB, sem retry/redirect/cache; segredo só para host fixo. CNAEs/naturezas usam códigos diretamente. Normalizar o retorno para EmpresaEncontrada e DetalhesBanco existentes. Capital, porte, atividade, endereço, situação, abertura, contatos e sócios seguem os campos realmente observados/documentados. Dados sensíveis continuam sanitizados no banco antes do navegador. Não apresentar telefone cadastral como WhatsApp verificado.

### Sequência e operação real

1. TDD e CI da migração aditiva, sem depender de contato desconhecido. Revisão do desenho antes do código.
2. Backup conferido e aplicação separada da0046 na Railway; versão atual do site deve continuar compatível. Não modificar credenciais administrativas.
3. Reservar uma operação Casa para Junior com quantidade1, somente após habilitar temporariamente o mínimo de cota. Intenção privada contém UUID, corpo, fornecedor e estado antes do HTTP. Confirmar uma única resposta real e armazenar bytes privadamente. Resposta incerta conserva pendência, sem novo POST.
4. TDD do parser com fixture fictícia derivada apenas da forma da resposta; adaptar UI, harness isolado e persistência. Concluir a mesma operação usando os bytes reais salvos e importá-la, sem segunda pesquisa.
5. Revisão independente, CI do commit final, configuração sensível na Vercel e publicação do app autorizada para concretizar a migração. Verificar fonte, domínio e controles. Não mergear main sem autorização.
6. Repetir a mesma operação/importação sem outra compra; conferir lista pessoal de Junior, histórico gestor, RLS, fonte correta, dados manuais/reserva/carteira preservados e saldo antes/depois. Restaurar cota inicial ao fim do teste; não liberar os demais vendedores nem comprar plano/créditos.

Se a única empresa retornar sem telefone válido, vazia ou repetida na base global, manter histórico e declarar importação não validada. Não comprar outra automaticamente. Se contatos/sócios não vierem, registrar exatamente a cobertura inconclusiva. A validação da interface online exige sessão real; teste backend não deve ser descrito como clique observado.

## Aceite

TDD, tipos/lint, migrações/invariantes, integrações de reserva/replay/fontes/duplicidade/privacidade e jornadas com fornecedor estritamente simulado. E2E deve zerar chaves reais herdadas, incluindo Casa, e limitar mock a loopback. Nenhuma cobrança em testes. Uma única empresa real, mesmo UUID e resposta arquivada, com comparação do saldo. Conferir cadastro/posse/reserva/carteira antes/depois e não declarar compra/importação/sócios que não ocorreram. Revisão independente final e CI exata; preservar .superpowers alheia e checkout principal de outro chat.

## Builder check

Revisão independente: nenhuma pergunta importante no desenho. Revisão do SQL encontrou contato principal fora do array; reproduzido com RED e corrigido incluindo ambos no comparador global. Nenhum outro achado na correção.
