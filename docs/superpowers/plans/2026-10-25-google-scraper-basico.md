# Conexão operacional do scraper e verificações básicas

Spec de autoridade: docs/superpowers/specs/2026-10-23-google-criterios-rodadas-design.md.
Decisão do usuário em 25/10: conectar verificações básicas; produtos, tipo de empresa e observações ficam pendentes sem qualificador de IA.

1. Conferir coletor existente, diretório movido e API local 8087. Preparar configuração privada do executor e comando de conferência sem disparar coleta. Não alterar campanha/cron legados.
2. Adaptar workflow único para reutilizar a credencial Evolution existente, sem copiar chave para parâmetros/env. Recalcular etapas requeridas e validar identidades. Dados de Google, telefone fixo, site/email já publicados geram evidências; ausência de comprovação e qualificador indisponível geram nao_confirmado por candidata. Não bloquear as verificações básicas nem aprovar perfil não verificado. Testes RED→GREEN do grafo real e conexão.
3. Atualizar o mesmo workflow com backup e preservar integralmente o ramo da planilha. Homologar webhook autenticado, combinações e respostas negativas, sem gravar empresas fictícias nem enviar mensagens. Conferir API do scraper sem criar coleta fora de planejamento.
4. Testes apropriados, revisão independente do incremento, docs/PR e estado real de ativação.

Limites preservados: 50 entregues, 3 lotes/150 candidatas, exclusividade global, nenhuma ampliação de região, fonte Google neutra dispensa verificações, nenhuma consulta CNPJ paga.
