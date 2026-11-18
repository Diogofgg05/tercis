# Auditoria técnica Tercis — 17/11/2026

**Âmbito:** código na branch `feat/tercis-reliable-budgets` do repositório `Diogofgg05/tercis`. O PR permanece em draft. Esta revisão não altera a `main` nem o Supabase de produção.

> Passar os testes não demonstra ausência de bugs. A auditoria identifica riscos concretos e regressões em cenários controlados; não substitui testes completos com clientes e dados reais.

## Problemas encontrados e corrigidos

| Área | Falha / risco | Correção |
| --- | --- | --- |
| Segurança de sessão | Pedidos de perfil atrasados e trocas de conta podiam deixar estado antigo no React | Invalidar pedidos antigos e reinicializar a aplicação por identidade |
| Contas pendentes | Lista administrativa filtrava `active=true`, ocultando as contas à espera de aprovação | Incluir contas pendentes apenas na consulta administrativa autorizada |
| Gravação | Uma atualização de lista falhada podia ser apresentada como erro de gravação já confirmada | Separar confirmação da transação e sincronização da interface |
| Edição de orçamentos | Opções incompatíveis com o papel e o estado do documento | Centralizar permissões e bloquear alterações comerciais após submissão |
| Estados | Era possível tentar criar um orçamento já publicado ou passar diretamente por cima da aprovação | Validar estado inicial, transições legais, versão e auditoria no PostgreSQL |
| Dados de clientes | Notas, custos e margens internos poderiam ser apresentados indevidamente | Feeds comerciais redigidas no servidor e políticas RLS restritivas |
| Catálogo | Uma conta de cliente podia consultar custos de fornecedores diretamente na API | Restringir custos brutos a pessoal interno autorizado |
| Relatórios | Filtro de período aplicava-se ao gráfico mas não a todos os indicadores | Aplicar o mesmo intervalo de datas às métricas, rankings e evolução |
| Exportações | Texto malicioso/inesperado podia danificar XML e iniciar fórmulas em CSV | Escapar XML e proteger células CSV, datas e nomes de ficheiros |
| Armazenamento local | Confirmação ocorria antes de a transação IndexedDB estar concluída | Resolver apenas no `transaction.oncomplete` e fechar ligações |
| Componentes antigos | `any`, referências a ações removidas, imports e variáveis não utilizados | Tipagem explícita e limpeza de referências quebradas |
| Dependências npm | Vulnerabilidades graves em `xlsx` e `ws` identificadas por `npm audit` | Remover `xlsx` não utilizado e atualizar `ws` para versão corrigida |

## Portas de qualidade exigidas no CI

A execução de `.github/workflows/tercis-quality.yml` verifica:

1. `npm ci` a partir do `package-lock.json`.
2. `npm run typecheck` e `npm run lint` — obrigatórios.
3. `npm audit --omit=dev --audit-level=high` — obrigatório; abrangência das dependências de produção.
4. `npm run build`.
5. Playwright/Chrome: login demo, dashboard, orçamentos, criar/guardar/reabrir após reload, navegação por páginas e mobile, perfil cliente, troca de conta no mesmo browser, filtros de relatórios, persistência IndexedDB e XML de exportação.
6. PostgreSQL 16 descartável: aplicar TODAS as migrações por ordem, testar RLS por papel, criação segura de contas, catálogo/custos, mensagens internas, gravação atómica, conflito de versões, transições, auditoria, associação de cliente e imutabilidade de proposta publicada.

**Referência CI validada:** https://github.com/Diogofgg05/tercis/actions/runs/44126312659

Esta execução terminou com sucesso (build e PostgreSQL). A análise estática ainda identificava 14 *warnings*, sobretudo regras de Fast Refresh sobre exportações num componente e duas dependências intencionais de efeitos React. Não havia erros de ESLint. Um aviso adicional de sincronização de estado foi corrigido depois desta execução; verificar a execução mais recente antes de integrar o PR.

## Limites de cobertura e riscos ainda abertos

- **Crítico: isolamento multiempresa.** `company_id` ainda mistura pertença à organização com empresa cliente. Criar entidades `organisation`, `organisation_membership` e propriedade inequívoca de cada registo; auditar TODAS as políticas RLS, triggers e funções `SECURITY DEFINER` num Supabase de homologação.
- **Crítico: Supabase real não testado.** Os testes de PostgreSQL usam fixtures e JWT simulados. Validar Supabase Auth, PostgREST, Storage, MFA, políticas AAL2, permissões de API e diferenças de esquema com contas reais de teste.
- **Alto: concorrência e recuperação.** Testar 30+ sessões, alterações simultâneas, falhas de rede durante transações, bloqueios, backups e restauro de dados.
- **Alto: processos empresariais.** Confirmar emails reais, notificações, anexos, recuperação de conta, ciclo de revisão de propostas e eventual conformidade jurídica; não os declarar prontos sem provas.
- **Médio: legado.** Existem ficheiros antigos de interface e chat que não participam no fluxo principal. Remover ou migrar em tarefa separada, com testes, para reduzir manutenção e avisos Fast Refresh.
- **Médio: acessibilidade.** Fazer testes de teclado, leitura por ecrã, contrastes, zoom, formulários e iOS/Android físicos.
- **Médio: cobertura estática.** Continuar a resolver avisos React restantes sem introduzir loops de efeitos ou perda de edições do utilizador.

## Critério de publicação

Recomenda-se manter o PR em **draft** até existirem testes de homologação multiempresa e aprovação explícita das migrações. A aplicação pode continuar a ser mostrada como demonstração, devidamente identificada, sem recolher dados comerciais reais.

## Documentação relacionada

- [Perfis, permissões e estados](./perfis-permissoes-e-estados.md)
- [Workflow de qualidade](../.github/workflows/tercis-quality.yml)
