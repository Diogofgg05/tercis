# Tercis — Plataforma de orçamentos e clientes

Aplicação React + TypeScript + Vite para gestão de orçamentos, catálogo, clientes, equipas e relatórios. Utiliza Supabase Auth/Postgres para dados reais e pode ser apresentada sem backend em **modo demonstração**.

## Instalação

\`\`\`bash
npm ci
cp .env.example .env.local
npm run dev
\`\`\`

No Windows, copie \`.env.example\` para \`.env.local\` e configure os valores. Sem \`VITE_SUPABASE_URL\` e \`VITE_SUPABASE_ANON_KEY\`, o website abre no modo demonstração, com exemplos locais que **não são dados reais nem estão sincronizados**.

## Validação

\`\`\`bash
npm run typecheck
npm run build
npm run lint
\`\`\`

O workflow \`.github/workflows/tercis-quality.yml\` verifica TypeScript e build antes de fazer merge.

## Mudanças desta revisão

- Dashboard e lista de orçamentos sem estatísticas inventadas na conta real; valores calculados dos itens carregados.
- Separação do modo demonstração (dados locais) e Supabase real.
- Orçamentos guardados através de uma função PostgreSQL transacional que grava cabeçalho e itens de uma só vez; caso uma operação falhe, nenhuma das alterações é confirmada.
- Editor passa a utilizar o botão **Guardar** sem aprovações/envios simulados.
- Clientes ligados ao Supabase, com validação e permissões de interface.
- MFA TOTP real com Supabase Auth: configuração na segurança e confirmação no início de sessão para contas com segundo fator ativo.
- Corrigidos erros de TypeScript e controlos antigos que apresentavam comportamentos fictícios.

## Base de dados e segurança

**Antes de testar gravações numa conta real**, aplique as migrações em \`supabase/migrations\` por ordem e valide-as num projeto de testes do Supabase. A revisão adiciona:

- \`20261117112500_atomic_budget_save.sql\`: função \`save_budget_atomic\` com \`SECURITY INVOKER\`, para respeitar RLS.
- \`20261117114500_profiles_and_privilege_guard.sql\`: campos de perfil e proteção contra autoatribuição de cargos, permissões e empresas.

Se a migração transacional não estiver instalada, a gravação de orçamentos devolve um erro explícito em vez de apagar os itens existentes.

**Limites importantes:** este protótipo não teve ainda uma auditoria integral às políticas RLS de empresas, perfis e equipas, nem testes de concorrência e recuperação numa base de dados real. As migrações não são aplicadas pelo CI; para publicar comercialmente é preciso testar persistência, permissões e MFA no Supabase real.

## Modo demonstração

O modo demo apresenta contas e dados fictícios, identificados no ecrã. Pode criar/editar orçamentos de exemplo no armazenamento local do navegador; não deve introduzir dados de clientes reais. O registo de novas contas e as alterações ao perfil real ficam indisponíveis sem ligação ao Supabase.

## Próximos passos antes do lançamento

1. Rever e testar RLS por empresa e função (incluindo o papel \`company_admin\`).
2. Implementar testes transacionais com Supabase de testes e autenticações de perfis diferentes.
3. Validar o percurso criar → editar → guardar → reabrir → exportar, incluindo falhas de rede.
4. Testar em telemóvel, leitores de ecrã e navegadores principais.
5. Confirmar políticas de privacidade, backups, emails e gestão de sessões.

[Projeto original criado no Bolt](https://bolt.new/~/sb1-nx7spfpk).
