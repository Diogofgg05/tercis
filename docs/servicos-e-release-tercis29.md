# TERCIS 29 — serviços e versão de teste

## Email e pagamentos

Decisão do proprietário: sem fornecedor de pagamentos, domínio ou serviço de
email configurados. Pagamentos e envio real de propostas permanecem desativados.

O administrador da plataforma dispõe de **Serviços**, com estado da configuração
obtido por `platform-readiness`. O endpoint valida a sessão e o âmbito do
proprietário com AAL2, devolvendo apenas indicadores, nunca valores de segredos.

Configuração futura do email:

1. Configurar e verificar domínio/remetente e assinatura de webhooks no serviço
   de envio. O adaptador atual é para Resend; não foi ativado nem criada conta.
2. Preencher os segredos indicados em `supabase/functions/.env.example` no servidor.
   O remetente usa o formato `propostas@dominio.pt`; o URL do portal exige HTTPS.
3. Publicar worker e webhook; validar remetente, conteúdo, idempotência,
   confirmação de entrega, devoluções e repetição num ambiente de testes.
4. Só após o ensaio, ativar `TERCIS_EMAIL_ENABLED=true` no servidor e
   `VITE_QUOTE_EMAIL_ENABLED=true` no frontend e compilar novamente.

O worker não reclama trabalhos quando desativado ou incompleto. A interface
também não permite colocar propostas na fila enquanto o envio estiver desativado.
Uma proposta publicada no portal não equivale a um email entregue.

Pagamentos não têm adaptador, preços, checkout, credenciais nem cobranças. A
escolha do fornecedor, planos e limites continua pendente. Não se deve alterar
esta disponibilidade com uma variável de ambiente sem implementar o contrato
de subscrições e validar o webhook, a faturação e a idempotência.

## Identificação da compilação

`npm run build` gera `public/release.json`, copiado para `dist/release.json`.
Contém versão, branch, commit de base, estado de alterações, SHA-256 das fontes
incluídas e lista de migrações com hashes. Não contém ficheiros de ambiente,
credenciais nem ferramentas locais. Uma compilação com alterações locais não é
apresentada como se fosse o conteúdo exato do commit de base.

Para comparar com um inventário Supabase previamente consultado:

```powershell
npm run release:manifest -- --remote-migrations caminho-para-inventario.json
```

O JSON é uma lista de objetos `{version,name}`. A comparação aceita os nomes
históricos `tercis_<versao>_<nome>` e os nomes atuais. Uma divergência faz o
comando terminar com erro. Correspondência de nomes valida o inventário; não
prova que o DDL de produção e o DDL local sejam integralmente equivalentes.

Em 19/11/2026 foram reconciliadas **65 migrações**. A correção remota
`tercis_harden_trigger_functions_and_search_path` faltava no projeto e passou
a ter migração local idempotente. Não foi reaplicada remotamente.

## Evidência desta entrega

- 54 scripts SQL passaram num PostgreSQL isolado em memória (PGlite), após
  aplicar todas as 65 migrações. Isto não substitui Storage/Auth reais.
- 36 testes frontend passaram: permissões, cálculos, catálogo/Excel, chamadas,
  recibos de leitura, contas geridas, configuração de serviços e transporte de uploads.
- Teste de navegador isolado sobre componentes reais com servidor simulado:
  administração sem carregar dados operacionais até selecionar empresa;
  ficha de utilizador; orçamento exato após mudança de empresa; histórico de
  convites sem deduplicar emails e foco no modal de gestão.
- Teste do editor: alterações durante gravação preservadas, próxima gravação
  com versão confirmada, conflito interrompe autosave, recuperação manual.
- XLSX sintético lido pelo Web Worker real do navegador e validado antes da
  pré-visualização. Não avalia fórmulas. Importação limitada à primeira folha,
  100 artigos e 500 KB; os códigos devem ser células de texto.
- Layout do editor a 1440, 820 e 390 px, sem transbordo horizontal.
- Typecheck e compilação passaram; lint sem erros, com 18 avisos existentes.
- Auditoria npm de dependências de produção: zero vulnerabilidades reportadas
  no momento da consulta. Dependências de desenvolvimento têm avisos pendentes.

Revisão de segurança: scan `8a338a48-08fb-4a7d-9efa-c1d36ec812eb`, âmbito
`supabase/`, seis fronteiras analisadas, sem vulnerabilidades confirmadas nos
caminhos revistos. Revisão parcial, sem auditor independente e sem teste de
intrusão. Não constitui aprovação de lançamento comercial.

O antivírus real, TURN entre redes restritas, restauro integral e carga com 30
utilizadores autenticados continuam a exigir infraestrutura e ensaios próprios.
