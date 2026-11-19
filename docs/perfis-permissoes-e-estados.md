# Tercis — Perfis, permissões e estados

Esta é a documentação do código de revisão na branch feat/tercis-reliable-budgets, não uma garantia de que as migrações estejam aplicadas no Supabase real.

## Regra fundamental
O React mostra ou oculta as ações, mas é o PostgreSQL/Supabase que deve autorizar todas as operações. Uma conta nova começa como client, active=false, e aguarda aprovação. O registo público nunca atribui automaticamente administração. Atualmente, a função de aprovação de utilizadores está limitada a administradores legados ativos e auditada.

## Matriz de capacidades

| Papel | Consultar propostas | Criar/editar | Submeter | Aprovar | Enviar | Gerir clientes | Gerir contas | Relatórios |
|---|---|---|---|---|---|---|---|---|
| app_admin | Não por defeito | Não | Não | Não | Não | Não | Não | Sim |
| admin (legado) | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| company_admin | Sim* | Sim* | Sim | Sim* | Sim* | Consulta | Consulta | Sim* |
| collaborator interno | Próprias/atribuídas* | Sim* | Sim | Não | Não | Não | Não | Não |
| client | Enviadas da própria empresa | Não | Não | Responde à proposta | Não | Não | Não | Não |
| collaborator tipo client | Enviadas da própria empresa | Não | Não | Responde à proposta | Não | Não | Não | Não |

* O isolamento completo por organização não está terminado. O sistema ainda utiliza company_id para conceitos diferentes (empresa cliente e empresa organizacional). As políticas foram reforçadas em operações críticas, mas não está pronto para SaaS multiempresa. A administração de empresa não pode aprovar contas nem alterar o diretório global de clientes nesta versão. O menu pode permitir consultar essas páginas.

### Quem faz o quê?

- app_admin — supervisiona a plataforma e os relatórios autorizados. Não recebe acesso automático aos custos, clientes e propostas comerciais de terceiros.
- admin legado — gere orçamentos, catálogo, clientes e aprovação auditada de contas. É um papel global provisório, a substituir por administração por organização.
- company_admin — no produto deverá gerir os recursos da sua organização; nesta versão as ações de administração de contas e do diretório global estão intencionalmente limitadas.
- collaborator interno — cria e edita propostas, submete para validação e consulta as propostas autorizadas. Não aprova nem envia por defeito.
- client — consulta exclusivamente propostas autorizadas e publicadas da empresa associada. Pode aceitar, rejeitar ou pedir alterações após o envio. Não vê custos, margens, mensagens e anexos internos.

Permissões individuais adicionais continuam sujeitas às políticas RLS e aos controlos das funções SQL. Contas inativas não têm acesso empresarial.

## Fluxo dos 11 estados

| Estado | Próximos estados |
|---|---|
| Rascunho | Pendente de aprovação |
| Pendente de aprovação | Em análise técnica, Aprovado, Rejeitado, Pedido de alterações |
| Em análise técnica | Aprovado, Rejeitado, Pedido de alterações |
| Aprovado | Enviado, Em execução |
| Enviado | Aceite, Rejeitado, Pedido de alterações, Expirado |
| Aceite | Em execução, Concluído |
| Em execução | Concluído |
| Rejeitado | Rascunho |
| Pedido de alterações | Rascunho |
| Expirado | Rascunho |
| Concluído | Sem transição |

O cliente só responde a uma proposta Enviada, enquanto as aprovações e mudanças de execução são feitas por colaboradores de gestão autorizados. O backend verifica papel, associação, versão esperada e transição válida. As mudanças de estado são registadas no sistema de auditoria.

## Segurança e dados

- A gravação de orçamentos e respetivos itens é atómica; uma falha não pode apagar parcialmente itens antigos.
- O controlo otimista de versão rejeita alterações a propostas que tenham sido atualizadas por outra sessão.
- O cliente recebe apenas os preços finais calculados numa feed do servidor, não os custos de aquisição ou margens.
- As mensagens internas não são fornecidas na feed do cliente.
- MFA TOTP utiliza o Supabase e exige segundo fator quando a sessão o requer. Ainda falta assegurar políticas AAL2 no backend para operações de alto risco.
- O modo demonstração apresenta dados fictícios e não sincroniza com Supabase.

## Bloqueadores antes do lançamento

1. Separar organização proprietária, cliente comercial e permissões dos membros em tabelas próprias.
2. Substituir o administrador global por autorização de cada organização, sem acesso implícito a clientes externos.
3. Aplicar as migrações num Supabase de testes e validar todos os papéis com sessões reais.
4. Testar MFA e recuperação, anexos, backups/restauro, simultaneidade e acessibilidade.
5. Confirmar aspetos legais e só então ativar operações comerciais e integrar na main.

Os testes PostgreSQL de CI são executados numa base de dados descartável; não alteram a base de dados de produção.
