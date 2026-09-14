# Gestor somente administra: separação de telas

Decisão explícita: gestor apenas administra equipe. Nesta fatia, início próprio /gestao com atalhos Empresas, Grupos e Usuários; menu do gestor sem Meu dia, Prospecção ou Carteira. Vendedor preserva suas três áreas e não acessa gestão. Dashboard com indicadores fica para depois.

/ continua sendo entrada comum autenticada, encaminhando por papel. Nova exigência vendedor na guarda existente protege páginas, layouts e Server Actions de atendimento. Gestor em URL de atendimento volta à gestão; vendedor em gestão volta à sua entrada. Troca obrigatória de senha precede a separação de papéis. Preservar todos os dados e vínculos antigos; não transferir/devolver clientes, não mudar SQL nem aplicar migração. Esta é separação da aplicação, sem retirar permissões administrativas do banco.

Plano curto: testes RED de entrada, exigência por papel, navegação e interrupção de actions; implementar guarda/menu/início e aplicá-los às rotas; adaptar jornadas ao novo destino do gestor e verificar acesso direto; suíte completa local no Docker, uma revisão independente, PR com CI verde. Merge após validação. Preservar arquivos alheios e evitar repetir suítes já aprovadas sem mudança relevante.

Verificação: RED observado para entrada, menus, guarda e action de contato antes da implementação. Suíte final: 895 unitários passando e 1 skip; 454 integrações passando e 1 skip; 37 jornadas de navegador passando; lint, typecheck, build isolado e db:checar aprovados. Revisão independente sem achados importantes. Capturas 390/1280 claro/escuro conferidas. Banco temporário teste_cddf0d1ece5f removido pelo harness; Railway não alterada. Aviso antigo de stream fechado reapareceu em grupos sem falhar a jornada. CI e validação visual precedem merge.
