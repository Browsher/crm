# Validação do planejamento Google

Implementação na branch `codex/redesign-crm`, a partir de
`d57eda95e428089aacf3bfe8a4f4a2868f355fb8`. Desenho aprovado em 22/10/2026.

## Evidências antes da revisão independente

- Unidade completa: 1.387 aprovados e 1 ignorado, com prazo local de 60 s.
  Após o ajuste do proxy, 15 testes focados passaram, incluindo o caso novo
  de Bearer sem cookie. Os limites padrão do CI não foram alterados.
- Integração completa: 617 aprovados, 5 falhas nas listas explícitas de
  migrações, 1 ignorado. As cinco listas foram atualizadas para incluir 0040;
  os 12 testes desses arquivos passaram depois. A suite Google com paginação
  passou seus 18 testes após a mudança.
- Build de produção para o harness, typecheck, lint e db:checar aprovados.
- Navegador: 62 jornadas aprovadas, incluindo CNPJ.biz, planejamento,
  privacidade por vendedor, gestor, API autenticada, repetição idempotente e
  reserva do lead entregue. Desktop, 390 px e tema escuro exercitados.
- Ponte Python: 8 casos via unidade, com arquivos temporários. Coleta real,
  Google Sheets, Drive, n8n e Evolution não foram acionados por esta entrega.

## Verificação após as correções

- Unidade completa: 1.389 aprovados, nenhum reprovado e 1 ignorado, em
  `npm run test:unit -- --maxWorkers=1 --testTimeout=60000`, com relatório
  JSON real. Inventário de 1.390 casos extraído desse relatório.
- Integração completa: 624 aprovados, nenhum reprovado e 1 ignorado, em
  `npm run test:integracao -- --maxWorkers=1`. Inclui 20 testes Google,
  a reprodução concorrente e o vínculo de pendências históricas.
- Ponte Python: 9 casos aprovados. Contrato de cidade inteira aceito pelos
  dois helpers instalados, com arquivos temporários e nenhuma chamada HTTP.
- Build de produção do harness, typecheck, lint, convenções de migração e
  checagem do diff aprovados após as correções.
- Navegador completo: 62 jornadas aprovadas em 4,8 minutos, com banco
  descartável removido ao terminar. Inclui CNPJ.biz, fluxo Google, carteira,
  fila, gestão e WhatsApp simulado. Nenhum fornecedor real foi chamado.

## Decisões operacionais

- O pedido aprovado autoriza implementação inline sem outra confirmação do
  plano técnico derivado. A produção e a rotina real permanecem pendentes de
  ativação conforme o desenho.
- Até 50 leads são entregues por pedido. Ocorrências excedentes permanecem
  na auditoria, com capacidade de 5.000 registros/8 MB e 50 por página.
  Capacidade insuficiente deixa o lote para conferência, sem descarte silencioso.
- A revisão automática rejeitou remover o caminho legado de listas Google.
  Ele foi preservado e reutilizado para identificar empresas de origem
  Google nas listas compartilhadas anteriores.
- Importações frias de módulos no Windows excederam o prazo de 5 s em testes
  antigos. A verificação local usa 60 s, sem remover asserções ou mudar o CI.

## Capturas

- `google-planejamento-desktop.png`: planejamento com pedido salvo.
- `google-planejamento-mobile-escuro.png`: formulário em 390 px e tema escuro.
- `google-gestor-desktop.png`: pedidos, destinatários e utilização.
- `google-gestor-mobile.png`: auditoria dos resultados com pendências.

Capturas de página inteira podem posicionar barras fixas na posição atual de
rolagem do navegador. A conferência visual da prévia usa também a viewport
real. Todas as empresas, contatos e contas das evidências são fictícios.

## Revisão independente

Revisor com contexto novo, GPT-6-astra, examinou `d57eda95..45db6ca` sem
modificar o checkout. Nenhum Critical; três Important e um Minor. A lista
de itens sobre os quais o revisor não quis opinar ficou vazia.

Os três Important foram reproduzidos e corrigidos em uma passagem:

- Desativação concorrente: o teste demonstrou que a alteração de usuário
  confirmava enquanto a entrega esperava pela empresa. Agora executor e
  destinatário ficam bloqueados durante a publicação; a mudança de acesso
  serializa com a entrega inteira. Integração observada RED → GREEN.
- Histórico central: antes só aparecia a entrega recente; agora pendências
  antigas sem vínculo são encontradas por CNPJ/Place ID inequívoco, sem
  associar identidades conflitantes. Integração observada RED → GREEN.
- Cidade inteira: o contexto operacional usa essa indicação nos dois
  helpers, mantém bairro original vazio e preserva os endereços. Teste
  Python observado RED → GREEN. Os helpers reais `arquivo_drive.py` e
  `disparar_workflow.py` aceitaram o contexto em teste local sem rede.

Minor adiado: promoção de vendedor para gestor durante espera do salvamento
de planejamento não repete a validação do papel após o lock. Pode salvar
um pedido nessa transição concorrente; não concede acesso de outro vendedor
e a entrega exige destinatário vendedor ativo. Não foi incluído na passagem
de correções, conforme o processo de revisão inline.

## Decisões tomadas durante a execução

Registro completo das decisões do ledger desta implementação, em ordem:

1. `Ruling:` seguir do desenho aprovado para o plano derivado e execução
   inline, conforme autorização explícita. Custo se incorreto: ajustar as
   tarefas técnicas derivadas.
2. `Ruling:` aplicar o limite de 50 aos leads entregues e conservar todas as
   ocorrências na auditoria, até 5.000/8 MB. Custo se insuficiente: ajustar
   capacidade de auditoria; não descartar dados silenciosamente.
3. `Ruling:` preservar e reutilizar o caminho legado das listas Google,
   após rejeição automática de sua remoção. Custo: uma consulta limitada
   de metadados por página do catálogo.
4. `Ruling:` usar 60 s na suíte unitária local diante de importações antigas
   que levaram de 6,8 a 21,5 s no Windows. Asserções e CI inalterados.
   Custo: uma importação travada demora mais a falhar localmente.

A ativação operacional está descrita em
[operação do agente](../../../operacao/agente-google-crm.md).
