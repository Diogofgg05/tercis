# Tercis — fase 15: exportação completa, referências transacionais e sessões

**Estado:** desenvolvimento no branch `feat/tercis-release-readiness-phase15`, dependente do PR #14, por sua vez dependente do PR #13. Sem alteração à `main`, a produção ou aos secrets.

## Implementado nesta fase

1. **Exportação integral de propostas em CSV.** A nova RPC `tercis_export_budget_csv_rows` produz a lista **completa** de propostas para a pesquisa/estado/arquivo escolhidos, com o total calculado no servidor e filtrado pelas políticas RLS. Não usa os primeiros 100 documentos do browser. Máximo de 5000 registos por exportação; se ultrapassar, informa que é preciso restringir filtros. O CSV trata tentativas de formula injection com o escaping já existente. O ecrã utiliza `onExportAll` em modo real e mantém exportação local no demo. Teste SQL `complete_csv_export_regression.sql` prova filtros, contagem e isolamento do cliente/tenant B.
2. **Numeração sequencial por empresa e ano.** `tercis_quote_reference_counters` é uma tabela privada por `organization_id`+ano; a transação aloca o número com `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, com lock transacional. Referências existentes são usadas para inicializar o contador, sem renumerar documentos antigos. O gatilho aplica-se **apenas** às referências temporárias no formato `ORC-AAAA-NNNN-XXXXXX` criadas pelo browser; referências legadas ficam intactas. A nova RPC `save_budget_atomic_with_ref` devolve id, versão e referência oficial no mesmo commit. Um segundo gatilho impede que utilizadores autenticados mudem uma referência já atribuída. Teste `quote_reference_sequence_regression.sql` cobre criação, numeração e imutabilidade. **Nota:** a alocação transacional não garante sequências sem falhas após eliminações de propostas; avaliar política empresarial e legal de numeração antes de a utilizar em faturação. Também não é um sistema de faturas fiscal.
3. **Gestão de sessões:** em Definições > Segurança, o proprietário da conta pode invalidar as outras sessões via Supabase Auth `signOut({scope:'others'})`. A interface esclarece que tokens JWT existentes podem permanecer válidos até expirarem. Este comportamento precisa de validação num Auth de staging real.
4. **CI:** passa a validar as duas novas migrações, regressões SQL de exportação e referências, compilação, lint, demo e testes anteriores.

## P0 — ainda bloqueiam publicação

- **Integração:** rever e integrar a cadeia PR #13 > #14 > fase 15, sem misturar PRs 1–12 isolados por cima da versão integrada. A `main` permanece a versão antiga e não deve ser publicada enquanto não for consolidada.
- **Supabase real:** aplicar migrações no staging, autenticar contas reais, confirmar AAL2, convites, RLS entre duas organizações, documentos, políticas Storage, assinaturas e revogação de sessões.
- **Antivírus ClamAV:** instalar gateway privado + scanner, atualizar assinaturas, testar ficheiros limpos, EICAR, timeouts e falhas. A quarentena deve permanecer fail-closed.
- **Resend:** configurar domínio e DNS remetente, segredos, agendamento, callback de confirmação, bounces, entrega, retry e idempotência.
- **Backups:** provar restauração **integral** Supabase DB/Auth/políticas e Storage para outro projeto. Dump PostgreSQL isolado e cópia de um ficheiro são apenas verificações parciais.
- **Observabilidade:** configurar alertas, métricas operacionais reais, responsabilidades, escalamento e gestão de incidentes; confirmar que os avisos chegam.
- **Carga real:** 30 browsers separados, gravações simultâneas, p95/p99, limites da API, retries de conflitos, testes móveis e de acessibilidade.
- **Segurança independente:** pen-test, revisão de `SECURITY DEFINER`, RLS real, escopo de tokens, uploads e RGPD.

## P1 — funcionalidades e qualidade ainda pendentes

- **Decimal financeiro de precisão fixa:** custos e montantes ainda utilizam `number` JavaScript no frontend e Edge Functions. Definir testes com arredondamento em casos extremos e equivalência à aritmética `numeric` do PostgreSQL antes de vender contabilidade; tabelas de preços têm até quatro decimais.
- **Comunicação cliente-equipa:** o chat agora permite notas privadas de staff; mensagens bidirecionais cliente/equipa exigem design de publicação seguro, notificações, confirmação de leitura e paginação.
- **Convites por email:** tokens são emitidos/revogados e o registo existe, mas o envio, reenvio e entrega por email com Resend ainda faltam.
- **Gestão de fornecedores:** introduzida identificação do fornecedor, histórico de preços e CSV até 100 artigos; ainda faltam Excel/XLSX, importação extensa, compras, encomendas, comparação de fornecedores e relações comerciais entre tenants.
- **Snapshots finais:** PDF comercial imutável gerado no servidor a partir da versão publicada, hash, versões, condições legais e eventual assinatura/aceitação formal.
- **Paginação por cursor:** hoje a consulta de orçamentos ainda usa OFFSET; pode saltar/repetir registos com inserções concorrentes. Clientes, equipa e chat ainda requerem paginação dedicada.
- **Anexos:** limpeza segura de ficheiros órfãos com dry-run/verificação, retenção e restauro; o inventário existente não apaga, por precaução.
- **SaaS comercial:** subscrições, Stripe, trials, limites e suporte/área de administração de plataformas.
- **UX:** offline, campos por guardar, revalidação após reconexão, feedback de concorrência, teclado, leitor de ecrã, acessibilidade do editor e teste de cross-browser.
- **Notificações:** tarefas, aprovações e vencimentos ainda sem sistema de entrega completo.

## Regra de entrega

PR de fase 15 deve permanecer **draft** até revisão e CI completo, seguido de provas em staging. Nenhuma migração foi aplicada ao Supabase real nesta execução. **Não** declarar comercialmente pronto com base apenas em testes de PostgreSQL isolado, build ou Playwright demo.
