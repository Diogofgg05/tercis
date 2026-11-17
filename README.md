# Tercis — Plataforma de orçamentos e clientes

Aplicação React + TypeScript + Vite para gestão de orçamentos, catálogo, clientes, equipas e relatórios. Utiliza Supabase Auth/Postgres para dados reais e pode ser apresentada sem backend em **modo demonstração**.

## Instalação

```bash
npm ci
cp .env.example .env.local
npm run dev
```

No Windows, copie `.env.example` para `.env.local` e configure os valores. Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o website abre no modo demonstração, com exemplos locais que **não são dados reais nem estão sincronizados**.

## Validação

```bash
npm run typecheck
npm run build
npm run lint
```

O workflow `.github/workflows/tercis-quality.yml` verifica TypeScript, build e Chrome, além de executar as migrações numa base PostgreSQL 16 descartável. Os testes SQL abrangem onboarding, RLS, visibilidade do portal, isolamento administrativo, gravação atómica, conflitos de versão e rollback.

## Mudanças desta revisão

- Dashboard e lista de orçamentos sem estatísticas inventadas na conta real; valores calculados dos itens carregados.
- Separação do modo demonstração (dados locais) e Supabase real.
- Orçamentos guardados através de uma função PostgreSQL transacional que grava cabeçalho e itens de uma só vez; caso uma operação falhe, nenhuma das alterações é confirmada.
- Editor passa a utilizar o botão **Guardar** sem aprovações/envios simulados.
- Clientes ligados ao Supabase, com validação e permissões de interface.
- MFA TOTP real com Supabase Auth: configuração na segurança e confirmação no início de sessão para contas com segundo fator ativo.
- Corrigidos erros de TypeScript e controlos antigos que apresentavam comportamentos fictícios.

## Base de dados e segurança

**Antes de testar gravações numa conta real**, aplique as migrações em `supabase/migrations` por ordem e valide-as num projeto de testes do Supabase. A revisão adiciona:

- `20261117112500_atomic_budget_save.sql`: função `save_budget_atomic` com `SECURITY INVOKER`, para respeitar RLS.
- `20261117114500_profiles_and_privilege_guard.sql`: campos de perfil e proteção contra autoatribuição de cargos, permissões e empresas.
- `20261117123000_secure_onboarding.sql`: impede privilégios administrativos automáticos; contas novas ficam inativas até aprovação e os perfis ficam mais protegidos.
- `20261117133500_client_portal_visibility.sql`: impede que clientes vejam notas, mensagens e anexos internos.
- `20261117135000_company_scope_boundaries.sql`: limita configurações, tipos de cliente e auditorias do `company_admin` à sua empresa.
- `20261117153000_budget_status_transitions.sql`: transições controladas e auditadas dos 11 estados.
- `20261117161500_client_safe_feeds.sql`: preços finais para clientes sem expor custos nem margens.
- `20261117163000_companies_write_guard.sql` e `20261117170000_customer_company_access.sql`: restringem escrita e consulta de clientes e a associação de orçamentos.
- `20261117174000_budget_commercial_write_guards.sql`: impede alterar preços e itens de propostas já submetidas e restringe a eliminação a rascunhos.
- `20261117175500_budget_submission_customer_check.sql`: não permite submeter orçamentos sem um cliente associado.

Se a migração transacional não estiver instalada, a gravação de orçamentos devolve um erro explícito em vez de apagar os itens existentes. Cada orçamento tem agora controlo otimista de versão: uma edição antiga é rejeitada para não sobrescrever uma mais recente.

**Limites importantes:** o modelo atual mistura cliente e organização no campo `company_id`; por isso, o isolamento completo entre empresas **não está garantido**. Os testes SQL validam cenários específicos numa base PostgreSQL isolada, não certificam a configuração de um Supabase real. Os administradores legados ainda têm privilégios globais. É necessário definir um modelo explícito de organização/tenant e auditar todas as políticas antes de alojar vários clientes independentes. As migrações não são aplicadas pelo CI; para publicar comercialmente é preciso testar persistência, permissões e MFA no Supabase real.

## Modo demonstração

O modo demo apresenta contas e dados fictícios, identificados no ecrã. Pode criar/editar orçamentos de exemplo no armazenamento local do navegador; não deve introduzir dados de clientes reais. O registo de novas contas e as alterações ao perfil real ficam indisponíveis sem ligação ao Supabase.


## Regras comerciais de edição

- Um **administrador legado** pode associar clientes e atribuir responsáveis enquanto o documento estiver editável.
- Um **colaborador interno** pode preparar rascunhos seus/atribuídos, inicialmente sem cliente associado; a administração liga o cliente antes da submissão.
- Os estados **Rascunho, Rejeitado, Pedido de alterações e Expirado** permitem rever a informação comercial autorizada.
- Depois da submissão, os campos comerciais, os custos dos itens e a eliminação do orçamento ficam bloqueados. Alterações futuras exigem regressar a um estado de revisão permitido.
- A lista de orçamentos só mostra as ações de editar, duplicar e eliminar quando são permitidas para o utilizador e documento; propostas não editáveis abrem em consulta.
- O PostgreSQL executa as proteções essenciais; esconder um botão na interface, isoladamente, não é uma medida de segurança.

## Utilizadores, papéis e estados

A matriz de acesso por papel (administrador de plataforma, administrador legado, administrador de empresa, colaborador e cliente), os 11 estados dos orçamentos e os limites atuais de segurança estão documentados em [Perfis, permissões e estados](docs/perfis-permissoes-e-estados.md).

## Próximos passos antes do lançamento

1. Definir claramente a organização proprietária de cada dado, migrar o modelo de tenants e auditar todas as políticas RLS, incluindo operações diretas à API.
2. Aplicar e testar as migrações por ordem num Supabase de testes, usando contas reais de perfis diferentes; criar o administrador inicial por um fluxo controlado e nunca por primeiro registo público.
3. Validar o percurso criar → editar → guardar → reabrir → exportar, incluindo falhas de rede.
4. Testar em telemóvel, leitores de ecrã e navegadores principais.
5. Confirmar políticas de privacidade, backups, emails e gestão de sessões.

[Projeto original criado no Bolt](https://bolt.new/~/sb1-nx7spfpk).
