# Tercis — Auditoria atualizada e pendências para lançamento

**Data:** 18-11-2026. **Branch de trabalho:** `feat/tercis-business-completion`, baseada na release integrada `release/tercis-integrated-hardening` (PR #13). Esta branch **não** modifica a main ou dados de produção.

## O que foi efetivamente implementado nesta ronda

| Área | Correção | Evidência automatizada |
|---|---|---|
| Relatórios | SQL `tercis_report_summary` agregado sobre TODOS os orçamentos autorizados, com meses, estados, clientes, filtro e cálculo do volume | `full_reports_regression.sql`, CI PostgreSQL |
| Mensagens | Notas de equipa exclusivamente internas, escritas via RPC auditada com controlo de organização, papel, atribuição, arquivo e tamanho | `internal_messages_regression.sql`, CI |
| Convites | Administrador AAL2 revoga por email todos os tokens pendentes, com auditoria e impedimento de reutilização; nunca enumera tokens | `revoke_invitations_regression.sql`, CI |
| Catálogo | Histórico privado de alterações ao custo de aquisição e fornecedor, visível aos administradores do tenant | `catalog_price_history_regression.sql`, CI |
| Importação de catálogo | CSV com campos/custos validados, máximo de 100 artigos por lote, transação única, substituição por código dentro do tenant, registo de auditoria e preços anteriores mantidos | `catalog_csv_import_regression.sql` e teste do parser em Playwright |
| Segurança | Teste que verifica privilégios SQL de funções reservadas ao serviço e a utilizadores específicos | `privileged_rpc_surface_regression.sql`, CI |

**Nenhuma destas funcionalidades deve ser considerada testada com um Supabase real até o staging ser configurado.** As migrações foram executadas em PostgreSQL isolado.

## Pendências P0 — bloqueiam a publicação

1. **Integrar a release:** rever PR #13 e este PR; integrar mudanças numa branch de release validada e, com autorização e revisão, na main. Não misturar o merge da release integrada com o merge separado dos PRs #1–#12, para evitar duplicações/conflitos.
2. **Supabase real:** aplicar migrações num staging novo, testar RLS com duas organizações e identidades reais, MFA TOTP AAL2, pagamentos/segredos, limites e políticas de Storage; registar logs e provas. Não usar contas de produção.
3. **ClamAV real:** provisionar o clamd+gateway HTTPS, credenciais e rede privada, atualizações de assinaturas, teste EICAR inofensivo, erros, timeouts, quarentena/retentativas e revogação. Sem teste real, a política continuará a bloquear anexos.
4. **Resend real:** autenticar domínio DNS, configurar FROM/API key, webhooks assinados e agendador; verificar envio real a uma caixa de teste, idempotência, bouncing, webhook antes/depois do worker, timeouts e entrega.
5. **Recuperação integral:** restaurar backup da base Supabase + Auth + todos os ficheiros de Storage para ambiente independente; testar consistência, RPO/RTO e restauração de permissões/políticas. O teste isolado atual e a cópia de um objeto não bastam.
6. **Observabilidade:** ligar webhook de alertas, regras de limiar, deduplicação/escalação, logs com proteção de PII, incidentes e responsáveis. Confirmar alertas recebidos, não apenas preparados.
7. **Segurança independente:** auditoria RLS/RPC `SECURITY DEFINER`, pen-test, validação de cross-tenant, revisão de segredos, gestão de permissões, uploads e RGPD.
8. **Carga e UX reais:** executar 30 sessões distintas no frontend e API Supabase, verificar p95/p99, carga de gravação simultânea, limites e browsers móveis.

## Pendências P1 — funcionalidades e consistência

1. **Dinheiro:** migrar cálculos de `number` JavaScript para decimal/fixed-point testado, igual ao PostgreSQL `numeric`; definir regras de moeda, desconto, IVA, linhas e arredondamento para valores extremos.
2. **Numeração comercial:** sequência segura e transacional por organização/ano; evitar depender de `max` no cliente, mesmo com sufixo UUID; lock e formato legal dependem de requisitos contratuais.
3. **PDF de proposta:** documento final imutável, gerado a partir da versão publicada/snapshot, com identidade visual, condições de pagamento, validade e hash verificável. Não expor dados internos.
4. **Histórico comercial:** versionamento de revisões, comparação de propostas, aceitação formal, trilho de auditoria, vencimentos e eventual assinatura eletrónica.
5. **Comunicação:** desenvolver canal bidirecional **cliente-equipa** com mensagens e anexos publicados, políticas explícitas de visibilidade e limites; manter notas internas isoladas. Notificações, indicador de leitura e paginação por conversa.
6. **Convites por email:** envio autenticado, confirmação de entrega, reenvio seguro e convite sem expor token ao administrador, além da revogação agora implementada.
7. **Catálogo profissional:** suporte Excel/XLSX, validação de centenas/milhares de artigos por jobs em lotes, pré-visualização, reconciliação, erros por linha, histórico de fornecedor e listas de compras.
8. **CRM multiempresa:** empresa A cliente de B e fornecedora de C com ligações/roles por organização, sem conceder visibilidade cruzada automática.
9. **Fornecedores/compras:** diretório de fornecedores, condições de compra, stock, requisições, encomendas, receções e comparação de custos.
10. **Relatórios exportáveis:** agora agregados no SQL; falta CSV/Excel/PDF de relatório integral e separação explícita de faturação, pagamentos e propostas.
11. **Pesquisas escaláveis:** substituir paginação SQL `OFFSET` por cursor em orçamentos e catálogo, cache invalidation, índices e medição real; paginar clientes e equipas independentemente da lista de propostas.
12. **Anexos:** limpeza automática de órfãos com dry run, logs/retentativas, políticas de retenção, versões e scanner em produção. O inventário seguro existente não apaga.
13. **Contas:** concluir recuperação de MFA, revogação de sessões, dispositivos, fluxos de recuperação de palavra-passe em staging, limites antifraude e auditorias.
14. **UX:** testes de navegação com alterações por guardar, erro/offline, feedback de gravação, atualizações em tempo real, estados de loading, acessibilidade teclado/leitores de ecrã, contraste, mobile e diferentes browsers.
15. **SaaS comercial:** planos, subscrições Stripe, cobrança/faturas, trial, limites por organização, trial expiry, suspensão segura e suporte. Não ativar pagamentos sem revisão.
16. **Qualidade de engenharia:** testes unitários para todos os cálculos, property-based tests, simulações de concorrência em SQL e browsers, testes contratuais de Supabase Edge Functions e testes de migração com dados antigos.

## P2 — evolução comercial posterior
- Dashboards de direção e gestão de projetos, tarefas e aprovações;
- Workflow de fornecedores e compras integrável a ERP;
- Catálogo de modelos de orçamento e identidade visual por organização;
- Alertas e automatizações de propostas prestes a expirar;
- Métricas de negócio e experiência com consentimento/privacidade.

## Regras de publicação
- A pipeline isolada verde **não** aprova produção.
- O registo das validações de staging deve identificar data, versão, projeto, prova, responsável e resultado.
- Testar migrations com cópia anonimizável e procedimento de rollback.
- Exigir revisão de segurança e planear resposta a incidentes antes de admitir clientes empresariais.
- PRs ficam em rascunho; não alterar main nem configurar segredos externos sem ação explícita do proprietário.
