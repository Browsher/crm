# Catálogo no assistente de prospecção

> Execução por tarefa com testes primeiro e revisão independente. A PR permanece aberta para revisão.

**Objetivo**. Selecionar primeiro um SKU no painel compartilhado, liberar região e refinamentos compatíveis e aplicar a sugestão ao rascunho de Google ou Banco.

**Arquitetura**. O catálogo versionado fornece produtos, perfis de comprador, especialidades e candidatos a CNAE. O painel envia somente a seleção e a orientação do vendedor. O servidor resolve a ficha, consulta Claude e valida as sugestões com as regras da origem.

**Especificação**. [Catálogo no assistente](../specs/2026-11-12-assistente-ia-catalogo-design.md).

## 1. Catálogo

- [ ] Testar os 40 SKUs, as variantes de garrafa, a pesquisa e as especialidades específicas por SKU.
- [ ] Versionar o catálogo em `src/lib/assistente-ia-catalogo.ts`. Conferir cada código candidato no catálogo oficial do Banco. Importar apenas dados úteis à prospecção.

## 2. Painel e formulários

- [ ] Testar a seleção antes dos campos, pesquisa por SKU ou nome, descrição livre, troca de produto, resposta atrasada e aplicação do resultado.
- [ ] Evoluir `src/components/crm/assistente-ia-busca.tsx` com os componentes existentes. Exibir a região depois da seleção e manter **Refinar busca** recolhido inicialmente.
- [ ] Integrar as regiões e os rascunhos em `app/fila/google` e `app/fila/buscar`. Preservar todas as regiões do Banco por padrão e mostrar a lista que será aplicada quando o vendedor editar.

## 3. Claude e relevância dos filtros

- [ ] Testar seleção adulterada, CNAE oficial de perfil errado, CNAE amplo, ausência de CNAE pertinente, localização e preferências preservadas.
- [ ] Atualizar as ações de vendedor e os serviços em `src/server`. Restringir CNAEs por produto e perfil, conferir códigos e indicar o alcance dos códigos amplos. Restringir descrição livre a candidatos com relação ao público. Aplicar tipos de negócio do Google quando o vendedor indicar um público correspondente.

## 4. Verificação

- [ ] Conferir as duas origens em testes com Claude simulado. Validar seleção, refinamento e aplicação sem iniciar busca ou salvar. Rodar typecheck, lint e suítes aplicáveis.
- [ ] Revisar a branch, abrir a PR e acompanhar o CI até passar.
