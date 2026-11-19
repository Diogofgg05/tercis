# TERCIS — Ronda 20: integridade dos anexos e scanner concorrente

**Estado:** branch de desenvolvimento; testes automatizados SQL não substituem validações de staging. Não publicar nem aplicar à produção sem plano operacional. PR de release consolidada #19 permanece em rascunho.

## Vulnerabilidades corrigidas
1. **Troca do conteúdo após veredito limpo.** Antes, um uploader podia apagar o objeto em `storage.objects` e voltar a carregar bytes diferentes no mesmo caminho onde `budget_attachments.scan_status='clean'` continuava válido. A migração `20261117230000_immutable_scanned_objects_and_attempt_tokens.sql` revoga a política de eliminação para utilizadores autenticados e acrescenta uma política `RESTRICTIVE` de `DELETE` sobre o bucket privado. O caminho aprovado torna-se imutável para membros da equipa; a manutenção de órfãos deve ser executada por um serviço independente, auditado e autorizado.
2. **Resposta ClamAV atrasada.** O token monotónico `scan_attempts` é devolvido por `tercis_claim_attachment_scans_v2` e exigido por `tercis_complete_attachment_scan_v2`. A conclusão só altera a linha se corresponder à tentativa ainda em `scanning`. Uma resposta antiga não pode tornar `clean` um anexo que outro worker voltou a reclamar. O worker da Edge Function usa os dois endpoints novos e ignora conclusões obsoletas.
3. **Endpoints sem token.** Os dois RPCs antigos foram desativados por defeito e perderam os privilégios SQL. Uma versão antiga do worker falha em modo fechado, sem aprovar ficheiros. É necessário coordenar migração, deploy de worker e retomar jobs num período controlado.
4. **Erro de upload parcial.** A interface deixa de tentar eliminar o objeto pelo cliente após falha no INSERT de metadados; informa que o ficheiro continua em quarentena e necessita de reconciliação pela manutenção. O inventário de órfãos existente (48 h) continua **sem eliminação automática**.

## Provas automatizadas
- `tests/sql/scanner_attempt_immutability_regression.sql`: simula ficheiro seguro, tenta a eliminação autenticada, simula timeout do scanner com permissões do dono do banco de teste, valida que a conclusão atrasada não se aplica e que a tentativa atual assinala ficheiro infetado. Confirma que o RPC legado não permite bypass.
- `tests/sql/antivirus_quarantine_regression.sql`: agora usa RPCs `v2`; mantém testes de quarentena de ficheiros pendentes, infetados, limpos e operações Storage.
- `tests/sql/privileged_rpc_surface_regression.sql`: abrange privilégios SQL de `v2`.
- Workflow de CI executa essas regressões no PostgreSQL isolado.

## Procedimento obrigatório de staging (ainda não realizado)
1. Reproduzir o ambiente de teste com duas empresas e um anexo de teste **não sensível**; fazer backup do staging.
2. Aplicar a nova migração e, na mesma janela de manutenção, fazer deploy da Edge Function `attachment-scan-worker` atualizada. Durante a transição, uploads devem permanecer em quarentena.
3. Criar novo anexo por upload real; verificar que está `pending`, sem download. Digitalizar com ClamAV e confirmar autorização apenas após veredito `clean`.
4. Tentar apagar e substituir o objeto pela API Storage usando um utilizador autenticado; ambos devem ser recusados. Testar outro tenant e cliente.
5. Simular scanner indisponível, timeout e dois workers concorrentes. O erro deve permanecer fechado e o resultado mais antigo nunca deve substituir a tentativa atual.
6. Medir fila, alertas de scanner e inventário de órfãos. Definir limpeza pelo serviço com **dry-run, revisão humana, retenção e registo de auditoria**; não confiar em permissões de cliente para limpeza.
7. Só depois considerar aprovar o PR consolidado, juntamente com MFA, RLS, emails, backups e testes de carga da checklist P0.

**Notas:** uma migração SQL não configura por si só ClamAV, SSL do gateway, segredos, Supabase real ou workers. O controlo de imutabilidade depende de as políticas de Storage reais coincidirem com os testes isolados.
