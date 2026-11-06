# Validação da primeira entrega dos painéis comuns

Data: 2026-11-06. Branch: `codex/paineis-comuns-entrega-1`.

Validação local concluída, com conferência manual e correções reproduzidas. As rodadas anteriores e posteriores ao ajuste final de foco estão identificadas separadamente; revisão independente e CI do PR permanecem a cargo do controlador.

## Escopo e ambiente

Retorno de Meu dia, Dados da empresa, Negociação e Arquivo usam a mesma lateral. Até 820 px ela ocupa a tela; acima disso usa `clamp(380px, 47vw, 520px)`. O cabeçalho e o rodapé ficam fora do corpo rolável. O menu abre uma seção de cada vez e Voltar restaura a origem e seu foco. Confirmações de descarte, venda e Sem interesse permanecem centrais.

Toda execução usou dados fictícios, banco temporário `teste_*`, papel `app_teste`, mocks de integrações e guardas de host local. PostgreSQL 18 exclusivo em `127.0.0.1:55432`, SSL desligado. Nenhuma produção, busca paga ou integração real foi utilizada. Nenhuma migração, SQL, RLS, regra comercial, DTO, armazenamento de sessão ou dependência foi alterada. Autodeploy desativado exclusivamente para a branch desta entrega.

## Geometria e acessibilidade automatizadas

As dez combinações abaixo passaram na primeira rodada de navegador. Cada combinação percorreu Retorno, Histórico com nota longa sem espaços, Dados, Negociação e Arquivo. Asserções: largura dentro de 1 px da expressão aprovada, y=0, altura dentro de 1 px da viewport e ausência de rolagem horizontal da página e do corpo. Cabeçalho e rodapé mantêm sua posição antes e depois de rolar. Pares comerciais têm largura igual dentro de 1 px. Alvos de ação têm no mínimo 40 px no desktop e 44 px no móvel, incluindo links do rodapé.

| Viewport | Largura esperada | Largura medida | Claro | Escuro |
| --- | ---: | ---: | --- | --- |
| 390 × 844 | 390 px | 390 px | Passou | Passou |
| 820 × 900 | 820 px | 820 px | Passou | Passou |
| 821 × 900 | 385,87 px | 385,859375 px | Passou | Passou |
| 1024 × 768 | 481,28 px | 481,265625 px | Passou | Passou |
| 1440 × 900 | 520 px | 520 px | Passou | Passou |

A rodada dirigida estável preservou 50 medições: dez por viewport, com y=0 e alturas 844/900/900/768/900 px respectivamente. Todas mantiveram cabeçalho e rodapé na posição após a rolagem.

No móvel emulado, Enter abre tarefas, Tab e Shift+Tab permanecem no painel, e confirmação central permanece fora de inert com o alvo correto. No desktop, a navegação do quadro recebe foco enquanto a lateral está aberta. Um caso com hasTouch também abriu e cancelou confirmação por tap. Isso comprova emulação de toque e teclado do navegador desktop, não dispositivo físico.

## Defeitos reproduzidos e corrigidos

- Ver todos em filtro vazio: o botão focado era reutilizado como Negociação. RED DOM mostrou foco no comando comercial; a correção mínima devolve foco ao título Histórico e mantém uma única leitura. GREEN da regressão correspondente.
- Contato em transmissão: o filho mostrava Registrando… com ações desabilitadas, mas Voltar seguia habilitado e aria-busy=false. A guarda por ref já recusava fechamento; faltava refletir visualmente a pendência durante a Action. RED em navegador e no pai DOM real, antes da correção. O dono agora mantém a ref imediata e atualiza sua apresentação em microtask fora da Transition, ignorando após unmount. FormularioContato e seus outros consumidores permaneceram intactos.
- O caso 820/821 passou após a correção: mesma nota, próximo passo e elemento de campo antes/depois de resize; fechamento bloqueado durante resposta retida; um POST e um contato após liberar a resposta.
- A conferência manual encontrou foco em BODY após Devolver remover uma entrada do Arquivo móvel. A remoção não emite focusin; o status do quadro fica inert e sua tentativa de foco é ignorada pelo navegador. RED com PainelArquivo real reproduziu BODY em 390 px e preservou o controle desktop. A MutationObserver já existente da guarda móvel agora restaura o título quando o foco sai do painel e não há confirmação central aberta. Um marcador de atividade e isConnected ignoram callback tardio após desktop/unmount. Nenhum comando, consumidor ou armazenamento foi alterado por esse ajuste.

As jornadas antigas foram adaptadas aos menus e à divisão entre título e descrição dos estados. Esperas usam estado observável de leitura/revalidação. Nenhum retry genérico, aumento de prazo ou skip foi adicionado para acomodar o layout. Assertivas de privacidade e idempotência foram preservadas.

## Execuções e ocorrências

| Momento | Verificação | Resultado observado |
| --- | --- | --- |
| Antes do ajuste final da guarda | Unitária integral, maxWorkers=2 | 248 arquivos, 2642 aprovados, 1 skip preexistente exclusivo Linux, 347,99 s |
| Antes do ajuste final da guarda | Integração integral PG18 | 91 arquivos, 829 testes aprovados, 436,24 s |
| Antes do ajuste final da guarda | Tipos, lint e convenções de banco | exit 0, sem erros ou avisos novos |
| Antes do ajuste final da guarda | Build E2E do bloqueio de envio | exit 0, compilação 3,1 s e tipos 7,3 s |
| Antes do ajuste final da guarda | Regressão DOM dos consumidores e formulário | 3 arquivos, 123 testes aprovados, 10,62 s |
| Antes do ajuste final da guarda | Envio lento 820/821 no navegador | 1 aprovado, 4,2 s |
| Antes do ajuste final da guarda | E2E dirigido estável | 75 aprovados, 5,1 min; banco temporário removido |
| Antes do ajuste final da guarda | E2E integral | 193 aprovados, 13,2 min; sem skips ou retries; banco temporário removido |
| Após o ajuste final da guarda | Guarda, painel e consumidores DOM | 5 arquivos, 153 aprovados, 22,80 s; desktop, Dialog real e callbacks tardios cobertos |
| Após o ajuste final da guarda | Build E2E | exit 0, compilação 3,9 s e tipos 8,8 s |
| Após o ajuste final da guarda | E2E dos consumidores e recuperação móvel | 76 aprovados, 5,4 min; banco temporário removido |
| Após o ajuste final da guarda | Tipos e lint | exit 0, sem diagnósticos, avisos ou erros |
| Após incorporar o manual e a correção | Integridade documental | 281 verificações aprovadas em src/docs.test.ts |

A primeira unitária integral teve 2638 aprovados, duas falhas e um skip preexistente exclusivo Linux no Windows. Uma falha era uma expectativa de layout legado, atualizada ao contrato final e verificada. A outra foi KeyError workflow_automatico no teste offline Python de resposta inválida. O teste Python passou isoladamente e na integral final; a causa da ocorrência anterior não foi determinada. A integral final sobre árvore estável aprovou os 248 arquivos e 2642 casos, mantendo somente o skip preexistente. O aviso de import dinâmico Vite em src/server/diretivas.test.ts já existia.

A primeira rodada dirigida teve 62 aprovados e 13 falhas. Ela identificou ajustes de seleção/sincronização nas jornadas e a falha visual de pendência descrita acima. A rodada dirigida estável aprovou os 75 casos; a integral aprovou todos os 193 casos na mesma build, sem skips ou retries. Os 18 PNGs históricos regravados pelos testes foram preservados separadamente e restaurados por lista explícita, após conferir paths absolutos, hashes e ausência de staging alheio. Nenhuma referência visual histórica faz parte do diff.

## Conferência manual e limites

O controlador usou Chrome desktop em abas isoladas no Windows, harness local em 4322 e a mesma build com --sem-build. A tentativa inicial em 4321 encontrou porta ocupada antes de criar banco; nenhum processo alheio foi encerrado. Ao encerrar, o servidor saiu com código 0, o banco teste_864dc01519dd foi removido e as abas isoladas foram fechadas.

Em 1440 × 900 claro, Meu dia iniciou sem painel. Retorno de Aurora, filtro Vendas vazio e Ver todos conservaram contexto e foco no h3 Histórico. Dados mediu 520 × 900 em y=0, corpo scrollTop=1220, scrollHeight=1966 e clientHeight=746; cabeçalho entre 0 e 81 e rodapé entre 827 e 900 permaneceram fixos, sem overflow horizontal. Dados → Negociação → Histórico → Venda preservou a origem; a confirmação mostrou empresa, valor 150 e data 06/11/2026 corretos, com foco neutro em Corrigir dados. Escape manteve os campos; descarte teve foco em Continuar editando e voltou ao Histórico. A navegação de fundo funcionou no desktop. Nenhuma venda foi criada nessa conferência.

Em 390 × 844 escuro, Retorno ocupou 0/0/390/844 e o rodapé ficou entre 767 e 844. Shift+Tab do título focou Negociação; Tab focou Fechar, sempre dentro do painel. No Funil, três arrastos e confirmações mostraram os alvos corretos e foco neutro em Cancelar; o Arquivo mostrou três entradas corretas. Em 390 × 844 claro, Arquivo manteve o link exato /fila/localizar?disponibilidade=sem_interesse&pagina=1 e não criou overflow. Devolver adicionou a empresa correta a Primeiro contato e reduziu a lista para duas; foi nesse ponto que se observou BODY, corrigido na guarda e validado nos testes posteriores. Fechar restaurou o gatilho Sem interesse. Console do navegador sem erros ou avisos nas duas abas.

Capturas reais dessa conferência, anteriores ao ajuste final de foco e preservadas byte a byte:

- [Retorno móvel escuro](2026-11-06-paineis-entrega-1/manual-retorno-mobile-dark.png)
- [Funil móvel claro](2026-11-06-paineis-entrega-1/manual-funil-mobile-light.png)
- [Arquivo móvel claro aberto](2026-11-06-paineis-entrega-1/manual-arquivo-mobile-light-open.png)

Envio lento e perda de resposta foram comprovados pelo E2E, sem novo ensaio manual desses dois cenários. Não há evidência de dispositivo físico, teclado virtual ou barras de um navegador móvel real; esses cenários permanecem não ensaiados.

A recuperação de Devolver já existe dentro do Arquivo, com nome do alvo e botão Confirmar devolução anterior. O feedback visual da lista e o foco permanecem no painel. O texto global de sucesso/erro continua em um status fora da lateral, inert no móvel: não foi validado como anúncio acessível dentro do painel. Esse limite fica explícito para a revisão independente do padrão de estados, sem ampliar conteúdo por suposição.

Após o ajuste, o navegador confirmou foco no h2 após Devolver em 390/820 px nas duas cores e preservou foco no status do quadro nos desktops. O novo caso móvel de resposta perdida confirmou recuperação visível e habilitada dentro do Arquivo, dois POSTs com a mesma chave, uma única negociação aberta, vínculo sem segunda alteração e limpeza do comando depois do replay. O anexo capturado confirmou explicitamente inert=true para os textos globais de erro e sucesso; a recuperação funcional não depende desses textos externos.

A revisão final independente e o CI integral do PR pertencem ao controlador e ainda devem verificar a árvore com o último ajuste. Não houve merge ou publicação nesta validação.
