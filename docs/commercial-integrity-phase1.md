# Tercis — ronda 1: integridade dos orçamentos

**Ramo:** `fix/tercis-commercial-integrity-phase1` · **Origem:** `feat/tercis-organization-isolation`.

## Alterações efetivas

1. **Proteção de propostas publicadas:** só é possível eliminar rascunhos que nunca foram enviados (`status='rascunho' AND sent_at IS NULL`), mesmo que um documento publicado regresse a rascunho. Um trigger também impede a eliminação física por operações de manutenção normais quando existe `sent_at`.
2. **Submissão comercial válida:** nas transições para pendente, aprovado e enviado, o servidor exige cliente, nome, datas coerentes e pelo menos um item válido com descrição, quantidade positiva, custo e acréscimo não negativos e desconto entre 0–100%. Controlo feito por trigger, não apenas React.
3. **Validade e aceitação:** documentos expirados não podem ser enviados nem aceites. A aceitação exige marca de publicação anterior. O prazo é verificado por `CURRENT_DATE` no PostgreSQL; deve-se configurar a zona horária comercial pretendida no ambiente real.
4. **Restrições adicionais:** regras `NOT VALID` para IVA entre 0–100%, linhas com quantidades positivas e preços aceitáveis. Dados históricos devem ser auditados antes de validar todas as constraints.
5. **Histórico real dos envios:** um trigger cria uma fotografia dos dados e itens no momento de cada transição para `enviado`, na tabela `budget_versions`, incluindo o custo interno. A leitura fica reservada a gestores da **mesma organização**, sujeitos às políticas MFA/RLS. Não se reconstituem fraudulentamente versões antigas a partir do conteúdo atual.
6. **Referências independentes por organização:** substituição de `UNIQUE(ref)` por `UNIQUE(organization_id, ref)`, mantendo a proteção contra duplicação dentro de cada empresa.
7. **Coerência no frontend:** o botão Eliminar deixa de surgir para um rascunho anteriormente enviado; o editor apresenta avisos antes de transições inválidas; duplicar um orçamento não replica a data de publicação.

## Testes adicionados

`tests/sql/commercial_integrity_regression.sql` cobre snapshots, controlo de acesso, regresso a rascunho, proteção contra eliminação, propostas vazias ou mal descritas, aceitação após validade e referências repetidas em organizações distintas. O workflow inclui estes testes depois das regressões anteriores.

## Limitações e próxima ronda

- **Não aplicar diretamente em produção.** Existe um conjunto de PRs de que esta ronda depende. Testar todas as migrações numa cópia de staging e planear backup/restauração.
- O histórico é gravado **a partir da aplicação desta migração**; propostas enviadas antes desta data não obtêm um snapshot fiável retroativo.
- A interface ainda não apresenta o ecrã de comparação entre revisões.
- O estado `enviado` não confirma a entrega efetiva de email: são necessários envio, outbox e estados de entrega.
- A proteção contra perda de propostas exige ainda arquivo reversível, retenção de documentos e políticas de histórico.
- Falta rever cálculo monetário de precisão decimal, limites de desconto por organização, catálogo de custos privados e política de anexos/Supabase Storage.
