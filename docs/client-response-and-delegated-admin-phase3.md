# Tercis — Ronda 3: integridade das respostas e permissões delegadas

**Branch:** `fix/tercis-client-response-integrity` · Base: `fix/tercis-published-client-feed`. As migrações não foram executadas em produção.

## Corrigido

### Respostas a propostas
- Respostas de cliente são autorizadas no PostgreSQL apenas para o **orçamento atualmente enviado**, a última versão enviada, a organização correta e a mesma empresa destinatária.
- O trigger `tercis_guard_current_client_response` protege até operações SQL diretas que contornam o frontend; a função de transição mantém o bloqueio de versões antigas (controlo de concorrência).
- `tercis_client_quote_feed` devolve `can_respond` para cada proposta. Versões históricas continuam legíveis, mas perdem os botões **Aceitar/Rejeitar/Pedir alterações**.
- O frontend verifica `can_respond`, mas a base de dados continua a autoridade. O prazo de validade já é validado no servidor pela migração anterior.

### MFA na submissão
- Um administrador com sessão `aal1` não pode usar `tercis_transition_budget` para submeter um orçamento, mesmo quando a operação é uma RPC `SECURITY DEFINER`.
- `aal2` continua a autorizar operações válidas; permissões já existentes de colaboradores internos são preservadas.

### Gestão da equipa
- `company_admin` pode emitir convites e aprovar contas regulares **apenas da própria organização**, com MFA AAL2 obrigatório.
- Não pode modificar `admin`, `app_admin`, outros `company_admin`, nem elevar um membro a `company_admin`.
- A interface e os carregamentos de perfis foram alinhados com estas regras. `admin` legado mantém capacidade de elevar para `company_admin`.

## Testes

O workflow de GitHub Actions executa os testes de PostgreSQL, controlo de acesso, perfis, MFA, integração do portal de cliente e compilação/Playwright. A suite de segurança inclui a gestão da equipa e os estados `can_respond` de propostas históricas e atuais.

## Ainda por corrigir

- O estado **Enviado** indica publicação no portal; não existe confirmação real de entrega por email.
- O feed de mensagens após publicação precisa de modelo próprio de mensagens publicadas (a restrição atual é conservadora).
- Custos de referência fictícios e catálogo comercial devem ser consolidados num catálogo único por organização e carregados do servidor quando forem confidenciais.
- Falta paginação real nas consultas e feeds; `save_budget_atomic` deve devolver a versão final, não apenas o ID.
- Armazenamento privado de anexos, arquivo reversível, backups, monitorização, testes com Supabase Auth real e migração segura dos dados históricos continuam pendentes.

**Não integrar em `main` nem aplicar migrações sem testes e revisão independente em staging Supabase.**
