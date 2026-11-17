# Tercis — correção da versão otimista após guardar

O frontend anteriormente estimava a nova versão com base no estado da sua própria lista de orçamentos:

`budgets.some(...) ? activeBudget.version+1 : 1`

Isto podia produzir uma versão incorreta em listas incompletas, desatualizadas, paginadas ou em ambientes com vários utilizadores. A gravação remota já tinha proteção de concorrência no PostgreSQL, mas a interface não recebia o valor realmente confirmado.

## Alteração
- `save_budget_atomic_versioned(p_budget,p_items)` é uma função `SECURITY INVOKER` que chama a gravação transacional existente e devolve `{id,version}` na **mesma transação**.
- O frontend usa a versão recebida, valida o ID, e deixa de prever o resultado a partir do estado local.
- A função `save_budget_atomic` existente é preservada para retrocompatibilidade.
- A suite `tests/sql/atomic_return_version_regression.sql` verifica criação, múltiplas gravações e rejeição de pedidos com versão antiga.

## Riscos e próximos passos
- Deploy apenas após migração testada em staging.
- Ainda é necessário implementar paginação de dados, tratamento robusto de sincronização entre editores, limites comerciais e integração do catálogo.
- A confirmação do servidor indica a versão persistida, não que a informação foi entregue por email.
