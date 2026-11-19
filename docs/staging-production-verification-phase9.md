# Tercis — Validação de infraestrutura externa (ronda 9)

**Dependência:** PR #11 e anteriores. **Esta branch não faz deploy, não cria projetos Supabase e não altera dados de produção.**

## Estado verificável

| Tema | Automação adicionada | Prova que falta no ambiente real |
|---|---|---|
| Supabase Auth + MFA + RLS | `tercis-staging.yml`: contas reais, duas organizações, TOTP AAL2, ficheiro privado previamente classificado `clean` | Executar num projeto de staging com contas e anexo de teste e confirmar sucesso |
| Storage em quarentena | Policy `20261117217000_storage_upload_quarantine_compatibility.sql`: downloads/listagens apenas para `clean` e operação API autorizada | Upload `upsert:false`, leitura antes/depois do scan, teste EICAR, cliente e tenant B negados |
| Quatro Edge Functions | `scripts/staging-service-preflight.mjs` verifica endpoints implementados e rejeição HTTP 401 de pedidos sem credencial | Instalar e ligar scanner, worker Resend, webhook e health; executar o preflight real |
| Restauro Storage | `staging-storage-recovery.mjs`: ler fixture do staging A, copiar para staging recovery B, comparar SHA256, eliminar cópia | Configurar **dois projetos independentes**, executar o workflow e rever o resultado |
| Backups base SQL | Teste `verify-backup-restore.sh` em segundo PostgreSQL isolado | Ensaio de restauro PostgreSQL/Supabase gerido, PITR e dados de Auth numa instância de recuperação distinta |
| Carga de 30 utilizadores | `staging-browser-load.py`: 30 contas distintas, 30 browser contexts, recarregamento em simultâneo e latência p50/p95 | Executar no frontend HTTPS de staging e medir API, logs, CPU/RAM e taxa de erro |
| Resend | Worker e webhook existentes, script de preflight de rejeição sem credenciais | Configurar domínio verificado, Resend API key, webhook e agendador; enviar email real e confirmar `delivered` |
| Monitorização | Health/alert Edge Function e cron de staging já preparados | Configurar webhook de alertas HTTPS, confirmar entrega de alertas e deduplicação/escalação |

## Sequência prática recomendada

1. Criar **dois projetos Supabase completamente separados**: `tercis-staging` e `tercis-staging-restore`. Nunca usar dados reais sem anonimização. Utilizar GitHub Environment `staging` com aprovação manual.
2. Rever e aplicar todas as migrações encadeadas no projeto staging com cópia de dados de teste. Confirmar que o bucket privado `tercis-private-attachments` está privado, com limites e RLS aplicados.
3. Preparar três identidades de teste: administrador A com TOTP, cliente A e administrador B (organização distinta) com TOTP, além de **30 contas de teste distintas** para a prova de carga.
4. Instalar o gateway ClamAV em infraestrutura isolada com HTTPS e segredo forte, ligá-lo à `attachment-scan-worker`, confirmar atualização de assinaturas e validar EICAR inofensivo. Não promover um ficheiro pendente manualmente.
5. Configurar Resend com domínio remetente autenticado, webhook Svix, `EMAIL_WORKER_SECRET` e agendador de staging. Validar email aceite vs entregue, bounce, perda de rede e webhooks fora de ordem; mensagens de teste apenas para endereços de ensaio.
6. Executar no GitHub, por esta ordem: **Tercis Supabase staging verification**, **Tercis isolated Supabase Storage recovery drill**, **Tercis real 30-user staging browser test**. Os workflows são manuais e só funcionam com segredos e projeto autorizados.
7. Configurar `OPS_ALERT_WEBHOOK_URL` e testar alerta de fila parada, scanner indisponível e erro na confirmação de entrega, sem expor dados pessoais em logs.
8. Executar backup/restauro da **base de dados** numa instância Supabase independente (incluindo políticas, perfis e migrações), e conferir separadamente todos os objetos do **Storage**. O ensaio de um só ficheiro **não é um backup integral**.
9. Só depois marcar os testes como aprovados e solicitar revisão independente da segurança, RGPD, isolamento multiempresa e um plano de rollback ensaiado.

### Segredos adicionais (apenas GitHub Environment staging)

**Browser load:** `TERCIS_STAGING_APP_URL`, `TERCIS_STAGING_APP_HOST`, `TERCIS_STAGING_LOAD_USERS_JSON` (array JSON com exatamente 30 pares de credenciais de teste; cada conta diferente). O hostname do URL deve corresponder exatamente ao autorizado no workflow.

**Recuperação Storage:** `TERCIS_STAGING_SERVICE_ROLE_KEY`, `TERCIS_RECOVERY_STAGING_URL`, `TERCIS_RECOVERY_STAGING_PROJECT_REF`, `TERCIS_RECOVERY_STAGING_SERVICE_ROLE_KEY`. O operador tem de confirmar explicitamente os **dois project refs**, diferentes. As chaves service role nunca entram no Vite, frontend nem logs.

**Preflight:** `TERCIS_STAGING_PROJECT_REF` e `TERCIS_STAGING_URL`. Os pedidos sem autorização devem devolver **HTTP 401** nas funções `quote-email-worker`, `quote-email-webhook`, `attachment-scan-worker` e `operations-health`; 404/500 significa indisponibilidade ou erro de configuração.

### Limites importantes

- Supabase Storage: o upload com `upsert:false` depende de INSERT, não de SELECT, pelo que não foi criada uma política de leitura de ficheiros pendentes para suportar uploads.
- O novo RLS utiliza `storage.allow_any_operation` para autorizar apenas métodos de listagem e download, mantendo o scanner como autoridade para libertar ficheiros.
- Testes no PostgreSQL 16 isolado são úteis, mas não reproduzem toda a API real de Supabase Storage.
- O script de carga usa **30 contextos autenticados**, não 30 máquinas físicas e não mede diretamente a ocupação de CPU/RAM do servidor. É um teste de experiência, não um benchmark definitivo de produção.
- O drill de Storage valida a recuperação de **um objeto de teste**. Os restantes objetos, backups reais, o PITR, auth e rotinas de retenção exigem procedimentos separados.
- O agendador de staging no GitHub só terá cron operacional quando o workflow estiver no ramo principal e os segredos aprovados. **Não transportar as chaves de staging ou de produção para commits.**
- Esta ronda não instalou infraestrutura externa nem realizou operações sobre um Supabase real, ClamAV real ou Resend real.

## Decisão de lançamento

A release multiempresa fica **bloqueada** até existir evidência assinada/guardada de todas as verificações de staging, recuperação, scanner, email e carga no ambiente de destino. Não basta ver o CI verde no GitHub.
