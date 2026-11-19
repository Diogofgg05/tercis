# Administração e contas geridas

Aplicado no Supabase em 19/11/2026 após autorização explícita do utilizador.

O proprietário `diogofilipe837@gmail.com` está registado numa tabela privada,
`tercis_platform.administrators`. O cliente apenas consulta se a própria conta é
proprietária. A listagem global, criação de empresas, mudança de empresa e gestão
de administradores exigem também autenticação de dois fatores (AAL2).

Uma sessão Supabase válida é reconhecida e persistida no dispositivo. Ao abrir a
plataforma, o proprietário não preenche novamente o login. Sem sessão válida é
necessário autenticar; não existe uma rota pública de administração nem segredos
administrativos no frontend.

O proprietário abre a empresa desejada no painel Plataforma. A operação altera
o contexto empresarial do seu perfil e fica auditada. A RLS e os fluxos existentes
continuam a aplicar-se à empresa aberta; um aviso identifica esse contexto. As
caches de clientes, orçamentos e equipa são descartadas ao mudar. O contexto é
partilhado pelas sessões da mesma conta; ao ganhar foco, a aplicação atualiza o
perfil. Não se devem gerir empresas diferentes simultaneamente com a mesma conta.

O painel tem páginas separadas de Resumo, Empresas, Utilizadores, Orçamentos,
Catálogo e Atividade. As quatro listas globais usam paginação no servidor,
pesquisa e filtro por empresa, com autorização de proprietário e MFA em cada RPC.
Nova empresa encaminha imediatamente para criar o administrador dessa empresa;
a empresa escolhida é identificada no formulário. A criação da empresa e da
identidade são duas etapas: se a segunda falhar, a empresa mantém-se para concluir
a configuração, em vez de perder o registo criado.

As listas operacionais de equipa usam `tercis_company_team`, que apenas devolve
colaboradores e administradores internos da organização do utilizador. Exclui
clientes externos, contas de outras empresas e o proprietário da plataforma.
Colaboradores consultam apenas membros ativos; administradores também veem os
pendentes. A lista não contém moradas, NIF ou outros campos privados de perfil.

Em 19/11/2026 foram corrigidas duas contas que estavam associadas à Tercis:
o utilizador confirmou stockControl para `teste123@gmail.com` e Amperion para
`seiren@gmail.com`. Foram criadas organizações independentes e as contas mantêm
o papel de administrador de empresa. Não existiam orçamentos criados/atribuídos
nem componentes criados por essas contas. A mudança foi auditada; as três
listas reais de equipa foram verificadas sob o papel autenticado.

## Contas da própria empresa

Equipa → Criar colaborador abre o formulário com nome, email e palavra-passe
inicial. A confirmação de identidade e titularidade do email é explícita e
obrigatória: o administrador está a ativar a conta sem enviar email de confirmação.

`create-team-account` verifica o JWT com Auth, consulta uma RPC de âmbito que
exige MFA, e só depois usa Auth Admin. O administrador de empresa apenas cria
colaboradores na própria empresa; o proprietário pode criar administradores de
empresa no painel global. Emails já registados não são apropriados.

A associação final é uma RPC exclusiva do papel `service_role`, que volta a
verificar o administrador, a empresa, o papel e o estado inicial da nova conta.
A palavra-passe é mantida em memória e em Supabase Auth, nunca em tabelas da
aplicação. O destinatário altera-a em Definições → Segurança. A criação é auditada.

## Pessoas de outras empresas

Mensagens → Contactos e pedidos permite pedir um contacto externo por email.
O destinatário aceita dentro da plataforma. Só depois ficam disponíveis mensagens,
chamadas e ficheiros entre as duas pessoas. Isto não cria uma conta, não muda a
empresa do destinatário e não concede acesso aos dados comerciais da outra empresa.
A autorização pessoal é revogável; ligações comerciais entre empresas mantêm-se
independentes.

## Validação

- Todas as migrações aplicadas em PostgreSQL em memória isolado (PGlite), com os
  53 testes SQL do CI a passar, incluindo isolamento, MFA e operações indevidas.
- 27 testes frontend/serviço, typecheck, lint sem erros e compilação.
- Novos testes SQL de proprietário e contactos executados no Supabase com rollback.
- Teste WebSocket com duas contas temporárias: mensagens, leituras, chamada,
  candidatos ICE, aceitação e término passaram; dados temporários removidos.
- Teste real da Edge Function com MFA: colaborador criado e início de sessão
  confirmado; AAL1, outra empresa e promoção indevida recusados; limpeza concluída.
- Não foi realizado um ensaio visual interativo dos novos formulários.

A primeira aplicação das permissões globais foi recusada pela revisão automática.
Depois da validação local, o utilizador autorizou expressamente a alteração;
as migrações foram aplicadas, a Edge Function publicada com verificação JWT e
o proprietário registado. Os guards preservam as regras anteriores, com uma
exceção local à transação apenas para a mudança de empresa auditada do proprietário.

`20261119124926_protect_platform_owner_profile.sql` impede que administradores de
empresa, incluindo papéis legados, alterem o papel, estado, email ou empresa do
proprietário. A regressão inclui uma tentativa de despromoção por administrador legado.
