# Tercis — isolamento por organização e plano de lançamento

**Estado:** implementação numa branch e testes automatizados com PostgreSQL 16; **não foi aplicada ao Supabase de produção**.

## Modelo de segurança

- `organizations.id` representa a organização proprietária dos dados.
- `companies.id` representa **clientes** dessa organização; um cliente não é um tenant.
- `profiles.organization_id` é atribuído por convite de utilização única, não é selecionado pelo utilizador.
- `companies`, `budgets`, `custom_catalog_items` e `audit_logs` têm `organization_id` e RLS restritiva.
- Tabelas dependentes (itens, versões, mensagens, anexos, timeline, tipos de cliente e definições) herdam o limite pela organização do orçamento ou do cliente.
- Funções `SECURITY DEFINER` de envio, transições, aprovação de perfis e feeds de clientes verificam explicitamente a organização.
- Os orçamentos dos clientes usam feeds que omitem custos, acréscimos e notas internas. PDFs/Excel comerciais ocultam os mesmos campos.
- `app_admin` não pertence a organizações comerciais e não deve ler dados comerciais brutos.

## Fluxo de entrada

1. O administrador de uma organização existente cria um código de convite para o email de destino em **Equipa**.
2. O utilizador regista-se e confirma o email no Supabase Auth.
3. Na página de conta pendente, introduz o código. O servidor valida o email confirmado, validade de sete dias, organização e utilização única.
4. **O utilizador mantém-se inativo**. O administrador da organização revê e aprova explicitamente as permissões.
5. Um token não é uma sessão; deve ser partilhado privadamente e não incluído em logs, URLs ou analytics. O envio automático de convites ainda não está implementado.

## Atenção: migração de dados existentes

A migração `20261117193000_organization_isolation.sql` coloca todos os dados legados na organização **Tercis — dados legados**. É uma atribuição conservadora, não uma classificação real por empresa.

**Não executar diretamente numa base com mais de uma empresa real já misturada.** Antes de ativar clientes de empresas distintas:

1. Fazer backup completo e ensaiar restauração.
2. Identificar todos os orçamentos, clientes, utilizadores, catálogos, anexos, mensagens e auditorias e atribuir cada registo à organização verdadeira.
3. Rever associações entre `budgets.company_id`, `profiles.company_id`, atribuições, `customer_type_id`, anexos e mensagens.
4. Aplicar migrações numa cópia anonimizada de staging, executar testes RLS/RPC com contas reais, validar relatórios e PDFs.
5. Decidir como serão provisionados os administradores fundadores de novas organizações; a criação inicial continua a exigir uma conta técnica de confiança.
6. Só depois considerar deployment, com plano de reversão e aviso aos utilizadores.

## Verificações automáticas

O workflow `.github/workflows/tercis-quality.yml` executa typecheck, lint, build, npm audit, Playwright (desktop/mobile, orçamento e exports), migrações completas num PostgreSQL isolado e testes de RLS. Regressões adicionais simulam duas organizações, tentativas cruzadas de leitura, escrita e RPC, códigos de convite, email confirmado, reutilização e aprovação.

Estes testes não são uma auditoria formal de segurança nem substituem **staging no Supabase**.

## Ainda por concluir para lançamento SaaS

- MFA/TOTP: foi implementada validação **AAL2 no servidor** para sessões administrativas, operações privilegiadas e transições de estado, com bloqueio de sessões AAL1 e ecrã de inscrição TOTP; ainda é obrigatório validar com **Supabase Auth real** e ensaiar recuperação/perda de dispositivo, revogação e outros fatores.
- Provisionamento e remoção de organizações com procedimento operacional, administração delegada e revogação/expiração de convites.
- Políticas do Supabase **Storage** e acesso a ficheiros: bucket privado, paths por organização, limites de upload, URLs assinadas e validação de MIME/tamanho.
- Integridade de revisões de orçamentos, histórico de versões e anexos: snapshots imutáveis e tratamento de `sent_at` entre revisões.
- Testes de escala com paginação e carga concorrente, índices revistos a partir de `EXPLAIN ANALYZE`, política de retenção e backups.
- Observabilidade, alertas, registos de segurança, proteção contra abuso/rate limits, processo RGPD, gestão de segredos, CI/CD e restrição da branch `main`.
- E2E real com Supabase Auth, email confirmado, MFA e casos de fronteira; os testes locais usam um stub autenticado de PostgreSQL.
- Revisão humana independente das políticas RLS e uma avaliação de segurança antes de receber dados de clientes reais.

**Conclusão:** esta branch reduz substancialmente os riscos de acesso cruzado, mas não é uma declaração de prontidão para produção.
