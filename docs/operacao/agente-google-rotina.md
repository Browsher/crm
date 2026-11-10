# Instruções da rotina Google por vendedor

Execute no checkout revisado C:\Users\ADM\.codex\worktrees\crm-redesign\crm. Leia docs/operacao/agente-google-crm.md, workflows/n8n/google/README.md e a skill google-maps-scraper. A rotina existente roda segunda a sexta às 17h, America/Sao_Paulo; sexta prepara segunda. O servidor escolhe os planos, os vendedores e congela a revisão. Cada vendedor preenche o próprio plano. Dia Não definido não roda; bairro vazio cobre a cidade inteira. Não preencha planos pelos vendedores.

Use um único coordenador, com um vendedor por vez. Pedidos novos usam o motor 01. Os motores 02 e 03 só são necessários para retomar pedidos que já estejam vinculados a eles. Preserve as pastas, volumes, jobs e executores dos três motores. Use o coordenador para coletar e reivindicar pedidos V2. Enriquecimento social continua desligado.

Antes de usar esse modo no agendamento, confirme que o checkout operacional contém a versão integrada e concilie as execuções abertas no CRM com o journal, inclusive nos motores 02 e 03. Uma reivindicação anterior cuja resposta se perdeu pode existir no CRM antes de aparecer no journal. O motor que vai trabalhar precisa estar ligado. Para conferir apenas o motor 01, execute `powershell -NoProfile -File scripts/google/motores.ps1 -Acao Conferir -Motor 01`. A conferência não dispara coleta.

Leia o journal privado em .google-agente/coordenador/journal.json. Se houver posição pendente, use retomar; caso contrário, rodar. Execute com terminal interativo mantendo stdin aberto:

```powershell
node --env-file=.env.google-agente.local --import tsx scripts/google/coordenar.mts rodar --campanha "C:/Users/ADM/projetos/01 - Ativos/Conteúdo e automações/Web Scraping/armarinhos" --pasta .google-agente
```

Troque somente rodar por retomar quando necessário. O arquivo privado carrega a origem do CRM e os tokens somente no processo. Nunca imprima seus valores. O coordenador segura a exclusão inclusive enquanto aguarda o Drive. Não termine esse processo para atender outro vendedor. Não crie outro executor para escapar de uma pendência.

O coordenador termina a entrega de um vendedor antes de reivindicar o seguinte. Se uma posição continuar pendente, encerra o ciclo e conserva o mesmo pedido para `retomar`. Antes de reivindicar ou de iniciar uma coleta nova exige 2.560 MiB disponíveis no Windows. Se faltar RAM, reporte a medição e preserve a fila. Abaixo de 512 MiB durante a execução ou com medição indisponível, novas admissões ficam suspensas e o trabalho iniciado é preservado.

Cada vendedor tem meta de até 50 entregues, até três lotes de 50 e até 150 candidatas distintas analisadas. O pipeline consome o pool antes de coletar novamente e para se não houver novidades. Sem critérios adicionais, o resultado neutro é local e faz zero HTTP de verificação. Os demais critérios usam o mesmo workflow autenticado: campos diferentes combinam E e alternativas do mesmo campo combinam OU. Produtos, tipo de empresa e observações continuam pendentes do qualificador; nunca fabricar evidências. Consultar registro WhatsApp não envia mensagens. Não usar o disparador legado para V2.

Atenda cada linha JSON com evento arquivar pelo caminho absoluto de solicitacao. Leia o manifesto; a correlação é solicitacao_id + associação + lote, nunca a última posição ativa. O manifesto é imutável e já registra a intenção de arquivamento antes de qualquer criação. Guarde o controle de efeitos do conector no mesmo diretório privado da solicitação. Antes de criar cada pasta/arquivo, registre exclusivamente a intenção com nome, pai, bytes e hash e depois o ID confirmado. Se a criação perder a resposta, procure o mesmo nome e pai e confira o conteúdo. Não repita upload cego, não troque a solicitação ou gere outro nome para contornar a incerteza.

Use somente o Google Drive conectado. Raiz existente 11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh. Reencontre ou crie a pasta pastaNome dentro de pastaPai. Preserve compartilhamentos e arquivos anteriores. Faça upload dos arquivos exatos indicados no manifesto, como CSV/JSON binários, sem conversão para Google Sheets. Nomes de bruto podem reaparecer em solicitações posteriores: reencontre e reutilize o mesmo arquivo confirmado. Nunca sobrescreva conteúdo divergente. Dois arquivos/pastas candidatos com o mesmo nome exigem reconciliação antes de continuar.

Para cada arquivo, obtenha metadados reais (id,name,parents), baixe os bytes pelo conector e use o caminho local materializado do download. Não use o caminho do original como se fosse download. Quando só houver URL temporária do provedor, mantenha-a exclusivamente no stdin privado com eco desativado, sem argumentos, logs ou comprovantes. O helper aceita apenas HTTPS do provedor confirmado e recusa redirecionamentos.

Rode o helper em terminal privado:

```powershell
node --import tsx scripts/google/conferir-drive.mts --solicitacao <manifesto-absoluto> --saida <comprovante-absoluto>
```

Envie por stdin um único JSON com pasta:{id,name,parents} e arquivos:[{id,name,parents,caminho:<download-materializado>}]. Se necessário, use url em vez de caminho, exclusivamente no stdin sem eco. Guarde a saída dentro de .google-agente/coordenador. O helper confere o original local, metadados, tamanho e SHA256 do download e grava comprovante sem URLs. Sucesso do upload sozinho não é conferência.

Só após o helper confirmar, envie ao stdin do coordenador a linha:
{acao:"confirmar_arquivo",solicitacao_id:<UUID-do-manifesto>,comprovante:<caminho-absoluto-do-comprovante>}.
Use JSON válido com chaves entre aspas. Associe cada solicitação pelo próprio UUID, inclusive na retomada. Confirmação cruzada, duplicada ou antiga é recusada. Em queda entre upload e confirmação, mantenha a intenção e reencontre os mesmos arquivos. O coordenador reutiliza comprovantes locais confirmados e reconcilia a mesma publicação sem nova coleta.

Para V1, somente o motor 01 pode operar e nenhuma V2 inicia enquanto houver V1 pendente. Se aparecer legado_pendente, preserve as identidades e use exclusivamente o runbook V1 já existente; não invente revisão/hash/execução V2 nem converta recibos. Depois retome o mesmo coordenador.

Ao terminar, use cada evento `resultado` do ciclo e os arquivos privados por execução para conferir todos os vendedores. A posição 01 no journal é reutilizada e mostra apenas o último pedido desse motor. Use `consultar` com o executor e o pedido de cada resultado para conferir o progresso. Relate data, região, revisão, coletas, lotes, candidatas distintas, entregues, repetidas ou recusadas conforme as respostas reais, motivo e links confirmados da pasta e dos arquivos. Preserve cadastro manual, carteira, posse, reserva e dados CNPJ.biz.

Fique em silêncio quando não houver trabalho, quando o estado estiver inalterado ou quando só houver reconfirmação de algo concluído. Avise entrega nova, falha nova ou ação necessária. Para alertas repetidos, compare motivo e identidades com o último aviso privado; variação pequena de RAM não é novidade. Computador, Codex e Docker precisam permanecer ligados.
