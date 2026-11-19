# Mensagens, chamadas e uploads

As páginas de Equipa, Acessos e Visão Geral mantêm o desenho anterior. O novo
CSS fica limitado às restantes vistas através de `data-redesigned` no conteúdo.

## Conversas diretas

Em Mensagens, o separador Pessoas apresenta colegas ativos e contactos de
empresas com uma ligação comercial aceite e não revogada. Não apresenta email,
telefone ou permissões dos contactos. Uma ligação não dá acesso a orçamentos,
catálogos ou dados da outra empresa. Os clientes individuais não podem consultar
outros clientes independentes nem colaboradores de empresas externas.

As mensagens têm até 4 000 caracteres. O histórico usa páginas de 50 mensagens,
com cursor por data e ID. Postgres Changes recebe as novas mensagens em tempo
real, sujeito às políticas RLS. Notas de orçamentos continuam num separador
próprio e mantêm as permissões anteriores.

## Voz e vídeo

As chamadas são entre duas pessoas, com autorização e sinalização guardadas no
Supabase. O destinatário tem de ter a plataforma aberta. A janela de chamada é
global, permitindo atender mesmo noutra página. O navegador pede autorização
para microfone e, nas videochamadas, para câmara. A captura começa apenas quando
se liga ou se atende; terminar ou sair liberta os dispositivos. Não há gravação.

É necessário HTTPS ou localhost. A chamada expira se não for atendida em 60
segundos. Chamadas em curso validam a autorização a cada 20 segundos. Uma perda
de ligação termina a tentativa após 30 segundos. Sair inesperadamente deixa
de enviar heartbeats e o bloqueio de ocupação expira em 60 segundos.

A sinalização usa trickle ICE: a chamada toca assim que a oferta está pronta,
sem esperar pela recolha completa dos candidatos de rede. Candidatos chegam por
Realtime, são guardados para recuperar eventos perdidos e só são visíveis aos
participantes autorizados. Duplicados são ignorados. Em Definições > Chamadas
há um teste local de imagem e nível do microfone, sem gravação nem envio de media.

O STUN predefinido permite ligações diretas em redes compatíveis. Para atravessar
firewalls e NAT restritivo é necessário configurar TURN. `VITE_RTC_ICE_SERVERS_JSON`
aceita a lista `RTCIceServer` descrita em `.env.example`. Como as variáveis VITE
são públicas, usar credenciais TURN limitadas e temporárias; para produção,
servir essas credenciais por uma função autenticada do fornecedor TURN escolhido.
Não se configurou nem contratou um fornecedor TURN nesta alteração.

## Uploads privados

- Chat: PDF, JPG, PNG, WebP e TXT, até 10 MB; download apenas pelos participantes
  autorizados. Não existe verificação antivírus destes anexos de chat.
- Perfil: JPG, PNG e WebP, até 5 MB. A imagem é descodificada e convertida para
  WebP com dimensão máxima de 640 px antes do envio.
- Clientes/fornecedores: o administrador pode carregar o logótipo na ficha da
  empresa. Imagens ficam no bucket privado da empresa, com acesso sujeito a RLS.
- Orçamentos: mantém-se o fluxo existente de quarentena. O projeto remoto não
  tinha Edge Functions publicadas ao verificar esta alteração. Falta configurar
  o gateway ClamAV, os segredos e a execução agendada de `attachment-scan-worker`.
  Sem isso os anexos não passam a `clean` e o download permanece bloqueado.

## Migrações e verificação

Aplicadas ao projeto `kgqudzovqtuilabmzxwe`:

- `20261118193401_direct_messaging_calls_and_media.sql`
- `20261118194834_company_logo_uploads.sql`
- `20261118195410_qualify_company_logo_object_paths.sql`
- `20261118200411_catalog_sources_and_trickle_ice.sql`

`tests/sql/direct_messaging_regression.sql` usa fixtures dentro de uma transação
e faz rollback: testa contactos internos, ligações comerciais, isolamento entre
terceiros, envio de anexos, imagens de perfil, participantes de chamadas,
concorrência e revogação. Não cria mensagens, utilizadores ou ficheiros reais
persistentes. Os testes frontend cobrem a recolha de ICE e cancelamento das chamadas.

Não foi possível fazer QA visual no navegador nesta sessão: o host de acesso
ao navegador estava indisponível. O teste de sinalização WebSocket com duas contas
temporárias passou: mensagens, recibos de leitura, chamada recebida, ICE, aceitação
e término. Os dados temporários foram removidos. O vídeo/áudio efetivo e um upload
completo em dispositivos separados ainda precisam de um ensaio visual.

A migração `20261118213604_direct_message_reads_and_call_sync.sql` acrescenta
`read_at` e uma RPC exclusiva do destinatário para mensagens visualizadas.
A interface observa as mensagens visíveis, com a janela em foco, e apresenta
**Visto** ao remetente. Os snapshots de recuperação não removem recibos novos.
As chamadas recuperam eventos por consulta periódica a cada dois segundos e
ao regressar à janela; mensagens e leituras têm recuperação a cada cinco segundos.
O token atualizado é explicitamente associado ao canal Realtime. Existe toque
de chamada quando a política de áudio do navegador permite a reprodução.
