# Plano de execução: vendedores no WhatsApp

**Objetivo:** executar a especificação aprovada em `docs/plans/2026-09-22-whatsapp-vendedores.md`.
**Arquitetura:** vínculos autorizados pelo banco; consultas server-side por vínculo; painel com identidade e paginação por fonte. Credenciais somente no ambiente do servidor.
**Stack:** Next.js 16, TypeScript, PostgreSQL e Vitest existentes.

## 1. Banco e repositório

- [x] Teste vermelho em `tests/integracao/whatsapp-vinculos.test.ts`: gestor salva/lê/remove, vendedor não acessa, senha provisória não escreve, unicidade e vendedor inválido.
- [x] Criar migração 0032 e `src/server/whatsapp/vinculos.ts`.
- [x] Contrato: `listarVinculos(usuarioId)` retorna `{id,vendedorId,nome,instancia,ativo}[]`; `listarVendedores(usuarioId)` retorna `{id,nome}[]`; `salvarVinculo(usuarioId,vendedorId,instancia)` substitui pelo vendedor; `removerVinculo(usuarioId,id)` remove somente associação. Escritas retornam `{ok:true}` ou `{ok:false,motivo:string}`.
- [x] Rodar integração e checagem da migração. Não aplicar no banco real antes de validar.

## 2. Escopo, histórico e arquivos

- [x] Testes vermelhos: selecionar apenas vínculos válidos; piloto separado; falha parcial não avança página; colisão de IDs entre fontes.
- [x] Criar `src/server/whatsapp/consulta.ts`: `consultarFontes(usuarioId,filtro,cursores?)` resolve fontes no banco e consulta em lotes de três. Cursor por fonte contém página e data de corte; apenas sucessos avançam.
- [x] Adaptadores `evolution.ts` e `midia.ts` recebem instância resolvida no servidor; identificador da fonte acompanha mensagens. Histórico e mídia autenticam a cada pedido.
- [x] Testar novamente unidade, tipos e rotas. Nenhum endpoint de envio.

## 3. Configuração e filtros

- [x] Testes vermelhos para formulário e links Todos/vendedor/piloto.
- [x] Criar `app/whatsapp/configuracao/{page.tsx,formulario.tsx,acoes.ts}` seguindo `app/usuarios/acoes.ts` e `formulario-criar.tsx`. Validar instância com consulta de mensagens antes de persistir; não copiar tokens.
- [x] Alterar `page.tsx`, `visao-geral.tsx`, `painel.tsx` e `midia-mensagem.tsx`: seleção via searchParams, cursores por fonte, identidade composta, nome do vendedor e avisos parciais. Remontar painel ao trocar filtro ou vínculos.
- [x] Rodar regressões existentes, tipos, lint e build isolado; verificar interface e autorização.

## Decisões de execução

O usuário aprovou implementação nesta sessão. Não escolher vendedor real para o piloto sem indicação. Manter a branch existente `codex/whatsapp-gestor-evolution` e preservar alterações alheias. Usar subagentes para banco e formulário conforme a skill de execução; coordenação e consultas ficam com o agente principal.

## Verificação final

- [x] Revisão de permissões, mídia e separação de fontes.
- [x] Migração local, validação do piloto sem alterar vínculos reais, commit apenas dos arquivos desta etapa.
