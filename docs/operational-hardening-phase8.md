# Tercis — ronda 8: operações, antimalware, recuperação e desempenho

**Estado:** alterações de código na branch `feat/tercis-operational-hardening`, dependentes do PR #10. Não foram instaladas no Supabase de produção nem em staging.

## 1. Quarentena obrigatória de anexos

`20261117214000_attachment_antivirus_quarantine.sql` cria o ciclo:

`pending` → `scanning` → `clean` | `infected` | `error`

- O upload autenticado guarda os ficheiros no bucket **privado** preexistente e regista metadados com `scan_status=pending`.
- Uma política RLS de `storage.objects` exige **scan_status=clean** antes de autorizar leitura/download. Clientes e utilizadores de outra organização continuam impedidos.
- O estado não pode ser falsificado pelos utilizadores; apenas o serviço com `service_role` pode reclamar e concluir análises.
- O scanner regressa a `pending`? **Não.** Erros ficam em `error` e podem ser reanalisados até 3 tentativas; ficheiros infetados permanecem bloqueados.
- O worker `supabase/functions/attachment-scan-worker/index.ts` baixa a cópia original com credencial de serviço, valida tamanho e assinatura do formato e envia os bytes para um **gateway ClamAV privado** através de HTTPS autenticado. Uma análise só é aprovada quando recebe o resultado explícito `{engine:"clamav",status:"clean"}`.
- O gateway `scripts/clamav-gateway.mjs` implementa o protocolo `clamd INSTREAM`, com limites de tamanho, autenticação e timeout. `deploy/clamav/compose.yaml` disponibiliza uma referência de implantação; **não publica o clamd na Internet**.
- Na interface, os estados de quarentena são visíveis e o botão de download permanece desativado até `clean`.

### Como instalar o scanner em staging

1. Numa VM/servidor controlado, colocar `CLAMAV_GATEWAY_SECRET` (aleatório e pelo menos 32 caracteres) numa variável de ambiente **não versionada**. Executar `docker compose -f deploy/clamav/compose.yaml up -d --build`.
2. Confirmar que o ClamAV atualizou as assinaturas e que o serviço interno responde. Configurar um proxy TLS para `http://127.0.0.1:8787/scan`, com hostname conhecido, HTTPS válido, controlo de acesso e sem proxy aberto para outros paths. A Edge Function Supabase precisa de conseguir contactar esse hostname por HTTPS.
3. Definir segredos da Edge Function: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLAMAV_GATEWAY_URL` (URL HTTPS completa até `/scan`), `CLAMAV_GATEWAY_SECRET` e `ATTACHMENT_SCAN_WORKER_SECRET`.
4. Publicar `attachment-scan-worker` com autenticação própria conforme `supabase/config.toml`. O header `x-tercis-worker-secret` deve vir **apenas** do agendador confiável.
5. Ensaiar upload de PDF válido, PNG válido e teste EICAR **inofensivo** em staging. Confirmar que um ficheiro em quarentena não pode ser descarregado pelo uploader, que EICAR é marcado `infected` e que o ficheiro de teste limpo fica `clean` e pode ser descarregado apenas pela equipa autorizada.
6. Verificar falhas: ClamAV desligado, assinatura de formato inválida, timeout, gateway inacessível, scanner sem atualizações e rejeição por outra organização. Nesses cenários os ficheiros **não** podem tornar-se públicos.

**Não foi executado um ClamAV real nesta conversa.** O CI valida as regras PostgreSQL/RLS, não substitui a análise de ficheiros e rede reais.

## 2. Paginação e pesquisa comerciais completas

A nova RPC `tercis_catalog_page(query,category,page,page_size,sector)` é `SECURITY INVOKER`, usa RLS e devolve JSON com `items`, `total`, `page`, `page_size`; máximo de 100 linhas por pedido.

- O ecrã Catálogo pesquisa no PostgreSQL por código, descrição, referência e marca, com categorias obtidas numa RPC separada e páginas reais de 20 artigos.
- O editor procura no servidor por texto e setor (até 100 resultados por pesquisa, com debounce), sem depender dos 500 primeiros artigos.
- A demonstração permanece separada dos preços comerciais; não há fallback para custos fictícios em produção.
- `tests/sql/catalog_server_pagination_regression.sql` testa **525 artigos** e impede fuga entre organizações ou a clientes.
- Para milhões de artigos, é necessário medir índices e considerar `pg_trgm`/pesquisa especializada; filtros `ILIKE '%...%'` não são ideais nessa dimensão.

## 3. Backup e restauração

`scripts/verify-backup-restore.sh` executa no GitHub Actions com PostgreSQL 16 **isolado**:

1. `pg_dump` de todas as tabelas e políticas de testes para um ficheiro temporário no runner.
2. Criação de uma **segunda base** `tercis_restored_ci`, sem tocar na original.
3. Restauro completo do dump, verificação de contagens em tabelas importantes, perfis, linhas, versões, auditorias e emails, e comparação de identidade/versões dos orçamentos.
4. Eliminação do ficheiro temporário ao terminar o job.

Esta prova **não valida os backups geridos pelo Supabase**, armazenamento de ficheiros, point-in-time recovery ou o RPO/RTO do ambiente real. Não enviar dumps reais para artefactos GitHub. A recuperação real exige uma instância isolada, permissões e inventário de objetos Storage, mais ensaios com restauração de dados anonimizados.

## 4. Monitorização e alertas

`tercis_operational_health()` é acessível **apenas por service_role**, devolvendo contadores agregados sem emails, clientes nem paths:

- fila de emails atrasados, workers de email bloqueados;
- anexos pendentes demasiado tempo, scans presos, erros de antivírus;
- deteção de malware, emails devolvidos e anexos órfãos antigos.

A Edge Function `operations-health` recebe um segredo de scheduler, consulta esses indicadores e, quando há valores positivos, envia alerta via webhook HTTPS configurado por `OPS_ALERT_WEBHOOK_URL`. Os alertas não se enviam sem webhook/segredos; é necessário confirmar no sistema escolhido (Slack/Teams/serviço compatível) o formato da mensagem e definir a política de repetição/escalamento.

## 5. Testes concorrentes

O workflow principal testa 30 clientes PostgreSQL concorrentes usando `pgbench` durante 12 segundos, com consulta de orçamentos, custos protegidos e fila de emails. **Não** equivale a 30 browsers ou 30 sessões de autenticação Supabase reais. Para lançamento: medir tempos p95/p99, TTFB, latência de UI, concorrência em gravação e limites do plano Supabase.

## 6. Staging real e agendadores

O workflow existente `tercis-staging.yml` verifica autenticação real, MFA/AAL2, leitura de anexos privados e isolamento entre duas organizações **desde que existam** as respetivas contas, ficheiros e secrets numa GitHub Environment `staging`. Não pode ser executado sem essa configuração.

O novo `tercis-staging-workers.yml` prepara chamadas de scanner, worker Resend e monitorização a cada 15 minutos (GitHub cron executa-se apenas quando o workflow estiver no ramo principal e os segredos estiverem presentes). O workflow recusa alvos cuja URL não corresponde exatamente ao identificador de projeto de staging configurado. Configurar em staging:

- `TERCIS_STAGING_URL`, `TERCIS_STAGING_PROJECT_REF`;
- `ATTACHMENT_SCAN_WORKER_SECRET`, `EMAIL_WORKER_SECRET`, `OPS_HEALTH_WORKER_SECRET`.

Configurar nas Edge Functions:

- scanner: `CLAMAV_GATEWAY_URL`, `CLAMAV_GATEWAY_SECRET`, `ATTACHMENT_SCAN_WORKER_SECRET`;
- emails: `RESEND_API_KEY`, `TERCIS_EMAIL_FROM` (domínio verificado), `TERCIS_APP_URL`, `EMAIL_WORKER_SECRET`, `RESEND_WEBHOOK_SECRET`;
- alertas: `OPS_HEALTH_WORKER_SECRET`, `OPS_ALERT_WEBHOOK_URL`;
- credenciais de serviço: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` **só nas funções do servidor**.

### Gate de publicação
Não lançar o Tercis multiempresa até:

- todas as migrações passarem em Supabase de staging com dados de teste;
- autenticação/Storage/ClamAV/EICAR/Resend/webhooks/RLS passarem em testes reais;
- backup Supabase+Storage ser restaurado com sucesso numa instância independente;
- serem medidos limites de concorrência da API e browser;
- revisões de segurança, RGPD, monitorização e plano de rollback estarem aprovados.

A `main` e a base de dados de produção não foram modificadas nesta ronda.
