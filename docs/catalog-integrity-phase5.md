# Tercis — ronda 5: integridade do catálogo

## Erros corrigidos
- O editor de orçamentos selecionava artigos pelo `code`. Se um artigo de referência e um artigo personalizado tivessem o mesmo código, o seletor podia escolher outro preço/descrição. Agora utiliza o identificador `id`, evitando colisões entre fontes.
- Os artigos personalizados **ativos** ficam únicos por organização e código normalizado (sem espaços nas extremidades e sem distinção de maiúsculas/minúsculas). É possível reutilizar o mesmo código numa organização diferente.
- O PostgreSQL impede autoria falsa (`created_by` diferente de `auth.uid()` para pedidos autenticados) e alterações posteriores de autoria; preserva importações confiáveis com conta de serviço técnica.
- Códigos e descrições vazios, custos negativos e `NaN` são rejeitados no servidor.
- Uma pesquisa ou filtro que altera o universo de artigos repõe a página atual do catálogo para evitar ecrãs aparentemente vazios.

## Testes
O workflow inclui `tests/sql/catalog_integrity_regression.sql`: cria o mesmo código em dois tenants, rejeita duplicados no mesmo tenant, proíbe autoria falsificada, verifica códigos/custos inválidos e permite manter artigos inativos sem permitir reativação duplicada.

## Antes da migração
O índice único deteta **duplicados existentes** e, nesse caso, a migração falha propositadamente em vez de apagar ou fundir artigos comerciais. Verificar e resolver dados históricos numa instância de staging primeiro.

## Não está concluído
- Não existe ainda um catálogo 100% unificado no Supabase com catálogo editorial normalizado e preços reais de fornecedores.
- Custos ilustrativos do catálogo editorial encontram-se no bundle JavaScript; não devem ser tratados como dados de fornecedor secretos ou verificados.
- Falta paginação server-side e validação com Supabase Auth e Storage reais.
- Não alterar produção sem backup, staging e plano de reversão.

**Base:** `fix/tercis-atomic-save-version`. `main` permanece intocada.
