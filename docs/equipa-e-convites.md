# Equipa, fichas e conversas

A equipa mostra contas realmente associadas à organização. Não são criadas
contas fictícias nem palavras-passe partilhadas para preencher a lista.

O botão **Adicionar elemento** cria um convite para um email e, opcionalmente,
um nome. A área **Convites e novas contas** mostra o estado de cada destinatário.
A criação e a consulta de convites exigem administração ativa e MFA.
A lista não devolve códigos de aceitação; o código é apresentado na criação.
Não há envio automático de emails nesta funcionalidade.

Em 18/11/2026 foram preparados, com autorização, convites para os três emails
fornecidos pelo utilizador. Os códigos estão apenas no ficheiro local ignorado
`convites-equipa.local` e expiram em 25/11/2026. Não foram enviados emails.
Os destinatários registam-se, confirmam o email e aceitam o respetivo código.
Depois, a administração aprova a conta na equipa.

Posteriormente, por pedido explícito do administrador, foi provisionada a conta
real `anibal.prosistav@gmail.com` através de Supabase Auth Admin `generateLink`
do tipo `invite`, sem envio de email. O perfil foi associado à Tercis e ativado
como colaborador interno, com auditoria administrativa. O convite da organização
foi concluído administrativamente e códigos antigos foram revogados. A confirmação
do email continua pendente até o primeiro acesso pela ligação pessoal.
A ligação temporária está apenas em `acesso-anibal.local`, ignorado pelo Git.

Cada elemento tem uma ficha com fotografia, email, departamento, papel e estado.
**Conversar** abre a conversa direta com outro membro ativo. A própria conta e
contas pendentes não têm esse botão. As permissões são verificadas novamente
no servidor antes de enviar mensagens ou iniciar chamadas.

Os modais usam `WorkspaceDialog`, com rolagem do conteúdo, foco contido,
Escape, restauração de foco e tratamento de diálogos sobrepostos. Uma chamada
recebida aparece acima dos modais.

Validação: typecheck, compilação, 20 testes frontend, regressões SQL de catálogo
e convites com rollback. A regressão de convites verifica isolamento entre
organizações, ausência de códigos na lista e exigência de MFA. A inspeção visual
interativa não esteve disponível nesta sessão.
