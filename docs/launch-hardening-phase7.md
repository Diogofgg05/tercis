# Tercis — hardening da publicação e checklist de lançamento

**Branch:** `fix/tercis-launch-hardening`, dependente de `feat/tercis-production-foundations` (PR #9). Não houve deployment nem modificação da `main`.

## O que foi corrigido nesta ronda

### 1. Webhooks recebidos antes da resposta do trabalhador
- `20261117212000_delivery_webhook_race_fix.sql`: os eventos assinados do fornecedor passam a ser registados mesmo quando o seu `provider_id` ainda não existe no outbox.
- `tercis_register_quote_email_provider`: regista o ID retornado pela API Resend e aplica, na mesma transação, todos os eventos anteriormente recebidos.
- Events repetidos com o mesmo `event_id` são ignorados. Os estados `delivered` e `bounced` não regressam a `accepted` ou `failed` por eventos atrasados.
- Trabalhos que já têm `provider_id` não são reencaminhados para envio automático. O worker usa chave de idempotência no Resend; eventuais falhas de rede após envio continuam a exigir observabilidade e reconciliação.

### 2. Ficheiros privados órfãos
- `20261117213000_attachment_orphan_inventory.sql` lista apenas objetos do bucket Tercis com **mais de 48 horas** e sem metadados em `budget_attachments`, limitados a 50 por chamada.
- A função exige `service_role`; o cliente, colaborador e administrador via JWT normal não podem enumerar outros objetos.
- **Não apaga automaticamente**: a eliminação de Storage e a escrita dos metadados não formam uma só transação. Antes de automatizar, é preciso confirmar que não há um processo de upload ou recuperação ativo, rever retenção e garantir registo de auditoria.

### 3. Downloads em vez de URLs transportáveis
- `BudgetAttachments.tsx`: a equipa autorizada faz `storage.download` autenticado e o navegador descarrega o ficheiro localmente; deixou de abrir um URL assinado numa aba.
- Ações de download não tornam um ficheiro livre de malware. A validação MIME por cabeçalho/cliente **não é um scanner de vírus**. Um serviço de análise independente, quarentena de uploads e política de ficheiros maliciosos são requisitos para produção.

### 4. Staging com isolamento real
- O teste `scripts/staging-smoke.mjs` agora exige duas organizações independentes com administradores reais e TOTP/AAL2 e um ficheiro privado existente na organização A.
- Valida leitura legítima desse ficheiro pela organização A; nega leitura ao cliente A e à organização B, além de verificar a privacidade de custos e outbox.
- O workflow `tercis-staging.yml` recebe os nomes dos segredos necessários na GitHub Environment `staging`; não são colocados no repositório.

### 5. Deploy de Edge Functions e webhook
- `supabase/config.toml`: `verify_jwt = false` **apenas** para `quote-email-worker` (segredo próprio de agendamento) e `quote-email-webhook` (assinatura HMAC/Svix verificada).
- O endpoint do worker deve ser invocado por um agendador confiável, com `EMAIL_WORKER_SECRET`, URL e remetente Resend validados. O webhook precisa da secret `RESEND_WEBHOOK_SECRET` no ambiente Supabase.
- Uma execução local de CI **não** envia emails, não exercita as APIs do Resend e não prova entregabilidade.

## Verificações obrigatórias para aceitar a publicação

| Área | Evidência mínima |
|---|---|
| Migrações | Aplicar TODAS as migrações numa cópia de staging, sem erros, com dados anteriores anonimizados. Confirmar backup e ensaio de restauração |
| Organizações | Admin A e admin B com TOTP; cliente A. Verificar acesso proibido de B a orçamentos e ficheiros de A |
| Storage | Upload real de um PDF de teste de 1–10 MB; download por staff A; erro de acesso por cliente A e staff B; política de limpeza com auditoria |
| Antivírus | Scanner/quarentena e testes com conteúdo malicioso inofensivo; sem publicação até ficar operacional |
| Emails | Email enviado por Resend com domínio verificado; distinguir aceite de entregue; simular webhook antes/depois da resposta, duplicados, bounce e timeout |
| Arquivo | Arquivar e recuperar com admin AAL2; confirmar versões e auditoria e impossibilidade de editar enquanto arquivado |
| Desempenho | Dataset de milhares de orçamentos e artigos; testes concorrentes; índices medidos com `EXPLAIN ANALYZE` |
| Privacidade | Confirmar RGPD, política de retenção e pedidos de acesso/eliminação sem destruir dados contabilísticos que têm retenção legal |
| Observabilidade | Alertas de fila parada, falha de webhooks, falhas de upload, erros 5xx, expiração de segredos e backups |
| Releases | PRs encadeados revistos e integrados com CI verde; staging validado; release versionada e procedimento de reversão ensaiado |

### Segredos adicionais de staging

Além dos já especificados em `docs/production-foundations-phase6.md`, preparar:
- `TERCIS_STAGING_TEST_PRIVATE_FILE_PATH`
- `TERCIS_STAGING_OTHER_ORGANIZATION_ID`
- `TERCIS_STAGING_OTHER_ADMIN_EMAIL`
- `TERCIS_STAGING_OTHER_ADMIN_PASSWORD`
- `TERCIS_STAGING_OTHER_ADMIN_TOTP_BASE32`

A função de staging é **read-only** exceto pelos próprios logins e operações MFA. Não fornecer quaisquer credenciais reais de produção.

## Limites que esta ronda NÃO removeu

1. Catálogo ainda mostra só as primeiras 500 referências comerciais e não dispõe de paginação por cursor para pesquisas de grande volume.
2. Agendamento de envios, configuração do Resend, backups e scanner malware precisam de infraestrutura operacional, que o código por si não cria.
3. Relatórios e dashboards são baseados no que o frontend carregou (incluindo lotes de 100), pelo que não são estatísticas globais.
4. É necessária uma revisão externa de segurança antes de clientes reais utilizarem a plataforma.
