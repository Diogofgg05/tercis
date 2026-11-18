# TERCIS — Bloqueadores críticos e condições de lançamento (ronda 19)

**Estado: REPROVADO / NÃO PUBLICAR.** A branch é uma candidata integrada de código, não um deploy nem uma aprovação de segurança. A `main` e o Supabase de produção não foram alterados.

## Integração
- Esta branch incorpora, por ancestralidade Git, o código dos PRs #13→#14→#15→#16→#17→#18, além dos controlos da ronda 19.
- Abrir **um único PR de release para main**, sem aplicar de novo os PRs antigos à main (evita duplicar alterações).
- A pipeline de pull request deve completar: typecheck, lint, npm audit, build, browser smoke, migrações PostgreSQL, RLS, testes de restauração isolados e 30 leitores.
- Não efectuar merge até existir revisão independente, provas de staging e plano de rollback. A infraestrutura de regras/proteções obrigatórias do GitHub tem de ser configurada pelo proprietário do repositório.

## Evidência P0 obrigatória, toda em staging **real**
| Gate | Como verificar | Estado |
|---|---|---|
| Supabase Auth/RLS/MFA (duas organizações) | `Tercis Supabase staging verification`; credenciais de teste A/B; TOTP AAL2; RLS e Storage | **Por executar** |
| ClamAV | `Tercis live staging ClamAV safety verification`; 401 sem segredo, `clean` com ficheiro inofensivo, `infected` com EICAR | **Por executar** |
| Scanner/quarentena Storage | Upload de teste pendente → sem download → EICAR bloqueado / seguro libertado pelo worker; confirmar logs e políticas reais | **Por executar** |
| Resend | Confirmar domínio, webhook Svix, SMTP/API, email teste delivered, bounce, retries sem duplicação | **Por executar** |
| Backup integral + Auth + Storage | Restaurar snapshot completo para projeto independente; `Tercis full staging recovery verification` verifica todas as tabelas e objetos | **Por executar** |
| Monitorização/alertas | Forçar avaria de teste, garantir webhook recebido e escalonamento | **Por executar** |
| 30 sessões browser | `Tercis real 30-user staging browser test` com 30 contas distintas, medir p50/p95, erros 5xx | **Por executar** |
| Segurança independente e RGPD | Revisão de SQL `SECURITY DEFINER`, RLS, Auth, segredos, Storage, consentimento e retenção | **Por executar** |
| Rollback ensaiado | Preservar backup consistente; ensaiar reversão em ambiente isolado e definir RPO/RTO | **Por executar** |

**Nota:** todos os workflows de staging são manuais ou dependem de ambiente protegido e segredos configurados. Não foram executados nesta ronda. Não apontar URLs ou tokens de produção aos scripts.

## Correções P0 implementadas em código
- `scripts/staging-smoke.mjs`: origem Supabase estritamente igual a `https://<project-ref>.supabase.co` em vez de simples `includes`. Isso previne envio de credenciais de staging para domínios parecidos.
- `scripts/staging-clamav-smoke.mjs`: teste real de gateway HTTPS, token inválido, ficheiro seguro, amostra EICAR; sem carregar ficheiros no Supabase.
- `scripts/staging-full-db-recovery-audit.sh`: auditoria de igualdade de **todas** as tabelas de aplicação/Auth/metadados de Storage e políticas RLS nos dois PostgreSQL de staging. Só aceita hosts DB associados aos refs confirmados. É leitura, não executa restauro.
- `scripts/staging-full-storage-recovery-audit.mjs`: compara buckets privados/públicos, todos os caminhos e SHA-256 de cada objeto; limites conservadores e reprovação se não existirem objetos para verificar.
- Dois novos workflows de staging: segurança de ClamAV, auditoria após restauro integral.
- CI também valida a sintaxe dos scripts e é acionado em PRs para `main`.

## Limitações da prova
- O relatório de restauração compara o **estado atual** dos projetos; garantir previamente que a origem foi congelada e o destino restaurado a partir do mesmo snapshot. Uma diferença significa falha; igualdade por si só não certifica PITR, retenção, RPO/RTO, resiliência de segredos ou serviços externos.
- O auditor de Storage limita-se aos objetos que a API consegue listar e descarregar; qualquer erro ou exceder o limite obriga a reprovar e repetir a prova com recursos apropriados.
- A correção do origin-check não substitui segurança de DNS/TLS, segregação de ambiente e rotação de segredos.
- CI verde em PostgreSQL e Playwright demo **não** aprova publicação. Sem provas externas, a decisão continua `NO-GO`.

## Checklist antes de autorizar merge
1. Fornecer uma referência da release e migrações exatas, registar revisão de código e aprovação do responsável.
2. Criar projeto staging + projeto recovery distintos e carregar somente dados artificiais.
3. Aplicar migrações numa instância de staging nova, testar RLS e MFA reais.
4. Configurar ClamAV, Resend, observabilidade e segredos apenas no GitHub Environment `staging`.
5. Executar os novos workflows e os testes staging anteriores; guardar os URLs dos runs aprovados.
6. Restaurar independentemente dados SQL/Auth/Storage; executar auditoria após restauro e conservar a prova.
7. Validar performance, segurança independente, plano RGPD, resposta a incidentes e rollback.
8. Obter autorização explícita do proprietário e só depois considerar integrar o PR consolidado na `main`; deploy separado com backup prévio.
