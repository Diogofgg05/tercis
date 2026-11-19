# TERCIS 29 — execução por etapas

Pedido de 19/11/2026. Este plano cobre as 14 áreas pedidas; uma etapa só fica
concluída com implementação, verificação e limitações registadas.

| Etapa | Áreas | Entregáveis e validação | Estado |
|---|---|---|---|
| 1 | Administração, design, convites, catálogo e orçamento | Navegação exclusiva do proprietário; ações específicas por registo; convites em modais; fichas com imagem; editor compacto e seleção do catálogo da empresa | Concluída e validada localmente |
| 2 | Integração e segurança | Manifesto de versão e migrações; auditoria de RPCs privilegiadas; testes de API/RLS/Storage/MFA com várias empresas; branch isolada sem alterar main | Inventário reconciliado; revisão parcial e 54 testes SQL concluídos; validação independente pendente |
| 3 | Onboarding, contas e permissões | Criar empresa e administrador; colaboradores; suspensão; recuperação; permissões por ação e papéis personalizados com limites de delegação | Contas geridas e suspensão existentes; papéis personalizados e recuperação por concluir |
| 4 | Chat e notificações | Caixa de entrada única; não lidas; pesquisa; histórico; notificações e sinalização de chamadas verificadas | Central de notificações acrescentada; falta pesquisa integral e ensaio de media em dois dispositivos |
| 5 | CRM e relações comerciais | Pedidos de orçamento; partilha explícita de propostas; estados, histórico e revogação | A executar |
| 6 | Orçamentos | Autosave com controlo de conflitos; versões e templates; aprovação; PDF; configuração e testes do envio de email | Autosave e configuração desativada de email testados; comparação de versões e templates pendentes |
| 7 | Uploads | Progresso; repetição após erro; fotografias; quarentena; reconciliação de órfãos; ligação operacional a antivírus | Progresso por ficheiro e repetição disponíveis; faltam serviço antivírus e reconciliação operacional |
| 8 | Catálogo e relatórios | Variantes, margens, Excel; conversão, produtividade, rentabilidade e potencial comercial | Excel/CSV com pré-visualização acrescentado; variantes e novos indicadores pendentes |
| 9 | Desempenho e recuperação | Medir SQL/RLS, índices, paginação e imagens; carga autenticada; restauro validado | Páginas carregadas por pedido: JS principal 550 → 296 KB; SQL, carga real e restauro por validar |
| 10 | Comercialização | Planos, limites, landing page, subscrições, faturação, privacidade, backups e suporte | Preparar sem ativar pagamentos |

## Decisões do utilizador

- Pagamentos: ainda sem fornecedor. Preparar configuração, manter desativados.
- Email: ainda sem domínio/serviço. Preparar configuração e testes, sem enviar emails reais.
- Cada empresa mantém os seus dados. Relações comerciais/contactos não autorizam
  partilha automática de propostas, ficheiros ou colaboradores.
- O administrador da aplicação tem páginas próprias; os dados de uma empresa só
  são apresentados quando a consulta. As ações de utilizadores e orçamentos
  devem abrir o respetivo registo, não um destino genérico.

## Regras de entrega

Não alterar nem fundir main antes da validação. Não marcar pagamentos, email,
antivírus ou recuperação como operacionais sem configuração e ensaio efetivos.
Guardar as decisões e resultados de cada etapa neste documento.

## Entrega inicial

Versão `0.29.0`. Evidência, configuração e limitações em
[servicos-e-release-tercis29.md](servicos-e-release-tercis29.md).
As etapas com pendências acima continuam abertas. Esta entrega não representa
a conclusão das 14 áreas nem aprovação de comercialização.

Próxima implementação: etapa 3, com papéis personalizados efetivamente
aplicados no servidor, limites de delegação e recuperação de acessos; depois
etapa 5, para pedidos comerciais e partilha explícita de propostas.
