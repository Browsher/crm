# Plano: carrossel de empresas do banco

Spec: ../specs/2026-10-27-carrossel-empresas-banco-design.md
Método já escolhido: implementação nesta conversa e revisão independente final. Worktree crm-redesign, branch codex/redesign-crm e PR55.

## Tarefa 1: grupo de origem na consulta protegida

- RED em tests/integracao/carrossel-empresas-banco.test.ts: grupo próprio, primeiro vínculo, empresas únicas ordenadas e nenhuma candidata não importada/empresa alheia/contato.
- Criar db/migracoes/0048_prospeccao_grupo_origem.sql substituindo a função 0043 com grupoOrigem; nenhuma guarda, ordenação, entrada ou permissão muda.
- Adicionar campo opcional em src/lib/prospeccao-pessoal.ts; documentar 0048 e ponteiro em 0043. Atualizar cinco inventários de migração existentes.
- GREEN integração e db:checar.

## Tarefa 2: cards e navegação

- RED no DOM de app/fila/buscar/empresas-recentes.tsx: três visíveis, até 11+atalho, teclado, vazio, atualização dos dados, reticências, Cliente e Dialog com nome/grupo completo.
- Compor Card/Button/Dialog existentes; CSS isolado para evitar as regras genéricas de busca-empresas.module.css. Paginação por largura do conteúdo observada; somente página atual renderizada. Usar primeiro Card como molde visual aprovado, não instalar dependências.
- Saída: EmpresasBancoRecentes({empresas: EmpresaPessoal[]}), sem acesso ao fornecedor ou comandos de aquisição. Dados somente do servidor; rótulos completos nos detalhes.

## Tarefa 3: integrar, validar e publicar

- Ler lerEmpresasPessoais(usuarioId,{origem:'banco'}) em app/fila/buscar/page.tsx e limitar a 11 antes das props; falha de leitura com mensagem. Remover anúncio antigo em formulario-completo.tsx sem alterar submit/UUID. Carrossel após formulário; histórico separado.
- E2E próprio com 13 importadas, outra origem/vendedor, longa identificação, vazio e Cliente; validar destino filtrado, 1:1/uma linha em 1920x1080/736/390 e detalhes completos. Reexecutar jornadas afetadas da busca e filtros.
- Revisão independente, correções necessárias, tipos/lint/build/unidade/integração. Commit e CI. Backup criptografado, aplicar 0048 exata da CI e preservar hashes/limites. Publicar fonte aprovada, verificar alias e smoke. Atualizar prévia com dados fictícios. Sem consulta real ou merge.

## Riscos a conferir

- Mesmo CNPJ em dois grupos: um card e primeiro grupo próprio.
- Grupo de outro vendedor ou candidata não importada: não aparecem.
- Nome/grupo com acentos e longos: corte 36/40 visual e texto completo no Dialog.
- Poucos/zero registros e resize na última página: atalho acessível, sem índices inválidos.
- Pausa/sem créditos: leitura continua possível, sem disparar consulta ao navegar.
