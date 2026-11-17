import { Check, Info, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_PERMISSIONS, STATUS_FLOW, STATUS_LABELS } from '../domain/workflow';
import { StatusBadge } from '../components/StatusBadge';
import type { Permission, UserRole, BudgetStatus } from '../types';

const roles: {id:UserRole;title:string;description:string}[] = [
  {id:'app_admin',title:'Administração da plataforma',description:'Supervisiona a plataforma e os indicadores autorizados. Não deve tratar dados comerciais de empresas sem fundamento próprio.'},
  {id:'company_admin',title:'Administração da empresa',description:'Gere utilizadores, clientes, catálogo, orçamentos e configurações da sua organização.'},
  {id:'admin',title:'Administrador legado',description:'Papel antigo com privilégios amplos. Deve ser migrado para uma função com organização definida.'},
  {id:'collaborator',title:'Colaborador',description:'Cria, edita e submete orçamentos atribuídos, sem os aprovar nem gerir contas por defeito.'},
  {id:'client',title:'Cliente',description:'Consulta os orçamentos autorizados e pode responder às propostas enviadas, sem editar preços ou margens.'},
];
const permissions: {id:Permission;label:string}[] = [
  {id:'manage_platform',label:'Administrar plataforma'},
  {id:'manage_company',label:'Gerir empresa'},
  {id:'manage_users',label:'Gerir utilizadores'},
  {id:'manage_clients',label:'Gerir clientes'},
  {id:'manage_catalog',label:'Gerir catálogo'},
  {id:'manage_settings',label:'Alterar definições'},
  {id:'create_budgets',label:'Criar e editar orçamentos'},
  {id:'submit_budgets',label:'Submeter para aprovação'},
  {id:'approve_budgets',label:'Aprovar/rejeitar'},
  {id:'send_budgets',label:'Enviar ao cliente'},
  {id:'view_reports',label:'Consultar relatórios'},
  {id:'manage_attachments',label:'Gerir anexos'},
];
const lifecycle: BudgetStatus[] = [
  'rascunho','pendente_aprovacao','em_analise_tecnica','aprovado','enviado',
  'aceite','em_execucao','concluido',
];

export function AccessView() {
  const {profile,demoMode} = useAuth();
  return <div className="tercis-page space-y-5">
    <header className="tercis-head">
      <div><div className="tercis-eyebrow">Tercis / Segurança</div>
        <h1 className="tercis-title">Perfis e permissões</h1>
        <p className="tercis-subtitle">Quem pode consultar, criar, aprovar e gerir informação.</p>
      </div>
      <div className="tercis-badge bg-blue-50 text-blue-700 border border-blue-100"><ShieldCheck size={14} className="mr-2"/> Matriz de acessos</div>
    </header>

    <div className="tercis-note flex gap-3 items-start">
      <Info size={17} className="shrink-0 mt-0.5"/>
      <div><strong>Regra fundamental:</strong> os controlos desta página mostram a política prevista na aplicação.
        A autorização real depende também das políticas RLS do PostgreSQL.
        O isolamento completo multiempresa ainda precisa de uma arquitetura de organizações independente dos clientes.
        {demoMode && ' Nesta sessão os dados são de demonstração.'}
      </div>
    </div>

    <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {roles.map(role => <article key={role.id}
        className={'tercis-card p-4 flex flex-col gap-2 '+(profile?.role === role.id ? 'ring-2 ring-blue-200' : '')}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-900">{role.title}</span>
          {profile?.role===role.id && <span className="tercis-badge bg-blue-50 text-blue-700">O teu papel</span>}
        </div>
        <p className="text-[12px] leading-5 text-slate-600">{role.description}</p>
        <p className="mt-auto pt-1 text-[11px] text-slate-400">{ROLE_PERMISSIONS[role.id].length} capacidades de base</p>
      </article>)}
    </section>

    <section className="tercis-card overflow-hidden">
      <div className="tercis-card-header"><h2 className="tercis-card-title">Matriz de permissões de base</h2>
        <p className="text-xs text-slate-500 mt-1">Permissões individuais podem ser adicionais; contas inativas não têm acesso.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="tercis-table min-w-[860px]">
          <thead><tr><th className="min-w-[230px]">Funcionalidade</th>
            {roles.map(role=><th key={role.id} className="text-center">{role.id==='admin'?'Admin legado':role.title}</th>)}</tr></thead>
          <tbody>{permissions.map(perm=><tr key={perm.id}>
            <td className="font-medium text-slate-700">{perm.label}</td>
            {roles.map(role=><td key={role.id} className="text-center">
              {ROLE_PERMISSIONS[role.id].includes(perm.id)
                ? <Check size={17} className="text-emerald-600 mx-auto" aria-label="Permitido"/>
                : <span className="text-slate-300" aria-label="Não permitido">—</span>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="tercis-card overflow-hidden">
      <div className="tercis-card-header"><h2 className="tercis-card-title">Ciclo de vida dos orçamentos</h2>
        <p className="text-xs text-slate-500 mt-1">Os estados mudam por transições válidas, não por atribuição livre.</p></div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {lifecycle.map((status,i) => <div key={status} className="flex items-center gap-2">
            <StatusBadge status={status} size="sm"/>{i<lifecycle.length-1 && <span className="text-slate-300">›</span>}
          </div>)}
        </div>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
          {(Object.keys(STATUS_FLOW) as BudgetStatus[]).map(status=><div key={status}
            className="flex gap-3 items-start justify-between border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-800">{STATUS_LABELS[status]}</span>
            <span className="text-[11px] leading-5 text-slate-500 text-right max-w-[65%]">
              {(STATUS_FLOW[status].length ? STATUS_FLOW[status].map(next=>STATUS_LABELS[next]).join(' · ') : 'Estado final')}
            </span>
          </div>)}
        </div>
      </div>
    </section>

    <div className="tercis-note flex gap-2 items-start"><LockKeyhole size={16} className="shrink-0 mt-0.5"/>
      <span>Apenas administradores autorizados podem aprovar contas novas. Clientes só respondem a propostas enviadas e a equipa interna não deve alterar estados sem um evento validado.</span>
    </div>
  </div>;
}
