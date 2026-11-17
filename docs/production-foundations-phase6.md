# Tercis — fundações de produção (PR dependente de #8)

**Não aplicar em produção sem ensaio completo em staging.** Este conjunto adiciona Storage privado, email em fila, arquivo, paginação e catálogo protegido. Migrações são cumulativas e exigem todos os PRs anteriores.

## 1. Supabase Storage privado

A migração `20261117209000_private_attachment_storage.sql` cria o bucket **privado** `tercis-private-attachments` com máximo 10 MB e tipos PDF, PNG, JPG, WebP, TXT.

- Caminhos imutáveis: `organization_id/budget_id/<uuid>-<filename>`
- RLS no `storage.objects` confere sessão, organização e permissão de equipa interna no orçamento.
- Clientes e o administrador da plataforma **não** acedem aos objetos. A coluna `visibility` de metadados é limitada a `internal`.
- O frontend usa upload autenticado e URLs assinadas de curta duração (60 segundos), nunca links públicos permanentes.
- A eliminação de ficheiros não é exposta na interface; é preciso desenhar política de retenção, revisão de versões, antivírus e limpeza de órfãos.
- Não existe ainda um fluxo de publicação de anexos para clientes. Os PDFs comerciais são enviados pelo email a partir dos dados comerciais e não expõem objetos privados.

**Staging obrigatório:** verificar políticas do Storage API com um administrador A, um colaborador interno atribuído, um cliente A, um administrador B e o papel app_admin. Confirmar que paths adivinhados devolvem 403/404 sem dados.

## 2. Catálogo comercial

`src/lib/commercialCatalog.ts` é a origem comum dos artigos e custos no editor e na página Catálogo. Em sessões reais lê **apenas** os artigos personalizados ativos da organização via Supabase com RLS. As referências e valores ilustrativos do código são apenas para demonstração offline.

**Limite conhecido:** por agora a consulta carrega os primeiros **500 artigos comerciais** e informa quando existem mais; é necessária pesquisa paginada server-side para catálogos maiores. Não assumir que o modo demonstração oferece preços confirmados.

## 3. Email com confirmação de entrega

`20261117211000_quote_email_delivery_outbox.sql` introduz a fila transacional `quote_email_outbox`.

Estados: `queued` → `processing` → `accepted` → `delivered`, ou `failed`/`bounced`.

- O administrador com MFA chama `tercis_queue_quote_email` para a **versão enviada atual**, confirmada por snapshot. A mesma combinação orçamento/versão/destinatário não é duplicada.
- `supabase/functions/quote-email-worker/index.ts` usa **Resend** e uma chave de serviço secreta para reclamar e enviar trabalhos, sem expor a chave à aplicação. O remetente tem de usar um domínio verificado.
- `supabase/functions/quote-email-webhook/index.ts` verifica HMAC/Svix (`svix-id`, `svix-timestamp`, `svix-signature`) e só depois altera estados com uma RPC idempotente. `accepted` **não** significa `delivered`.
- A fila e os estados são visíveis apenas a administradores da própria organização com AAL2.
- O worker **não funciona até ser instalado no Supabase**, serem definidos os segredos e um agendador fiável o invocar. A criação de um pedido só o coloca na fila.

### Segredos necessários — apenas Edge Functions / GitHub Environment

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (nunca no Vite / Git!)
- `RESEND_API_KEY`
- `TERCIS_EMAIL_FROM` (endereço de um domínio validado em Resend)
- `TERCIS_APP_URL`
- `EMAIL_WORKER_SECRET` (aleatório, longo)
- `RESEND_WEBHOOK_SECRET` (assinado pelo fornecedor, prefixo `whsec_`)

Executar `quote-email-worker` via agendador autorizado com o header `x-tercis-worker-secret`. Registar a URL da função `quote-email-webhook` no Resend com eventos `email.sent`, `email.delivered`, `email.bounced`, `email.failed`. A utilização repetida do mesmo id de outbox usa chave de idempotência no envio. **Nunca configurar uma chave de serviço no frontend**.

Em staging: testar receção real, falha de domínio, bounce, atraso do webhook, repetição de eventos, reinício do worker, falhas de API e limite de envio. O CI PostgreSQL apenas simula as transições no backend; não envia emails externos.

## 4. Arquivo reversível e auditado

`tercis_set_budget_archive(budget_id,expected_version,archive)` exige administrador da organização, MFA e versão atual. Não apaga dados; regista data/autor e produz `audit_logs`.

Na lista de orçamentos existe opção de arquivar, filtro «Mostrar arquivo» e recuperação. Propostas arquivadas não devem permitir alterações comerciais ou respostas até novo processo de publicação. A versão aumenta também ao recuperar. Verificar política de retenção antes de permitir remoções físicas.

## 5. Paginação e desempenho

A listagem de orçamentos de staff usa lotes de 100 no PostgREST, com «Carregar mais». O dashboard e CSV agora refletem **apenas os documentos carregados**: não representam todas as organizações/receitas. Uma solução completa precisa de paginação por cursor, agregações no servidor e limite server-side para empresas e perfis. O portal do cliente continua a ter o limite antigo do feed de 500 propostas.

## 6. Validação com Supabase real: preparar um staging isolado

1. Criar um projeto Supabase **de testes**, sem dados reais (ou com dados anonimizados), contas de teste dedicadas e TOTP verificado. Fazer snapshot/backup.
2. Rever e aplicar todas as migrações numa cópia isolada, **por ordem**, usando a pipeline interna da equipa; nunca executar as migrações sobre a produção apenas porque o CI passou.
3. Criar em staging uma organização, administrador com TOTP, cliente com email verificado e orçamento de exemplo enviado. Definir o ID desse orçamento como fixture.
4. Configurar as secrets da **GitHub Environment `staging`** usadas em `.github/workflows/tercis-staging.yml`: `TERCIS_STAGING_URL`, `TERCIS_STAGING_ANON_KEY`, `TERCIS_STAGING_PROJECT_REF`, `TERCIS_STAGING_ADMIN_EMAIL`, `TERCIS_STAGING_ADMIN_PASSWORD`, `TERCIS_STAGING_ADMIN_TOTP_BASE32`, `TERCIS_STAGING_CLIENT_EMAIL`, `TERCIS_STAGING_CLIENT_PASSWORD`, `TERCIS_STAGING_TEST_BUDGET_ID`, `TERCIS_STAGING_TEST_ORGANIZATION_ID`.
5. Lançar manualmente o workflow com o project ref de staging exato. Ele usa apenas a chave pública e credenciais das contas de teste. Os testes são **read-only**: login real, MFA/AAL2, RLS, privacidade de custos, Storage e feed do cliente.
6. Para testar uploads reais e webhooks, executar cenários adicionais manualmente ou com fixtures dedicadas. **Não afirmar que foram validados apenas com o PostgreSQL local.**
7. Criar plano de rollback testado, registos/alertas e revisão independente das políticas de segurança.

**Sem segredos ligados, não é possível executar esse workflow nesta conversa.** O workflow manual só fica disponível no GitHub quando o ficheiro existir na branch apropriada; a pipeline principal testa PostgreSQL isolado e o modo demonstração.

## Pendências de lançamento

Auditoria independente de isolamento entre tenants, uploads maliciosos/antivírus, controle de acesso a URLs assinadas, entrega real de email, monitorização, RGPD, backups/restauração, retenção/arquivo, pesquisa completa de catálogo, estatísticas de organizações, limites e plano de subscrição.
