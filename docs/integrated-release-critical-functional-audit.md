# Tercis — versão integrada, revisão de críticos e correções funcionais

**Branch de integração:** `release/tercis-integrated-hardening`.

## Objetivo e estado

Esta branch parte da ponta de `fix/tercis-staging-production-verification`, que inclui o encadeamento de 12 PRs abertos em rascunho. Não reescreve nem atualiza a `main`: o histórico inicial tem ainda um Dashboard corrompido (`src/views/Dashboard.tsx` contém apenas `a`).

**Gate obrigatório:** nunca fazer merge/deploy em produção só porque a pipeline isolada está verde. Exigir revisão independente e staging com Supabase Auth, Storage, ClamAV, Resend e backup reais.

## Correcções adicionadas nesta branch

1. **Preços e IVA**: regra uniforme em `src/calc.ts`, editor, PDF, XML/Excel e worker de email: PVP com 4 casas decimais, subtotal por linha com 2 casas, IVA arredondado a 2 casas sobre o líquido, total final arredondado a 2 casas. A interface chama corretamente a percentagem `Acréscimo sobre custo`, não margem bruta. Smoke test de cálculos fraccionários no CI. Nota: operações usam ainda `number` JavaScript; contas de valores extremos exigem implementação de decimal fixo testado antes de uso contabilístico.
2. **Destinatário de email**: `tercis_queue_quote_email(uuid,integer,text)` exige confirmação explícita do email que está **neste momento** na ficha da empresa pertencente ao tenant. A RPC antiga sem destinatário deixou de poder ser chamada por utilizadores autenticados. UI mostra o destinatário e avisa quando `client_email` diverge da ficha. Testes para email errado e impedir bypass legado.
3. **Autorizações da UI**: o editor não presume que um orçamento é do tenant correto quando um dos IDs de organização está em falta. O SQL RLS continua a autoridade final.
4. **Pesquisa de orçamentos**: `tercis_budget_search_ids` pesquisa todas as linhas autorizadas no servidor por referência, designação, setor, nome do cliente, estado e arquivo. A listagem usa lotes de 100 com tokens para descartar resultados atrasados. Testes isolam clientes de staff e organizações A/B.
5. **Dashboard global**: `tercis_dashboard_kpis` calcula indicadores e volume orçamentado a partir de **todos** os documentos autorizados, não apenas dos 100 carregados. Os valores são estimativas de propostas, não faturação. A UI indica quando apresenta dados locais provisórios.
6. **Clientes CRM**: `tercis_company_budget_counts` conta os documentos reais associados a cada cliente, incluindo os que não estão na página de orçamentos. Teste multi-tenant e negação de acesso ao cliente.
7. **Pesquisa de catálogo**: respostas de pesquisas antigas deixam de substituir resultados mais recentes em conexões lentas.
8. **Estados e erros**: atualização de lista após arquivo/restauro; retorno ao painel com consulta limpa. Avisos para relatórios parciais e falhas de atualização após gravações com sucesso.
9. **Qualidade**: testes SQL novos, verificações de cálculos no browser e fluxo CI da release.

## Bloqueadores externos NÃO resolvidos nesta conversa

- Supabase Auth/MFA e Storage num projeto real de staging, incluindo upload de ficheiros e isolamento entre empresas;
- executar ClamAV real com assinaturas atualizadas, resposta positiva/negativa e scanner inacessível;
- configurar domínio remetente, chaves, webhooks assinados e agendamento Resend e confirmar entregabilidade;
- restaurar uma cópia **integral** de Supabase, Auth e Storage num segundo projeto;
- ativar monitorização/alertas e verificar a chegada de alertas por um canal real;
- executar o workflow de 30 browsers autenticados e analisar latência p95;
- revisão de políticas RLS, escopo SECURITY DEFINER, RGPD, auditoria externa e testes de intrusão.

Sem acesso/credenciais de staging, a implementação de automações e scripts não constitui prova de funcionamento externo.

## Funcionalidades que ainda precisam de produto e mais código

- **Mensagens:** leitura implementada; envio/edição/anexos de mensagens, notificações e presença ainda desativados.
- **Convites:** a equipa ainda partilha um token manual; convite por email e recuperação de conta não estão concluídos.
- **Relatórios:** o dashboard agora tem agregações SQL, mas os gráficos dos relatórios continuam baseados nos documentos carregados; quando a lista tem mais páginas o painel avisa da incompletude.
- **Paginação:** lista com offset em lotes; pode haver mudança de linhas durante paginação se existirem inserções concorrentes. Avançar para cursor estável.
- **CRM/fornecedores:** ainda falta modelo explícito de relações cliente/fornecedor entre organizações, compras e histórico de preços.
- **Escala:** empresas, perfis, mensagens e algumas listas ainda não têm paginação independente ou carregamento incremental.
- **Testes:** adicionar suites Playwright integradas ao Supabase de staging, testes de acessibilidade e mobile, e cenários de conflito em várias sessões.
- **Dinheiro:** em ambiente comercial extremo/substituição de faturas, migrar para decimal de precisão fixa ou biblioteca decimal testada contra PostgreSQL `numeric`.

## Ordem de integração e lançamento

1. Rever o diff da release e a cadeia de PRs #1–#12. Esta branch representa o estado acumulado; **não** aplicar todos os PRs antigos por cima dela após a integração.
2. Confirmar CI verde (TypeScript, ESLint, dependências, build, Playwright demo, todas migrações SQL e testes RLS).
3. Reproduzir uma cópia isolada de staging e validar migrações reais sem dados pessoais.
4. Realizar testes MFA/Storage/ClamAV/Resend/backups/alertas e carga real; registar provas e responsável.
5. Resolver todos os bloqueadores, aprovar PR e fazer merge com revisão. Só então preparar deployment controlado e rollback.

**Estado desta branch: integração de código e testes isolados; lançamento real ainda bloqueado.**
