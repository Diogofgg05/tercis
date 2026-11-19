# Catálogo inicial de componentes

Foram carregadas 64 referências de 12 marcas na organização Tercis: ABB (12),
Hager (10), NORD (2), Schneider Electric (2), Siemens (2), WAGO (5),
Phoenix Contact (5), Omron (5), Eaton (5), Finder (5), Mean Well (5) e
Weidmüller (6). Incluem proteção, contactores, variadores, controlo,
alimentação, relés, conectores e bornes.

As descrições técnicas e referências foram consultadas em documentação oficial
dos fabricantes em 18 de novembro de 2026. Cada registo inclui `source_url`,
visível no catálogo e na edição do artigo. O registo NORD SK 500P representa uma
família configurável, identificado dessa forma na descrição; não é um SKU fechado.

Os dados iniciais estão em `data/reference-components.json`; os detalhes e as
novas referências em `data/reference-details.json` e `data/additional-components.json`.
`supabase/seeds/expanded_catalog.sql` carrega referências inexistentes e preenche
metadados em falta, preservando custos e alterações existentes. Uma segunda
execução não cria duplicados. As famílias Omron MY e Finder 40 exigem escolher
a bobina/variante; não representam um SKU com tensão já definida.

Há fotografias oficiais associadas a 45 referências, guardadas em `public/catalog`.
As 26 imagens originais, sem alteração, têm origem e associação por artigo em
`data/catalog-images.json`. As imagens de família são identificadas na legenda;
os restantes componentes mostram um estado sem fotografia. As fichas incluem
visão geral, características, documentação e estado do custo de compra.

`supabase/seeds/catalog_enrichment.sql`, executado depois de `expanded_catalog.sql`,
acrescenta características a 20 referências: correntes, tensões, ligações,
dimensões, montagem, alimentação e proteção, conforme documentação disponível.
Corrige a cor das versões Weidmüller standard para bege escuro e associa nove
imagens adicionais a Weidmüller, Eaton e à família NORDAC PRO.
`data/catalog-enrichment.json` guarda os valores anteriores para preservar
alterações manuais por campo. Os custos e o estado de confirmação não mudam.

Não foram fornecidos preços de compra. Por isso, os novos registos ficam com
`price_pending=true`. O zero técnico na base de dados nunca é apresentado como
um custo confirmado na interface. A seleção para um orçamento fica desativada
até um administrador introduzir e confirmar o custo no catálogo. Não se usaram
preços de lista estrangeiros como se fossem custos negociados em Portugal.

A consulta v2 filtra por marca, categoria e texto no servidor, com a mesma RLS
por organização. O resumo de quantidades e marcas também respeita a RLS.

## Exemplos autorizados

Após confirmação explícita do utilizador, `supabase/seeds/example_workspace.sql`
adicionou três empresas fictícias, três rascunhos de orçamento e nove linhas.
Os nomes começam por `[Demonstração]`, os registos têm `is_example=true` e os
valores são meramente ilustrativos. Não foram criados utilizadores Auth,
contactos reais, orçamentos enviados, ligações comerciais ou mensagens.

A migração `20261118201835_clearly_labeled_example_records.sql` impede a mudança
dos exemplos para estados comerciais e a remoção da classificação pelo cliente.
Indicadores e relatórios excluem exemplos no servidor e na interface. Os dados
de demonstração continuam visíveis nas tabelas de clientes e orçamentos.

`tests/sql/example_records_regression.sql` confirma estas regras numa transação
com rollback. O script de carregamento preserva registos existentes e não deve
duplicar empresas, orçamentos ou linhas quando executado novamente.
