# Portal comercial — apenas publicações imutáveis

**Problema corrigido:** `sent_at` é histórico, não uma prova de que o conteúdo atual da tabela `budgets` foi publicado. Quando uma proposta regressava a rascunho, podia ser modificada e ficar visível num estado interno de rejeição, ou ser atribuída a outro cliente, sem novo envio.

## Nova regra

- Os feeds de clientes obtêm **exclusivamente** os dados e preços de `budget_versions.snapshot` com `snapshot_kind='sent_quote'`.
- O documento e o cliente a que foi enviado são retirados da fotografia de publicação, não de `budgets.company_id` ou dos itens atualmente em edição.
- Se existirem publicações para destinatários diferentes, **cada destinatário recebe a última versão efetivamente enviada para si**, preservando as versões anteriores.
- As notas, custos de fornecedor, margens e descontos não integram o JSON devolvido ao cliente. O preço final é calculado a partir da fotografia imutável.
- O estado publicado permanece `enviado` durante revisões internas. Decisões de cliente e estados finais podem aparecer quando pertencem à publicação atual.
- O feed de mensagens, atualmente só de leitura, devolve apenas mensagens marcadas como visíveis ao cliente **criadas até ao instante da publicação**. O futuro envio de mensagens precisa de um mecanismo próprio de publicação por mensagem para permitir conversas posteriores ao envio.

## Migração e limitações

As versões antigas enviadas antes do trigger de snapshots não foram materializadas com dados históricos verificáveis. Esta migração opta por **não mostrar** no portal propostas sem fotografia de publicação, para não expor conteúdo atualizado como se fosse a versão originalmente enviada.

Antes de entrar em produção, rever documentos antigos e, se for necessário disponibilizá-los, recuperar comprovativos efetivos de envio e carregar snapshots validados por um processo administrativo confiável.

O sistema ainda não garante email realmente entregue, assinatura eletrónica, aceitação juridicamente vinculativa nem armazenamento de PDF imutável. A integração de email e os anexos do Supabase Storage permanecem fora desta ronda.

## Testes

`tests/sql/published_snapshot_feed_regression.sql` verifica:

1. Um rascunho com custos e descrição modificados não altera a versão visível ao primeiro cliente.
2. Mensagens marcadas indevidamente como públicas **depois** da publicação não são mostradas.
3. A mudança interna de empresa cliente e rejeição na aprovação não revela uma revisão.
4. Uma publicação posterior para outra empresa não retira à original a versão que recebeu.
5. O isolamento da segunda organização continua operacional.

Aplicar no Supabase de staging, validando também permissões reais e timestamps.
