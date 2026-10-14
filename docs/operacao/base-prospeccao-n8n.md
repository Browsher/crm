# Base de prospecção Google Maps

## Uso

A planilha privada tem três abas. Empresas conserva cada identidade, fontes e endereço completo. Telefones reúne números completos únicos e resultados de registro WhatsApp. Coletas registra um resumo e uma ocorrência por empresa recebida, preservando as fontes anteriores e conflitos.

Telefone compartilhado exige revisão comercial. Dois cadastros continuam separados; o número é consultado uma vez. Estado encontrado significa registro no WhatsApp no instante da consulta, não autorização para abordagem ou confirmação de titular.

Revise as colunas revisao e observacoes de Empresas. Em Telefones, marque revalidar como sim para consultar novamente um resultado conclusivo. Não substitua telefone por número sem DDD nem acrescente nove. Corrija dados publicados no CSV do coletor e reimporte; os campos publicados e dados_publicados precisam corresponder para a validação aceitar a base.

Uma importação por vez. Google Sheets não oferece unicidade transacional: não executar duas importações simultâneas nem usar dois operadores para a mesma base. Duplicidade detectada bloqueia o relatório de sucesso.

## Entrada e dados

CSV UTF-8 do coletor Mooca, colunas pelo nome. Números e identificadores permanecem texto. Campos requeridos: place_id, nome_empresa, cnpj, telefone, endereco, link_maps. CNPJ e telefone podem estar vazios; Place ID e nome não. Campos adicionais são preservados. Para outro coletor, renomear explicitamente suas colunas para esse contrato; não inferir identificação por telefone ou nome.

Empresas inclui dados_publicados como JSON textual para conservar os 35 campos originais. Coletas inclui fonte_original por ocorrência, além de termos, fonte, região, data e arquivo. Nenhum endereço é reconstruído a partir do CEP.

Preparar a carga com:
```powershell
npx tsx scripts/prospeccao-base/preparar.mts --rastreio <rastreio.json> --whatsapp <whatsapp-resultados.json> --grupo <grupo.json> --saida <pasta-nova>
```

A preparação aborta antes de escrever quando há resultados inconsistentes. Resultados já medidos só são aplicados por correspondência exata do número completo.

## Configuração n8n

Alvo autorizado: NxCO8HiaJmwqJ8jK, projeto mIsmhrUTAVI1ZPnf, em https://primary-production-04eb.up.railway.app. Credencial Google precisa de escrita na planilha; isso não implica escopo OAuth restrito a um arquivo. O workflow sempre usa o ID explícito escolhido.

Evolution usa credencial Header Auth, header apikey, guardada no n8n. CSV, planilha, logs e export compartilhável não recebem a chave. O workflow recebe arquivo pelo formulário de teste, com autenticação; permanece manual e não envia mensagens.

Antes de declarar instalação, ler workflow e planilha depois da gravação e executar uma coleta no alvo. API sem autenticação não autoriza instalar. Credencial legítima ou importação no editor são os caminhos suportados; não fabricar autenticação de sessão.
