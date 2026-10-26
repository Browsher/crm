# Instruções da rotina Google por vendedor

Execute no checkout revisado C:\Users\ADM\.codex\worktrees\crm-redesign\crm. Leia docs/operacao/agente-google-crm.md, workflows/n8n/google/README.md e a skill google-maps-scraper. A rotina existente roda segunda a sexta às 17h, America/Sao_Paulo; sexta prepara segunda. O servidor escolhe os planos, os vendedores e congela a revisão. Cada vendedor preenche o próprio plano. Dia Não definido não roda; bairro vazio cobre a cidade inteira. Não preencha planos pelos vendedores.

Use um único coordenador determinístico para os três motores. Não dispare subagentes ou comandos avulsos de coleta/reivindicação para V2. Os motores 01, 02 e 03 preservam suas pastas e executores. Não altere o motor original, volumes, jobs, banco, credenciais ou agendamento para contornar um bloqueio. Enriquecimento social continua desligado.

Leia o journal privado em .google-agente/coordenador/journal.json. Se houver posição pendente, use retomar; caso contrário, rodar. Execute com terminal interativo mantendo stdin aberto:

```powershell
node --env-file=.env.google-agente.local --import tsx scripts/google/coordenar.mts rodar --campanha "C:/Users/ADM/projetos/01 - Ativos/Conteúdo e automações/Web Scraping/armarinhos" --pasta .google-agente
```

Troque somente rodar por retomar quando necessário. O arquivo privado carrega a origem do CRM e os tokens somente no processo. Nunca imprima seus valores. O coordenador segura a exclusão inclusive enquanto aguarda o Drive. Não termine esse processo para atender outro vendedor. Não crie outro executor para escapar de uma pendência.

O coordenador reivindica até três vendedores e executa os pipelines independentemente. Antes de cada nova onda exige 5.632 MiB disponíveis no Windows. Se faltar RAM, reporte que é necessário liberar ou aumentar RAM; preserve a fila. Não feche programas, não reduza a simultaneidade para contornar a regra, não remova jobs. Abaixo de 512 MiB ou com medição indisponível, novas admissões ficam suspensas e o trabalho iniciado é preservado.

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
Use JSON válido com chaves entre aspas. Solicitações podem chegar fora de ordem; associe cada uma pelo próprio UUID. Confirmação cruzada, duplicada ou antiga é recusada. Em queda entre upload e confirmação, mantenha a intenção e reencontre os mesmos arquivos. O coordenador reutiliza comprovantes locais confirmados e reconcilia a mesma publicação sem nova coleta.

Para V1, somente o motor 01 pode operar e nenhuma V2 inicia enquanto houver V1 pendente. Se aparecer legado_pendente, preserve as identidades e use exclusivamente o runbook V1 já existente; não invente revisão/hash/execução V2 nem converta recibos. Depois retome o mesmo coordenador.

Ao terminar, confira os resultados privados por execução e consulte o progresso pela ação consultar com o executor/pedido da posição, sem usar proximo para ler contagens. Relate por vendedor: data, região, revisão, coletas, lotes, candidatas distintas, entregues, repetidas/recusadas conforme respostas reais, motivo e links confirmados da pasta/arquivos. Não estime contagens ausentes. Preserve cadastro manual, carteira, posse, reserva e dados CNPJ.biz.

Fique em silêncio quando não houver trabalho, quando o estado estiver inalterado ou quando só houver reconfirmação de algo concluído. Avise entrega nova, falha nova ou ação necessária. Para alertas repetidos, compare motivo e identidades com o último aviso privado; variação pequena de RAM não é novidade. Computador, Codex e Docker precisam permanecer ligados.
